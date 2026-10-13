-- Отношения: съюз (покана → приемане, лимит, без такса на пазара, видими оферти), съперници (двубои, бонус XP), права
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select t.as(:ADM);
select (public.ol_admin_world('rel-1', 'Отношения', false, 600, '{"auto_start":0,"max_contracts":5}', true) ->> 'world')::int as w \gset
select public.ol_create_company(gen_random_uuid(), :w, 'О-В', 'imperial', 'ruse') \gset
select t.as(:A); select public.ol_create_company(gen_random_uuid(), :w, 'О-А', 'titan', 'sofia') \gset
select t.as(:B); select public.ol_create_company(gen_random_uuid(), :w, 'О-Б', 'atlas', 'varna') \gset
select t.su();
select id as ca from online.companies where name = 'О-А' \gset
select id as cb from online.companies where name = 'О-Б' \gset
select id as cv from online.companies where name = 'О-В' \gset
select t.fund(id, 100000000) from online.companies where world_id = :w;
select t.units(c.id, k, 3) from online.companies c, unnest(array['crew', 'loader', 'truck', 'crane']) k where c.world_id = :w;
-- съюз: покана → приемане
select t.as(:A);
select t.ok((public.ol_relation(gen_random_uuid(), :w, :ca, 'ally') ->> 'err') = 'no_target', 'не може съюз със себе си');
select t.ok((public.ol_relation(gen_random_uuid(), :w, :cb, 'ally') ->> 'status') = 'pending', 'А предлага съюз на Б');
select t.su(); select t.ok(not online.is_ally(:ca, :cb), 'преди приемане не са съюзници');
select t.as(:B);
select t.ok(exists (select 1 from jsonb_array_elements(public.ol_state(:w) -> 'notes') n where n ->> 'title' = '🤝 О-А предлага съюз на твоята фирма'), 'Б получава поканата');
select t.ok((select (x ->> 'ally_pending_in')::boolean from jsonb_array_elements(public.ol_relations(:w) -> 'companies') x where (x ->> 'id')::bigint = :ca), 'Б вижда входящата покана');
select t.ok((public.ol_relation(gen_random_uuid(), :w, :ca, 'ally') ->> 'status') = 'active', 'Б приема → съюзници');
select t.su(); select t.ok(online.is_ally(:ca, :cb), 'съюзът е активен');
-- пазар без такса: Б продава 10 т стомана по 800 € на А → Б получава всичко
select t.su(); select online.inv_add(:cb, 'steel', 10); select cash as b0 from online.companies where id = :cb \gset
select t.as(:B); select public.ol_sell_order(gen_random_uuid(), :w, 'steel', 10, 80000) \gset
select t.as(:A); select public.ol_buy(gen_random_uuid(), :w, 'steel', 5, 80000) \gset
select t.su(); select t.ok((select cash from online.companies where id = :cb) = :b0 + 400000, 'между съюзници няма такса (Б получи пълните 4000 €)');
select t.as(:ADM); select public.ol_buy(gen_random_uuid(), :w, 'steel', 5, 80000) \gset
select t.su(); select t.ok((select cash from online.companies where id = :cb) = :b0 + 400000 + 392000, 'от несъюзник — с 2% такса');
-- видими оферти в търговете между съюзници
select online.tick() \gset
select id as tt, budget as tb from online.tenders where world_id = :w and tier = 'local' and status = 'open' order by id limit 1 \gset
select t.as(:B); select public.ol_bid(gen_random_uuid(), :w, :tt, (:tb * 0.9)::bigint) \gset
select t.as(:A);
select t.ok((select (x -> 'ally_bids' -> 0 ->> 'name') = 'О-Б' from jsonb_array_elements(public.ol_tenders(:w) -> 'open') x where (x ->> 'id')::bigint = :tt), 'А вижда офертата на съюзника си');
select t.as(:ADM);
select t.ok((select jsonb_array_length(x -> 'ally_bids') = 0 from jsonb_array_elements(public.ol_tenders(:w) -> 'open') x where (x ->> 'id')::bigint = :tt), 'несъюзник не вижда чуждите оферти');
-- лимит на съюзите
select t.as(:A);
select t.ok((public.ol_relation(gen_random_uuid(), :w, :cb, 'rival') ->> 'err') = 'allies', 'съюзник не може да е съперник');
-- съперник: В обявява А; А и В наддават; А печели → двубой и бонус XP
select t.as(:ADM);
select t.ok((public.ol_relation(gen_random_uuid(), :w, :ca, 'rival') ->> 'ok')::boolean, 'В обявява А за съперник');
select t.as(:A); select t.ok(exists (select 1 from jsonb_array_elements(public.ol_state(:w) -> 'notes') n where n ->> 'title' = '⚔️ О-В те обяви за съперник'), 'А е уведомена');
select t.ok((public.ol_relation(gen_random_uuid(), :w, :cv, 'ally') ->> 'err') = 'rivals', 'със съперник няма съюз');
select t.su(); select id as t2, budget as b2 from online.tenders where world_id = :w and tier = 'local' and status = 'open' and id <> :tt order by id limit 1 \gset
select xp as xa0 from online.companies where id = :ca \gset
select t.as(:A); select public.ol_bid(gen_random_uuid(), :w, :t2, (:b2 * 0.8)::bigint) \gset
select t.as(:ADM); select public.ol_bid(gen_random_uuid(), :w, :t2, (:b2 * 0.9)::bigint) \gset
select t.su(); update online.worlds set shift_s = shift_s + 600 * 4 where id = :w;
select online.tick() \gset
select online.tick() \gset
select t.ok((select count(*) from online.duels where winner = :ca and loser = :cv) = 1, 'двубоят е записан веднъж');
select t.ok((select xp from online.companies where id = :ca) = :xa0 + greatest(1, ((select price from online.contracts where tender_id = :t2) / 5000 * 0.25)::int), 'А получи бонус XP за победата над съперника');
select t.ok(exists (select 1 from online.notes where company_id = :cv and title = '⚔️ Съперникът О-А те победи'), 'В е уведомена за загубата');
select t.as(:A);
select t.ok((select (x ->> 'wins')::int = 1 and (x ->> 'rival_in')::boolean from jsonb_array_elements(public.ol_relations(:w) -> 'companies') x where (x ->> 'id')::bigint = :cv), 'А вижда резултата 1:0 срещу В');
-- прекратяване
select t.ok((public.ol_relation(gen_random_uuid(), :w, :cb, 'unally') ->> 'ok')::boolean, 'А прекратява съюза');
select t.su(); select t.ok(not online.is_ally(:ca, :cb), 'вече не са съюзници');
select t.as(:ADM); select public.ol_relation(gen_random_uuid(), :w, :ca, 'unrival') \gset
select t.su(); select t.ok(not online.is_rival(:ca, :cv), 'съперничеството е прекратено');
select t.su(); select t.ok(t.balanced(), 'журнал = наличност');
select 'RELATIONS: ALL PASSED' as result;
