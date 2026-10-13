-- „Онлайн империя“ — версия 2, стъпка 1: ПАЗАР МЕЖДУ ИГРАЧИТЕ (материали, гориво, енергия).
-- Стоки: бетон, стомана, гориво, енергия. Строежите и договорите ползват реални стоки: първо от склада на фирмата,
-- липсващото се купува от държавата на пълна цена. Фирмите строят производства (бетонов възел, стоманолеярна, нефтобаза,
-- соларен парк), които произвеждат всеки ден (и при затворен браузър, по правилата за отсъствие); заводите ползват
-- енергия, а заетата техника — гориво (от склада, иначе от държавата).
-- Пазарът: продавачът пуска оферта (количество и цена ≤ държавната) — стоката се блокира; купувачът купува най-евтиното
-- (без своите оферти), парите и стоката се разменят в една транзакция; продавачът плаща 2% такса. Държавата изкупува
-- излишъка на 60% от цената (долна граница). Количествата са с 2 знака след запетаята, парите — в евроцентове.

create table online.goods (good text primary key, nm text not null, ico text not null, unit text not null, price bigint not null);
insert into online.goods values
  ('concrete', 'Бетон', '⚪', 'м³', 11000),
  ('steel', 'Стомана', '🔩', 'т', 90000),
  ('fuel', 'Гориво', '⛽', 'т', 160000),
  ('energy', 'Енергия', '⚡', 'MWh', 12000);
create or replace function online.buyback_pct() returns numeric language sql immutable as $$ select 0.6 $$;
create or replace function online.fee_pct() returns numeric language sql immutable as $$ select 0.02 $$;
create or replace function online.fuel_per_machine() returns numeric language sql immutable as $$ select 0.05 $$;   -- т гориво на ден за заета машина

create table online.inventory (
  company_id bigint not null references online.companies on delete cascade,
  good text not null references online.goods,
  qty numeric(14, 2) not null default 0 check (qty >= 0),
  primary key (company_id, good)
);

create table online.facility_types (
  type text primary key, nm text not null, ico text not null,
  cost bigint not null, upkeep bigint not null,
  good text not null references online.goods, out_qty numeric not null, energy numeric not null, min_level int not null
);
insert into online.facility_types values
  ('concrete_plant', 'Бетонов възел', '🏭', 25000000, 30000, 'concrete', 30, 5, 3),
  ('solar', 'Соларен парк', '☀️', 25000000, 20000, 'energy', 15, 0, 3),
  ('refinery', 'Нефтобаза', '🛢️', 60000000, 80000, 'fuel', 3, 8, 4),
  ('steel_mill', 'Стоманолеярна', '🔥', 40000000, 120000, 'steel', 6, 15, 5);

create table online.facilities (
  company_id bigint not null references online.companies on delete cascade,
  type text not null references online.facility_types,
  n int not null default 0 check (n >= 0),
  primary key (company_id, type)
);

create table online.asks (
  id bigserial primary key,
  world_id int not null references online.worlds on delete cascade,
  company_id bigint not null references online.companies on delete cascade,
  good text not null references online.goods,
  qty numeric(14, 2) not null check (qty >= 0),     -- оставащо (блокирано) количество
  price bigint not null check (price > 0),          -- евроцентове за единица
  created_at timestamptz not null default clock_timestamp(),
  status text not null default 'open' check (status in ('open', 'filled', 'cancelled'))
);
create index asks_book on online.asks (world_id, good, price, id) where status = 'open';

create table online.trades (
  id bigserial primary key,
  world_id int not null, ask_id bigint not null references online.asks,
  buyer bigint not null references online.companies on delete cascade, seller bigint not null references online.companies on delete cascade,
  good text not null, qty numeric(14, 2) not null, price bigint not null,
  at timestamptz not null default now()
);
create index trades_world on online.trades (world_id, id desc);

-- стоки за строежите (вместо пари за материали): kinds.mat става държавната цена на стоките
alter table online.kinds add column if not exists goods jsonb;
update online.kinds set goods = case kind
  when 'house' then '{"concrete":48,"steel":4}' when 'shop' then '{"concrete":135,"steel":13}'
  when 'office' then '{"concrete":260,"steel":28}' else '{"concrete":560,"steel":59}' end::jsonb;
update online.kinds k set mat = (select sum((e.value::text)::numeric * g.price)::bigint from jsonb_each(k.goods) e join online.goods g on g.good = e.key);
alter table online.tenders add column if not exists goods jsonb;
-- търговете: стойността на материалите се разпределя 60% бетон / 40% стомана
create or replace function online.tender_goods() returns trigger language plpgsql as $$
begin
  if new.goods is null then
    new.goods := jsonb_build_object('concrete', round(new.mat * 0.6 / 11000), 'steel', round(new.mat * 0.4 / 90000));
    new.mat := (round(new.mat * 0.6 / 11000) * 11000 + round(new.mat * 0.4 / 90000) * 90000)::bigint;
  end if;
  return new;
end $$;
create trigger tenders_goods before insert on online.tenders for each row execute function online.tender_goods();
update online.tenders set goods = jsonb_build_object('concrete', round(mat * 0.6 / 11000), 'steel', round(mat * 0.4 / 90000)) where goods is null;

-- ── склад ──
create or replace function online.inv(p_company bigint, p_good text) returns numeric language sql stable as
  $$ select coalesce((select qty from online.inventory where company_id = p_company and good = p_good), 0) $$;
create or replace function online.inv_add(p_company bigint, p_good text, p_qty numeric) returns void language sql as $$
  insert into online.inventory (company_id, good, qty) values (p_company, p_good, p_qty)
    on conflict (company_id, good) do update set qty = online.inventory.qty + excluded.qty
$$;
-- колко ще струва липсващото в склада (по държавна цена)
create or replace function online.goods_gap(p_company bigint, p_goods jsonb) returns bigint language sql stable as $$
  select coalesce(sum(ceil(greatest(0, (e.value::text)::numeric - online.inv(p_company, e.key)) * g.price)), 0)::bigint
    from jsonb_each(coalesce(p_goods, '{}')) e join online.goods g on g.good = e.key
$$;
-- Използва стоки: от склада, липсващото — от държавата. Връща false, ако няма пари за липсващото (нищо не се променя).
create or replace function online.use_goods(p_company bigint, p_goods jsonb, p_note text, p_ref text) returns boolean language plpgsql as $$
declare c online.companies; gap bigint; e record; have numeric; own text := '';
begin
  select * into c from online.companies where id = p_company for update;
  gap := online.goods_gap(p_company, p_goods);
  if c.cash < gap then return false; end if;
  for e in select key, (value::text)::numeric v from jsonb_each(coalesce(p_goods, '{}')) loop
    have := least(online.inv(p_company, e.key), e.v);
    if have > 0 then
      update online.inventory set qty = qty - have where company_id = p_company and good = e.key;
      own := own || format(' %s %s %s', have, (select unit from online.goods where good = e.key), (select nm from online.goods where good = e.key));
    end if;
  end loop;
  if gap > 0 then perform online.money(p_company, -gap, 'материали', p_note || case when own <> '' then ' (от склада:' || own || ')' else '' end, p_ref); end if;
  if gap = 0 then perform online.money(p_company, 0, 'материали', p_note || ' — изцяло от склада:' || own, p_ref, true); end if;
  return true;
end $$;

-- поддръжка: техниката + производствата
create or replace function online.upkeep(p_company bigint) returns bigint language sql stable as $$
  select (coalesce((select sum(u.n * t.upkeep) from online.units u join online.unit_types t using (type) where u.company_id = p_company), 0)
        + coalesce((select sum(f.n * ft.upkeep) from online.facilities f join online.facility_types ft using (type) where f.company_id = p_company), 0))::bigint
$$;

-- Производство за активните дни [d0, d1]: първо се произвежда (и енергията), после заводите ползват енергия,
-- а заетата техника — гориво. Липсващото се купува от държавата. ref по d0 → всеки период веднъж.
create or replace function online.produce(p_company bigint, d0 int, d1 int) returns void language plpgsql as $$
declare n int := d1 - d0 + 1; f record; need_e numeric := 0; need_f numeric; have numeric; gap numeric; pe bigint; pf bigint;
begin
  if n <= 0 then return; end if;
  for f in select fc.n cnt, ft.* from online.facilities fc join online.facility_types ft using (type) where fc.company_id = p_company and fc.n > 0 loop
    perform online.inv_add(p_company, f.good, f.out_qty * f.cnt * n);
    need_e := need_e + f.energy * f.cnt * n;
  end loop;
  need_f := online.fuel_per_machine() * n * coalesce((select sum(e.value::int) from jsonb_each_text(online.busy(p_company)) e where e.key in ('loader', 'truck', 'tractor', 'crane')), 0);
  select price into pe from online.goods where good = 'energy'; select price into pf from online.goods where good = 'fuel';
  if need_e > 0 then
    have := least(online.inv(p_company, 'energy'), need_e); update online.inventory set qty = qty - have where company_id = p_company and good = 'energy';
    gap := need_e - have;
    if gap > 0 then perform online.money(p_company, -ceil(gap * pe)::bigint, 'енергия', format('Ток от мрежата: %s MWh (дни %s–%s)', gap, d0, d1), 'energy:' || d0, true); end if;
  end if;
  if need_f > 0 then
    have := least(online.inv(p_company, 'fuel'), need_f); update online.inventory set qty = qty - have where company_id = p_company and good = 'fuel';
    gap := need_f - have;
    if gap > 0 then perform online.money(p_company, -ceil(gap * pf)::bigint, 'гориво', format('Гориво за техниката: %s т (дни %s–%s)', gap, d0, d1), 'fuel:' || d0, true); end if;
  end if;
end $$;

-- ── уреждането, стартът на строеж и на договор — със стоките (заменят версиите от етапи Б и В) ──
create or replace function online.settle(p_company bigint) returns void language plpgsql as $$
declare c online.companies; w online.worlds; d int; b online.builds; lvb int; lva int; up bigint; d0 int; d1 int; idle int;
begin
  select * into c from online.companies where id = p_company for update;
  if not found then return; end if;
  select * into w from online.worlds where id = c.world_id;
  d := online.wday(w);
  -- 1) завършени строежи (по реда на завършване)
  for b in select * from online.builds where company_id = c.id and status = 'running' and end_at <= online.wnow(w) order by end_at, id loop
    update online.builds set status = 'done', done_day = greatest(1, (floor(extract(epoch from (b.end_at - w.epoch)) / w.day_seconds))::int + 1) where id = b.id;
    if online.money(c.id, b.reward, 'строеж', format('%s — предаден', b.title), 'build:' || b.id) then
      select xp into lvb from online.companies where id = c.id;
      lvb := online.level(lvb);
      update online.companies set xp = xp + b.xp where id = c.id returning online.level(xp) into lva;
      perform online.note(c.id, 'good', format('✅ %s е готов', b.title), format('+%s € и +%s XP', online.eur(b.reward), b.xp));
      if lva > lvb then perform online.note(c.id, 'level', format('⭐ Ниво %s!', lva), 'Отключват се по-големи поръчки.'); end if;
    end if;
  end loop;
  -- 2) поддръжка на техниката за изминалите дни [settled_day, d). При отсъствие над idle_days дни фирмата е „в покой“ — без поддръжка.
  if c.settled_day < d then
    idle := online.cfg(w, 'idle_days', 3)::int;
    d0 := c.settled_day; d1 := least(d - 1, c.last_seen_day + idle);
    up := online.upkeep(c.id);
    if d1 >= d0 and up > 0 then
      perform online.money(c.id, -(up * (d1 - d0 + 1)), 'поддръжка',
        case when d1 > d0 then format('Заплати и поддръжка, дни %s–%s', d0, d1) else format('Заплати и поддръжка, ден %s', d0) end, 'upkeep:' || d0, true);
    end if;
    if d1 >= d0 then perform online.produce(c.id, d0, d1); end if;   -- производство, енергия и гориво за активните дни
    update online.companies set settled_day = d where id = c.id;
  end if;
  -- 3) табло с поръчки
  select * into c from online.companies where id = p_company;
  perform online.gen_offers(c, w, d);
end $$;

create or replace function public.ol_start_build(p_req uuid, p_world int, p_offer bigint) returns jsonb
language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; w online.worlds; o online.offers; k online.kinds; fr jsonb; e record; lot int; bid bigint; nrun int;
begin
  r := online.req_begin(u, p_req, 'start_build'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into w from online.worlds where id = p_world;
  select * into o from online.offers where id = p_offer and company_id = c.id for update;   -- само собствените предложения
  if not found or o.status <> 'open' then return online.req_end(u, p_req, online.fail('no_offer', 'Поръчката вече не е налична.')); end if;
  select * into k from online.kinds where kind = o.kind;
  select count(*) into nrun from online.builds where company_id = c.id and status = 'running';
  if nrun >= online.cfg(w, 'max_builds', 6) then return online.req_end(u, p_req, online.fail('max_builds', 'Достигнат е лимитът на едновременните строежи.')); end if;
  fr := online.free_units(c.id);
  for e in select key, value::int v from jsonb_each_text(k.need) loop
    if coalesce((fr ->> e.key)::int, 0) < e.v then
      return online.req_end(u, p_req, online.fail('no_units', format('Няма свободна техника: трябва %s × %s.', e.v, (select nm from online.unit_types where type = e.key))));
    end if;
  end loop;
  if not online.use_goods(c.id, k.goods, format('Материали: %s за %s', k.nm, o.client), 'mat:' || o.id) then
    return online.req_end(u, p_req, online.fail('no_money', format('Нямаш %s € за материалите, които липсват в склада.', online.eur(online.goods_gap(c.id, k.goods)))));
  end if;
  update online.offers set status = 'taken' where id = o.id;
  update online.companies set lots_used = lots_used + 1 where id = c.id returning lots_used into lot;
  insert into online.builds (company_id, offer_id, kind, title, reward, mat, xp, need, lot, start_at, end_at)
    values (c.id, o.id, o.kind, format('%s %s — %s', k.ico, k.nm, o.client), o.reward, o.mat, (o.reward / 10000)::int, k.need, lot,
            online.wnow(w), online.wnow(w) + make_interval(secs => o.days * w.day_seconds)) returning id into bid;
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'build', bid));
end $$;

create or replace function public.ol_start_contract(p_req uuid, p_world int, p_contract bigint) returns jsonb
language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; w online.worlds; k online.contracts; t online.tenders; fr jsonb; e record; adv bigint; lot int; bid bigint;
begin
  r := online.req_begin(u, p_req, 'start_contract'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into w from online.worlds where id = p_world;
  select * into k from online.contracts where id = p_contract and company_id = c.id for update;   -- само собствените договори
  if not found then return online.req_end(u, p_req, online.fail('no_contract', 'Няма такъв договор.')); end if;
  if k.status <> 'awaiting' then return online.req_end(u, p_req, online.fail('not_awaiting', 'Договорът вече е започнат или приключен.')); end if;
  if k.start_by <= online.wnow(w) then perform online.fail_contract(k.id); return online.req_end(u, p_req, online.fail('late', 'Срокът за започване изтече.')); end if;
  select * into t from online.tenders where id = k.tender_id;
  fr := online.free_units(c.id);
  for e in select key, value::int v from jsonb_each_text(t.need) loop
    if coalesce((fr ->> e.key)::int, 0) < e.v then
      return online.req_end(u, p_req, online.fail('no_units', format('Няма свободна техника: трябва %s × %s.', e.v, (select nm from online.unit_types where type = e.key))));
    end if;
  end loop;
  adv := round(k.price * online.advance_pct());
  select * into c from online.companies where id = c.id for update;
  if c.cash + adv < online.goods_gap(c.id, t.goods) then
    return online.req_end(u, p_req, online.fail('no_money', format('Нямаш %s € за материалите, които липсват в склада (след аванса от %s €).', online.eur(online.goods_gap(c.id, t.goods) - adv), online.eur(adv))));
  end if;
  perform online.money(c.id, adv, 'търг', format('Аванс по договор: %s', t.title), 'adv:' || k.id);
  perform online.use_goods(c.id, t.goods, format('Материали: %s', t.title), 'cmat:' || k.id);
  update online.companies set lots_used = lots_used + 1 where id = c.id returning lots_used into lot;
  insert into online.builds (company_id, kind, title, reward, mat, xp, need, lot, start_at, end_at, contract_id)
    values (c.id, case when t.tier = 'local' then 'shop' when t.tier = 'national' then 'office' else 'tower' end, t.title, k.price - adv, t.mat,
            (k.price / 10000)::int, t.need, lot, online.wnow(w), online.wnow(w) + make_interval(secs => t.days * w.day_seconds), k.id) returning id into bid;
  update online.contracts set status = 'running', build_id = bid where id = k.id;
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'build', bid));
end $$;

-- ── стойност и печалба (класацията) с производствата и склада ──
create or replace function online.value_parts(c online.companies) returns jsonb language sql stable as $$
  with u as (select coalesce(sum(u.n * t.cost / 2), 0)::bigint v from online.units u join online.unit_types t using (type) where u.company_id = c.id),
       f as (select coalesce(sum(f.n * t.cost / 2), 0)::bigint v from online.facilities f join online.facility_types t using (type) where f.company_id = c.id),
       w as (select coalesce(sum(b.mat), 0)::bigint v from online.builds b where b.company_id = c.id and b.status = 'running'),
       g as (select coalesce(sum(floor(q.qty * gd.price * online.buyback_pct())), 0)::bigint v from (
               select good, qty from online.inventory where company_id = c.id
               union all select good, qty from online.asks where company_id = c.id and status = 'open') q join online.goods gd using (good))
  select jsonb_build_object('cash', c.cash, 'held', c.held, 'units', u.v, 'facilities', f.v, 'goods', g.v, 'wip', w.v,
                            'value', c.cash + c.held + u.v + f.v + g.v + w.v) from u, f, w, g
$$;
create or replace function online.profit(c online.companies, p_days int) returns bigint language sql stable as $$
  with w as (select * from online.worlds where id = c.world_id), d as (select online.wday(w) - p_days as from_day from w)
  select (coalesce((select sum(l.amount) from online.ledger l, d where l.company_id = c.id and l.day > d.from_day
                      and l.reason in ('строеж', 'търг', 'материали', 'поддръжка', 'продажба', 'стоки', 'енергия', 'гориво')), 0)
        - coalesce((select sum(k.deposit) from online.contracts k join online.ledger l on l.company_id = k.company_id and l.ref = 'dep:' || k.bid_id || ':lost', d
                      where k.company_id = c.id and k.status = 'failed' and l.day > d.from_day), 0))::bigint
$$;
create or replace function public.ol_ranking_formula() returns text language sql immutable as
  $$ select 'Стойност = наличност + блокирани депозити + техника и производства по 50% + стоки по изкупната цена (60%) + строежи в ход; отрицателната наличност е задължение и се приспада. Печалба = приходи от строежи, договори и продажби − материали, стоки, енергия, гориво и поддръжка − задържани депозити за последните 7 игрални дни.' $$;

create or replace function public.ol_ranking(p_world int, p_sort text default 'value') returns jsonb language plpgsql stable security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds;
begin
  select * into w from online.worlds where id = p_world;
  if not found or not online.can_play(u, w) then return online.fail('no_access', 'Нямаш достъп до този свят.'); end if;
  return jsonb_build_object('ok', true, 'day', online.wday(w), 'sort', p_sort,
    'formula', public.ol_ranking_formula(),
    'rows', coalesce((select jsonb_agg(r order by rk) from (
      select row_number() over (order by case p_sort when 'profit' then (s ->> 'profit7')::bigint when 'contracts' then (s ->> 'contracts_done')::bigint * 1000000000000 + (s ->> 'value')::bigint else (s ->> 'value')::bigint end desc, id) rk,
             jsonb_build_object('rank', row_number() over (order by case p_sort when 'profit' then (s ->> 'profit7')::bigint when 'contracts' then (s ->> 'contracts_done')::bigint * 1000000000000 + (s ->> 'value')::bigint else (s ->> 'value')::bigint end desc, id),
               'id', id, 'name', name, 'brand', brand, 'city', city, 'me', user_id = u,
               'value', (s ->> 'value')::bigint, 'profit7', (s ->> 'profit7')::bigint, 'level', (s ->> 'level')::int,
               'contracts_done', (s ->> 'contracts_done')::int, 'builds_done', (s ->> 'builds_done')::int) r
        from (select c.id, c.name, c.brand, c.city, c.user_id, online.company_stats(c) s from online.companies c where c.world_id = p_world) q) z), '[]'::jsonb));
end $$;

-- ═══════════════════ API: пазар ═══════════════════
create or replace function public.ol_market(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies; w online.worlds;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  select * into w from online.worlds where id = p_world;
  return jsonb_build_object('ok', true, 'level', online.level(c.xp), 'cash', c.cash,
    'rules', jsonb_build_object('buyback_pct', online.buyback_pct(), 'fee_pct', online.fee_pct(), 'fuel_per_machine', online.fuel_per_machine()),
    'goods', (select jsonb_agg(jsonb_build_object('good', g.good, 'nm', g.nm, 'ico', g.ico, 'unit', g.unit, 'price', g.price,
        'mine', online.inv(c.id, g.good),
        'book', coalesce((select jsonb_agg(jsonb_build_object('price', b.price, 'qty', b.qty, 'n', b.n) order by b.price) from (
            select a.price, sum(a.qty) qty, count(*) n from online.asks a where a.world_id = p_world and a.good = g.good and a.status = 'open' and a.company_id <> c.id
             group by a.price order by a.price limit 6) b), '[]'::jsonb),
        'last', (select t.price from online.trades t where t.world_id = p_world and t.good = g.good order by t.id desc limit 1)) order by g.price) from online.goods g),
    'facility_types', (select jsonb_agg(to_jsonb(t) order by t.min_level, t.cost) from online.facility_types t),
    'facilities', coalesce((select jsonb_object_agg(type, n) from online.facilities where company_id = c.id), '{}'::jsonb),
    'my_asks', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'good', a.good, 'qty', a.qty, 'price', a.price) order by a.id desc) from online.asks a where a.company_id = c.id and a.status = 'open'), '[]'::jsonb),
    'trades', coalesce((select jsonb_agg(jsonb_build_object('good', t.good, 'qty', t.qty, 'price', t.price, 'at', t.at,
        'buyer', (select name from online.companies where id = t.buyer), 'seller', (select name from online.companies where id = t.seller),
        'mine', t.buyer = c.id or t.seller = c.id) order by t.id desc) from (select * from online.trades where world_id = p_world order by id desc limit 20) t), '[]'::jsonb));
end $$;

-- построй производство
create or replace function public.ol_build_facility(p_req uuid, p_world int, p_type text) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; t online.facility_types;
begin
  r := online.req_begin(u, p_req, 'build_facility'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into t from online.facility_types where type = p_type;
  if not found then return online.req_end(u, p_req, online.fail('bad_type', 'Няма такова производство.')); end if;
  if online.level(c.xp) < t.min_level then return online.req_end(u, p_req, online.fail('level', format('%s се отключва на ниво %s.', t.nm, t.min_level))); end if;
  if not online.money(c.id, -t.cost, 'съоръжения', format('Ново производство: %s', t.nm), null) then
    return online.req_end(u, p_req, online.fail('no_money', format('Нямаш %s €.', online.eur(t.cost))));
  end if;
  insert into online.facilities (company_id, type, n) values (c.id, t.type, 1) on conflict (company_id, type) do update set n = online.facilities.n + 1;
  perform online.log(p_world, c.id, u, 'facility', jsonb_build_object('type', t.type));
  return online.req_end(u, p_req, jsonb_build_object('ok', true));
end $$;

-- пусни стока за продан: количество от склада се блокира; цената е до държавната
create or replace function public.ol_sell_order(p_req uuid, p_world int, p_good text, p_qty numeric, p_price bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; g online.goods; q numeric := round(coalesce(p_qty, 0), 2); aid bigint;
begin
  r := online.req_begin(u, p_req, 'sell_order'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into g from online.goods where good = p_good;
  if not found then return online.req_end(u, p_req, online.fail('bad_good', 'Няма такава стока.')); end if;
  if q <= 0 or q > 1000000 then return online.req_end(u, p_req, online.fail('bad_qty', 'Невалидно количество.')); end if;
  if p_price is null or p_price < 1 or p_price > g.price then return online.req_end(u, p_req, online.fail('bad_price', format('Цената е до държавната: %s € за %s.', online.eur(g.price), g.unit))); end if;
  update online.inventory set qty = qty - q where company_id = c.id and good = p_good and qty >= q;
  if not found then return online.req_end(u, p_req, online.fail('no_stock', format('Нямаш %s %s в склада.', q, g.unit))); end if;
  insert into online.asks (world_id, company_id, good, qty, price) values (p_world, c.id, p_good, q, p_price) returning id into aid;
  perform online.log(p_world, c.id, u, 'ask', jsonb_build_object('good', p_good, 'qty', q, 'price', p_price));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'ask', aid));
end $$;

create or replace function public.ol_cancel_order(p_req uuid, p_world int, p_ask bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; a online.asks;
begin
  r := online.req_begin(u, p_req, 'cancel_order'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into a from online.asks where id = p_ask and company_id = c.id and status = 'open' for update;
  if not found then return online.req_end(u, p_req, online.fail('no_order', 'Няма такава отворена оферта.')); end if;
  update online.asks set status = 'cancelled', qty = 0 where id = a.id;
  perform online.inv_add(c.id, a.good, a.qty);
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'returned', a.qty));
end $$;

-- купи до p_qty от най-евтините оферти на ДРУГИ фирми с цена ≤ p_max. Частично изпълнение е позволено.
create or replace function public.ol_buy(p_req uuid, p_world int, p_good text, p_qty numeric, p_max bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; g online.goods; want numeric := round(coalesce(p_qty, 0), 2); a online.asks; take numeric; cost bigint; fee bigint;
  got numeric := 0; paid bigint := 0;
begin
  r := online.req_begin(u, p_req, 'buy'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into g from online.goods where good = p_good;
  if not found then return online.req_end(u, p_req, online.fail('bad_good', 'Няма такава стока.')); end if;
  if want <= 0 or want > 1000000 then return online.req_end(u, p_req, online.fail('bad_qty', 'Невалидно количество.')); end if;
  select * into c from online.companies where id = c.id for update;   -- купувачът първи
  for a in select * from online.asks where world_id = p_world and good = p_good and status = 'open' and company_id <> c.id and price <= coalesce(p_max, g.price)
            order by price, id for update loop
    exit when want - got <= 0;
    take := least(a.qty, want - got);
    cost := ceil(take * a.price)::bigint;
    if c.cash - paid < cost then take := floor((c.cash - paid) * 100.0 / a.price) / 100.0; cost := ceil(take * a.price)::bigint; end if;
    exit when take <= 0;
    fee := ceil(cost * online.fee_pct())::bigint;
    update online.asks set qty = qty - take, status = case when qty - take <= 0 then 'filled' else 'open' end where id = a.id;
    insert into online.trades (world_id, ask_id, buyer, seller, good, qty, price) values (p_world, a.id, c.id, a.company_id, p_good, take, a.price);
    perform online.money(c.id, -cost, 'стоки', format('Покупка: %s %s %s по %s €', take, g.unit, g.nm, online.eur(a.price)), null);
    perform online.money(a.company_id, cost - fee, 'продажба', format('Продажба: %s %s %s по %s € (такса %s €)', take, g.unit, g.nm, online.eur(a.price), online.eur(fee)), null);
    perform online.note(a.company_id, 'good', format('💰 Продадени %s %s %s', take, g.unit, g.nm), format('Купувач: %s · +%s €', c.name, online.eur(cost - fee)));
    got := got + take; paid := paid + cost;
  end loop;
  if got > 0 then perform online.inv_add(c.id, p_good, got); end if;
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'qty', got, 'paid', paid,
    'msg', case when got = 0 then 'Няма оферти на тази цена (или нямаш пари).' when got < want then format('Купени %s от %s — повече няма на тази цена.', got, want) else null end));
end $$;

-- продай на държавата на 60% от цената (долната граница на пазара)
create or replace function public.ol_sell_state(p_req uuid, p_world int, p_good text, p_qty numeric) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; g online.goods; q numeric := round(coalesce(p_qty, 0), 2); amt bigint;
begin
  r := online.req_begin(u, p_req, 'sell_state'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into g from online.goods where good = p_good;
  if not found or q <= 0 then return online.req_end(u, p_req, online.fail('bad_qty', 'Невалидно количество.')); end if;
  update online.inventory set qty = qty - q where company_id = c.id and good = p_good and qty >= q;
  if not found then return online.req_end(u, p_req, online.fail('no_stock', 'Нямаш толкова в склада.')); end if;
  amt := floor(q * g.price * online.buyback_pct())::bigint;
  perform online.money(c.id, amt, 'продажба', format('Изкупуване от държавата: %s %s %s', q, g.unit, g.nm), null);
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'paid', amt));
end $$;

revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
