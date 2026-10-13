-- Версия 2: сезони — автоматичен старт, записване (и на новите фирми), дивизии, ръст на стойността, край, трофеи, архив
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select t.as(:ADM);
select (public.ol_admin_world('season-1', 'Сезони', false, 600, '{"season_days":10}', true) ->> 'world')::int as w \gset
select public.ol_create_company(gen_random_uuid(), :w, 'С-В', 'imperial', 'ruse') \gset
select t.as(:A); select public.ol_create_company(gen_random_uuid(), :w, 'С-А', 'titan', 'sofia') \gset
select t.su();
select id as ca from online.companies where name = 'С-А' \gset
select id as cv from online.companies where name = 'С-В' \gset
update online.companies set xp = 40000 where id = :cv;   -- ниво 6 → Професионалисти
select online.tick() \gset
select t.ok((select count(*) from online.seasons where world_id = :w and status = 'active' and n = 1) = 1, 'сезон 1 започва сам');
select t.ok((select division from online.season_entries e join online.seasons s on s.id = e.season_id where s.world_id = :w and company_id = :ca) = 'novice', 'А (ниво 1) е при Новаците');
select t.ok((select division from online.season_entries e join online.seasons s on s.id = e.season_id where s.world_id = :w and company_id = :cv) = 'pro', 'В (ниво 6) е при Професионалистите');
-- Б влиза по-късно: основата му е стойността при влизане
select t.fund(:ca, 5000000);    -- А расте с 50 000 €
update online.worlds set shift_s = shift_s + 600 * 3 where id = :w;
select t.as(:B); select public.ol_create_company(gen_random_uuid(), :w, 'С-Б', 'atlas', 'varna') \gset
select (public.ol_season(:w) -> 'season' ->> 'my_division') as bd \gset
select t.ok(:'bd' = 'novice', 'новата фирма Б влиза в текущия сезон, в Новаци');
select t.su(); select id as cb from online.companies where name = 'С-Б' \gset
select t.ok((select baseline from online.season_entries e join online.seasons s on s.id = e.season_id where s.world_id = :w and company_id = :cb) = online.cvalue(:cb), 'основата на Б е стойността ѝ при влизане (резултат 0)');
select t.fund(:cb, 1000000);   -- Б расте с 10 000 €
-- нивото по време на сезона не сменя дивизията
update online.companies set xp = 2000000 where id = :ca;
select t.as(:A);
select public.ol_season(:w) as s \gset
select t.ok((:'s'::jsonb -> 'season' ->> 'my_division') = 'novice', 'А остава в дивизията си, дори да вдигне ниво');
select t.ok((select x ->> 'name' from jsonb_array_elements(:'s'::jsonb -> 'season' -> 'divisions' -> 'novice') x limit 1) = 'С-А', 'А води Новаците (ръст 50 000 € срещу 10 000 €)');
select t.ok(position('baseline' in :'s') = 0 and position('email' in :'s') = 0, 'в класирането няма лични данни');
-- край: класирането се замразява, трофеи, архив, нов сезон
select t.su(); update online.worlds set shift_s = shift_s + 600 * 8 where id = :w;
select online.tick() \gset
select online.tick() \gset
select t.ok((select status from online.seasons where world_id = :w and n = 1) = 'ended', 'сезон 1 приключи');
select t.ok((select count(*) from online.seasons where world_id = :w and n = 2 and status = 'active') = 1, 'сезон 2 започна сам');
select t.ok((select rank from online.season_entries e join online.seasons s on s.id = e.season_id where s.world_id = :w and s.n = 1 and company_id = :ca) = 1, 'А е първа при Новаците');
select t.ok((select score from online.season_entries e join online.seasons s on s.id = e.season_id where s.world_id = :w and s.n = 1 and company_id = :cb) = (select final_value - baseline from online.season_entries e join online.seasons s on s.id = e.season_id where s.world_id = :w and s.n = 1 and company_id = :cb), 'резултатът е замразен: крайна стойност − основа');
select t.ok(exists (select 1 from online.notes where company_id = :ca and title like '🥇 Сезон 1%'), 'А получава известие „🥇 Сезон 1“');
select t.ok((select division from online.season_entries e join online.seasons s on s.id = e.season_id where s.world_id = :w and s.n = 2 and company_id = :ca) = 'tycoon', 'в сезон 2 А е с новото си ниво → Магнати');
select t.as(:B);
select t.ok(jsonb_array_length(public.ol_season(:w) -> 'archive') = 1, 'архивът пази сезон 1');
select t.ok((select count(*) from jsonb_array_elements(public.ol_trophies(:w, :ca) -> 'trophies')) = 1, 'трофеят се вижда в профила на А');
-- админ приключва сезона веднага; играч не може
select t.ok((public.ol_admin_season_end(:w) ->> 'err') = 'forbidden', 'играч не може да приключи сезон');
select t.as(:ADM);
select t.ok((public.ol_admin_season_end(:w) ->> 'ok')::boolean, 'админът приключва сезон 2');
select t.ok((public.ol_admin_cfg(:w, '{"season_days": 20}') ->> 'ok')::boolean, 'дължината на сезона се настройва');
select t.su(); select online.tick() \gset
select t.ok((select ends_at - starts_at from online.seasons where world_id = :w and n = 3) = interval '12000 seconds', 'сезон 3 е с новата дължина (20 дни)');
select t.ok(t.balanced(), 'журнал = наличност');
select 'SEASONS: ALL PASSED' as result;
