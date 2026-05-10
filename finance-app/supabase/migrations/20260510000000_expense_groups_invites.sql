-- =====================================================================
--  Expense groups · invitaciones por link estilo Tricount
--  (Aditivo, idempotente — no rompe nada existente)
--
--  Cambios:
--   1. Columnas nuevas en `expense_groups`:
--        invite_token text unique  → slug que se comparte por URL
--        shared_user_ids uuid[]    → uids con permiso (excluye dueño)
--   2. RLS extendido: dueño O usuario en shared_user_ids puede
--      seleccionar / actualizar. Sólo dueño puede borrar.
--   3. RPCs:
--        get_group_by_token(token)         → preview público (security definer)
--        accept_group_invite(token, mid)   → reclama slot del miembro
-- =====================================================================

alter table public.expense_groups
    add column if not exists invite_token    text unique,
    add column if not exists shared_user_ids uuid[] not null default '{}';

create index if not exists expense_groups_shared_idx
    on public.expense_groups using gin (shared_user_ids);

-- ------------------------------
-- RLS: añadir lectura/escritura a invitados
-- ------------------------------
drop policy if exists "expense_groups: select own"    on public.expense_groups;
drop policy if exists "expense_groups: select shared" on public.expense_groups;
create policy "expense_groups: select shared" on public.expense_groups
    for select using (
        auth.uid() = user_id
        or auth.uid() = any(shared_user_ids)
    );

drop policy if exists "expense_groups: update own"    on public.expense_groups;
drop policy if exists "expense_groups: update shared" on public.expense_groups;
create policy "expense_groups: update shared" on public.expense_groups
    for update using (
        auth.uid() = user_id
        or auth.uid() = any(shared_user_ids)
    ) with check (
        auth.uid() = user_id
        or auth.uid() = any(shared_user_ids)
    );

-- delete sigue siendo solo dueño (policy original "expense_groups: delete own"
-- creada en 20260509120000_expense_groups.sql, NO la tocamos)

-- ------------------------------
-- RPC · preview público por token (security definer)
-- ------------------------------
create or replace function public.get_group_by_token(p_token text)
returns table (
    id          uuid,
    name        text,
    members     jsonb,
    owner_id    uuid
)
language sql
security definer
set search_path = public
as $$
    select g.id, g.name, g.members, g.user_id
    from public.expense_groups g
    where g.invite_token = p_token
    limit 1;
$$;

revoke all on function public.get_group_by_token(text) from public;
grant execute on function public.get_group_by_token(text) to anon, authenticated;

-- ------------------------------
-- RPC · aceptar invitación reclamando un slot
--
--  Recibe: token + member_id (slot dentro de members JSONB)
--  Efecto: añade auth.uid() a shared_user_ids del grupo y marca
--          members[i].userId = auth.uid() del slot indicado, sólo si:
--            - el grupo existe
--            - el slot existe
--            - el slot no está ya reclamado por otro user
--            - el caller no es el dueño (no se "reclama" a sí mismo)
-- ------------------------------
create or replace function public.accept_group_invite(p_token text, p_member_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_group  public.expense_groups%rowtype;
    v_caller uuid := auth.uid();
    v_new_members jsonb;
    v_slot_idx int;
    v_slot jsonb;
begin
    if v_caller is null then
        raise exception 'auth required';
    end if;

    select * into v_group from public.expense_groups where invite_token = p_token limit 1;
    if not found then
        raise exception 'invite not found';
    end if;

    -- Localizar slot por id dentro del array JSONB
    select i, m
      into v_slot_idx, v_slot
      from jsonb_array_elements(v_group.members) with ordinality as t(m, i)
      where m->>'id' = p_member_id
      limit 1;

    if v_slot_idx is null then
        raise exception 'member slot not found';
    end if;

    -- Caller no puede ser dueño
    if v_group.user_id = v_caller then
        raise exception 'owner cannot accept own invite';
    end if;

    -- Slot ya reclamado por otro
    if (v_slot->>'userId') is not null and (v_slot->>'userId')::uuid <> v_caller then
        raise exception 'slot already claimed';
    end if;

    -- Reescribir slot con userId del caller
    v_new_members := jsonb_set(
        v_group.members,
        array[(v_slot_idx - 1)::text],
        v_slot || jsonb_build_object('userId', v_caller::text),
        true
    );

    update public.expense_groups
       set members = v_new_members,
           shared_user_ids = (
               case when v_caller = any(shared_user_ids)
                    then shared_user_ids
                    else array_append(shared_user_ids, v_caller)
               end
           )
     where id = v_group.id;

    return v_group.id;
end;
$$;

revoke all on function public.accept_group_invite(text, text) from public;
grant execute on function public.accept_group_invite(text, text) to authenticated;
