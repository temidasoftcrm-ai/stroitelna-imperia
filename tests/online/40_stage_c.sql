-- Етап В: обществени поръчки — скрити оферти, депозити, равни цени, промяна/оттегляне, точно един победител,
-- освобождаване и загуба на депозити, договор (аванс, материали, плащане, XP), провал при незапочване
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select t.as(:ADM);
select (public.ol_admin_world('tender-1', 'Търгове', false, 600, '{"tenders_local":3,"tenders_national":2,"tenders_global":1,"max_contracts":2}', true) ->> 'world')::int as w \gset
select public.ol_create_company(gen_random_uuid(), :w, 'В Админ', 'imperial', 'ruse') \gset
select t.as(:A); select public.ol_create_company(gen_random_uuid(), :w, 'Т-А', 'titan', 'sofia') \gset
select t.as(:B); select public.ol_create_company(gen_random_uuid(), :w, 'Т-Б', 'atlas', 'varna') \gset
select t.su();
select t.fund(t.co('Т-А'), 50000000), t.fund(t.co('Т-Б'), 50000000), t.fund(t.co('В Админ'), 50000000);
select t.units(t.co(n), 'crane', 1) from unnest(array['Т-А', 'Т-Б', 'В Админ']) n;
select online.tick() \gset
select t.ok((select count(*) from online.tenders where world_id = :w and status = 'open') = 6, 'публикувани 3 местни, 2 национални, 1 световен търг');
-- местен търг без кран (school/fire) и с нужда от кран (police) — ползваме първите два местни
select id as t1, budget as b1, deposit as d1, mat as m1 from online.tenders where world_id = :w and tier = 'local' order by id limit 1 \gset
select id as t2, budget as b2, deposit as d2 from online.tenders where world_id = :w and tier = 'local' order by id offset 1 limit 1 \gset
select id as t3, budget as b3, deposit as d3 from online.tenders where world_id = :w and tier = 'local' order by id offset 2 limit 1 \gset
select id as tn, budget as bn from online.tenders where world_id = :w and tier = 'national' limit 1 \gset

-- подправени цени и чужд търг
select t.as(:A);
select t.ok((public.ol_bid(gen_random_uuid(), :w, :t1, :b1 + 10000) ->> 'err') = 'bad_price', 'над бюджета — отказ');
select t.ok((public.ol_bid(gen_random_uuid(), :w, :t1, (:b1 * 0.4)::bigint) ->> 'err') = 'bad_price', 'под 50% от бюджета — отказ');
select t.ok((public.ol_bid(gen_random_uuid(), :w, :t1, -5) ->> 'err') = 'bad_price', 'отрицателна цена — отказ');
select t.ok((public.ol_bid(gen_random_uuid(), :w + 999, :t1, :b1) ->> 'err') in ('no_company', 'no_tender'), 'търг от чужд свят — отказ');
select t.ok((public.ol_bid(gen_random_uuid(), :w, :tn, :bn) ->> 'msg') like 'За национална поръчка трябва ниво%', 'ниво 1 не може в национален търг — с обяснение');
select t.ok((select (x ->> 'why_not') like 'За национална%' from jsonb_array_elements(public.ol_tenders(:w) -> 'open') x where (x ->> 'id')::bigint = :tn), 'списъкът показва защо не може');

-- т1: А и Б с една и съща цена → печели по-ранната (А); повторената заявка не блокира депозита два пъти
select (public.ol_state(:w) -> 'company' ->> 'cash')::bigint as a0 \gset
select gen_random_uuid() as rq \gset
select public.ol_bid(:'rq', :w, :t1, (:b1 * 0.9)::bigint) \gset
select public.ol_bid(:'rq', :w, :t1, (:b1 * 0.9)::bigint) \gset
select t.su();
select t.ok((select cash from online.companies where id = t.co('Т-А')) = :a0 - :d1 and (select held from online.companies where id = t.co('Т-А')) = :d1, 'депозитът е блокиран веднъж');
select t.as(:B);
select public.ol_bid(gen_random_uuid(), :w, :t1, (:b1 * 0.9)::bigint) \gset
select t.ok((select (x -> 'my' ->> 'price') is not null and (x ->> 'bids')::int = 2 from jsonb_array_elements(public.ol_tenders(:w) -> 'open') x where (x ->> 'id')::bigint = :t1), 'Б вижда своята оферта и броя оферти');
select t.ok((select count(*) from jsonb_array_elements(public.ol_tenders(:w) -> 'open') x, jsonb_each(x) e where e.key in ('prices', 'all_bids')) = 0, 'няма чужди цени в отговора');

-- т2: А и Б еднаква цена, но А променя и връща цената → времето на А е по-късно → печели Б
select t.as(:A); select public.ol_bid(gen_random_uuid(), :w, :t2, (:b2 * 0.8)::bigint) \gset
select t.as(:B); select public.ol_bid(gen_random_uuid(), :w, :t2, (:b2 * 0.8)::bigint) \gset
select t.as(:A); select public.ol_bid(gen_random_uuid(), :w, :t2, (:b2 * 0.85)::bigint) \gset
select public.ol_bid(gen_random_uuid(), :w, :t2, (:b2 * 0.8)::bigint) \gset
-- т3: „В Админ“ дава най-ниско, но продава крана преди края → невалидна; Б оттегля и не може пак; печели А
select t.as(:ADM); select public.ol_bid(gen_random_uuid(), :w, :t3, (:b3 * 0.6)::bigint) \gset
select t.as(:A); select public.ol_bid(gen_random_uuid(), :w, :t3, (:b3 * 0.95)::bigint) \gset
select t.as(:B); select public.ol_bid(gen_random_uuid(), :w, :t3, (:b3 * 0.7)::bigint) \gset
select (public.ol_state(:w) -> 'company' ->> 'cash')::bigint as bc \gset
select t.ok((public.ol_withdraw(gen_random_uuid(), :w, :t3) ->> 'ok')::boolean, 'Б оттегля офертата');
select t.ok((public.ol_state(:w) -> 'company' ->> 'cash')::bigint = :bc + :d3, 'депозитът на Б е върнат при оттеглянето');
select t.ok((public.ol_bid(gen_random_uuid(), :w, :t3, (:b3 * 0.7)::bigint) ->> 'err') = 'withdrawn', 'след оттегляне не може пак в същия търг');
select t.su();
-- „В Админ“ губи капацитета: ако търгът иска кран — продава го; иначе — бригадата
select t.units(t.co('В Админ'), e.key, 0) from online.tenders tt, jsonb_each_text(tt.need) e where tt.id = :t3 limit 1;

-- край на търговете: паралелно затваряне от две места → един победител, един договор
update online.worlds set shift_s = shift_s + 600 * 4 where id = :w;
select online.resolve_tender(:t1), online.resolve_tender(:t1);
select online.tick() \gset
select online.tick() \gset
select t.ok((select count(*) from online.contracts where tender_id in (:t1, :t2, :t3)) = 3, 'по един договор на търг');
select t.ok((select co.name from online.tenders tt join online.bids b on b.id = tt.winner_bid join online.companies co on co.id = b.company_id where tt.id = :t1) = 'Т-А', 'т1: равни цени → печели по-рано подадената (А)');
select t.ok((select co.name from online.tenders tt join online.bids b on b.id = tt.winner_bid join online.companies co on co.id = b.company_id where tt.id = :t2) = 'Т-Б', 'т2: А промени офертата → времето ѝ е по-късно → печели Б');
select t.ok((select co.name from online.tenders tt join online.bids b on b.id = tt.winner_bid join online.companies co on co.id = b.company_id where tt.id = :t3) = 'Т-А', 'т3: най-ниската без капацитет е невалидна → печели следващата валидна');
select t.ok((select count(*) from online.bids where tender_id = :t1 and status = 'won') = 1, 'точно един победител');
select t.ok((select count(*) from online.ledger where ref like 'dep:%:rel' and ref in (select 'dep:' || id || ':rel' from online.bids where status = 'lost')) = (select count(*) from online.bids where status = 'lost'), 'всеки загубил депозит е освободен точно веднъж');
select t.ok((select held from online.companies where name = 'В Админ') = 0, 'депозитът на невалидната оферта е върнат');
select t.ok(exists (select 1 from online.notes n where n.company_id = t.co('Т-А') and n.title like '🏆%'), 'известие за спечелен търг');
select t.ok(exists (select 1 from online.notes n where n.company_id = t.co('Т-А') and n.title like '%загубен'), 'известие за загубен търг с освободен депозит');
select t.ok(t.balanced(), 'журнал = наличност за всички');
-- след затварянето офертите не може да се променят
select t.as(:A);
select t.ok((public.ol_bid(gen_random_uuid(), :w, :t1, :b1) ->> 'err') = 'not_eligible', 'затворен търг не приема оферти');

-- договор т1 (А): старт → аванс + материали; Б не може да стартира договор на А
select t.su(); select id as k1 from online.contracts where tender_id = :t1 \gset
select id as k2 from online.contracts where tender_id = :t2 \gset
select id as k3 from online.contracts where tender_id = :t3 \gset
select price as p1 from online.contracts where id = :k1 \gset
select t.as(:B);
select t.ok((public.ol_start_contract(gen_random_uuid(), :w, :k1) ->> 'err') = 'no_contract', 'Б не може да изпълнява договор на А');
select t.as(:A);
select gen_random_uuid() as rs \gset
select public.ol_start_contract(:'rs', :w, :k1) as s1 \gset
select public.ol_start_contract(:'rs', :w, :k1) as s2 \gset
select t.ok((:'s1'::jsonb ->> 'ok')::boolean and :'s1'::jsonb = :'s2'::jsonb, 'договорът започва; повторената заявка не прави втори аванс');
select t.ok((public.ol_start_contract(gen_random_uuid(), :w, :k3) ->> 'err') = 'no_units', 'втори договор без свободна техника — отказ с обяснение');
select t.su();
select t.ok((select count(*) from online.ledger where ref = 'adv:' || :k1) = 1 and (select amount from online.ledger where ref = 'adv:' || :k1) = round(:p1 * 0.2), 'авансът е 20% и е платен веднъж');
-- Б не стартира т2 → след 2 дни договорът се проваля и депозитът се задържа (веднъж)
update online.worlds set shift_s = shift_s + 600 * 3 where id = :w;
select online.tick() \gset
select online.tick() \gset
select t.ok((select status from online.contracts where id = :k2) = 'failed', 'незапочнат в срок договор е провален');
select t.ok((select count(*) from online.ledger where ref like 'dep:%:lost' and company_id = t.co('Т-Б')) = 1 and (select held from online.companies where name = 'Т-Б') = 0, 'депозитът е задържан веднъж; блокираните пари са 0');
select t.ok(exists (select 1 from online.notes n where n.company_id = t.co('Т-Б') and n.title like '❌%'), 'известие за провален договор');
select t.ok((select status from online.contracts where id = :k3) = 'failed', 'и т3 (А нямаше свободна техника) е провален');
-- т1 се изпълнява → плащане на остатъка, XP, депозитът се връща — по веднъж
update online.worlds set shift_s = shift_s + 600 * 30 where id = :w;
select online.tick() \gset
select online.tick() \gset
select t.ok((select status from online.contracts where id = :k1) = 'done', 'договорът е изпълнен');
select t.ok((select sum(amount) from online.ledger l join online.builds b on l.ref = 'build:' || b.id where b.contract_id = :k1) = :p1 - round(:p1 * 0.2), 'остатъкът (80%) е платен веднъж');
select t.ok((select count(*) from online.ledger where ref = 'dep:' || (select bid_id from online.contracts where id = :k1) || ':rel') = 1, 'депозитът по изпълнения договор е върнат веднъж');
select t.ok((select held from online.companies where name = 'Т-А') = 0, 'А няма блокирани пари');
select t.ok(exists (select 1 from online.notes n where n.company_id = t.co('Т-А') and n.title like '🏛️%'), 'известие за изпълнен договор и освободен депозит');
select t.ok(t.balanced(), 'журнал = наличност за всички');
select t.ok((select count(*) from online.tenders where world_id = :w and status = 'open') = 6, 'нови търгове заместват затворените');
select 'STAGE C: ALL PASSED' as result;
