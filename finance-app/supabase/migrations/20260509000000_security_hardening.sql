-- =====================================================================
--  AlCash · Security hardening + schema reconciliation
--  (Aditivo, idempotente — no rompe nada existente)
--
--  Incluye:
--   1. Whitelist de emails permitidos (tabla + trigger en auth.users)
--   2. Columnas faltantes en `profiles` (jsonb para datos de UI/automation)
--   3. Columnas faltantes en `transactions` (snake_case que usa el cliente)
--   4. RLS reforzada en todas las tablas (deny-by-default, propias filas)
--   5. CHECK constraints sanidad (longitud máxima de texto)
-- =====================================================================

-- ------------------------------
-- 1. WHITELIST DE EMAILS PERMITIDOS
-- ------------------------------
create table if not exists public.allowed_emails (
    email      text primary key,
    note       text,
    created_at timestamptz not null default now()
);

-- Tabla protegida: nadie del lado cliente la puede leer/modificar.
alter table public.allowed_emails enable row level security;

drop policy if exists "allowed_emails: deny all" on public.allowed_emails;
create policy "allowed_emails: deny all" on public.allowed_emails
    for all using (false) with check (false);

-- Insertar email permitido (idempotente)
insert into public.allowed_emails (email, note)
values ('alenpdelgado@gmail.com', 'owner')
on conflict (email) do nothing;

-- Trigger en auth.users: rechaza signups con email no whitelist.
create or replace function public.enforce_email_whitelist()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
    if new.email is null or not exists (
        select 1 from public.allowed_emails
        where lower(email) = lower(new.email)
    ) then
        raise exception 'EMAIL_NOT_ALLOWED: % no está autorizado para registrarse.', new.email
            using errcode = 'P0001';
    end if;
    return new;
end;
$$;

drop trigger if exists on_auth_user_email_check on auth.users;
create trigger on_auth_user_email_check
    before insert on auth.users
    for each row execute function public.enforce_email_whitelist();

-- ------------------------------
-- 2. COLUMNAS FALTANTES EN profiles
-- ------------------------------
alter table public.profiles
    add column if not exists budgets           jsonb not null default '{}'::jsonb,
    add column if not exists recurring_rules   jsonb not null default '[]'::jsonb,
    add column if not exists quick_buttons     jsonb not null default '[]'::jsonb,
    add column if not exists category_colors   jsonb not null default '{}'::jsonb,
    add column if not exists savings_widgets   jsonb not null default '[]'::jsonb,
    add column if not exists dashboard_widgets jsonb not null default '{}'::jsonb;

-- ------------------------------
-- 3. COLUMNAS FALTANTES EN transactions (snake_case que usa el cliente)
-- ------------------------------
alter table public.transactions
    add column if not exists amount_val        numeric(14,2),
    add column if not exists sub_category      text,
    add column if not exists original_amount   numeric(14,2),
    add column if not exists original_currency text;

-- ------------------------------
-- 3b. COLUMNAS FALTANTES EN debts (defensivo, idempotente)
--      El cliente envía: person, amount, type, note, paid
-- ------------------------------
alter table public.debts
    add column if not exists person text,
    add column if not exists amount numeric(14,2),
    add column if not exists type   text,
    add column if not exists note   text,
    add column if not exists paid   boolean not null default false;

-- Si existe la columna histórica "amountVal" (camelCase en migración antigua)
-- y la nueva amount_val está vacía, copiar valor — sin romper nada.
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name   = 'transactions'
          and column_name  = 'amountVal'
    ) then
        execute 'update public.transactions
                 set amount_val = "amountVal"
                 where amount_val is null and "amountVal" is not null';
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name   = 'transactions'
          and column_name  = 'subCategory'
    ) then
        execute 'update public.transactions
                 set sub_category = "subCategory"
                 where sub_category is null and "subCategory" is not null';
    end if;
end$$;

-- ------------------------------
-- 4. CHECK constraints (defensa contra abuso de tamaño)
--    Cada constraint sólo se añade si la columna correspondiente existe.
--    Así la migración no falla en bases con esquemas distintos.
-- ------------------------------
do $$
declare
    has_note         boolean;
    has_category     boolean;
    has_sub_category boolean;
    has_name         boolean;
    has_person       boolean;
    has_debts_note   boolean;
begin
    -- ---- transactions ----
    select exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='transactions' and column_name='note')         into has_note;
    select exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='transactions' and column_name='category')     into has_category;
    select exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='transactions' and column_name='sub_category') into has_sub_category;

    if (has_note or has_category or has_sub_category)
       and not exists (select 1 from pg_constraint where conname='transactions_text_length_check') then
        execute format(
            'alter table public.transactions add constraint transactions_text_length_check check (%s)',
            concat_ws(' and ',
                case when has_note         then '(note         is null or length(note)         <= 500)' end,
                case when has_category     then '(category     is null or length(category)     <= 80)'  end,
                case when has_sub_category then '(sub_category is null or length(sub_category) <= 80)'  end
            )
        );
    end if;

    -- ---- goals ----
    select exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='goals' and column_name='name') into has_name;

    if has_name and not exists (select 1 from pg_constraint where conname='goals_text_length_check') then
        alter table public.goals
            add constraint goals_text_length_check
            check (name is null or length(name) <= 120);
    end if;

    -- ---- debts ----
    select exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='debts' and column_name='person') into has_person;
    select exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='debts' and column_name='note')   into has_debts_note;

    if (has_person or has_debts_note)
       and not exists (select 1 from pg_constraint where conname='debts_text_length_check') then
        execute format(
            'alter table public.debts add constraint debts_text_length_check check (%s)',
            concat_ws(' and ',
                case when has_person     then '(person is null or length(person) <= 120)' end,
                case when has_debts_note then '(note   is null or length(note)   <= 500)' end
            )
        );
    end if;
end$$;

-- ------------------------------
-- 5. RLS REFORZADA (idempotente, deny-by-default)
-- ------------------------------
alter table public.profiles      enable row level security;
alter table public.transactions  enable row level security;
alter table public.goals         enable row level security;
alter table public.debts         enable row level security;

-- profiles: nunca permitir DELETE desde el cliente (cascada lo hace al borrar usuario).
drop policy if exists "profiles: select own"  on public.profiles;
drop policy if exists "profiles: insert own"  on public.profiles;
drop policy if exists "profiles: update own"  on public.profiles;
create policy "profiles: select own" on public.profiles
    for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles
    for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);

-- transactions
drop policy if exists "transactions: select own"  on public.transactions;
drop policy if exists "transactions: insert own"  on public.transactions;
drop policy if exists "transactions: update own"  on public.transactions;
drop policy if exists "transactions: delete own"  on public.transactions;
create policy "transactions: select own" on public.transactions
    for select using (auth.uid() = user_id);
create policy "transactions: insert own" on public.transactions
    for insert with check (auth.uid() = user_id);
create policy "transactions: update own" on public.transactions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions: delete own" on public.transactions
    for delete using (auth.uid() = user_id);

-- goals
drop policy if exists "goals: select own" on public.goals;
drop policy if exists "goals: insert own" on public.goals;
drop policy if exists "goals: update own" on public.goals;
drop policy if exists "goals: delete own" on public.goals;
create policy "goals: select own" on public.goals
    for select using (auth.uid() = user_id);
create policy "goals: insert own" on public.goals
    for insert with check (auth.uid() = user_id);
create policy "goals: update own" on public.goals
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals: delete own" on public.goals
    for delete using (auth.uid() = user_id);

-- debts
drop policy if exists "debts: select own" on public.debts;
drop policy if exists "debts: insert own" on public.debts;
drop policy if exists "debts: update own" on public.debts;
drop policy if exists "debts: delete own" on public.debts;
create policy "debts: select own" on public.debts
    for select using (auth.uid() = user_id);
create policy "debts: insert own" on public.debts
    for insert with check (auth.uid() = user_id);
create policy "debts: update own" on public.debts
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "debts: delete own" on public.debts
    for delete using (auth.uid() = user_id);
