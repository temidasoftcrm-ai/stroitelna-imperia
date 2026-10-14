-- 🤝 Партньорство, част 3 — холдингът става истинска обща фирма:
--   • 40% от печалбата на всяка поръчка на единия отиват в холдинга (клиентът вече е извадил сумата; kind 'order')
--   • спасяване: на 10-ия ден на минус холдингът покрива дълга на партньора, ако има пари (kind 'bailout' + съобщение в чата)
--   • дивидент: в края на всеки игрален месец (вика го клиентът; поне 30 мин реално между два) холдингът раздава 30% от печалбата си
--     (вноските от поръчки от последното раздаване): на акционерите от борсата — техния дял, остатъкът — по равно на двамата
--   • акции на борсата (IPO): единият предлага (дял 5–30% и срок 1/3/7 дни), другият одобрява; инвеститорите плащат постепенно
--     през срока дял × касичката при старта × 1.5 (премия). Публичният дял е най-много 49%.
--   • общите големи поръчки: изпълнената остава в списъка „✅ Изпълнена поръчка“ и печалбата (×множителя) се дели по равно

alter table coop.vault_log add column if not exists kind text not null default 'manual';
alter table coop.vaults add column if not exists last_div_at timestamptz not null default now();
alter table coop.vaults add column if not exists public_pct int not null default 0 check (public_pct between 0 and 49);

create table if not exists coop.ipos (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  proposed_by uuid not null,
  pct int not null check (pct between 5 and 30),
  hours int not null check (hours in (24, 72, 168)),
  status text not null default 'proposed' check (status in ('proposed', 'active', 'done', 'declined', 'cancelled')),
  base bigint not null default 0,
  raised bigint not null default 0,
  start_at timestamptz, ends_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists coop_ipos_one on coop.ipos (pair_id) where status in ('proposed', 'active');

-- плащанията на инвеститорите се начисляват при всяко поглеждане (без cron)
create or replace function coop.ipo_tick(p_pair bigint) returns void language plpgsql as $$
declare i coop.ipos; due bigint; add bigint;
begin
  for i in select * from coop.ipos where pair_id = p_pair and status = 'active' for update loop
    due := floor(i.base * i.pct / 100.0 * 1.5 * least(1, extract(epoch from now() - i.start_at) / extract(epoch from i.ends_at - i.start_at)))::bigint;
    add := greatest(0, due - i.raised);
    if add > 0 then
      update coop.vaults set balance = balance + add where pair_id = p_pair;
      insert into coop.vault_log (pair_id, user_id, amount, kind) values (p_pair, i.proposed_by, add, 'ipo');
      update coop.ipos set raised = raised + add where id = i.id;
    end if;
    if now() >= i.ends_at then
      update coop.ipos set status = 'done' where id = i.id;
      update coop.vaults set public_pct = least(49, public_pct + i.pct) where pair_id = p_pair;
    end if;
  end loop;
end $$;

-- обща голяма поръчка: всеки си взема вложеното + половината от печалбата (ако и двамата са вложили ≥ 20%)
create or replace function coop.mega_reward(m coop.megas, t coop.mega_types, u uuid, o uuid) returns bigint language sql immutable as $$
  select case when coalesce((m.contrib ->> u::text)::bigint, 0) >= t.cost * 0.2 and coalesce((m.contrib ->> o::text)::bigint, 0) >= t.cost * 0.2
    then coalesce((m.contrib ->> u::text)::bigint, 0) + floor(coop.mega_total(m) * (t.mult - 1) / 2)::bigint
    else coalesce((m.contrib ->> u::text)::bigint, 0) end
$$;

create or replace function public.coop_mega_claim(p_mega bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; m coop.megas; t coop.mega_types; o uuid; reward bigint;
begin
  perform coop.mega_finish();
  p := coop.my_pair(u);
  select * into m from coop.megas where id = p_mega and pair_id = p.id for update;
  if not found or m.status <> 'done' then return coop.fail('not_done', 'Поръчката още не е готова.'); end if;
  if m.claimed ? u::text then return coop.fail('claimed', 'Вече взе наградата.'); end if;
  select * into t from coop.mega_types where key = m.key;
  o := coop.other(p, u);
  reward := coop.mega_reward(m, t, u, o);
  update coop.megas set claimed = claimed || to_jsonb(u::text) where id = m.id;
  return jsonb_build_object('ok', true, 'reward', reward, 'fair', reward > coalesce((m.contrib ->> u::text)::bigint, 0), 'nm', t.nm, 'ico', t.ico);
end $$;

-- касичка с вид на вноската: 'manual' (ръчно), 'order' (40% от поръчка), 'bailout' (спасяване — само теглене)
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
  if p_kind = 'bailout' then amt := -least(-amt, v.balance); if amt = 0 then return coop.fail('no_money', 'Касичката е празна.'); end if; end if;
  if amt < 0 and v.balance < -amt then return coop.fail('no_money', format('В касичката има само %s €.', v.balance)); end if;
  update coop.vaults set balance = balance + amt where pair_id = p.id;
  insert into coop.vault_log (pair_id, user_id, amount, req, kind) values (p.id, u, amt, p_req, p_kind);
  if amt < 0 then insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values (p.id, u, u, 'vault', jsonb_build_object('amount', -amt),
    case when p_kind = 'bailout' then '🏦 Холдингът покри дълга ти' else 'От общата касичка' end); end if;
  if p_kind = 'bailout' then insert into coop.messages (pair_id, from_u, text, sos) values (p.id, u, format('🏦 Холдингът покри дълга ми: %s € — фирмата се спаси от фалит.', -amt), true); end if;
  return jsonb_build_object('ok', true, 'amount', amt, 'balance', v.balance + amt);
end $$;

-- дивидент за игралния месец: вика се от клиента в края на месеца; поне 30 мин реално между две раздавания
create or replace function public.coop_dividend() returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; v coop.vaults; prof bigint; pay bigint; inv bigint; each bigint;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  perform coop.ipo_tick(p.id);
  select * into v from coop.vaults where pair_id = p.id for update;
  if not found then return jsonb_build_object('ok', true, 'paid', 0); end if;
  if v.last_div_at > now() - interval '30 minutes' then return jsonb_build_object('ok', true, 'paid', 0, 'wait', true); end if;
  prof := coalesce((select sum(amount) from coop.vault_log where pair_id = p.id and kind = 'order' and at >= v.last_div_at), 0);
  pay := least(v.balance, floor(prof * 0.3)::bigint);
  update coop.vaults set last_div_at = now() where pair_id = p.id;
  if pay <= 0 then return jsonb_build_object('ok', true, 'paid', 0, 'profit', prof); end if;
  inv := floor(pay * v.public_pct / 100.0)::bigint;
  each := (pay - inv) / 2;
  update coop.vaults set balance = balance - inv - each * 2 where pair_id = p.id;
  insert into coop.vault_log (pair_id, user_id, amount, kind) values (p.id, u, -(inv + each * 2), 'dividend');
  if each > 0 then
    insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values
      (p.id, u, p.a, 'vault', jsonb_build_object('amount', each), '🏦 Дивидент от холдинга (30% от печалбата)'),
      (p.id, u, p.b, 'vault', jsonb_build_object('amount', each), '🏦 Дивидент от холдинга (30% от печалбата)');
  end if;
  return jsonb_build_object('ok', true, 'paid', pay, 'each', each, 'investors', inv, 'profit', prof);
end $$;

-- акции на борсата: 'propose' (p_pct, p_hours), после партньорът 'accept' / 'decline'; предложилият може 'cancel'
create or replace function public.coop_ipo(p_action text, p_pct int default null, p_hours int default null) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; i coop.ipos; v coop.vaults;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  perform coop.ipo_tick(p.id);
  insert into coop.vaults (pair_id) values (p.id) on conflict do nothing;
  select * into v from coop.vaults where pair_id = p.id for update;
  select * into i from coop.ipos where pair_id = p.id and status in ('proposed', 'active') for update;
  if p_action = 'propose' then
    if i.id is not null then return coop.fail('exists', 'Вече има предложение или активна емисия.'); end if;
    if p_pct is null or p_pct not between 5 and 30 or p_hours not in (24, 72, 168) then return coop.fail('bad_data', 'Дял 5–30% и срок 1, 3 или 7 дни.'); end if;
    if v.public_pct + p_pct > 49 then return coop.fail('too_much', format('На борсата може най-много 49%% (вече %s%%).', v.public_pct)); end if;
    if v.balance < 100000 then return coop.fail('small', 'Холдингът трябва да има поне 100 000 € в касичката.'); end if;
    insert into coop.ipos (pair_id, proposed_by, pct, hours) values (p.id, u, p_pct, p_hours) returning * into i;
    insert into coop.messages (pair_id, from_u, text) values (p.id, u, format('📈 Предлагам холдингът да пусне %s%% акции на борсата за %s дни — одобри в „🏦 Холдинг“.', p_pct, p_hours / 24));
    return jsonb_build_object('ok', true, 'id', i.id);
  end if;
  if i.id is null then return coop.fail('none', 'Няма предложение.'); end if;
  if p_action = 'accept' then
    if i.status <> 'proposed' or i.proposed_by = u then return coop.fail('bad_action', 'Партньорът трябва да одобри.'); end if;
    update coop.ipos set status = 'active', base = v.balance, start_at = now(), ends_at = now() + make_interval(hours => i.hours) where id = i.id;
    return jsonb_build_object('ok', true);
  elsif p_action in ('decline', 'cancel') then
    if i.status <> 'proposed' then return coop.fail('bad_action', 'Емисията вече тече.'); end if;
    if (p_action = 'cancel') <> (i.proposed_by = u) then return coop.fail('bad_action', 'Не може.'); end if;
    update coop.ipos set status = case when p_action = 'cancel' then 'cancelled' else 'declined' end where id = i.id;
    return jsonb_build_object('ok', true);
  end if;
  return coop.fail('bad_action', 'Непознато действие.');
end $$;

-- състоянието за част 3 (клиентът го взема заедно с coop_status2)
create or replace function public.coop_status3() returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; o uuid; v coop.vaults;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return jsonb_build_object('ok', true, 'active', false); end if;
  o := coop.other(p, u);
  perform coop.ipo_tick(p.id);
  perform coop.mega_finish();
  select * into v from coop.vaults where pair_id = p.id;
  return jsonb_build_object('ok', true, 'active', true,
    'public_pct', coalesce(v.public_pct, 0), 'last_div_at', v.last_div_at,
    'month_profit', coalesce((select sum(amount) from coop.vault_log where pair_id = p.id and kind = 'order' and at >= coalesce(v.last_div_at, '-infinity')), 0),
    'log', coalesce((select jsonb_agg(jsonb_build_object('me', l.user_id = u, 'amount', l.amount, 'kind', l.kind, 'at', l.at) order by l.id desc) from (select * from coop.vault_log where pair_id = p.id order by id desc limit 12) l), '[]'::jsonb),
    'ipo', (select jsonb_build_object('id', i.id, 'mine', i.proposed_by = u, 'pct', i.pct, 'hours', i.hours, 'status', i.status, 'raised', i.raised,
              'target', floor(i.base * i.pct / 100.0 * 1.5)::bigint, 'ends_at', i.ends_at) from coop.ipos i where i.pair_id = p.id order by i.id desc limit 1),
    'megas_done', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'key', m.key, 'ico', t.ico, 'nm', t.nm, 'ends_at', m.ends_at, 'total', coop.mega_total(m),
        'mine', coop.mega_reward(m, t, u, o), 'theirs', coop.mega_reward(m, t, o, u), 'claimed', m.claimed ? u::text) order by m.id desc)
       from (select * from coop.megas where pair_id = p.id and status = 'done' order by id desc limit 5) m join coop.mega_types t on t.key = m.key), '[]'::jsonb));
end $$;

revoke all on all tables in schema coop from public, anon, authenticated;
revoke all on all functions in schema coop from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'coop\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
