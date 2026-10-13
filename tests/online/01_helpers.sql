-- помощни функции за тестовете (само локално)
create schema if not exists t;
grant usage on schema t to public;
create or replace function t.ok(cond boolean, msg text) returns text language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', msg; end if; return 'ok: ' || msg; end $$;
create or replace function t.as(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u, ''), false); perform set_config('role', case when u is null then 'anon' else 'authenticated' end, false); end $$;
create or replace function t.su() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', false); perform set_config('request.jwt.claim.sub', '', false); end $$;
grant execute on all functions in schema t to public;
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@test'), ('22222222-2222-2222-2222-222222222222', 'b@test'), ('33333333-3333-3333-3333-333333333333', 'adm@test') on conflict do nothing;
insert into online.admins values ('33333333-3333-3333-3333-333333333333') on conflict do nothing;
-- пари и техника за тестовете (през журнала, за да остане журнал = наличност)
create or replace function t.fund(p_company bigint, p_cents bigint) returns void language sql as
  $$ select online.money(p_company, p_cents, 'тест', 'пари за теста', null, true) $$;
create or replace function t.units(p_company bigint, p_type text, p_n int) returns void language sql as
  $$ insert into online.units values (p_company, p_type, p_n) on conflict (company_id, type) do update set n = p_n $$;
create or replace function t.co(p_name text) returns bigint language sql as $$ select id from online.companies where name = p_name $$;
create or replace function t.balanced() returns boolean language sql as
  $$ select bool_and((select coalesce(sum(amount), 0) from online.ledger where company_id = c.id) = c.cash) from online.companies c $$;
