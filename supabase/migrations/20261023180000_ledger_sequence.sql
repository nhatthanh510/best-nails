-- Rows written in one transaction share created_at (e.g. sign-up bonus + first visit),
-- so history needs a strictly increasing tie-breaker.
alter table public.point_transactions add column seq bigint generated always as identity;
create index point_transactions_customer_seq_idx on public.point_transactions (customer_id, seq desc);
drop index public.point_transactions_customer_idx;
