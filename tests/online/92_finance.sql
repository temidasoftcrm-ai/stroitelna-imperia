-- Версия 2: финанси — заеми (лимит, лихва точно веднъж, стойността не расте), дялове (продажба, покупка, дивиденти,
-- обратно изкупуване), без чужд контрол
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set ADM '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from online.rate;
select t.as(:ADM);
select (public.ol_admin_world('fin-1', 'Финанси', false, 600, '{}', true) ->> 'world')::int as w \gset
select public.ol_create_company(gen_random_uuid(), :w, 'Ф-В', 'imperial', 'ruse') \gset
select t.as(:A); select public.ol_create_company(gen_random_uuid(), :w, 'Ф-А', 'titan', 'sofia') \gset
select t.as(:B); select public.ol_create_company(gen_random_uuid(), :w, 'Ф-Б', 'atlas', 'varna') \gset
select t.su();
select id as ca from online.companies where name = 'Ф-А' \gset
select id as cb from online.companies where name = 'Ф-Б' \gset
select t.fund(:ca, 100000000), t.fund(:cb, 50000000);
-- заем
select t.as(:A);
select public.ol_finance(:w) as f \gset
select (:'f'::jsonb ->> 'loan_limit')::bigint as lim, (public.ol_ranking(:w) -> 'rows' -> 0 ->> 'value')::bigint as v0 \gset
select t.ok(:lim = floor((:'f'::jsonb ->> 'own')::numeric * 0.4), 'лимитът е 40% от нетната стойност');
select t.ok((public.ol_loan(gen_random_uuid(), :w, :lim + 1000000) ->> 'err') = 'limit', 'над лимита — отказ');
select gen_random_uuid() as rq \gset
select public.ol_loan(:'rq', :w, 30000000) \gset
select public.ol_loan(:'rq', :w, 30000000) \gset
select t.su();
select t.ok((select debt from online.companies where id = :ca) = 30000000, 'заем 300 000 € — веднъж (повторената заявка не взима втори)');
select t.ok((online.value_parts(c) ->> 'value')::bigint = :v0, 'заемът не вдига стойността (дългът се приспада)') from online.companies c where c.id = :ca;
select t.as(:A);
select t.ok((public.ol_finance(:w) ->> 'loan_limit')::bigint < :lim, 'лимитът намалява с дълга');
-- лихва за 2 дни = 300 000 € × 0,25% × 2 = 1500 €
select t.su(); update online.worlds set shift_s = shift_s + 600 * 2 where id = :w;
select online.tick() \gset
select online.tick() \gset
select t.ok((select -sum(amount) from online.ledger where company_id = :ca and reason = 'лихва') = 150000, 'лихвата за 2 дни е точно 1500 €, веднъж');
select t.ok(online.profit(c, 7) <= -150000, 'лихвата е разход в печалбата') from online.companies c where c.id = :ca;
select t.as(:A);
select t.ok((public.ol_repay(gen_random_uuid(), :w, 10000000) ->> 'debt')::bigint = 20000000, 'частично погасяване');
select t.ok((public.ol_repay(gen_random_uuid(), :w, 999999999) ->> 'debt')::bigint = 0, 'погасяване над дълга спира на 0');
select t.ok((public.ol_repay(gen_random_uuid(), :w, 100) ->> 'err') = 'bad_amount', 'няма дълг — няма погасяване');
-- дялове
select (public.ol_finance(:w) ->> 'fair_pct')::bigint as fair \gset
select t.ok((public.ol_share_offer(gen_random_uuid(), :w, 50, :fair) ->> 'err') = 'bad_pct', 'над 49% — отказ (контролът остава)');
select t.ok((public.ol_share_offer(gen_random_uuid(), :w, 20, :fair / 3) ->> 'err') = 'bad_price', 'твърде ниска цена — отказ');
select t.ok((public.ol_share_offer(gen_random_uuid(), :w, 20, :fair) ->> 'ok')::boolean, 'А пуска 20% на справедлива цена');
select t.ok(jsonb_array_length(public.ol_finance(:w) -> 'market') = 0, 'своето предложение не е в пазара за купуване');
select t.as(:B);
select (public.ol_finance(:w) -> 'market' -> 0 ->> 'id')::bigint as so \gset
select t.ok((public.ol_buy_shares(gen_random_uuid(), :w, :so, 25) ->> 'err') = 'bad_pct', 'повече от предлаганото — отказ');
select (public.ol_state(:w) -> 'company' ->> 'cash')::bigint as b0 \gset
select t.su(); select (online.value_parts(c) ->> 'value')::bigint as va from online.companies c where c.id = :ca \gset
select t.as(:B);
select gen_random_uuid() as rs \gset
select public.ol_buy_shares(:'rs', :w, :so, 10) \gset
select public.ol_buy_shares(:'rs', :w, :so, 10) \gset
select t.ok((public.ol_state(:w) -> 'company' ->> 'cash')::bigint = :b0 - :fair * 10, 'Б плати 10% веднъж');
select t.su();
select t.ok((select pct from online.holdings where issuer = :ca and holder = :cb) = 10, 'Б държи 10% от А');
select t.ok((online.value_parts(c) ->> 'shares')::bigint > 0, 'дялът е в стойността на Б') from online.companies c where c.id = :cb;
select t.ok(abs((online.value_parts(c) ->> 'value')::bigint - :va) <= :va / 100, 'стойността на А почти не се мени (продаде 10% на справедлива цена)') from online.companies c where c.id = :ca;
-- дивидент: А има печалба 10 000 € в деня → Б получава 10% × 50% от нея
select online.money(:ca, 1000000, 'строеж', 'тестова печалба', null) \gset
select (select day from online.ledger where company_id = :ca order by id desc limit 1) as pd \gset
update online.worlds set shift_s = shift_s + 600 where id = :w;
select online.tick() \gset
select online.tick() \gset
select (select coalesce(sum(amount), 0) from online.ledger where company_id = :ca and day = :pd and reason in ('строеж', 'търг', 'материали', 'поддръжка', 'продажба', 'стоки', 'енергия', 'гориво', 'дивидент', 'концесия', 'лихва')) as dayp \gset
select t.ok((select sum(amount) from online.ledger where company_id = :cb and reason = 'дивидент') = floor(:dayp * 0.5 * 10 / 100), 'Б получи 10% × 50% от печалбата на А — точно');
select t.ok((select count(*) from online.ledger where company_id = :cb and reason = 'дивидент') = 1, 'дивидентът е изплатен веднъж');
select t.ok((select -sum(amount) from online.ledger where company_id = :ca and reason = 'изплатен дивидент') = (select sum(amount) from online.ledger where company_id = :cb and reason = 'дивидент'), 'А плати точно колкото Б получи');
-- обратно изкупуване: справедлива цена +10%
select t.as(:B); select t.ok((public.ol_buyback(gen_random_uuid(), :w, :cb) ->> 'err') = 'no_holding', 'Б не може да изкупи сам себе си в А');
select t.as(:A);
select t.ok((public.ol_buyback(gen_random_uuid(), :w, :cb) ->> 'ok')::boolean, 'А изкупува дела на Б');
select t.su();
select t.ok(not exists (select 1 from online.holdings where issuer = :ca), 'А отново е 100% своя');
select t.ok(exists (select 1 from online.notes where company_id = :cb and title like '%изкупи обратно%'), 'Б е уведомен');
select t.ok(t.balanced(), 'журнал = наличност');
select 'FINANCE: ALL PASSED' as result;
