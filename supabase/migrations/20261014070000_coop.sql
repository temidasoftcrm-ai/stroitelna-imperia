-- „Строителна империя“ — ПАРТНЬОРСТВО в самостоятелната игра (не е „Онлайн империя“).
-- Всеки играе своята игра на своя компютър (своята карта, своето време и скорост). Двама партньори се свързват
-- с код и си помагат: пари (подарък или заем), техника, материали, общи големи поръчки; виждат се на картата.
-- Сървърът е „пощата“: пратката се записва веднъж (req) и се получава веднъж (claim). Парите и техниката живеят
-- в записите на играчите — изпращачът ги изважда от своята игра, преди да изпрати; получателят ги добавя при получаване.
-- Няма класация, затова няма тавани като в онлайн режима — само разумни граници на данните.

create schema if not exists coop;

create table coop.pairs (
  id bigserial primary key,
  code text not null unique,
  a uuid not null references auth.users on delete cascade,
  b uuid references auth.users on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'ended')),
  created_at timestamptz not null default now()
);
create unique index coop_pairs_a on coop.pairs (a) where status <> 'ended';
create unique index coop_pairs_b on coop.pairs (b) where status <> 'ended';

-- снимка на играта на всеки играч (за партньора: град, пари, ниво, градове на картата)
create table coop.snaps (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  at timestamptz not null default now()
);

create table coop.parcels (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  from_u uuid not null, to_u uuid not null,
  kind text not null check (kind in ('gift', 'loan', 'refund', 'repay', 'unit', 'mat', 'mega')),
  data jsonb not null,
  note text,
  status text not null default 'sent' check (status in ('sent', 'claimed')),
  req uuid unique,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index coop_parcels_to on coop.parcels (to_u, status);

create table coop.loans (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  lender uuid not null, borrower uuid not null,
  amount bigint not null check (amount > 0),
  rate_pct int not null check (rate_pct between 0 and 20),
  hours int not null check (hours between 1 and 168),
  owed bigint not null, repaid bigint not null default 0,
  status text not null default 'offered' check (status in ('offered', 'open', 'repaid', 'forgiven', 'declined')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table coop.mega_types (
  key text primary key, nm text not null, ico text not null, cost bigint not null, minutes int not null, mult numeric not null, descr text not null
);
insert into coop.mega_types values
  ('bridge', 'Мост на приятелството', '🌉', 300000, 20, 1.5, 'Висящ мост между вашите градове.'),
  ('airport', 'Общо летище', '✈️', 2000000, 60, 1.6, 'Международно летище, което строите заедно.'),
  ('rail', 'Скоростна жп линия', '🚄', 10000000, 180, 1.75, 'Влак-стрела между двете централи.'),
  ('stadium', 'Национален стадион', '🏟️', 40000000, 360, 1.9, 'Стадион за 60 000 души — най-голямата обща поръчка.');

create table coop.megas (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  key text not null references coop.mega_types,
  contrib jsonb not null default '{}'::jsonb,     -- { user_id: евро }
  claimed jsonb not null default '[]'::jsonb,     -- [user_id]
  status text not null default 'forming' check (status in ('forming', 'building', 'done')),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index coop_megas_one on coop.megas (pair_id, key) where status <> 'done';

-- ── помощни ──
create or replace function coop.me() returns uuid language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated'; end if;
  return u;
end $$;
create or replace function coop.my_pair(u uuid) returns coop.pairs language sql stable as
  $$ select * from coop.pairs where (a = u or b = u) and status <> 'ended' limit 1 $$;
create or replace function coop.other(p coop.pairs, u uuid) returns uuid language sql immutable as
  $$ select case when p.a = u then p.b else p.a end $$;
create or replace function coop.fail(code text, msg text) returns jsonb language sql immutable as
  $$ select jsonb_build_object('ok', false, 'err', code, 'msg', msg) $$;
create or replace function coop.mega_total(m coop.megas) returns bigint language sql immutable as
  $$ select coalesce(sum(value::bigint), 0)::bigint from jsonb_each_text(m.contrib) $$;
-- поръчката е готова, когато е събрана и срокът е минал
create or replace function coop.mega_finish() returns void language sql as
  $$ update coop.megas set status = 'done' where status = 'building' and ends_at <= now() $$;

-- ═══════════════════ API ═══════════════════
create or replace function public.coop_status() returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; o uuid;
begin
  perform coop.mega_finish();
  p := coop.my_pair(u);
  if p.id is null then return jsonb_build_object('ok', true, 'pair', null, 'me', u); end if;
  o := coop.other(p, u);
  return jsonb_build_object('ok', true, 'me', u, 'server_now', now(),
    'pair', jsonb_build_object('id', p.id, 'code', p.code, 'status', p.status, 'since', p.created_at),
    'partner', case when o is null then null else jsonb_build_object('id', o, 'snap', (select data from coop.snaps where user_id = o),
        'at', (select at from coop.snaps where user_id = o), 'online', coalesce((select at > now() - interval '60 seconds' from coop.snaps where user_id = o), false)) end,
    'inbox', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'data', x.data, 'note', x.note, 'at', x.created_at) order by x.id)
       from coop.parcels x where x.to_u = u and x.status = 'sent'), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'data', x.data, 'note', x.note, 'out', x.from_u = u, 'status', x.status, 'at', x.created_at) order by x.id desc)
       from (select * from coop.parcels where pair_id = p.id and not (kind = 'refund' and coalesce((data ->> 'amount')::numeric, 0) = 0) order by id desc limit 25) x), '[]'::jsonb),
    'loans', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'out', l.lender = u, 'amount', l.amount, 'rate_pct', l.rate_pct, 'hours', l.hours, 'owed', l.owed,
        'repaid', l.repaid, 'status', l.status, 'due_at', l.due_at) order by l.id desc)
       from coop.loans l where l.pair_id = p.id and (l.status in ('offered', 'open') or l.created_at > now() - interval '3 days')), '[]'::jsonb),
    'mega_types', (select jsonb_agg(to_jsonb(t) order by t.cost) from coop.mega_types t),
    'megas', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'key', m.key, 'status', m.status, 'ends_at', m.ends_at, 'total', coop.mega_total(m),
        'mine', coalesce((m.contrib ->> u::text)::bigint, 0), 'theirs', coalesce((m.contrib ->> o::text)::bigint, 0),
        'claimed', m.claimed ? u::text) order by m.id desc)
       from coop.megas m where m.pair_id = p.id and (m.status <> 'done' or not (m.claimed ? u::text))), '[]'::jsonb));
end $$;

-- нов код за партньорство (или съществуващият, ако вече чакаш)
create or replace function public.coop_create() returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; c text; i int := 0;
begin
  p := coop.my_pair(u);
  if p.id is not null then return jsonb_build_object('ok', true, 'code', p.code, 'status', p.status); end if;
  loop
    c := upper(substr(translate(encode(decode(md5(gen_random_uuid()::text), 'hex'), 'base64'), '+/=0O1IL', ''), 1, 6));
    exit when length(c) = 6 and not exists (select 1 from coop.pairs where code = c);
    i := i + 1; if i > 20 then raise exception 'code_gen'; end if;
  end loop;
  insert into coop.pairs (code, a) values (c, u) returning * into p;
  return jsonb_build_object('ok', true, 'code', p.code, 'status', p.status);
end $$;

create or replace function public.coop_join(p_code text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; mine coop.pairs;
begin
  select * into p from coop.pairs where code = upper(trim(coalesce(p_code, ''))) and status = 'waiting' for update;
  if not found then return coop.fail('bad_code', 'Няма такъв код или вече е използван.'); end if;
  if p.a = u then return coop.fail('own_code', 'Това е твоят код — дай го на партньора си.'); end if;
  mine := coop.my_pair(u);
  if mine.id is not null and mine.status = 'active' then return coop.fail('has_partner', 'Вече имаш партньор. Първо прекрати партньорството.'); end if;
  if mine.id is not null then update coop.pairs set status = 'ended' where id = mine.id; end if;   -- твоят чакащ код отпада
  update coop.pairs set b = u, status = 'active' where id = p.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.coop_leave() returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs;
begin
  p := coop.my_pair(u);
  if p.id is null then return coop.fail('none', 'Нямаш партньор.'); end if;
  update coop.pairs set status = 'ended' where id = p.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.coop_snap(p_data jsonb) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me();
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 60000 then return coop.fail('bad_snap', 'Невалидна снимка.'); end if;
  insert into coop.snaps (user_id, data, at) values (u, p_data, now()) on conflict (user_id) do update set data = excluded.data, at = now();
  return jsonb_build_object('ok', true);
end $$;

-- проверка на съдържанието на пратка
create or replace function coop.valid(p_kind text, d jsonb) returns boolean language sql immutable as $$
  select case p_kind
    when 'gift' then jsonb_typeof(d -> 'amount') = 'number' and (d ->> 'amount')::numeric between 1 and 1e12
    when 'unit' then jsonb_typeof(d -> 'type') = 'string' and length(d ->> 'type') <= 20 and coalesce((d ->> 'n')::int, 1) between 1 and 50
    when 'mat' then jsonb_typeof(d -> 'mat') = 'string' and length(d ->> 'mat') <= 20 and jsonb_typeof(d -> 'qty') = 'number' and (d ->> 'qty')::numeric between 0.01 and 1e7
    else false end
$$;

-- пратка: подарък (пари), техника, материали. Изпращачът вече ги е извадил от играта си.
create or replace function public.coop_send(p_req uuid, p_kind text, p_data jsonb, p_note text default null) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; x coop.parcels;
begin
  select * into x from coop.parcels where req = p_req;
  if found then return jsonb_build_object('ok', true, 'id', x.id, 'again', true); end if;
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if not coop.valid(p_kind, p_data) then return coop.fail('bad_data', 'Невалидна пратка.'); end if;
  insert into coop.parcels (pair_id, from_u, to_u, kind, data, note, req) values (p.id, u, coop.other(p, u), p_kind, p_data, left(p_note, 140), p_req)
    on conflict (req) do nothing returning * into x;
  if x.id is null then select * into x from coop.parcels where req = p_req; end if;
  return jsonb_build_object('ok', true, 'id', x.id);
end $$;

-- получаване: всяка пратка се дава точно веднъж
create or replace function public.coop_claim(p_id bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); x coop.parcels;
begin
  update coop.parcels set status = 'claimed', claimed_at = now() where id = p_id and to_u = u and status = 'sent' returning * into x;
  if x.id is null then return coop.fail('gone', 'Пратката вече е получена.'); end if;
  return jsonb_build_object('ok', true, 'kind', x.kind, 'data', x.data, 'note', x.note);
end $$;

-- заем: заемодателят вече е извадил парите (държат се „в пощата“); при приемане отиват при длъжника, при отказ се връщат
create or replace function public.coop_loan(p_req uuid, p_amount bigint, p_hours int, p_rate_pct int) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; l coop.loans; x coop.parcels;
begin
  select * into x from coop.parcels where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true); end if;
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if coalesce(p_amount, 0) < 1 or p_amount > 1e12 or p_hours not between 1 and 168 or p_rate_pct not between 0 and 20 then return coop.fail('bad_data', 'Невалиден заем.'); end if;
  insert into coop.loans (pair_id, lender, borrower, amount, rate_pct, hours, owed) values (p.id, u, coop.other(p, u), p_amount, p_rate_pct, p_hours, p_amount + p_amount * p_rate_pct / 100) returning * into l;
  -- празна „квитанция“ със същия req, за да е идемпотентно
  insert into coop.parcels (pair_id, from_u, to_u, kind, data, status, req) values (p.id, u, u, 'refund', jsonb_build_object('amount', 0, 'loan', l.id), 'claimed', p_req);
  return jsonb_build_object('ok', true, 'loan', l.id);
end $$;

create or replace function public.coop_loan_act(p_loan bigint, p_action text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); l coop.loans;
begin
  select * into l from coop.loans where id = p_loan and (lender = u or borrower = u) for update;
  if not found then return coop.fail('no_loan', 'Няма такъв заем.'); end if;
  if p_action = 'accept' and l.borrower = u and l.status = 'offered' then
    update coop.loans set status = 'open', due_at = now() + make_interval(hours => l.hours) where id = l.id;
    insert into coop.parcels (pair_id, from_u, to_u, kind, data) values (l.pair_id, l.lender, l.borrower, 'loan', jsonb_build_object('amount', l.amount, 'loan', l.id, 'owed', l.owed, 'hours', l.hours));
  elsif p_action = 'decline' and l.borrower = u and l.status = 'offered' then
    update coop.loans set status = 'declined' where id = l.id;
    insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values (l.pair_id, l.borrower, l.lender, 'refund', jsonb_build_object('amount', l.amount, 'loan', l.id), 'Отказан заем — парите се връщат');
  elsif p_action = 'cancel' and l.lender = u and l.status = 'offered' then
    update coop.loans set status = 'declined' where id = l.id;
    insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values (l.pair_id, l.lender, l.lender, 'refund', jsonb_build_object('amount', l.amount, 'loan', l.id), 'Оттеглен заем — парите се връщат');
  elsif p_action = 'forgive' and l.lender = u and l.status = 'open' then
    update coop.loans set status = 'forgiven' where id = l.id;
  else
    return coop.fail('bad_action', 'Действието не е възможно сега.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- връщане по заем: длъжникът вече е извадил сумата от играта си
create or replace function public.coop_repay(p_req uuid, p_loan bigint, p_amount bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); l coop.loans; amt bigint; x coop.parcels;
begin
  select * into x from coop.parcels where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true, 'paid', (x.data ->> 'amount')::bigint); end if;
  select * into l from coop.loans where id = p_loan and borrower = u and status = 'open' for update;
  if not found then return coop.fail('no_loan', 'Няма такъв активен заем.'); end if;
  amt := least(coalesce(p_amount, 0), l.owed - l.repaid);
  if amt <= 0 then return coop.fail('bad_amount', 'Няма какво да върнеш.'); end if;
  update coop.loans set repaid = repaid + amt, status = case when repaid + amt >= owed then 'repaid' else status end where id = l.id;
  insert into coop.parcels (pair_id, from_u, to_u, kind, data, req) values (l.pair_id, u, l.lender, 'repay', jsonb_build_object('amount', amt, 'loan', l.id), p_req);
  -- ако е върнал повече от дълга, излишъкът се връща на него
  if p_amount > amt then insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values (l.pair_id, u, u, 'refund', jsonb_build_object('amount', p_amount - amt), 'Надплатено по заема'); end if;
  return jsonb_build_object('ok', true, 'paid', amt);
end $$;

-- обща поръчка: започни (един от двамата), влагай пари; при пълна сума тръгва строежът
create or replace function public.coop_mega_start(p_key text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; m coop.megas;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if not exists (select 1 from coop.mega_types where key = p_key) then return coop.fail('bad_key', 'Няма такава поръчка.'); end if;
  insert into coop.megas (pair_id, key) values (p.id, p_key) on conflict do nothing returning * into m;
  if m.id is null then return coop.fail('exists', 'Тази поръчка вече е започната.'); end if;
  return jsonb_build_object('ok', true, 'id', m.id);
end $$;

create or replace function public.coop_mega_put(p_req uuid, p_mega bigint, p_amount bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; m coop.megas; t coop.mega_types; x coop.parcels; amt bigint; tot bigint;
begin
  select * into x from coop.parcels where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true, 'put', (x.data ->> 'put')::bigint); end if;
  p := coop.my_pair(u);
  select * into m from coop.megas where id = p_mega and pair_id = p.id for update;
  if not found or m.status <> 'forming' then return coop.fail('closed', 'Поръчката вече не събира пари.'); end if;
  select * into t from coop.mega_types where key = m.key;
  if coalesce(p_amount, 0) < 1 or p_amount > 1e12 then return coop.fail('bad_amount', 'Невалидна сума.'); end if;
  tot := coop.mega_total(m);
  amt := least(p_amount, t.cost - tot);
  update coop.megas set contrib = contrib || jsonb_build_object(u::text, coalesce((contrib ->> u::text)::bigint, 0) + amt) where id = m.id returning * into m;
  if coop.mega_total(m) >= t.cost then update coop.megas set status = 'building', ends_at = now() + make_interval(mins => t.minutes) where id = m.id; end if;
  -- квитанция (за идемпотентност) и връщане на излишъка
  insert into coop.parcels (pair_id, from_u, to_u, kind, data, status, req) values (p.id, u, u, 'refund', jsonb_build_object('amount', 0, 'put', amt, 'mega', m.id), 'claimed', p_req);
  if p_amount > amt then insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values (p.id, u, u, 'refund', jsonb_build_object('amount', p_amount - amt), format('%s — над нужната сума', t.nm)); end if;
  return jsonb_build_object('ok', true, 'put', amt, 'building', coop.mega_total(m) >= t.cost);
end $$;

-- награда: всеки получава вложеното × множителя, веднъж. Условие: и двамата са вложили поне 20%.
create or replace function public.coop_mega_claim(p_mega bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; m coop.megas; t coop.mega_types; mine bigint; o uuid; reward bigint; fair boolean;
begin
  perform coop.mega_finish();
  p := coop.my_pair(u);
  select * into m from coop.megas where id = p_mega and pair_id = p.id for update;
  if not found or m.status <> 'done' then return coop.fail('not_done', 'Поръчката още не е готова.'); end if;
  if m.claimed ? u::text then return coop.fail('claimed', 'Вече взе наградата.'); end if;
  select * into t from coop.mega_types where key = m.key;
  o := coop.other(p, u);
  mine := coalesce((m.contrib ->> u::text)::bigint, 0);
  fair := mine >= t.cost * 0.2 and coalesce((m.contrib ->> o::text)::bigint, 0) >= t.cost * 0.2;
  reward := floor(mine * case when fair then t.mult else 1 end)::bigint;
  update coop.megas set claimed = claimed || to_jsonb(u::text) where id = m.id;
  return jsonb_build_object('ok', true, 'reward', reward, 'fair', fair, 'nm', t.nm, 'ico', t.ico);
end $$;

revoke all on all tables in schema coop from public, anon, authenticated;
revoke all on all functions in schema coop from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'coop\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
