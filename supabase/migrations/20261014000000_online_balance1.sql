-- „Онлайн империя“ — баланс 1 (след симулацията с ботове, tests/online/sim):
--  • строежите са ~3 пъти по-кратки (къща 3 дни вместо 8): при темпо 10 мин/ден къща е 30 мин, а не 80;
--  • XP за строеж/договор ×2 (1 XP на 50 € бюджет);
--  • договорите от търговете са 2 пъти по-кратки; срокът за старт е 3 дни, а стартът става и автоматично, щом се
--    освободи техника (преди 39 от 43 спечелени договора се проваляха и начинаещите губеха депозити).
update online.kinds set days = case kind when 'house' then 3 when 'shop' then 4 when 'office' then 6 else 10 end;
update online.offers o set days = k.days from online.kinds k where k.kind = o.kind and o.status = 'open';
update online.tender_kinds set days = greatest(5, round(days / 2.0));
update online.tenders t set days = k.days from online.tender_kinds k where k.kind = t.kind and t.status = 'open';

create or replace function public.ol_start_build(p_req uuid, p_world int, p_offer bigint) returns jsonb
language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; w online.worlds; o online.offers; k online.kinds; fr jsonb; e record; lot int; bid bigint; nrun int;
begin
  r := online.req_begin(u, p_req, 'start_build'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into w from online.worlds where id = p_world;
  select * into o from online.offers where id = p_offer and company_id = c.id for update;   -- само собствените предложения
  if not found or o.status <> 'open' then return online.req_end(u, p_req, online.fail('no_offer', 'Поръчката вече не е налична.')); end if;
  select * into k from online.kinds where kind = o.kind;
  select count(*) into nrun from online.builds where company_id = c.id and status = 'running';
  if nrun >= online.cfg(w, 'max_builds', 6) then return online.req_end(u, p_req, online.fail('max_builds', 'Достигнат е лимитът на едновременните строежи.')); end if;
  fr := online.free_units(c.id);
  for e in select key, value::int v from jsonb_each_text(k.need) loop
    if coalesce((fr ->> e.key)::int, 0) < e.v then
      return online.req_end(u, p_req, online.fail('no_units', format('Няма свободна техника: трябва %s × %s.', e.v, (select nm from online.unit_types where type = e.key))));
    end if;
  end loop;
  if not online.use_goods(c.id, k.goods, format('Материали: %s за %s', k.nm, o.client), 'mat:' || o.id) then
    return online.req_end(u, p_req, online.fail('no_money', format('Нямаш %s € за материалите, които липсват в склада.', online.eur(online.goods_gap(c.id, k.goods)))));
  end if;
  update online.offers set status = 'taken' where id = o.id;
  update online.companies set lots_used = lots_used + 1 where id = c.id returning lots_used into lot;
  insert into online.builds (company_id, offer_id, kind, title, reward, mat, xp, need, lot, start_at, end_at)
    values (c.id, o.id, o.kind, format('%s %s — %s', k.ico, k.nm, o.client), o.reward, o.mat, (o.reward / 5000)::int, k.need, lot,
            online.wnow(w), online.wnow(w) + make_interval(secs => o.days * w.day_seconds)) returning id into bid;
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'build', bid));
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
  fr := online.free_units(c.id);
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

create or replace function online.publish_tenders(w online.worlds) returns int language plpgsql as $$
declare v_tier text; want int; have int; k online.tender_kinds; city text; b bigint; n int := 0; bid_days int;
  bg text[] := array['sofia','plovdiv','varna','burgas','ruse','stz','pleven','vt','blg','shumen','dobrich','sliven','haskovo'];
  big text[] := array['sofia','plovdiv','varna','burgas','ruse','stz'];
  globe text[] := array['istanbul','athens','belgrade','bucharest','vienna','budapest','milan','munich','paris','madrid'];
  cnm jsonb := '{"sofia":"София","plovdiv":"Пловдив","varna":"Варна","burgas":"Бургас","ruse":"Русе","stz":"Стара Загора","pleven":"Плевен","vt":"Велико Търново","blg":"Благоевград","shumen":"Шумен","dobrich":"Добрич","sliven":"Сливен","haskovo":"Хасково","istanbul":"Истанбул","athens":"Атина","belgrade":"Белград","bucharest":"Букурещ","vienna":"Виена","budapest":"Будапеща","milan":"Милано","munich":"Мюнхен","paris":"Париж","madrid":"Мадрид"}';
begin
  if not exists (select 1 from online.companies where world_id = w.id) then return 0; end if;
  foreach v_tier in array array['local', 'national', 'global'] loop
    want := online.cfg(w, 'tenders_' || v_tier, case v_tier when 'local' then 3 when 'national' then 2 else 1 end)::int;
    bid_days := online.cfg(w, 'bid_days_' || v_tier, case v_tier when 'local' then 3 when 'national' then 5 else 7 end)::int;
    select count(*) into have from online.tenders where world_id = w.id and online.tenders.tier = v_tier and status = 'open';
    while have < want loop
      -- видовете в едно ниво не се повтарят, докато има свободен вид (така местните са училище, пожарна и полиция)
      select * into k from online.tender_kinds tk where tk.tier = v_tier
        order by (select count(*) from online.tenders o where o.world_id = w.id and o.status = 'open' and o.kind = tk.kind), random() limit 1;
      city := case v_tier when 'local' then bg[1 + floor(random() * array_length(bg, 1))::int] when 'national' then big[1 + floor(random() * array_length(big, 1))::int] else globe[1 + floor(random() * array_length(globe, 1))::int] end;
      b := round((k.budget_min + random() * (k.budget_max - k.budget_min)) / 100000) * 100000;
      insert into online.tenders (world_id, kind, tier, title, city, budget, deposit, mat, days, start_days, need, opens_at, closes_at)
        values (w.id, k.kind, v_tier, format('%s %s — %s', k.ico, k.nm, cnm ->> city), city, b,
                round(b * online.cfg(w, 'deposit_pct', 0.05) / 10000) * 10000, round(b * k.mat_share / 10000) * 10000, k.days,
                online.cfg(w, 'start_days', 3)::int, k.need,
                online.wnow(w), online.wnow(w) + make_interval(secs => bid_days * w.day_seconds));
      have := have + 1; n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- Автоматичен старт на спечелен договор, щом фирмата има свободна техника и пари за липсващите материали
-- (същите правила като ol_start_contract). Вика се от планираната задача — играчът не губи депозита само защото
-- не е бил в играта, когато техниката се е освободила.
create or replace function online.auto_start_contracts() returns int language plpgsql as $$
declare k record; c online.companies; w online.worlds; t online.tenders; fr jsonb; e record; ok boolean; adv bigint; lot int; bid bigint; n int := 0;
begin
  for k in select ct.* from online.contracts ct join online.companies co on co.id = ct.company_id join online.worlds ww on ww.id = co.world_id
            where ct.status = 'awaiting' and ww.status = 'open' and ct.start_by > online.wnow(ww) order by ct.id loop
    select * into c from online.companies where id = k.company_id for update;
    select * into w from online.worlds where id = c.world_id;
    perform 1 from online.contracts where id = k.id and status = 'awaiting' for update;
    if not found then continue; end if;
    select * into t from online.tenders where id = k.tender_id;
    fr := online.free_units(c.id); ok := true;
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
  n := n + online.auto_start_contracts();
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
