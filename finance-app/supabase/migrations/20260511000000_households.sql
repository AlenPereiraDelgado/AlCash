-- =====================================================================
--  AlCash · Households (modo "Social/Conjunto")
--
--  Modelo:
--   • Cada usuario tiene su scope PERSONAL (household_id IS NULL).
--   • Pueden pertenecer a uno o varios HOUSEHOLDS (hogares/redes
--     sociales) con datos completamente separados pero funciones
--     idénticas. Un household actúa como UNA SOLA ENTIDAD para
--     terceros (ej. al unirse a un expense_group externo cuenta
--     como un único participante con su propio nombre).
--   • Los miembros del household editan TODO entre sí (transactions,
--     goals, debts) con su propia categorización aislada.
--
--  Aditivo, idempotente, NO destructivo. Datos existentes intactos
--  (transactions/goals/debts existentes quedan en el scope personal
--  de su user_id porque household_id queda NULL).
-- =====================================================================

-- ------------------------------
-- 1. Tabla households (mirror de profile + membership)
-- ------------------------------
create table if not exists public.households (
    id                  uuid primary key default gen_random_uuid(),
    owner_id            uuid not null references auth.users(id) on delete cascade,
    name                text not null,
    invite_token        text unique,
    members             jsonb not null default '[]'::jsonb,
    member_user_ids     uuid[] not null default '{}',
    categories          jsonb not null default '{}'::jsonb,
    global_tags         jsonb not null default '[]'::jsonb,
    budgets             jsonb not null default '{}'::jsonb,
    recurring_rules     jsonb not null default '[]'::jsonb,
    quick_buttons       jsonb not null default '[]'::jsonb,
    category_colors     jsonb not null default '{}'::jsonb,
    savings_widgets     jsonb not null default '[]'::jsonb,
    dashboard_widgets   jsonb not null default '{}'::jsonb,
    settings            jsonb not null default '{}'::jsonb,
    archived            boolean not null default false,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists households_owner_idx
    on public.households (owner_id);
create index if not exists households_member_user_ids_idx
    on public.households using gin (member_user_ids);

drop trigger if exists trg_households_updated on public.households;
create trigger trg_households_updated
    before update on public.households
    for each row execute function public.set_updated_at();

-- Sanity constraints
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'households_name_length_check') then
        alter table public.households
            add constraint households_name_length_check
            check (length(name) > 0 and length(name) <= 80);
    end if;
end$$;

-- ------------------------------
-- 2. household_id en transactions / goals / debts
-- ------------------------------
alter table public.transactions
    add column if not exists household_id uuid null
        references public.households(id) on delete set null;
create index if not exists transactions_household_idx
    on public.transactions (household_id) where household_id is not null;

alter table public.goals
    add column if not exists household_id uuid null
        references public.households(id) on delete set null;
create index if not exists goals_household_idx
    on public.goals (household_id) where household_id is not null;

alter table public.debts
    add column if not exists household_id uuid null
        references public.households(id) on delete set null;
create index if not exists debts_household_idx
    on public.debts (household_id) where household_id is not null;

-- ------------------------------
-- 3. Helper: ¿soy miembro u owner de este household?
--    SECURITY DEFINER + STABLE para que sea barato dentro de RLS.
-- ------------------------------
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.households
        where id = p_household_id
          and (auth.uid() = owner_id or auth.uid() = any(member_user_ids))
    );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

-- ------------------------------
-- 4. RLS households
-- ------------------------------
alter table public.households enable row level security;

drop policy if exists "households: select scope"  on public.households;
drop policy if exists "households: insert own"    on public.households;
drop policy if exists "households: update scope"  on public.households;
drop policy if exists "households: delete owner"  on public.households;

create policy "households: select scope" on public.households
    for select using (
        auth.uid() = owner_id
        or auth.uid() = any(member_user_ids)
    );

create policy "households: insert own" on public.households
    for insert with check (auth.uid() = owner_id);

create policy "households: update scope" on public.households
    for update using (
        auth.uid() = owner_id
        or auth.uid() = any(member_user_ids)
    ) with check (
        auth.uid() = owner_id
        or auth.uid() = any(member_user_ids)
    );

create policy "households: delete owner" on public.households
    for delete using (auth.uid() = owner_id);

-- ------------------------------
-- 5. RLS transactions/goals/debts: extender al scope household
--    Política: ves la fila si eres dueño del scope personal
--    O si la fila pertenece a un household del que eres miembro.
--    Insertar: siempre user_id = caller. household_id, si va, debe
--    apuntar a un household donde caller es miembro.
--    Update/Delete: caller es dueño O caller es miembro del household.
-- ------------------------------

-- ===== transactions =====
drop policy if exists "transactions: select own"   on public.transactions;
drop policy if exists "transactions: insert own"   on public.transactions;
drop policy if exists "transactions: update own"   on public.transactions;
drop policy if exists "transactions: delete own"   on public.transactions;
drop policy if exists "transactions: select scope" on public.transactions;
drop policy if exists "transactions: insert scope" on public.transactions;
drop policy if exists "transactions: update scope" on public.transactions;
drop policy if exists "transactions: delete scope" on public.transactions;

create policy "transactions: select scope" on public.transactions
    for select using (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    );

create policy "transactions: insert scope" on public.transactions
    for insert with check (
        auth.uid() = user_id
        and (household_id is null or public.is_household_member(household_id))
    );

create policy "transactions: update scope" on public.transactions
    for update using (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    ) with check (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    );

create policy "transactions: delete scope" on public.transactions
    for delete using (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    );

-- ===== goals =====
drop policy if exists "goals: select own"   on public.goals;
drop policy if exists "goals: insert own"   on public.goals;
drop policy if exists "goals: update own"   on public.goals;
drop policy if exists "goals: delete own"   on public.goals;
drop policy if exists "goals: select scope" on public.goals;
drop policy if exists "goals: insert scope" on public.goals;
drop policy if exists "goals: update scope" on public.goals;
drop policy if exists "goals: delete scope" on public.goals;

create policy "goals: select scope" on public.goals
    for select using (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    );

create policy "goals: insert scope" on public.goals
    for insert with check (
        auth.uid() = user_id
        and (household_id is null or public.is_household_member(household_id))
    );

create policy "goals: update scope" on public.goals
    for update using (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    ) with check (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    );

create policy "goals: delete scope" on public.goals
    for delete using (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    );

-- ===== debts =====
drop policy if exists "debts: select own"   on public.debts;
drop policy if exists "debts: insert own"   on public.debts;
drop policy if exists "debts: update own"   on public.debts;
drop policy if exists "debts: delete own"   on public.debts;
drop policy if exists "debts: select scope" on public.debts;
drop policy if exists "debts: insert scope" on public.debts;
drop policy if exists "debts: update scope" on public.debts;
drop policy if exists "debts: delete scope" on public.debts;

create policy "debts: select scope" on public.debts
    for select using (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    );

create policy "debts: insert scope" on public.debts
    for insert with check (
        auth.uid() = user_id
        and (household_id is null or public.is_household_member(household_id))
    );

create policy "debts: update scope" on public.debts
    for update using (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    ) with check (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    );

create policy "debts: delete scope" on public.debts
    for delete using (
        auth.uid() = user_id
        or (household_id is not null and public.is_household_member(household_id))
    );

-- ------------------------------
-- 6. RPC · crear household + slot del owner
--
--  El caller queda registrado como owner. Se crea un slot inicial
--  con su nombre para que el household tenga al menos 1 miembro
--  ya reclamado (analogía con expense_groups).
-- ------------------------------
create or replace function public.create_household(p_name text, p_owner_member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller uuid := auth.uid();
    v_household_id uuid;
    v_owner_slot jsonb;
begin
    if v_caller is null then
        raise exception 'auth required';
    end if;
    if p_name is null or length(trim(p_name)) = 0 then
        raise exception 'household name required';
    end if;

    -- Límite: 1 hogar por usuario (owner o miembro).
    if exists (
        select 1 from public.households
        where owner_id = v_caller or v_caller = any(member_user_ids)
    ) then
        raise exception 'user already has a household';
    end if;

    v_owner_slot := jsonb_build_object(
        'id', 'm_owner',
        'name', coalesce(nullif(trim(p_owner_member_name), ''), 'Yo'),
        'userId', v_caller::text,
        'isOwner', true
    );

    insert into public.households (owner_id, name, members, member_user_ids)
    values (
        v_caller,
        trim(p_name),
        jsonb_build_array(v_owner_slot),
        array[v_caller]
    )
    returning id into v_household_id;

    return v_household_id;
end;
$$;

revoke all on function public.create_household(text, text) from public;
grant execute on function public.create_household(text, text) to authenticated;

-- ------------------------------
-- 7. RPC · añadir slot vacío (owner pre-crea miembro para invitar)
-- ------------------------------
create or replace function public.add_household_member_slot(p_household_id uuid, p_member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller uuid := auth.uid();
    v_household public.households%rowtype;
    v_new_id text;
    v_slot jsonb;
begin
    if v_caller is null then
        raise exception 'auth required';
    end if;
    select * into v_household from public.households where id = p_household_id limit 1;
    if not found then
        raise exception 'household not found';
    end if;
    if v_household.owner_id <> v_caller then
        raise exception 'only owner can add slots';
    end if;
    if p_member_name is null or length(trim(p_member_name)) = 0 then
        raise exception 'member name required';
    end if;

    v_new_id := 'm_' || replace(gen_random_uuid()::text, '-', '');
    v_slot := jsonb_build_object(
        'id', v_new_id,
        'name', trim(p_member_name)
    );

    update public.households
       set members = coalesce(members, '[]'::jsonb) || jsonb_build_array(v_slot)
     where id = p_household_id;

    return v_household.id;
end;
$$;

revoke all on function public.add_household_member_slot(uuid, text) from public;
grant execute on function public.add_household_member_slot(uuid, text) to authenticated;

-- ------------------------------
-- 8. RPC · token de invitación (genera/devuelve)
-- ------------------------------
create or replace function public.ensure_household_invite_token(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller uuid := auth.uid();
    v_household public.households%rowtype;
    v_token text;
begin
    if v_caller is null then
        raise exception 'auth required';
    end if;
    select * into v_household from public.households where id = p_household_id limit 1;
    if not found then
        raise exception 'household not found';
    end if;
    if v_household.owner_id <> v_caller and not (v_caller = any(v_household.member_user_ids)) then
        raise exception 'not a member';
    end if;
    if v_household.invite_token is not null then
        return v_household.invite_token;
    end if;

    v_token := substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
    update public.households
       set invite_token = v_token
     where id = p_household_id;

    return v_token;
end;
$$;

revoke all on function public.ensure_household_invite_token(uuid) from public;
grant execute on function public.ensure_household_invite_token(uuid) to authenticated;

-- ------------------------------
-- 9. RPC · preview público por token
-- ------------------------------
create or replace function public.get_household_by_token(p_token text)
returns table (
    id        uuid,
    name      text,
    members   jsonb,
    owner_id  uuid
)
language sql
security definer
set search_path = public
as $$
    select h.id, h.name, h.members, h.owner_id
    from public.households h
    where h.invite_token = p_token
    limit 1;
$$;

revoke all on function public.get_household_by_token(text) from public;
grant execute on function public.get_household_by_token(text) to anon, authenticated;

-- ------------------------------
-- 10. RPC · aceptar invitación reclamando slot
-- ------------------------------
create or replace function public.accept_household_invite(p_token text, p_member_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller uuid := auth.uid();
    v_household public.households%rowtype;
    v_new_members jsonb;
    v_slot_idx int;
    v_slot jsonb;
begin
    if v_caller is null then
        raise exception 'auth required';
    end if;

    select * into v_household
      from public.households
     where invite_token = p_token
     limit 1;
    if not found then
        raise exception 'invite not found';
    end if;

    select i, m
      into v_slot_idx, v_slot
      from jsonb_array_elements(v_household.members) with ordinality as t(m, i)
      where m->>'id' = p_member_id
      limit 1;

    if v_slot_idx is null then
        raise exception 'member slot not found';
    end if;

    if v_household.owner_id = v_caller then
        raise exception 'owner cannot accept own invite';
    end if;

    if (v_slot->>'userId') is not null and (v_slot->>'userId')::uuid <> v_caller then
        raise exception 'slot already claimed';
    end if;

    -- Límite: 1 hogar por usuario. Si ya pertenece a otro distinto, bloquear.
    if exists (
        select 1 from public.households
        where id <> v_household.id
          and (owner_id = v_caller or v_caller = any(member_user_ids))
    ) then
        raise exception 'user already has a household';
    end if;

    v_new_members := jsonb_set(
        v_household.members,
        array[(v_slot_idx - 1)::text],
        v_slot || jsonb_build_object('userId', v_caller::text),
        true
    );

    update public.households
       set members = v_new_members,
           member_user_ids = (
               case when v_caller = any(member_user_ids)
                    then member_user_ids
                    else array_append(member_user_ids, v_caller)
               end
           )
     where id = v_household.id;

    return v_household.id;
end;
$$;

revoke all on function public.accept_household_invite(text, text) from public;
grant execute on function public.accept_household_invite(text, text) to authenticated;

-- ------------------------------
-- 11. RPC · salir del household (no owner)
--      El owner no puede salir; si quiere terminar el household
--      debe borrarlo (DELETE) — sus rows con household_id pasan
--      a NULL (a personal de quien las creó) por el ON DELETE SET NULL.
-- ------------------------------
create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller uuid := auth.uid();
    v_household public.households%rowtype;
    v_new_members jsonb;
begin
    if v_caller is null then
        raise exception 'auth required';
    end if;
    select * into v_household from public.households where id = p_household_id limit 1;
    if not found then
        raise exception 'household not found';
    end if;
    if v_household.owner_id = v_caller then
        raise exception 'owner cannot leave; delete household instead';
    end if;
    if not (v_caller = any(v_household.member_user_ids)) then
        raise exception 'not a member';
    end if;

    -- desreclamar slot(s) del caller
    select jsonb_agg(
        case when (m->>'userId')::uuid is not distinct from v_caller
             then (m - 'userId')
             else m
        end
    )
      into v_new_members
      from jsonb_array_elements(v_household.members) m;

    update public.households
       set members = coalesce(v_new_members, '[]'::jsonb),
           member_user_ids = array_remove(member_user_ids, v_caller)
     where id = p_household_id;
end;
$$;

revoke all on function public.leave_household(uuid) from public;
grant execute on function public.leave_household(uuid) to authenticated;

-- ------------------------------
-- 12. RPC · borrar household (solo owner)
--      Evita falsos negativos de RLS y centraliza la comprobación.
--      Las filas dependientes en transactions/goals/debts pasan a
--      household_id=NULL por el ON DELETE SET NULL → vuelven al
--      scope personal de su user_id original. No se pierden datos.
-- ------------------------------
create or replace function public.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller uuid := auth.uid();
    v_owner uuid;
begin
    if v_caller is null then
        raise exception 'auth required';
    end if;
    select owner_id into v_owner from public.households where id = p_household_id limit 1;
    if not found then
        raise exception 'household not found';
    end if;
    if v_owner <> v_caller then
        raise exception 'only owner can delete';
    end if;

    delete from public.households where id = p_household_id;
end;
$$;

revoke all on function public.delete_household(uuid) from public;
grant execute on function public.delete_household(uuid) to authenticated;
