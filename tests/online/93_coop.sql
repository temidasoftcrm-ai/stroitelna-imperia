-- Партньорство в самостоятелната игра: код, пратки веднъж, заем (приемане/отказ/връщане), обща поръчка, права
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set C '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from coop.pairs;
select t.as(:A);
select t.ok((public.coop_status() -> 'pair') = 'null'::jsonb, 'в началото няма партньор');
select public.coop_create() ->> 'code' as code \gset
select t.ok(length(:'code') = 6, 'код от 6 знака');
select t.ok((public.coop_create() ->> 'code') = :'code', 'повторно — същият код');
select t.ok((public.coop_join(:'code') ->> 'err') = 'own_code', 'не може със собствения код');
select t.ok((public.coop_send(gen_random_uuid(), 'gift', '{"amount": 100}') ->> 'err') = 'no_partner', 'без партньор — без пратки');
select t.as(:B);
select t.ok((public.coop_join('XXXXXX') ->> 'err') = 'bad_code', 'грешен код');
select t.ok((public.coop_join(lower(:'code')) ->> 'ok')::boolean, 'Б се свързва с кода (малки букви също)');
select t.as(:C);
select t.ok((public.coop_join(:'code') ->> 'err') = 'bad_code', 'кодът е използван — трети не може');
-- снимка и онлайн
select t.as(:B); select public.coop_snap('{"name": "Б", "money": 5000, "cities": ["varna"]}') \gset
select t.as(:A);
select t.ok((public.coop_status() -> 'partner' ->> 'online')::boolean and (public.coop_status() -> 'partner' -> 'snap' ->> 'name') = 'Б', 'А вижда Б онлайн и снимката му');
-- подарък: веднъж изпратен, веднъж получен
select gen_random_uuid() as rq \gset
select (public.coop_send(:'rq', 'gift', '{"amount": 5000}') ->> 'id')::bigint as g1 \gset
select t.ok((public.coop_send(:'rq', 'gift', '{"amount": 5000}') ->> 'id')::bigint = :g1, 'повторената заявка не праща втори път');
select t.ok((public.coop_send(gen_random_uuid(), 'gift', '{"amount": -5}') ->> 'err') = 'bad_data', 'отрицателна сума → отказ');
select t.ok((public.coop_send(gen_random_uuid(), 'unit', '{"type": "crane"}') ->> 'ok')::boolean, 'праща кран');
select t.ok((public.coop_send(gen_random_uuid(), 'mat', '{"mat": "cement", "qty": 20}') ->> 'ok')::boolean, 'праща материали');
select t.ok((public.coop_claim(:g1) ->> 'err') = 'gone', 'изпращачът не може да вземе своята пратка');
select t.as(:B);
select t.ok(jsonb_array_length(public.coop_status() -> 'inbox') = 3, 'Б има 3 пратки');
select t.ok((public.coop_claim(:g1) -> 'data' ->> 'amount')::int = 5000, 'Б получава 5000');
select t.ok((public.coop_claim(:g1) ->> 'err') = 'gone', 'втори път не може');
select t.as(:C); select t.ok((public.coop_status() -> 'pair') = 'null'::jsonb, 'чужд не вижда нищо');
-- заем: предложение → отказ → парите се връщат на А
select t.as(:A); select (public.coop_loan(gen_random_uuid(), 10000, 24, 5) ->> 'loan')::bigint as l1 \gset
select t.as(:B); select t.ok((public.coop_loan_act(:l1, 'decline') ->> 'ok')::boolean, 'Б отказва заема');
select t.as(:A);
select t.ok(exists (select 1 from jsonb_array_elements(public.coop_status() -> 'inbox') x where x ->> 'kind' = 'refund' and (x -> 'data' ->> 'amount')::int = 10000), 'А получава парите обратно');
-- заем: приемане → пари при Б → връщане с лихва
select (public.coop_loan(gen_random_uuid(), 20000, 24, 5) ->> 'loan')::bigint as l2 \gset
select t.as(:B); select public.coop_loan_act(:l2, 'accept') \gset
select t.ok(exists (select 1 from jsonb_array_elements(public.coop_status() -> 'inbox') x where x ->> 'kind' = 'loan' and (x -> 'data' ->> 'amount')::int = 20000), 'Б получава заема');
select t.ok((public.coop_loan_act(:l2, 'accept') ->> 'err') = 'bad_action', 'втори път не може');
select gen_random_uuid() as rr \gset
select t.ok((public.coop_repay(:'rr', :l2, 25000) ->> 'paid')::int = 21000, 'Б връща 21 000 (5%), не повече');
select t.ok((public.coop_repay(:'rr', :l2, 25000) ->> 'again')::boolean, 'повторното връщане не плаща втори път');
select t.ok(exists (select 1 from jsonb_array_elements(public.coop_status() -> 'inbox') x where x ->> 'kind' = 'refund' and (x -> 'data' ->> 'amount')::int = 4000), 'надплатеното се връща на Б');
select t.su(); select t.ok((select status from coop.loans where id = :l2) = 'repaid', 'заемът е изплатен');
-- обща поръчка
select t.as(:A); select (public.coop_mega_start('bridge') ->> 'id')::bigint as m \gset
select t.ok((public.coop_mega_start('bridge') ->> 'err') = 'exists', 'втори мост не може едновременно');
select t.ok((public.coop_mega_put(gen_random_uuid(), :m, 200000) ->> 'put')::int = 200000, 'А влага 200 000');
select t.as(:B);
select t.ok((public.coop_mega_put(gen_random_uuid(), :m, 150000) ->> 'put')::int = 100000, 'Б влага — взема се само нужното (100 000)');
select t.ok(exists (select 1 from jsonb_array_elements(public.coop_status() -> 'inbox') x where (x -> 'data' ->> 'amount')::int = 50000), 'излишъкът 50 000 се връща');
select t.ok((public.coop_mega_claim(:m) ->> 'err') = 'not_done', 'преди края — без награда');
select t.su(); update coop.megas set ends_at = now() - interval '1 second' where id = :m;
select t.as(:B);
select t.ok((public.coop_mega_claim(:m) ->> 'reward')::int = 150000, 'Б получава 100 000 × 1,5');
select t.ok((public.coop_mega_claim(:m) ->> 'err') = 'claimed', 'наградата е веднъж');
select t.as(:A); select t.ok((public.coop_mega_claim(:m) ->> 'reward')::int = 300000, 'А получава 200 000 × 1,5');
-- прекратяване
select t.ok((public.coop_leave() ->> 'ok')::boolean, 'А прекратява партньорството');
select t.as(:B); select t.ok((public.coop_send(gen_random_uuid(), 'gift', '{"amount": 1}') ->> 'err') = 'no_partner', 'след края — без пратки');
select 'STAGE COOP PASSED';
