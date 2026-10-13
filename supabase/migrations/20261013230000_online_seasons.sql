-- „Онлайн империя“ — версия 2, стъпка 4: СЕЗОНИ — надпревари с начало и край, ясни правила за новите играчи и архив.
-- Всеки сезон трае cfg season_days (30) игрални дни; следващият започва сам (cfg auto_seasons = 1).
-- Резултат = РЪСТ НА СТОЙНОСТТА от момента на влизане в сезона (стойността е по прозрачната формула на класацията).
-- Новите фирми влизат по всяко време: тяхната основа е стойността им при влизането.
-- Дивизии по нивото при влизане (не се сменят до края): 🌱 Новаци 1–5, ⚙️ Професионалисти 6–12, 👑 Магнати 13+.
-- В края класирането се замразява в архива; първите трима във всяка дивизия получават трофей (без пари — без натрупване).
-- Изгонените фирми не се класират.

create table online.seasons (
  id bigserial primary key,
  world_id int not null references online.worlds on delete cascade,
  n int not null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  unique (world_id, n)
);
create unique index seasons_one_active on online.seasons (world_id) where status = 'active';

create table online.season_entries (
  season_id bigint not null references online.seasons on delete cascade,
  company_id bigint not null references online.companies on delete cascade,
  division text not null check (division in ('novice', 'pro', 'tycoon')),
  baseline bigint not null,
  joined_at timestamptz not null default now(),
  final_value bigint, score bigint, rank int,
  primary key (season_id, company_id)
);

create or replace function online.division_of(lv int) returns text language sql immutable as
  $$ select case when lv <= 5 then 'novice' when lv <= 12 then 'pro' else 'tycoon' end $$;
create or replace function online.division_nm(d text) returns text language sql immutable as
  $$ select case d when 'novice' then '🌱 Новаци' when 'pro' then '⚙️ Професионалисти' else '👑 Магнати' end $$;
create or replace function online.cvalue(p_company bigint) returns bigint language sql stable as
  $$ select (online.value_parts(c) ->> 'value')::bigint from online.companies c where c.id = p_company $$;

-- записва фирмите, които още не са в текущия сезон (основа = стойността им сега)
create or replace function online.season_enroll(s online.seasons) returns int language plpgsql as $$
declare cnt int;
begin
  insert into online.season_entries (season_id, company_id, division, baseline)
    select s.id, c.id, online.division_of(online.level(c.xp)), online.cvalue(c.id)
      from online.companies c where c.world_id = s.world_id
       and not exists (select 1 from online.season_entries e where e.season_id = s.id and e.company_id = c.id)
    on conflict do nothing;
  get diagnostics cnt = row_count;
  return cnt;
end $$;

-- край на сезона: замразява стойност, резултат и място по дивизии; трофеи за първите трима
create or replace function online.season_finish(p_season bigint) returns void language plpgsql as $$
declare s online.seasons; w online.worlds; r record;
begin
  select * into s from online.seasons where id = p_season for update;
  if s.status <> 'active' then return; end if;
  select * into w from online.worlds where id = s.world_id;
  if s.ends_at > online.wnow(w) then return; end if;
  update online.season_entries e set final_value = online.cvalue(e.company_id) where e.season_id = s.id;
  update online.season_entries e set score = e.final_value - e.baseline where e.season_id = s.id;
  update online.season_entries e set rank = q.rk from (
      select e2.company_id, row_number() over (partition by e2.division order by e2.score desc, e2.joined_at, e2.company_id) rk
        from online.season_entries e2 join online.companies c on c.id = e2.company_id
       where e2.season_id = s.id and not exists (select 1 from online.members m where m.world_id = s.world_id and m.user_id = c.user_id and m.banned)) q
   where e.season_id = s.id and e.company_id = q.company_id;
  update online.seasons set status = 'ended' where id = s.id;
  for r in select * from online.season_entries where season_id = s.id and rank is not null loop
    perform online.note(r.company_id, case when r.rank <= 3 then 'level' else 'info' end,
      case when r.rank <= 3 then format('%s Сезон %s: %s място в %s!', (array['🥇', '🥈', '🥉'])[r.rank], s.n, r.rank, online.division_nm(r.division))
           else format('Сезон %s приключи: %s място в %s', s.n, r.rank, online.division_nm(r.division)) end,
      format('Ръст на стойността: %s €. Започва нов сезон.', online.eur(r.score)));
  end loop;
  perform online.log(s.world_id, null, null, 'season_end', jsonb_build_object('season', s.id, 'n', s.n));
end $$;

create or replace function online.season_tick() returns int language plpgsql as $$
declare w online.worlds; s online.seasons; cnt int := 0;
begin
  for w in select * from online.worlds where status = 'open' loop
    select * into s from online.seasons where world_id = w.id and status = 'active';
    if s.id is not null and s.ends_at <= online.wnow(w) then perform online.season_finish(s.id); s := null; cnt := cnt + 1; end if;
    if s.id is null and online.cfg(w, 'auto_seasons', 1) = 1 and exists (select 1 from online.companies where world_id = w.id) then
      insert into online.seasons (world_id, n, starts_at, ends_at)
        values (w.id, coalesce((select max(ss.n) from online.seasons ss where ss.world_id = w.id), 0) + 1, online.wnow(w),
                online.wnow(w) + make_interval(secs => online.cfg(w, 'season_days', 30)::int * w.day_seconds))
        on conflict do nothing returning * into s;
      if s.id is not null then perform online.log(w.id, null, null, 'season_start', jsonb_build_object('season', s.id, 'n', s.n)); cnt := cnt + 1; end if;
    end if;
    if s.id is not null then cnt := cnt + online.season_enroll(s); end if;
  end loop;
  return cnt;
end $$;

-- ═══════════════════ API ═══════════════════
create or replace function public.ol_season(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies; w online.worlds; s online.seasons;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  select * into w from online.worlds where id = p_world;
  select * into s from online.seasons where world_id = p_world and status = 'active';
  if s.id is not null then perform online.season_enroll(s); end if;
  return jsonb_build_object('ok', true, 'server_now', online.wnow(w),
    'rules', format('Резултат = ръст на стойността от влизането в сезона (по формулата на класацията). Новите фирми влизат по всяко време — броим от момента на влизане. Дивизията се определя от нивото при влизане: 🌱 Новаци 1–5, ⚙️ Професионалисти 6–12, 👑 Магнати 13+. Сезонът трае %s игрални дни; първите трима във всяка дивизия получават трофей. Изгонените не се класират.', online.cfg(w, 'season_days', 30)),
    'season', case when s.id is null then null else jsonb_build_object('id', s.id, 'n', s.n, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'my_division', (select division from online.season_entries where season_id = s.id and company_id = c.id),
      'divisions', (select jsonb_object_agg(d, rows) from (
          select e.division d, jsonb_agg(jsonb_build_object('name', co.name, 'brand', co.brand, 'score', online.cvalue(co.id) - e.baseline, 'joined_at', e.joined_at, 'me', co.id = c.id)
                   order by online.cvalue(co.id) - e.baseline desc, e.joined_at) rows
            from online.season_entries e join online.companies co on co.id = e.company_id
           where e.season_id = s.id and not exists (select 1 from online.members m where m.world_id = p_world and m.user_id = co.user_id and m.banned)
           group by e.division) q)) end,
    'archive', coalesce((select jsonb_agg(jsonb_build_object('n', ss.n, 'ended', ss.ends_at,
        'top', (select jsonb_agg(jsonb_build_object('division', e.division, 'rank', e.rank, 'name', co.name, 'brand', co.brand, 'score', e.score) order by e.division, e.rank)
                  from online.season_entries e join online.companies co on co.id = e.company_id where e.season_id = ss.id and e.rank <= 3)) order by ss.n desc)
       from online.seasons ss where ss.world_id = p_world and ss.status = 'ended'), '[]'::jsonb));
end $$;

-- трофеите на фирма (за профила)
create or replace function public.ol_trophies(p_world int, p_company bigint) returns jsonb language plpgsql stable security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds;
begin
  select * into w from online.worlds where id = p_world;
  if not found or not online.can_play(u, w) then return online.fail('no_access', 'Нямаш достъп до този свят.'); end if;
  return jsonb_build_object('ok', true, 'trophies', coalesce((select jsonb_agg(jsonb_build_object('n', s.n, 'rank', e.rank, 'division', e.division, 'score', e.score) order by s.n desc)
    from online.season_entries e join online.seasons s on s.id = e.season_id join online.companies c on c.id = e.company_id
   where e.company_id = p_company and c.world_id = p_world and e.rank <= 3), '[]'::jsonb));
end $$;

-- админ: приключи текущия сезон сега (и следващият започва при следващия цикъл)
create or replace function public.ol_admin_season_end(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); s online.seasons; w online.worlds;
begin
  if not online.is_admin(u) then return online.fail('forbidden', 'Само за администратори.'); end if;
  select * into w from online.worlds where id = p_world;
  update online.seasons set ends_at = online.wnow(w) where world_id = p_world and status = 'active' returning * into s;
  if s.id is null then return online.fail('no_season', 'Няма активен сезон.'); end if;
  perform online.season_finish(s.id);
  perform online.log(p_world, null, u, 'season_end_admin', jsonb_build_object('season', s.id));
  return jsonb_build_object('ok', true);
end $$;

-- ── обновени: настройки (нови ключове), пауза, tick ──
create or replace function public.ol_admin_cfg(p_world int, p_cfg jsonb) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); k text; v jsonb; allowed text[] := array['offer_board','offer_days','max_builds','idle_days','max_contracts','deposit_pct','start_days',
  'tenders_local','tenders_national','tenders_global','bid_days_local','bid_days_national','bid_days_global','local_max_lv','national_min_lv','national_max_lv','global_min_lv',
  'concessions_open','max_concessions','conc_bid_days','season_days','auto_seasons'];
begin
  if not online.is_admin(u) then return online.admin_or_fail(u); end if;
  for k, v in select * from jsonb_each(coalesce(p_cfg, '{}')) loop
    if not (k = any (allowed)) or jsonb_typeof(v) <> 'number' or (v::text)::numeric < 0 or (v::text)::numeric > 1000 then
      return online.fail('bad_cfg', format('Невалидна настройка: %s', k));
    end if;
  end loop;
  update online.worlds set cfg = cfg || p_cfg where id = p_world;
  perform online.log(p_world, null, u, 'cfg', p_cfg);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.ol_admin_status(p_world int, p_status text) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds; d interval;
begin
  if not online.is_admin(u) then return online.admin_or_fail(u); end if;
  select * into w from online.worlds where id = p_world for update;
  if not found then return online.fail('no_world', 'Няма такъв свят.'); end if;
  if p_status = 'paused' and w.status = 'open' then
    update online.worlds set status = 'paused', paused_at = now() where id = w.id;
  elsif p_status = 'open' and w.status = 'paused' then
    d := now() - w.paused_at;
    update online.worlds set status = 'open', paused_at = null, epoch = epoch + d where id = w.id;
    update online.builds b set start_at = start_at + d, end_at = end_at + d from online.companies c where c.id = b.company_id and c.world_id = w.id and b.status = 'running';
    update online.tenders set opens_at = opens_at + d, closes_at = closes_at + d where world_id = w.id and status = 'open';
    update online.contracts k set start_by = start_by + d from online.companies c where c.id = k.company_id and c.world_id = w.id and k.status = 'awaiting';
    update online.consortia set forming_until = forming_until + d, start_at = start_at + d, end_at = end_at + d, op_until = op_until + d where world_id = w.id and status in ('forming', 'building', 'operating');
    update online.conc_rounds set closes_at = closes_at + d, start_at = start_at + d, end_at = end_at + d where world_id = w.id and status in ('auction', 'active');
    update online.seasons set starts_at = starts_at + d, ends_at = ends_at + d where world_id = w.id and status = 'active';
  elsif p_status = 'closed' then
    update online.worlds set status = 'closed', paused_at = coalesce(paused_at, now()) where id = w.id;
  else
    return online.fail('bad_status', 'Невалидна промяна на статуса.');
  end if;
  perform online.log(w.id, null, u, 'status', jsonb_build_object('from', w.status, 'to', p_status));
  return jsonb_build_object('ok', true);
end $$;

create or replace function online.tick() returns int language plpgsql as $$
declare r record; n int := 0; ww online.worlds;
begin
  for r in select t.id from online.tenders t join online.worlds w on w.id = t.world_id where w.status = 'open' and t.status = 'open' and t.closes_at <= online.wnow(w) order by t.closes_at loop
    perform online.resolve_tender(r.id); n := n + 1;
  end loop;
  for r in select k.id from online.contracts k join online.companies c on c.id = k.company_id join online.worlds w on w.id = c.world_id
     where w.status = 'open' and k.status = 'awaiting' and k.start_by <= online.wnow(w) loop
    perform online.fail_contract(r.id); n := n + 1;
  end loop;
  n := n + online.cons_tick();
  n := n + online.conc_tick();
  n := n + online.season_tick();
  for r in select c.id from online.companies c join online.worlds w on w.id = c.world_id
     where w.status = 'open' and (c.settled_day < online.wday(w)
        or exists (select 1 from online.builds b where b.company_id = c.id and b.status = 'running' and b.end_at <= online.wnow(w))
        or exists (select 1 from online.contracts k join online.builds b on b.id = k.build_id where k.company_id = c.id and k.status = 'running' and b.status = 'done'))
     for update of c skip locked loop
    perform online.settle_all(r.id); n := n + 1;
  end loop;
  for ww in select * from online.worlds where status = 'open' loop n := n + online.publish_tenders(ww); end loop;
  return n;
end $$;

revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
