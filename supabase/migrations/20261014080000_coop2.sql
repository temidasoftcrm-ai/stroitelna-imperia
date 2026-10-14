-- „Строителна империя“ — ПАРТНЬОРСТВО, част 2: строим заедно (магистрала, влак), наем на техника, общи задачи,
-- холдинг (обща касичка + класация на двойките), чат със 🆘 и изненади в общ град.
-- Както в част 1: парите и техниката живеят в записите на играчите; сървърът е пощата и „договорите“.

alter table coop.parcels drop constraint if exists parcels_kind_check;
alter table coop.parcels add constraint parcels_kind_check check (kind in ('gift', 'loan', 'refund', 'repay', 'unit', 'mat', 'mega', 'rent', 'vault', 'joint', 'quest', 'surprise'));

-- ── строим заедно: общ участък от магистрала или обща жп линия ──
create table coop.joints (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  kind text not null check (kind in ('hw', 'rail')),
  ref text not null,                 -- магистрала: id на участъка; влак: „градА|градБ“ (по азбучен ред)
  title text not null,
  km int not null check (km between 1 and 20000),
  status text not null default 'proposed' check (status in ('proposed', 'active', 'ended')),
  proposed_by uuid not null,
  bonus_claimed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create unique index coop_joints_one on coop.joints (pair_id, kind, ref) where status <> 'ended';

-- ── наем на техника (цена 0 = помощна бригада/машина) ──
create table coop.rentals (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  owner uuid not null, renter uuid not null,
  type text not null check (length(type) <= 20),
  hours int not null check (hours between 1 and 168),
  price bigint not null check (price between 0 and 1e12),   -- общо за срока
  status text not null default 'offered' check (status in ('offered', 'active', 'returned', 'declined')),
  until timestamptz,
  created_at timestamptz not null default now()
);

-- ── общи задачи (напредъкът = сборът от двете игри от началото на задачата) ──
create table coop.quests (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  key text not null,
  target bigint not null,
  reward bigint not null,
  base jsonb not null default '{}'::jsonb,     -- { user_id: стойност при старта }
  status text not null default 'active' check (status in ('active', 'done')),
  claimed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create unique index coop_quests_one on coop.quests (pair_id, key) where status = 'active';

-- ── холдинг: обща касичка ──
create table coop.vaults (
  pair_id bigint primary key references coop.pairs on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  name text
);
create table coop.vault_log (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  user_id uuid not null, amount bigint not null, req uuid unique, at timestamptz not null default now()
);

-- ── чат ──
create table coop.messages (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  from_u uuid not null,
  text text not null check (length(text) between 1 and 300),
  sos boolean not null default false,
  at timestamptz not null default now()
);
create index coop_messages_pair on coop.messages (pair_id, id desc);

-- ── изненади: табела/подарък на парцел в общ град ──
create table coop.surprises (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  from_u uuid not null, to_u uuid not null,
  city text not null check (length(city) <= 40),
  x numeric not null, z numeric not null,
  text text not null check (length(text) <= 120),
  amount bigint not null default 0 check (amount between 0 and 1e12),
  status text not null default 'placed' check (status in ('placed', 'found')),
  req uuid unique,
  created_at timestamptz not null default now()
);

-- ═══════════════════ помощни ═══════════════════
create or replace function coop.stat(p_user uuid, p_key text) returns numeric language sql stable as
  $$ select coalesce((data -> 'stats' ->> p_key)::numeric, 0) from coop.snaps where user_id = p_user $$;
create or replace function coop.has_hw(p_user uuid, p_seg text) returns boolean language sql stable as
  $$ select coalesce((select data -> 'hwDone' ? p_seg from coop.snaps where user_id = p_user), false) $$;
create or replace function coop.has_rail(p_user uuid, p_ref text) returns boolean language sql stable as
  $$ select coalesce((select data -> 'rails' ? p_ref from coop.snaps where user_id = p_user), false) $$;
create or replace function coop.joint_done(j coop.joints, p coop.pairs) returns boolean language sql stable as $$
  select case j.kind when 'hw' then coop.has_hw(p.a, j.ref) and coop.has_hw(p.b, j.ref) else coop.has_rail(p.a, j.ref) and coop.has_rail(p.b, j.ref) end
$$;

-- видовете задачи: стат. ключ, цел, награда (за всеки от двамата)
create or replace function coop.quest_defs() returns table (key text, nm text, stat text, target bigint, reward bigint) language sql immutable as $$
  values ('builds', 'Завършете заедно %s обекта', 'done', 10::bigint, 25000::bigint),
         ('hw', 'Постройте заедно %s участъка магистрала', 'hw', 2, 60000),
         ('money', 'Спечелете заедно %s €', 'earned', 400000, 40000),
         ('cities', 'Отворете заедно %s нови града', 'cities', 2, 50000),
         ('parcels', 'Изпратете си %s пратки', 'parcels', 6, 15000)
$$;
create or replace function coop.quest_progress(q coop.quests, p coop.pairs) returns bigint language sql stable as $$
  select case when q.key = 'parcels' then (select count(*) from coop.parcels x where x.pair_id = p.id and x.created_at >= q.created_at and x.from_u <> x.to_u and x.kind in ('gift', 'unit', 'mat', 'loan', 'rent'))
    else (select greatest(0, coop.stat(p.a, d.stat) - coalesce((q.base ->> p.a::text)::numeric, 0)) + greatest(0, coop.stat(p.b, d.stat) - coalesce((q.base ->> p.b::text)::numeric, 0))
          from coop.quest_defs() d where d.key = q.key)::bigint end
$$;
-- поддържа 3 активни задачи; сложността расте с броя завършени
create or replace function coop.quest_fill(p coop.pairs) returns void language plpgsql as $$
declare d record; n int; lvl int;
begin
  if p.status <> 'active' or p.b is null then return; end if;
  update coop.quests q set status = 'done' where q.pair_id = p.id and q.status = 'active' and coop.quest_progress(q, p) >= q.target;
  select count(*) into n from coop.quests where pair_id = p.id and status = 'active';
  select count(*) into lvl from coop.quests where pair_id = p.id and status = 'done';
  for d in select * from coop.quest_defs() order by md5(p.id::text || lvl::text || key) loop
    exit when n >= 3;
    continue when exists (select 1 from coop.quests where pair_id = p.id and key = d.key and (status = 'active' or (status = 'done' and not (claimed ? p.a::text and claimed ? p.b::text))));
    insert into coop.quests (pair_id, key, target, reward, base)
      values (p.id, d.key, d.target * (1 + lvl / 3), d.reward * (1 + lvl / 3),
              jsonb_build_object(p.a::text, coop.stat(p.a, d.stat), p.b::text, coop.stat(p.b, d.stat)))
      on conflict do nothing;
    n := n + 1;
  end loop;
end $$;

-- ═══════════════════ API ═══════════════════
-- разширеното състояние (част 2) — клиентът го взема заедно с coop_status
create or replace function public.coop_status2() returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; o uuid;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return jsonb_build_object('ok', true, 'active', false,
    'tandems', (select public.coop_tandems_list())); end if;
  o := coop.other(p, u);
  perform coop.quest_fill(p);
  return jsonb_build_object('ok', true, 'active', true,
    'joints', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'kind', j.kind, 'ref', j.ref, 'title', j.title, 'km', j.km, 'status', j.status, 'mine', j.proposed_by = u,
        'done', coop.joint_done(j, p), 'me_done', case j.kind when 'hw' then coop.has_hw(u, j.ref) else coop.has_rail(u, j.ref) end,
        'they_done', case j.kind when 'hw' then coop.has_hw(o, j.ref) else coop.has_rail(o, j.ref) end,
        'bonus_claimed', j.bonus_claimed ? u::text) order by j.id desc) from coop.joints j where j.pair_id = p.id and j.status <> 'ended'), '[]'::jsonb),
    'rentals', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'out', r.owner = u, 'type', r.type, 'hours', r.hours, 'price', r.price, 'status', r.status, 'until', r.until) order by r.id desc)
       from coop.rentals r where r.pair_id = p.id and (r.status in ('offered', 'active') or r.created_at > now() - interval '2 days')), '[]'::jsonb),
    'quests', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'key', q.key, 'nm', format(d.nm, q.target), 'target', q.target, 'reward', q.reward, 'status', q.status,
        'progress', least(q.target, coop.quest_progress(q, p)), 'claimed', q.claimed ? u::text) order by q.id)
       from coop.quests q join coop.quest_defs() d on d.key = q.key where q.pair_id = p.id and (q.status = 'active' or not (q.claimed ? u::text))), '[]'::jsonb),
    'vault', jsonb_build_object('balance', coalesce((select balance from coop.vaults where pair_id = p.id), 0), 'name', (select name from coop.vaults where pair_id = p.id),
       'log', coalesce((select jsonb_agg(jsonb_build_object('me', l.user_id = u, 'amount', l.amount, 'at', l.at) order by l.id desc) from (select * from coop.vault_log where pair_id = p.id order by id desc limit 10) l), '[]'::jsonb)),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'me', m.from_u = u, 'text', m.text, 'sos', m.sos, 'at', m.at) order by m.id) from (select * from coop.messages where pair_id = p.id order by id desc limit 40) m), '[]'::jsonb),
    'surprises_for_me', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'city', s.city, 'x', s.x, 'z', s.z, 'text', s.text, 'amount', s.amount)) from coop.surprises s where s.pair_id = p.id and s.to_u = u and s.status = 'placed'), '[]'::jsonb),
    'surprises_mine', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'city', s.city, 'text', s.text, 'amount', s.amount, 'status', s.status, 'at', s.created_at) order by s.id desc) from (select * from coop.surprises where pair_id = p.id and from_u = u order by id desc limit 5) s), '[]'::jsonb),
    'tandems', (select public.coop_tandems_list()));
end $$;

-- класация „Най-силен тандем“: сбор от стойностите на двамата (по снимките им)
create or replace function public.coop_tandems_list() returns jsonb language sql stable security definer set search_path = coop, public as $$
  select coalesce(jsonb_agg(t order by (t ->> 'worth')::numeric desc), '[]'::jsonb) from (
    select jsonb_build_object('pair', p.id, 'me', p.a = auth.uid() or p.b = auth.uid(),
      'name', coalesce(v.name, coalesce(sa.data ->> 'name', '?') || ' & ' || coalesce(sb.data ->> 'name', '?')),
      'a', sa.data ->> 'name', 'b', sb.data ->> 'name',
      'worth', coalesce((sa.data ->> 'worth')::numeric, 0) + coalesce((sb.data ->> 'worth')::numeric, 0) + coalesce(v.balance, 0)) t
    from coop.pairs p left join coop.snaps sa on sa.user_id = p.a left join coop.snaps sb on sb.user_id = p.b left join coop.vaults v on v.pair_id = p.id
    where p.status = 'active' and p.b is not null
    order by coalesce((sa.data ->> 'worth')::numeric, 0) + coalesce((sb.data ->> 'worth')::numeric, 0) + coalesce(v.balance, 0) desc limit 20) q
$$;

-- строим заедно: предложи участък/линия; партньорът приема; всеки може да прекрати
create or replace function public.coop_joint(p_kind text, p_ref text, p_title text, p_km int) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; j coop.joints;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if p_kind not in ('hw', 'rail') or coalesce(length(p_ref), 0) not between 1 and 80 or coalesce(p_km, 0) not between 1 and 20000 then return coop.fail('bad_data', 'Невалидно предложение.'); end if;
  if (select count(*) from coop.joints where pair_id = p.id and status <> 'ended') >= 8 then return coop.fail('too_many', 'Най-много 8 общи обекта наведнъж.'); end if;
  insert into coop.joints (pair_id, kind, ref, title, km, proposed_by) values (p.id, p_kind, p_ref, left(p_title, 80), p_km, u) on conflict do nothing returning * into j;
  if j.id is null then return coop.fail('exists', 'Вече имате такъв общ обект.'); end if;
  return jsonb_build_object('ok', true, 'id', j.id);
end $$;

create or replace function public.coop_joint_act(p_id bigint, p_action text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; j coop.joints;
begin
  p := coop.my_pair(u);
  select * into j from coop.joints where id = p_id and pair_id = p.id and status <> 'ended' for update;
  if not found then return coop.fail('none', 'Няма такъв общ обект.'); end if;
  if p_action = 'accept' and j.status = 'proposed' and j.proposed_by <> u then update coop.joints set status = 'active' where id = j.id;
  elsif p_action in ('decline', 'end') then update coop.joints set status = 'ended' where id = j.id;
  else return coop.fail('bad_action', 'Действието не е възможно.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- еднократният бонус, когато и двамата са завършили общия обект: магистрала 1500 €/км, влак 800 €/км
create or replace function public.coop_joint_bonus(p_id bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; j coop.joints; amt bigint;
begin
  p := coop.my_pair(u);
  select * into j from coop.joints where id = p_id and pair_id = p.id and status = 'active' for update;
  if not found then return coop.fail('none', 'Няма такъв общ обект.'); end if;
  if not coop.joint_done(j, p) then return coop.fail('not_done', 'Още не сте го завършили и двамата.'); end if;
  if j.bonus_claimed ? u::text then return coop.fail('claimed', 'Бонусът вече е взет.'); end if;
  update coop.joints set bonus_claimed = bonus_claimed || to_jsonb(u::text) where id = j.id;
  amt := j.km * case j.kind when 'hw' then 1500 else 800 end;
  return jsonb_build_object('ok', true, 'amount', amt, 'title', j.title);
end $$;

-- наем: собственикът вече е извадил машината от играта си
create or replace function public.coop_rent_offer(p_req uuid, p_type text, p_hours int, p_price bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; r coop.rentals; x coop.parcels;
begin
  select * into x from coop.parcels where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true); end if;
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if coalesce(length(p_type), 0) not between 1 and 20 or p_hours not between 1 and 168 or coalesce(p_price, -1) not between 0 and 1e12 then return coop.fail('bad_data', 'Невалиден наем.'); end if;
  insert into coop.rentals (pair_id, owner, renter, type, hours, price) values (p.id, u, coop.other(p, u), p_type, p_hours, p_price) returning * into r;
  insert into coop.parcels (pair_id, from_u, to_u, kind, data, status, req) values (p.id, u, u, 'refund', jsonb_build_object('amount', 0, 'rental', r.id), 'claimed', p_req);
  return jsonb_build_object('ok', true, 'id', r.id);
end $$;

-- p_action: 'accept' (наемателят вече е извадил цената), 'decline', 'cancel' (собственикът), 'return' (наемателят вече е извадил машината)
create or replace function public.coop_rent_act(p_req uuid, p_id bigint, p_action text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; r coop.rentals; x coop.parcels;
begin
  select * into x from coop.parcels where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true); end if;
  p := coop.my_pair(u);
  select * into r from coop.rentals where id = p_id and pair_id = p.id for update;
  if not found then return coop.fail('none', 'Няма такъв наем.'); end if;
  if p_action = 'accept' and r.renter = u and r.status = 'offered' then
    update coop.rentals set status = 'active', until = now() + make_interval(hours => r.hours) where id = r.id;
    insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values (p.id, r.owner, u, 'unit', jsonb_build_object('type', r.type, 'n', 1, 'rental', r.id), 'Под наем');
    insert into coop.parcels (pair_id, from_u, to_u, kind, data, req) values (p.id, u, r.owner, 'rent', jsonb_build_object('amount', r.price, 'rental', r.id, 'type', r.type), p_req);
  elsif p_action in ('decline', 'cancel') and r.status = 'offered' and ((p_action = 'decline' and r.renter = u) or (p_action = 'cancel' and r.owner = u)) then
    update coop.rentals set status = 'declined' where id = r.id;
    insert into coop.parcels (pair_id, from_u, to_u, kind, data, note, req) values (p.id, u, r.owner, 'unit', jsonb_build_object('type', r.type, 'n', 1), 'Върната машина (наемът не се състоя)', p_req);
  elsif p_action = 'return' and r.renter = u and r.status = 'active' then
    update coop.rentals set status = 'returned' where id = r.id;
    insert into coop.parcels (pair_id, from_u, to_u, kind, data, note, req) values (p.id, u, r.owner, 'unit', jsonb_build_object('type', r.type, 'n', 1), 'Върната от наем', p_req);
  else return coop.fail('bad_action', 'Действието не е възможно сега.'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.coop_quest_claim(p_id bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; q coop.quests;
begin
  p := coop.my_pair(u);
  perform coop.quest_fill(p);
  select * into q from coop.quests where id = p_id and pair_id = p.id for update;
  if not found or q.status <> 'done' then return coop.fail('not_done', 'Задачата още не е изпълнена.'); end if;
  if q.claimed ? u::text then return coop.fail('claimed', 'Вече взе наградата.'); end if;
  update coop.quests set claimed = claimed || to_jsonb(u::text) where id = q.id;
  return jsonb_build_object('ok', true, 'reward', q.reward);
end $$;

-- касичка: внасяне (вече извадено от играта) и теглене (идва като пратка)
create or replace function public.coop_vault(p_req uuid, p_amount bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; v coop.vaults; l coop.vault_log;
begin
  select * into l from coop.vault_log where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true); end if;
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if coalesce(p_amount, 0) = 0 or abs(p_amount) > 1e12 then return coop.fail('bad_amount', 'Невалидна сума.'); end if;
  insert into coop.vaults (pair_id) values (p.id) on conflict do nothing;
  select * into v from coop.vaults where pair_id = p.id for update;
  if p_amount < 0 and v.balance < -p_amount then return coop.fail('no_money', format('В касичката има само %s €.', v.balance)); end if;
  update coop.vaults set balance = balance + p_amount where pair_id = p.id;
  insert into coop.vault_log (pair_id, user_id, amount, req) values (p.id, u, p_amount, p_req);
  if p_amount < 0 then insert into coop.parcels (pair_id, from_u, to_u, kind, data, note) values (p.id, u, u, 'vault', jsonb_build_object('amount', -p_amount), 'От общата касичка'); end if;
  return jsonb_build_object('ok', true, 'balance', v.balance + p_amount);
end $$;

create or replace function public.coop_vault_name(p_name text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  insert into coop.vaults (pair_id, name) values (p.id, left(nullif(trim(p_name), ''), 40)) on conflict (pair_id) do update set name = excluded.name;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.coop_say(p_text text, p_sos boolean default false) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if coalesce(length(trim(p_text)), 0) = 0 then return coop.fail('empty', 'Напиши съобщение.'); end if;
  if (select count(*) from coop.messages where from_u = u and at > now() - interval '1 minute') >= 20 then return coop.fail('slow', 'Твърде много съобщения — изчакай малко.'); end if;
  insert into coop.messages (pair_id, from_u, text, sos) values (p.id, u, left(trim(p_text), 300), coalesce(p_sos, false));
  return jsonb_build_object('ok', true);
end $$;

-- изненада: подаръкът (ако има пари) вече е изваден от играта на оставящия
create or replace function public.coop_surprise(p_req uuid, p_city text, p_x numeric, p_z numeric, p_text text, p_amount bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; s coop.surprises;
begin
  select * into s from coop.surprises where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true); end if;
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if coalesce(length(p_city), 0) not between 1 and 40 or coalesce(p_amount, -1) not between 0 and 1e12 or abs(coalesce(p_x, 1e9)) > 1e5 or abs(coalesce(p_z, 1e9)) > 1e5 then return coop.fail('bad_data', 'Невалидна изненада.'); end if;
  if (select count(*) from coop.surprises where from_u = u and status = 'placed') >= 5 then return coop.fail('too_many', 'Имаш 5 неоткрити изненади — изчакай партньора да ги намери.'); end if;
  insert into coop.surprises (pair_id, from_u, to_u, city, x, z, text, amount, req) values (p.id, u, coop.other(p, u), p_city, p_x, p_z, left(coalesce(nullif(trim(p_text), ''), '🎁'), 120), p_amount, p_req) returning * into s;
  return jsonb_build_object('ok', true, 'id', s.id);
end $$;

create or replace function public.coop_surprise_find(p_id bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); s coop.surprises;
begin
  update coop.surprises set status = 'found' where id = p_id and to_u = u and status = 'placed' returning * into s;
  if s.id is null then return coop.fail('gone', 'Вече е намерена.'); end if;
  return jsonb_build_object('ok', true, 'amount', s.amount, 'text', s.text);
end $$;

revoke all on all tables in schema coop from public, anon, authenticated;
revoke all on all functions in schema coop from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'coop\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
