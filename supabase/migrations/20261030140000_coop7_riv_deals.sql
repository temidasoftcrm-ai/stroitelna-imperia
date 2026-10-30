-- coop7_riv_deals — „⚖️ Конкуренти“, ЧАСТ 2: сделките (флаг coop-riv-deals).
-- Прилага се през SQL Editor, НЕ с supabase db push. Може да се пуска повече от веднъж.
-- Изисква coop1 и coop6_rivals.
--
-- Сделка = предложение + до 3 насрещни. Видове:
--   mega  — енергийният коридор (8 млрд. €): кой какъв дял плаща,
--           кой какъв дял от прихода взема, срок в дни.
--           Вноските са ОБЕЩАНИЯ — всеки вади своя дял от държавния
--           бюджет у себе си; сървърът само проверява обещанието спрямо
--           бюджета в снимката му (pres.res).
--   trade — размяна на показатели (енергия срещу услуги…) — БЕЗ пари.
-- Таймерите са в секунди на сървъра и текат САМО докато отговарящият
-- е онлайн (снимката му е по-нова от 60 с). Активните сделки текат,
-- докато поне един е онлайн.
-- Правила: доверие +/− при изпълнение / разваляне; свързаност + докато
-- има активни; напрежение + при отказ след насрещно; разваляне —
-- с 10 мин прозорец (партньорът го вижда); тавани.
-- Не пипа парите на фирмите, касата, общите обекти и мегапоръчките.

alter table coop.rivalry
  add column if not exists calm_at timestamptz;

create table if not exists coop.riv_deals (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  req uuid not null unique,
  kind text not null check (kind in ('mega', 'trade')),
  owner uuid not null references auth.users on delete cascade,
  by_u uuid not null references auth.users on delete cascade,
  terms jsonb not null,
  round smallint not null default 0 check (round between 0 and 3),
  status text not null default 'prop' check (status in
    ('prop', 'counter', 'acc', 'dec', 'active', 'done',
     'broken', 'expired')),
  resp_left_s int not null default 900,
  due_left_s int not null default 0,
  last_tick timestamptz not null default now(),
  break_by uuid,
  break_at timestamptz,
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);
create index if not exists riv_deals_pair
  on coop.riv_deals (pair_id, id desc);
alter table coop.riv_deals enable row level security;

create table if not exists coop.riv_limits (
  key text primary key, value numeric not null, note text);
insert into coop.riv_limits (key, value, note) values
  ('resp_s', 900, 'секунди за отговор (онлайн време)'),
  ('open_max', 3, 'отворени сделки, предложени от един играч'),
  ('gap_s', 3600, 'секунди между две нови предложения на играч'),
  ('terms_max', 1500, 'най-много символа в условията'),
  ('break_s', 600, 'прозорец за разваляне (секунди)'),
  ('day_s', 60, 'секунди сървърно време = 1 ден от срока'),
  ('res_mult', 1.25, 'обещанието ≤ бюджета в снимката × това')
on conflict (key) do nothing;
create or replace function coop.rlim(k text) returns numeric
  language sql stable as
  $$ select value from coop.riv_limits where key = k $$;

create or replace function coop.online(u uuid) returns boolean
  language sql stable as $$
  select coalesce((select at > now() - interval '60 seconds'
    from coop.snaps where user_id = u), false) $$;

-- бюджетът на държавата в снимката (pres.res), иначе 0
create or replace function coop.snap_res(u uuid) returns numeric
  language sql stable as $$
  select case
    when jsonb_typeof(data -> 'pres' -> 'res') = 'number'
    then greatest((data -> 'pres' ->> 'res')::numeric, 0)
    else 0 end
  from coop.snaps where user_id = u $$;

-- 🧼 условията: само познатите полета, в граници (иначе null)
create or replace function coop.riv_terms(k text, t jsonb)
returns jsonb language plpgsql immutable as $$
declare n numeric; ind text[] := array[
  'econ', 'services', 'energy', 'security', 'trust'];
begin
  if t is null or jsonb_typeof(t) <> 'object'
     or length(t::text) > 1500 then return null; end if;
  if k = 'mega' then
    return jsonb_build_object(
      'cost', 8000000000,
      'mine', least(greatest(coalesce((t ->> 'mine')::int, 50), 10), 90),
      'rev', least(greatest(coalesce((t ->> 'rev')::int, 50), 10), 90),
      'days', least(greatest(coalesce((t ->> 'days')::int, 30), 10), 60));
  end if;
  if k = 'trade' then
    if not ((t ->> 'give') = any(ind)) or not ((t ->> 'get') = any(ind))
       or (t ->> 'give') = (t ->> 'get') then return null; end if;
    return jsonb_build_object(
      'give', t ->> 'give', 'get', t ->> 'get',
      'pts', least(greatest(coalesce((t ->> 'pts')::int, 3), 1), 10),
      'days', least(greatest(coalesce((t ->> 'days')::int, 30), 10), 90));
  end if;
  return null;
exception when others then return null;
end $$;

-- обещанието на играча в мега сделка (по условията и кой ги е дал)
create or replace function coop.riv_pledge(d coop.riv_deals, u uuid)
returns numeric language sql immutable as $$
  select case when d.kind <> 'mega' then 0
    when d.by_u = u then (d.terms ->> 'cost')::numeric
      * (d.terms ->> 'mine')::numeric / 100
    else (d.terms ->> 'cost')::numeric
      * (100 - (d.terms ->> 'mine')::numeric) / 100 end $$;

create or replace function coop.riv_pledge_ok(d coop.riv_deals, u uuid)
returns boolean language sql stable as $$
  select coop.riv_pledge(d, u)
    <= coalesce(coop.snap_res(u), 0) * coop.rlim('res_mult') $$;

-- ⏱ таймерите на двойката: отговорът — само докато отговарящият е
-- онлайн; активните — докато поне един е онлайн; развалянето — по часовник
create or replace function coop.riv_advance(p coop.pairs)
returns void language plpgsql as $$
declare d coop.riv_deals; dt int; resp uuid; n int;
begin
  for d in select * from coop.riv_deals
    where pair_id = p.id
      and status in ('prop', 'counter', 'active') for update
  loop
    dt := greatest(0, extract(epoch from now() - d.last_tick)::int);
    if d.status in ('prop', 'counter') then
      resp := coop.other(p, d.by_u);
      if coop.online(resp) then
        d.resp_left_s := d.resp_left_s - dt;
      end if;
      if d.resp_left_s <= 0 then
        update coop.riv_deals set status = 'expired',
          resp_left_s = 0, last_tick = now(), updated = now()
          where id = d.id;
        continue;
      end if;
      update coop.riv_deals set resp_left_s = d.resp_left_s,
        last_tick = now() where id = d.id;
    else
      if d.break_at is not null and d.break_at <= now() then
        update coop.riv_deals set status = 'broken',
          last_tick = now(), updated = now() where id = d.id;
        update coop.rivalry set
          trust = greatest(trust - 12, 0),
          tension = least(tension + 15, 100), updated = now()
          where pair_id = p.id;
        continue;
      end if;
      if coop.online(p.a) or coop.online(p.b) then
        d.due_left_s := d.due_left_s - dt;
      end if;
      if d.due_left_s <= 0 then
        update coop.riv_deals set status = 'done', due_left_s = 0,
          last_tick = now(), updated = now() where id = d.id;
        update coop.rivalry set
          trust = least(trust + 6, 100), updated = now()
          where pair_id = p.id;
        continue;
      end if;
      update coop.riv_deals set due_left_s = d.due_left_s,
        last_tick = now() where id = d.id;
    end if;
  end loop;
  -- свързаността следва броя активни сделки
  select count(*) into n from coop.riv_deals
    where pair_id = p.id and status = 'active';
  update coop.rivalry set
    interdep = least(100, greatest(interdep, 20 + 12 * n))
    where pair_id = p.id and interdep < 20 + 12 * n;
end $$;

create or replace function coop.riv_deals_json(p coop.pairs, u uuid)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'kind', d.kind, 'terms', d.terms,
    'round', d.round, 'status', d.status,
    'by_me', d.by_u = u, 'owner_me', d.owner = u,
    'my_turn', d.status in ('prop', 'counter') and d.by_u <> u,
    'resp_left_s', d.resp_left_s, 'due_left_s', d.due_left_s,
    'paused', d.status in ('prop', 'counter')
      and not coop.online(coop.other(p, d.by_u)),
    'breaking', d.break_at is not null and d.status = 'active',
    'break_me', d.break_by = u,
    'break_left_s', case when d.break_at is null then null
      else greatest(0, extract(epoch from d.break_at - now())::int) end,
    'my_pledge', coop.riv_pledge(d, u)) order by d.id desc), '[]'::jsonb)
  from coop.riv_deals d
  where d.id in (select id from coop.riv_deals where pair_id = p.id
    order by id desc limit 20) $$;

-- състоянието — като в coop6 + сделките и partner_online
create or replace function public.coop_riv_status()
returns jsonb language plpgsql security definer
set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; r coop.rivalry;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return jsonb_build_object('ok', true, 'active', false);
  end if;
  r := coop.riv_row(p);
  perform coop.riv_advance(p);
  select * into r from coop.rivalry where pair_id = p.id;
  return coop.riv_json(r, p, u) || jsonb_build_object(
    'deals', coop.riv_deals_json(p, u),
    'partner_online', coop.online(coop.other(p, u)),
    'calm_ok', r.calm_at is null
      or r.calm_at < now() - interval '24 hours');
end $$;

-- ново предложение (идемпотентно по p_req)
create or replace function public.coop_riv_propose(
  p_req uuid, p_kind text, p_terms jsonb)
returns jsonb language plpgsql security definer
set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; r coop.rivalry;
  t jsonb; d coop.riv_deals; n int; last timestamptz;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return coop.fail('none', 'Нямаш активен партньор.'); end if;
  if exists (select 1 from coop.riv_deals where req = p_req) then
    return public.coop_riv_status(); end if;
  perform pg_advisory_xact_lock(
    hashtextextended('coop_riv:' || p.id::text, 0));
  r := coop.riv_row(p);
  if r.mode not in ('comp', 'rival') then
    return coop.fail('mode', 'Сделките са в режим „Конкуренти“.'); end if;
  t := coop.riv_terms(p_kind, p_terms);
  if t is null then return coop.fail('terms', 'Невалидни условия.'); end if;
  select count(*), max(created) into n, last from coop.riv_deals
    where pair_id = p.id and owner = u
      and status in ('prop', 'counter', 'active');
  if n >= coop.rlim('open_max') then
    return coop.fail('open', 'Имаш твърде много отворени сделки.'); end if;
  select max(created) into last from coop.riv_deals
    where pair_id = p.id and owner = u;
  if last is not null
     and last > now() - make_interval(secs => coop.rlim('gap_s')) then
    return coop.fail('gap', 'Ново предложение — най-много веднъж на час.');
  end if;
  insert into coop.riv_deals (pair_id, req, kind, owner, by_u, terms,
      resp_left_s)
    values (p.id, p_req, p_kind, u, u, t, coop.rlim('resp_s')::int)
    returning * into d;
  if not coop.riv_pledge_ok(d, u) then
    raise exception 'coop_limit: Обещанието е над държавния ти бюджет.';
  end if;
  return public.coop_riv_status();
end $$;

-- p_action: accept | decline | counter (с p_terms) | withdraw
--           | break | unbreak | calm (без p_deal)
create or replace function public.coop_riv_act(
  p_deal bigint, p_action text, p_terms jsonb default null)
returns jsonb language plpgsql security definer
set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; d coop.riv_deals;
  r coop.rivalry; t jsonb;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return coop.fail('none', 'Нямаш активен партньор.'); end if;
  perform pg_advisory_xact_lock(
    hashtextextended('coop_riv:' || p.id::text, 0));
  r := coop.riv_row(p);
  perform coop.riv_advance(p);

  if p_action = 'calm' then   -- „Върни се на масата“
    select * into r from coop.rivalry where pair_id = p.id;
    if r.tension <= 60 then
      return coop.fail('calm', 'Напрежението не е високо.'); end if;
    if r.calm_at is not null and r.calm_at > now() - interval '24 hours' then
      return coop.fail('calm', 'Веднъж на 24 часа.'); end if;
    update coop.rivalry set tension = greatest(tension - 15, 0),
      trust = least(trust + 2, 100), calm_at = now(), updated = now()
      where pair_id = p.id;
    return public.coop_riv_status();
  end if;

  select * into d from coop.riv_deals
    where id = p_deal and pair_id = p.id for update;
  if d.id is null then return coop.fail('deal', 'Няма такава сделка.'); end if;

  if p_action = 'accept' then
    if d.status not in ('prop', 'counter') or d.by_u = u then
      return coop.fail('turn', 'Не е твой ред.'); end if;
    if not coop.riv_pledge_ok(d, u) then
      return coop.fail('res', 'Обещанието е над държавния ти бюджет.'); end if;
    update coop.riv_deals set status = 'active',
      due_left_s = (d.terms ->> 'days')::int * coop.rlim('day_s')::int,
      last_tick = now(), updated = now() where id = d.id;
    update coop.rivalry set trust = least(trust + 2, 100),
      updated = now() where pair_id = p.id;

  elsif p_action = 'decline' then
    if d.status not in ('prop', 'counter') or d.by_u = u then
      return coop.fail('turn', 'Не е твой ред.'); end if;
    update coop.riv_deals set status = 'dec', updated = now()
      where id = d.id;
    if d.round > 0 then   -- отказ след насрещно
      update coop.rivalry set tension = least(tension + 6, 100),
        updated = now() where pair_id = p.id;
    end if;

  elsif p_action = 'counter' then
    if d.status not in ('prop', 'counter') or d.by_u = u then
      return coop.fail('turn', 'Не е твой ред.'); end if;
    if d.round >= 3 then
      return coop.fail('round', 'След 3 насрещни — само „да“ или „не“.');
    end if;
    t := coop.riv_terms(d.kind, p_terms);
    if t is null then return coop.fail('terms', 'Невалидни условия.'); end if;
    update coop.riv_deals set terms = t, by_u = u, round = d.round + 1,
      status = 'counter', resp_left_s = coop.rlim('resp_s')::int,
      last_tick = now(), updated = now()
      where id = d.id returning * into d;
    if not coop.riv_pledge_ok(d, u) then
      raise exception 'coop_limit: Обещанието е над държавния ти бюджет.';
    end if;

  elsif p_action = 'withdraw' then
    if d.status not in ('prop', 'counter') or d.by_u <> u then
      return coop.fail('turn', 'Можеш да оттеглиш само свое предложение.');
    end if;
    update coop.riv_deals set status = 'dec', updated = now()
      where id = d.id;

  elsif p_action = 'break' then
    if d.status <> 'active' or d.break_at is not null then
      return coop.fail('break', 'Сделката не може да се развали.'); end if;
    update coop.riv_deals set break_by = u,
      break_at = now() + make_interval(secs => coop.rlim('break_s')),
      updated = now() where id = d.id;

  elsif p_action = 'unbreak' then
    if d.break_by is distinct from u or d.status <> 'active' then
      return coop.fail('break', 'Няма твое разваляне.'); end if;
    update coop.riv_deals set break_by = null, break_at = null,
      updated = now() where id = d.id;

  else
    return coop.fail('action', 'Непознато действие.');
  end if;
  return public.coop_riv_status();
end $$;

revoke all on all tables in schema coop
  from public, anon, authenticated;
revoke all on all functions in schema coop
  from public, anon, authenticated;
do $$ declare f record; begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'coop\_%'
  loop
    execute format(
      'revoke all on function %s from public, anon', f.sig);
    execute format(
      'grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
