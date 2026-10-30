-- coop6_rivals — режимът „⚖️ Конкуренти“ в партньорството (флаг coop-riv-core), ЧАСТ 1.
-- Прилага се през SQL Editor, НЕ с supabase db push. Може да се пуска повече от веднъж.
-- Изисква coop1 (coop.pairs, coop.me, coop.my_pair).
--
-- Един ред на двойка. Режимът се сменя САМО при съгласие на двамата:
-- единият предлага, другият приема. „Съперници“ иска и hostile_ok
-- от двамата (в част 1 не се избира).
-- Доверие / свързаност / напрежение са 0..100 и живеят само тук.
-- Миграцията не пипа пари, каса, общи обекти и мегапоръчки.

create table if not exists coop.rivalry (
  pair_id bigint primary key
    references coop.pairs on delete cascade,
  mode text not null default 'none'
    check (mode in ('none', 'allies', 'comp', 'rival')),
  mode_pending jsonb,
  hostile_ok_a boolean not null default false,
  hostile_ok_b boolean not null default false,
  trust smallint not null default 50
    check (trust between 0 and 100),
  interdep smallint not null default 20
    check (interdep between 0 and 100),
  tension smallint not null default 10
    check (tension between 0 and 100),
  contrib jsonb not null default '{}'::jsonb,
  updated timestamptz not null default now()
);

alter table coop.rivalry enable row level security;

-- редът на активната ми двойка (създава се при първото извикване)
create or replace function coop.riv_row(p coop.pairs)
returns coop.rivalry
language plpgsql as $$
declare r coop.rivalry;
begin
  insert into coop.rivalry (pair_id) values (p.id)
    on conflict (pair_id) do nothing;
  select * into r from coop.rivalry where pair_id = p.id;
  return r;
end $$;

create or replace function coop.riv_json(
  r coop.rivalry, p coop.pairs, u uuid)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'ok', true,
    'active', true,
    'mode', r.mode,
    'pending', case
      when r.mode_pending is null then null
      else jsonb_build_object(
        'mode', r.mode_pending ->> 'mode',
        'mine', (r.mode_pending ->> 'by') = u::text,
        'at', r.mode_pending ->> 'at')
      end,
    'hostile_me', case when p.a = u
      then r.hostile_ok_a else r.hostile_ok_b end,
    'hostile_them', case when p.a = u
      then r.hostile_ok_b else r.hostile_ok_a end,
    'trust', r.trust,
    'interdep', r.interdep,
    'tension', r.tension,
    'updated', r.updated,
    'server_now', now())
$$;

-- състоянието за екрана на срещата (пита се от coop.js tick)
create or replace function public.coop_riv_status()
returns jsonb
language plpgsql security definer
set search_path = coop, public as $$
declare
  u uuid := coop.me();
  p coop.pairs;
  r coop.rivalry;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return jsonb_build_object('ok', true, 'active', false);
  end if;
  r := coop.riv_row(p);
  return coop.riv_json(r, p, u);
end $$;

-- p_action: propose | accept | decline
-- p_mode: none | allies | comp | rival (само с propose)
create or replace function public.coop_riv_mode(
  p_action text, p_mode text default null)
returns jsonb
language plpgsql security definer
set search_path = coop, public as $$
declare
  u uuid := coop.me();
  p coop.pairs;
  r coop.rivalry;
  pm text;
begin
  p := coop.my_pair(u);
  if p.id is null or p.status <> 'active' then
    return coop.fail('none', 'Нямаш активен партньор.');
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('coop_riv:' || p.id::text, 0));
  r := coop.riv_row(p);

  if p_action = 'propose' then
    if p_mode is null
       or p_mode not in ('none', 'allies', 'comp', 'rival') then
      return coop.fail('mode', 'Непознат режим.');
    end if;
    if p_mode = r.mode then
      return coop.fail('same', 'Този режим вече е избран.');
    end if;
    if p_mode = 'rival'
       and not (r.hostile_ok_a and r.hostile_ok_b) then
      return coop.fail('hostile',
        'Съперници — само ако и двамата са разрешили враждебен режим.');
    end if;
    update coop.rivalry set
      mode_pending = jsonb_build_object(
        'mode', p_mode, 'by', u::text, 'at', now()),
      updated = now()
      where pair_id = p.id
      returning * into r;

  elsif p_action = 'accept' then
    if r.mode_pending is null
       or (r.mode_pending ->> 'by') = u::text then
      return coop.fail('nothing', 'Няма предложение от партньора.');
    end if;
    pm := r.mode_pending ->> 'mode';
    if pm = 'rival' and not (r.hostile_ok_a and r.hostile_ok_b) then
      return coop.fail('hostile',
        'Съперници — само ако и двамата са разрешили враждебен режим.');
    end if;
    update coop.rivalry set
      mode = pm, mode_pending = null, updated = now()
      where pair_id = p.id
      returning * into r;

  elsif p_action = 'decline' then
    if r.mode_pending is null then
      return coop.fail('nothing', 'Няма предложение.');
    end if;
    -- предложилият може да оттегли, партньорът — да откаже
    update coop.rivalry set
      mode_pending = null, updated = now()
      where pair_id = p.id
      returning * into r;

  else
    return coop.fail('action', 'Непознато действие.');
  end if;

  return coop.riv_json(r, p, u);
end $$;

-- правата — както в coop3/coop5: таблиците и вътрешните функции са закрити,
-- public.coop_* — само за влезли
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
