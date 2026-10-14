-- Партньорство, част 3: 40% от поръчките в холдинга, дивидент 30%, спасяване от фалит, акции на борсата, изпълнена обща поръчка
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set C '''33333333-3333-3333-3333-333333333333'''
select t.su(); delete from coop.pairs; delete from coop.snaps;
select t.as(:A); select public.coop_create() ->> 'code' as code \gset
select t.as(:B); select public.coop_join(:'code') \gset
-- 40% от поръчка → холдинга
select t.as(:A); select gen_random_uuid() as r1 \gset
select t.ok((public.coop_vault2(:'r1', 10000, 'order') ->> 'balance')::int = 10000, 'А: 40% от поръчка → касичката');
select t.ok((public.coop_vault2(:'r1', 10000, 'order') ->> 'again')::boolean, 'същата заявка — веднъж');
select t.ok((public.coop_vault2(gen_random_uuid(), -5, 'order') ->> 'err') = 'bad_amount', 'поръчката само внася');
select t.ok((public.coop_vault2(gen_random_uuid(), 5, 'xx') ->> 'err') = 'bad_kind', 'непознат вид');
select t.ok((public.coop_status3() ->> 'month_profit')::int = 10000, 'печалба за месеца 10 000');
-- дивидент: първия път чака 30 мин, после 30% по равно
select t.ok((public.coop_dividend() ->> 'wait')::boolean, 'дивидент: твърде рано');
select t.su(); update coop.vaults set last_div_at = now() - interval '1 hour';
select t.as(:A); select t.ok((public.coop_dividend() ->> 'each')::int = 1500, 'дивидент: 30% от 10 000 → по 1500 на двамата');
select t.su(); select t.ok((select count(*) from coop.parcels where kind = 'vault' and note like '%Дивидент%') = 2, 'две пратки дивидент');
select t.ok((select balance from coop.vaults) = 7000, 'в касичката остават 7000');
select t.as(:B); select t.ok((public.coop_dividend() ->> 'paid')::int = 0, 'веднага втори път — нищо');
-- спасяване от фалит
select t.as(:B); select t.ok((public.coop_vault2(gen_random_uuid(), -5000, 'bailout') ->> 'amount')::int = -5000, 'Б: холдингът покрива 5000 дълг');
select t.ok((public.coop_vault2(gen_random_uuid(), -100000, 'bailout') ->> 'amount')::int = -2000, 'покрива колкото има (2000)');
select t.ok((public.coop_vault2(gen_random_uuid(), -100, 'bailout') ->> 'err') = 'no_money', 'празна касичка');
select t.ok((public.coop_vault2(gen_random_uuid(), 100, 'bailout') ->> 'err') = 'bad_amount', 'спасяването само тегли');
select t.su(); select t.ok((select count(*) from coop.messages where sos and text like '%Холдингът покри%') = 2, 'партньорът научава (🆘 в чата)');
select t.ok((select count(*) from coop.parcels where to_u = :B and note like '%покри дълга%') = 2, 'Б получава парите като пратка');
-- акции на борсата
select t.as(:A); select t.ok((public.coop_ipo('propose', 20, 24) ->> 'err') = 'small', 'IPO: нужни са 100 000 €');
select public.coop_vault2(gen_random_uuid(), 200000, 'manual') \gset
select t.ok((public.coop_ipo('propose', 40, 24) ->> 'err') = 'bad_data', 'IPO: дял до 30%');
select t.ok((public.coop_ipo('propose', 20, 24) ->> 'ok')::boolean, 'А предлага 20% за 1 ден');
select t.ok((public.coop_ipo('propose', 10, 24) ->> 'err') = 'exists', 'едно предложение наведнъж');
select t.ok((public.coop_ipo('accept') ->> 'err') = 'bad_action', 'предложилият не одобрява сам');
select t.as(:B); select t.ok((public.coop_ipo('accept') ->> 'ok')::boolean, 'Б одобрява');
select t.su(); update coop.ipos set start_at = now() - interval '12 hours', ends_at = now() + interval '12 hours';
select t.as(:A); select t.ok(abs((public.coop_status3() -> 'ipo' ->> 'raised')::int - 30000) <= 50, 'на половината срок: ~30 000 (200 000 × 20% × 1.5 / 2)');
select t.su(); update coop.ipos set ends_at = now() - interval '1 second';
select t.as(:A); select t.ok((public.coop_status3() -> 'ipo' ->> 'status') = 'done' and (public.coop_status3() ->> 'public_pct')::int = 20, 'емисията приключи: 20% публични');
select t.su(); select t.ok((select balance from coop.vaults) = 260000, 'касичката: 200 000 + 60 000 от инвеститорите');
-- дивидент с публичен дял: инвеститорите вземат 20%
select t.as(:A); select public.coop_vault2(gen_random_uuid(), 100000, 'order') \gset
select t.su(); update coop.vault_log set at = now() - interval '2 hours' where amount = 10000 and kind = 'order'; update coop.vaults set last_div_at = now() - interval '1 hour';
select t.as(:A); select public.coop_dividend() as dv \gset
select t.ok((:'dv'::jsonb ->> 'investors')::int = 6000 and (:'dv'::jsonb ->> 'each')::int = 12000, 'дивидент 30 000: инвеститори 6000, по 12 000');
-- обща голяма поръчка: печалбата се дели по равно, изпълнената остава в списъка
select (public.coop_mega_start('bridge') ->> 'id')::bigint as m \gset
select public.coop_mega_put(gen_random_uuid(), :m, 200000) \gset
select t.as(:B); select public.coop_mega_put(gen_random_uuid(), :m, 100000) \gset
select t.su(); update coop.megas set ends_at = now() - interval '1 second';
select t.as(:A); select t.ok((public.coop_mega_claim(:m) ->> 'reward')::int = 275000, 'А: 200 000 + половината от печалбата 150 000');
select t.as(:B); select t.ok((public.coop_status3() -> 'megas_done' -> 0 ->> 'mine')::int = 175000, 'Б вижда „изпълнена“ с 175 000');
select t.ok((public.coop_mega_claim(:m) ->> 'reward')::int = 175000, 'Б: 100 000 + 75 000');
select t.ok(jsonb_array_length(public.coop_status3() -> 'megas_done') = 1, 'изпълнената остава в списъка');
select t.ok((public.coop_mega_start('bridge') ->> 'ok')::boolean, 'може нова поръчка от същия вид');
select t.as(:C); select t.ok((public.coop_status3() ->> 'active')::boolean = false, 'чужд не вижда нищо');
select t.ok((public.coop_ipo('propose', 10, 24) ->> 'err') = 'no_partner', 'чужд не пуска акции');
select 'STAGE COOP3 PASSED';
