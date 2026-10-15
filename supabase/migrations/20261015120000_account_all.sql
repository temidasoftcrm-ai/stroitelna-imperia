-- ⚙️ „Изтрий данните“ / „🆕 Нова игра“ трие наистина всичко на играча в облака:
-- записите (public.saves), онлайн империята (фирмите — всичко на фирмата е с on delete cascade — членството, заявките,
-- лимита и журнала), снимката за партньора и самото членство в партньорство (двойката с историята си остава за партньора).
-- p_account = true — и самия акаунт. Админските права (online.admins) не се пипат.
create or replace function public.delete_my_data(p_account boolean default false) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare u uuid := auth.uid(); n int := 0; nc int := 0; np int := 0;
begin
  if u is null then return jsonb_build_object('ok', false, 'err', 'not_authenticated'); end if;
  if to_regclass('public.saves') is not null then
    execute 'delete from public.saves where user_id = $1' using u; get diagnostics n = row_count; end if;
  if to_regclass('online.companies') is not null then
    -- спечелените търгове сочат офертата (без cascade) — търгът остава в света, само без победител
    update online.tenders set winner_bid = null where winner_bid in (select b.id from online.bids b join online.companies c on c.id = b.company_id where c.user_id = u);
    delete from online.companies where user_id = u; get diagnostics nc = row_count;
    delete from online.members where user_id = u;
    delete from online.requests where user_id = u;
    delete from online.rate where user_id = u;
    delete from online.events where user_id = u;
  end if;
  if to_regclass('coop.pairs') is not null then
    -- партньорството с друг играч остава за него (приключва, с цялата си история) — излизаш само ти;
    -- само двойка без партньор (чака покана) се трие. Така и „Изтрий акаунта“ (cascade) не трие данните на партньора.
    delete from coop.pairs where a = u and b is null; get diagnostics np = row_count;
    update coop.pairs set status = 'ended', a = case when a = u then b else a end, b = null where (a = u and b is not null) or b = u;
    delete from coop.snaps where user_id = u;
  end if;
  if p_account then delete from auth.users where id = u; end if;
  return jsonb_build_object('ok', true, 'saves', n, 'companies', nc, 'pairs_deleted', np, 'account', p_account);
end $$;
revoke all on function public.delete_my_data(boolean) from public, anon;
grant execute on function public.delete_my_data(boolean) to authenticated;
