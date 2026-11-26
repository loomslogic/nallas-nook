-- Nalla’s Nook: "how many bought" counts on the order page
-- Run this ONCE in Supabase > SQL Editor > New query > Run.
--
-- It creates a function the website can call to get the total quantity bought
-- per item. It returns ONLY item names and totals (no customer names, numbers
-- or order details), so it is safe to expose publicly.
--
-- Counted: orders that are paid, preparing, ready or done.
-- Not counted: cancelled orders and orders still waiting for payment/verification.
-- (Counter orders are counted once the cashier presses "Mark paid".)

create or replace function public.item_sales()
returns table(name text, sold bigint)
language sql
stable
security definer
set search_path = public
as $$
  select trim(i->>'name') as name,
         sum(coalesce((i->>'qty')::int, 0))::bigint as sold
  from public.orders o,
       jsonb_array_elements(o.items::jsonb) as i
  where o.status in ('paid', 'preparing', 'ready', 'done')
    and i->>'name' is not null
  group by trim(i->>'name');
$$;

revoke all on function public.item_sales() from public;
grant execute on function public.item_sales() to anon, authenticated;
