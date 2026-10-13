-- „Онлайн империя“ — етап Б: техника, поръчки, строежи, поддръжка, XP и нива — всичко изчислено на сървъра.
-- Времето: няма таймери. Строежът пази start_at/end_at; поддръжката се урежда ден по ден до текущия ден на света
-- (companies.settled_day). online.settle() се вика при всяко действие/четене и от планирана задача (pg_cron) —
-- затова прогресът върви и при затворен браузър, а един период не може да се плати два пъти.

-- ── каталог (от играта: economy.js UNIT_TYPES, game.js BTYPES, economy.js STAGE_MATERIALS) ──
create table online.unit_types (
  type text primary key, nm text not null, ico text not null,
  cost bigint not null, upkeep bigint not null   -- евроцентове; поддръжка на ден
);
insert into online.unit_types values
  ('crew', 'Бригада', '👷', 900000, 25000),
  ('loader', 'Багер', '🚜', 2200000, 12000),
  ('truck', 'Самосвал', '🚚', 1500000, 9000),
  ('tractor', 'Трактор', '🚜', 800000, 5000),
  ('crane', 'Кран', '🏗️', 4500000, 22000);

create table online.kinds (
  kind text primary key, nm text not null, ico text not null,
  reward bigint not null, days int not null, mat bigint not null,   -- бюджет, срок (игрални дни), материали (плащат се при старта)
  need jsonb not null, min_level int not null
);
insert into online.kinds values
  ('house', 'Къща', '🏠', 2800000, 8, 924000, '{"crew":1,"loader":1,"truck":1}', 1),
  ('shop', 'Магазин', '🏪', 7500000, 12, 2700000, '{"crew":1,"loader":1,"truck":1,"crane":1}', 2),
  ('office', 'Офис сграда', '🏢', 15000000, 18, 5375000, '{"crew":2,"loader":1,"truck":1,"crane":1,"tractor":1}', 4),
  ('tower', 'Небостъргач', '🌆', 32000000, 30, 11490000, '{"crew":3,"loader":2,"truck":2,"crane":2,"tractor":1}', 6);

-- нивата (devlevel.js THRESH)
create or replace function online.level(xp bigint) returns int language sql immutable as $$
  select coalesce(max(i), 1) from unnest(array[0,1000,4000,10000,20000,40000,70000,110000,170000,250000,350000,480000,640000,840000,1100000,1400000,1800000,2300000,2900000,3600000]::bigint[]) with ordinality t(x, i) where xp >= x
$$;
create or replace function online.level_xp(l int) returns bigint language sql immutable as $$
  select (array[0,1000,4000,10000,20000,40000,70000,110000,170000,250000,350000,480000,640000,840000,1100000,1400000,1800000,2300000,2900000,3600000]::bigint[])[least(greatest(l, 1), 20)]
$$;

-- ── състояние на фирмата ──
alter table online.companies add column if not exists last_seen_day int not null default 1;
alter table online.companies add column if not exists offers_day int not null default 0;
alter table online.companies add column if not exists lots_used int not null default 0;

create table online.units (
  company_id bigint not null references online.companies on delete cascade,
  type text not null references online.unit_types,
  n int not null default 0 check (n >= 0),
  primary key (company_id, type)
);

create table online.offers (
  id bigserial primary key,
  company_id bigint not null references online.companies on delete cascade,
  kind text not null references online.kinds,
  client text not null,
  reward bigint not null, days int not null, mat bigint not null,
  day int not null, expires_day int not null,
  status text not null default 'open' check (status in ('open', 'taken', 'expired'))
);
create index offers_open on online.offers (company_id) where status = 'open';

create table online.builds (
  id bigserial primary key,
  company_id bigint not null references online.companies on delete cascade,
  offer_id bigint unique references online.offers,
  kind text not null references online.kinds,
  title text not null,
  reward bigint not null, mat bigint not null, xp int not null,
  need jsonb not null,
  lot int not null,                       -- парцел в града (за 3D)
  start_at timestamptz not null, end_at timestamptz not null,
  status text not null default 'running' check (status in ('running', 'done')),
  done_day int
);
create index builds_running on online.builds (company_id) where status = 'running';
create index builds_due on online.builds (end_at) where status = 'running';

-- ── помощни ──
create or replace function online.eur(cents bigint) returns text language sql immutable as
  $$ select replace(to_char(round(cents / 100.0), 'FM999,999,999,999,990'), ',', ' ') $$;
-- техниката, заета в текущите строежи (и по-късно — в договорите от търговете)
create or replace function online.busy(p_company bigint) returns jsonb language sql stable as $$
  select coalesce(jsonb_object_agg(k, s), '{}'::jsonb) from (
    select e.key k, sum(e.value::int) s from online.builds b, jsonb_each_text(b.need) e
     where b.company_id = p_company and b.status = 'running' group by e.key) q
$$;
create or replace function online.free_units(p_company bigint) returns jsonb language sql stable as $$
  select coalesce(jsonb_object_agg(u.type, u.n - coalesce((online.busy(p_company) ->> u.type)::int, 0)), '{}'::jsonb)
    from online.units u where u.company_id = p_company
$$;
create or replace function online.upkeep(p_company bigint) returns bigint language sql stable as $$
  select coalesce(sum(u.n * t.upkeep), 0)::bigint from online.units u join online.unit_types t using (type) where u.company_id = p_company
$$;

-- нови предложения за поръчки: генерират се само на сървъра (никакъв клиентски вход)
create or replace function online.gen_offers(c online.companies, w online.worlds, d int) returns void language plpgsql as $$
declare board int := online.cfg(w, 'offer_board', 4)::int; life int := online.cfg(w, 'offer_days', 3)::int;
  n int; k online.kinds; lv int := online.level(c.xp); i int; h float8;
  clients text[] := array['Семейство Петрови', 'ЕТ „Иванов“', 'Кооперация „Дом“', 'Иван Георгиев', 'Банка „Балкан“', 'Сдружение „Нов квартал“', 'Мария Димитрова', 'Холдинг „Тракия“', 'Община', 'Фирма „Хоризонт“'];
begin
  update online.offers set status = 'expired' where company_id = c.id and status = 'open' and expires_day < d;
  if c.offers_day >= d then return; end if;
  select count(*) into n from online.offers where company_id = c.id and status = 'open';
  for i in 1 .. greatest(0, board - n) loop
    h := ('x' || substr(md5(c.id || ':' || d || ':' || i), 1, 8))::bit(32)::bigint / 4294967296.0;
    select * into k from online.kinds where min_level <= lv order by random() limit 1;
    insert into online.offers (company_id, kind, client, reward, days, mat, day, expires_day)
      values (c.id, k.kind, clients[1 + (floor(h * 1000)::int % array_length(clients, 1))],
              round(k.reward * (0.85 + 0.3 * h) * (1 + 0.04 * least(lv, 10)) / 50000) * 50000, k.days, k.mat, d, d + life);
  end loop;
  update online.companies set offers_day = d where id = c.id;
end $$;

-- Урежда фирмата до „сега“: завършени строежи → плащане + XP (точно веднъж), поддръжка по дни, нови поръчки.
-- Заключва реда на фирмата, затова е безопасно при едновременни извиквания (заявка + планирана задача).
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
    update online.companies set settled_day = d where id = c.id;
  end if;
  -- 3) табло с поръчки
  select * into c from online.companies where id = p_company;
  perform online.gen_offers(c, w, d);
end $$;

-- Планирана задача: урежда фирмите със завършени строежи или неуреден ден. SKIP LOCKED — не чака заетите.
create or replace function online.tick() returns int language plpgsql as $$
declare r record; n int := 0;
begin
  for r in select c.id from online.companies c join online.worlds w on w.id = c.world_id
     where w.status = 'open' and (c.settled_day < online.wday(w)
        or exists (select 1 from online.builds b where b.company_id = c.id and b.status = 'running' and b.end_at <= online.wnow(w)))
     for update of c skip locked loop
    perform online.settle(r.id); n := n + 1;
  end loop;
  return n;
end $$;

-- фирмата на текущия акаунт в света (с проверка на достъпа), уредена до сега
create or replace function online.my_company(u uuid, p_world int) returns online.companies language plpgsql as $$
declare w online.worlds; c online.companies;
begin
  select * into w from online.worlds where id = p_world;
  if not found or not online.can_play(u, w) then return null; end if;
  select * into c from online.companies where world_id = p_world and user_id = u;
  if c.id is null then return null; end if;
  perform online.settle(c.id);   -- първо уреждаме отсъствието по старото last_seen_day, после отбелязваме присъствието
  update online.companies set last_seen_day = greatest(last_seen_day, online.wday(w)) where id = c.id;
  select * into c from online.companies where id = c.id;
  return c;
end $$;

-- ── начална техника за нови фирми (и за създадените преди етап Б) ──
create or replace function online.give_start_units(p_company bigint) returns void language sql as $$
  insert into online.units (company_id, type, n) values (p_company, 'crew', 1), (p_company, 'loader', 1), (p_company, 'truck', 1) on conflict do nothing
$$;
select online.give_start_units(id) from online.companies;
update online.companies c set last_seen_day = online.wday(w), settled_day = greatest(c.settled_day, 1) from online.worlds w where w.id = c.world_id;

create or replace function online.after_company() returns trigger language plpgsql as $$
begin perform online.give_start_units(new.id); return new; end $$;
create trigger companies_start_units after insert on online.companies for each row execute function online.after_company();

-- ═══════════════════ API ═══════════════════

-- купи техника (qty броя); цената е от сървърния каталог
create or replace function public.ol_buy_unit(p_req uuid, p_world int, p_type text, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; t online.unit_types; total bigint;
begin
  r := online.req_begin(u, p_req, 'buy_unit'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into t from online.unit_types where type = p_type;
  if not found then return online.req_end(u, p_req, online.fail('bad_type', 'Няма такава техника.')); end if;
  if p_qty is null or p_qty not between 1 and 10 then return online.req_end(u, p_req, online.fail('bad_qty', 'От 1 до 10 броя наведнъж.')); end if;
  total := t.cost * p_qty;
  if not online.money(c.id, -total, 'техника', format('Покупка: %s × %s', t.nm, p_qty), null) then
    return online.req_end(u, p_req, online.fail('no_money', format('Нямаш %s €.', online.eur(total))));
  end if;
  insert into online.units (company_id, type, n) values (c.id, p_type, p_qty) on conflict (company_id, type) do update set n = online.units.n + p_qty;
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'type', p_type, 'qty', p_qty, 'paid', total));
end $$;

-- продай свободна техника за половин цена
create or replace function public.ol_sell_unit(p_req uuid, p_world int, p_type text) returns jsonb
language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; t online.unit_types; fr int;
begin
  r := online.req_begin(u, p_req, 'sell_unit'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into t from online.unit_types where type = p_type;
  fr := coalesce((online.free_units(c.id) ->> p_type)::int, 0);
  if t.type is null or fr < 1 then return online.req_end(u, p_req, online.fail('not_free', 'Нямаш свободна техника от този вид.')); end if;
  update online.units set n = n - 1 where company_id = c.id and type = p_type;
  perform online.money(c.id, t.cost / 2, 'техника', format('Продажба: %s', t.nm), null);
  return online.req_end(u, p_req, jsonb_build_object('ok', true));
end $$;

-- започни строеж по предложение: проверява собствеността, срока, свободната техника и парите за материалите
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
  if not online.money(c.id, -o.mat, 'материали', format('Материали: %s за %s', k.nm, o.client), 'mat:' || o.id) then
    return online.req_end(u, p_req, online.fail('no_money', format('Нямаш %s € за материалите.', online.eur(o.mat))));
  end if;
  update online.offers set status = 'taken' where id = o.id;
  update online.companies set lots_used = lots_used + 1 where id = c.id returning lots_used into lot;
  insert into online.builds (company_id, offer_id, kind, title, reward, mat, xp, need, lot, start_at, end_at)
    values (c.id, o.id, o.kind, format('%s %s — %s', k.ico, k.nm, o.client), o.reward, o.mat, (o.reward / 10000)::int, k.need, lot,
            online.wnow(w), online.wnow(w) + make_interval(secs => o.days * w.day_seconds)) returning id into bid;
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'build', bid));
end $$;

-- ол_state с икономиката (заменя етап А)
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
      'upkeep', online.upkeep(c.id), 'last_seen_day', c.last_seen_day) end,
    'units', case when c.id is null then '{}'::jsonb else coalesce((select jsonb_object_agg(type, n) from online.units where company_id = c.id), '{}'::jsonb) end,
    'free', case when c.id is null then '{}'::jsonb else online.free_units(c.id) end,
    'offers', case when c.id is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(o) - 'company_id' order by o.id) from online.offers o where o.company_id = c.id and o.status = 'open'), '[]'::jsonb) end,
    'builds', case when c.id is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(b) - 'company_id' order by b.id) from online.builds b where b.company_id = c.id and (b.status = 'running' or b.id in (select id from online.builds where company_id = c.id and status = 'done' order by id desc limit 40))), '[]'::jsonb) end,
    'ledger', case when c.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('day', l.day, 'amount', l.amount, 'reason', l.reason, 'note', l.note) order by l.id desc)
       from (select * from online.ledger where company_id = c.id order by id desc limit 30) l), '[]'::jsonb) end,
    'notes', case when c.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body, 'seen', n.seen, 'at', n.at) order by n.id desc)
       from (select * from online.notes where company_id = c.id order by id desc limit 20) n), '[]'::jsonb) end);
end $$;

-- админ: мести часовника на ТЕСТОВ свят (за проверка на рестарт/отсъствие)
create or replace function public.ol_admin_shift(p_world int, p_seconds bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds;
begin
  if not online.is_admin(u) then return online.fail('forbidden', 'Само за администратори.'); end if;
  update online.worlds set shift_s = shift_s + p_seconds where id = p_world and test returning * into w;
  if not found then return online.fail('not_test', 'Часовникът се мести само в тестов свят.'); end if;
  perform online.log(w.id, null, u, 'clock_shift', jsonb_build_object('s', p_seconds));
  return jsonb_build_object('ok', true, 'day', online.wday(w));
end $$;

-- права: само ol_* за влезлите
revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- планирана задача всяка минута (ако pg_cron е наличен — в Supabase е)
do $$ begin
  begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron не е наличен: %', sqlerrm; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'online-tick';
    perform cron.schedule('online-tick', '* * * * *', 'select online.tick()');
  end if;
end $$;
