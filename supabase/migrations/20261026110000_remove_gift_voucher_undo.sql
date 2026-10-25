-- Gift voucher spends can't be undone any more: the shop corrects a use entered by mistake with
-- adjust_gift_voucher (admin, with a reason), one way of fixing a balance instead of two.
-- The 'undo' entry kind and voided_at stay, so history written before this still reads right.
drop function if exists public.void_gift_voucher_spend(uuid);
