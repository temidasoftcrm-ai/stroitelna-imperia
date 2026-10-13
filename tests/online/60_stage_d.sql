-- Етап Г: класация и профили — данните идват от сървърното състояние; формулата е точна; без достъп извън света
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select id as w from online.worlds where slug = 'tender-1' \gset
select id as wp from online.worlds where slug = 'pilot-1' \gset
select id as other from online.companies where world_id <> :w limit 1 \gset
-- стойността на всяка фирма = наличност + депозити + техника/2 + материали в ход (пресметнато независимо)
select t.ok(bool_and((online.value_parts(c) ->> 'value')::bigint =
    c.cash + c.held + (select coalesce(sum(u.n * ut.cost / 2), 0) from online.units u join online.unit_types ut using (type) where u.company_id = c.id)
    + (select coalesce(sum(mat), 0) from online.builds b where b.company_id = c.id and b.status = 'running')), 'стойността следва прозрачната формула')
  from online.companies c;
-- печалбата не брои началния капитал, тестовите пари, покупката на техника и депозитите
select t.ok(online.profit(c, 1000) = (select coalesce(sum(amount), 0) from online.ledger where company_id = c.id and reason in ('строеж', 'търг', 'материали', 'поддръжка', 'продажба', 'стоки', 'енергия', 'гориво', 'дивидент', 'концесия'))
    - (select coalesce(sum(k.deposit), 0) from online.contracts k where k.company_id = c.id and k.status = 'failed'), 'печалбата: приходи − разходи − задържани депозити (по прозрачната формула)')
  from online.companies c where c.name = 'Т-Б';
select t.ok(online.profit(c, 1000) < 0, 'Б има загуба (провален договор и поддръжка, без приходи)') from online.companies c where c.name = 'Т-Б';
-- отрицателната наличност намалява стойността
update online.companies set cash = -100000 where name = 'В Админ';
select t.ok((online.value_parts(c) ->> 'value')::bigint = -100000 + c.held + (online.value_parts(c) ->> 'units')::bigint + (online.value_parts(c) ->> 'wip')::bigint, 'отрицателната наличност е задължение в стойността') from online.companies c where c.name = 'В Админ';
update online.companies c set cash = (select sum(amount) from online.ledger where company_id = c.id) where name = 'В Админ';
-- класацията: всички фирми в света, подредени по стойност; „me“ само за моята
select t.as(:A);
select public.ol_ranking(:w) as r \gset
select t.ok((:'r'::jsonb ->> 'ok')::boolean and jsonb_array_length(:'r'::jsonb -> 'rows') = 3, 'класацията има трите фирми');
select t.ok((select bool_and((a ->> 'value')::bigint >= (b ->> 'value')::bigint) from jsonb_array_elements(:'r'::jsonb -> 'rows') with ordinality x(a, i) join jsonb_array_elements(:'r'::jsonb -> 'rows') with ordinality y(b, j) on j = i + 1), 'подредени по стойност');
select t.ok((select count(*) from jsonb_array_elements(:'r'::jsonb -> 'rows') x where (x ->> 'me')::boolean) = 1 and (select x ->> 'name' from jsonb_array_elements(:'r'::jsonb -> 'rows') x where (x ->> 'me')::boolean) = 'Т-А', 'само моята фирма е отбелязана');
select t.ok((select string_agg(x ->> 'rank', ',') from jsonb_array_elements(:'r'::jsonb -> 'rows') x) = '1,2,3', 'местата са 1, 2, 3');
select t.ok((select bool_and((a ->> 'profit7')::bigint >= (b ->> 'profit7')::bigint) from jsonb_array_elements(public.ol_ranking(:w, 'profit') -> 'rows') with ordinality x(a, i) join jsonb_array_elements(public.ol_ranking(:w, 'profit') -> 'rows') with ordinality y(b, j) on j = i + 1), 'подредба по печалба');
select t.ok((select x ->> 'name' from jsonb_array_elements(public.ol_ranking(:w, 'contracts') -> 'rows') x limit 1) = 'Т-А', 'по изпълнени договори първа е А');
select t.ok(position('cash' in (public.ol_ranking(:w) -> 'rows')::text) = 0 and position('user_id' in (public.ol_ranking(:w))::text) = 0, 'в класацията няма лични данни');
-- профил на чужда фирма
select (select (x ->> 'id')::bigint from jsonb_array_elements(:'r'::jsonb -> 'rows') x where x ->> 'name' = 'Т-Б') as bid \gset
select public.ol_company(:w, :bid) as p \gset
select t.ok((:'p'::jsonb -> 'company' ->> 'name') = 'Т-Б' and (:'p'::jsonb -> 'company' ->> 'contracts_failed')::int >= 1, 'профилът на Б показва провалените договори');
select t.ok(jsonb_array_length(:'p'::jsonb -> 'won') >= 1, 'профилът показва спечелените търгове');
select t.ok(position('user_id' in :'p') = 0 and position('email' in :'p') = 0, 'профилът е без лични данни');
select t.ok((public.ol_company(:w, 999999) ->> 'err') = 'no_company', 'несъществуваща фирма');
-- фирма от друг свят не се показва през този свят
select t.ok((public.ol_company(:w, :other) ->> 'err') = 'no_company', 'фирма от друг свят — не');
-- без достъп до частния свят няма класация
select t.su(); insert into auth.users values ('44444444-4444-4444-4444-444444444444', 'out@test') on conflict do nothing;
select t.as('44444444-4444-4444-4444-444444444444');
select t.ok((public.ol_ranking(:wp) ->> 'err') = 'no_access', 'външен акаунт не вижда класацията на частен свят');
select t.ok((public.ol_company(:wp, 1) ->> 'err') = 'no_access', 'външен акаунт не вижда профили в частен свят');
select t.su();
select t.ok(t.balanced(), 'журнал = наличност');
select 'STAGE D: ALL PASSED' as result;
