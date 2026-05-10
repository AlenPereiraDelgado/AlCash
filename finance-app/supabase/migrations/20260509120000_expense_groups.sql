-- =====================================================================
--  Expense groups - Grupos de gastos compartidos con liquidación.
--
--  Cada grupo guarda sus miembros y entradas (gastos pagados) en JSONB
--  para mantener simplicidad operacional. La liquidación óptima
--  (mínimo número de transferencias) se calcula en cliente.
--
--  members: [{ id: string, name: string }]
--  entries: [{ id: string, payerId: string, amount: number, note?: string,
--              date?: string YYYY-MM-DD, splitWith?: string[] (member ids
--              que comparten — vacío = todos los miembros) }]
-- =====================================================================

create table if not exists public.expense_groups (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    name        text not null,
    members     jsonb not null default '[]'::jsonb,
    entries     jsonb not null default '[]'::jsonb,
    archived    boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists expense_groups_user_idx
    on public.expense_groups (user_id);

drop trigger if exists trg_expense_groups_updated on public.expense_groups;
create trigger trg_expense_groups_updated
    before update on public.expense_groups
    for each row execute function public.set_updated_at();

-- ------------------------------
-- Row Level Security
-- ------------------------------
alter table public.expense_groups enable row level security;

drop policy if exists "expense_groups: select own" on public.expense_groups;
create policy "expense_groups: select own" on public.expense_groups
    for select using (auth.uid() = user_id);

drop policy if exists "expense_groups: insert own" on public.expense_groups;
create policy "expense_groups: insert own" on public.expense_groups
    for insert with check (auth.uid() = user_id);

drop policy if exists "expense_groups: update own" on public.expense_groups;
create policy "expense_groups: update own" on public.expense_groups
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "expense_groups: delete own" on public.expense_groups;
create policy "expense_groups: delete own" on public.expense_groups
    for delete using (auth.uid() = user_id);
