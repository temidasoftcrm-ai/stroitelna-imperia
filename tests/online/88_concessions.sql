-- Версия 2: временни концесии — скрити оферти с блокиране, само вдигане, най-високата валидна печели,
-- заета техника, приход по дни точно веднъж, лимит на концесиите, край на срока и нов търг
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select t.as(:ADM);
select (public.ol_admin_world('conc-1', 'Концесии', false, 600, '{"concessions_open":6,"max_concessions":1}', true) ->> 'world')::int as w \gset
select public.ol_create_company(gen_random_uuid(), :w, 'Ц-В', 'imperial', 'ruse') \gset
select t.as(:A); select public.ol_create_company(gen_random_uuid(), :w, 'Ц-А', 'titan', 'sofia') \gset
select t.as(:B); select public.ol_create_company(gen_random_uuid(), :w, 'Ц-Б', 'atlas', 'varna') \gset
select t.su();
select id as ca from online.companies where name = 'Ц-А' \gset
select id as cb from online.companies where name = 'Ц-Б' \gset
select id as cv from online.companies where name = 'Ц-В' \gset
select t.fund(id, 1000000000) from online.companies where world_id = :w;
update online.companies set xp = 40000 where world_id = :w;   -- ниво 6
select t.units(:ca, 'crane', 2), t.units(:ca, 'truck', 3), t.units(:ca, 'crew', 3), t.units(:cv, 'crane', 2), t.units(:cv, 'truck', 3), t.units(:cv, 'crew', 4);
select online.tick() \gset
select t.ok((select count(*) from online.conc_rounds where world_id = :w and status = 'auction') = 6, 'обявени са 6 търга за концесии');
select id as pv from online.conc_rounds where world_id = :w and ctype = 'port-varna' \gset
select id as av from online.conc_rounds where world_id = :w and ctype = 'airport-varna' \gset
select t.as(:A);
select t.ok((public.ol_conc_bid(gen_random_uuid(), :w, :pv, 10000000) ->> 'err') = 'bad_amount', 'под минималната оферта — отказ');
select gen_random_uuid() as rq \gset
select public.ol_conc_bid(:'rq', :w, :pv, 65000000) \gset
select public.ol_conc_bid(:'rq', :w, :pv, 65000000) \gset
select t.su(); select t.ok((select held from online.companies where id = :ca) = 65000000, 'офертата на А (650 000 €) е блокирана веднъж');
select t.as(:A);
select t.ok((public.ol_conc_bid(gen_random_uuid(), :w, :pv, 62000000) ->> 'err') = 'raise_only', 'офертата не се сваля');
select public.ol_conc_bid(gen_random_uuid(), :w, :pv, 70000000) \gset
select t.su(); select t.ok((select held from online.companies where id = :ca) = 70000000, 'при вдигане се блокира само разликата');
-- Б дава най-много, но няма кранове → невалидна; В дава колкото Б → печели В
select t.as(:B); select public.ol_conc_bid(gen_random_uuid(), :w, :pv, 90000000) \gset
select t.as(:ADM); select public.ol_conc_bid(gen_random_uuid(), :w, :pv, 80000000) \gset
select t.ok((select x ->> 'my' from jsonb_array_elements(public.ol_concessions(:w) -> 'auctions') x where (x ->> 'round')::bigint = :pv)::bigint = 80000000, 'В вижда само своята оферта');
select t.ok(position('90000000' in public.ol_concessions(:w)::text) = 0, 'чуждите оферти не се виждат');
-- В печели и летище Варна → с лимит 1 концесия втората ѝ оферта е невалидна
select public.ol_conc_bid(gen_random_uuid(), :w, :av, 90000000) \gset
select t.as(:A); select public.ol_conc_bid(gen_random_uuid(), :w, :av, 40000000) \gset
select t.su();
update online.worlds set shift_s = shift_s + 600 * 3 where id = :w;
select online.conc_resolve(:pv);
select online.tick() \gset
select online.tick() \gset
select t.ok((select co.name from online.conc_rounds r join online.companies co on co.id = r.holder where r.id = :pv) = 'Ц-В', 'пристанище Варна: Б без кранове отпада → печели В');
select t.ok((select co.name from online.conc_rounds r join online.companies co on co.id = r.holder where r.id = :av) = 'Ц-А', 'летище Варна: В е на лимита (1 концесия) → печели А с по-ниската оферта');
select t.ok((select count(*) from online.conc_rounds where holder = :cv and status = 'active') = 1, 'В държи най-много 1 концесия (лимит) — втората оферта отпада');
select t.ok((select sum(held) from online.companies where world_id = :w) = 0, 'всички блокирани пари са освободени');
select t.ok((select count(*) from online.ledger where ref like 'cbid:%:rel' and company_id = :cb) = 1, 'офертата на Б е върната точно веднъж');
select t.ok((select -amount from online.ledger where ref = 'conc:' || :pv || ':fee') = 80000000, 'В плати своята оферта (800 000 €) като такса');
select t.ok(coalesce((online.free_units(:cv) ->> 'crane')::int, 0) = 0, 'кранoвете на В са заети на пристанището');
select t.ok(exists (select 1 from online.notes where company_id = :cv and title like '%е твоя!'), 'известие за спечелена концесия');
-- приход: 5 дни × 60 000 € точно веднъж
update online.worlds set shift_s = shift_s + 600 * 5 where id = :w;
select online.tick() \gset
select online.tick() \gset
select (select paid_day - online.day_of(ww, r.start_at) + 1 from online.conc_rounds r, online.worlds ww where r.id = :pv and ww.id = :w) as pd \gset
select t.ok((select sum(amount) from online.ledger where company_id = :cv and reason = 'концесия' and amount > 0) = 6000000 * :pd, 'приходът е точно 60 000 € на изминал ден');
select t.ok((online.value_parts(c) ->> 'concessions')::bigint between 1 and 80000000 - 1, 'платената концесия намалява стойността си до края на срока') from online.companies c where c.id = :cv;
-- край: 20 дни × 60 000 €, техниката е свободна, нов търг за пристанището
update online.worlds set shift_s = shift_s + 600 * 20 where id = :w;
select online.tick() \gset
select online.tick() \gset
select t.ok((select status from online.conc_rounds where id = :pv) = 'ended', 'концесията изтече');
select t.ok((select sum(amount) from online.ledger where company_id = :cv and reason = 'концесия' and amount > 0 and ref like 'conc:' || :pv || ':d%') = 6000000 * 20, 'общо точно 20 дни × 60 000 €');
select t.ok((online.free_units(:cv) ->> 'crane')::int = 2, 'крановете са свободни');
select t.ok(exists (select 1 from online.conc_rounds where world_id = :w and ctype = 'port-varna' and status = 'auction'), 'пристанището отива на нов търг');
select t.ok(t.balanced(), 'журнал = наличност');
select 'CONCESSIONS: ALL PASSED' as result;
