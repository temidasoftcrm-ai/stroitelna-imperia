-- coop10_riv_rivals — „⚔️ Съперници“ (част 5б, флаг coop-riv-rivals).
-- Прилага се през SQL Editor, НЕ с supabase db push. Може да се пуска повече от веднъж.
-- Изисква coop6_rivals … coop9_riv_allies.
--
-- Правилата на собственика:
--   • враждебният режим се разрешава ПРЕДВАРИТЕЛНО и от двамата
--     (coop_riv_hostile); оттегли ли някой разрешението, режимът става
--     „Конкуренти“ след 12 ч онлайн време (предупреждение);
--   • всяко враждебно действие се ОБЯВЯВА и влиза в сила след 12 ч онлайн
--     време на целта; целта може да отговори с контрамерки (половин ефект)
--     или да покани на преговори; примирието (coop_riv_truce) винаги е
--     възможно → „Конкуренти“, − 25 напрежение, отворените действия падат;
--   • действията струват само държавни пари (S.pres.res — в играта) и
--     пипат само търговете, отношенията и влиянието — НИКОГА фирмата,
--     касата или общия холдинг;
--   • при напрежение ≥ 90 нови действия не се обявяват до примирие;
--   • мирът не се блокира — само се затруднява (напрежение под 40, в играта).
-- Действия: sanction — точките на целта в търговете (в режим „Съперници“)
--   − 8 (с контрамерки − 4) за 6 ч онлайн; pressure — + 15 отношения (7)
--   за обявилия в търговете на държавата за 6 ч; influence — точки влияние
--   в държава (+ до 10 точки в търговете там, докато водиш).
-- Превъзходство — три цели (броят се от сървъра): водиш по влияние в
--   3 държави, 3 спечелени търга в режим „Съперници“, повече точки
--   възстановяване (поне 30).

alter table coop.rivalry
  add column if not exists revert_left_s int;
alter table coop.rivalry
  add column if not exists truce_pending jsonb;
alter table coop.rivalry
  add column if not exists rv_tick timestamptz;

create table if not exists coop.riv_actions (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  req uuid unique,
  by_u uuid not null,
  kind text not null check (kind in ('sanction', 'pressure', 'influence')),
  iso text not null,
  pts int not null default 0,
  status text not null default 'announced'
    check (status in ('announced', 'active', 'done', 'cancelled')),
  countered boolean not null default false,
  warn_left_s int not null,
  active_left_s int not null default 0,
  last_tick timestamptz not null default now(),
  created timestamptz not null default now()
);
create index if not exists riv_actions_pair on coop.riv_actions (pair_id, id desc);
alter table coop.riv_actions enable row level security;

create table if not exists coop.riv_influence (
  pair_id bigint not null references coop.pairs on delete cascade,
  iso text not null,
  pts jsonb not null default '{}'::jsonb,
  primary key (pair_id, iso)
);
alter table coop.riv_influence enable row level security;

insert into coop.riv_limits (key, value, note) values
  ('rv_warn_s', 43200, 'онлайн секунди на целта до влизането в сила (12 ч)'),
  ('rv_revert_s', 43200, 'онлайн секунди до „Конкуренти“ след оттеглено разрешение'),
  ('rv_active_s', 21600, 'онлайн секунди действие на санкция / натиск (6 ч)'),
  ('rv_open_max', 2, 'обявени + действащи действия на играч'),
  ('rv_gap_s', 3600, 'секунди между две обявявания на един играч'),
  ('rv_block', 90, 'напрежение, при което нови действия чакат примирие')
on conflict (key) do nothing;

-- държавите, в които може да се действа (търговете и пристанищата от coop8 + още)
create or replace function coop.rv_isos() returns text[]
  language sql immutable as $$
  select array['DEU', 'IND', 'TUR', 'SAU', 'CHN', 'ISR', 'UKR', 'IRN',
    'EGY', 'SGP', 'NLD', 'BRA', 'JPN', 'ZAF'] $$;

-- добавката към точките в търг на режим „Съперници“: санкции срещу u, натиск
-- от u в държавата, преднина по влияние там
create or replace function coop.rv_mod(e coop.riv_events, u uuid)
returns numeric language sql stable as $$
  select case when coalesce(e.data ->> 'mode', '') <> 'rival' then 0 else
    coalesce((select sum(case when a.countered then -4 else -8 end)
      from coop.riv_actions a where a.pair_id = e.pair_id and a.kind = 'sanction'
        and a.status = 'active' and a.by_u <> u), 0)
    + coalesce((select sum(case when a.countered then 7 else 15 end) * 0.3
      from coop.riv_actions a where a.pair_id = e.pair_id and a.kind = 'pressure'
        and a.status = 'active' and a.by_u = u and a.iso = e.iso), 0)
    + coalesce((select least(10, greatest(0,
        (coalesce((i.pts ->> u::text)::numeric, 0)
         - coalesce((select max(v::numeric) from jsonb_each_text(i.pts) t(k, v)
             where k <> u::text), 0)) * 0.1))
      from coop.riv_influence i where i.pair_id = e.pair_id and i.iso = e.iso), 0)
  end $$;

-- точките на една оферта за търг (coop8) + добавката на съперниците
create or replace function coop.tender_score(e coop.riv_events, u uuid,
  b jsonb) returns numeric language sql stable as $$
  select round(
    (140 - (b ->> 'price')::numeric) * 0.6
    + (180 - (b ->> 'days')::numeric) * 0.15
    + least((b ->> 'q')::int, coop.q_cap(u)) * 8
    + least(greatest(coalesce(
        coop.snap_num(u, array['pres', 'rel', e.iso]), 40), 0), 100) * 0.3
    + coop.rv_mod(e, u), 1) $$;

-- ⏱ таймерите на съперничеството (от coop_riv_status)
create or replace function coop.riv_rival(p coop.pairs) returns void
  language plpgsql as $$
declare r coop.rivalry; a coop.riv_actions; dt int; on_ boolean; tgt uuid;
begin
  select * into r from coop.rivalry where pair_id = p.id for update;
  on_ := coop.online(p.a) or coop.online(p.b);
  dt := greatest(0, extract(epoch from now() - coalesce(r.rv_tick, now()))::int);
  update coop.rivalry set rv_tick = now() where pair_id = p.id;
  -- оттеглено разрешение → „Конкуренти“ след предупреждението
  if r.mode = 'rival' and not (r.hostile_ok_a and r.hostile_ok_b) then
    if r.revert_left_s is null then
      update coop.rivalry set revert_left_s = coop.rlim('rv_revert_s')::int
        where pair_id = p.id returning * into r;
    elsif on_ then
      update coop.rivalry set revert_left_s = greatest(revert_left_s - dt, 0)
        where pair_id = p.id returning * into r;
    end if;
    if r.revert_left_s <= 0 then
      update coop.rivalry set mode = 'comp', revert_left_s = null,
        truce_pending = null, updated = now() where pair_id = p.id;
      update coop.riv_actions set status = 'cancelled', last_tick = now()
        where pair_id = p.id and status in ('announced', 'active');
      return;
    end if;
  elsif r.revert_left_s is not null then
    update coop.rivalry set revert_left_s = null where pair_id = p.id;
  end if;
  for a in select * from coop.riv_actions
    where pair_id = p.id and status in ('announced', 'active') for update loop
    tgt := coop.other(p, a.by_u);
    if a.status = 'announced' then
      if coop.online(tgt) then a.warn_left_s := a.warn_left_s - greatest(0,
        extract(epoch from now() - a.last_tick)::int); end if;
      if a.warn_left_s <= 0 then
        if a.kind = 'influence' then
          insert into coop.riv_influence (pair_id, iso, pts)
            values (p.id, a.iso, jsonb_build_object(a.by_u::text,
              case when a.countered then a.pts / 2 else a.pts end))
          on conflict (pair_id, iso) do update set pts = coop.riv_influence.pts
            || jsonb_build_object(a.by_u::text,
              coalesce((coop.riv_influence.pts ->> a.by_u::text)::int, 0)
              + case when a.countered then a.pts / 2 else a.pts end);
          update coop.riv_actions set status = 'done', warn_left_s = 0,
            last_tick = now() where id = a.id;
        else
          update coop.riv_actions set status = 'active', warn_left_s = 0,
            active_left_s = coop.rlim('rv_active_s')::int, last_tick = now()
            where id = a.id;
        end if;
        update coop.rivalry set tension = least(tension + 6, 100), updated = now()
          where pair_id = p.id;
      else
        update coop.riv_actions set warn_left_s = a.warn_left_s,
          last_tick = now() where id = a.id;
      end if;
    else
      if on_ then a.active_left_s := a.active_left_s - greatest(0,
        extract(epoch from now() - a.last_tick)::int); end if;
      update coop.riv_actions set active_left_s = greatest(a.active_left_s, 0),
        status = case when a.active_left_s <= 0 then 'done' else 'active' end,
        last_tick = now() where id = a.id;
    end if;
  end loop;
end $$;

-- превъзходството: три цели за играча u
create or replace function coop.rv_goals(p coop.pairs, u uuid)
returns jsonb language sql stable as $$
  with o as (select coop.other(p, u) as v),
  inf as (select count(*) filter (where coalesce((i.pts ->> u::text)::int, 0)
      > coalesce((i.pts ->> (select v from o)::text)::int, 0)) as n
    from coop.riv_influence i where i.pair_id = p.id),
  ten as (select count(*) as n from coop.riv_events e
    where e.pair_id = p.id and e.kind = 'tender' and e.status = 'closed'
      and e.data ->> 'mode' = 'rival' and e.result ->> 'winner' = u::text),
  reb as (select coalesce((r.contrib #>> array['reb', u::text])::int, 0) as me,
      coalesce((r.contrib #>> array['reb', (select v from o)::text])::int, 0) as them
    from coop.rivalry r where r.pair_id = p.id)
  select jsonb_build_object(
    'inf', (select n from inf), 'tenders', (select n from ten),
    'reb', (select me from reb),
    'done', (case when (select n from inf) >= 3 then 1 else 0 end)
      + (case when (select n from ten) >= 3 then 1 else 0 end)
      + (case when (select me from reb) >= 30 and (select me from reb) > (select them from reb) then 1 else 0 end)) $$;

create or replace function coop.rv_json(p coop.pairs, u uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'actions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'iso', a.iso, 'pts', a.pts,
        'mine', a.by_u = u, 'status', a.status, 'countered', a.countered,
        'warn_left_s', a.warn_left_s, 'active_left_s', a.active_left_s)
        order by a.id desc)
      from (select * from coop.riv_actions where pair_id = p.id
        order by id desc limit 10) a), '[]'::jsonb),
    'influence', coalesce((select jsonb_agg(jsonb_build_object('iso', i.iso,
        'me', coalesce((i.pts ->> u::text)::int, 0),
        'them', coalesce((i.pts ->> coop.other(p, u)::text)::int, 0)) order by i.iso)
      from coop.riv_influence i where i.pair_id = p.id), '[]'::jsonb),
    'goals_me', coop.rv_goals(p, u), 'goals_them', coop.rv_goals(p, coop.other(p, u)),
    'revert_left_s', (select revert_left_s from coop.rivalry where pair_id = p.id),
    'truce', (select case when truce_pending is null then null else
        jsonb_build_object('mine', truce_pending ->> 'by' = u::text) end
      from coop.rivalry where pair_id = p.id),
    'rv_block', coop.rlim('rv_block')) $$;

-- състоянието — като в coop8/9 + съперничеството
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
  perform coop.riv_world(p);
  perform coop.riv_rival(p);
  select * into r from coop.rivalry where pair_id = p.id;
  return coop.riv_json(r, p, u) || jsonb_build_object(
    'deals', coop.riv_deals_json(p, u),
    'events', coop.riv_events_json(p, u),
    'rival', coop.rv_json(p, u),
    'contrib', jsonb_build_object(
      'dip_me', coalesce((r.contrib #>> array['dip', u::text])::int, 0),
      'dip_them', coalesce((r.contrib #>> array['dip', coop.other(p, u)::text])::int, 0),
      'reb_me', coalesce((r.contrib #>> array['reb', u::text])::int, 0),
      'reb_them', coalesce((r.contrib #>> array['reb', coop.other(p, u)::text])::int, 0)),
    'partner_online', coop.online(coop.other(p, u)),
    'calm_ok', r.calm_at is null
      or r.calm_at < now() - interval '24 hours');
end $$;

-- ⚔️ разрешението за враждебен режим (само моето); оттеглянето в режим
-- „Съперници“ пуска 12-часовото предупреждение (coop.riv_rival)
create or replace function public.coop_riv_hostile(p_ok boolean)
returns jsonb language plpgsql security definer
set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; r coop.rivalry;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return coop.fail('none', 'Нямаш активен партньор.'); end if;
  perform pg_advisory_xact_lock(hashtextextended('coop_riv:' || p.id::text, 0));
  r := coop.riv_row(p);
  if p.a = u then update coop.rivalry set hostile_ok_a = coalesce(p_ok, false), updated = now() where pair_id = p.id;
  else update coop.rivalry set hostile_ok_b = coalesce(p_ok, false), updated = now() where pair_id = p.id; end if;
  -- предложение за „Съперници“ без двете разрешения пада
  update coop.rivalry set mode_pending = null
    where pair_id = p.id and mode_pending ->> 'mode' = 'rival'
      and not (hostile_ok_a and hostile_ok_b);
  return public.coop_riv_status();
end $$;

-- 📢 обявяване на враждебно действие (идемпотентно по p_req)
create or replace function public.coop_riv_action(
  p_req uuid, p_kind text, p_iso text, p_pts int default 0)
returns jsonb language plpgsql security definer
set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; r coop.rivalry; n int; last timestamptz;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return coop.fail('none', 'Нямаш активен партньор.'); end if;
  if exists (select 1 from coop.riv_actions where req = p_req) then
    return public.coop_riv_status(); end if;
  perform pg_advisory_xact_lock(hashtextextended('coop_riv:' || p.id::text, 0));
  r := coop.riv_row(p);
  if r.mode <> 'rival' or not (r.hostile_ok_a and r.hostile_ok_b) then
    return coop.fail('mode', 'Действията са само в режим „Съперници“, разрешен от двамата.'); end if;
  if r.revert_left_s is not null then
    return coop.fail('revert', 'Разрешението е оттеглено — режимът става „Конкуренти“.'); end if;
  if r.tension >= coop.rlim('rv_block') then
    return coop.fail('block', 'Напрежението е твърде високо — първо примирие.'); end if;
  if p_kind is null or p_kind not in ('sanction', 'pressure', 'influence') then
    return coop.fail('kind', 'Непознато действие.'); end if;
  if p_iso is null or not (p_iso = any (coop.rv_isos())) then
    return coop.fail('iso', 'Непозната държава.'); end if;
  select count(*) into n from coop.riv_actions
    where pair_id = p.id and by_u = u and status in ('announced', 'active');
  if n >= coop.rlim('rv_open_max') then
    return coop.fail('open', 'Имаш две обявени или действащи действия.'); end if;
  select max(created) into last from coop.riv_actions where pair_id = p.id and by_u = u;
  if last is not null and last > now() - make_interval(secs => coop.rlim('rv_gap_s')) then
    return coop.fail('gap', 'Ново действие — най-много веднъж на час.'); end if;
  insert into coop.riv_actions (pair_id, req, by_u, kind, iso, pts, warn_left_s)
    values (p.id, p_req, u, p_kind, p_iso,
      case when p_kind = 'influence' then least(greatest(coalesce(p_pts, 10), 10), 30) else 0 end,
      coop.rlim('rv_warn_s')::int);
  update coop.rivalry set tension = least(tension + 4, 100), updated = now()
    where pair_id = p.id;
  return public.coop_riv_status();
end $$;

-- 🛡️ контрамерки: само целта, само докато действието е обявено → половин ефект
create or replace function public.coop_riv_counter(p_action bigint)
returns jsonb language plpgsql security definer
set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; a coop.riv_actions;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return coop.fail('none', 'Нямаш активен партньор.'); end if;
  perform pg_advisory_xact_lock(hashtextextended('coop_riv:' || p.id::text, 0));
  select * into a from coop.riv_actions where id = p_action and pair_id = p.id for update;
  if a.id is null then return coop.fail('action', 'Няма такова действие.'); end if;
  if a.by_u = u then return coop.fail('own', 'Това е твоето действие.'); end if;
  if a.status <> 'announced' then return coop.fail('late', 'Действието вече е в сила.'); end if;
  if a.countered then return public.coop_riv_status(); end if;
  update coop.riv_actions set countered = true where id = a.id;
  update coop.rivalry set tension = least(tension + 2, 100), updated = now() where pair_id = p.id;
  return public.coop_riv_status();
end $$;

-- 🕊️ примирие: propose | accept | decline (предложилият може да оттегли)
create or replace function public.coop_riv_truce(p_action text)
returns jsonb language plpgsql security definer
set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; r coop.rivalry;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return coop.fail('none', 'Нямаш активен партньор.'); end if;
  perform pg_advisory_xact_lock(hashtextextended('coop_riv:' || p.id::text, 0));
  r := coop.riv_row(p);
  if r.mode <> 'rival' then return coop.fail('mode', 'Примирието е за режим „Съперници“.'); end if;
  if p_action = 'propose' then
    update coop.rivalry set truce_pending = jsonb_build_object('by', u::text, 'at', now()), updated = now()
      where pair_id = p.id;
  elsif p_action = 'accept' then
    if r.truce_pending is null or r.truce_pending ->> 'by' = u::text then
      return coop.fail('nothing', 'Няма предложение за примирие от партньора.'); end if;
    update coop.rivalry set mode = 'comp', mode_pending = null, truce_pending = null,
      revert_left_s = null, tension = greatest(tension - 25, 0), trust = least(trust + 5, 100),
      updated = now() where pair_id = p.id;
    update coop.riv_actions set status = 'cancelled', last_tick = now()
      where pair_id = p.id and status in ('announced', 'active');
  elsif p_action = 'decline' then
    if r.truce_pending is null then return coop.fail('nothing', 'Няма предложение.'); end if;
    update coop.rivalry set truce_pending = null, updated = now() where pair_id = p.id;
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
