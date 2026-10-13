-- „Онлайн империя“ — КОЙ Е ОНЛАЙН СЕГА.
-- Отворената страница пита сървъра на всеки 5 s (ol_state); при всяка заявка сървърът отбелязва фирмата като активна.
-- Онлайн = активна през последните 40 s. Скрит раздел в браузъра забавя заявките → фирмата изчезва от списъка.
-- Сървърът решава кой е онлайн (никой не може да се представи за друга фирма), а списъкът се вижда само от играчите в света.

alter table online.companies add column if not exists last_active timestamptz;
create index if not exists companies_active on online.companies (world_id, last_active);
create or replace function online.online_window() returns interval language sql immutable as $$ select interval '40 seconds' $$;

create or replace function online.my_company(u uuid, p_world int) returns online.companies language plpgsql as $$
declare w online.worlds; c online.companies;
begin
  select * into w from online.worlds where id = p_world;
  if not found or not online.can_play(u, w) then return null; end if;
  select * into c from online.companies where world_id = p_world and user_id = u;
  if c.id is null then return null; end if;
  perform online.settle_all(c.id);
  update online.companies set last_seen_day = greatest(last_seen_day, online.wday(w)), last_active = now() where id = c.id;
  select * into c from online.companies where id = c.id;
  return c;
end $$;

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
       from (select * from online.notes where company_id = c.id order by id desc limit 20) n), '[]'::jsonb) end,
    'online', coalesce((select jsonb_agg(jsonb_build_object('id', co.id, 'name', co.name, 'brand', co.brand, 'level', online.level(co.xp), 'me', co.id = c.id) order by co.id = c.id desc, co.name)
       from online.companies co where co.world_id = p_world and co.last_active > now() - online.online_window()
        and not exists (select 1 from online.members m where m.world_id = p_world and m.user_id = co.user_id and m.banned)), '[]'::jsonb));
end $$;

revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
