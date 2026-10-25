-- ПРИЛОЖЕНА в Supabase 25.10.2026 (supabase db query --linked -f, без db push).
-- coop_guard — сървърна проверка на парите в партньорството (срещу измама: клиентът вече не е доверен).
-- Прилага се през SQL Editor (f1), НЕ с supabase db push. Може да се пуска повече от веднъж. Изисква coop1–coop3 (coop4/coop5 — без значение).
--
-- Проблемът: всяка сума в coop_* идва от клиента („вече я извадих от играта си“) — подарък, вноска в мегапоръчка (наградата е ×1,5–1,9),
-- заем, вноска в касата (партньорът я тегли), изненада, наем, връщане на заем. Сървърът не знае парите на играча.
-- Минимално решение, без да се пренаписват RPC-тата (coop4/coop5 ги подменят различно) — BEFORE тригери върху таблиците, където влизат парите:
--   1) таван на една операция и на 24 ч на играч (coop.limits — меняват се с update, без миграция);
--   2) сумата спрямо парите в снимката му (coop.snaps — праща се на 20 с): от най-високата стойност за последните 24 ч (money_peak)
--      се вадят вече изпратените след нея; без снимка — само до no_snap_max;
--   3) техниката — до units_day машини на 24 ч; пратките — до parcels_day на 24 ч.
-- При нарушение тригерът хвърля 'coop_limit: <съобщение>' → цялото RPC се отменя (нищо не се записва).
-- Клиентът (coop.js, промяната е в същия пакет): rpc() не повтаря coop_limit, runOp() го превръща в { ok: false, msg } → парите/техниката
-- се връщат в играта (refund). Стар клиент (без промяната): пратката остава в опашката му и се опитва пак — нищо не се губи, само не минава.
-- Остава незащитено (иска сървърна икономика): снимката сама е от клиента (може да се подправи — тогава важат само таваните 1) и 3)),
-- км на общите обекти (coop_joint, до 20 000 км → бонус до 30 млн. €), опитът на холдинга (coop5 coop_hold_event).

-- ── настройки ──
create table if not exists coop.limits (key text primary key, value numeric not null, note text);
insert into coop.limits (key, value, note) values
  ('op_max', 1e9, 'най-много € в една операция'),
  ('day_max', 5e9, 'най-много € изпратени/вложени за 24 ч от един играч'),
  ('no_snap_max', 1e6, 'най-много € за 24 ч, ако няма снимка на играта му'),
  ('peak_mult', 1.25, 'сумата ≤ най-високите пари от снимките за 24 ч × това + peak_pad'),
  ('peak_pad', 2e5, 'добавка към горното (печалбата от последните секунди преди изпращането)'),
  ('units_day', 60, 'машини, изпратени за 24 ч'),
  ('parcels_day', 300, 'пратки (пари, техника, материали) за 24 ч')
on conflict (key) do nothing;
create or replace function coop.lim(k text) returns numeric language sql stable as $$ select value from coop.limits where key = k $$;

-- ── дневникът на изходящите пари ──
create table if not exists coop.flows (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  amount bigint not null check (amount >= 0),
  at timestamptz not null default now()
);
create index if not exists coop_flows_user_at on coop.flows (user_id, at desc);

-- ── най-високите пари от снимките за 24 ч ──
alter table coop.snaps add column if not exists money_peak bigint;
alter table coop.snaps add column if not exists peak_at timestamptz;
create or replace function coop.snaps_peak() returns trigger language plpgsql as $$
declare m bigint;
begin
  m := case when jsonb_typeof(new.data -> 'money') = 'number' then least(greatest((new.data ->> 'money')::numeric, -1e13), 1e13)::bigint end;
  if m is null then new.money_peak := case when tg_op = 'UPDATE' then old.money_peak end; new.peak_at := case when tg_op = 'UPDATE' then old.peak_at end; return new; end if;
  if tg_op = 'INSERT' or old.money_peak is null or old.peak_at is null or old.peak_at < now() - interval '24 hours' or m >= old.money_peak then
    new.money_peak := m; new.peak_at := now();
  else new.money_peak := old.money_peak; new.peak_at := old.peak_at; end if;
  return new;
end $$;
drop trigger if exists snaps_peak on coop.snaps;
create trigger snaps_peak before insert or update on coop.snaps for each row execute function coop.snaps_peak();

-- ── проверката: хвърля coop_limit или записва в дневника ──
create or replace function coop.guard_money(u uuid, k text, amt bigint) returns void language plpgsql as $$
declare s coop.snaps; day bigint; since bigint; cap numeric;
begin
  if u is null or coalesce(amt, 0) <= 0 then return; end if;
  if amt > coop.lim('op_max') then raise exception 'coop_limit: Сумата е над тавана за една операция (% €).', coop.lim('op_max')::bigint; end if;
  perform pg_advisory_xact_lock(hashtextextended('coop_flows:' || u::text, 0));   -- две паралелни заявки на един играч — една след друга
  select coalesce(sum(amount), 0) into day from coop.flows where user_id = u and at > now() - interval '24 hours';
  if day + amt > coop.lim('day_max') then raise exception 'coop_limit: Над дневния таван на партньорските преводи (% € за 24 ч).', coop.lim('day_max')::bigint; end if;
  select * into s from coop.snaps where user_id = u;
  if s.user_id is null or s.money_peak is null or s.peak_at < now() - interval '24 hours' then
    if day + amt > coop.lim('no_snap_max') then raise exception 'coop_limit: Играта ти още не е синхронизирана с облака — опитай пак след минута.'; end if;
  else
    select coalesce(sum(amount), 0) into since from coop.flows where user_id = u and at >= s.peak_at;
    cap := greatest(s.money_peak, 0) * coop.lim('peak_mult') + coop.lim('peak_pad');
    if since + amt > cap then raise exception 'coop_limit: Сумата е повече от парите ти (по последната синхронизация) — опитай пак след минута.'; end if;
  end if;
  insert into coop.flows (user_id, kind, amount) values (u, k, amt);
end $$;

create or replace function coop.guard_count(u uuid, units int) returns void language plpgsql as $$
declare n int; nu int;
begin
  select count(*), coalesce(sum(case when kind = 'unit' then amount else 0 end), 0) into n, nu from coop.flows where user_id = u and at > now() - interval '24 hours' and kind in ('parcel', 'unit');
  if n + 1 > coop.lim('parcels_day') then raise exception 'coop_limit: Твърде много пратки за 24 ч — изчакай малко.'; end if;
  if units > 0 and nu + units > coop.lim('units_day') then raise exception 'coop_limit: Твърде много изпратена техника за 24 ч (до % машини).', coop.lim('units_day')::int; end if;
  insert into coop.flows (user_id, kind, amount) values (u, case when units > 0 then 'unit' else 'parcel' end, greatest(units, 0));
end $$;

-- ── тригерите ──
-- пратки от играч към партньора: подарък, наем (цената), връщане по заем — пари; техника и материали — брой.
-- 'loan' (пуска се при приемане — парите вече са проверени при coop.loans), 'refund', 'vault', 'quest', 'joint', 'mega' — от сървъра, без проверка.
create or replace function coop.parcels_guard() returns trigger language plpgsql as $$
begin
  if new.from_u = new.to_u then return new; end if;
  if new.kind in ('gift', 'rent', 'repay') then
    perform coop.guard_money(new.from_u, new.kind, case when jsonb_typeof(new.data -> 'amount') = 'number' then least((new.data ->> 'amount')::numeric, 1e15)::bigint else 0 end);
    perform coop.guard_count(new.from_u, 0);
  elsif new.kind in ('unit', 'mat') and coalesce(new.data ->> 'rental', '') = '' and coalesce(new.note, '') not like 'Върната%' then   -- наемите и връщанията — не са нова техника
    perform coop.guard_count(new.from_u, case when new.kind = 'unit' then coalesce((new.data ->> 'n')::int, 1) else 0 end);
  end if;
  return new;
end $$;
drop trigger if exists parcels_guard on coop.parcels;
create trigger parcels_guard before insert on coop.parcels for each row execute function coop.parcels_guard();

create or replace function coop.loans_guard() returns trigger language plpgsql as $$
begin perform coop.guard_money(new.lender, 'loan', new.amount); return new; end $$;
drop trigger if exists loans_guard on coop.loans;
create trigger loans_guard before insert on coop.loans for each row execute function coop.loans_guard();

-- мегапоръчка: вноската е разликата в contrib на всеки играч
create or replace function coop.megas_guard() returns trigger language plpgsql as $$
declare e record; was bigint;
begin
  if new.contrib is not distinct from old.contrib then return new; end if;
  for e in select key, value from jsonb_each_text(new.contrib) loop
    was := coalesce((old.contrib ->> e.key)::bigint, 0);
    if e.value::bigint > was then perform coop.guard_money(e.key::uuid, 'mega', e.value::bigint - was); end if;
  end loop;
  return new;
end $$;
drop trigger if exists megas_guard on coop.megas;
create trigger megas_guard before update of contrib on coop.megas for each row execute function coop.megas_guard();

-- касата: вноските (ръчно и 40 % от поръчките); тегленията и дивидентите — не (идват от касата)
create or replace function coop.vault_guard() returns trigger language plpgsql as $$
begin
  if new.amount > 0 and coalesce(to_jsonb(new) ->> 'kind', 'manual') in ('manual', 'order') then perform coop.guard_money(new.user_id, 'vault', new.amount); end if;
  return new;
end $$;
drop trigger if exists vault_guard on coop.vault_log;
create trigger vault_guard before insert on coop.vault_log for each row execute function coop.vault_guard();

create or replace function coop.surprises_guard() returns trigger language plpgsql as $$
begin perform coop.guard_money(new.from_u, 'surprise', new.amount); return new; end $$;
drop trigger if exists surprises_guard on coop.surprises;
create trigger surprises_guard before insert on coop.surprises for each row execute function coop.surprises_guard();

-- права: както в coop1–5 — нищо директно; функциите на тригерите се викат от SECURITY DEFINER RPC-тата
revoke all on coop.limits, coop.flows from public, anon, authenticated;
revoke all on all functions in schema coop from public, anon, authenticated;

-- чистене: дневникът е нужен само за 24 ч (pg_cron, ако е включен — както online.tick)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('coop_flows_clean', '17 * * * *', $c$delete from coop.flows where at < now() - interval '2 days'$c$);
  end if;
end $$;
