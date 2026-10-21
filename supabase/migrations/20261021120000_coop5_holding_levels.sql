-- coop5 — 🏛️ нивата на общия холдинг в партньорството (feature 'coop-levels'). ПРЕДЛОЖЕНИЕ — НЕ Е ПРИЛОЖЕНО.
-- Прилага се само с изричното „да“ на потребителя (през f1); никога supabase db push. Откат: _source/coop5-rollback.sql
--
-- Какво прави (само добавя — нищо съществуващо не се променя):
--   1) coop.holding — ниво 1…5, общ опит, приноса на всеки от последното ниво (пари/материали/техника/изпълнение),
--      постиженията (проекти, доставки, коридори, концесии, мегапроекти), доверие и лимит за малки разходи без съгласие.
--   2) coop.hold_projects — общ проект: кой какво дава, бюджет, срок, дял от печалбата; и двамата приемат → парите
--      от общата каса (coop.vaults) се резервират. Малък проект (до по-малкия от двата лимита) се приема и без партньора.
--   3) coop.hold_events — опитът идва САМО оттук: завършен общ проект, доставка към активен общ проект, успешна концесия,
--      завършен общ обект (coop.joints) и общ мегапроект (coop.megas) — всеки се брои веднъж. Преводите на пари не дават опит.
--   4) Ниво нагоре — само ако са изпълнени трите условия (опит + постижение + поне 15% принос от всеки); нивото не се губи.
--   5) Провален проект: резервираното се губи, доверието пада с 15 за 30 дни.
-- Таблиците са в схемата coop, достъпни само през public.coop_* функциите (както coop1–4).

-- ── таблици ──
create table if not exists coop.holding (
  pair_id bigint primary key references coop.pairs on delete cascade,
  level int not null default 1 check (level between 1 and 5),
  xp bigint not null default 0 check (xp >= 0),
  xp_at bigint not null default 0,                                  -- опитът при последното ниво
  contrib jsonb not null default '{}'::jsonb,                       -- { user_id: { money, mat, gear, exec } } от последното ниво, €
  ach jsonb not null default '{}'::jsonb,                           -- { projects, deliveries, corridors, concessions, megas }
  trust int not null default 100 check (trust between 0 and 100),
  trust_until timestamptz,
  limit_a bigint not null default 0 check (limit_a >= 0),           -- лимитът, който предлага pair.a / pair.b — важи по-малкият
  limit_b bigint not null default 0 check (limit_b >= 0),
  lv_log jsonb not null default '[]'::jsonb                          -- [{ level, at }]
);

create table if not exists coop.hold_projects (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  req uuid unique,
  title text not null check (length(title) between 1 and 120),
  kind text not null check (kind in ('hw', 'rail', 'corridor', 'build', 'tender', 'hotel', 'concession', 'mega', 'other')),
  budget bigint not null check (budget between 1 and 1000000000000),
  deadline timestamptz not null,
  split_a int not null default 50 check (split_a between 0 and 100),   -- % от печалбата за pair.a (pair.b — останалото)
  gives jsonb not null default '{}'::jsonb,                            -- { user_id: [{ k: money|mat|gear|exec, v: €, txt }] }
  ok_a boolean not null default false, ok_b boolean not null default false,
  status text not null default 'proposed' check (status in ('proposed', 'active', 'done', 'failed', 'cancelled')),
  reserved bigint not null default 0 check (reserved >= 0),
  proposed_by uuid not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists coop_hold_projects_pair on coop.hold_projects (pair_id, status);

create table if not exists coop.hold_events (
  id bigserial primary key,
  pair_id bigint not null references coop.pairs on delete cascade,
  req uuid unique,
  user_id uuid not null,
  kind text not null check (kind in ('project', 'delivery', 'concession', 'joint', 'mega')),
  ref text,                                                         -- проект/обект/мегапроект — броят се веднъж
  value bigint not null default 0 check (value >= 0),
  xp int not null default 0,
  at timestamptz not null default now()
);
create unique index if not exists coop_hold_events_once on coop.hold_events (pair_id, kind, ref) where kind in ('project', 'joint', 'mega', 'concession');

-- ── помощни ──
create or replace function coop.hold_need(lv int) returns table (xp bigint, ach text, need int) language sql immutable as $$
  select v.x, v.a, v.n from (values (2, 1000::bigint, 'deliveries', 5), (3, 3500::bigint, 'corridors', 1), (4, 9000::bigint, 'concessions', 1), (5, 22000::bigint, 'megas', 1)) v(l, x, a, n) where v.l = lv + 1
$$;
create or replace function coop.hold_xp(p_kind text, p_value bigint) returns int language sql immutable as $$
  select case p_kind
    when 'project' then greatest(100, least(2500, round(p_value / 2e5)))::int
    when 'joint' then greatest(100, least(2500, round(p_value / 2e5)))::int
    when 'mega' then greatest(500, least(5000, round(p_value / 1e5)))::int
    when 'delivery' then greatest(10, least(300, round(p_value / 5e4)))::int
    when 'concession' then greatest(250, least(3000, round(p_value / 1e5)))::int
    else 0 end
$$;
create or replace function coop.hold_row(p coop.pairs) returns coop.holding language plpgsql as $$
declare h coop.holding;
begin
  insert into coop.holding (pair_id) values (p.id) on conflict do nothing;
  select * into h from coop.holding where pair_id = p.id for update;
  return h;
end $$;
create or replace function coop.hold_add(c jsonb, u uuid, k text, v bigint) returns jsonb language sql immutable as $$
  select jsonb_set(coalesce(c, '{}'::jsonb), array[u::text], coalesce(c -> u::text, '{}'::jsonb) || jsonb_build_object(k, coalesce((c -> u::text ->> k)::bigint, 0) + greatest(v, 0)), true)
$$;
create or replace function coop.hold_sum(c jsonb, u uuid) returns bigint language sql immutable as $$
  select coalesce(sum(value::bigint), 0)::bigint from jsonb_each_text(coalesce(c -> u::text, '{}'::jsonb))
$$;
-- един запис на опит + постижение (вътрешно; повторение със същия ref се пропуска от уникалния индекс)
create or replace function coop.hold_award(p coop.pairs, u uuid, p_req uuid, p_kind text, p_ref text, p_value bigint, p_ach text) returns int language plpgsql as $$
declare x int := coop.hold_xp(p_kind, p_value);
begin
  perform coop.hold_row(p);
  begin
    insert into coop.hold_events (pair_id, req, user_id, kind, ref, value, xp) values (p.id, p_req, u, p_kind, p_ref, p_value, x);
  exception when unique_violation then return -1;
  end;
  update coop.holding set xp = xp + x,
    ach = case when p_ach is null then ach else jsonb_set(ach, array[p_ach], to_jsonb(coalesce((ach ->> p_ach)::int, 0) + 1)) end
    where pair_id = p.id;
  return x;
end $$;

-- ═══════════════════ API ═══════════════════
-- състоянието: нивото, опитът, условията за следващото ниво, проектите — от гледна точка на играча (me/them)
create or replace function public.coop_hold_status() returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; o uuid; h coop.holding; nx record; v bigint; res bigint;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  o := coop.other(p, u); h := coop.hold_row(p);
  select * into nx from coop.hold_need(h.level);
  select coalesce(balance, 0) into v from coop.vaults where pair_id = p.id;
  select coalesce(sum(reserved), 0) into res from coop.hold_projects where pair_id = p.id and status = 'active';
  return jsonb_build_object('ok', true,
    'name', (select name from coop.vaults where pair_id = p.id), 'level', h.level, 'xp', h.xp, 'xpAt', h.xp_at, 'ach', h.ach,
    'trust', case when h.trust_until > now() then h.trust else 100 end, 'trustUntil', h.trust_until,
    'limit', least(h.limit_a, h.limit_b), 'myLimit', case when p.a = u then h.limit_a else h.limit_b end,
    'free', coalesce(v, 0), 'reserved', res,
    'contrib', jsonb_build_object('me', coalesce(h.contrib -> u::text, '{}'::jsonb), 'them', coalesce(h.contrib -> o::text, '{}'::jsonb)),
    'next', case when nx is null then null else jsonb_build_object('xp', nx.xp, 'ach', nx.ach, 'need', nx.need) end,
    'projects', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'title', j.title, 'kind', j.kind, 'budget', j.budget, 'deadline', j.deadline,
        'split', jsonb_build_array(case when p.a = u then j.split_a else 100 - j.split_a end, case when p.a = u then 100 - j.split_a else j.split_a end),
        'gives', jsonb_build_object('me', coalesce(j.gives -> u::text, '[]'::jsonb), 'them', coalesce(j.gives -> o::text, '[]'::jsonb)),
        'ok', jsonb_build_object('me', case when p.a = u then j.ok_a else j.ok_b end, 'them', case when p.a = u then j.ok_b else j.ok_a end),
        'status', j.status, 'reserved', j.reserved, 'mine', j.proposed_by = u) order by j.id desc)
      from coop.hold_projects j where j.pair_id = p.id and (j.status in ('proposed', 'active') or j.ended_at > now() - interval '7 days')), '[]'::jsonb),
    'lvLog', h.lv_log);
end $$;

-- лимитът за малки разходи без съгласие: всеки казва своя, важи по-малкият
create or replace function public.coop_hold_limit(p_limit bigint) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if p_limit is null or p_limit < 0 or p_limit > 1e11 then return coop.fail('bad_amount', 'Невалиден лимит.'); end if;
  perform coop.hold_row(p);
  if p.a = u then update coop.holding set limit_a = p_limit where pair_id = p.id; else update coop.holding set limit_b = p_limit where pair_id = p.id; end if;
  return jsonb_build_object('ok', true);
end $$;

-- общ проект: предлага го единият; приема се от двамата (малък — до лимита — веднага)
-- p_gives_me / p_gives_them: [{ k: money|mat|gear|exec, v: €, txt }]
create or replace function public.coop_hproj_propose(p_req uuid, p_title text, p_kind text, p_budget bigint, p_days int, p_split_me int, p_gives_me jsonb, p_gives_them jsonb)
returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; o uuid; h coop.holding; j coop.hold_projects; small boolean;
begin
  select * into j from coop.hold_projects where req = p_req;
  if found then return jsonb_build_object('ok', true, 'again', true, 'id', j.id); end if;
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if p_days is null or p_days not between 1 and 365 or p_split_me is null or p_split_me not between 0 and 100 then return coop.fail('bad_args', 'Невалиден срок или дял.'); end if;
  if jsonb_typeof(coalesce(p_gives_me, '[]')) <> 'array' or jsonb_typeof(coalesce(p_gives_them, '[]')) <> 'array'
     or jsonb_array_length(coalesce(p_gives_me, '[]')) > 10 or jsonb_array_length(coalesce(p_gives_them, '[]')) > 10 then return coop.fail('bad_args', 'Невалидно „кой какво дава“.'); end if;
  o := coop.other(p, u); h := coop.hold_row(p);
  if (select count(*) from coop.hold_projects where pair_id = p.id and status in ('proposed', 'active')) >= 20 then return coop.fail('too_many', 'Твърде много отворени общи проекти.'); end if;
  small := p_budget <= least(h.limit_a, h.limit_b);
  insert into coop.hold_projects (pair_id, req, title, kind, budget, deadline, split_a, gives, ok_a, ok_b, proposed_by)
    values (p.id, p_req, p_title, p_kind, p_budget, now() + make_interval(days => p_days), case when p.a = u then p_split_me else 100 - p_split_me end,
      jsonb_build_object(u::text, coalesce(p_gives_me, '[]'), o::text, coalesce(p_gives_them, '[]')), p.a = u or small, p.b = u or small, u)
    returning * into j;
  if small then return public.coop_hproj_act(j.id, 'start'); end if;
  return jsonb_build_object('ok', true, 'id', j.id, 'status', j.status);
end $$;

-- accept / decline / cancel / start (вътрешно — щом и двамата са приели) / done / fail
create or replace function public.coop_hproj_act(p_id bigint, p_action text) returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; j coop.hold_projects; money bigint; bal bigint; x int; g jsonb; k text; el jsonb;
begin
  p := coop.my_pair(u);
  if p.id is null then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  select * into j from coop.hold_projects where id = p_id and pair_id = p.id for update;
  if not found then return coop.fail('none', 'Няма такъв общ проект.'); end if;
  if p_action = 'accept' and j.status = 'proposed' then
    if p.a = u then update coop.hold_projects set ok_a = true where id = j.id; else update coop.hold_projects set ok_b = true where id = j.id; end if;
    select * into j from coop.hold_projects where id = j.id;
    if not (j.ok_a and j.ok_b) then return jsonb_build_object('ok', true, 'status', 'proposed'); end if;
    p_action := 'start';
  end if;
  if p_action = 'start' and j.status = 'proposed' and j.ok_a and j.ok_b then
    -- парите на двамата за проекта се резервират от общата каса
    select coalesce(sum(greatest(coalesce((e.el ->> 'v')::bigint, 0), 0)), 0) into money from jsonb_each(j.gives) as w(uid, arr), jsonb_array_elements(w.arr) as e(el) where e.el ->> 'k' = 'money';
    insert into coop.vaults (pair_id) values (p.id) on conflict do nothing;
    select balance into bal from coop.vaults where pair_id = p.id for update;
    if bal < money then return coop.fail('no_money', format('В общата каса има %s €, а проектът иска %s €. Внесете пари и приемете отново.', bal, money)); end if;
    update coop.vaults set balance = balance - money where pair_id = p.id;
    update coop.hold_projects set status = 'active', reserved = money where id = j.id;
    return jsonb_build_object('ok', true, 'status', 'active', 'reserved', money);
  elsif p_action in ('decline', 'cancel') and j.status = 'proposed' then
    update coop.hold_projects set status = 'cancelled', ended_at = now() where id = j.id;
    return jsonb_build_object('ok', true, 'status', 'cancelled');
  elsif p_action = 'done' and j.status = 'active' then
    update coop.hold_projects set status = 'done', ended_at = now() where id = j.id;
    x := coop.hold_award(p, u, null, 'project', j.id::text, j.budget, 'projects');
    if j.kind in ('hw', 'rail', 'corridor') then update coop.holding set ach = jsonb_set(ach, '{corridors}', to_jsonb(coalesce((ach ->> 'corridors')::int, 0) + 1)) where pair_id = p.id; end if;
    if j.kind = 'mega' then update coop.holding set ach = jsonb_set(ach, '{megas}', to_jsonb(coalesce((ach ->> 'megas')::int, 0) + 1)) where pair_id = p.id; end if;
    -- приносът на всеки — по „кой какво дава“
    for k, g in select key, value from jsonb_each(j.gives) loop
      for el in select value from jsonb_array_elements(g) loop
        if el ->> 'k' in ('money', 'mat', 'gear', 'exec') then
          update coop.holding set contrib = coop.hold_add(contrib, k::uuid, el ->> 'k', coalesce((el ->> 'v')::bigint, 0)) where pair_id = p.id;
        end if;
      end loop;
    end loop;
    return jsonb_build_object('ok', true, 'status', 'done', 'xp', greatest(x, 0));
  elsif p_action = 'fail' and j.status = 'active' then
    -- резервираното се губи; доверието пада с 15 за 30 дни; нивото остава
    update coop.hold_projects set status = 'failed', ended_at = now() where id = j.id;
    update coop.holding set trust = greatest(0, (case when trust_until > now() then trust else 100 end) - 15), trust_until = now() + interval '30 days' where pair_id = p.id;
    return jsonb_build_object('ok', true, 'status', 'failed', 'lost', j.reserved);
  end if;
  return coop.fail('bad_action', 'Действието не е възможно.');
end $$;

-- опит от обща работа извън проектите: доставка към активен общ проект, концесия, завършен общ обект, общ мегапроект
create or replace function public.coop_hold_event(p_req uuid, p_kind text, p_ref text, p_value bigint, p_what text default 'mat') returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; j coop.hold_projects; jt coop.joints; m coop.megas; x int; val bigint := greatest(coalesce(p_value, 0), 0);
begin
  if exists (select 1 from coop.hold_events where req = p_req) then return jsonb_build_object('ok', true, 'again', true); end if;
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  if p_kind = 'delivery' then
    select * into j from coop.hold_projects where id = p_ref::bigint and pair_id = p.id and status = 'active';
    if not found then return coop.fail('none', 'Доставката е към активен общ проект.'); end if;
    val := least(val, j.budget);
    x := coop.hold_award(p, u, p_req, 'delivery', p_ref || ':' || p_req::text, val, 'deliveries');
    update coop.holding set contrib = coop.hold_add(contrib, u, case when p_what in ('mat', 'gear', 'exec') then p_what else 'mat' end, val) where pair_id = p.id;
  elsif p_kind = 'joint' then
    select * into jt from coop.joints where id = p_ref::bigint and pair_id = p.id and status = 'active';
    if not found or not coop.joint_done(jt, p) then return coop.fail('not_done', 'Общият обект още не е завършен и от двамата.'); end if;
    x := coop.hold_award(p, u, p_req, 'joint', p_ref, jt.km::bigint * 15000, 'corridors');
    update coop.holding set contrib = coop.hold_add(coop.hold_add(contrib, p.a, 'exec', jt.km::bigint * 7500), p.b, 'exec', jt.km::bigint * 7500) where pair_id = p.id and x >= 0;
  elsif p_kind = 'mega' then
    perform coop.mega_finish();
    select * into m from coop.megas where id = p_ref::bigint and pair_id = p.id and status = 'done';
    if not found then return coop.fail('not_done', 'Мегапроектът още не е завършен.'); end if;
    x := coop.hold_award(p, u, p_req, 'mega', p_ref, coop.mega_total(m), 'megas');
    update coop.holding set contrib = coop.hold_add(coop.hold_add(contrib, p.a, 'money', coalesce((m.contrib ->> p.a::text)::bigint, 0)), p.b, 'money', coalesce((m.contrib ->> p.b::text)::bigint, 0)) where pair_id = p.id and x >= 0;
  elsif p_kind = 'concession' then
    -- успешна концесия, взета заедно: ref = ключът на концесията (броят се веднъж)
    x := coop.hold_award(p, u, p_req, 'concession', p_ref, least(val, 1000000000000), 'concessions');
    update coop.holding set contrib = coop.hold_add(coop.hold_add(contrib, p.a, 'exec', val / 2), p.b, 'exec', val / 2) where pair_id = p.id and x >= 0;
  else return coop.fail('bad_kind', 'Невалиден вид.'); end if;
  if x < 0 then return jsonb_build_object('ok', true, 'again', true, 'xp', 0); end if;
  return jsonb_build_object('ok', true, 'xp', x);
end $$;

-- ниво нагоре: опит + постижение + поне 15% принос от всеки; спечеленото ниво не се губи
create or replace function public.coop_hold_levelup() returns jsonb language plpgsql security definer set search_path = coop, public as $$
declare u uuid := coop.me(); p coop.pairs; h coop.holding; nx record; sa bigint; sb bigint;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then return coop.fail('no_partner', 'Нямаш свързан партньор.'); end if;
  h := coop.hold_row(p);
  select * into nx from coop.hold_need(h.level);
  if nx is null then return coop.fail('max', 'Холдингът е на най-високото ниво.'); end if;
  if h.xp < nx.xp then return coop.fail('xp', format('Нужен е опит %s (имате %s).', nx.xp, h.xp)); end if;
  if coalesce((h.ach ->> nx.ach)::int, 0) < nx.need then return coop.fail('ach', 'Липсва постижението за това ниво.'); end if;
  sa := coop.hold_sum(h.contrib, p.a); sb := coop.hold_sum(h.contrib, p.b);
  if sa + sb = 0 or sa * 100 < (sa + sb) * 15 or sb * 100 < (sa + sb) * 15 then return coop.fail('both', 'Нужен е принос и от двамата (поне 15% всеки).'); end if;
  update coop.holding set level = level + 1, xp_at = xp, contrib = '{}'::jsonb, lv_log = lv_log || jsonb_build_object('level', level + 1, 'at', now(), 'by', u) where pair_id = p.id;
  return jsonb_build_object('ok', true, 'level', h.level + 1);
end $$;

-- правата — както в coop3/coop4: таблиците и вътрешните функции са закрити, public.coop_* — само за влезли
revoke all on all tables in schema coop from public, anon, authenticated;
revoke all on all functions in schema coop from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'coop\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
