-- „Онлайн империя“ — отношения между фирмите: СЪЮЗНИЦИ или СЪПЕРНИЦИ (избират се с бутон от профила на фирмата).
-- 🤝 Съюз: покана → приемане (взаимно); най-много 3 съюзника. Съюзниците се подкрепят: търгуват на пазара без такса,
--    виждат офертите си в търговете и концесиите (за да не се подбиват), получават известие, когато съюзник основе консорциум.
-- ⚔️ Съперник: обявява се едностранно. Победа над съперник в търг или концесия носи бонус XP (+25% от XP на обекта)
--    и точка в двубоите; съперникът получава известие. Двубоите се виждат в профила.
-- Двама не могат да са едновременно съюзници и съперници. Съюзът може да се прекрати по всяко време.

create table online.alliances (
  a bigint not null references online.companies on delete cascade,   -- a < b
  b bigint not null references online.companies on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active')),
  requested_by bigint not null,
  since timestamptz not null default now(),
  primary key (a, b), check (a < b)
);
create table online.rivalries (
  from_c bigint not null references online.companies on delete cascade,
  to_c bigint not null references online.companies on delete cascade,
  since timestamptz not null default now(),
  primary key (from_c, to_c), check (from_c <> to_c)
);
create table online.duels (
  id bigserial primary key,
  world_id int not null, winner bigint not null references online.companies on delete cascade, loser bigint not null references online.companies on delete cascade,
  kind text not null, ref text not null, title text, at timestamptz not null default now(),
  unique (ref, loser)
);
create or replace function online.max_allies() returns int language sql immutable as $$ select 3 $$;
create or replace function online.is_ally(x bigint, y bigint) returns boolean language sql stable as
  $$ select exists (select 1 from online.alliances where a = least(x, y) and b = greatest(x, y) and status = 'active') $$;
create or replace function online.is_rival(x bigint, y bigint) returns boolean language sql stable as
  $$ select exists (select 1 from online.rivalries where (from_c = x and to_c = y) or (from_c = y and to_c = x)) $$;
create or replace function online.ally_count(x bigint) returns int language sql stable as
  $$ select count(*)::int from online.alliances where (a = x or b = x) and status = 'active' $$;

-- двубои и бонус XP: при възлагане на търг/концесия победителят бие съперниците си, които също са наддавали
create or replace function online.duel(p_world int, p_winner bigint, p_loser bigint, p_kind text, p_ref text, p_title text, p_xp int) returns void language plpgsql as $$
declare wn text; ln text; ins int;
begin
  insert into online.duels (world_id, winner, loser, kind, ref, title) values (p_world, p_winner, p_loser, p_kind, p_ref, p_title) on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 0 then return; end if;
  select name into wn from online.companies where id = p_winner; select name into ln from online.companies where id = p_loser;
  update online.companies set xp = xp + p_xp where id = p_winner;
  perform online.note(p_winner, 'good', format('⚔️ Победа над съперника %s', ln), format('%s · бонус +%s XP', p_title, p_xp));
  perform online.note(p_loser, 'bad', format('⚔️ Съперникът %s те победи', wn), p_title);
end $$;
create or replace function online.tender_duels() returns trigger language plpgsql as $$
declare win online.bids; b record;
begin
  if new.status = 'awarded' and old.status is distinct from 'awarded' then
    select * into win from online.bids where id = new.winner_bid;
    for b in select * from online.bids where tender_id = new.id and status = 'lost' and online.is_rival(win.company_id, company_id) loop
      perform online.duel(new.world_id, win.company_id, b.company_id, 'tender', 'tender:' || new.id, new.title, greatest(1, (win.price / 5000 * 0.25)::int));
    end loop;
  end if;
  return new;
end $$;
create trigger tenders_duels after update of status on online.tenders for each row execute function online.tender_duels();
create or replace function online.conc_duels() returns trigger language plpgsql as $$
declare b record; t online.conc_types;
begin
  if new.status = 'active' and old.status = 'auction' then
    select * into t from online.conc_types where key = new.ctype;
    for b in select * from online.conc_bids where round_id = new.id and status = 'lost' and online.is_rival(new.holder, company_id) loop
      perform online.duel(new.world_id, new.holder, b.company_id, 'concession', 'conc:' || new.id, t.nm, greatest(1, (t.revenue * t.term_days / 5000 * 0.25)::int));
    end loop;
  end if;
  return new;
end $$;
create trigger conc_rounds_duels after update of status on online.conc_rounds for each row execute function online.conc_duels();
-- съюзниците научават за новия консорциум
create or replace function online.cons_ally_note() returns trigger language plpgsql as $$
declare m online.mega_types; fname text;
begin
  select * into m from online.mega_types where key = new.mtype; select name into fname from online.companies where id = new.founder;
  perform online.note(case when al.a = new.founder then al.b else al.a end, 'invite', format('🤝 Съюзникът ти %s основа консорциум', fname), format('%s „%s“ — виж таб „🤝“.', m.ico, m.nm))
     from online.alliances al where (al.a = new.founder or al.b = new.founder) and al.status = 'active';
  return new;
end $$;
create trigger consortia_ally_note after insert on online.consortia for each row execute function online.cons_ally_note();

-- ═══════════════════ API ═══════════════════
create or replace function online.rel_target(u uuid, p_world int, p_company bigint, out c online.companies, out t online.companies) language plpgsql as $$
begin
  c := online.my_company(u, p_world);
  select * into t from online.companies where id = p_company and world_id = p_world and id <> c.id;
end $$;

create or replace function public.ol_relations(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  return jsonb_build_object('ok', true, 'max_allies', online.max_allies(), 'allies_n', online.ally_count(c.id),
    'companies', coalesce((select jsonb_agg(jsonb_build_object('id', co.id, 'name', co.name, 'brand', co.brand, 'level', online.level(co.xp),
        'ally', online.is_ally(c.id, co.id),
        'ally_pending_out', exists (select 1 from online.alliances al where al.a = least(c.id, co.id) and al.b = greatest(c.id, co.id) and al.status = 'pending' and al.requested_by = c.id),
        'ally_pending_in', exists (select 1 from online.alliances al where al.a = least(c.id, co.id) and al.b = greatest(c.id, co.id) and al.status = 'pending' and al.requested_by = co.id),
        'rival_out', exists (select 1 from online.rivalries where from_c = c.id and to_c = co.id),
        'rival_in', exists (select 1 from online.rivalries where from_c = co.id and to_c = c.id),
        'wins', (select count(*) from online.duels d where d.winner = c.id and d.loser = co.id),
        'losses', (select count(*) from online.duels d where d.winner = co.id and d.loser = c.id)) order by co.name)
      from online.companies co where co.world_id = p_world and co.id <> c.id), '[]'::jsonb));
end $$;

-- p_action: 'ally' (покана или приемане), 'unally' (прекрати/откажи/оттегли), 'rival', 'unrival'
create or replace function public.ol_relation(p_req uuid, p_world int, p_company bigint, p_action text) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; x record; al online.alliances; lo bigint; hi bigint;
begin
  r := online.req_begin(u, p_req, 'relation'); if r is not null then return r; end if;
  select * into x from online.rel_target(u, p_world, p_company);
  if (x.c).id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  if (x.t).id is null then return online.req_end(u, p_req, online.fail('no_target', 'Няма такава фирма.')); end if;
  lo := least((x.c).id, (x.t).id); hi := greatest((x.c).id, (x.t).id);
  select * into al from online.alliances where a = lo and b = hi for update;
  if p_action = 'ally' then
    if online.is_rival((x.c).id, (x.t).id) then return online.req_end(u, p_req, online.fail('rivals', 'Първо прекратете съперничеството (и двете страни).')); end if;
    if al.status = 'active' then return online.req_end(u, p_req, jsonb_build_object('ok', true, 'already', true)); end if;
    if online.ally_count((x.c).id) >= online.max_allies() then return online.req_end(u, p_req, online.fail('max', format('Най-много %s съюзника.', online.max_allies()))); end if;
    if al.status = 'pending' and al.requested_by = (x.t).id then
      if online.ally_count((x.t).id) >= online.max_allies() then return online.req_end(u, p_req, online.fail('max', format('%s вече има %s съюзника.', (x.t).name, online.max_allies()))); end if;
      update online.alliances set status = 'active', since = now() where a = lo and b = hi;
      perform online.note((x.t).id, 'good', format('🤝 %s прие съюза!', (x.c).name), 'Търгувате без такса и виждате офертите си в търговете и концесиите.');
      perform online.log(p_world, (x.c).id, u, 'ally', jsonb_build_object('with', (x.t).id));
      return online.req_end(u, p_req, jsonb_build_object('ok', true, 'status', 'active'));
    end if;
    if al.a is null then
      insert into online.alliances (a, b, requested_by) values (lo, hi, (x.c).id);
      perform online.note((x.t).id, 'invite', format('🤝 %s предлага съюз на твоята фирма', (x.c).name), 'Приеми или откажи в профила ѝ (🏆 → фирмата).');
    end if;
    return online.req_end(u, p_req, jsonb_build_object('ok', true, 'status', 'pending'));
  elsif p_action = 'unally' then
    if al.a is null then return online.req_end(u, p_req, online.fail('none', 'Няма съюз.')); end if;
    delete from online.alliances where a = lo and b = hi;
    if al.status = 'active' then perform online.note((x.t).id, 'info', format('%s прекрати съюза', (x.c).name), null); end if;
    perform online.log(p_world, (x.c).id, u, 'unally', jsonb_build_object('with', (x.t).id));
    return online.req_end(u, p_req, jsonb_build_object('ok', true));
  elsif p_action = 'rival' then
    if al.status = 'active' then return online.req_end(u, p_req, online.fail('allies', 'Първо прекрати съюза.')); end if;
    delete from online.alliances where a = lo and b = hi;   -- чакаща покана отпада
    insert into online.rivalries (from_c, to_c) values ((x.c).id, (x.t).id) on conflict do nothing;
    perform online.note((x.t).id, 'bad', format('⚔️ %s те обяви за съперник', (x.c).name), 'Всяка победа между вас в търг или концесия носи бонус XP.');
    perform online.log(p_world, (x.c).id, u, 'rival', jsonb_build_object('with', (x.t).id));
    return online.req_end(u, p_req, jsonb_build_object('ok', true));
  elsif p_action = 'unrival' then
    delete from online.rivalries where from_c = (x.c).id and to_c = (x.t).id;
    return online.req_end(u, p_req, jsonb_build_object('ok', true));
  end if;
  return online.req_end(u, p_req, online.fail('bad_action', 'Непознато действие.'));
end $$;

-- ── пазарът без такса между съюзници; офертите на съюзниците в търговете и концесиите ──
create or replace function public.ol_buy(p_req uuid, p_world int, p_good text, p_qty numeric, p_max bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; g online.goods; want numeric := round(coalesce(p_qty, 0), 2); a online.asks; take numeric; cost bigint; fee bigint;
  got numeric := 0; paid bigint := 0;
begin
  r := online.req_begin(u, p_req, 'buy'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into g from online.goods where good = p_good;
  if not found then return online.req_end(u, p_req, online.fail('bad_good', 'Няма такава стока.')); end if;
  if want <= 0 or want > 1000000 then return online.req_end(u, p_req, online.fail('bad_qty', 'Невалидно количество.')); end if;
  select * into c from online.companies where id = c.id for update;   -- купувачът първи
  for a in select * from online.asks where world_id = p_world and good = p_good and status = 'open' and company_id <> c.id and price <= coalesce(p_max, g.price)
            order by price, id for update loop
    exit when want - got <= 0;
    take := least(a.qty, want - got);
    cost := ceil(take * a.price)::bigint;
    if c.cash - paid < cost then take := floor((c.cash - paid) * 100.0 / a.price) / 100.0; cost := ceil(take * a.price)::bigint; end if;
    exit when take <= 0;
    fee := case when online.is_ally(c.id, a.company_id) then 0 else ceil(cost * online.fee_pct())::bigint end;   -- между съюзници — без такса
    update online.asks set qty = qty - take, status = case when qty - take <= 0 then 'filled' else 'open' end where id = a.id;
    insert into online.trades (world_id, ask_id, buyer, seller, good, qty, price) values (p_world, a.id, c.id, a.company_id, p_good, take, a.price);
    perform online.money(c.id, -cost, 'стоки', format('Покупка: %s %s %s по %s €', take, g.unit, g.nm, online.eur(a.price)), null);
    perform online.money(a.company_id, cost - fee, 'продажба', format('Продажба: %s %s %s по %s € (такса %s €)', take, g.unit, g.nm, online.eur(a.price), online.eur(fee)), null);
    perform online.note(a.company_id, 'good', format('💰 Продадени %s %s %s', take, g.unit, g.nm), format('Купувач: %s · +%s €', c.name, online.eur(cost - fee)));
    got := got + take; paid := paid + cost;
  end loop;
  if got > 0 then perform online.inv_add(c.id, p_good, got); end if;
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'qty', got, 'paid', paid,
    'msg', case when got = 0 then 'Няма оферти на тази цена (или нямаш пари).' when got < want then format('Купени %s от %s — повече няма на тази цена.', got, want) else null end));
end $$;

create or replace function public.ol_tenders(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies; w online.worlds;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  select * into w from online.worlds where id = p_world;
  -- затваряме изтеклите веднага (не чакаме планираната задача)
  perform online.resolve_tender(t.id) from online.tenders t where t.world_id = p_world and t.status = 'open' and t.closes_at <= online.wnow(w);
  return jsonb_build_object('ok', true, 'server_now', online.wnow(w),
    'rules', jsonb_build_object('min_price_pct', online.min_price_pct(), 'advance_pct', online.advance_pct(), 'max_contracts', online.cfg(w, 'max_contracts', 2),
      'tiers', jsonb_build_object('local', online.tier_levels(w, 'local'), 'national', online.tier_levels(w, 'national'), 'global', online.tier_levels(w, 'global'))),
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'tier', t.tier, 'kind', t.kind, 'budget', t.budget, 'deposit', t.deposit, 'mat', t.mat,
        'days', t.days, 'start_days', t.start_days, 'need', t.need, 'closes_at', t.closes_at,
        'bids', (select count(*) from online.bids b where b.tender_id = t.id and b.status = 'active'),
        'my', (select jsonb_build_object('price', b.price, 'placed_at', b.placed_at, 'status', b.status, 'deposit', b.deposit) from online.bids b where b.tender_id = t.id and b.company_id = c.id),
        'why_not', online.why_not(c, t, w, exists (select 1 from online.bids b where b.tender_id = t.id and b.company_id = c.id and b.status = 'active')),
        'ally_bids', coalesce((select jsonb_agg(jsonb_build_object('name', co.name, 'price', b.price)) from online.bids b join online.companies co on co.id = b.company_id
           where b.tender_id = t.id and b.status = 'active' and online.is_ally(c.id, b.company_id)), '[]'::jsonb),
        'rival_bids', (select count(*) from online.bids b where b.tender_id = t.id and b.status = 'active' and online.is_rival(c.id, b.company_id))) order by t.tier, t.closes_at)
      from online.tenders t where t.world_id = p_world and t.status = 'open'), '[]'::jsonb),
    'closed', coalesce((select jsonb_agg(x order by x ->> 'resolved_at' desc) from (select jsonb_build_object('id', t.id, 'title', t.title, 'tier', t.tier, 'budget', t.budget, 'status', t.status, 'resolved_at', t.resolved_at,
        'bids', (select count(*) from online.bids b where b.tender_id = t.id and b.status in ('won', 'lost')),
        'winner', (select co.name from online.bids b join online.companies co on co.id = b.company_id where b.id = t.winner_bid),
        'price', (select b.price from online.bids b where b.id = t.winner_bid),
        'mine', (select b.status from online.bids b where b.tender_id = t.id and b.company_id = c.id)) x
      from online.tenders t where t.world_id = p_world and t.status <> 'open' order by t.resolved_at desc limit 12) q), '[]'::jsonb),
    'contracts', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'title', t.title, 'price', k.price, 'deposit', k.deposit, 'status', k.status, 'start_by', k.start_by,
        'need', t.need, 'days', t.days, 'mat', t.mat, 'advance', round(k.price * online.advance_pct()), 'build', k.build_id,
        'end_at', (select end_at from online.builds where id = k.build_id)) order by k.id desc)
      from online.contracts k join online.tenders t on t.id = k.tender_id where k.company_id = c.id and (k.status in ('awaiting', 'running') or k.created_at > now() - interval '2 days')), '[]'::jsonb));
end $$;

create or replace function public.ol_concessions(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies; w online.worlds;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  select * into w from online.worlds where id = p_world;
  perform online.conc_resolve(r.id) from online.conc_rounds r where r.world_id = p_world and r.status = 'auction' and r.closes_at <= online.wnow(w);
  return jsonb_build_object('ok', true, 'level', online.level(c.xp), 'cash', c.cash, 'server_now', online.wnow(w), 'free', online.free_units(c.id),
    'rules', jsonb_build_object('max', online.cfg(w, 'max_concessions', 2), 'mine', online.active_conc(c.id)),
    'auctions', coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('round', r.id, 'closes_at', r.closes_at,
        'bids', (select count(*) from online.conc_bids b where b.round_id = r.id),
        'my', (select b.amount from online.conc_bids b where b.round_id = r.id and b.company_id = c.id),
        'ally_bids', coalesce((select jsonb_agg(jsonb_build_object('name', co.name, 'amount', b.amount)) from online.conc_bids b join online.companies co on co.id = b.company_id
           where b.round_id = r.id and b.status = 'active' and online.is_ally(c.id, b.company_id)), '[]'::jsonb)) order by r.closes_at)
      from online.conc_rounds r join online.conc_types t on t.key = r.ctype where r.world_id = p_world and r.status = 'auction'), '[]'::jsonb),
    'active', coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('round', r.id, 'end_at', r.end_at, 'fee', r.fee,
        'holder', (select name from online.companies where id = r.holder), 'mine', r.holder = c.id) order by r.end_at)
      from online.conc_rounds r join online.conc_types t on t.key = r.ctype where r.world_id = p_world and r.status = 'active'), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(x) from (select jsonb_build_object('nm', t.nm, 'ico', t.ico, 'status', r.status, 'fee', r.fee, 'holder', (select name from online.companies where id = r.holder)) x
       from online.conc_rounds r join online.conc_types t on t.key = r.ctype where r.world_id = p_world and r.status in ('ended', 'no_bids') order by r.id desc limit 8) q), '[]'::jsonb));
end $$;

revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
