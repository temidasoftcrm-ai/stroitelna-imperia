-- Пари между съюзници: подарък и заем — само съюзници, възраст на съюза, таван, приемане, падеж/просрочие, опрощаване, сезон, стойност
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select t.as(:ADM);
select (public.ol_admin_world('am-1', 'Пари', false, 600, '{"auto_start":0}', true) ->> 'world')::int as w \gset
select public.ol_create_company(gen_random_uuid(), :w, 'П-В', 'imperial', 'ruse') \gset
select t.as(:A); select public.ol_create_company(gen_random_uuid(), :w, 'П-А', 'titan', 'sofia') \gset
select t.as(:B); select public.ol_create_company(gen_random_uuid(), :w, 'П-Б', 'atlas', 'varna') \gset
select t.su();
select id as ca from online.companies where name = 'П-А' \gset
select id as cb from online.companies where name = 'П-Б' \gset
select id as cv from online.companies where name = 'П-В' \gset
select t.fund(id, 100000000) from online.companies where world_id = :w;
-- не са съюзници → отказ
select t.as(:A);
select t.ok((public.ol_ally_gift(gen_random_uuid(), :w, :cb, 1000000) ->> 'err') = 'not_ally', 'подарък само за съюзници');
select t.ok((public.ol_ally_loan(gen_random_uuid(), :w, :cb, 1000000, 5, 2) ->> 'err') = 'not_ally', 'заем само за съюзници');
select public.ol_relation(gen_random_uuid(), :w, :cb, 'ally') \gset
select t.as(:B); select public.ol_relation(gen_random_uuid(), :w, :ca, 'ally') \gset
select t.as(:A);
select t.ok((public.ol_ally_gift(gen_random_uuid(), :w, :cb, 1000000) ->> 'err') = 'too_new', 'съюз на по-малко от 3 дни → отказ');
select t.su(); update online.alliances set since = now() - interval '1 hour' where a = least(:ca, :cb) and b = greatest(:ca, :cb);
-- таван 10% от собствената стойност (~1 000 000 € → 100 000 €)
select t.as(:A);
select t.ok((public.ol_ally_money(:w) ->> 'cap_left')::bigint between 9000000 and 11000000, 'таванът е ~10% от стойността');
select t.ok((public.ol_ally_gift(gen_random_uuid(), :w, :cb, 50000) ->> 'err') = 'bad_amount', 'под минимума 1000 € → отказ');
select t.ok((public.ol_ally_gift(gen_random_uuid(), :w, :cb, 50000000) ->> 'err') = 'cap', 'над тавана → отказ');
select t.su(); select cash as a0 from online.companies where id = :ca \gset
select cash as b0 from online.companies where id = :cb \gset
select online.cvalue(:cb) as bv0 \gset
select t.as(:A);
select gen_random_uuid() as rq \gset
select t.ok((public.ol_ally_gift(:'rq', :w, :cb, 2000000) ->> 'ok')::boolean, 'подарък 20 000 €');
select t.ok((public.ol_ally_gift(:'rq', :w, :cb, 2000000) ->> 'ok')::boolean, 'повторената заявка връща същия отговор');
select t.su();
select t.ok((select cash from online.companies where id = :ca) = :a0 - 2000000 and (select cash from online.companies where id = :cb) = :b0 + 2000000, 'подаръкът е преведен веднъж');
select t.ok((select count(*) from online.ally_transfers where kind = 'gift' and from_c = :ca) = 1, 'един запис на подаръка');
select t.ok(exists (select 1 from online.events where kind = 'ally_gift' and company_id = :ca), 'администраторът вижда подаръка');
select t.ok(online.gifts_in(:cb, now() - interval '1 day') = 2000000, 'подаръкът се брои като получен');
-- сезон: подаръкът не е ръст
select online.tick() \gset
select t.as(:B);
select t.ok((select (r ->> 'score')::bigint from jsonb_array_elements(public.ol_season(:w) -> 'season' -> 'divisions' -> 'novice') r where r ->> 'name' = 'П-Б') <= 0, 'подаръкът не вдига резултата в сезона');
-- заем: предложение → приемане
select t.as(:A);
select (public.ol_ally_loan(gen_random_uuid(), :w, :cb, 3000000, 5, 10) ->> 'id')::bigint as ln \gset
select t.su(); select t.ok((select cash from online.companies where id = :cb) = :b0 + 2000000, 'преди приемане пари не се прехвърлят');
select t.as(:ADM);
select t.ok((public.ol_ally_loan_act(gen_random_uuid(), :w, :ln, 'accept') ->> 'err') = 'no_loan', 'чужд не може да приеме заема');
select t.as(:A);
select t.ok((public.ol_ally_loan_act(gen_random_uuid(), :w, :ln, 'accept') ->> 'err') = 'bad_action', 'заемодателят не може да приеме сам');
select t.as(:B);
select t.ok((public.ol_ally_loan_act(gen_random_uuid(), :w, :ln, 'accept') ->> 'ok')::boolean, 'Б приема заема');
select t.ok((public.ol_ally_loan_act(gen_random_uuid(), :w, :ln, 'accept') ->> 'err') = 'bad_action', 'втори път не може');
select t.su();
select t.ok((select cash from online.companies where id = :cb) = :b0 + 5000000, 'заемът е при Б');
select t.ok((select owed from online.ally_transfers where id = :ln) = 3300000, 'дължи 33 000 € (10%)');
select t.ok(online.ally_net(:ca) = 3300000 and online.ally_net(:cb) = -3300000, 'вземане/задължение в стойността');
select t.ok(abs(online.cvalue(:cb) - (:bv0 + 2000000 - 300000)) < 2, 'заемът не вдига стойността на длъжника (само лихвата я сваля)');
select t.ok((public.ol_ranking_formula()) like '%съюзни заеми%', 'формулата споменава съюзните заеми');
-- частично връщане
select t.as(:B);
select t.ok((public.ol_ally_repay(gen_random_uuid(), :w, :ln, 1000000) ->> 'left')::bigint = 2300000, 'връща 10 000 €, остават 23 000 €');
-- просрочие: Б остава без пари, минават дните
select t.su(); select online.money(:cb, -(cash - 500000), 'тест', 'изравняване', null, true) from online.companies where id = :cb;
update online.ally_transfers set due_day = 0 where id = :ln;
select online.ally_tick() \gset
select t.ok((select status from online.ally_transfers where id = :ln) = 'overdue', 'непогасеният заем е просрочен');
select t.ok((select paid from online.ally_transfers where id = :ln) = 1500000, 'взети са наличните 5 000 €');
select online.ally_tick() \gset
select t.ok((select paid from online.ally_transfers where id = :ln) = 1500000, 'в същия ден не се взима втори път');
select t.as(:B);
select t.ok((public.ol_ally_gift(gen_random_uuid(), :w, :ca, 100000) ->> 'err') = 'overdue', 'с просрочен заем не може да изпраща пари');
-- опрощаване
select t.as(:A);
select t.ok((public.ol_ally_loan_act(gen_random_uuid(), :w, :ln, 'forgive') ->> 'ok')::boolean, 'А опрощава остатъка');
select t.su(); select t.ok(online.ally_net(:cb) = 0 and not online.ally_overdue(:cb), 'Б не дължи нищо');
-- изцяло изплатен заем
select t.fund(:cb, 100000000);
select t.as(:A); select (public.ol_ally_loan(gen_random_uuid(), :w, :cb, 1000000, 3, 0) ->> 'id')::bigint as ln2 \gset
select t.as(:B); select public.ol_ally_loan_act(gen_random_uuid(), :w, :ln2, 'accept') \gset
select t.su(); update online.ally_transfers set due_day = 0 where id = :ln2; select online.ally_tick() \gset
select t.ok((select status from online.ally_transfers where id = :ln2) = 'repaid', 'на падежа сървърът събира целия заем');
-- отказ и оттегляне
select t.as(:A); select (public.ol_ally_loan(gen_random_uuid(), :w, :cb, 1000000, 3, 0) ->> 'id')::bigint as ln3 \gset
select t.as(:B); select t.ok((public.ol_ally_loan_act(gen_random_uuid(), :w, :ln3, 'decline') ->> 'ok')::boolean, 'Б отказва');
select t.as(:A); select (public.ol_ally_loan(gen_random_uuid(), :w, :cb, 1000000, 3, 0) ->> 'id')::bigint as ln4 \gset
select t.ok((public.ol_ally_loan_act(gen_random_uuid(), :w, :ln4, 'cancel') ->> 'ok')::boolean, 'А оттегля предложението');
select t.ok((public.ol_ally_loan(gen_random_uuid(), :w, :cb, 1000000, 40, 0) ->> 'err') = 'bad_days', 'срок над 30 дни → отказ');
select t.ok((public.ol_ally_loan(gen_random_uuid(), :w, :cb, 1000000, 5, 11) ->> 'err') = 'bad_rate', 'лихва над 10% → отказ');
-- таванът брои и заемите: изпратено 20 000 + 30 000 + 10 000
select t.su(); select t.ok(online.ally_sent7((select c from online.companies c where id = :ca)) = 6000000, 'таванът брои подаръци и приетите заеми');
-- прекратен съюз → няма нови преводи
select t.as(:A); select public.ol_relation(gen_random_uuid(), :w, :cb, 'unally') \gset
select t.ok((public.ol_ally_gift(gen_random_uuid(), :w, :cb, 100000) ->> 'err') = 'not_ally', 'след края на съюза — без преводи');
select t.su(); select t.ok(t.balanced(), 'журнал = наличност');
select 'STAGE ALLY MONEY PASSED';
