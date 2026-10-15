-- „Изтрий данните“ трие всичко в облака: записи, онлайн фирма (с всичко нейно), членство, партньорство; другите остават
\set ON_ERROR_STOP 1
\set D '''44444444-4444-4444-4444-444444444444'''
\set E '''55555555-5555-5555-5555-555555555555'''
select t.su(); insert into auth.users values (:D, 'd@test'), (:E, 'e@test') on conflict do nothing;
create table if not exists public.saves (user_id uuid, slot text, data jsonb, primary key (user_id, slot));
insert into public.saves values (:D, 's1', '{}'), (:E, 's1', '{}');
select min(id) as w from online.worlds \gset
insert into online.members (world_id, user_id) values (:w, :D), (:w, :E);
insert into online.companies (world_id, user_id, name, brand, city, cash) values (:w, :D, 'Д Строй тест', 'titan', 'sofia', 100000), (:w, :E, 'Е Строй тест', 'atlas', 'varna', 100000);
select t.units(t.co('Д Строй тест'), 'crew', 3);
insert into online.requests (user_id, req_id, fn) values (:D, gen_random_uuid(), 'тест');
select count(*) as before_all from online.companies \gset
select t.as(:D); select public.coop_create() ->> 'code' as code \gset
select t.as(:E); select public.coop_join(:'code') \gset
select t.as(:D); select public.delete_my_data() as r \gset
select t.ok((:'r'::jsonb ->> 'companies')::int = 1 and (:'r'::jsonb ->> 'saves')::int = 1, 'Д трие запис и фирма');
select t.su();
select t.ok(not exists (select 1 from online.companies where user_id = :D) and not exists (select 1 from online.units u join online.companies c on c.id = u.company_id where c.user_id = :D), 'фирмата на Д и техниката ѝ ги няма');
select t.ok(not exists (select 1 from online.members where user_id = :D) and not exists (select 1 from online.requests where user_id = :D), 'членството и заявките на Д ги няма');
select t.ok((select count(*) from online.companies) = :before_all - 1 and exists (select 1 from online.companies where user_id = :E), 'фирмата на Е остава');
select t.ok(not exists (select 1 from coop.pairs where a = :D or b = :D), 'Д вече не е в партньорство');
select t.ok(exists (select 1 from coop.pairs where a = :E and b is null and status = 'ended'), 'двойката (с историята си) остава за партньора Е');
select t.ok(exists (select 1 from auth.users where id = :D) and exists (select 1 from public.saves where user_id = :E), 'акаунтът на Д остава, записът на Е — също');
select t.as(:D); select t.ok((public.delete_my_data(true) ->> 'account')::boolean, 'Д трие и акаунта');
select t.su(); select t.ok(not exists (select 1 from auth.users where id = :D), 'акаунтът на Д го няма');
select t.ok(exists (select 1 from coop.pairs where a = :E), 'и след изтрития акаунт на Д двойката на Е е там');
delete from coop.pairs where a = :E; delete from online.companies where user_id = :E; delete from online.members where user_id = :E; delete from public.saves where user_id = :E;
select 'STAGE ACCOUNT2 PASSED';
