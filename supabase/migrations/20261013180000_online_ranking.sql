-- „Онлайн империя“ — етап Г: класация и фирмени профили. Всичко се смята от сървърното състояние (журнал, техника,
-- строежи, договори) — нищо от клиента. Формулата е прозрачна и се показва на играча:
--   Стойност = наличност + блокирани депозити + техника по 50% от цената (колкото струва при продажба)
--              + строежи в ход (вложените материали)
--   Отрицателната наличност е задължение и намалява стойността (заемите не я увеличават — още няма заеми,
--   а когато дойдат, главницата ще се приспада тук).
--   Печалба (7 игрални дни) = приходи от строежи и договори − материали − поддръжка − задържани депозити.
--   Покупката/продажбата на техника и блокирането/връщането на депозит са размяна на активи, не печалба/загуба.

create or replace function online.value_parts(c online.companies) returns jsonb language sql stable as $$
  with u as (select coalesce(sum(u.n * t.cost / 2), 0)::bigint v from online.units u join online.unit_types t using (type) where u.company_id = c.id),
       w as (select coalesce(sum(b.mat), 0)::bigint v from online.builds b where b.company_id = c.id and b.status = 'running')
  select jsonb_build_object('cash', c.cash, 'held', c.held, 'units', u.v, 'wip', w.v, 'value', c.cash + c.held + u.v + w.v) from u, w
$$;

create or replace function online.profit(c online.companies, p_days int) returns bigint language sql stable as $$
  with w as (select * from online.worlds where id = c.world_id), d as (select online.wday(w) - p_days as from_day from w)
  select (coalesce((select sum(l.amount) from online.ledger l, d where l.company_id = c.id and l.day > d.from_day
                      and l.reason in ('строеж', 'търг', 'материали', 'поддръжка')), 0)
        - coalesce((select sum(k.deposit) from online.contracts k join online.ledger l on l.company_id = k.company_id and l.ref = 'dep:' || k.bid_id || ':lost', d
                      where k.company_id = c.id and k.status = 'failed' and l.day > d.from_day), 0))::bigint
$$;

create or replace function online.company_stats(c online.companies) returns jsonb language sql stable as $$
  select online.value_parts(c) || jsonb_build_object(
    'profit7', online.profit(c, 7),
    'level', online.level(c.xp), 'xp', c.xp,
    'builds_done', (select count(*) from online.builds b where b.company_id = c.id and b.status = 'done' and b.contract_id is null),
    'contracts_done', (select count(*) from online.contracts k where k.company_id = c.id and k.status = 'done'),
    'contracts_failed', (select count(*) from online.contracts k where k.company_id = c.id and k.status = 'failed'),
    'tenders_won', (select count(*) from online.contracts k where k.company_id = c.id))
$$;

-- класация: sort = 'value' | 'profit' | 'contracts'
create or replace function public.ol_ranking(p_world int, p_sort text default 'value') returns jsonb language plpgsql stable security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds;
begin
  select * into w from online.worlds where id = p_world;
  if not found or not online.can_play(u, w) then return online.fail('no_access', 'Нямаш достъп до този свят.'); end if;
  return jsonb_build_object('ok', true, 'day', online.wday(w), 'sort', p_sort,
    'formula', 'Стойност = наличност + блокирани депозити + техника по 50% + строежи в ход (вложени материали); отрицателната наличност е задължение и се приспада. Печалба = приходи от строежи и договори − материали − поддръжка − задържани депозити за последните 7 игрални дни.',
    'rows', coalesce((select jsonb_agg(r order by rk) from (
      select row_number() over (order by case p_sort when 'profit' then (s ->> 'profit7')::bigint when 'contracts' then (s ->> 'contracts_done')::bigint * 1000000000000 + (s ->> 'value')::bigint else (s ->> 'value')::bigint end desc, id) rk,
             jsonb_build_object('rank', row_number() over (order by case p_sort when 'profit' then (s ->> 'profit7')::bigint when 'contracts' then (s ->> 'contracts_done')::bigint * 1000000000000 + (s ->> 'value')::bigint else (s ->> 'value')::bigint end desc, id),
               'id', id, 'name', name, 'brand', brand, 'city', city, 'me', user_id = u,
               'value', (s ->> 'value')::bigint, 'profit7', (s ->> 'profit7')::bigint, 'level', (s ->> 'level')::int,
               'contracts_done', (s ->> 'contracts_done')::int, 'builds_done', (s ->> 'builds_done')::int) r
        from (select c.id, c.name, c.brand, c.city, c.user_id, online.company_stats(c) s from online.companies c where c.world_id = p_world) q) z), '[]'::jsonb));
end $$;

-- профил на фирма (публичен за всички в света): стойността по части, печалба, договори, последните спечелени търгове
create or replace function public.ol_company(p_world int, p_company bigint) returns jsonb language plpgsql stable security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds; c online.companies;
begin
  select * into w from online.worlds where id = p_world;
  if not found or not online.can_play(u, w) then return online.fail('no_access', 'Нямаш достъп до този свят.'); end if;
  select * into c from online.companies where id = p_company and world_id = p_world;
  if not found then return online.fail('no_company', 'Няма такава фирма.'); end if;
  return jsonb_build_object('ok', true, 'company', online.company_pub(c) || online.company_stats(c) || jsonb_build_object('me', c.user_id = u),
    'won', coalesce((select jsonb_agg(jsonb_build_object('title', t.title, 'price', k.price, 'status', k.status, 'day', online.wday(w) - floor(extract(epoch from (online.wnow(w) - t.resolved_at)) / w.day_seconds)::int) order by k.id desc)
       from (select * from online.contracts where company_id = c.id order by id desc limit 10) k join online.tenders t on t.id = k.tender_id), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('title', b.title, 'day', b.done_day) order by b.id desc)
       from (select * from online.builds where company_id = c.id and status = 'done' order by id desc limit 8) b), '[]'::jsonb));
end $$;

revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
