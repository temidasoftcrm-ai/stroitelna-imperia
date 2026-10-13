-- Етап Д: пауза (часовникът спира, сроковете се местят), изгонване, настройки, журнал, админ права
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select id as w from online.worlds where slug = 'tender-1' \gset
-- играч няма достъп до админ функциите
select t.as(:A);
select t.ok((public.ol_admin_status(:w, 'paused') ->> 'err') = 'forbidden', 'играч не може да спре света');
select t.ok((public.ol_admin_ban(:w, 1, true) ->> 'err') = 'forbidden', 'играч не може да изгонва');
select t.ok((public.ol_admin_overview(:w) ->> 'err') = 'forbidden', 'играч не вижда админ прегледа');
select t.ok((public.ol_admin_cfg(:w, '{"max_contracts": 99}') ->> 'err') = 'forbidden', 'играч не променя настройки');
-- А започва строеж; админът спира света
select t.su(); select t.fund(t.co('Т-А'), 10000000); select online.tick() \gset
select t.as(:A);
select (public.ol_state(:w) -> 'offers' -> 0 ->> 'id')::bigint as o \gset
select t.ok((public.ol_start_build(gen_random_uuid(), :w, :o) ->> 'ok')::boolean, 'А започва строеж');
select t.su(); select id as bld, end_at as e0 from online.builds where offer_id = :o \gset
select (select online.wday(w) from online.worlds w where id = :w) as d0 \gset
select t.as(:ADM);
select t.ok((public.ol_admin_status(:w, 'paused') ->> 'ok')::boolean, 'админът спира света');
select t.su();
-- паузата трае 3 s реално време
select pg_sleep(3);
select t.ok((select online.wday(w) from online.worlds w where id = :w) <= :d0, 'по време на пауза денят не върви');
select online.tick() \gset
select t.ok((select status from online.builds where id = :bld) = 'running', 'по време на пауза строежът не завършва');
select t.as(:A);
select t.ok((public.ol_buy_unit(gen_random_uuid(), :w, 'crew', 1) ->> 'err') = 'no_company', 'по време на пауза действията са спрени');
select t.as(:ADM);
select t.ok((public.ol_admin_status(:w, 'open') ->> 'ok')::boolean, 'админът пуска света');
select t.su();
select t.ok((select online.wday(w) from online.worlds w where id = :w) = :d0, 'след паузата денят продължава оттам, докъдето беше');
select t.ok((select end_at from online.builds where id = :bld) > :'e0'::timestamptz + interval '2.9 seconds', 'срокът на строежа е преместен с продължителността на паузата');
select t.ok((select count(*) from online.tenders tt join online.worlds ww on ww.id = tt.world_id where tt.world_id = :w and tt.status = 'open' and tt.closes_at <= online.wnow(ww)) = 0, 'отворените търгове не са изтекли заради паузата');
-- изгонване: офертите се оттеглят, депозитът се връща, действията са спрени; връщане
select t.su();
select id as tb, budget as bb from online.tenders where world_id = :w and tier = 'local' and status = 'open' and not exists (select 1 from online.bids where tender_id = online.tenders.id and company_id = t.co('Т-Б')) and (need ->> 'crane') is null order by id limit 1 \gset
select t.as(:B); select public.ol_bid(gen_random_uuid(), :w, :tb, :bb) as rb \gset
select t.ok((:'rb'::jsonb ->> 'ok')::boolean, 'Б подава оферта');
select t.su(); select held as h0, id as bco from online.companies where name = 'Т-Б' \gset
select t.as(:ADM);
select t.ok((public.ol_admin_ban(:w, :bco, true) ->> 'ok')::boolean, 'админът изгонва Б');
select t.su();
select t.ok((select held from online.companies where name = 'Т-Б') = :h0 - (select deposit from online.tenders where id = :tb) and (select status from online.bids where tender_id = :tb and company_id = t.co('Т-Б')) = 'withdrawn', 'офертата на Б е оттеглена и депозитът е върнат');
select t.as(:B);
select t.ok((public.ol_state(:w) ->> 'err') = 'no_access', 'изгоненият не вижда и не действа в света');
select t.ok((select (x ->> 'banned')::boolean from jsonb_array_elements(public.ol_worlds() -> 'worlds') x where (x ->> 'id')::int = :w) is not false, 'списъкът със светове не дава вход');
select t.as(:ADM); select public.ol_admin_ban(:w, :bco, false) \gset
select t.as(:B);
select t.ok((public.ol_state(:w) ->> 'ok')::boolean, 'след връщане Б пак играе');
-- настройки: само познати ключове
select t.as(:ADM);
select t.ok((public.ol_admin_cfg(:w, '{"max_contracts": 3, "idle_days": 5}') ->> 'ok')::boolean, 'админът сменя настройки');
select t.ok((public.ol_admin_cfg(:w, '{"start_cash": 999999999}') ->> 'err') = 'bad_cfg', 'непозната настройка — отказ');
select t.ok((public.ol_admin_cfg(:w, '{"max_contracts": "x"}') ->> 'err') = 'bad_cfg', 'нечислова стойност — отказ');
-- журнал и преглед
select public.ol_admin_overview(:w) as ov \gset
select t.ok(jsonb_array_length(:'ov'::jsonb -> 'companies') = 3 and (:'ov'::jsonb -> 'companies' -> 0 ->> 'email') is not null, 'прегледът показва фирмите с имейл (само за админ)');
select t.ok((select count(*) from jsonb_array_elements(:'ov'::jsonb -> 'events') e where e ->> 'kind' in ('status', 'ban', 'unban', 'cfg', 'build_start', 'bid', 'units', 'tender_awarded')) >= 6, 'журналът записва действията');
select t.ok((public.ol_worlds() ->> 'admin')::boolean, 'ol_worlds казва, че е админ');
select t.su();
select t.ok(t.balanced(), 'журнал = наличност');
select 'STAGE E: ALL PASSED' as result;
