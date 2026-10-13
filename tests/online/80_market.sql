-- Версия 2: пазар — производство, енергия, гориво, продажба/покупка между фирми, такса, изкупуване, стоки в строежите
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select t.as(:ADM);
select (public.ol_admin_world('market-1', 'Пазар', false, 600, '{}', true) ->> 'world')::int as w \gset
select public.ol_create_company(gen_random_uuid(), :w, 'М-В', 'imperial', 'ruse') \gset
select t.as(:A); select public.ol_create_company(gen_random_uuid(), :w, 'М-А', 'titan', 'sofia') \gset
select t.as(:B); select public.ol_create_company(gen_random_uuid(), :w, 'М-Б', 'atlas', 'varna') \gset
select t.su();
select id as ca from online.companies where name = 'М-А' \gset
select id as cb from online.companies where name = 'М-Б' \gset
select id as cv from online.companies where name = 'М-В' \gset
select t.fund(:ca, 100000000), t.fund(:cb, 20000000), t.fund(:cv, 20000000);
update online.companies set xp = 4000 where id = :ca;   -- ниво 3
-- производства: нивото се проверява
select t.as(:B);
select t.ok((public.ol_build_facility(gen_random_uuid(), :w, 'concrete_plant') ->> 'err') = 'level', 'на ниво 1 няма бетонов възел');
select t.as(:A);
select gen_random_uuid() as rq \gset
select public.ol_build_facility(:'rq', :w, 'concrete_plant') \gset
select public.ol_build_facility(:'rq', :w, 'concrete_plant') \gset
select public.ol_build_facility(gen_random_uuid(), :w, 'solar') \gset
select t.ok((public.ol_market(:w) -> 'facilities' ->> 'concrete_plant')::int = 1, 'един бетонов възел (повторената заявка не купува втори)');
select t.ok((public.ol_build_facility(gen_random_uuid(), :w, 'steel_mill') ->> 'err') = 'level', 'стоманолеярната е от ниво 5');
-- 2 дни производство: бетон 80, енергия 40 − 10 = 30, без купен ток
select t.as(:ADM); select public.ol_admin_shift(:w, 600 * 2) \gset
select t.as(:A); select public.ol_state(:w) \gset
select t.su();
select t.ok(online.inv(:ca, 'concrete') = 80, 'бетонът е произведен за 2 дни: 80 м³');
select t.ok(online.inv(:ca, 'energy') = 30, 'енергия: 40 от соларния парк − 10 за възела = 30 MWh');
select t.ok(not exists (select 1 from online.ledger where company_id = :ca and reason = 'енергия'), 'не е купуван ток');
select t.as(:A); select public.ol_state(:w) \gset
select t.su(); select online.tick() \gset
select t.ok(online.inv(:ca, 'concrete') = 80, 'повторното уреждане не произвежда втори път');
-- продажба: проверки и блокиране на стоката
select t.as(:A);
select t.ok((public.ol_sell_order(gen_random_uuid(), :w, 'concrete', 10, 12000) ->> 'err') = 'bad_price', 'над държавната цена — отказ');
select t.ok((public.ol_sell_order(gen_random_uuid(), :w, 'concrete', 100, 9000) ->> 'err') = 'no_stock', 'повече от склада — отказ');
select t.ok((public.ol_sell_order(gen_random_uuid(), :w, 'concrete', -5, 9000) ->> 'err') = 'bad_qty', 'отрицателно количество — отказ');
select (public.ol_sell_order(gen_random_uuid(), :w, 'concrete', 50, 9000) ->> 'ask')::bigint as ask \gset
select t.ok((public.ol_market(:w) -> 'goods' -> 0 ->> 'mine')::numeric = 30, 'в склада остават 30 м³ — 50 са блокирани в офертата');
select t.ok(jsonb_array_length((select g -> 'book' from jsonb_array_elements(public.ol_market(:w) -> 'goods') g where g ->> 'good' = 'concrete')) = 0, 'своята оферта не е в „книгата“ за купуване');
select (public.ol_state(:w) -> 'company' ->> 'cash')::bigint as a0 \gset
-- Б купува 20 (повторената заявка не купува втори път); плаща 1800 €, А получава 1764 € (такса 2%)
select t.as(:B);
select (public.ol_state(:w) -> 'company' ->> 'cash')::bigint as b0 \gset
select t.ok((select (g -> 'book' -> 0 ->> 'price')::bigint = 9000 from jsonb_array_elements(public.ol_market(:w) -> 'goods') g where g ->> 'good' = 'concrete'), 'Б вижда офертата на А в книгата');
select gen_random_uuid() as rb \gset
select public.ol_buy(:'rb', :w, 'concrete', 20, 10000) \gset
select public.ol_buy(:'rb', :w, 'concrete', 20, 10000) \gset
select t.ok((public.ol_state(:w) -> 'company' ->> 'cash')::bigint = :b0 - 180000, 'Б плати 20 × 90 € веднъж');
select t.su();
select t.ok(online.inv(:cb, 'concrete') = 20 and (select qty from online.asks where id = :ask) = 30, 'стоката мина при Б; в офертата остават 30');
select t.ok((select cash from online.companies where id = :ca) = :a0 + 176400, 'А получи 1764 € (2% такса)');
-- купувач с макс. цена под офертата не купува; Б не купува от себе си
select t.as(:B);
select t.ok((public.ol_buy(gen_random_uuid(), :w, 'concrete', 5, 8000) ->> 'qty')::numeric = 0, 'под цената на офертите — нищо');
select public.ol_sell_order(gen_random_uuid(), :w, 'concrete', 5, 7000) \gset
select public.ol_buy(gen_random_uuid(), :w, 'concrete', 5, 10000) \gset
select t.su();
select t.ok((select count(*) from online.trades where buyer = :cb and seller = :cb) = 0, 'Б не купува от собствената си оферта');
-- А отменя: остатъкът се връща в склада
select t.as(:A);
select t.ok((public.ol_cancel_order(gen_random_uuid(), :w, :ask) ->> 'returned')::numeric = 25, 'отмяна връща остатъка (25 м³)');
select t.as(:B); select t.ok((public.ol_cancel_order(gen_random_uuid(), :w, :ask) ->> 'err') = 'no_order', 'чужда/затворена оферта не се отменя');
-- изкупуване от държавата: 10 м³ × 110 € × 60% = 660 €
select t.as(:A);
select t.ok((public.ol_sell_state(gen_random_uuid(), :w, 'concrete', 10) ->> 'paid')::bigint = 66000, 'държавата изкупува на 60%');
select t.ok((public.ol_sell_state(gen_random_uuid(), :w, 'concrete', 9999) ->> 'err') = 'no_stock', 'не може да продаде повече от склада');
-- строеж със стоки от склада: Б има 25 м³ бетон; липсващото се купува от държавата
select t.as(:B);
select (public.ol_state(:w) -> 'offers' -> 0 ->> 'id')::bigint as o, (public.ol_state(:w) -> 'company' ->> 'cash')::bigint as b1 \gset
select t.su(); select online.inv(:cb, 'concrete') as bcon \gset
select (k.goods ->> 'concrete')::numeric as gc, (k.goods ->> 'steel')::numeric as gs from online.offers o join online.kinds k using (kind) where o.id = :o \gset
select t.as(:B); select public.ol_start_build(gen_random_uuid(), :w, :o) \gset
select t.su();
select t.ok(online.inv(:cb, 'concrete') = greatest(0, :bcon - :gc), 'бетонът от склада е използван');
select t.ok((select cash from online.companies where id = :cb) = :b1 - ceil(greatest(0, :gc - :bcon) * 11000 + :gs * 90000), 'платено е само липсващото по държавна цена');
-- гориво: заетите багер и самосвал харчат 0,1 т/ден → купено от държавата
update online.worlds set shift_s = shift_s + 600 where id = :w;
select online.tick() \gset
select t.ok((select -sum(amount) from online.ledger where company_id = :cb and reason = 'гориво') = 16000, 'гориво за 2 заети машини за 1 ден = 0,1 т = 160 €');
-- стойността включва производствата (50%) и стоките (60%)
select t.ok((online.value_parts(c) ->> 'facilities')::bigint = (15000000 + 12000000) / 2 and (online.value_parts(c) ->> 'goods')::bigint > 0, 'стойността брои производствата и склада') from online.companies c where c.id = :ca;
select t.ok(online.profit(c, 30) = (select sum(amount) from online.ledger where company_id = c.id and reason in ('строеж', 'търг', 'материали', 'поддръжка', 'продажба', 'стоки', 'енергия', 'гориво')) and exists (select 1 from online.ledger where company_id = c.id and reason = 'продажба'), 'печалбата брои продажбите, стоките, енергията и горивото') from online.companies c where c.id = :ca;
select t.ok(t.balanced(), 'журнал = наличност');
select t.ok((select bool_and(qty >= 0) from online.inventory), 'складът никога не е отрицателен');
select 'MARKET: ALL PASSED' as result;
