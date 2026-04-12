-- =====================================================================
--  AlCash - Initial schema
--  Tablas: profiles, transactions, goals, debts
--  Seguridad: Row Level Security en todas las tablas (user puede
--  leer/escribir solo sus propias filas).
--  Automatismos: trigger que crea la fila en `profiles` al registrarse
--  un usuario nuevo en auth.users.
-- =====================================================================

-- ------------------------------
-- Extensiones
-- ------------------------------
create extension if not exists "pgcrypto";

-- ------------------------------
-- Tabla: profiles (1:1 con auth.users)
-- ------------------------------
create table if not exists public.profiles (
    id            uuid primary key references auth.users(id) on delete cascade,
    username      text unique,
    categories    jsonb not null default '{}'::jsonb,
    global_tags   jsonb not null default '[]'::jsonb,
    settings      jsonb not null default '{"theme":"dark","accent":"blue"}'::jsonb,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- ------------------------------
-- Tabla: transactions
-- ------------------------------
create table if not exists public.transactions (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    "amountVal"   numeric(14,2) not null,
    date          date not null,
    type          text not null check (type in ('expense','income')),
    category      text not null,
    "subCategory" text,
    note          text,
    tags          jsonb not null default '[]'::jsonb,
    is_joint      boolean not null default false,
    recurring     boolean not null default false,
    periodicity   text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
    on public.transactions (user_id, date desc);
create index if not exists transactions_user_type_idx
    on public.transactions (user_id, type);
create index if not exists transactions_user_category_idx
    on public.transactions (user_id, category);

-- ------------------------------
-- Tabla: goals
-- ------------------------------
create table if not exists public.goals (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users(id) on delete cascade,
    name       text not null,
    target     numeric(14,2) not null check (target >= 0),
    current    numeric(14,2) not null default 0 check (current >= 0),
    deadline   date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists goals_user_idx on public.goals (user_id);

-- ------------------------------
-- Tabla: debts
-- ------------------------------
create table if not exists public.debts (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users(id) on delete cascade,
    person     text not null,
    amount     numeric(14,2) not null,
    type       text not null check (type in ('owed','owe')),
    note       text,
    paid       boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists debts_user_idx on public.debts (user_id);

-- ------------------------------
-- Trigger: mantener updated_at
-- ------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
    before update on public.profiles
    for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated on public.transactions;
create trigger trg_transactions_updated
    before update on public.transactions
    for each row execute function public.set_updated_at();

drop trigger if exists trg_goals_updated on public.goals;
create trigger trg_goals_updated
    before update on public.goals
    for each row execute function public.set_updated_at();

drop trigger if exists trg_debts_updated on public.debts;
create trigger trg_debts_updated
    before update on public.debts
    for each row execute function public.set_updated_at();

-- ------------------------------
-- Trigger: autocrear profile al registrarse
-- ------------------------------
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
    insert into public.profiles (id, username)
    values (
        new.id,
        coalesce(split_part(new.email, '@', 1), 'user_' || substr(new.id::text, 1, 8))
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================

-- profiles
alter table public.profiles enable row level security;

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles
    for select using (auth.uid() = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
    for insert with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);

-- transactions
alter table public.transactions enable row level security;

drop policy if exists "transactions: select own" on public.transactions;
create policy "transactions: select own" on public.transactions
    for select using (auth.uid() = user_id);

drop policy if exists "transactions: insert own" on public.transactions;
create policy "transactions: insert own" on public.transactions
    for insert with check (auth.uid() = user_id);

drop policy if exists "transactions: update own" on public.transactions;
create policy "transactions: update own" on public.transactions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions: delete own" on public.transactions;
create policy "transactions: delete own" on public.transactions
    for delete using (auth.uid() = user_id);

-- goals
alter table public.goals enable row level security;

drop policy if exists "goals: select own" on public.goals;
create policy "goals: select own" on public.goals
    for select using (auth.uid() = user_id);

drop policy if exists "goals: insert own" on public.goals;
create policy "goals: insert own" on public.goals
    for insert with check (auth.uid() = user_id);

drop policy if exists "goals: update own" on public.goals;
create policy "goals: update own" on public.goals
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals: delete own" on public.goals;
create policy "goals: delete own" on public.goals
    for delete using (auth.uid() = user_id);

-- debts
alter table public.debts enable row level security;

drop policy if exists "debts: select own" on public.debts;
create policy "debts: select own" on public.debts
    for select using (auth.uid() = user_id);

drop policy if exists "debts: insert own" on public.debts;
create policy "debts: insert own" on public.debts
    for insert with check (auth.uid() = user_id);

drop policy if exists "debts: update own" on public.debts;
create policy "debts: update own" on public.debts
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "debts: delete own" on public.debts;
create policy "debts: delete own" on public.debts
    for delete using (auth.uid() = user_id);
