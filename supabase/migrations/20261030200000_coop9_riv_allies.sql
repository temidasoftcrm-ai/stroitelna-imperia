-- coop9_riv_allies — „🤝 Съюзници“ (част 5а, флаг coop-riv-allies).
-- Прилага се през SQL Editor, НЕ с supabase db push. Може да се пуска повече от веднъж.
-- Изисква coop6_rivals, coop7_riv_deals и coop8_riv_world.
--
-- Режимът „Съюзници“ (и двамата са съгласни — coop_riv_mode, както досега):
--   сделки — както в „Конкуренти“ (натискът у дома е наполовина — в играта);
--   tender — САМО обща оферта срещу трети кандидат, когото смята сървърът
--            (data.ai, 50–80 точки). Подадат ли и двамата — средното + 10;
--            само единият — 75 % от неговите точки. Победата: + дипломация
--            за подалите, + свързаност, + доверие;
--   crisis — общите кораби по подразбиране; сам — с половин ефект и
--            − доверие (вместо + напрежение);
--   aid    — 🆘 молба за помощ (coop_riv_ask): средства или точки на
--            показател; партньорът помага или отказва в срок (тече само
--            докато ТОЙ е онлайн). Помощ: + доверие, + свързаност,
--            + възстановяване за помогналия. Отказ/изтекъл срок: − доверие.
--   напрежението спада с 2 на всеки 10 мин онлайн време.
-- Парите се местят само у играчите (S.pres.res, локално); фирмите и общият
-- холдинг не се пипат.

alter table coop.rivalry
  add column if not exists calm_s int not null default 0;

alter table coop.riv_events
  drop constraint if exists riv_events_kind_check;
alter table coop.riv_events
  add constraint riv_events_kind_check
  check (kind in ('tender', 'crisis', 'aid'));

insert into coop.riv_limits (key, value, note) values
  ('aid_gap_s', 1800, 'секунди между две молби за помощ от един играч'),
  ('aid_open_s', 1200, 'секунди за отговор на молба (онлайн време на помагащия)'),
  ('aid_funds_max', 2000000000, 'най-голямата молба за средства (€)'),
  ('aid_pts_max', 8, 'най-много точки на показател в една молба'),
  ('ally_calm_s', 600, 'онлайн секунди за −2 напрежение при съюзници')
on conflict (key) do nothing;

-- 🧼 офертата / отговорът: само познатите полета, в граници (иначе null)
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
  if k = 'aid' then
    if (b ->> 'mode') not in ('help', 'decline') then return null; end if;
    return jsonb_build_object('mode', b ->> 'mode');
  end if;
  return null;
exception when others then return null;
end $$;

-- ✅ затваряне на събитие от режим „Съюзници“ (data.mode = 'allies') и на молбите
create or replace function coop.riv_resolve_ally(e coop.riv_events,
  p coop.pairs) returns void language plpgsql as $$
declare ba jsonb := e.bids -> p.a::text; bb jsonb := e.bids -> p.b::text;
  sa numeric; sb numeric; s numeric; ai numeric; res jsonb;
  ca int; cb int; ma text; mb text; asker text; helper text; hb jsonb;
begin
  if e.kind = 'tender' then
    ai := coalesce((e.data ->> 'ai')::numeric, 65);
    sa := case when ba is null then null else coop.tender_score(e, p.a, ba) end;
    sb := case when bb is null then null else coop.tender_score(e, p.b, bb) end;
    s := case when sa is not null and sb is not null then (sa + sb) / 2 + 10
      when sa is not null then sa * 0.75 when sb is not null then sb * 0.75 end;
    if s is not null and s >= ai then
      res := jsonb_build_object('winner', 'joint', 'score', round(s, 1), 'ai', ai,
        'both', sa is not null and sb is not null);
      update coop.rivalry set
        contrib = case when sa is not null then coop.contrib_add(contrib, 'dip', p.a::text, 5) else contrib end,
        interdep = least(interdep + 8, 100), trust = least(trust + 3, 100),
        updated = now() where pair_id = p.id;
      update coop.rivalry set
        contrib = case when sb is not null then coop.contrib_add(contrib, 'dip', p.b::text, 5) else contrib end
        where pair_id = p.id;
    else
      res := jsonb_build_object('winner', 'ai', 'score', round(coalesce(s, 0), 1), 'ai', ai,
        'both', sa is not null and sb is not null);
      if sa is null or sb is null then
        update coop.rivalry set trust = greatest(trust - 1, 0), updated = now()
          where pair_id = p.id;
      end if;
    end if;
  elsif e.kind = 'crisis' then
    ma := coalesce(ba ->> 'mode', 'skip'); mb := coalesce(bb ->> 'mode', 'skip');
    ca := least(coalesce((ba ->> 'ships')::int, 0), coop.snap_ships(p.a));
    cb := least(coalesce((bb ->> 'ships')::int, 0), coop.snap_ships(p.b));
    if ma = 'pool' and mb = 'pool' then
      res := jsonb_build_object('outcome', 'pool', 'ships', ca + cb,
        'effect', least(100, 30 + (ca + cb) * 6));
      update coop.rivalry set
        contrib = coop.contrib_add(coop.contrib_add(contrib, 'reb', p.a::text, 6), 'reb', p.b::text, 6),
        interdep = least(interdep + 8, 100), trust = least(trust + 8, 100),
        updated = now() where pair_id = p.id;
    elsif ma <> 'skip' or mb <> 'skip' then
      -- само единият действа (или единият — сам): половин ефект, − доверие (не + напрежение)
      res := jsonb_build_object('outcome', 'solo',
        'actors', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (values
          (case when ma <> 'skip' then p.a::text end),
          (case when mb <> 'skip' then p.b::text end)) v(x) where x is not null),
        'ships', jsonb_build_object(p.a::text, ca, p.b::text, cb),
        'effect', least(100, (15 + greatest(ca, cb) * 5) / 2));
      update coop.rivalry set
        contrib = case when ma <> 'skip' then coop.contrib_add(contrib, 'reb', p.a::text, 6) else contrib end,
        trust = greatest(trust - 4, 0), updated = now() where pair_id = p.id;
      update coop.rivalry set
        contrib = case when mb <> 'skip' then coop.contrib_add(contrib, 'reb', p.b::text, 6) else contrib end
        where pair_id = p.id;
    else
      res := jsonb_build_object('outcome', 'none', 'effect', 0);
      update coop.rivalry set trust = greatest(trust - 3, 0), updated = now()
        where pair_id = p.id;
    end if;
  else   -- aid
    asker := e.data ->> 'from';
    helper := case when asker = p.a::text then p.b::text else p.a::text end;
    hb := e.bids -> helper;
    if hb ->> 'mode' = 'help' then
      res := jsonb_build_object('outcome', 'help', 'helper', helper);
      update coop.rivalry set
        contrib = coop.contrib_add(contrib, 'reb', helper, 4),
        trust = least(trust + 9, 100), interdep = least(interdep + 4, 100),
        updated = now() where pair_id = p.id;
    else
      res := jsonb_build_object('outcome',
        case when hb is null then 'none' else 'declined' end, 'helper', helper);
      update coop.rivalry set trust = greatest(trust - 2, 0), updated = now()
        where pair_id = p.id;
    end if;
  end if;
  update coop.riv_events set status = 'closed', result = res,
    closes = now(), left_s = 0 where id = e.id;
end $$;

-- обвивката: старите (Конкуренти) — както в coop8, „Съюзници“ и молбите — по-горе
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'coop' and p.proname = 'riv_resolve_comp') then
    alter function coop.riv_resolve(coop.riv_events, coop.pairs) rename to riv_resolve_comp;
  end if;
end $$;
create or replace function coop.riv_resolve(e coop.riv_events,
  p coop.pairs) returns void language plpgsql as $$
begin
  if e.kind = 'aid' or e.data ->> 'mode' = 'allies' then
    perform coop.riv_resolve_ally(e, p);
  else
    perform coop.riv_resolve_comp(e, p);
  end if;
end $$;

-- ⏱ таймерите и новите събития — като в coop8, + „Съюзници“ (събития със
-- data.mode и трети кандидат), молбите (тече само докато помагащият е онлайн)
-- и спадането на напрежението
create or replace function coop.riv_world(p coop.pairs) returns void
  language plpgsql as $$
declare r coop.rivalry; e coop.riv_events; dt int; on_ boolean; run_ boolean;
  isos text[] := array['DEU', 'IND', 'TUR', 'SAU', 'CHN', 'ISR', 'UKR', 'IRN'];
  ports text[] := array['Ормуз', 'Суецкия канал', 'Босфора', 'Сингапур', 'Ротердам'];
  pisos text[] := array['IRN', 'EGY', 'TUR', 'SGP', 'NLD'];
  i int; n int;
begin
  select * into r from coop.rivalry where pair_id = p.id for update;
  on_ := coop.online(p.a) or coop.online(p.b);
  dt := greatest(0, extract(epoch from now() - coalesce(r.ev_tick, now()))::int);
  for e in select * from coop.riv_events
    where pair_id = p.id and status = 'open' for update loop
    run_ := case when e.kind = 'aid'
      then coop.online(case when e.data ->> 'from' = p.a::text then p.b else p.a end)
      else on_ end;
    if run_ then e.left_s := e.left_s - greatest(0,
      extract(epoch from now() - e.last_tick)::int); end if;
    update coop.riv_events set left_s = greatest(e.left_s, 0),
      last_tick = now() where id = e.id;
    if e.left_s <= 0 then perform coop.riv_resolve(e, p); end if;
  end loop;
  if on_ then
    update coop.rivalry set ev_online_s = ev_online_s + dt, ev_tick = now(),
      calm_s = case when mode = 'allies' then calm_s + dt else 0 end
      where pair_id = p.id returning * into r;
    if r.mode = 'allies' and r.calm_s >= coop.rlim('ally_calm_s') then
      n := floor(r.calm_s / coop.rlim('ally_calm_s'))::int;
      update coop.rivalry set tension = greatest(tension - 2 * n, 0),
        calm_s = calm_s - n * coop.rlim('ally_calm_s')::int
        where pair_id = p.id returning * into r;
    end if;
  else
    update coop.rivalry set ev_tick = now() where pair_id = p.id;
  end if;
  -- ново събитие: режимът, няма отворен търг/криза, достатъчно онлайн време
  if r.mode in ('comp', 'rival', 'allies')
     and not exists (select 1 from coop.riv_events
       where pair_id = p.id and status = 'open' and kind <> 'aid')
     and r.ev_online_s >= (case
       when exists (select 1 from coop.riv_events where pair_id = p.id and kind <> 'aid')
       then coop.rlim('ev_gap_s') else coop.rlim('ev_first_s') end) then
    if random() < 0.55 then
      i := 1 + floor(random() * array_length(isos, 1))::int;
      insert into coop.riv_events (pair_id, kind, iso, data, left_s)
        values (p.id, 'tender', isos[i], jsonb_build_object(
          'budget', (2 + floor(random() * 5)) * 1000000000,
          'proj', (array['port', 'rail', 'grid', 'water'])[1 + floor(random() * 4)::int],
          'mode', r.mode, 'ai', 50 + floor(random() * 31)::int),
          coop.rlim('ev_open_s')::int);
    else
      i := 1 + floor(random() * array_length(ports, 1))::int;
      insert into coop.riv_events (pair_id, kind, iso, data, left_s)
        values (p.id, 'crisis', pisos[i], jsonb_build_object(
          'port', ports[i], 'sev', 2 + floor(random() * 3)::int, 'mode', r.mode),
          coop.rlim('ev_open_s')::int);
    end if;
    update coop.rivalry set ev_online_s = 0 where pair_id = p.id;
  end if;
end $$;

-- събитията за играча — като в coop8, + чия е молбата и третия кандидат след затварянето
create or replace function coop.riv_events_json(p coop.pairs, u uuid)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'iso', e.iso,
    'data', e.data - 'ai' - 'from' - 'req',
    'status', e.status, 'left_s', e.left_s,
    'ask_me', e.kind = 'aid' and e.data ->> 'from' = u::text,
    'my_bid', e.bids -> u::text,
    'their_in', (e.bids -> coop.other(p, u)::text) is not null,
    'their_bid', case when e.status = 'closed'
      then e.bids -> coop.other(p, u)::text end,
    'result', case when e.result is null then null
      else e.result || jsonb_build_object(
        'me_won', e.result ->> 'winner' = u::text,
        'joint', e.result ->> 'winner' = 'joint',
        'ai_won', e.result ->> 'winner' = 'ai',
        'i_helped', e.result ->> 'helper' = u::text and e.result ->> 'outcome' = 'help',
        'i_acted', coalesce(e.result -> 'actors' ? u::text, false)) end,
    'q_cap', coop.q_cap(u), 'ships_max', coop.snap_ships(u))
    order by e.id desc), '[]'::jsonb)
  from coop.riv_events e
  where e.id in (select id from coop.riv_events where pair_id = p.id
    order by id desc limit 8) $$;

-- 🆘 молба за помощ (само в „Съюзници“): p_what = 'funds' (€) или показател
-- (econ | services | energy | security | trust — точки). Идемпотентно по p_req.
create or replace function public.coop_riv_ask(
  p_req uuid, p_what text, p_amt numeric)
returns jsonb language plpgsql security definer
set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; r coop.rivalry; amt numeric;
  last timestamptz; cap numeric;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return coop.fail('none', 'Нямаш активен партньор.'); end if;
  if exists (select 1 from coop.riv_events where pair_id = p.id
      and kind = 'aid' and data ->> 'req' = p_req::text) then
    return public.coop_riv_status(); end if;
  perform pg_advisory_xact_lock(
    hashtextextended('coop_riv:' || p.id::text, 0));
  r := coop.riv_row(p);
  if r.mode <> 'allies' then
    return coop.fail('mode', 'Молбите за помощ са в режим „Съюзници“.'); end if;
  if p_what is null or p_what not in ('funds', 'econ', 'services', 'energy', 'security', 'trust') then
    return coop.fail('what', 'Непозната молба.'); end if;
  if exists (select 1 from coop.riv_events where pair_id = p.id and kind = 'aid'
      and status = 'open' and data ->> 'from' = u::text) then
    return coop.fail('open', 'Вече чакаш отговор на молба.'); end if;
  select max(opens) into last from coop.riv_events
    where pair_id = p.id and kind = 'aid' and data ->> 'from' = u::text;
  if last is not null
     and last > now() - make_interval(secs => coop.rlim('aid_gap_s')) then
    return coop.fail('gap', 'Нова молба — най-много веднъж на 30 мин.'); end if;
  if p_what = 'funds' then
    -- не повече от държавния бюджет на партньора в снимката му
    cap := least(coop.rlim('aid_funds_max'),
      coalesce(coop.snap_num(coop.other(p, u), array['pres', 'res']), coop.rlim('aid_funds_max')));
    amt := least(greatest(round(coalesce(p_amt, 0) / 1e8) * 1e8, 1e8), cap);
    if amt < 1e8 then return coop.fail('funds', 'Партньорът няма толкова в бюджета.'); end if;
  else
    amt := least(greatest(round(coalesce(p_amt, 0)), 1), coop.rlim('aid_pts_max'));
  end if;
  insert into coop.riv_events (pair_id, kind, iso, data, left_s)
    values (p.id, 'aid', 'XXX', jsonb_build_object(
      'from', u::text, 'req', p_req::text, 'what', p_what, 'amt', amt, 'mode', 'allies'),
      coop.rlim('aid_open_s')::int);
  return public.coop_riv_status();
end $$;

-- оферта / отговор (идемпотентно по p_req) — като в coop8; молбата се затваря
-- веднага щом помагащият отговори, а сам на своята молба не се отговаря
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
  if e.kind = 'aid' and e.data ->> 'from' = u::text then
    return coop.fail('own', 'Това е твоята молба.'); end if;
  b := coop.riv_bid_clean(e.kind, p_bid);
  if b is null then return coop.fail('bid', 'Невалидна оферта.'); end if;
  if e.kind = 'tender' and e.data ->> 'mode' = 'allies' then
    b := b || jsonb_build_object('joint', true); end if;   -- съюзниците — само обща оферта
  update coop.riv_events set bids = jsonb_set(bids, array[u::text],
      b || jsonb_build_object('req', p_req::text, 'at', now()), true)
    where id = e.id returning * into e;
  if e.kind = 'aid' then perform coop.riv_resolve(e, p); end if;
  return public.coop_riv_status();
end $$;

-- сделките — и в „Съюзници“ (останалото — както в coop7)
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
  if r.mode not in ('comp', 'rival', 'allies') then
    return coop.fail('mode', 'Сделките са в режим „Конкуренти“ или „Съюзници“.'); end if;
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
