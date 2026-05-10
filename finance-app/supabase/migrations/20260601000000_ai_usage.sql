-- =====================================================================
--  ai_usage · contador mensual por usuario para parse-expense
-- =====================================================================

create table if not exists public.ai_usage (
    user_id uuid not null references auth.users(id) on delete cascade,
    month text not null,                   -- 'YYYY-MM'
    count int not null default 0,
    updated_at timestamptz not null default now(),
    primary key (user_id, month)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own"
    on public.ai_usage for select
    using (auth.uid() = user_id);

drop policy if exists "ai_usage_service_write" on public.ai_usage;
create policy "ai_usage_service_write"
    on public.ai_usage for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
