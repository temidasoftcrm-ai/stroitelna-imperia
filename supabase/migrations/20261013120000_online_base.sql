-- „Онлайн империя“ — етап А: светове, членство, покани, фирми, финансов журнал, идемпотентност, лимит на заявките.
-- Всичко е в схема online, до която клиентът НЯМА пряк достъп. Клиентът вика само функциите public.ol_* (SECURITY DEFINER):
-- те проверяват auth.uid(), правата и собствеността и сами пишат в таблиците. Самостоятелната игра (public.saves) не се пипа.
-- Парите са в цели евроцентове (bigint) — без дробни числа.

create schema if not exists online;
revoke all on schema online from public, anon, authenticated;

-- ── светове ──
create table online.worlds (
  id serial primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,32}$'),
  name text not null,
  status text not null default 'open' check (status in ('open', 'paused', 'closed')),
  private boolean not null default true,          -- частен свят: влиза се само с покана
  test boolean not null default false,            -- тестов свят: админът може да мести часовника му (за проверки)
  epoch timestamptz not null default now(),       -- ден 1 започва тук
  day_seconds int not null default 600 check (day_seconds between 10 and 86400),   -- темпо: реални секунди за 1 игрален ден
  shift_s bigint not null default 0,              -- преместване на часовника (само в тестов свят)
  cfg jsonb not null default '{}'::jsonb,         -- срокове на търговете, лимит на договорите, правила за отсъствие…
  created_at timestamptz not null default now()
);

create table online.admins (user_id uuid primary key, at timestamptz not null default now());

create table online.invites (
  code text primary key check (code ~ '^[A-Z0-9]{6,16}$'),
  world_id int not null references online.worlds on delete cascade,
  max_uses int not null default 20 check (max_uses > 0),
  uses int not null default 0,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table online.members (
  world_id int not null references online.worlds on delete cascade,
  user_id uuid not null,
  role text not null default 'player' check (role in ('player', 'admin')),
  banned boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (world_id, user_id)
);

-- ── фирми: един акаунт = една фирма в свят ──
create table online.companies (
  id bigserial primary key,
  world_id int not null references online.worlds on delete cascade,
  user_id uuid not null,
  name text not null check (char_length(name) between 3 and 32),
  brand text not null check (brand in ('industrial', 'titan', 'atlas', 'horizon', 'imperial')),
  city text not null,
  cash bigint not null,                 -- евроцентове
  xp bigint not null default 0,
  settled_day int not null default 1,   -- приходите/разходите са уредени до началото на този ден
  created_at timestamptz not null default now(),
  unique (world_id, user_id)
);
create unique index companies_name_uq on online.companies (world_id, lower(name));

-- ── финансов журнал: всяко движение на пари с причина; ref гарантира, че едно плащане се записва веднъж ──
create table online.ledger (
  id bigserial primary key,
  company_id bigint not null references online.companies on delete cascade,
  day int not null,
  amount bigint not null,
  cash_after bigint not null,
  reason text not null,
  note text,
  ref text,
  at timestamptz not null default now()
);
create unique index ledger_once on online.ledger (company_id, ref) where ref is not null;
create index ledger_company on online.ledger (company_id, id desc);

-- ── известия за играча ──
create table online.notes (
  id bigserial primary key,
  company_id bigint not null references online.companies on delete cascade,
  kind text not null,
  title text not null,
  body text,
  seen boolean not null default false,
  at timestamptz not null default now()
);
create index notes_company on online.notes (company_id, id desc);

-- ── идемпотентност: всяка заявка носи req_id; повторената връща записания резултат ──
create table online.requests (
  user_id uuid not null,
  req_id uuid not null,
  fn text not null,
  result jsonb,
  at timestamptz not null default now(),
  primary key (user_id, req_id)
);

-- ── лимит на заявките (плъзгащ се прозорец от 60 s) ──
create table online.rate (user_id uuid primary key, win timestamptz not null, n int not null);

-- ── административен журнал ──
create table online.events (
  id bigserial primary key,
  world_id int,
  company_id bigint,
  user_id uuid,
  kind text not null,
  data jsonb,
  at timestamptz not null default now()
);
create index events_world on online.events (world_id, id desc);

-- ── константи ──
create or replace function online.start_cash() returns bigint language sql immutable as $$ select 2000000::bigint $$;   -- 20 000 €
create or replace function online.rate_max() returns int language sql immutable as $$ select 60 $$;                     -- заявки за 60 s
create or replace function online.cities() returns text[] language sql immutable as
  $$ select array['sofia','plovdiv','varna','burgas','ruse','stz','pleven','vt','blg','shumen','dobrich','sliven','haskovo'] $$;

-- ── време на света ──
create or replace function online.wnow(w online.worlds) returns timestamptz language sql stable as
  $$ select now() + make_interval(secs => w.shift_s) $$;
-- текущият игрален ден (от 1) и частта от него (0..1)
create or replace function online.wday(w online.worlds) returns int language sql stable as
  $$ select (floor(extract(epoch from (online.wnow(w) - w.epoch)) / w.day_seconds))::int + 1 $$;
create or replace function online.wfrac(w online.worlds) returns float8 language sql stable as
  $$ select mod(extract(epoch from (online.wnow(w) - w.epoch))::numeric, w.day_seconds)::float8 / w.day_seconds $$;
create or replace function online.cfg(w online.worlds, k text, d numeric) returns numeric language sql stable as
  $$ select coalesce((w.cfg ->> k)::numeric, d) $$;

-- ── вход, лимит, идемпотентност ──
create or replace function online.me() returns uuid language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return u;
end $$;

create or replace function online.is_admin(u uuid) returns boolean language sql stable as
  $$ select exists (select 1 from online.admins where user_id = u) $$;

create or replace function online.throttle(u uuid) returns void language plpgsql as $$
declare r online.rate;
begin
  insert into online.rate as t (user_id, win, n) values (u, now(), 1)
    on conflict (user_id) do update set
      n = case when t.win < now() - interval '60 seconds' then 1 else t.n + 1 end,
      win = case when t.win < now() - interval '60 seconds' then now() else t.win end
    returning * into r;
  if r.n > online.rate_max() then raise exception 'rate_limited' using errcode = 'P0001', hint = 'Твърде много заявки — изчакай малко.'; end if;
end $$;

-- Започва действие: връща записания резултат, ако req_id вече е обработен; иначе null (и „заключва“ req_id до края
-- на транзакцията — едновременна втора заявка със същия req_id чака и после получава същия резултат).
create or replace function online.req_begin(u uuid, p_req uuid, p_fn text) returns jsonb language plpgsql as $$
declare r jsonb; ins int;
begin
  if p_req is null then raise exception 'req_id_required' using errcode = '22023'; end if;
  insert into online.requests (user_id, req_id, fn) values (u, p_req, p_fn) on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 1 then perform online.throttle(u); return null; end if;
  select result into r from online.requests where user_id = u and req_id = p_req;
  return coalesce(r, jsonb_build_object('ok', false, 'err', 'duplicate_pending'));
end $$;

create or replace function online.req_end(u uuid, p_req uuid, r jsonb) returns jsonb language plpgsql as $$
begin
  update online.requests set result = r where user_id = u and req_id = p_req;
  return r;
end $$;

create or replace function online.fail(code text, msg text) returns jsonb language sql immutable as
  $$ select jsonb_build_object('ok', false, 'err', code, 'msg', msg) $$;

-- Единственият начин парите да се променят: заключва фирмата, проверява наличността и пише в журнала.
-- Връща false, ако няма пари (при allow_neg = false) или ако ref вече е записан (плащането е било направено).
create or replace function online.money(p_company bigint, p_amount bigint, p_reason text, p_note text, p_ref text, p_allow_neg boolean default false)
returns boolean language plpgsql as $$
declare c online.companies; w online.worlds; d int;
begin
  select * into c from online.companies where id = p_company for update;
  if not found then return false; end if;
  if p_ref is not null and exists (select 1 from online.ledger where company_id = p_company and ref = p_ref) then return false; end if;
  if p_amount < 0 and not p_allow_neg and c.cash + p_amount < 0 then return false; end if;
  select * into w from online.worlds where id = c.world_id;
  d := online.wday(w);
  update online.companies set cash = cash + p_amount where id = p_company;
  insert into online.ledger (company_id, day, amount, cash_after, reason, note, ref) values (p_company, d, p_amount, c.cash + p_amount, p_reason, p_note, p_ref);
  return true;
end $$;

create or replace function online.note(p_company bigint, p_kind text, p_title text, p_body text) returns void language sql as
  $$ insert into online.notes (company_id, kind, title, body) values (p_company, p_kind, p_title, p_body) $$;

create or replace function online.log(p_world int, p_company bigint, p_user uuid, p_kind text, p_data jsonb) returns void language sql as
  $$ insert into online.events (world_id, company_id, user_id, kind, data) values (p_world, p_company, p_user, p_kind, p_data) $$;

-- Може ли акаунтът да играе в света (член е или светът е публичен; не е изгонен; светът е отворен)
create or replace function online.can_play(u uuid, w online.worlds) returns boolean language sql stable as $$
  select w.status = 'open'
     and not exists (select 1 from online.members m where m.world_id = w.id and m.user_id = u and m.banned)
     and (not w.private or exists (select 1 from online.members m where m.world_id = w.id and m.user_id = u))
$$;

-- ── публичното представяне на фирма (за класацията и профилите — без лични данни) ──
create or replace function online.company_pub(c online.companies) returns jsonb language sql stable as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'brand', c.brand, 'city', c.city, 'xp', c.xp, 'since', c.created_at)
$$;

-- ═══════════════════ API за клиента (public.ol_*) ═══════════════════

-- Световете, които виждам: публичните отворени + тези, в които съм член; с моята фирма, ако имам.
create or replace function public.ol_worlds() returns jsonb language plpgsql stable security definer set search_path = online, public as $$
declare u uuid := online.me();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', w.id, 'slug', w.slug, 'name', w.name, 'status', w.status, 'private', w.private,
      'day', online.wday(w), 'day_seconds', w.day_seconds,
      'players', (select count(*) from online.companies c where c.world_id = w.id),
      'member', exists (select 1 from online.members m where m.world_id = w.id and m.user_id = u),
      'company', (select online.company_pub(c) from online.companies c where c.world_id = w.id and c.user_id = u)
    ) order by w.id)
    from online.worlds w
    where w.status <> 'closed' and (not w.private or exists (select 1 from online.members m where m.world_id = w.id and m.user_id = u and not m.banned))), '[]'::jsonb);
end $$;

-- Влизане в частен свят с код за покана
create or replace function public.ol_join(p_req uuid, p_code text) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; i online.invites;
begin
  r := online.req_begin(u, p_req, 'join'); if r is not null then return r; end if;
  select * into i from online.invites where code = upper(trim(p_code)) for update;
  if not found or (i.expires_at is not null and i.expires_at < now()) or i.uses >= i.max_uses then
    return online.req_end(u, p_req, online.fail('bad_invite', 'Невалидна или изтекла покана.'));
  end if;
  if exists (select 1 from online.members where world_id = i.world_id and user_id = u) then
    return online.req_end(u, p_req, jsonb_build_object('ok', true, 'world', i.world_id, 'already', true));
  end if;
  insert into online.members (world_id, user_id) values (i.world_id, u);
  update online.invites set uses = uses + 1 where code = i.code;
  perform online.log(i.world_id, null, u, 'join', jsonb_build_object('code', i.code));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'world', i.world_id));
end $$;

-- Създаване на фирма: една на акаунт в свят; начални пари от сървъра (нищо не се прехвърля от локален запис)
create or replace function public.ol_create_company(p_req uuid, p_world int, p_name text, p_brand text, p_city text) returns jsonb
language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; w online.worlds; c online.companies; nm text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  r := online.req_begin(u, p_req, 'create_company'); if r is not null then return r; end if;
  select * into w from online.worlds where id = p_world;
  if not found or not online.can_play(u, w) then return online.req_end(u, p_req, online.fail('no_access', 'Нямаш достъп до този свят.')); end if;
  if exists (select 1 from online.companies where world_id = p_world and user_id = u) then return online.req_end(u, p_req, online.fail('has_company', 'Вече имаш фирма в този свят.')); end if;
  if p_brand not in ('industrial', 'titan', 'atlas', 'horizon', 'imperial') then return online.req_end(u, p_req, online.fail('bad_brand', 'Избери една от петте марки.')); end if;
  if not (p_city = any (online.cities())) then return online.req_end(u, p_req, online.fail('bad_city', 'Избери начален град от списъка.')); end if;
  if char_length(nm) not between 3 and 32 then return online.req_end(u, p_req, online.fail('bad_name', 'Името трябва да е от 3 до 32 знака.')); end if;
  if exists (select 1 from online.companies where world_id = p_world and lower(name) = lower(nm)) then return online.req_end(u, p_req, online.fail('name_taken', 'Това име е заето.')); end if;
  insert into online.members (world_id, user_id) values (p_world, u) on conflict do nothing;
  insert into online.companies (world_id, user_id, name, brand, city, cash, settled_day)
    values (p_world, u, nm, p_brand, p_city, 0, online.wday(w)) returning * into c;
  perform online.money(c.id, online.start_cash(), 'начален капитал', 'Начален капитал на фирмата', 'start');
  perform online.note(c.id, 'welcome', 'Фирмата е регистрирана', format('„%s“ започва в общия свят „%s“.', nm, w.name));
  perform online.log(p_world, c.id, u, 'company_created', jsonb_build_object('name', nm, 'brand', p_brand, 'city', p_city));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'company', c.id));
exception when unique_violation then
  -- две едновременни създавания: второто отпада цялото (транзакцията се връща), затова тук само съобщаваме
  raise exception 'conflict' using errcode = '40001', hint = 'Опитай отново.';
end $$;

-- Моето състояние в света: фирма, време, последните движения и известия
create or replace function public.ol_state(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds; c online.companies;
begin
  select * into w from online.worlds where id = p_world;
  if not found or not online.can_play(u, w) then return online.fail('no_access', 'Нямаш достъп до този свят.'); end if;
  select * into c from online.companies where world_id = p_world and user_id = u;
  return jsonb_build_object('ok', true,
    'world', jsonb_build_object('id', w.id, 'name', w.name, 'slug', w.slug, 'status', w.status, 'day', online.wday(w), 'frac', online.wfrac(w),
      'day_seconds', w.day_seconds, 'server_now', online.wnow(w), 'cfg', w.cfg),
    'company', case when c.id is null then null else online.company_pub(c) || jsonb_build_object('cash', c.cash, 'settled_day', c.settled_day) end,
    'ledger', case when c.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('day', l.day, 'amount', l.amount, 'reason', l.reason, 'note', l.note) order by l.id desc)
       from (select * from online.ledger where company_id = c.id order by id desc limit 30) l), '[]'::jsonb) end,
    'notes', case when c.id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body, 'seen', n.seen, 'at', n.at) order by n.id desc)
       from (select * from online.notes where company_id = c.id order by id desc limit 20) n), '[]'::jsonb) end);
end $$;

create or replace function public.ol_notes_seen(p_world int, p_upto bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me();
begin
  update online.notes n set seen = true from online.companies c
   where n.company_id = c.id and c.world_id = p_world and c.user_id = u and n.id <= p_upto and not n.seen;
  return jsonb_build_object('ok', true);
end $$;

-- ── администрация ──
create or replace function public.ol_admin_world(p_slug text, p_name text, p_private boolean, p_day_seconds int, p_cfg jsonb, p_test boolean default false)
returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); w online.worlds;
begin
  if not online.is_admin(u) then return online.fail('forbidden', 'Само за администратори.'); end if;
  insert into online.worlds (slug, name, private, day_seconds, cfg, test) values (p_slug, p_name, p_private, p_day_seconds, coalesce(p_cfg, '{}'), p_test) returning * into w;
  insert into online.members (world_id, user_id, role) values (w.id, u, 'admin');
  perform online.log(w.id, null, u, 'world_created', to_jsonb(w));
  return jsonb_build_object('ok', true, 'world', w.id);
end $$;

create or replace function public.ol_admin_invite(p_world int, p_max_uses int default 20, p_days int default 14) returns jsonb
language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); code text;
begin
  if not online.is_admin(u) then return online.fail('forbidden', 'Само за администратори.'); end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into online.invites (code, world_id, max_uses, expires_at, created_by) values (code, p_world, p_max_uses, now() + make_interval(days => p_days), u);
  perform online.log(p_world, null, u, 'invite', jsonb_build_object('code', code, 'max', p_max_uses));
  return jsonb_build_object('ok', true, 'code', code);
end $$;

-- Клиентът може да вика само ol_* функциите; таблиците в online са недостъпни.
revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
