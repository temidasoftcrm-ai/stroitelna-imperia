-- Версия 2: консорциуми — вноски и дялове, покани, отворено влизане, 100% → строеж, дивиденти точно веднъж,
-- край на концесията, разпадане с връщане на вноските, излизане, пауза
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select t.as(:ADM);
select (public.ol_admin_world('cons-1', 'Консорциуми', false, 600, '{}', true) ->> 'world')::int as w \gset
select public.ol_create_company(gen_random_uuid(), :w, 'К-В', 'imperial', 'ruse') \gset
select t.as(:A); select public.ol_create_company(gen_random_uuid(), :w, 'К-А', 'titan', 'sofia') \gset
select t.as(:B); select public.ol_create_company(gen_random_uuid(), :w, 'К-Б', 'atlas', 'varna') \gset
select t.su();
select id as ca from online.companies where name = 'К-А' \gset
select id as cb from online.companies where name = 'К-Б' \gset
select id as cv from online.companies where name = 'К-В' \gset
select t.fund(id, 5000000000) from online.companies where world_id = :w;
update online.companies set xp = 20000 where id in (:ca, :cv);   -- ниво 5; Б остава ниво 1
select t.as(:B);
select t.ok((public.ol_cons_found(gen_random_uuid(), :w, 'bosphorus', 40, false) ->> 'err') = 'level', 'ниво 1 не може да основе консорциум за моста');
select t.as(:A);
select t.ok((public.ol_cons_found(gen_random_uuid(), :w, 'bosphorus', 70, false) ->> 'err') = 'cannot', 'над 60% — отказ (никой не държи мнозинство над 60%)');
select t.ok((public.ol_cons_found(gen_random_uuid(), :w, 'bosphorus', 33, false) ->> 'err') = 'cannot', 'делът е през 5%');
select (public.ol_state(:w) -> 'company' ->> 'cash')::bigint as a0 \gset
select gen_random_uuid() as rq \gset
select public.ol_cons_found(:'rq', :w, 'bosphorus', 40, false) as f1 \gset
select public.ol_cons_found(:'rq', :w, 'bosphorus', 40, false) as f2 \gset
select (:'f1'::jsonb ->> 'cons')::bigint as k \gset
select t.ok((:'f1'::jsonb ->> 'ok')::boolean and :'f1'::jsonb = :'f2'::jsonb, 'А основава консорциум; повторената заявка не прави втори');
select t.ok((public.ol_state(:w) -> 'company' ->> 'cash')::bigint = :a0 - 40000000, 'вноската на А е 40% × 1 млн. € = 400 000 €');
select t.as(:ADM);
select t.ok((public.ol_cons_found(gen_random_uuid(), :w, 'bosphorus', 30, true) ->> 'err') = 'taken', 'втори консорциум за същия проект — не');
select t.ok((public.ol_cons_join(gen_random_uuid(), :w, :k, 20) ->> 'err') = 'closed', 'без покана не се влиза в затворен консорциум');
select t.ok((public.ol_cons_invite(gen_random_uuid(), :w, :k, :cb, 20) ->> 'err') = 'not_founder', 'само основателят кани');
-- А кани Б (35%) и В; Б е ниво 1 → не може; качваме Б до ниво 4
select t.as(:A);
select t.ok((public.ol_cons_invite(gen_random_uuid(), :w, :k, :cb, 35) ->> 'ok')::boolean, 'А кани Б с 35%');
select t.ok((public.ol_cons_invite(gen_random_uuid(), :w, :k, :cv, 65) ->> 'err') = 'bad_pct', 'покана над свободното — отказ');
select t.ok((public.ol_cons_invite(gen_random_uuid(), :w, :k, :cv, 25) ->> 'ok')::boolean, 'А кани В с 25%');
select t.as(:B);
select t.ok(exists (select 1 from jsonb_array_elements(public.ol_state(:w) -> 'notes') n where n ->> 'title' like '🤝 К-А предлага партньорство%'), 'Б получава „К-А предлага партньорство на твоята фирма“');
select t.ok((public.ol_cons_join(gen_random_uuid(), :w, :k, 35) ->> 'msg') like 'За „%трябва ниво 4.', 'Б (ниво 1) не може да приеме — с обяснение');
select t.su(); update online.companies set xp = 10000 where id = :cb; select t.as(:B);
select t.ok((public.ol_cons_join(gen_random_uuid(), :w, :k, 60) ->> 'pct')::int = 35, 'Б приема — делът е от поканата (35%), не какъвто поиска');
select t.ok((public.ol_cons_leave(gen_random_uuid(), :w, :k) ->> 'ok')::boolean, 'Б може да излезе преди строежа');
select t.su();
select t.ok((select cash from online.companies where id = :cb) = 5000000000 + 2000000 - (select coalesce(sum(-amount), 0) from online.ledger where company_id = :cb and reason not in ('консорциум', 'тест', 'начален капитал')) , 'вноската на Б е върната при излизането');
select t.as(:A); select public.ol_cons_invite(gen_random_uuid(), :w, :k, :cb, 35) \gset
select t.as(:B); select t.ok((public.ol_cons_join(gen_random_uuid(), :w, :k, 35) ->> 'ok')::boolean, 'Б влиза отново по нова покана');
select t.as(:ADM);
select t.ok((public.ol_cons_join(gen_random_uuid(), :w, :k, 25) ->> 'ok')::boolean, 'В приема последните 25% → 100%');
select t.su();
select t.ok((select status from online.consortia where id = :k) = 'building', 'при 100% строежът започва сам');
select t.ok((select count(*) from online.notes where title like '%строежът започна!') = 3, 'тримата получават известие');
select t.as(:B); select t.ok((public.ol_cons_leave(gen_random_uuid(), :w, :k) ->> 'err') = 'locked', 'след началото на строежа не се излиза');
-- пауза по време на строежа мести срока
select t.su(); select end_at as e0 from online.consortia where id = :k \gset
select t.as(:ADM); select public.ol_admin_status(:w, 'paused') \gset
select pg_sleep(2);
select public.ol_admin_status(:w, 'open') \gset
select t.su();
select t.ok((select end_at from online.consortia where id = :k) >= :'e0'::timestamptz + interval '1.9 seconds', 'паузата мести и срока на мегапроекта');
-- 20 дни строеж + 3 дни експлоатация → дивиденти за готовите дни, точно веднъж
update online.worlds set shift_s = shift_s + 600 * 23 where id = :w;
select online.tick() \gset
select online.tick() \gset
select t.ok((select status from online.consortia where id = :k) = 'operating', 'мостът е готов и работи');
select (select paid_day - online.day_of(ww, k.end_at) + 1 from online.consortia k, online.worlds ww where k.id = :k and ww.id = :w) as pd \gset
select t.ok(:pd >= 2, 'изплатени са дивиденти за готовите дни');
select t.ok((select sum(amount) from online.ledger where company_id = :ca and reason = 'дивидент') = 2700000 * 40 / 100 * :pd, 'А получава 40% от 27 000 €/ден за всеки ден — точно');
select t.ok((select sum(amount) from online.ledger where company_id = :cb and reason = 'дивидент') = 2700000 * 35 / 100 * :pd, 'Б получава 35%');
select t.ok((select count(*) from online.ledger where reason = 'дивидент') = 3, 'по едно плащане на член за периода');
select t.ok((online.value_parts(c) ->> 'stakes')::bigint between 1 and 40000000 - 1, 'дялът намалява по време на концесията') from online.companies c where c.id = :ca;
-- края на концесията: общо 60 дни × 80 000 €, после проектът се освобождава
update online.worlds set shift_s = shift_s + 600 * 70 where id = :w;
select online.tick() \gset
select online.tick() \gset
select t.ok((select status from online.consortia where id = :k) = 'expired', 'концесията изтече');
select t.ok((select sum(amount) from online.ledger where reason = 'дивидент' and company_id in (:ca, :cb, :cv)) = 2700000 * 60, 'изплатени са точно 60 дни × 27 000 € общо');
select t.as(:A);
select t.ok((public.ol_cons_found(gen_random_uuid(), :w, 'bosphorus', 50, true) ->> 'ok')::boolean, 'след концесията може нов консорциум за моста');
-- разпадане: срокът за събиране изтича → вноската се връща точно веднъж
select t.su(); select id as k2 from online.consortia where world_id = :w and status = 'forming' \gset
select cash as a1 from online.companies where id = :ca \gset
update online.worlds set shift_s = shift_s + 600 * 9 where id = :w;
select online.tick() \gset
select online.tick() \gset
select t.ok((select status from online.consortia where id = :k2) = 'dissolved', 'несъбраният консорциум се разпада');
select t.ok((select count(*) from online.ledger where company_id = :ca and ref = 'cons:' || :k2 || ':back') = 1 and (select amount from online.ledger where company_id = :ca and ref = 'cons:' || :k2 || ':back') = 50000000, 'вноската (500 000 €) е върната точно веднъж');
-- основателят се отказва → разпадане
select t.as(:ADM); select (public.ol_cons_found(gen_random_uuid(), :w, 'bosphorus', 30, true) ->> 'cons')::bigint as k3 \gset
select t.as(:A); select public.ol_cons_join(gen_random_uuid(), :w, :k3, 30) \gset
select t.as(:ADM); select t.ok((public.ol_cons_leave(gen_random_uuid(), :w, :k3) ->> 'dissolved')::boolean, 'основателят излиза → консорциумът се разпада');
select t.su();
select t.ok((select count(*) from online.ledger where ref = 'cons:' || :k3 || ':back') = 2, 'и двамата получават вноските си обратно');
select t.ok(t.balanced(), 'журнал = наличност');
select 'CONSORTIA: ALL PASSED' as result;
