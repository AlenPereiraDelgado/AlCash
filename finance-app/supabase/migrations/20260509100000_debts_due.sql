-- ------------------------------
-- Add due date to debts
-- ------------------------------
alter table public.debts
    add column if not exists due date;
