-- coop8_riv_world — „⚖️ Конкуренти“, ЧАСТ 3: светът (флаг coop-riv-world).
-- Прилага се през SQL Editor, НЕ с supabase db push. Може да се пуска повече от веднъж.
-- Изисква coop1, coop6_rivals и coop7_riv_deals.
--
-- Сървърът сам пуска събития за двойката (coop.riv_spawn, от състоянието):
-- най-много едно на 6 ч онлайн време (докато поне един е онлайн), само в режим
-- „Конкуренти“/„Съперници“ и само ако няма отворено.
--   tender — трета държава с бюджет на проект; всеки дава цена / срок /
--            качество или и двамата — ОБЩА оферта. Сървърът смята точките:
--            цена, срок, качество (таван от показателите в снимката) и
--            отношенията на третата държава с играча (снимката, в граници).
--            Победата дава contrib.dip; общата — делят я, + свързаност.
--   crisis — земетресение затваря ключово пристанище; общи кораби (по-голям
--            ефект, + свързаност, + доверие) или сам (contrib.reb за него,
--            + напрежение). Корабите — от снимката (fleet 's…'), в граници.
-- Срокът тече само докато поне един е онлайн. Парите — само у играча
-- (S.pres.res, локално). Идемпотентно по p_req.

alter table coop.rivalry
  add column if not exists ev_online_s int not null default 0;
alter table coop.rivalry
  add column if not exists ev_tick timestamptz;

create table if not exists coop.riv_events (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  kind text not null check (kind in ('tender', 'crisis')),
  iso text not null,
  data jsonb not null,
  bids jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  left_s int not null default 1200,
  last_tick timestamptz not null default now(),
  opens timestamptz not null default now(),
  closes timestamptz
);
create index if not exists riv_events_pair
  on coop.riv_events (pair_id, id desc);
alter table coop.riv_events enable row level security;

insert into coop.riv_limits (key, value, note) values
  ('ev_gap_s', 21600, 'онлайн секунди между две събития'),
  ('ev_open_s', 1200, 'секунди за оферти (онлайн време)'),
  ('ev_first_s', 600, 'онлайн секунди до първото събитие')
on conflict (key) do nothing;

-- снимката на играча: средно икономика/услуги, отношения с държава, кораби
create or replace function coop.snap_num(u uuid, path text[])
returns numeric language sql stable as $$
  select case when jsonb_typeof(data #> path) = 'number'
    then (data #>> path)::numeric else null end
  from coop.snaps where user_id = u $$;

create or replace function coop.snap_ships(u uuid) returns int
  language sql stable as $$
  select coalesce((select count(*)::int
    from coop.snaps s, jsonb_array_elements(
      case when jsonb_typeof(s.data -> 'fleet') = 'array'
        then s.data -> 'fleet' else '[]'::jsonb end) e
    where s.user_id = u and e ->> 'ref' like 's%'), 0) $$;

-- таванът на качеството 1..5 от икономиката и услугите в снимката
create or replace function coop.q_cap(u uuid) returns int
  language sql stable as $$
  select least(5, greatest(1, 1 + floor((
    coalesce(coop.snap_num(u, array['pres', 'ind', 'econ']), 40)
    + coalesce(coop.snap_num(u, array['pres', 'ind', 'services']), 40))
    / 2 / 25)::int)) $$;

-- 🧼 офертата: само познатите полета, в граници (иначе null)
create or replace function coop.riv_bid_clean(k text, b jsonb)
returns jsonb language plpgsql immutable as $$
begin
  if b is null or jsonb_typeof(b) <> 'object'
     or length(b::text) > 400 then return null; end if;
  if k = 'tender' then
    return jsonb_build_object(
      'price', least(greatest(coalesce((b ->> 'price')::int, 100), 60), 140),
      'days', least(greatest(coalesce((b ->> 'days')::int, 60), 20), 180),
      'q', least(greatest(coalesce((b ->> 'q')::int, 3), 1), 5),
      'joint', coalesce((b ->> 'joint')::boolean, false));
  end if;
  if k = 'crisis' then
    if (b ->> 'mode') not in ('pool', 'solo', 'skip') then return null; end if;
    return jsonb_build_object('mode', b ->> 'mode',
      'ships', least(greatest(coalesce((b ->> 'ships')::int, 0), 0), 50));
  end if;
  return null;
exception when others then return null;
end $$;

-- contrib[k][u] += n (създава и липсващите ключове)
create or replace function coop.contrib_add(c jsonb, k text, u text, n int)
returns jsonb language sql immutable as $$
  select jsonb_set(coalesce(c, '{}'::jsonb)
      || jsonb_build_object(k, coalesce(c -> k, '{}'::jsonb)),
    array[k, u], to_jsonb(coalesce((c #>> array[k, u])::int, 0) + n), true) $$;

-- точките на една оферта за търг
create or replace function coop.tender_score(e coop.riv_events, u uuid,
  b jsonb) returns numeric language sql stable as $$
  select round(
    (140 - (b ->> 'price')::numeric) * 0.6
    + (180 - (b ->> 'days')::numeric) * 0.15
    + least((b ->> 'q')::int, coop.q_cap(u)) * 8
    + least(greatest(coalesce(
        coop.snap_num(u, array['pres', 'rel', e.iso]), 40), 0), 100) * 0.3, 1) $$;

-- ✅ затваряне: кой печели и какво се променя в отношенията
create or replace function coop.riv_resolve(e coop.riv_events,
  p coop.pairs) returns void language plpgsql as $$
declare ba jsonb := e.bids -> p.a::text; bb jsonb := e.bids -> p.b::text;
  sa numeric; sb numeric; res jsonb; win text;
  ca int; cb int; ma text; mb text;
begin
  if e.kind = 'tender' then
    if ba is not null and bb is not null
       and (ba ->> 'joint')::boolean and (bb ->> 'joint')::boolean then
      sa := (coop.tender_score(e, p.a, ba) + coop.tender_score(e, p.b, bb)) / 2 + 10;
      res := jsonb_build_object('winner', 'joint', 'score', round(sa, 1));
      update coop.rivalry set
        contrib = coop.contrib_add(coop.contrib_add(contrib, 'dip', p.a::text, 5), 'dip', p.b::text, 5),
        interdep = least(interdep + 8, 100), trust = least(trust + 2, 100),
        updated = now() where pair_id = p.id;
    else
      sa := case when ba is null then null else coop.tender_score(e, p.a, ba) end;
      sb := case when bb is null then null else coop.tender_score(e, p.b, bb) end;
      win := case when sa is null and sb is null then null
        when sb is null or (sa is not null and sa >= sb) then p.a::text
        else p.b::text end;
      res := jsonb_build_object('winner', win, 'scores',
        jsonb_build_object(p.a::text, sa, p.b::text, sb));
      if win is not null then
        update coop.rivalry set
          contrib = coop.contrib_add(contrib, 'dip', win, 10),
          updated = now() where pair_id = p.id;
      end if;
    end if;
  else
    ma := coalesce(ba ->> 'mode', 'skip'); mb := coalesce(bb ->> 'mode', 'skip');
    ca := least(coalesce((ba ->> 'ships')::int, 0), coop.snap_ships(p.a));
    cb := least(coalesce((bb ->> 'ships')::int, 0), coop.snap_ships(p.b));
    if ma = 'pool' and mb = 'pool' then
      res := jsonb_build_object('outcome', 'pool', 'ships', ca + cb,
        'effect', least(100, 30 + (ca + cb) * 6));
      update coop.rivalry set
        contrib = coop.contrib_add(coop.contrib_add(contrib, 'reb', p.a::text, 6), 'reb', p.b::text, 6),
        interdep = least(interdep + 8, 100), trust = least(trust + 5, 100),
        updated = now() where pair_id = p.id;
    elsif ma <> 'skip' or mb <> 'skip' then
      -- някой е действал сам (или единият е искал общо, а другият — не)
      res := jsonb_build_object('outcome', 'solo',
        'actors', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (values
          (case when ma <> 'skip' then p.a::text end),
          (case when mb <> 'skip' then p.b::text end)) v(x) where x is not null),
        'ships', jsonb_build_object(p.a::text, ca, p.b::text, cb),
        'effect', least(100, 15 + greatest(ca, cb) * 5));
      update coop.rivalry set
        contrib = case when ma <> 'skip' then coop.contrib_add(contrib, 'reb', p.a::text, 10) else contrib end,
        tension = least(tension + case when ma <> 'skip' and mb <> 'skip' then 12 else 8 end, 100),
        updated = now() where pair_id = p.id;
      update coop.rivalry set
        contrib = case when mb <> 'skip' then coop.contrib_add(contrib, 'reb', p.b::text, 10) else contrib end
        where pair_id = p.id;
    else
      res := jsonb_build_object('outcome', 'none', 'effect', 0);
      update coop.rivalry set trust = greatest(trust - 3, 0), updated = now()
        where pair_id = p.id;
    end if;
  end if;
  update coop.riv_events set status = 'closed', result = res,
    closes = now(), left_s = 0 where id = e.id;
end $$;

-- ⏱ таймерите на събитията и новото събитие (от coop_riv_status)
create or replace function coop.riv_world(p coop.pairs) returns void
  language plpgsql as $$
declare r coop.rivalry; e coop.riv_events; dt int; on_ boolean;
  isos text[] := array['DEU', 'IND', 'TUR', 'SAU', 'CHN', 'ISR', 'UKR', 'IRN'];
  ports text[] := array['Ормуз', 'Суецкия канал', 'Босфора', 'Сингапур', 'Ротердам'];
  pisos text[] := array['IRN', 'EGY', 'TUR', 'SGP', 'NLD'];
  i int;
begin
  select * into r from coop.rivalry where pair_id = p.id for update;
  on_ := coop.online(p.a) or coop.online(p.b);
  dt := greatest(0, extract(epoch from now() - coalesce(r.ev_tick, now()))::int);
  for e in select * from coop.riv_events
    where pair_id = p.id and status = 'open' for update loop
    if on_ then e.left_s := e.left_s - greatest(0,
      extract(epoch from now() - e.last_tick)::int); end if;
    update coop.riv_events set left_s = greatest(e.left_s, 0),
      last_tick = now() where id = e.id;
    if e.left_s <= 0 then perform coop.riv_resolve(e, p); end if;
  end loop;
  if on_ then
    update coop.rivalry set ev_online_s = ev_online_s + dt, ev_tick = now()
      where pair_id = p.id returning * into r;
  else
    update coop.rivalry set ev_tick = now() where pair_id = p.id;
  end if;
  -- ново събитие: режимът, няма отворено, достатъчно онлайн време
  if r.mode in ('comp', 'rival')
     and not exists (select 1 from coop.riv_events
       where pair_id = p.id and status = 'open')
     and r.ev_online_s >= (case
       when exists (select 1 from coop.riv_events where pair_id = p.id)
       then coop.rlim('ev_gap_s') else coop.rlim('ev_first_s') end) then
    if random() < 0.55 then
      i := 1 + floor(random() * array_length(isos, 1))::int;
      insert into coop.riv_events (pair_id, kind, iso, data, left_s)
        values (p.id, 'tender', isos[i], jsonb_build_object(
          'budget', (2 + floor(random() * 5)) * 1000000000,
          'proj', (array['port', 'rail', 'grid', 'water'])[1 + floor(random() * 4)::int]),
          coop.rlim('ev_open_s')::int);
    else
      i := 1 + floor(random() * array_length(ports, 1))::int;
      insert into coop.riv_events (pair_id, kind, iso, data, left_s)
        values (p.id, 'crisis', pisos[i], jsonb_build_object(
          'port', ports[i], 'sev', 2 + floor(random() * 3)::int),
          coop.rlim('ev_open_s')::int);
    end if;
    update coop.rivalry set ev_online_s = 0 where pair_id = p.id;
  end if;
end $$;

create or replace function coop.riv_events_json(p coop.pairs, u uuid)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'iso', e.iso, 'data', e.data,
    'status', e.status, 'left_s', e.left_s,
    'my_bid', e.bids -> u::text,
    'their_in', (e.bids -> coop.other(p, u)::text) is not null,
    'their_bid', case when e.status = 'closed'
      then e.bids -> coop.other(p, u)::text end,
    'result', case when e.result is null then null
      else e.result || jsonb_build_object(
        'me_won', e.result ->> 'winner' = u::text,
        'joint', e.result ->> 'winner' = 'joint',
        'i_acted', coalesce(e.result -> 'actors' ? u::text, false)) end,
    'q_cap', coop.q_cap(u), 'ships_max', coop.snap_ships(u))
    order by e.id desc), '[]'::jsonb)
  from coop.riv_events e
  where e.id in (select id from coop.riv_events where pair_id = p.id
    order by id desc limit 6) $$;

-- състоянието — като в coop7 + светът
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
  select * into r from coop.rivalry where pair_id = p.id;
  return coop.riv_json(r, p, u) || jsonb_build_object(
    'deals', coop.riv_deals_json(p, u),
    'events', coop.riv_events_json(p, u),
    'contrib', jsonb_build_object(
      'dip_me', coalesce((r.contrib #>> array['dip', u::text])::int, 0),
      'dip_them', coalesce((r.contrib #>> array['dip', coop.other(p, u)::text])::int, 0),
      'reb_me', coalesce((r.contrib #>> array['reb', u::text])::int, 0),
      'reb_them', coalesce((r.contrib #>> array['reb', coop.other(p, u)::text])::int, 0)),
    'partner_online', coop.online(coop.other(p, u)),
    'calm_ok', r.calm_at is null
      or r.calm_at < now() - interval '24 hours');
end $$;

-- оферта за събитие (идемпотентно по p_req; може да се смени до затварянето)
create or replace function public.coop_riv_bid(
  p_event bigint, p_bid jsonb, p_req uuid)
returns jsonb language plpgsql security definer
set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; e coop.riv_events; b jsonb;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return coop.fail('none', 'Нямаш активен партньор.'); end if;
  perform pg_advisory_xact_lock(
    hashtextextended('coop_riv:' || p.id::text, 0));
  select * into e from coop.riv_events
    where id = p_event and pair_id = p.id for update;
  if e.id is null then return coop.fail('event', 'Няма такова събитие.'); end if;
  if (e.bids -> u::text ->> 'req') = p_req::text then
    return public.coop_riv_status(); end if;
  if e.status <> 'open' then
    return coop.fail('closed', 'Събитието вече е затворено.'); end if;
  b := coop.riv_bid_clean(e.kind, p_bid);
  if b is null then return coop.fail('bid', 'Невалидна оферта.'); end if;
  update coop.riv_events set bids = jsonb_set(bids, array[u::text],
      b || jsonb_build_object('req', p_req::text, 'at', now()), true)
    where id = e.id;
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
