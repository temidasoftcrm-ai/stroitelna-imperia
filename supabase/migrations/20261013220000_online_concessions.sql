-- „Онлайн империя“ — версия 2, стъпка 3: ВРЕМЕННИ КОНЦЕСИИ — пристанища, летища, магистрала и жп линия.
-- Сървърът обявява търг за правото да управляваш обекта за определен срок (20 игрални дни). Офертите са скрити;
-- при подаване цялата сума се блокира; офертата може само да се вдига (не се оттегля). След срока печели НАЙ-ВИСОКАТА
-- валидна оферта (при равни — по-ранната); валидна е, ако фирмата има свободна техника за обекта и не държи вече
-- максималния брой концесии. Победителят плаща таксата, техниката му е заета за целия срок, а обектът носи приход
-- всеки ден. Загубилите си получават парите. След срока обектът се връща и отива на нов търг — никой не го държи вечно.

create table online.conc_types (
  key text primary key, kind text not null check (kind in ('port', 'airport', 'road', 'rail')),
  nm text not null, ico text not null, what text not null,
  revenue bigint not null, term_days int not null, min_bid bigint not null, need jsonb not null, min_level int not null
);
insert into online.conc_types values
  ('road-trakia', 'road', 'Магистрала „Тракия“ — тол такси', '🛣️', 'събираш тол таксите и поддържаш пътя', 3000000, 20, 20000000, '{"crew":1,"truck":1,"tractor":1}', 3),
  ('rail-plovdiv', 'rail', 'Жп линия София — Пловдив', '🚆', 'возиш пътници и товари по линията', 4500000, 20, 30000000, '{"crew":2,"loader":1}', 4),
  ('port-burgas', 'port', 'Пристанище Бургас — терминал', '⚓', 'товариш и разтоварваш корабите', 4000000, 20, 25000000, '{"crane":1,"truck":2}', 4),
  ('airport-varna', 'airport', 'Летище Варна — наземно обслужване', '✈️', 'обслужваш самолетите и пътниците', 3500000, 20, 22000000, '{"crew":2,"truck":1}', 4),
  ('port-varna', 'port', 'Пристанище Варна — контейнерен терминал', '🚢', 'най-големият черноморски терминал', 6000000, 20, 40000000, '{"crane":2,"truck":2}', 5),
  ('airport-sofia', 'airport', 'Летище София — наземно обслужване', '🛫', 'най-натовареното летище в страната', 7000000, 20, 50000000, '{"crew":3,"truck":1}', 6);

create table online.conc_rounds (
  id bigserial primary key,
  world_id int not null references online.worlds on delete cascade,
  ctype text not null references online.conc_types,
  status text not null default 'auction' check (status in ('auction', 'active', 'ended', 'no_bids')),
  closes_at timestamptz not null,
  holder bigint references online.companies on delete set null,
  fee bigint, start_at timestamptz, end_at timestamptz, paid_day int,
  created_at timestamptz not null default now()
);
create unique index conc_one_live on online.conc_rounds (world_id, ctype) where status in ('auction', 'active');

create table online.conc_bids (
  id bigserial primary key,
  round_id bigint not null references online.conc_rounds on delete cascade,
  company_id bigint not null references online.companies on delete cascade,
  amount bigint not null check (amount > 0),
  placed_at timestamptz not null default clock_timestamp(),
  status text not null default 'active' check (status in ('active', 'won', 'lost')),
  unique (round_id, company_id)
);

-- заетата техника: строежите + действащите концесии
create or replace function online.busy(p_company bigint) returns jsonb language sql stable as $$
  select coalesce(jsonb_object_agg(k, s), '{}'::jsonb) from (
    select key k, sum(v) s from (
      select e.key, e.value::int v from online.builds b, jsonb_each_text(b.need) e where b.company_id = p_company and b.status = 'running'
      union all
      select e.key, e.value::int from online.conc_rounds r join online.conc_types t on t.key = r.ctype, jsonb_each_text(t.need) e where r.holder = p_company and r.status = 'active') q
    group by key) z
$$;
create or replace function online.active_conc(p_company bigint) returns int language sql stable as
  $$ select count(*)::int from online.conc_rounds where holder = p_company and status = 'active' $$;

-- обявяване: по един търг на обект; отворени наведнъж — cfg concessions_open (3)
create or replace function online.conc_publish(w online.worlds) returns int language plpgsql as $$
declare want int := online.cfg(w, 'concessions_open', 3)::int; have int; t online.conc_types; n int := 0;
begin
  if not exists (select 1 from online.companies where world_id = w.id) then return 0; end if;
  select count(*) into have from online.conc_rounds where world_id = w.id and status = 'auction';
  while have < want loop
    select * into t from online.conc_types ct where not exists (select 1 from online.conc_rounds r where r.world_id = w.id and r.ctype = ct.key and r.status in ('auction', 'active'))
      order by random() limit 1;
    exit when t.key is null;
    insert into online.conc_rounds (world_id, ctype, closes_at) values (w.id, t.key, online.wnow(w) + make_interval(secs => online.cfg(w, 'conc_bid_days', 3)::int * w.day_seconds));
    have := have + 1; n := n + 1; t := null;
  end loop;
  return n;
end $$;

-- край на търга: един победител (най-високата валидна), останалите си получават парите
create or replace function online.conc_resolve(p_round bigint) returns void language plpgsql as $$
declare r online.conc_rounds; t online.conc_types; w online.worlds; b record; win online.conc_bids; c online.companies; ok boolean; e record;
begin
  select * into r from online.conc_rounds where id = p_round for update;
  if r.status <> 'auction' then return; end if;
  select * into w from online.worlds where id = r.world_id;
  if r.closes_at > online.wnow(w) then return; end if;
  select * into t from online.conc_types where key = r.ctype;
  for b in select * from online.conc_bids where round_id = r.id and status = 'active' order by amount desc, placed_at, id loop
    select * into c from online.companies where id = b.company_id;
    ok := not exists (select 1 from online.members m where m.world_id = w.id and m.user_id = c.user_id and m.banned)
      and online.active_conc(c.id) < online.cfg(w, 'max_concessions', 2)
      and online.level(c.xp) >= t.min_level;
    if ok then
      for e in select key, value::int v from jsonb_each_text(t.need) loop
        if coalesce((online.free_units(c.id) ->> e.key)::int, 0) < e.v then ok := false; end if;
      end loop;
    end if;
    if ok then select * into win from online.conc_bids where id = b.id; exit; end if;
  end loop;
  for b in select * from online.conc_bids where round_id = r.id and status = 'active' and id is distinct from win.id loop
    update online.conc_bids set status = 'lost' where id = b.id;
    perform online.money(b.company_id, b.amount, 'депозит', format('Върната оферта за концесия: %s', t.nm), 'cbid:' || b.id || ':rel');
    update online.companies set held = held - b.amount where id = b.company_id;
    perform online.note(b.company_id, 'info', format('Концесията „%s“ отиде при друг', t.nm),
      case when win.id is null then 'Няма валиден победител.' else format('Спечели оферта от %s €. Твоите %s € са върнати.', online.eur(win.amount), online.eur(b.amount)) end);
  end loop;
  if win.id is null then
    update online.conc_rounds set status = 'no_bids' where id = r.id;
    return;
  end if;
  update online.conc_bids set status = 'won' where id = win.id;
  -- блокираните пари се освобождават и се плаща таксата (два реда в журнала — ясно за печалбата)
  perform online.money(win.company_id, win.amount, 'депозит', format('Освободена оферта: %s', t.nm), 'cbid:' || win.id || ':rel');
  update online.companies set held = held - win.amount where id = win.company_id;
  perform online.money(win.company_id, -win.amount, 'концесия', format('Концесионна такса: %s (%s дни)', t.nm, t.term_days), 'conc:' || r.id || ':fee', true);
  update online.conc_rounds set status = 'active', holder = win.company_id, fee = win.amount, start_at = r.closes_at,
    end_at = r.closes_at + make_interval(secs => t.term_days * w.day_seconds), paid_day = online.day_of(w, r.closes_at) - 1 where id = r.id;
  perform online.note(win.company_id, 'good', format('%s Концесията „%s“ е твоя!', t.ico, t.nm),
    format('За %s игрални дни: ~%s € на ден. Техниката ти е заета на обекта.', t.term_days, online.eur(t.revenue)));
  perform online.log(w.id, win.company_id, null, 'conc_awarded', jsonb_build_object('round', r.id, 'ctype', r.ctype, 'fee', win.amount));
end $$;

create or replace function online.conc_tick() returns int language plpgsql as $$
declare r record; t online.conc_types; w online.worlds; n int := 0; d int; ed int; upto int; days int; pd int;
begin
  for r in select cr.id from online.conc_rounds cr join online.worlds ww on ww.id = cr.world_id where ww.status = 'open' and cr.status = 'auction' and cr.closes_at <= online.wnow(ww) loop
    perform online.conc_resolve(r.id); n := n + 1;
  end loop;
  for r in select cr.* from online.conc_rounds cr join online.worlds ww on ww.id = cr.world_id where ww.status = 'open' and cr.status = 'active' loop
    select * into w from online.worlds where id = r.world_id; select * into t from online.conc_types where key = r.ctype;
    select paid_day into pd from online.conc_rounds where id = r.id for update;
    d := online.wday(w); ed := online.day_of(w, r.end_at) - 1; upto := least(d - 1, ed);
    if upto > pd then
      days := upto - pd;
      perform online.money(r.holder, t.revenue * days, 'концесия', format('%s %s: приход, %s', t.ico, t.nm, case when days > 1 then format('дни %s–%s', pd + 1, upto) else format('ден %s', upto) end), 'conc:' || r.id || ':d' || (pd + 1));
      update online.conc_rounds set paid_day = upto where id = r.id; n := n + 1;
    end if;
    if upto >= ed and r.end_at <= online.wnow(w) then
      update online.conc_rounds set status = 'ended' where id = r.id;
      perform online.note(r.holder, 'info', format('%s Концесията „%s“ изтече', t.ico, t.nm), 'Техниката е свободна. Обектът отива на нов търг.');
    end if;
  end loop;
  for w in select * from online.worlds where status = 'open' loop n := n + online.conc_publish(w); end loop;
  return n;
end $$;

-- ═══════════════════ API ═══════════════════
create or replace function public.ol_concessions(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies; w online.worlds;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  select * into w from online.worlds where id = p_world;
  perform online.conc_resolve(r.id) from online.conc_rounds r where r.world_id = p_world and r.status = 'auction' and r.closes_at <= online.wnow(w);
  return jsonb_build_object('ok', true, 'level', online.level(c.xp), 'cash', c.cash, 'server_now', online.wnow(w), 'free', online.free_units(c.id),
    'rules', jsonb_build_object('max', online.cfg(w, 'max_concessions', 2), 'mine', online.active_conc(c.id)),
    'auctions', coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('round', r.id, 'closes_at', r.closes_at,
        'bids', (select count(*) from online.conc_bids b where b.round_id = r.id),
        'my', (select b.amount from online.conc_bids b where b.round_id = r.id and b.company_id = c.id)) order by r.closes_at)
      from online.conc_rounds r join online.conc_types t on t.key = r.ctype where r.world_id = p_world and r.status = 'auction'), '[]'::jsonb),
    'active', coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('round', r.id, 'end_at', r.end_at, 'fee', r.fee,
        'holder', (select name from online.companies where id = r.holder), 'mine', r.holder = c.id) order by r.end_at)
      from online.conc_rounds r join online.conc_types t on t.key = r.ctype where r.world_id = p_world and r.status = 'active'), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(x) from (select jsonb_build_object('nm', t.nm, 'ico', t.ico, 'status', r.status, 'fee', r.fee, 'holder', (select name from online.companies where id = r.holder)) x
       from online.conc_rounds r join online.conc_types t on t.key = r.ctype where r.world_id = p_world and r.status in ('ended', 'no_bids') order by r.id desc limit 8) q), '[]'::jsonb));
end $$;

-- оферта за концесия: нова или вдигане на своята; блокира се цялата сума (при вдигане — разликата)
create or replace function public.ol_conc_bid(p_req uuid, p_world int, p_round bigint, p_amount bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; w online.worlds; cr online.conc_rounds; t online.conc_types; b online.conc_bids; amt bigint := round(coalesce(p_amount, 0) / 10000.0) * 10000; diff bigint;
begin
  r := online.req_begin(u, p_req, 'conc_bid'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into w from online.worlds where id = p_world;
  select * into cr from online.conc_rounds where id = p_round and world_id = p_world for share;
  if not found or cr.status <> 'auction' or cr.closes_at <= online.wnow(w) then return online.req_end(u, p_req, online.fail('closed', 'Търгът е затворен.')); end if;
  select * into t from online.conc_types where key = cr.ctype;
  if online.level(c.xp) < t.min_level then return online.req_end(u, p_req, online.fail('level', format('Нужно е ниво %s.', t.min_level))); end if;
  if amt < t.min_bid or amt > 100000000000 then return online.req_end(u, p_req, online.fail('bad_amount', format('Най-малко %s €.', online.eur(t.min_bid)))); end if;
  select * into b from online.conc_bids where round_id = cr.id and company_id = c.id for update;
  if b.id is not null and amt <= b.amount then return online.req_end(u, p_req, online.fail('raise_only', format('Офертата може само да се вдига (сега е %s €).', online.eur(b.amount)))); end if;
  diff := amt - coalesce(b.amount, 0);
  if not online.money(c.id, -diff, 'депозит', format('Оферта за концесия: %s (блокирани %s €)', t.nm, online.eur(amt)), null) then
    return online.req_end(u, p_req, online.fail('no_money', format('Трябват още %s € за блокиране.', online.eur(diff))));
  end if;
  update online.companies set held = held + diff where id = c.id;
  if b.id is null then insert into online.conc_bids (round_id, company_id, amount) values (cr.id, c.id, amt);
  else update online.conc_bids set amount = amt, placed_at = clock_timestamp() where id = b.id; end if;
  perform online.log(p_world, c.id, u, 'conc_bid', jsonb_build_object('round', cr.id, 'amount', amt));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'amount', amt));
end $$;

-- ── обновени: tick, стойност, печалба, формула, пауза ──
create or replace function online.tick() returns int language plpgsql as $$
declare r record; n int := 0; ww online.worlds;
begin
  for r in select t.id from online.tenders t join online.worlds w on w.id = t.world_id where w.status = 'open' and t.status = 'open' and t.closes_at <= online.wnow(w) order by t.closes_at loop
    perform online.resolve_tender(r.id); n := n + 1;
  end loop;
  for r in select k.id from online.contracts k join online.companies c on c.id = k.company_id join online.worlds w on w.id = c.world_id
     where w.status = 'open' and k.status = 'awaiting' and k.start_by <= online.wnow(w) loop
    perform online.fail_contract(r.id); n := n + 1;
  end loop;
  n := n + online.cons_tick();
  n := n + online.conc_tick();
  for r in select c.id from online.companies c join online.worlds w on w.id = c.world_id
     where w.status = 'open' and (c.settled_day < online.wday(w)
        or exists (select 1 from online.builds b where b.company_id = c.id and b.status = 'running' and b.end_at <= online.wnow(w))
        or exists (select 1 from online.contracts k join online.builds b on b.id = k.build_id where k.company_id = c.id and k.status = 'running' and b.status = 'done'))
     for update of c skip locked loop
    perform online.settle_all(r.id); n := n + 1;
  end loop;
  for ww in select * from online.worlds where status = 'open' loop n := n + online.publish_tenders(ww); end loop;
  return n;
end $$;

create or replace function online.value_parts(c online.companies) returns jsonb language sql stable as $$
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
                            'value', c.cash + c.held + u.v + f.v + g.v + w.v + s.v + k.v) from u, f, w, g, s, k
$$;

create or replace function online.profit(c online.companies, p_days int) returns bigint language sql stable as $$
  with w as (select * from online.worlds where id = c.world_id), d as (select online.wday(w) - p_days as from_day from w)
  select (coalesce((select sum(l.amount) from online.ledger l, d where l.company_id = c.id and l.day > d.from_day
                      and l.reason in ('строеж', 'търг', 'материали', 'поддръжка', 'продажба', 'стоки', 'енергия', 'гориво', 'дивидент', 'концесия')), 0)
        - coalesce((select sum(k.deposit) from online.contracts k join online.ledger l on l.company_id = k.company_id and l.ref = 'dep:' || k.bid_id || ':lost', d
                      where k.company_id = c.id and k.status = 'failed' and l.day > d.from_day), 0))::bigint
$$;

create or replace function public.ol_ranking_formula() returns text language sql immutable as
  $$ select 'Стойност = наличност + блокирани депозити и оферти + техника и производства по 50% + стоки по изкупната цена (60%) + строежи в ход + дялове в консорциуми и платени концесии (намаляват до 0 до края на срока); отрицателната наличност е задължение и се приспада. Печалба = приходи от строежи, договори, продажби, дивиденти и концесии − материали, стоки, енергия, гориво, поддръжка и концесионни такси − задържани депозити за последните 7 игрални дни.' $$;

create or replace function public.ol_admin_status(p_world int, p_status text) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds; d interval;
begin
  if not online.is_admin(u) then return online.admin_or_fail(u); end if;
  select * into w from online.worlds where id = p_world for update;
  if not found then return online.fail('no_world', 'Няма такъв свят.'); end if;
  if p_status = 'paused' and w.status = 'open' then
    update online.worlds set status = 'paused', paused_at = now() where id = w.id;
  elsif p_status = 'open' and w.status = 'paused' then
    d := now() - w.paused_at;
    update online.worlds set status = 'open', paused_at = null, epoch = epoch + d where id = w.id;
    update online.builds b set start_at = start_at + d, end_at = end_at + d from online.companies c where c.id = b.company_id and c.world_id = w.id and b.status = 'running';
    update online.tenders set opens_at = opens_at + d, closes_at = closes_at + d where world_id = w.id and status = 'open';
    update online.contracts k set start_by = start_by + d from online.companies c where c.id = k.company_id and c.world_id = w.id and k.status = 'awaiting';
    update online.consortia set forming_until = forming_until + d, start_at = start_at + d, end_at = end_at + d, op_until = op_until + d where world_id = w.id and status in ('forming', 'building', 'operating');
    update online.conc_rounds set closes_at = closes_at + d, start_at = start_at + d, end_at = end_at + d where world_id = w.id and status in ('auction', 'active');
  elsif p_status = 'closed' then
    update online.worlds set status = 'closed', paused_at = coalesce(paused_at, now()) where id = w.id;
  else
    return online.fail('bad_status', 'Невалидна промяна на статуса.');
  end if;
  perform online.log(w.id, null, u, 'status', jsonb_build_object('from', w.status, 'to', p_status));
  return jsonb_build_object('ok', true);
end $$;

revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
