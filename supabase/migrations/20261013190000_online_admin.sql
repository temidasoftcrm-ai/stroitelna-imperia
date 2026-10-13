-- „Онлайн империя“ — етап Д: пилот. Пауза на свят (часовникът спира и после продължава без загуба), изгонване на играч,
-- покани, настройки, журнал на събитията и общ преглед за администратора.

alter table online.worlds add column if not exists paused_at timestamptz;

-- часовникът на света спира по време на пауза
create or replace function online.wnow(w online.worlds) returns timestamptz language sql stable as
  $$ select coalesce(w.paused_at, now()) + make_interval(secs => w.shift_s) $$;

-- администраторът винаги може да влезе (и в частен свят), освен ако светът е затворен
create or replace function online.can_play(u uuid, w online.worlds) returns boolean language sql stable as $$
  select w.status = 'open'
     and not exists (select 1 from online.members m where m.world_id = w.id and m.user_id = u and m.banned)
     and (not w.private or online.is_admin(u) or exists (select 1 from online.members m where m.world_id = w.id and m.user_id = u))
$$;

-- светове: и тези на пауза (за да се вижда статусът), и флаг дали съм администратор
create or replace function public.ol_worlds() returns jsonb language plpgsql stable security definer set search_path = online, public as $$
declare u uuid := online.me(); adm boolean := online.is_admin(u);
begin
  return jsonb_build_object('admin', adm, 'worlds', coalesce((select jsonb_agg(jsonb_build_object(
      'id', w.id, 'slug', w.slug, 'name', w.name, 'status', w.status, 'private', w.private, 'test', w.test,
      'day', online.wday(w), 'day_seconds', w.day_seconds,
      'players', (select count(*) from online.companies c where c.world_id = w.id),
      'member', exists (select 1 from online.members m where m.world_id = w.id and m.user_id = u),
      'banned', exists (select 1 from online.members m where m.world_id = w.id and m.user_id = u and m.banned),
      'company', (select online.company_pub(c) from online.companies c where c.world_id = w.id and c.user_id = u)
    ) order by w.id)
    from online.worlds w
    where w.status <> 'closed' and (adm or not w.private or exists (select 1 from online.members m where m.world_id = w.id and m.user_id = u))), '[]'::jsonb));
end $$;

-- ── журнал: важните действия се записват автоматично (тригери) ──
create or replace function online.log_build() returns trigger language plpgsql as $$
begin
  perform online.log((select world_id from online.companies where id = new.company_id), new.company_id, null,
    case when new.contract_id is null then 'build_start' else 'contract_start' end, jsonb_build_object('build', new.id, 'title', new.title, 'reward', new.reward));
  return new;
end $$;
drop trigger if exists builds_log on online.builds;
create trigger builds_log after insert on online.builds for each row execute function online.log_build();
create or replace function online.log_done() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    perform online.log((select world_id from online.companies where id = new.company_id), new.company_id, null, 'build_' || new.status, jsonb_build_object('build', new.id, 'title', new.title));
  end if;
  return new;
end $$;
drop trigger if exists builds_done_log on online.builds;
create trigger builds_done_log after update of status on online.builds for each row execute function online.log_done();
create or replace function online.log_units() returns trigger language plpgsql as $$
begin
  perform online.log((select world_id from online.companies where id = new.company_id), new.company_id, null, 'units',
    jsonb_build_object('type', new.type, 'from', case when tg_op = 'UPDATE' then old.n else 0 end, 'to', new.n));
  return new;
end $$;
drop trigger if exists units_log on online.units;
create trigger units_log after insert or update on online.units for each row execute function online.log_units();

-- ── администрация ──
create or replace function online.admin_or_fail(u uuid) returns jsonb language sql stable as
  $$ select case when online.is_admin(u) then null else online.fail('forbidden', 'Само за администратори.') end $$;

-- пауза / продължаване / затваряне. При продължаване всички срокове се преместват с продължителността на паузата.
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
  elsif p_status = 'closed' then
    update online.worlds set status = 'closed', paused_at = coalesce(paused_at, now()) where id = w.id;
  else
    return online.fail('bad_status', 'Невалидна промяна на статуса.');
  end if;
  perform online.log(w.id, null, u, 'status', jsonb_build_object('from', w.status, 'to', p_status));
  return jsonb_build_object('ok', true);
end $$;

-- изгонване / връщане на играч: изгоненият не може да действа; активните му оферти се оттеглят и депозитите се връщат
create or replace function public.ol_admin_ban(p_world int, p_company bigint, p_ban boolean) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies; b record;
begin
  if not online.is_admin(u) then return online.admin_or_fail(u); end if;
  select * into c from online.companies where id = p_company and world_id = p_world;
  if not found then return online.fail('no_company', 'Няма такава фирма.'); end if;
  insert into online.members (world_id, user_id, banned) values (p_world, c.user_id, p_ban) on conflict (world_id, user_id) do update set banned = p_ban;
  if p_ban then
    for b in select bd.*, t.title from online.bids bd join online.tenders t on t.id = bd.tender_id where bd.company_id = c.id and bd.status = 'active' loop
      update online.bids set status = 'withdrawn' where id = b.id;
      perform online.release(b.id, c.id, b.deposit, b.title);
    end loop;
  end if;
  perform online.log(p_world, c.id, u, case when p_ban then 'ban' else 'unban' end, null);
  return jsonb_build_object('ok', true);
end $$;

-- настройки на света (само познатите ключове; числа)
create or replace function public.ol_admin_cfg(p_world int, p_cfg jsonb) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); k text; v jsonb; allowed text[] := array['offer_board','offer_days','max_builds','idle_days','max_contracts','deposit_pct','start_days',
  'tenders_local','tenders_national','tenders_global','bid_days_local','bid_days_national','bid_days_global','local_max_lv','national_min_lv','national_max_lv','global_min_lv'];
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

-- общ преглед: фирмите (с имейла на собственика — само за администратора), поканите и журнала
create or replace function public.ol_admin_overview(p_world int) returns jsonb language plpgsql stable security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds;
begin
  if not online.is_admin(u) then return online.admin_or_fail(u); end if;
  select * into w from online.worlds where id = p_world;
  if not found then return online.fail('no_world', 'Няма такъв свят.'); end if;
  return jsonb_build_object('ok', true,
    'world', to_jsonb(w) || jsonb_build_object('day', online.wday(w)),
    'companies', coalesce((select jsonb_agg(online.company_pub(c) || online.company_stats(c) || jsonb_build_object(
        'email', (select email from auth.users au where au.id = c.user_id),
        'banned', exists (select 1 from online.members m where m.world_id = w.id and m.user_id = c.user_id and m.banned),
        'last_seen_day', c.last_seen_day) order by c.id) from online.companies c where c.world_id = w.id), '[]'::jsonb),
    'members', (select count(*) from online.members where world_id = w.id),
    'invites', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from online.invites i where i.world_id = w.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('at', e.at, 'kind', e.kind, 'data', e.data, 'company', (select name from online.companies where id = e.company_id)) order by e.id desc)
       from (select * from online.events where world_id = w.id order by id desc limit 150) e), '[]'::jsonb),
    'tenders', jsonb_build_object('open', (select count(*) from online.tenders where world_id = w.id and status = 'open'),
       'awarded', (select count(*) from online.tenders where world_id = w.id and status = 'awarded'), 'no_bids', (select count(*) from online.tenders where world_id = w.id and status = 'no_bids')));
end $$;

-- светът за пилота се прави от администратора (ol_admin_world от етап А); тук — без нови данни

revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
