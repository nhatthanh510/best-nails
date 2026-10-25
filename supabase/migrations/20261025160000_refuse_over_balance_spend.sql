-- Spending more than a gift voucher has left is refused (status 'over_balance', with the
-- balance) instead of using what's left and reporting the rest as still to pay: staff found a
-- "success" for the wrong amount confusing. still_to_pay_cents stays in the reply (always 0) so
-- older callers keep working.

CREATE OR REPLACE FUNCTION public.spend_gift_voucher(p_code text, p_amount_cents integer, p_customer_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_id uuid;
  v_result jsonb;
  v_spend integer;
  v_balance integer;
begin
  perform public.assert_signed_in();
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 500000 then
    raise exception 'enter the amount for today''s service' using errcode = '22023';
  end if;
  -- Lock the voucher so two tills can't spend the same balance.
  select id into v_id from public.gift_vouchers where code = public.normalize_voucher_code(p_code) for update;
  if v_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_result := public.check_gift_voucher(p_code);
  if v_result->>'status' <> 'valid' then
    return v_result;
  end if;

  -- More than is left: spend nothing and say how much there is, so staff enter that amount and
  -- take the rest at the till, rather than the voucher quietly covering only part of it.
  if p_amount_cents > (v_result->>'balance_cents')::int then
    return v_result || jsonb_build_object('status', 'over_balance');
  end if;

  v_spend := p_amount_cents;
  v_balance := public._post_gift_voucher(v_id, 'spend', -v_spend, p_customer_id, p_note);

  return v_result || jsonb_build_object(
    'status', 'spent',
    'spent_cents', v_spend,
    'balance_cents', v_balance,
    'still_to_pay_cents', 0
  );
end;
$$;
