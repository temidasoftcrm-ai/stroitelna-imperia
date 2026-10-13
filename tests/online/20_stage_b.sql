-- Етап Б: техника, строежи, плащане и XP точно веднъж, поддръжка по дни, отсъствие, чужди активи, подправени данни
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select t.as(:ADM);
select (public.ol_admin_world('econ-1', 'Икономика', false, 600, '{"idle_days":3}', true) ->> 'world')::int as w \gset
select t.as(:A); select public.ol_create_company(gen_random_uuid(), :w, 'А Строй', 'titan', 'sofia') \gset
select t.as(:B); select public.ol_create_company(gen_random_uuid(), :w, 'Б Строй', 'atlas', 'varna') \gset

select t.as(:A);
select public.ol_state(:w) as s \gset
select t.ok((:'s'::jsonb -> 'units' ->> 'crew')::int = 1 and (:'s'::jsonb -> 'units' ->> 'truck')::int = 1, 'начална техника: бригада, багер, самосвал');
select t.ok(jsonb_array_length(:'s'::jsonb -> 'offers') = 4, '4 предложения за поръчки');
select t.ok((select bool_and(o ->> 'kind' = 'house') from jsonb_array_elements(:'s'::jsonb -> 'offers') o), 'на ниво 1 — само къщи');
select (:'s'::jsonb -> 'offers' -> 0 ->> 'id')::bigint as o1, (:'s'::jsonb -> 'offers' -> 1 ->> 'id')::bigint as o2, (:'s'::jsonb -> 'offers' -> 0 ->> 'reward')::bigint as rew, (:'s'::jsonb -> 'offers' -> 0 ->> 'mat')::bigint as mat \gset

-- Б не може да ползва поръчка на А
select t.as(:B);
select t.ok((public.ol_start_build(gen_random_uuid(), :w, :o1) ->> 'err') = 'no_offer', 'Б не може да започне чужда поръчка');
select t.as(:A);
select gen_random_uuid() as rq \gset
select public.ol_start_build(:'rq', :w, :o1) as r1 \gset
select public.ol_start_build(:'rq', :w, :o1) as r2 \gset
select t.ok((:'r1'::jsonb ->> 'ok')::boolean and :'r1'::jsonb = :'r2'::jsonb, 'строежът започва; повторената заявка не прави втори');
select t.ok((public.ol_state(:w) -> 'company' ->> 'cash')::bigint = 2000000 - :mat, 'материалите са платени веднъж');
select t.ok((public.ol_start_build(gen_random_uuid(), :w, :o2) ->> 'err') = 'no_units', 'втори строеж без свободна техника — отказ');
select t.ok((public.ol_sell_unit(gen_random_uuid(), :w, 'crew') ->> 'err') = 'not_free', 'заетата бригада не може да се продаде');
-- подправени параметри
select t.ok((public.ol_buy_unit(gen_random_uuid(), :w, 'crane', 1000) ->> 'err') = 'bad_qty', 'абсурдно количество — отказ');
select t.ok((public.ol_buy_unit(gen_random_uuid(), :w, 'yacht', 1) ->> 'err') = 'bad_type', 'несъществуваща техника — отказ');
select t.ok((public.ol_buy_unit(gen_random_uuid(), :w, 'crane', -1) ->> 'err') = 'bad_qty', 'отрицателно количество — отказ');
-- купува кран: точната каталожна цена
select (public.ol_state(:w) -> 'company' ->> 'cash')::bigint as c0 \gset
select gen_random_uuid() as rb \gset
select public.ol_buy_unit(:'rb', :w, 'tractor', 1) \gset
select public.ol_buy_unit(:'rb', :w, 'tractor', 1) \gset
select t.ok((public.ol_state(:w) -> 'units' ->> 'tractor')::int = 1 and (public.ol_state(:w) -> 'company' ->> 'cash')::bigint = :c0 - 800000, 'покупка с повторен req_id: 1 трактор, платен веднъж');
select t.ok((public.ol_buy_unit(gen_random_uuid(), :w, 'crane', 10) ->> 'err') = 'no_money', 'няма пари → отказ, без отрицателна наличност');

-- времето: +1 ден → поддръжка за ден 1 точно веднъж (и при повторно уреждане)
select t.as(:ADM); select public.ol_admin_shift(:w, 600); select t.as(:A);
select public.ol_state(:w) \gset
select public.ol_state(:w) \gset
select t.su();
select t.ok((select count(*) from online.ledger l join online.companies c on c.id = l.company_id where c.name = 'А Строй' and l.reason = 'поддръжка') = 1, 'поддръжката за ден 1 е таксувана веднъж');
select t.ok((select -amount from online.ledger l join online.companies c on c.id = l.company_id where c.name = 'А Строй' and l.reason = 'поддръжка') = 25000 + 12000 + 9000 + 5000, 'поддръжка = бригада + багер + самосвал + трактор');
select online.tick() \gset
select t.ok((select count(*) from online.ledger l join online.companies c on c.id = l.company_id where c.name = 'А Строй' and l.reason = 'поддръжка') = 1, 'планираната задача не таксува втори път');

-- +8 дни, А не влиза: планираната задача завършва строежа (при затворен браузър) и плаща точно веднъж
select t.as(:ADM); select public.ol_admin_shift(:w, 600 * 8); select t.su();
select online.tick() \gset
select online.tick() \gset
select t.ok((select count(*) from online.ledger l join online.companies c on c.id = l.company_id where c.name = 'А Строй' and l.reason = 'строеж') = 1, 'строежът е платен точно веднъж');
select t.ok((select amount from online.ledger l join online.companies c on c.id = l.company_id where c.name = 'А Строй' and l.reason = 'строеж') = :rew, 'платена е договорената сума');
select t.ok((select xp from online.companies where name = 'А Строй') = :rew / 10000, 'XP = бюджет / 100 € — точно веднъж');
-- отсъствие: А последно е влизал на ден 2; idle_days = 3 → поддръжка до ден 5, после „в покой“
select t.ok((select sum(-amount) from online.ledger l join online.companies c on c.id = l.company_id where c.name = 'А Строй' and l.reason = 'поддръжка') = 51000 * 5, 'при отсъствие поддръжката спира 3 дни след последното влизане (дни 1–5)');
select t.as(:A);
select t.ok((public.ol_state(:w) -> 'builds' -> 0 ->> 'status') = 'done', 'А вижда готовия строеж при влизане');
select t.ok(exists (select 1 from jsonb_array_elements(public.ol_state(:w) -> 'notes') n where n ->> 'title' like '✅%'), 'известие за готов строеж');
-- Б не вижда активите на А
select t.as(:B);
select t.ok(jsonb_array_length(public.ol_state(:w) -> 'builds') = 0 and (public.ol_state(:w) -> 'units' ->> 'tractor') is null, 'Б вижда само своите строежи и техника');
select t.su();
select t.ok((select sum(amount) from online.ledger where company_id = c.id) = c.cash, 'журнал = наличност (А)') from online.companies c where c.name = 'А Строй';
select t.ok((select sum(amount) from online.ledger where company_id = c.id) = c.cash, 'журнал = наличност (Б)') from online.companies c where c.name = 'Б Строй';
select 'STAGE B: ALL PASSED' as result;
