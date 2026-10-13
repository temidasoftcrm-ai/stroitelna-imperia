-- ol_state показва и блокираните депозити (held) и броя активни договори
create or replace function public.ol_state(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds; c online.companies;
begin
  select * into w from online.worlds where id = p_world;
  if not found or not online.can_play(u, w) then return online.fail('no_access', 'Нямаш достъп до този свят.'); end if;
  c := online.my_company(u, p_world);
  return jsonb_build_object('ok', true,
    'world', jsonb_build_object('id', w.id, 'name', w.name, 'slug', w.slug, 'status', w.status, 'day', online.wday(w), 'frac', online.wfrac(w),
      'day_seconds', w.day_seconds, 'server_now', online.wnow(w), 'epoch', w.epoch + make_interval(secs => 0),
      'cfg', jsonb_build_object('offer_board', online.cfg(w, 'offer_board', 4), 'offer_days', online.cfg(w, 'offer_days', 3), 'max_builds', online.cfg(w, 'max_builds', 6), 'idle_days', online.cfg(w, 'idle_days', 3))),
    'catalog', jsonb_build_object(
      'units', (select jsonb_agg(to_jsonb(t) order by t.cost) from online.unit_types t),
      'kinds', (select jsonb_agg(to_jsonb(k) order by k.reward) from online.kinds k)),
    'company', case when c.id is null then null else online.company_pub(c) || jsonb_build_object('cash', c.cash, 'settled_day', c.settled_day,
      'level', online.level(c.xp), 'lv_from', online.level_xp(online.level(c.xp)), 'lv_to', online.level_xp(online.level(c.xp) + 1),
      'upkeep', online.upkeep(c.id), 'last_seen_day', c.last_seen_day, 'held', c.held, 'contracts', online.open_contracts(c.id)) end,
    'units', case when c.id is null then '{}'::jsonb else coalesce((select jsonb_object_agg(type, n) from online.units where company_id = c.id), '{}'::jsonb) end,
    'free', case when c.id is null then '{}'::jsonb else online.free_units(c.id) end,
    'offers', case when c.id is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(o) - 'company_id' order by o.id) from online.offers o where o.company_id = c.id and o.status = 'open'), '[]'::jsonb) end,
    'builds', case when c.id is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(b) - 'company_id' order by b.id) from online.builds b where b.company_id = c.id and (b.status = 'running' or b.id in (select id from online.builds where company_id = c.id and status = 'done' order by id desc limit 40))), '[]'::jsonb) end,
    'ledger', case when c.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('day', l.day, 'amount', l.amount, 'reason', l.reason, 'note', l.note) order by l.id desc)
       from (select * from online.ledger where company_id = c.id order by id desc limit 30) l), '[]'::jsonb) end,
    'notes', case when c.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body, 'seen', n.seen, 'at', n.at) order by n.id desc)
       from (select * from online.notes where company_id = c.id order by id desc limit 20) n), '[]'::jsonb) end);
end $$;
