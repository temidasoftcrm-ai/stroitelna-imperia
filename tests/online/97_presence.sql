-- Кой е онлайн: активните през последните 40 s, без изгонените; списъкът е само за играчите в света
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select t.as(:ADM);
select (public.ol_admin_world('pr-1', 'Онлайн', true, 600, '{}', true) ->> 'world')::int as w \gset
select public.ol_admin_invite(:w, 5, 7) ->> 'code' as code \gset
select t.as(:A); select public.ol_join(gen_random_uuid(), :'code') \gset
select public.ol_create_company(gen_random_uuid(), :w, 'Он-А', 'titan', 'sofia') \gset
select t.as(:B); select public.ol_join(gen_random_uuid(), :'code') \gset
select public.ol_create_company(gen_random_uuid(), :w, 'Он-Б', 'atlas', 'varna') \gset
select public.ol_state(:w) \gset
select t.as(:A);
select t.ok((select count(*) from jsonb_array_elements(public.ol_state(:w) -> 'online')) = 2, 'и двете фирми са онлайн');
select t.ok((public.ol_state(:w) -> 'online' -> 0 ->> 'me')::boolean and (public.ol_state(:w) -> 'online' -> 0 ->> 'name') = 'Он-А', 'аз съм първи в списъка');
select t.su(); update online.companies set last_active = now() - interval '2 minutes' where name = 'Он-Б';
select t.as(:A);
select t.ok((select count(*) from jsonb_array_elements(public.ol_state(:w) -> 'online')) = 1, 'неактивен от 2 мин → не е онлайн');
select t.as(:B); select public.ol_state(:w) \gset
select t.as(:A);
select t.ok((select count(*) from jsonb_array_elements(public.ol_state(:w) -> 'online')) = 2, 'Б се върна → пак онлайн');
select t.su(); select id as cbb from online.companies where name = 'Он-Б' \gset
select t.as(:ADM); select public.ol_admin_ban(:w, :cbb, true) \gset
select t.su(); update online.companies set last_active = now() where name = 'Он-Б';
select t.as(:A);
select t.ok(not exists (select 1 from jsonb_array_elements(public.ol_state(:w) -> 'online') x where x ->> 'name' = 'Он-Б'), 'изгонените не се показват');
select t.as('44444444-4444-4444-4444-444444444444');
select t.ok((public.ol_state(:w) ->> 'err') = 'no_access', 'външен не вижда кой е онлайн в частен свят');
select 'STAGE PRESENCE PASSED';
