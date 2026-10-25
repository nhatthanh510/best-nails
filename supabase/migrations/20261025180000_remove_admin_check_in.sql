-- Check-ins only happen on the kiosk (the shop's iPad), as in tablet-based loyalty apps: every
-- visit is a real check-in with the once-a-day rule. The admin's "Check in" buttons and their
-- function go; a forgotten visit is made up with adjust_points, which counts towards the tier
-- (tiers follow lifetime points). Past check-ins recorded from the admin keep source 'admin'.

drop function public.admin_check_in(uuid);
