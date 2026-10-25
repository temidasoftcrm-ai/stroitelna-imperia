-- coop4 — 🏦 правила на общата каса (холдинга) на партньорите. ПРИЛОЖЕНА в Supabase (проверено 25.10.2026).
-- Прилага се само с изричното „да“ на потребителя (през f1); никога supabase db push.
--
-- Какво прави:
--   1) Лимит за самостоятелно теглене (self_limit): за последните 24 ч всеки може да изтегли сам до лимита;
--      над него тегленето става ЗАЯВКА, която партньорът одобрява (тогава парите тръгват) или отказва.
--   2) Лимит за автоматичното спасяване от фалит (rescue_limit): холдингът покрива дълга най-много до тази сума.
--   3) Правилата важат само ако и двамата са ги приели: единият предлага, другият приема/отказва. Докато няма приети
--      правила — всичко е както досега (без лимити).
--   NULL = без лимит. Таблиците и функциите са в схемата coop (както досега), достъпни само през public.coop_* функциите.

-- ── правилата в касата ──
alter table coop.vaults add column if not exists self_limit bigint check (self_limit is null or self_limit >= 0);
alter table coop.vaults add column if not exists rescue_limit bigint check (rescue_limit is null or rescue_limit >= 0);
alter table coop.vaults add column if not exists rules_at timestamptz;              -- кога са приети сегашните правила
alter table coop.vaults add column if not exists rules_pending jsonb;               -- { self_limit, rescue_limit, by, at } — чака другия

-- ── заявки за теглене над лимита ──
create table if not exists coop.vault_requests (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  user_id uuid not null,
  amount bigint not null check (amount > 0),
  reason text,
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined', 'cancelled', 'expired')),
  req uuid unique,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists coop_vault_requests_pair on coop.vault_requests (pair_id, status);

-- колко съм изтеглил сам за последните 24 ч (ръчните тегления; спасяването и дивидентите не се броят)
create or replace function coop.my_withdrawn_24h(p_pair bigint, u uuid) returns bigint language sql stable as
  $$ select coalesce(-sum(amount), 0)::bigint from coop.vault_log where pair_id = p_pair and user_id = u and amount < 0 and kind = 'manual' and at > now() - interval '24 hours' $$;

-- ── тегленето: както досега, но над лимита → отказ с 'need_approval' (клиентът предлага заявка) ──
create or replace function public.coop_vault(p_req uuid, p_amount bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; v coop.vaults; l coop.vault_log;
begin
  select * into l from coop.vault_log where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true); end if;
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if coalesce(p_amount, 0) = 0 or abs(p_amount) > 1e12 then return coop.fail('bad_amount', 'Невалидна сума.'); end if;
  insert into coop.vaults (pair_id) values (p.id) on conflict do nothing;
  select * into v from coop.vaults where pair_id = p.id for update;
  if p_amount < 0 and v.balance < -p_amount then return coop.fail('no_money', format('В касичката има само %s €.', v.balance)); end if;
  if p_amount < 0 and v.self_limit is not null and coop.my_withdrawn_24h(p.id, u) + (-p_amount) > v.self_limit then
    return jsonb_build_object('ok', false, 'err', 'need_approval', 'limit', v.self_limit, 'used', coop.my_withdrawn_24h(p.id, u),
      'msg', format('Над лимита за самостоятелно теглене (%s € за 24 ч) — нужно е одобрение от партньора.', v.self_limit));
  end if;
  update coop.vaults set balance = balance + p_amount where pair_id = p.id;
  insert into coop.vault_log (pair_id, user_id, amount, req) values (p.id, u, p_amount, p_req);
  if p_amount < 0 then insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values (p.id, u, u, 'vault', jsonb_build_object('amount', -p_amount), 'От общата касичка'); end if;
  return jsonb_build_object('ok', true, 'balance', v.balance + p_amount);
end $$;

-- ── coop_vault2: ръчното теглене — същият лимит; спасяването — най-много rescue_limit ──
create or replace function public.coop_vault2(p_req uuid, p_amount bigint, p_kind text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; v coop.vaults; l coop.vault_log; amt bigint := p_amount;
begin
  select * into l from coop.vault_log where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true, 'amount', l.amount); end if;
  if p_kind not in ('manual', 'order', 'bailout') then return coop.fail('bad_kind', 'Невалиден вид.'); end if;
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if coalesce(amt, 0) = 0 or abs(amt) > 1e12 or (p_kind = 'order' and amt < 0) or (p_kind = 'bailout' and amt > 0) then return coop.fail('bad_amount', 'Невалидна сума.'); end if;
  insert into coop.vaults (pair_id) values (p.id) on conflict do nothing;
  select * into v from coop.vaults where pair_id = p.id for update;
  if p_kind = 'bailout' then
    amt := -least(-amt, v.balance, coalesce(v.rescue_limit, v.balance));
    if amt = 0 then return coop.fail('no_money', case when v.rescue_limit = 0 then 'Спасяването от фалит е изключено по правилата на касата.' else 'Касичката е празна.' end); end if;
  end if;
  if amt < 0 and v.balance < -amt then return coop.fail('no_money', format('В касичката има само %s €.', v.balance)); end if;
  if p_kind = 'manual' and amt < 0 and v.self_limit is not null and coop.my_withdrawn_24h(p.id, u) + (-amt) > v.self_limit then
    return jsonb_build_object('ok', false, 'err', 'need_approval', 'limit', v.self_limit, 'msg', format('Над лимита за самостоятелно теглене (%s € за 24 ч) — нужно е одобрение от партньора.', v.self_limit));
  end if;
  update coop.vaults set balance = balance + amt where pair_id = p.id;
  insert into coop.vault_log (pair_id, user_id, amount, req, kind) values (p.id, u, amt, p_req, p_kind);
  if amt < 0 then insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values (p.id, u, u, 'vault', jsonb_build_object('amount', -amt),
    case when p_kind = 'bailout' then '🏦 Холдингът покри дълга ти' else 'От общата касичка' end); end if;
  if p_kind = 'bailout' then insert into coop.messages (pair_id, from_u, text, sos) values (p.id, u, format('🏦 Холдингът покри дълга ми: %s € — фирмата се спаси от фалит.', -amt), true); end if;
  return jsonb_build_object('ok', true, 'amount', amt, 'balance', v.balance + amt);
end $$;

-- ── правилата: предложение и приемане (другият партньор) ──
create or replace function public.coop_rules_propose(p_self bigint, p_rescue bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if (p_self is not null and (p_self < 0 or p_self > 1e12)) or (p_rescue is not null and (p_rescue < 0 or p_rescue > 1e12)) then return coop.fail('bad_amount', 'Невалиден лимит.'); end if;
  insert into coop.vaults (pair_id) values (p.id) on conflict do nothing;
  update coop.vaults set rules_pending = jsonb_build_object('self_limit', p_self, 'rescue_limit', p_rescue, 'by', u, 'at', now()) where pair_id = p.id;
  insert into coop.messages (pair_id, from_u, text, sos) values (p.id, u, '📜 Предложих правила за общата каса — виж „Финанси → Общ холдинг“.', false);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.coop_rules_act(p_action text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; v coop.vaults;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  select * into v from coop.vaults where pair_id = p.id for update;
  if v.rules_pending is null then return coop.fail('none', 'Няма предложени правила.'); end if;
  if p_action = 'cancel' then
    if (v.rules_pending ->> 'by')::uuid <> u then return coop.fail('not_yours', 'Само предложилият може да оттегли.'); end if;
    update coop.vaults set rules_pending = null where pair_id = p.id; return jsonb_build_object('ok', true);
  end if;
  if (v.rules_pending ->> 'by')::uuid = u then return coop.fail('own', 'Правилата трябва да ги приеме партньорът.'); end if;
  if p_action = 'accept' then
    update coop.vaults set self_limit = (v.rules_pending ->> 'self_limit')::bigint, rescue_limit = (v.rules_pending ->> 'rescue_limit')::bigint, rules_at = now(), rules_pending = null where pair_id = p.id;
  elsif p_action = 'decline' then update coop.vaults set rules_pending = null where pair_id = p.id;
  else return coop.fail('bad_action', 'Невалидно действие.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── заявка за теглене над лимита и решението на партньора ──
create or replace function public.coop_withdraw_request(p_req uuid, p_amount bigint, p_reason text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; r coop.vault_requests;
begin
  select * into r from coop.vault_requests where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true, 'id', r.id); end if;
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if coalesce(p_amount, 0) <= 0 or p_amount > 1e12 then return coop.fail('bad_amount', 'Невалидна сума.'); end if;
  if (select count(*) from coop.vault_requests where pair_id = p.id and user_id = u and status = 'requested') >= 3 then return coop.fail('too_many', 'Имаш 3 чакащи заявки — изчакай отговор.'); end if;
  insert into coop.vault_requests (pair_id, user_id, amount, reason, req) values (p.id, u, p_amount, left(p_reason, 120), p_req) returning * into r;
  insert into coop.messages (pair_id, from_u, text, sos) values (p.id, u, format('🏦 Моля за одобрение: теглене %s € от общата каса%s.', p_amount, coalesce(' — ' || nullif(left(p_reason, 120), ''), '')), false);
  return jsonb_build_object('ok', true, 'id', r.id);
end $$;

create or replace function public.coop_withdraw_act(p_id bigint, p_action text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; r coop.vault_requests; v coop.vaults;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  select * into r from coop.vault_requests where id = p_id and pair_id = p.id for update;
  if not found or r.status <> 'requested' then return coop.fail('gone', 'Заявката вече е решена.'); end if;
  if p_action = 'cancel' then
    if r.user_id <> u then return coop.fail('not_yours', 'Само заявилият може да оттегли.'); end if;
    update coop.vault_requests set status = 'cancelled', decided_at = now() where id = r.id; return jsonb_build_object('ok', true);
  end if;
  if r.user_id = u then return coop.fail('own', 'Заявката я решава партньорът.'); end if;
  if p_action = 'decline' then update coop.vault_requests set status = 'declined', decided_at = now() where id = r.id; return jsonb_build_object('ok', true); end if;
  if p_action <> 'approve' then return coop.fail('bad_action', 'Невалидно действие.'); end if;
  select * into v from coop.vaults where pair_id = p.id for update;
  if v.balance < r.amount then return coop.fail('no_money', format('В касичката има само %s €.', v.balance)); end if;
  update coop.vaults set balance = balance - r.amount where pair_id = p.id;
  insert into coop.vault_log (pair_id, user_id, amount, kind) values (p.id, r.user_id, -r.amount, 'approved');
  insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values (p.id, u, r.user_id, 'vault', jsonb_build_object('amount', r.amount), '🏦 Одобрено теглене от общата каса');
  update coop.vault_requests set status = 'approved', decided_at = now() where id = r.id;
  return jsonb_build_object('ok', true, 'amount', r.amount);
end $$;

-- ── състоянието: правилата, колко съм теглил за 24 ч, заявките (чакащите + последните 10 решени) ──
create or replace function public.coop_status4() returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; v coop.vaults;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return jsonb_build_object('ok', true, 'active', false); end if;
  select * into v from coop.vaults where pair_id = p.id;
  update coop.vault_requests set status = 'expired', decided_at = now() where pair_id = p.id and status = 'requested' and created_at < now() - interval '72 hours';
  return jsonb_build_object('ok', true, 'active', true,
    'rules', jsonb_build_object('self_limit', v.self_limit, 'rescue_limit', v.rescue_limit, 'at', v.rules_at,
      'pending', case when v.rules_pending is null then null else (v.rules_pending - 'by') || jsonb_build_object('mine', (v.rules_pending ->> 'by')::uuid = u) end),
    'used24', coop.my_withdrawn_24h(p.id, u),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'mine', r.user_id = u, 'amount', r.amount, 'reason', r.reason, 'status', r.status, 'at', r.created_at, 'decided_at', r.decided_at) order by r.id desc)
      from (select * from coop.vault_requests where pair_id = p.id and (status = 'requested' or id in (select id from coop.vault_requests where pair_id = p.id and status <> 'requested' order by id desc limit 10))) r), '[]'::jsonb));
end $$;

-- дневникът: новият вид 'approved' (одобрено теглене) — проверката на kind в coop_vault2 не го пуска отвън
-- правата — както в coop3: таблиците и вътрешните функции са закрити, public.coop_* — само за влезли
revoke all on all tables in schema coop from public, anon, authenticated;
revoke all on all functions in schema coop from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'coop\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
