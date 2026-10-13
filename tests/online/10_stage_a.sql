-- Етап А: вход, светове, покани, фирми, отделен прогрес, идемпотентност, достъп
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''

-- анонимен не може нищо
select t.as(null);
do $$ begin perform public.ol_worlds(); raise exception 'FAIL: anon called ol_worlds'; exception when insufficient_privilege then null; end $$;
select t.su();

-- админът прави частен тестов свят и покана; играч без админ права не може
select t.as(:ADM);
select (public.ol_admin_world('pilot-1', 'Пилот 1', true, 600, '{}', true) ->> 'world')::int as w \gset
select public.ol_admin_invite(:w, 5, 7) ->> 'code' as code \gset
select t.as(:A);
select t.ok((public.ol_admin_world('hack', 'Hack', false, 10, '{}') ->> 'err') = 'forbidden', 'играч не може да прави светове');
-- частният свят не се вижда и не се влиза без покана
select t.ok(jsonb_array_length(public.ol_worlds()) = 0, 'частният свят е скрит без покана');
select t.ok((public.ol_create_company(gen_random_uuid(), :w, 'Без покана', 'titan', 'sofia') ->> 'err') = 'no_access', 'без покана няма фирма');
select t.ok((public.ol_join(gen_random_uuid(), 'WRONG1') ->> 'err') = 'bad_invite', 'грешен код се отказва');
select t.ok((public.ol_join(gen_random_uuid(), :'code') ->> 'ok')::boolean, 'А влиза с покана');
-- А създава фирма; същият req_id два пъти → един резултат, един начален капитал
select gen_random_uuid() as rq \gset
select public.ol_create_company(:'rq', :w, 'Титан Строй', 'titan', 'sofia') as r1 \gset
select public.ol_create_company(:'rq', :w, 'Титан Строй', 'titan', 'sofia') as r2 \gset
select t.ok((:'r1'::jsonb ->> 'ok')::boolean and :'r1'::jsonb = :'r2'::jsonb, 'повторената заявка връща същия резултат');
select t.ok((public.ol_state(:w) -> 'company' ->> 'cash')::bigint = 2000000, 'начален капитал точно 20 000 € веднъж');
select t.ok((public.ol_create_company(gen_random_uuid(), :w, 'Втора фирма', 'atlas', 'varna') ->> 'err') = 'has_company', 'една фирма на акаунт в свят');
-- клиентската сума не съществува като параметър; клиентът няма пряк достъп до таблиците
do $$ begin perform 1 from online.companies; raise exception 'FAIL: direct table read'; exception when insufficient_privilege then null; end $$;
do $$ begin update online.companies set cash = 1e12; raise exception 'FAIL: direct update'; exception when insufficient_privilege then null; end $$;
do $$ begin perform online.money(1, 100000000, 'x', 'x', null); raise exception 'FAIL: internal money()'; exception when insufficient_privilege then null; end $$;
-- Б влиза със същата покана и има отделна фирма и отделен прогрес
select t.as(:B);
select t.ok((public.ol_join(gen_random_uuid(), :'code') ->> 'ok')::boolean, 'Б влиза с покана');
select t.ok((public.ol_create_company(gen_random_uuid(), :w, 'титан строй', 'atlas', 'varna') ->> 'err') = 'name_taken', 'името е уникално без значение от главните букви');
select t.ok((public.ol_create_company(gen_random_uuid(), :w, 'Атлас Билд', 'atlas', 'varna') ->> 'ok')::boolean, 'Б създава своя фирма');
select t.ok((public.ol_state(:w) -> 'company' ->> 'name') = 'Атлас Билд', 'Б вижда своята фирма, не чуждата');
select t.ok((select count(*) from jsonb_array_elements(public.ol_state(:w) -> 'ledger')) = 1, 'журналът на Б има само неговия начален капитал');
select t.ok((public.ol_create_company(gen_random_uuid(), :w, 'X', 'atlas', 'varna') ->> 'err') = 'has_company', 'Б не може втора фирма');
-- лимит на заявките
select t.su(); delete from online.rate; select t.as(:B);
do $$ declare i int; begin
  for i in 1..60 loop perform public.ol_join(gen_random_uuid(), 'NOPE00'); end loop;
  begin perform public.ol_join(gen_random_uuid(), 'NOPE00'); raise exception 'FAIL: no rate limit'; exception when sqlstate 'P0001' then if sqlerrm <> 'rate_limited' then raise; end if; end;
end $$;
select t.su();
select t.ok((select count(*) from online.companies) = 2 and (select sum(cash) from online.companies) = 4000000, 'точно две фирми с по 20 000 €');
select t.ok((select count(*) from online.ledger) = 2, 'журналът има точно две записвания');
select 'STAGE A: ALL PASSED' as result;
