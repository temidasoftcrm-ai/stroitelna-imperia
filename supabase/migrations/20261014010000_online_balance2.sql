-- „Онлайн империя“ — баланс 2 (втора симулация с ботове):
--  • спечелен договор ЗАПАЗВА техниката си веднага (новите строежи не могат да я вземат); стартът става автоматично;
--  • консорциумите са по-достъпни (мостът 1 млн. € вместо 3 млн.), възвръщаемост ~1,6×;
--  • концесиите имат по-висока минимална оферта (50% от прихода за срока) — преди носеха 3× таксата;
--  • производствата се изплащат за ~40–60 дни (преди 100+): по-евтини и по-производителни.
update online.mega_types set cost = case key when 'bosphorus' then 100000000 when 'capecairo' then 400000000 when 'panama' then 1000000000 else 2000000000 end,
  revenue = case key when 'bosphorus' then 2700000 when 'capecairo' then 10700000 when 'panama' then 26700000 else 53000000 end;
update online.conc_types set min_bid = revenue * term_days / 2;
update online.facility_types set cost = case type when 'concrete_plant' then 15000000 when 'solar' then 12000000 when 'refinery' then 30000000 else 25000000 end,
  out_qty = case type when 'concrete_plant' then 40 when 'solar' then 20 when 'refinery' then 4 else 8 end;

create or replace function online.busy(p_company bigint) returns jsonb language sql stable as $$
  select coalesce(jsonb_object_agg(k, s), '{}'::jsonb) from (
    select key k, sum(v) s from (
      select e.key, e.value::int v from online.builds b, jsonb_each_text(b.need) e where b.company_id = p_company and b.status = 'running'
      union all
      select e.key, e.value::int from online.conc_rounds r join online.conc_types t on t.key = r.ctype, jsonb_each_text(t.need) e where r.holder = p_company and r.status = 'active'
      union all   -- спечелените договори, които чакат старт: техниката им е запазена (новите строежи не могат да я вземат)
      select e.key, e.value::int from online.contracts k join online.tenders t on t.id = k.tender_id, jsonb_each_text(t.need) e where k.company_id = p_company and k.status = 'awaiting') q
    group by key) z
$$;

-- техниката, която физически е свободна (без строежите в ход и действащите концесии; запазената за чакащи договори
-- се смята за свободна — за да може договорът да тръгне)
create or replace function online.free_physical(p_company bigint) returns jsonb language sql stable as $$
  select coalesce(jsonb_object_agg(u.type, u.n - coalesce((
      select sum(v) from (
        select e.value::int v from online.builds b, jsonb_each_text(b.need) e where b.company_id = p_company and b.status = 'running' and e.key = u.type
        union all
        select e.value::int from online.conc_rounds r join online.conc_types t on t.key = r.ctype, jsonb_each_text(t.need) e where r.holder = p_company and r.status = 'active' and e.key = u.type) q), 0)), '{}'::jsonb)
    from online.units u where u.company_id = p_company
$$;

create or replace function online.auto_start_contracts() returns int language plpgsql as $$
declare k record; c online.companies; w online.worlds; t online.tenders; fr jsonb; e record; ok boolean; adv bigint; lot int; bid bigint; n int := 0;
begin
  for k in select ct.* from online.contracts ct join online.companies co on co.id = ct.company_id join online.worlds ww on ww.id = co.world_id
            where ct.status = 'awaiting' and ww.status = 'open' and ct.start_by > online.wnow(ww) and online.cfg(ww, 'auto_start', 1) = 1 order by ct.id loop
    select * into c from online.companies where id = k.company_id for update;
    select * into w from online.worlds where id = c.world_id;
    perform 1 from online.contracts where id = k.id and status = 'awaiting' for update;
    if not found then continue; end if;
    select * into t from online.tenders where id = k.tender_id;
    fr := online.free_physical(c.id); ok := true;
    for e in select key, value::int v from jsonb_each_text(t.need) loop
      if coalesce((fr ->> e.key)::int, 0) < e.v then ok := false; end if;
    end loop;
    adv := round(k.price * online.advance_pct());
    if not ok or c.cash + adv < online.goods_gap(c.id, t.goods) then continue; end if;
    perform online.money(c.id, adv, 'търг', format('Аванс по договор: %s', t.title), 'adv:' || k.id);
    perform online.use_goods(c.id, t.goods, format('Материали: %s', t.title), 'cmat:' || k.id);
    update online.companies set lots_used = lots_used + 1 where id = c.id returning lots_used into lot;
    insert into online.builds (company_id, kind, title, reward, mat, xp, need, lot, start_at, end_at, contract_id)
      values (c.id, case when t.tier = 'local' then 'shop' when t.tier = 'national' then 'office' else 'tower' end, t.title, k.price - adv, t.mat,
              (k.price / 5000)::int, t.need, lot, online.wnow(w), online.wnow(w) + make_interval(secs => t.days * w.day_seconds), k.id) returning id into bid;
    update online.contracts set status = 'running', build_id = bid where id = k.id;
    perform online.note(c.id, 'good', format('▶️ Договорът „%s“ започна автоматично', t.title), format('Техниката се освободи. Аванс %s €.', online.eur(adv)));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.ol_start_contract(p_req uuid, p_world int, p_contract bigint) returns jsonb
language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; w online.worlds; k online.contracts; t online.tenders; fr jsonb; e record; adv bigint; lot int; bid bigint;
begin
  r := online.req_begin(u, p_req, 'start_contract'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into w from online.worlds where id = p_world;
  select * into k from online.contracts where id = p_contract and company_id = c.id for update;   -- само собствените договори
  if not found then return online.req_end(u, p_req, online.fail('no_contract', 'Няма такъв договор.')); end if;
  if k.status <> 'awaiting' then return online.req_end(u, p_req, online.fail('not_awaiting', 'Договорът вече е започнат или приключен.')); end if;
  if k.start_by <= online.wnow(w) then perform online.fail_contract(k.id); return online.req_end(u, p_req, online.fail('late', 'Срокът за започване изтече.')); end if;
  select * into t from online.tenders where id = k.tender_id;
  fr := online.free_physical(c.id);
  for e in select key, value::int v from jsonb_each_text(t.need) loop
    if coalesce((fr ->> e.key)::int, 0) < e.v then
      return online.req_end(u, p_req, online.fail('no_units', format('Няма свободна техника: трябва %s × %s.', e.v, (select nm from online.unit_types where type = e.key))));
    end if;
  end loop;
  adv := round(k.price * online.advance_pct());
  select * into c from online.companies where id = c.id for update;
  if c.cash + adv < online.goods_gap(c.id, t.goods) then
    return online.req_end(u, p_req, online.fail('no_money', format('Нямаш %s € за материалите, които липсват в склада (след аванса от %s €).', online.eur(online.goods_gap(c.id, t.goods) - adv), online.eur(adv))));
  end if;
  perform online.money(c.id, adv, 'търг', format('Аванс по договор: %s', t.title), 'adv:' || k.id);
  perform online.use_goods(c.id, t.goods, format('Материали: %s', t.title), 'cmat:' || k.id);
  update online.companies set lots_used = lots_used + 1 where id = c.id returning lots_used into lot;
  insert into online.builds (company_id, kind, title, reward, mat, xp, need, lot, start_at, end_at, contract_id)
    values (c.id, case when t.tier = 'local' then 'shop' when t.tier = 'national' then 'office' else 'tower' end, t.title, k.price - adv, t.mat,
            (k.price / 5000)::int, t.need, lot, online.wnow(w), online.wnow(w) + make_interval(secs => t.days * w.day_seconds), k.id) returning id into bid;
  update online.contracts set status = 'running', build_id = bid where id = k.id;
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'build', bid));
end $$;


-- Допустимост за търг (замества версията от етап В): капацитетът се смята БЕЗ временните строежи, но С поетите
-- ангажименти — чакащи/текущи договори, действащи концесии и другите ми активни оферти. Лимитът на договорите брои и
-- активните оферти, така че фирма не може да спечели повече договори, отколкото може да изпълни.
create or replace function online.committed(p_company bigint, p_except_tender bigint) returns jsonb language sql stable as $$
  select coalesce(jsonb_object_agg(k, s), '{}'::jsonb) from (
    select key k, sum(v) s from (
      select e.key, e.value::int v from online.contracts k join online.tenders t on t.id = k.tender_id, jsonb_each_text(t.need) e
       where k.company_id = p_company and k.status in ('awaiting', 'running')
      union all
      select e.key, e.value::int from online.bids b join online.tenders t on t.id = b.tender_id, jsonb_each_text(t.need) e
       where b.company_id = p_company and b.status = 'active' and t.status = 'open' and t.id <> coalesce(p_except_tender, 0)
      union all
      select e.key, e.value::int from online.conc_rounds r join online.conc_types t on t.key = r.ctype, jsonb_each_text(t.need) e
       where r.holder = p_company and r.status = 'active') q group by key) z
$$;
create or replace function online.why_not(c online.companies, t online.tenders, w online.worlds, p_has_bid boolean) returns text language plpgsql stable as $$
declare lv int := online.level(c.xp); r int[] := online.tier_levels(w, t.tier); e record; own int; com jsonb := online.committed(c.id, t.id); busy_n int;
begin
  if t.status <> 'open' or t.closes_at <= online.wnow(w) then return 'Търгът е затворен.'; end if;
  if lv < r[1] then return format('За %s поръчка трябва ниво %s (имаш %s).', online.tier_nm(t.tier), r[1], lv); end if;
  if lv > r[2] then return format('Местните поръчки са за фирми до ниво %s — твоята надпревара е в по-големите търгове.', r[2]); end if;
  for e in select key, value::int v from jsonb_each_text(t.need) loop
    select coalesce(n, 0) into own from online.units where company_id = c.id and type = e.key;
    if coalesce(own, 0) - coalesce((com ->> e.key)::int, 0) < e.v then
      return format('Нужен капацитет: %s × %s (имаш %s, от тях %s са обещани за други договори/оферти/концесии).', e.v, (select nm from online.unit_types where type = e.key), coalesce(own, 0), coalesce((com ->> e.key)::int, 0));
    end if;
  end loop;
  if not p_has_bid then
    busy_n := online.open_contracts(c.id) + (select count(*) from online.bids b join online.tenders tt on tt.id = b.tender_id where b.company_id = c.id and b.status = 'active' and tt.status = 'open');
    if busy_n >= online.cfg(w, 'max_contracts', 2) then return format('Имаш %s активни договора и оферти — лимитът е %s.', busy_n, online.cfg(w, 'max_contracts', 2)); end if;
    if c.cash < t.deposit then return format('Нужен е депозит %s €.', online.eur(t.deposit)); end if;
  end if;
  return null;
end $$;
update online.mega_types set forming_days = forming_days + 4;   -- повече време за събиране на партньори

revoke all on all tables in schema online from public, anon, authenticated;
revoke all on all functions in schema online from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ol\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
