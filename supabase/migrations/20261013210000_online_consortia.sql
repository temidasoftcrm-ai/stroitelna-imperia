-- „Онлайн империя“ — версия 2, стъпка 2: КОНСОРЦИУМИ — общи мегапроекти с предварително определени вноски и дялове.
-- Една фирма основава консорциум за мегапроект и заявява дял (10–60%, през 5%); вноската = дял × цената на проекта и се
-- плаща веднага. Основателят кани други фирми с предложен дял (или консорциумът е отворен). Щом дяловете станат 100%,
-- строежът тръгва сам. Ако до срока не се съберат — консорциумът се разпада и всички вноски се връщат (точно веднъж).
-- Готовият проект носи дивиденти всеки ден по дяловете за срока на експлоатацията (концесия); после проектът се освобождава
-- за нов кръг — никой не го държи завинаги. Минимум 2 фирми, никоя над 60%.

create table online.mega_types (
  key text primary key, nm text not null, ico text not null, what text not null,
  cost bigint not null, days int not null, revenue bigint not null, op_days int not null, forming_days int not null, min_level int not null
);
insert into online.mega_types values
  ('bosphorus', 'Трети мост над Босфора', '🌉', 'висящ мост за влакове и коли между Европа и Азия', 300000000, 20, 8000000, 60, 4, 4),
  ('capecairo', 'Железница Кейп–Кайро', '🚂', 'жп линия през цяла Африка — от Кейптаун до Кайро', 1200000000, 30, 28000000, 60, 5, 6),
  ('panama', 'Разширение на Панамския канал', '🚢', 'нови шлюзове за най-големите кораби', 2500000000, 35, 55000000, 60, 5, 8),
  ('transsib', 'Транссибирска магистрала', '🛤️', 'двупътна високоскоростна линия Москва — Владивосток', 4000000000, 45, 85000000, 60, 6, 10);

create table online.consortia (
  id bigserial primary key,
  world_id int not null references online.worlds on delete cascade,
  mtype text not null references online.mega_types,
  founder bigint not null references online.companies on delete cascade,
  open boolean not null default false,
  status text not null default 'forming' check (status in ('forming', 'building', 'operating', 'expired', 'dissolved')),
  forming_until timestamptz not null,
  start_at timestamptz, end_at timestamptz, op_until timestamptz,
  paid_day int,                        -- дивидентите са изплатени до този ден включително
  created_at timestamptz not null default now()
);
create unique index consortia_active on online.consortia (world_id, mtype) where status in ('forming', 'building', 'operating');

create table online.cmembers (
  consortium_id bigint not null references online.consortia on delete cascade,
  company_id bigint not null references online.companies on delete cascade,
  pct int not null check (pct between 10 and 60 and pct % 5 = 0),
  amount bigint not null,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (consortium_id, company_id)
);
create table online.cinvites (
  consortium_id bigint not null references online.consortia on delete cascade,
  company_id bigint not null references online.companies on delete cascade,
  pct int not null check (pct between 10 and 60 and pct % 5 = 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  at timestamptz not null default now(),
  primary key (consortium_id, company_id)
);

create or replace function online.cons_taken(p_cons bigint) returns int language sql stable as
  $$ select coalesce(sum(pct), 0)::int from online.cmembers where consortium_id = p_cons $$;
create or replace function online.day_of(w online.worlds, ts timestamptz) returns int language sql stable as
  $$ select (floor(extract(epoch from (ts - w.epoch)) / w.day_seconds))::int + 1 $$;

-- влизане в консорциум (общо за основател, покана и отворен): заключва консорциума, проверява дела, плаща вноската;
-- щом станат 100% — строежът тръгва. Връща null при успех или текст на грешката.
create or replace function online.cons_add(p_cons bigint, c online.companies, p_pct int) returns text language plpgsql as $$
declare k online.consortia; m online.mega_types; w online.worlds; amt bigint; taken int;
begin
  select * into k from online.consortia where id = p_cons for update;
  if not found or k.status <> 'forming' then return 'Консорциумът вече не приема членове.'; end if;
  select * into w from online.worlds where id = k.world_id;
  if k.forming_until <= online.wnow(w) then return 'Срокът за събиране изтече.'; end if;
  select * into m from online.mega_types where key = k.mtype;
  if online.level(c.xp) < m.min_level then return format('За „%s“ трябва ниво %s.', m.nm, m.min_level); end if;
  if p_pct is null or p_pct < 10 or p_pct > 60 or p_pct % 5 <> 0 then return 'Делът е от 10% до 60%, през 5%.'; end if;
  if exists (select 1 from online.cmembers where consortium_id = k.id and company_id = c.id) then return 'Вече си член.'; end if;
  taken := online.cons_taken(k.id);
  if taken + p_pct > 100 then return format('Свободни са само %s%%.', 100 - taken); end if;
  amt := m.cost * p_pct / 100;
  if not online.money(c.id, -amt, 'консорциум', format('Вноска %s%% в „%s“', p_pct, m.nm), null) then
    return format('Нямаш %s € за вноската.', online.eur(amt));
  end if;
  insert into online.cmembers (consortium_id, company_id, pct, amount) values (k.id, c.id, p_pct, amt);
  update online.cinvites set status = 'accepted' where consortium_id = k.id and company_id = c.id;
  if taken + p_pct = 100 then
    update online.consortia set status = 'building', start_at = online.wnow(w), end_at = online.wnow(w) + make_interval(secs => m.days * w.day_seconds) where id = k.id;
    perform online.note(cm.company_id, 'good', format('%s „%s“ — строежът започна!', m.ico, m.nm), format('Дяловете са събрани (100%%). Готов след %s игрални дни.', m.days)) from online.cmembers cm where cm.consortium_id = k.id;
    perform online.log(k.world_id, null, null, 'cons_building', jsonb_build_object('cons', k.id, 'mtype', k.mtype));
  else
    perform online.note(k.founder, 'info', format('🤝 %s влезе в „%s“ с %s%%', c.name, m.nm, p_pct), format('Събрани %s%% от 100%%.', taken + p_pct)) where k.founder <> c.id;
  end if;
  return null;
end $$;

-- разпадане (срокът изтече или основателят се отказа): всяка вноска се връща точно веднъж
create or replace function online.cons_dissolve(p_cons bigint, p_why text) returns void language plpgsql as $$
declare k online.consortia; m online.mega_types; r record;
begin
  select * into k from online.consortia where id = p_cons for update;
  if k.status <> 'forming' then return; end if;
  select * into m from online.mega_types where key = k.mtype;
  update online.consortia set status = 'dissolved' where id = k.id;
  for r in select * from online.cmembers where consortium_id = k.id loop
    perform online.money(r.company_id, r.amount, 'консорциум', format('Върната вноска: „%s“', m.nm), 'cons:' || k.id || ':back');
    perform online.note(r.company_id, 'info', format('Консорциумът „%s“ се разпадна', m.nm), p_why || format(' Вноската от %s € е върната.', online.eur(r.amount)));
  end loop;
  update online.cinvites set status = 'declined' where consortium_id = k.id and status = 'pending';
  perform online.log(k.world_id, null, null, 'cons_dissolved', jsonb_build_object('cons', k.id, 'why', p_why));
end $$;

-- планираната задача за консорциумите: разпадане, завършване, дивиденти по дни, край на концесията
create or replace function online.cons_tick() returns int language plpgsql as $$
declare k record; m online.mega_types; w online.worlds; n int := 0; sd int; ed int; d int; upto int; r record; days int;
begin
  for k in select * from online.consortia where status in ('forming', 'building', 'operating') order by id loop
    select * into w from online.worlds where id = k.world_id;
    if w.status <> 'open' then continue; end if;
    select * into m from online.mega_types where key = k.mtype;
    if k.status = 'forming' and k.forming_until <= online.wnow(w) then
      perform online.cons_dissolve(k.id, 'Дяловете не се събраха до срока.'); n := n + 1; continue;
    end if;
    if k.status = 'building' and k.end_at <= online.wnow(w) then
      update online.consortia set status = 'operating', op_until = k.end_at + make_interval(secs => m.op_days * w.day_seconds),
        paid_day = online.day_of(w, k.end_at) - 1 where id = k.id and status = 'building';
      get diagnostics sd = row_count;
      if sd = 1 then perform online.note(cm.company_id, 'good', format('%s „%s“ е готов!', m.ico, m.nm),
        format('Твоят дял: %s%% → ~%s € на ден за %s игрални дни.', cm.pct, online.eur(m.revenue * cm.pct / 100), m.op_days)) from online.cmembers cm where cm.consortium_id = k.id;
      perform online.log(k.world_id, null, null, 'cons_operating', jsonb_build_object('cons', k.id)); end if;
      select * into k from online.consortia where id = k.id; n := n + 1;
    end if;
    if k.status = 'operating' then
      perform 1 from online.consortia where id = k.id for update;
      select paid_day into k.paid_day from online.consortia where id = k.id;
      d := online.wday(w); ed := online.day_of(w, k.op_until) - 1; upto := least(d - 1, ed);
      if upto > k.paid_day then
        days := upto - k.paid_day;
        for r in select * from online.cmembers where consortium_id = k.id loop
          perform online.money(r.company_id, m.revenue * r.pct / 100 * days, 'дивидент',
            format('%s %s: дял %s%%, %s', m.ico, m.nm, r.pct, case when days > 1 then format('дни %s–%s', k.paid_day + 1, upto) else format('ден %s', upto) end),
            'cons:' || k.id || ':d' || (k.paid_day + 1));
        end loop;
        update online.consortia set paid_day = upto where id = k.id; n := n + 1;
      end if;
      if upto >= ed and k.op_until <= online.wnow(w) then
        update online.consortia set status = 'expired' where id = k.id;
        perform online.note(cm.company_id, 'info', format('%s Концесията за „%s“ изтече', m.ico, m.nm), 'Проектът се връща на държавата — може да се основе нов консорциум.') from online.cmembers cm where cm.consortium_id = k.id;
      end if;
    end if;
  end loop;
  return n;
end $$;

-- tick (етап В) + консорциумите
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

-- стойност: + дялове в консорциуми (вноската докато се събира/строи; по време на експлоатацията — намалява до 0)
create or replace function online.stakes(p_company bigint) returns bigint language sql stable as $$
  select coalesce(sum(case k.status when 'operating' then
           (cm.amount * greatest(0, extract(epoch from (k.op_until - online.wnow(w)))) / greatest(1, extract(epoch from (k.op_until - k.end_at))))::bigint
           else cm.amount end), 0)::bigint
    from online.cmembers cm join online.consortia k on k.id = cm.consortium_id join online.worlds w on w.id = k.world_id
   where cm.company_id = p_company and k.status in ('forming', 'building', 'operating')
$$;
create or replace function online.value_parts(c online.companies) returns jsonb language sql stable as $$
  with u as (select coalesce(sum(u.n * t.cost / 2), 0)::bigint v from online.units u join online.unit_types t using (type) where u.company_id = c.id),
       f as (select coalesce(sum(f.n * t.cost / 2), 0)::bigint v from online.facilities f join online.facility_types t using (type) where f.company_id = c.id),
       w as (select coalesce(sum(b.mat), 0)::bigint v from online.builds b where b.company_id = c.id and b.status = 'running'),
       g as (select coalesce(sum(floor(q.qty * gd.price * online.buyback_pct())), 0)::bigint v from (
               select good, qty from online.inventory where company_id = c.id
               union all select good, qty from online.asks where company_id = c.id and status = 'open') q join online.goods gd using (good)),
       s as (select online.stakes(c.id) v)
  select jsonb_build_object('cash', c.cash, 'held', c.held, 'units', u.v, 'facilities', f.v, 'goods', g.v, 'wip', w.v, 'stakes', s.v,
                            'value', c.cash + c.held + u.v + f.v + g.v + w.v + s.v) from u, f, w, g, s
$$;
create or replace function online.profit(c online.companies, p_days int) returns bigint language sql stable as $$
  with w as (select * from online.worlds where id = c.world_id), d as (select online.wday(w) - p_days as from_day from w)
  select (coalesce((select sum(l.amount) from online.ledger l, d where l.company_id = c.id and l.day > d.from_day
                      and l.reason in ('строеж', 'търг', 'материали', 'поддръжка', 'продажба', 'стоки', 'енергия', 'гориво', 'дивидент')), 0)
        - coalesce((select sum(k.deposit) from online.contracts k join online.ledger l on l.company_id = k.company_id and l.ref = 'dep:' || k.bid_id || ':lost', d
                      where k.company_id = c.id and k.status = 'failed' and l.day > d.from_day), 0))::bigint
$$;
create or replace function public.ol_ranking_formula() returns text language sql immutable as
  $$ select 'Стойност = наличност + блокирани депозити + техника и производства по 50% + стоки по изкупната цена (60%) + строежи в ход + дялове в консорциуми (вноската; по време на концесията намалява до 0); отрицателната наличност е задължение и се приспада. Печалба = приходи от строежи, договори, продажби и дивиденти − материали, стоки, енергия, гориво и поддръжка − задържани депозити за последните 7 игрални дни.' $$;

-- ═══════════════════ API ═══════════════════
create or replace function public.ol_consortia(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies; w online.worlds;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  select * into w from online.worlds where id = p_world;
  perform online.cons_tick();
  return jsonb_build_object('ok', true, 'level', online.level(c.xp), 'cash', c.cash, 'me', c.id, 'server_now', online.wnow(w),
    'projects', (select jsonb_agg(to_jsonb(m) || jsonb_build_object('cons', (
        select jsonb_build_object('id', k.id, 'status', k.status, 'open', k.open, 'founder', (select name from online.companies where id = k.founder), 'founder_me', k.founder = c.id,
          'forming_until', k.forming_until, 'end_at', k.end_at, 'op_until', k.op_until, 'taken', online.cons_taken(k.id),
          'members', coalesce((select jsonb_agg(jsonb_build_object('name', co.name, 'brand', co.brand, 'pct', cm.pct, 'me', co.id = c.id) order by cm.pct desc, cm.joined_at)
              from online.cmembers cm join online.companies co on co.id = cm.company_id where cm.consortium_id = k.id), '[]'::jsonb),
          'invites', case when k.founder = c.id then coalesce((select jsonb_agg(jsonb_build_object('name', co.name, 'pct', ci.pct, 'status', ci.status)) from online.cinvites ci join online.companies co on co.id = ci.company_id where ci.consortium_id = k.id), '[]'::jsonb) else null end,
          'my_invite', (select jsonb_build_object('pct', ci.pct) from online.cinvites ci where ci.consortium_id = k.id and ci.company_id = c.id and ci.status = 'pending'))
        from online.consortia k where k.world_id = p_world and k.mtype = m.key and k.status in ('forming', 'building', 'operating')),
        'past', (select count(*) from online.consortia k where k.world_id = p_world and k.mtype = m.key and k.status = 'expired')) order by m.cost) from online.mega_types m),
    'partners', coalesce((select jsonb_agg(jsonb_build_object('id', co.id, 'name', co.name, 'brand', co.brand, 'level', online.level(co.xp)) order by co.xp desc)
       from online.companies co where co.world_id = p_world and co.id <> c.id and not exists (select 1 from online.members mm where mm.world_id = p_world and mm.user_id = co.user_id and mm.banned)), '[]'::jsonb));
end $$;

create or replace function public.ol_cons_found(p_req uuid, p_world int, p_mtype text, p_pct int, p_open boolean) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; w online.worlds; m online.mega_types; kid bigint; err text;
begin
  r := online.req_begin(u, p_req, 'cons_found'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into w from online.worlds where id = p_world;
  select * into m from online.mega_types where key = p_mtype;
  if not found then return online.req_end(u, p_req, online.fail('bad_type', 'Няма такъв мегапроект.')); end if;
  if online.level(c.xp) < m.min_level then return online.req_end(u, p_req, online.fail('level', format('За „%s“ трябва ниво %s.', m.nm, m.min_level))); end if;
  if exists (select 1 from online.consortia where world_id = p_world and mtype = p_mtype and status in ('forming', 'building', 'operating')) then
    return online.req_end(u, p_req, online.fail('taken', 'За този мегапроект вече има консорциум.'));
  end if;
  insert into online.consortia (world_id, mtype, founder, open, forming_until) values (p_world, p_mtype, c.id, coalesce(p_open, false), online.wnow(w) + make_interval(secs => m.forming_days * w.day_seconds)) returning id into kid;
  err := online.cons_add(kid, c, p_pct);
  if err is not null then raise exception 'cons_found_failed' using detail = err; end if;   -- връщаме и консорциума
  perform online.log(p_world, c.id, u, 'cons_found', jsonb_build_object('cons', kid, 'mtype', p_mtype, 'pct', p_pct));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'cons', kid));
exception when raise_exception then
  if sqlerrm = 'cons_found_failed' then
    get stacked diagnostics err = pg_exception_detail;
    return online.fail('cannot', err);
  end if;
  raise;
end $$;

create or replace function public.ol_cons_invite(p_req uuid, p_world int, p_cons bigint, p_company bigint, p_pct int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; k online.consortia; m online.mega_types; t online.companies;
begin
  r := online.req_begin(u, p_req, 'cons_invite'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into k from online.consortia where id = p_cons and world_id = p_world;
  if not found or k.founder <> c.id then return online.req_end(u, p_req, online.fail('not_founder', 'Само основателят кани партньори.')); end if;
  if k.status <> 'forming' then return online.req_end(u, p_req, online.fail('closed', 'Консорциумът вече не приема членове.')); end if;
  select * into t from online.companies where id = p_company and world_id = p_world and id <> c.id;
  if not found then return online.req_end(u, p_req, online.fail('no_company', 'Няма такава фирма.')); end if;
  if p_pct is null or p_pct < 10 or p_pct > 60 or p_pct % 5 <> 0 or online.cons_taken(k.id) + p_pct > 100 then
    return online.req_end(u, p_req, online.fail('bad_pct', format('Делът е от 10%% до 60%%, през 5%%; свободни са %s%%.', 100 - online.cons_taken(k.id))));
  end if;
  select * into m from online.mega_types where key = k.mtype;
  insert into online.cinvites (consortium_id, company_id, pct) values (k.id, t.id, p_pct)
    on conflict (consortium_id, company_id) do update set pct = excluded.pct, status = 'pending', at = now();
  perform online.note(t.id, 'invite', format('🤝 %s предлага партньорство на твоята фирма', c.name),
    format('%s „%s“ — дял %s%% (вноска %s €). Отговори в таб „🤝 Консорциуми“.', m.ico, m.nm, p_pct, online.eur(m.cost * p_pct / 100)));
  perform online.log(p_world, c.id, u, 'cons_invite', jsonb_build_object('cons', k.id, 'to', t.id, 'pct', p_pct));
  return online.req_end(u, p_req, jsonb_build_object('ok', true));
end $$;

-- приемане на покана (делът е от поканата) или влизане в отворен консорциум (с избран дял)
create or replace function public.ol_cons_join(p_req uuid, p_world int, p_cons bigint, p_pct int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; k online.consortia; inv online.cinvites; err text; pct int := p_pct;
begin
  r := online.req_begin(u, p_req, 'cons_join'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into k from online.consortia where id = p_cons and world_id = p_world;
  if not found then return online.req_end(u, p_req, online.fail('no_cons', 'Няма такъв консорциум.')); end if;
  select * into inv from online.cinvites where consortium_id = k.id and company_id = c.id and status = 'pending';
  if inv.pct is not null then pct := inv.pct;
  elsif not k.open then return online.req_end(u, p_req, online.fail('closed', 'Консорциумът е само с покани.')); end if;
  err := online.cons_add(k.id, c, pct);
  if err is not null then return online.req_end(u, p_req, online.fail('cannot', err)); end if;
  perform online.log(p_world, c.id, u, 'cons_join', jsonb_build_object('cons', k.id, 'pct', pct));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'pct', pct));
end $$;

create or replace function public.ol_cons_decline(p_req uuid, p_world int, p_cons bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; k online.consortia; m online.mega_types;
begin
  r := online.req_begin(u, p_req, 'cons_decline'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  update online.cinvites set status = 'declined' where consortium_id = p_cons and company_id = c.id and status = 'pending';
  if not found then return online.req_end(u, p_req, online.fail('no_invite', 'Нямаш покана.')); end if;
  select * into k from online.consortia where id = p_cons; select * into m from online.mega_types where key = k.mtype;
  perform online.note(k.founder, 'info', format('%s отказа партньорството', c.name), format('„%s“', m.nm));
  return online.req_end(u, p_req, jsonb_build_object('ok', true));
end $$;

-- излизане преди строежа: вноската се връща; ако излезе основателят — консорциумът се разпада
create or replace function public.ol_cons_leave(p_req uuid, p_world int, p_cons bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; k online.consortia; cm online.cmembers; m online.mega_types;
begin
  r := online.req_begin(u, p_req, 'cons_leave'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into k from online.consortia where id = p_cons and world_id = p_world for update;
  if not found or k.status <> 'forming' then return online.req_end(u, p_req, online.fail('locked', 'След началото на строежа не може да се излезе.')); end if;
  select * into cm from online.cmembers where consortium_id = k.id and company_id = c.id;
  if not found then return online.req_end(u, p_req, online.fail('not_member', 'Не си член.')); end if;
  if k.founder = c.id then perform online.cons_dissolve(k.id, format('Основателят %s се отказа.', c.name)); return online.req_end(u, p_req, jsonb_build_object('ok', true, 'dissolved', true)); end if;
  select * into m from online.mega_types where key = k.mtype;
  delete from online.cmembers where consortium_id = k.id and company_id = c.id;
  perform online.money(c.id, cm.amount, 'консорциум', format('Върната вноска (излизане): „%s“', m.nm), 'cons:' || k.id || ':out:' || c.id || ':' || extract(epoch from cm.joined_at)::bigint);
  perform online.note(k.founder, 'info', format('%s излезе от „%s“', c.name, m.nm), format('Освободени %s%%.', cm.pct));
  return online.req_end(u, p_req, jsonb_build_object('ok', true));
end $$;

-- пауза: при продължаване се местят и сроковете на консорциумите
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
  elsif p_status = 'closed' then
    update online.worlds set status = 'closed', paused_at = coalesce(paused_at, now()) where id = w.id;
  else
    return online.fail('bad_status', 'Невалидна промяна на статуса.');
  end if;
  perform online.log(w.id, null, u, 'status', jsonb_build_object('from', w.status, 'to', p_status));
  return jsonb_build_object('ok', true);
end $$;

revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
