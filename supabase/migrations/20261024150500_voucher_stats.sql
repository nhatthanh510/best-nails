-- Per-voucher totals for the admin list (a batch can have thousands of codes).
-- security_invoker so the caller's RLS on voucher_codes applies.
create view public.voucher_stats with (security_invoker = on) as
select voucher_id,
       count(*)::int as code_count,
       sum(max_uses)::int as total_uses,
       sum(uses)::int as used,
       min(code) filter (where max_uses > 1) as shared_code
  from public.voucher_codes
 group by voucher_id;

grant select on public.voucher_stats to authenticated;
