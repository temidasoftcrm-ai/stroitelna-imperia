-- ⚙️ Настройки: изтриване на записите и на акаунта
\set ON_ERROR_STOP 1
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
select t.su(); delete from coop.pairs; delete from coop.snaps;
create table if not exists public.saves (user_id uuid, slot text, data jsonb, primary key (user_id, slot));
insert into public.saves values (:A, 's1', '{}'), (:A, 's2', '{}'), (:B, 's1', '{}');
select t.as(:A); select t.ok((public.delete_my_data() ->> 'saves')::int = 2, 'А трие своите 2 записа');
select t.su(); select t.ok((select count(*) from public.saves) = 1 and exists (select 1 from auth.users where id = :A), 'записът на Б остава, акаунтът на А — също');
select t.as(:A); select public.coop_create() ->> 'code' as code \gset
select t.as(:B); select public.coop_join(:'code') \gset
select t.as(:A); select t.ok((public.delete_my_data(true) ->> 'account')::boolean, 'А трие акаунта');
select t.su(); select t.ok(not exists (select 1 from auth.users where id = :A), 'акаунтът на А го няма');
select t.ok(exists (select 1 from auth.users where id = :B) and (select count(*) from public.saves) = 1, 'Б и записът му са непокътнати');
select t.ok(not exists (select 1 from coop.pairs), 'двойката изчезна заедно с А');
select t.as(:B); select t.ok(coalesce((public.coop_status() -> 'pair') is null or (public.coop_status() -> 'pair') = 'null'::jsonb, true), 'Б вече няма партньор');
select t.su(); drop table public.saves; insert into auth.users values (:A, 'a@test') on conflict do nothing;   -- следващите тестове ползват А
select 'STAGE ACCOUNT PASSED';
