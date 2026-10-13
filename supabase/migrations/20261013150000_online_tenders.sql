-- „Онлайн империя“ — етап В: обществени поръчки (търгове) между истинските фирми в света.
-- Сървърът публикува търг (бюджет, срок за оферти, срок за изпълнение, изисквания, депозит). Допустимите фирми подават
-- СКРИТА ценова оферта и блокират гаранционен депозит. До крайния срок офертата може да се промени или оттегли.
-- След срока печели най-ниската валидна оферта; при равни цени — по-рано подадената (времето на последната промяна).
-- Депозитите на загубилите се освобождават. Победителят получава договор: трябва да започне изпълнението в срок
-- (нужна е свободна техника); при старта получава аванс и плаща материалите; при предаване — остатъка, XP и депозита.
-- Ако не започне в срок — губи депозита (санкцията е показана предварително). Всичко се обработва точно веднъж.

alter table online.companies add column if not exists held bigint not null default 0;   -- блокирани депозити (евроцентове)

create table online.tender_kinds (
  kind text primary key, tier text not null check (tier in ('local', 'national', 'global')),
  nm text not null, ico text not null,
  budget_min bigint not null, budget_max bigint not null, days int not null, mat_share numeric not null,
  need jsonb not null
);
insert into online.tender_kinds values
  ('school', 'local', 'Ново училище', '🏫', 6000000, 10000000, 12, 0.40, '{"crew":1,"loader":1,"truck":1}'),
  ('fire', 'local', 'Пожарна служба', '🚒', 7000000, 12000000, 12, 0.40, '{"crew":1,"loader":1,"truck":1}'),
  ('police', 'local', 'Районно полицейско управление', '🚓', 8000000, 14000000, 14, 0.40, '{"crew":1,"loader":1,"truck":1,"crane":1}'),
  ('cityhall', 'national', 'Ново кметство', '🏛️', 60000000, 120000000, 22, 0.45, '{"crew":3,"loader":1,"truck":2,"crane":1}'),
  ('hospital', 'national', 'Областна болница', '🏥', 120000000, 220000000, 28, 0.45, '{"crew":4,"loader":2,"truck":3,"crane":1}'),
  ('pool', 'national', 'Плувен комплекс', '🏊', 80000000, 150000000, 24, 0.45, '{"crew":3,"loader":1,"truck":2,"crane":1}'),
  ('stadium', 'global', 'Национален стадион', '🏟️', 600000000, 1200000000, 40, 0.50, '{"crew":5,"loader":2,"truck":4,"crane":2}'),
  ('metro', 'global', 'Нова линия на метрото', '🚇', 900000000, 1800000000, 45, 0.50, '{"crew":6,"loader":3,"truck":5,"crane":2}'),
  ('port', 'global', 'Контейнерен терминал', '⚓', 700000000, 1500000000, 42, 0.50, '{"crew":4,"loader":2,"truck":4,"crane":2}');

create table online.tenders (
  id bigserial primary key,
  world_id int not null references online.worlds on delete cascade,
  kind text not null references online.tender_kinds,
  tier text not null,
  title text not null, city text not null,
  budget bigint not null,          -- максимална цена
  deposit bigint not null,         -- гаранционен депозит
  mat bigint not null,             -- материали (плащат се при старта, независимо от цената)
  days int not null,               -- срок за изпълнение (игрални дни)
  start_days int not null,         -- срок за започване след спечелването
  need jsonb not null,
  opens_at timestamptz not null, closes_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'awarded', 'no_bids')),
  winner_bid bigint, resolved_at timestamptz
);
create index tenders_open on online.tenders (world_id) where status = 'open';
create index tenders_due on online.tenders (closes_at) where status = 'open';

create table online.bids (
  id bigserial primary key,
  tender_id bigint not null references online.tenders on delete cascade,
  company_id bigint not null references online.companies on delete cascade,
  price bigint not null,
  deposit bigint not null,
  placed_at timestamptz not null,        -- момент на последната промяна (за равни цени)
  status text not null default 'active' check (status in ('active', 'withdrawn', 'won', 'lost')),
  unique (tender_id, company_id)
);
alter table online.tenders add constraint tenders_winner_fk foreign key (winner_bid) references online.bids;

create table online.contracts (
  id bigserial primary key,
  tender_id bigint not null unique references online.tenders,
  bid_id bigint not null unique references online.bids,
  company_id bigint not null references online.companies on delete cascade,
  price bigint not null, deposit bigint not null,
  start_by timestamptz not null,
  status text not null default 'awaiting' check (status in ('awaiting', 'running', 'done', 'failed')),
  build_id bigint references online.builds,
  created_at timestamptz not null default now()
);
create index contracts_awaiting on online.contracts (start_by) where status = 'awaiting';
alter table online.builds add column if not exists contract_id bigint references online.contracts;

-- ── правила (видими за играча) ──
create or replace function online.tier_levels(w online.worlds, tier text) returns int[] language sql stable as $$
  select case tier
    when 'local' then array[1, online.cfg(w, 'local_max_lv', 8)::int]                        -- начинаещите имат собствена надпревара
    when 'national' then array[online.cfg(w, 'national_min_lv', 5)::int, online.cfg(w, 'national_max_lv', 15)::int]
    else array[online.cfg(w, 'global_min_lv', 10)::int, 20] end
$$;
create or replace function online.tier_nm(tier text) returns text language sql immutable as
  $$ select case tier when 'local' then 'местна' when 'national' then 'национална' else 'световна' end $$;
create or replace function online.min_price_pct() returns numeric language sql immutable as $$ select 0.5 $$;   -- под 50% от бюджета офертата е невалидна
create or replace function online.advance_pct() returns numeric language sql immutable as $$ select 0.2 $$;     -- аванс при старта

-- активните договори на фирмата (за лимита)
create or replace function online.open_contracts(p_company bigint) returns int language sql stable as
  $$ select count(*)::int from online.contracts where company_id = p_company and status in ('awaiting', 'running') $$;

-- Защо фирмата НЕ може да участва (null = може). Проверява нивото, техниката (собствена, не непременно свободна),
-- лимита на договорите и парите за депозита.
create or replace function online.why_not(c online.companies, t online.tenders, w online.worlds, p_has_bid boolean) returns text language plpgsql stable as $$
declare lv int := online.level(c.xp); r int[] := online.tier_levels(w, t.tier); e record; own int;
begin
  if t.status <> 'open' or t.closes_at <= online.wnow(w) then return 'Търгът е затворен.'; end if;
  if lv < r[1] then return format('За %s поръчка трябва ниво %s (имаш %s).', online.tier_nm(t.tier), r[1], lv); end if;
  if lv > r[2] then return format('Местните поръчки са за фирми до ниво %s — твоята надпревара е в по-големите търгове.', r[2]); end if;
  for e in select key, value::int v from jsonb_each_text(t.need) loop
    select coalesce(n, 0) into own from online.units where company_id = c.id and type = e.key;
    if coalesce(own, 0) < e.v then return format('Нужен капацитет: %s × %s (имаш %s).', e.v, (select nm from online.unit_types where type = e.key), coalesce(own, 0)); end if;
  end loop;
  if not p_has_bid then
    if online.open_contracts(c.id) >= online.cfg(w, 'max_contracts', 2) then return format('Имаш %s активни договора — лимитът е %s.', online.open_contracts(c.id), online.cfg(w, 'max_contracts', 2)); end if;
    if c.cash < t.deposit then return format('Нужен е депозит %s €.', online.eur(t.deposit)); end if;
  end if;
  return null;
end $$;

-- ── публикуване на търгове (от планираната задача) ──
create or replace function online.publish_tenders(w online.worlds) returns int language plpgsql as $$
declare v_tier text; want int; have int; k online.tender_kinds; city text; b bigint; n int := 0; bid_days int;
  bg text[] := array['sofia','plovdiv','varna','burgas','ruse','stz','pleven','vt','blg','shumen','dobrich','sliven','haskovo'];
  big text[] := array['sofia','plovdiv','varna','burgas','ruse','stz'];
  globe text[] := array['istanbul','athens','belgrade','bucharest','vienna','budapest','milan','munich','paris','madrid'];
  cnm jsonb := '{"sofia":"София","plovdiv":"Пловдив","varna":"Варна","burgas":"Бургас","ruse":"Русе","stz":"Стара Загора","pleven":"Плевен","vt":"Велико Търново","blg":"Благоевград","shumen":"Шумен","dobrich":"Добрич","sliven":"Сливен","haskovo":"Хасково","istanbul":"Истанбул","athens":"Атина","belgrade":"Белград","bucharest":"Букурещ","vienna":"Виена","budapest":"Будапеща","milan":"Милано","munich":"Мюнхен","paris":"Париж","madrid":"Мадрид"}';
begin
  if not exists (select 1 from online.companies where world_id = w.id) then return 0; end if;
  foreach v_tier in array array['local', 'national', 'global'] loop
    want := online.cfg(w, 'tenders_' || v_tier, case v_tier when 'local' then 3 when 'national' then 2 else 1 end)::int;
    bid_days := online.cfg(w, 'bid_days_' || v_tier, case v_tier when 'local' then 3 when 'national' then 5 else 7 end)::int;
    select count(*) into have from online.tenders where world_id = w.id and online.tenders.tier = v_tier and status = 'open';
    while have < want loop
      select * into k from online.tender_kinds where tender_kinds.tier = v_tier order by random() limit 1;
      city := case v_tier when 'local' then bg[1 + floor(random() * array_length(bg, 1))::int] when 'national' then big[1 + floor(random() * array_length(big, 1))::int] else globe[1 + floor(random() * array_length(globe, 1))::int] end;
      b := round((k.budget_min + random() * (k.budget_max - k.budget_min)) / 100000) * 100000;
      insert into online.tenders (world_id, kind, tier, title, city, budget, deposit, mat, days, start_days, need, opens_at, closes_at)
        values (w.id, k.kind, v_tier, format('%s %s — %s', k.ico, k.nm, cnm ->> city), city, b,
                round(b * online.cfg(w, 'deposit_pct', 0.05) / 10000) * 10000, round(b * k.mat_share / 10000) * 10000, k.days,
                online.cfg(w, 'start_days', 2)::int, k.need,
                online.wnow(w), online.wnow(w) + make_interval(secs => bid_days * w.day_seconds));
      have := have + 1; n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- депозит: блокиране / освобождаване / загуба (всяко — точно веднъж, по ref)
create or replace function online.hold(p_bid bigint, p_company bigint, p_amt bigint, p_title text) returns boolean language plpgsql as $$
begin
  if not online.money(p_company, -p_amt, 'депозит', format('Гаранционен депозит: %s', p_title), 'dep:' || p_bid || ':hold') then return false; end if;
  update online.companies set held = held + p_amt where id = p_company;
  return true;
end $$;
create or replace function online.release(p_bid bigint, p_company bigint, p_amt bigint, p_title text) returns boolean language plpgsql as $$
begin
  if exists (select 1 from online.ledger where company_id = p_company and ref in ('dep:' || p_bid || ':rel', 'dep:' || p_bid || ':lost')) then return false; end if;
  perform online.money(p_company, p_amt, 'депозит', format('Освободен депозит: %s', p_title), 'dep:' || p_bid || ':rel');
  update online.companies set held = held - p_amt where id = p_company;
  return true;
end $$;
create or replace function online.forfeit(p_bid bigint, p_company bigint, p_amt bigint, p_title text) returns boolean language plpgsql as $$
begin
  if exists (select 1 from online.ledger where company_id = p_company and ref in ('dep:' || p_bid || ':rel', 'dep:' || p_bid || ':lost')) then return false; end if;
  perform online.money(p_company, 0, 'санкция', format('Задържан депозит %s €: %s', online.eur(p_amt), p_title), 'dep:' || p_bid || ':lost', true);
  update online.companies set held = held - p_amt where id = p_company;
  return true;
end $$;

-- Затваряне на търг: точно един победител (най-ниската валидна оферта, при равенство — по-ранната), депозитите на
-- останалите се освобождават, победителят получава договор. Заключва търга — безопасно при паралелни извиквания.
create or replace function online.resolve_tender(p_tender bigint) returns void language plpgsql as $$
declare t online.tenders; w online.worlds; b record; win online.bids; c online.companies; cid bigint;
begin
  select * into t from online.tenders where id = p_tender for update;
  if t.status <> 'open' then return; end if;
  select * into w from online.worlds where id = t.world_id;
  if t.closes_at > online.wnow(w) then return; end if;
  -- победител: най-ниската валидна оферта (фирмата още има нужния капацитет)
  for b in select bd.* from online.bids bd where bd.tender_id = t.id and bd.status = 'active' order by bd.price, bd.placed_at, bd.id loop
    select * into c from online.companies where id = b.company_id;
    if not exists (select 1 from jsonb_each_text(t.need) e where coalesce((select n from online.units u where u.company_id = c.id and u.type = e.key), 0) < e.value::int) then
      select * into win from online.bids where id = b.id; exit;
    end if;
  end loop;
  -- загубилите: освобождаваме депозита
  for b in select bd.* from online.bids bd where bd.tender_id = t.id and bd.status = 'active' and bd.id is distinct from win.id loop
    update online.bids set status = 'lost' where id = b.id;
    perform online.release(b.id, b.company_id, b.deposit, t.title);
    perform online.note(b.company_id, 'info', format('Търгът „%s“ е загубен', t.title),
      case when win.id is null then 'Няма валиден победител.' else format('Спечели оферта от %s €. Депозитът ти от %s € е освободен.', online.eur(win.price), online.eur(b.deposit)) end);
  end loop;
  if win.id is null then
    update online.tenders set status = 'no_bids', resolved_at = online.wnow(w) where id = t.id;
    perform online.log(t.world_id, null, null, 'tender_no_bids', jsonb_build_object('tender', t.id));
    return;
  end if;
  update online.bids set status = 'won' where id = win.id;
  insert into online.contracts (tender_id, bid_id, company_id, price, deposit, start_by)
    values (t.id, win.id, win.company_id, win.price, win.deposit, online.wnow(w) + make_interval(secs => t.start_days * w.day_seconds)) returning id into cid;
  update online.tenders set status = 'awarded', winner_bid = win.id, resolved_at = online.wnow(w) where id = t.id;
  perform online.note(win.company_id, 'good', format('🏆 Спечели търга „%s“!', t.title),
    format('Договор за %s €. Започни изпълнението до %s игрални дни — иначе губиш депозита от %s €.', online.eur(win.price), t.start_days, online.eur(win.deposit)));
  perform online.log(t.world_id, win.company_id, null, 'tender_awarded', jsonb_build_object('tender', t.id, 'bid', win.id, 'price', win.price, 'contract', cid));
end $$;

-- договор, който не е започнат в срок → провал, депозитът се задържа
create or replace function online.fail_contract(p_contract bigint) returns void language plpgsql as $$
declare k online.contracts; t online.tenders; w online.worlds;
begin
  select * into k from online.contracts where id = p_contract for update;
  if k.status <> 'awaiting' then return; end if;
  select * into t from online.tenders where id = k.tender_id; select * into w from online.worlds where id = t.world_id;
  if k.start_by > online.wnow(w) then return; end if;
  update online.contracts set status = 'failed' where id = k.id;
  perform online.forfeit(k.bid_id, k.company_id, k.deposit, t.title);
  perform online.note(k.company_id, 'bad', format('❌ Договорът „%s“ е провален', t.title), format('Изпълнението не започна в срок — депозитът от %s € е задържан.', online.eur(k.deposit)));
  perform online.log(t.world_id, k.company_id, null, 'contract_failed', jsonb_build_object('contract', k.id));
end $$;

-- settle (етап Б) + завършените договори: остатъкът се плаща от строежа; тук — депозитът и статусът
create or replace function online.settle_contracts(p_company bigint) returns void language plpgsql as $$
declare k record;
begin
  for k in select ct.*, t.title from online.contracts ct join online.tenders t on t.id = ct.tender_id join online.builds b on b.id = ct.build_id
     where ct.company_id = p_company and ct.status = 'running' and b.status = 'done' loop
    update online.contracts set status = 'done' where id = k.id;
    perform online.release(k.bid_id, k.company_id, k.deposit, k.title);
    perform online.note(k.company_id, 'good', format('🏛️ Договорът „%s“ е изпълнен', k.title), format('Депозитът от %s € е освободен.', online.eur(k.deposit)));
  end loop;
end $$;

-- разширяваме settle: след строежите — договорите
create or replace function online.settle_all(p_company bigint) returns void language plpgsql as $$
begin
  perform online.settle(p_company);
  perform online.settle_contracts(p_company);
end $$;

-- my_company урежда и договорите
create or replace function online.my_company(u uuid, p_world int) returns online.companies language plpgsql as $$
declare w online.worlds; c online.companies;
begin
  select * into w from online.worlds where id = p_world;
  if not found or not online.can_play(u, w) then return null; end if;
  select * into c from online.companies where world_id = p_world and user_id = u;
  if c.id is null then return null; end if;
  perform online.settle_all(c.id);
  update online.companies set last_seen_day = greatest(last_seen_day, online.wday(w)) where id = c.id;
  select * into c from online.companies where id = c.id;
  return c;
end $$;

-- планираната задача: търгове (затваряне и публикуване), провалени договори, уреждане на фирмите
create or replace function online.tick() returns int language plpgsql as $$
declare r record; n int := 0; ww online.worlds;
begin
  for r in select t.id from online.tenders t join online.worlds w on w.id = t.world_id where t.status = 'open' and t.closes_at <= online.wnow(w) order by t.closes_at loop
    perform online.resolve_tender(r.id); n := n + 1;
  end loop;
  for r in select k.id from online.contracts k join online.companies c on c.id = k.company_id join online.worlds w on w.id = c.world_id
     where k.status = 'awaiting' and k.start_by <= online.wnow(w) loop
    perform online.fail_contract(r.id); n := n + 1;
  end loop;
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

-- ═══════════════════ API ═══════════════════

-- търговете в света: отворени (с моята оферта и защо мога/не мога) и последните затворени (с публичния резултат)
create or replace function public.ol_tenders(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies; w online.worlds;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  select * into w from online.worlds where id = p_world;
  -- затваряме изтеклите веднага (не чакаме планираната задача)
  perform online.resolve_tender(t.id) from online.tenders t where t.world_id = p_world and t.status = 'open' and t.closes_at <= online.wnow(w);
  return jsonb_build_object('ok', true, 'server_now', online.wnow(w),
    'rules', jsonb_build_object('min_price_pct', online.min_price_pct(), 'advance_pct', online.advance_pct(), 'max_contracts', online.cfg(w, 'max_contracts', 2),
      'tiers', jsonb_build_object('local', online.tier_levels(w, 'local'), 'national', online.tier_levels(w, 'national'), 'global', online.tier_levels(w, 'global'))),
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'tier', t.tier, 'kind', t.kind, 'budget', t.budget, 'deposit', t.deposit, 'mat', t.mat,
        'days', t.days, 'start_days', t.start_days, 'need', t.need, 'closes_at', t.closes_at,
        'bids', (select count(*) from online.bids b where b.tender_id = t.id and b.status = 'active'),
        'my', (select jsonb_build_object('price', b.price, 'placed_at', b.placed_at, 'status', b.status, 'deposit', b.deposit) from online.bids b where b.tender_id = t.id and b.company_id = c.id),
        'why_not', online.why_not(c, t, w, exists (select 1 from online.bids b where b.tender_id = t.id and b.company_id = c.id and b.status = 'active'))) order by t.tier, t.closes_at)
      from online.tenders t where t.world_id = p_world and t.status = 'open'), '[]'::jsonb),
    'closed', coalesce((select jsonb_agg(x order by x ->> 'resolved_at' desc) from (select jsonb_build_object('id', t.id, 'title', t.title, 'tier', t.tier, 'budget', t.budget, 'status', t.status, 'resolved_at', t.resolved_at,
        'bids', (select count(*) from online.bids b where b.tender_id = t.id and b.status in ('won', 'lost')),
        'winner', (select co.name from online.bids b join online.companies co on co.id = b.company_id where b.id = t.winner_bid),
        'price', (select b.price from online.bids b where b.id = t.winner_bid),
        'mine', (select b.status from online.bids b where b.tender_id = t.id and b.company_id = c.id)) x
      from online.tenders t where t.world_id = p_world and t.status <> 'open' order by t.resolved_at desc limit 12) q), '[]'::jsonb),
    'contracts', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'title', t.title, 'price', k.price, 'deposit', k.deposit, 'status', k.status, 'start_by', k.start_by,
        'need', t.need, 'days', t.days, 'mat', t.mat, 'advance', round(k.price * online.advance_pct()), 'build', k.build_id,
        'end_at', (select end_at from online.builds where id = k.build_id)) order by k.id desc)
      from online.contracts k join online.tenders t on t.id = k.tender_id where k.company_id = c.id and (k.status in ('awaiting', 'running') or k.created_at > now() - interval '2 days')), '[]'::jsonb));
end $$;

-- подай или промени оферта (цена в евроцентове; закръгля се до 100 €)
create or replace function public.ol_bid(p_req uuid, p_world int, p_tender bigint, p_price bigint) returns jsonb
language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; w online.worlds; t online.tenders; b online.bids; why text; v_price bigint;
begin
  r := online.req_begin(u, p_req, 'bid'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into w from online.worlds where id = p_world;
  select * into t from online.tenders where id = p_tender and world_id = p_world for share;   -- затварянето чака подаването и обратно
  if not found then return online.req_end(u, p_req, online.fail('no_tender', 'Няма такъв търг.')); end if;
  v_price := round(coalesce(p_price, 0) / 10000.0) * 10000;
  if v_price > t.budget or v_price < round(t.budget * online.min_price_pct()) then
    return online.req_end(u, p_req, online.fail('bad_price', format('Офертата трябва да е между %s € и %s €.', online.eur(round(t.budget * online.min_price_pct())::bigint), online.eur(t.budget))));
  end if;
  select * into b from online.bids where tender_id = t.id and company_id = c.id;
  if b.id is not null and b.status = 'withdrawn' then return online.req_end(u, p_req, online.fail('withdrawn', 'Оттеглил си офертата за този търг — не може да се подаде отново.')); end if;
  select * into c from online.companies where id = c.id for update;
  why := online.why_not(c, t, w, b.id is not null);
  if why is not null then return online.req_end(u, p_req, online.fail('not_eligible', why)); end if;
  if b.id is null then
    insert into online.bids (tender_id, company_id, price, deposit, placed_at) values (t.id, c.id, v_price, t.deposit, clock_timestamp()) returning * into b;
    if not online.hold(b.id, c.id, t.deposit, t.title) then
      raise exception 'no_money_for_deposit';   -- не би трябвало (why_not провери), но тогава връщаме цялата транзакция
    end if;
  elsif b.price <> v_price then
    update online.bids set price = v_price, placed_at = clock_timestamp() where id = b.id returning * into b;
  end if;
  perform online.log(p_world, c.id, u, 'bid', jsonb_build_object('tender', t.id, 'price', v_price));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'bid', b.id, 'price', b.price, 'deposit', b.deposit));
end $$;

-- оттегли офертата до крайния срок: депозитът се освобождава; повторно подаване в същия търг не се допуска
create or replace function public.ol_withdraw(p_req uuid, p_world int, p_tender bigint) returns jsonb
language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; w online.worlds; t online.tenders; b online.bids;
begin
  r := online.req_begin(u, p_req, 'withdraw'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into w from online.worlds where id = p_world;
  select * into t from online.tenders where id = p_tender and world_id = p_world for share;
  if not found or t.status <> 'open' or t.closes_at <= online.wnow(w) then return online.req_end(u, p_req, online.fail('closed', 'Търгът е затворен.')); end if;
  select * into b from online.bids where tender_id = t.id and company_id = c.id and status = 'active' for update;
  if not found then return online.req_end(u, p_req, online.fail('no_bid', 'Нямаш активна оферта.')); end if;
  update online.bids set status = 'withdrawn' where id = b.id;
  perform online.release(b.id, c.id, b.deposit, t.title);
  return online.req_end(u, p_req, jsonb_build_object('ok', true));
end $$;

-- започни изпълнението на спечелен договор: свободна техника; аванс 20% от цената; материалите се плащат
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
  if c.cash + adv < t.mat then
    return online.req_end(u, p_req, online.fail('no_money', format('Нямаш %s € за материалите (след аванса от %s €).', online.eur(t.mat - adv), online.eur(adv))));
  end if;
  perform online.money(c.id, adv, 'търг', format('Аванс по договор: %s', t.title), 'adv:' || k.id);
  perform online.money(c.id, -t.mat, 'материали', format('Материали: %s', t.title), 'cmat:' || k.id);
  update online.companies set lots_used = lots_used + 1 where id = c.id returning lots_used into lot;
  insert into online.builds (company_id, kind, title, reward, mat, xp, need, lot, start_at, end_at, contract_id)
    values (c.id, case when t.tier = 'local' then 'shop' when t.tier = 'national' then 'office' else 'tower' end, t.title, k.price - adv, t.mat,
            (k.price / 10000)::int, t.need, lot, online.wnow(w), online.wnow(w) + make_interval(secs => t.days * w.day_seconds), k.id) returning id into bid;
  update online.contracts set status = 'running', build_id = bid where id = k.id;
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'build', bid));
end $$;

revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
