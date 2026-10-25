-- Check-ins only happen on the kiosk, and a mistaken one is corrected with adjust_points, like a
-- forgotten one. So there's no undo: the admin button is gone and so is the function behind it.
-- Rows undone before this keep their voided_at and stay out of lists and totals.
drop function if exists public.void_check_in(uuid);
