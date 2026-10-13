-- „Онлайн империя“ — версия 2, стъпка 5: ФИНАНСИ И ДЯЛОВЕ (придобиване на дялове в други фирми).
-- Заеми: до 40% от нетната стойност (стойност − дълг); лихва 0,25% на игрален ден (тече и при отсъствие); погасяване
-- по всяко време. В класацията дългът се приспада — заемът не вдига стойността.
-- Дялове: собственикът пуска до 49% от фирмата за продан (цена за 1%); парите отиват във фирмата. Акционерите получават
-- всеки ден 50% от печалбата на фирмата по дела си. Собственикът изкупува дял обратно на справедлива цена +10%.
-- Стойност на фирма = собствена стойност × (100% − продадените %) + дяловете ѝ в други фирми.
-- Пълните сливания на фирми са следваща стъпка (не са в тази версия).

alter table online.companies add column if not exists debt bigint not null default 0 check (debt >= 0);
create or replace function online.loan_rate() returns numeric language sql immutable as $$ select 0.0025 $$;
create or replace function online.loan_ltv() returns numeric language sql immutable as $$ select 0.4 $$;
create or replace function online.max_float() returns int language sql immutable as $$ select 49 $$;
create or replace function online.payout() returns numeric language sql immutable as $$ select 0.5 $$;

create table online.share_offers (
  id bigserial primary key,
  world_id int not null references online.worlds on delete cascade,
  issuer bigint not null references online.companies on delete cascade,
  pct_left int not null check (pct_left >= 0),
  price_pct bigint not null check (price_pct > 0),   -- евроцентове за 1%
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
create unique index share_offer_one on online.share_offers (issuer) where status = 'open';
create table online.holdings (
  issuer bigint not null references online.companies on delete cascade,
  holder bigint not null references online.companies on delete cascade,
  pct int not null check (pct between 1 and 49),
  paid bigint not null default 0,
  primary key (issuer, holder),
  check (issuer <> holder)
);
create or replace function online.sold_pct(p_company bigint) returns int language sql stable as
  $$ select coalesce(sum(pct), 0)::int from online.holdings where issuer = p_company $$;

create or replace function online.own_parts(c online.companies) returns jsonb language sql stable as $$
  with u as (select coalesce(sum(u.n * t.cost / 2), 0)::bigint v from online.units u join online.unit_types t using (type) where u.company_id = c.id),
       f as (select coalesce(sum(f.n * t.cost / 2), 0)::bigint v from online.facilities f join online.facility_types t using (type) where f.company_id = c.id),
       w as (select coalesce(sum(b.mat), 0)::bigint v from online.builds b where b.company_id = c.id and b.status = 'running'),
       g as (select coalesce(sum(floor(q.qty * gd.price * online.buyback_pct())), 0)::bigint v from (
               select good, qty from online.inventory where company_id = c.id
               union all select good, qty from online.asks where company_id = c.id and status = 'open') q join online.goods gd using (good)),
       s as (select online.stakes(c.id) v),
       k as (select coalesce(sum((r.fee * greatest(0, extract(epoch from (r.end_at - online.wnow(ww)))) / greatest(1, extract(epoch from (r.end_at - r.start_at))))::bigint), 0)::bigint v
               from online.conc_rounds r join online.worlds ww on ww.id = r.world_id where r.holder = c.id and r.status = 'active')
  select jsonb_build_object('cash', c.cash, 'held', c.held, 'units', u.v, 'facilities', f.v, 'goods', g.v, 'wip', w.v, 'stakes', s.v, 'concessions', k.v,
                            'debt', c.debt, 'own', c.cash + c.held + u.v + f.v + g.v + w.v + s.v + k.v - c.debt) from u, f, w, g, s, k
$$;

create or replace function online.value_parts(c online.companies) returns jsonb language sql stable as $$
  with o as (select online.own_parts(c) j),
       sh as (select coalesce(sum(h.pct * (online.own_parts(i) ->> 'own')::numeric / 100), 0)::bigint v
                from online.holdings h join online.companies i on i.id = h.issuer where h.holder = c.id),
       sp as (select online.sold_pct(c.id) p)
  select o.j || jsonb_build_object('sold_pct', sp.p, 'shares', sh.v,
           'value', ((o.j ->> 'own')::numeric * (100 - sp.p) / 100)::bigint + sh.v) from o, sh, sp
$$;
create or replace function online.profit(c online.companies, p_days int) returns bigint language sql stable as $$
  with w as (select * from online.worlds where id = c.world_id), d as (select online.wday(w) - p_days as from_day from w)
  select (coalesce((select sum(l.amount) from online.ledger l, d where l.company_id = c.id and l.day > d.from_day
                      and l.reason in ('строеж', 'търг', 'материали', 'поддръжка', 'продажба', 'стоки', 'енергия', 'гориво', 'дивидент', 'концесия', 'лихва')), 0)
        - coalesce((select sum(k.deposit) from online.contracts k join online.ledger l on l.company_id = k.company_id and l.ref = 'dep:' || k.bid_id || ':lost', d
                      where k.company_id = c.id and k.status = 'failed' and l.day > d.from_day), 0))::bigint
$$;
create or replace function public.ol_ranking_formula() returns text language sql immutable as
  $$ select 'Стойност = (наличност + блокирани депозити и оферти + техника и производства по 50% + стоки по изкупната цена (60%) + строежи в ход + дялове в консорциуми и платени концесии − дълг) × непродадения дял на фирмата + дяловете ѝ в други фирми. Заемът не вдига стойността — дългът се приспада. Печалба = приходи от строежи, договори, продажби, дивиденти и концесии − материали, стоки, енергия, гориво, поддръжка, концесионни такси и лихви − задържани депозити за последните 7 игрални дни.' $$;

-- лихва за дните [d0, d1]
create or replace function online.interest(p_company bigint, d0 int, d1 int) returns void language plpgsql as $$
declare c online.companies; n int := d1 - d0 + 1; amt bigint;
begin
  select * into c from online.companies where id = p_company;
  if n <= 0 or c.debt <= 0 then return; end if;
  amt := ceil(c.debt * online.loan_rate() * n)::bigint;
  perform online.money(c.id, -amt, 'лихва', format('Лихва по заем %s € (%s дни)', online.eur(c.debt), n), 'interest:' || d0, true);
end $$;

-- дивиденти: 50% от печалбата за дните [d0, d1] (по записите в журнала за тези дни), по дяловете
create or replace function online.pay_dividends(p_company bigint, d0 int, d1 int) returns void language plpgsql as $$
declare pr bigint; h record; amt bigint; nm text;
begin
  if d1 < d0 or not exists (select 1 from online.holdings where issuer = p_company) then return; end if;
  select coalesce(sum(amount), 0) into pr from online.ledger where company_id = p_company and day between d0 and d1
     and reason in ('строеж', 'търг', 'материали', 'поддръжка', 'продажба', 'стоки', 'енергия', 'гориво', 'дивидент', 'концесия', 'лихва');
  if pr <= 0 then return; end if;
  select name into nm from online.companies where id = p_company;
  for h in select * from online.holdings where issuer = p_company order by holder loop
    amt := floor(pr * online.payout() * h.pct / 100)::bigint;
    continue when amt <= 0;
    if online.money(p_company, -amt, 'изплатен дивидент', format('Дивидент %s%% за дни %s–%s', h.pct, d0, d1), 'divout:' || h.holder || ':' || d0) then
      perform online.money(h.holder, amt, 'дивидент', format('Дивидент от %s (%s%%), дни %s–%s', nm, h.pct, d0, d1), 'divin:' || p_company || ':' || d0);
    end if;
  end loop;
end $$;

-- ── уреждането с лихвата и дивидентите (замества версията от пазара) ──
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
    perform online.interest(c.id, c.settled_day, d - 1);   -- лихва по заема (тече и при отсъствие)
    perform online.pay_dividends(c.id, c.settled_day, d - 1);   -- дивиденти на акционерите
    update online.companies set settled_day = d where id = c.id;
  end if;
  -- 3) табло с поръчки
  select * into c from online.companies where id = p_company;
  perform online.gen_offers(c, w, d);
end $$;

-- ═══════════════════ API ═══════════════════
create or replace function online.loan_limit(c online.companies) returns bigint language sql stable as
  $$ select greatest(0, floor(greatest(0, (online.own_parts(c) ->> 'own')::numeric) * online.loan_ltv()) - c.debt)::bigint $$;

create or replace function public.ol_finance(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  return jsonb_build_object('ok', true, 'cash', c.cash, 'debt', c.debt, 'loan_limit', online.loan_limit(c), 'rate', online.loan_rate(), 'ltv', online.loan_ltv(),
    'own', (online.own_parts(c) ->> 'own')::bigint, 'sold_pct', online.sold_pct(c.id), 'max_float', online.max_float(), 'payout', online.payout(),
    'fair_pct', greatest(0, (online.own_parts(c) ->> 'own')::bigint / 100),
    'my_offer', (select jsonb_build_object('id', id, 'pct_left', pct_left, 'price_pct', price_pct) from online.share_offers where issuer = c.id and status = 'open'),
    'shareholders', coalesce((select jsonb_agg(jsonb_build_object('company', h.holder, 'name', co.name, 'pct', h.pct, 'buyback', ceil(h.pct * greatest(0, (online.own_parts(c) ->> 'own')::numeric) / 100 * 1.1)::bigint)) from online.holdings h join online.companies co on co.id = h.holder where h.issuer = c.id), '[]'::jsonb),
    'my_stakes', coalesce((select jsonb_agg(jsonb_build_object('company', h.issuer, 'name', co.name, 'pct', h.pct, 'paid', h.paid, 'worth', (h.pct * (online.own_parts(co) ->> 'own')::numeric / 100)::bigint,
        'dividends', (select coalesce(sum(amount), 0) from online.ledger where company_id = c.id and ref like 'divin:' || h.issuer || ':%'))) from online.holdings h join online.companies co on co.id = h.issuer where h.holder = c.id), '[]'::jsonb),
    'market', coalesce((select jsonb_agg(jsonb_build_object('id', so.id, 'issuer', so.issuer, 'name', co.name, 'brand', co.brand, 'pct_left', so.pct_left, 'price_pct', so.price_pct,
        'fair_pct', greatest(0, (online.own_parts(co) ->> 'own')::bigint / 100), 'profit7', online.profit(co, 7), 'level', online.level(co.xp)) order by so.created_at desc)
       from online.share_offers so join online.companies co on co.id = so.issuer where so.world_id = p_world and so.status = 'open' and so.pct_left > 0 and so.issuer <> c.id), '[]'::jsonb));
end $$;

create or replace function public.ol_loan(p_req uuid, p_world int, p_amount bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; amt bigint := round(coalesce(p_amount, 0) / 100000.0) * 100000; lim bigint;
begin
  r := online.req_begin(u, p_req, 'loan'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into c from online.companies where id = c.id for update;
  lim := online.loan_limit(c);
  if amt <= 0 or amt > lim then return online.req_end(u, p_req, online.fail('limit', format('Можеш да изтеглиш до %s € (40%% от нетната стойност минус дълга).', online.eur(lim)))); end if;
  update online.companies set debt = debt + amt where id = c.id;
  perform online.money(c.id, amt, 'заем', format('Банков заем (лихва %s%% на ден)', online.loan_rate() * 100), null);
  perform online.log(p_world, c.id, u, 'loan', jsonb_build_object('amount', amt));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'debt', c.debt + amt));
end $$;

create or replace function public.ol_repay(p_req uuid, p_world int, p_amount bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; amt bigint;
begin
  r := online.req_begin(u, p_req, 'repay'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into c from online.companies where id = c.id for update;
  amt := least(coalesce(p_amount, 0), c.debt);
  if amt <= 0 then return online.req_end(u, p_req, online.fail('bad_amount', 'Няма какво да погасиш.')); end if;
  if not online.money(c.id, -amt, 'заем', 'Погасяване на заем', null) then return online.req_end(u, p_req, online.fail('no_money', 'Нямаш толкова пари.')); end if;
  update online.companies set debt = debt - amt where id = c.id;
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'debt', c.debt - amt));
end $$;

-- пусни дял за продан: общо продаденото + предлаганото ≤ 49%; цена за 1% ≥ 50% от справедливата
create or replace function public.ol_share_offer(p_req uuid, p_world int, p_pct int, p_price_pct bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; fair bigint;
begin
  r := online.req_begin(u, p_req, 'share_offer'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  fair := greatest(0, (online.own_parts(c) ->> 'own')::bigint / 100);
  update online.share_offers set status = 'closed' where issuer = c.id and status = 'open';
  if coalesce(p_pct, 0) = 0 then return online.req_end(u, p_req, jsonb_build_object('ok', true, 'closed', true)); end if;
  if p_pct < 1 or online.sold_pct(c.id) + p_pct > online.max_float() then
    return online.req_end(u, p_req, online.fail('bad_pct', format('Можеш да продадеш общо до %s%% (вече: %s%%) — контролът остава твой.', online.max_float(), online.sold_pct(c.id))));
  end if;
  if p_price_pct is null or p_price_pct < fair / 2 or p_price_pct > fair * 5 + 100 then
    return online.req_end(u, p_req, online.fail('bad_price', format('Цената за 1%% е между %s € и %s € (справедливата е %s €).', online.eur(fair / 2), online.eur(fair * 5 + 100), online.eur(fair))));
  end if;
  insert into online.share_offers (world_id, issuer, pct_left, price_pct) values (p_world, c.id, p_pct, p_price_pct);
  perform online.log(p_world, c.id, u, 'share_offer', jsonb_build_object('pct', p_pct, 'price', p_price_pct));
  return online.req_end(u, p_req, jsonb_build_object('ok', true));
end $$;

-- купи дял: парите отиват във фирмата-емитент
create or replace function public.ol_buy_shares(p_req uuid, p_world int, p_offer bigint, p_pct int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; o online.share_offers; cost bigint; iname text;
begin
  r := online.req_begin(u, p_req, 'buy_shares'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into o from online.share_offers where id = p_offer and world_id = p_world and status = 'open' for update;
  if not found or o.issuer = c.id then return online.req_end(u, p_req, online.fail('no_offer', 'Предложението не е налично.')); end if;
  if p_pct is null or p_pct < 1 or p_pct > o.pct_left or online.sold_pct(o.issuer) + p_pct > online.max_float() then
    return online.req_end(u, p_req, online.fail('bad_pct', format('Налични са %s%%.', o.pct_left)));
  end if;
  cost := o.price_pct * p_pct;
  select name into iname from online.companies where id = o.issuer;
  if not online.money(c.id, -cost, 'акции', format('Покупка на %s%% от %s', p_pct, iname), null) then
    return online.req_end(u, p_req, online.fail('no_money', format('Трябват %s €.', online.eur(cost))));
  end if;
  perform online.money(o.issuer, cost, 'акции', format('Продадени %s%% на %s', p_pct, c.name), null);
  insert into online.holdings (issuer, holder, pct, paid) values (o.issuer, c.id, p_pct, cost)
    on conflict (issuer, holder) do update set pct = online.holdings.pct + p_pct, paid = online.holdings.paid + cost;
  update online.share_offers set pct_left = pct_left - p_pct, status = case when pct_left - p_pct <= 0 then 'closed' else 'open' end where id = o.id;
  perform online.note(o.issuer, 'good', format('📈 %s купи %s%% от фирмата ти', c.name, p_pct), format('+%s € капитал. Акционерите получават %s%% от печалбата по дела си.', online.eur(cost), round(online.payout() * 100)));
  perform online.log(p_world, c.id, u, 'buy_shares', jsonb_build_object('issuer', o.issuer, 'pct', p_pct, 'cost', cost));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'cost', cost));
end $$;

-- обратно изкупуване: собственикът плаща на акционера справедливата цена +10%
create or replace function public.ol_buyback(p_req uuid, p_world int, p_holder bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; h online.holdings; cost bigint;
begin
  r := online.req_begin(u, p_req, 'buyback'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into h from online.holdings where issuer = c.id and holder = p_holder for update;
  if not found then return online.req_end(u, p_req, online.fail('no_holding', 'Няма такъв акционер.')); end if;
  cost := ceil(h.pct * greatest(0, (online.own_parts(c) ->> 'own')::numeric) / 100 * 1.1)::bigint;
  if not online.money(c.id, -cost, 'акции', format('Обратно изкупуване на %s%%', h.pct), null) then
    return online.req_end(u, p_req, online.fail('no_money', format('Трябват %s €.', online.eur(cost))));
  end if;
  perform online.money(h.holder, cost, 'акции', format('Изкупен дял %s%% от %s', h.pct, c.name), null);
  delete from online.holdings where issuer = c.id and holder = h.holder;
  perform online.note(h.holder, 'info', format('%s изкупи обратно дела ти (%s%%)', c.name, h.pct), format('+%s € (справедлива цена +10%%).', online.eur(cost)));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'cost', cost));
end $$;

revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
