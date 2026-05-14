-- =====================================================================
--  ai_calls · log por llamada para métricas de coste y uso
-- =====================================================================

create table if not exists public.ai_calls (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    email text,
    ts timestamptz not null default now(),
    input_tokens int not null default 0,
    output_tokens int not null default 0,
    cost_usd numeric(12,6) not null default 0,
    ok boolean not null default true,
    text_len int not null default 0,
    image_count int not null default 0,
    item_count int not null default 0,
    stop_reason text
);

create index if not exists ai_calls_ts_idx on public.ai_calls (ts desc);
create index if not exists ai_calls_user_idx on public.ai_calls (user_id);

alter table public.ai_calls enable row level security;

drop policy if exists "ai_calls_service_all" on public.ai_calls;
create policy "ai_calls_service_all"
    on public.ai_calls for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
