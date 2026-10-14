-- Партньорство, част 2: общ участък/линия (бонус веднъж, само когато и двамата са готови), наем, задачи, касичка, чат, изненади
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set C '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from coop.pairs; delete from coop.snaps;
select t.as(:A); select public.coop_create() ->> 'code' as code \gset
select t.as(:B); select public.coop_join(:'code') \gset
select t.as(:A); select public.coop_snap('{"name":"А","worth":100000,"stats":{"done":3,"hw":0,"earned":50000,"cities":1},"hwDone":[],"rails":[]}') \gset
select t.as(:B); select public.coop_snap('{"name":"Б","worth":80000,"stats":{"done":1,"hw":0,"earned":20000,"cities":1},"hwDone":[],"rails":[]}') \gset
-- общ участък
select t.as(:A); select (public.coop_joint('hw', 'A1-2', 'АМ Тракия: Пловдив — Стара Загора', 96) ->> 'id')::bigint as j \gset
select t.ok((public.coop_joint('hw', 'A1-2', 'x', 96) ->> 'err') = 'exists', 'същият участък не може два пъти');
select t.ok((public.coop_joint_act(:j, 'accept') ->> 'err') = 'bad_action', 'предложилият не може сам да приеме');
select t.as(:B); select t.ok((public.coop_joint_act(:j, 'accept') ->> 'ok')::boolean, 'Б приема общия участък');
select t.ok((public.coop_joint_bonus(:j) ->> 'err') = 'not_done', 'без бонус, докато не са готови и двамата');
select public.coop_snap('{"name":"Б","worth":80000,"stats":{"done":1,"hw":1,"earned":20000,"cities":1},"hwDone":["A1-2"],"rails":[]}') \gset
select t.ok((public.coop_joint_bonus(:j) ->> 'err') = 'not_done', 'само единият е готов → още няма бонус');
select t.as(:A); select public.coop_snap('{"name":"А","worth":100000,"stats":{"done":3,"hw":1,"earned":50000,"cities":1},"hwDone":["A1-2"],"rails":[]}') \gset
select t.ok((public.coop_status2() -> 'joints' -> 0 ->> 'done')::boolean, 'и двамата са готови');
select t.ok((public.coop_joint_bonus(:j) ->> 'amount')::int = 144000, 'бонус 1500 €/км × 96');
select t.ok((public.coop_joint_bonus(:j) ->> 'err') = 'claimed', 'бонусът е веднъж');
-- наем
select (public.coop_rent_offer(gen_random_uuid(), 'crane', 24, 5000) ->> 'id')::bigint as r \gset
select t.as(:B); select gen_random_uuid() as rq \gset
select t.ok((public.coop_rent_act(:'rq', :r, 'accept') ->> 'ok')::boolean, 'Б наема крана');
select t.ok((public.coop_rent_act(:'rq', :r, 'accept') ->> 'again')::boolean, 'повторената заявка не плаща втори път');
select t.ok(exists (select 1 from jsonb_array_elements(public.coop_status() -> 'inbox') x where x ->> 'kind' = 'unit' and x -> 'data' ->> 'type' = 'crane'), 'кранът идва при Б');
select t.as(:A); select t.ok(exists (select 1 from jsonb_array_elements(public.coop_status() -> 'inbox') x where x ->> 'kind' = 'rent' and (x -> 'data' ->> 'amount')::int = 5000), 'А получава наема');
select t.as(:B); select t.ok((public.coop_rent_act(gen_random_uuid(), :r, 'return') ->> 'ok')::boolean, 'Б връща крана');
select t.as(:A); select t.ok(exists (select 1 from jsonb_array_elements(public.coop_status() -> 'inbox') x where x ->> 'kind' = 'unit' and x ->> 'note' = 'Върната от наем'), 'кранът се връща при А');
-- задачи
select t.ok(jsonb_array_length(public.coop_status2() -> 'quests') = 3, '3 общи задачи');
select t.ok((select bool_and((public.coop_quest_claim((q ->> 'id')::bigint) ->> 'err') = 'not_done') from jsonb_array_elements(public.coop_status2() -> 'quests') q), 'неизпълнени задачи → без награда');
select t.su(); delete from coop.quests; select t.as(:A);
select public.coop_status2() \gset
select (q ->> 'id')::bigint as qh from jsonb_array_elements(public.coop_status2() -> 'quests') q limit 1 \gset
select q ->> 'key' as qk from jsonb_array_elements(public.coop_status2() -> 'quests') q where (q ->> 'id')::bigint = :qh \gset
select t.su(); update coop.snaps set data = jsonb_set(data, '{stats}', '{"done":1000,"hw":1000,"earned":1e9,"cities":1000}') ;
insert into coop.parcels (pair_id, from_u, to_u, kind, data) select p.id, p.a, p.b, 'gift', '{"amount":1}' from coop.pairs p, generate_series(1, 10) where p.status = 'active';
select t.as(:A);
select t.ok((public.coop_quest_claim(:qh) ->> 'reward')::int > 0, 'изпълнена задача → награда за А');
select t.ok((public.coop_quest_claim(:qh) ->> 'err') = 'claimed', 'наградата е веднъж');
select t.as(:B); select t.ok((public.coop_quest_claim(:qh) ->> 'reward')::int > 0, 'и Б взема награда');
-- касичка
select t.as(:A); select t.ok((public.coop_vault(gen_random_uuid(), 30000) ->> 'balance')::int = 30000, 'А внася 30 000');
select t.as(:B); select t.ok((public.coop_vault(gen_random_uuid(), -50000) ->> 'err') = 'no_money', 'не може да изтегли повече от наличното');
select t.ok((public.coop_vault(gen_random_uuid(), -10000) ->> 'balance')::int = 20000, 'Б тегли 10 000');
select t.ok(exists (select 1 from jsonb_array_elements(public.coop_status() -> 'inbox') x where x ->> 'kind' = 'vault' and (x -> 'data' ->> 'amount')::int = 10000), 'парите идват при Б');
select public.coop_vault_name('Тандем Т&А') \gset
select t.ok(exists (select 1 from jsonb_array_elements(public.coop_status2() -> 'tandems') x where x ->> 'name' = 'Тандем Т&А' and (x ->> 'me')::boolean), 'тандемът е в класацията');
-- чат и 🆘
select t.ok((public.coop_say('Трябва ми кран!', true) ->> 'ok')::boolean, 'Б праща 🆘');
select t.as(:A); select t.ok((select (m ->> 'sos')::boolean and not (m ->> 'me')::boolean from jsonb_array_elements(public.coop_status2() -> 'messages') m order by (m ->> 'id')::int desc limit 1), 'А вижда 🆘');
-- изненада
select (public.coop_surprise(gen_random_uuid(), 'plovdiv', 8, 16, 'Честито!', 2500) ->> 'id')::bigint as s \gset
select t.as(:B); select t.ok(jsonb_array_length(public.coop_status2() -> 'surprises_for_me') = 1, 'Б има изненада в Пловдив');
select t.ok((public.coop_surprise_find(:s) ->> 'amount')::int = 2500, 'Б намира 2500 €');
select t.ok((public.coop_surprise_find(:s) ->> 'err') = 'gone', 'само веднъж');
select t.as(:C); select t.ok((public.coop_status2() ->> 'active')::boolean = false, 'чужд не вижда нищо');
select 'STAGE COOP2 PASSED';
