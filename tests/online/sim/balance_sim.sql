-- Симулация на баланса на „Онлайн империя“: ботове играят през ИСТИНСКИТЕ сървърни функции (public.ol_*),
-- ден по ден. Пуска се върху чиста локална база (не в живия сървър): bash tests/online/sim/run_sim.sh <socket-dir> [дни]
-- Стратегии:
--   builder  — само строежи; реинвестира в техника
--   tender   — строежи + обществени поръчки (оферта 88% от бюджета) + концесии
--   producer — строежи + производства (бетон/енергия/стомана/гориво); излишъка продава на пазара под държавната цена
--   investor — строежи + консорциуми (влиза с 20–30%, кани другите)
--   late     — builder, който влиза на ден 30 (може ли да догони?)
\set ON_ERROR_STOP 1
create table if not exists t.sim (day int, bot text, cash bigint, value bigint, level int, xp bigint, running int, units int, profit7 bigint, primary key (day, bot));
create table if not exists t.sim_events (day int, bot text, what text);

create or replace function t.call(u uuid, fn text, args text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', u::text, true);
  delete from online.rate where user_id = u;
  execute format('select public.%s(%s)', fn, args) into r;
  return r;
exception when others then return jsonb_build_object('ok', false, 'err', sqlerrm);
end $$;

-- купува техника балансирано: каквото липсва за най-голямата отключена поръчка, иначе по една от всичко
create or replace function t.buy_units(u uuid, w int, cash bigint, lv int, reserve bigint) returns void language plpgsql as $$
declare s jsonb; k record; e record; free jsonb; units jsonb; cost bigint; want text;
begin
  s := t.call(u, 'ol_state', w::text);
  units := s -> 'units';
  for k in select * from online.kinds where min_level <= lv order by reward desc limit 1 loop
    for e in select key, value::int v from jsonb_each_text(k.need) loop
      if coalesce((units ->> e.key)::int, 0) < e.v * 2 then want := e.key; exit; end if;
    end loop;
  end loop;
  if want is null then
    select type into want from online.unit_types ut where ut.type in ('crew', 'loader', 'truck', 'crane', 'tractor') order by coalesce((units ->> ut.type)::int, 0), ut.cost limit 1;
  end if;
  select ut.cost into cost from online.unit_types ut where ut.type = want;
  if cash - cost > reserve then perform t.call(u, 'ol_buy_unit', format('%L, %s, %L, 1', gen_random_uuid(), w, want)); end if;
end $$;

create or replace function t.bot(w int, u uuid, strat text, d int) returns void language plpgsql as $$
declare s jsonb; o jsonb; c jsonb; lv int; cash bigint; tn jsonb; x jsonb; m jsonb; g jsonb; f record; cs jsonb; i int; keep numeric;
begin
  s := t.call(u, 'ol_state', w::text);
  if s ->> 'ok' <> 'true' or s -> 'company' is null then return; end if;
  c := s -> 'company'; lv := (c ->> 'level')::int; cash := (c ->> 'cash')::bigint;
  -- 1) обществени поръчки: старт на спечелените договори, оферти за допустимите
  if strat = 'tender' then
    tn := t.call(u, 'ol_tenders', w::text);
    for x in select * from jsonb_array_elements(tn -> 'contracts') loop
      if x ->> 'status' = 'awaiting' then perform t.call(u, 'ol_start_contract', format('%L, %s, %s', gen_random_uuid(), w, x ->> 'id')); end if;
    end loop;
    for x in select * from jsonb_array_elements(tn -> 'open') loop
      if x ->> 'why_not' is null and x -> 'my' = 'null'::jsonb then
        perform t.call(u, 'ol_bid', format('%L, %s, %s, %s', gen_random_uuid(), w, x ->> 'id', round((x ->> 'budget')::bigint * (0.86 + random() * 0.06))));
      end if;
    end loop;
    cs := t.call(u, 'ol_concessions', w::text);
    for x in select * from jsonb_array_elements(cs -> 'auctions') loop
      if (x ->> 'min_level')::int <= lv and x ->> 'my' is null and cash > (x ->> 'min_bid')::bigint * 3 then
        perform t.call(u, 'ol_conc_bid', format('%L, %s, %s, %s', gen_random_uuid(), w, x ->> 'round', round((x ->> 'min_bid')::bigint * 1.3)));
      end if;
    end loop;
  end if;
  if strat in ('builder', 'investor', 'late') then
    cs := t.call(u, 'ol_concessions', w::text);
    for x in select * from jsonb_array_elements(cs -> 'auctions') loop
      if (x ->> 'min_level')::int <= lv and x ->> 'my' is null and cash > (x ->> 'min_bid')::bigint * 2 then
        perform t.call(u, 'ol_conc_bid', format('%L, %s, %s, %s', gen_random_uuid(), w, x ->> 'round', round((x ->> 'min_bid')::bigint * (1.05 + random() * 0.25)))); exit;
      end if;
    end loop;
  end if;
  -- 2) производства и продажба на излишъка
  if strat = 'producer' then
    m := t.call(u, 'ol_market', w::text);
    for f in select * from online.facility_types order by min_level, cost loop
      if f.min_level <= lv and coalesce((m -> 'facilities' ->> f.type)::int, 0) < 1 + (lv / 8) and cash > f.cost * 2 then
        perform t.call(u, 'ol_build_facility', format('%L, %s, %L', gen_random_uuid(), w, f.type)); exit;
      end if;
    end loop;
    for g in select * from jsonb_array_elements(m -> 'goods') loop
      -- пази запас за ~3 строежа, остатъка на пазара на 90% (или на държавата, ако пазарът е пълен)
      keep := (array[400, 40, 20])[1 + (g ->> 'good' = 'steel')::int + 2 * (g ->> 'good' not in ('concrete', 'steel'))::int];
      if (g ->> 'mine')::numeric > keep then
        if jsonb_array_length(m -> 'my_asks') < 4 then
          perform t.call(u, 'ol_sell_order', format('%L, %s, %L, %s, %s', gen_random_uuid(), w, g ->> 'good', round(((g ->> 'mine')::numeric - 200) / 2, 2), round((g ->> 'price')::bigint * 0.9)));
        else
          perform t.call(u, 'ol_sell_state', format('%L, %s, %L, %s', gen_random_uuid(), w, g ->> 'good', round(((g ->> 'mine')::numeric - 300), 2)));
        end if;
      end if;
    end loop;
  end if;
  -- всички купуват бетон/стомана от пазара, ако е по-евтино от държавата
  if strat <> 'producer' then
    m := t.call(u, 'ol_market', w::text);
    for g in select * from jsonb_array_elements(m -> 'goods') loop
      if g ->> 'good' in ('concrete', 'steel') and jsonb_array_length(g -> 'book') > 0 and (g ->> 'mine')::numeric < 100 and cash > 3000000 then
        perform t.call(u, 'ol_buy', format('%L, %s, %L, %s, %s', gen_random_uuid(), w, g ->> 'good', (array[150, 15])[1 + (g ->> 'good' = 'steel')::int], round((g ->> 'price')::bigint * 0.95)));
      end if;
    end loop;
  end if;
  -- 3) консорциуми
  if strat = 'investor' then
    cs := t.call(u, 'ol_consortia', w::text);
    for x in select * from jsonb_array_elements(cs -> 'projects') loop
      if x -> 'cons' = 'null'::jsonb and (x ->> 'min_level')::int <= lv and cash > (x ->> 'cost')::bigint * 0.5 then
        perform t.call(u, 'ol_cons_found', format('%L, %s, %L, 40, true', gen_random_uuid(), w, x ->> 'key')); exit;
      end if;
    end loop;
  end if;
  -- всички с пари влизат в отворени консорциуми с 20%
  cs := t.call(u, 'ol_consortia', w::text);
  for x in select * from jsonb_array_elements(cs -> 'projects') loop
    if x -> 'cons' <> 'null'::jsonb and x -> 'cons' ->> 'status' = 'forming' and (x -> 'cons' ->> 'open')::boolean
       and not exists (select 1 from jsonb_array_elements(x -> 'cons' -> 'members') mm where (mm ->> 'me')::boolean)
       and (x ->> 'min_level')::int <= lv and cash > (x ->> 'cost')::bigint * 0.2 * 2 and 100 - (x -> 'cons' ->> 'taken')::int >= 20 then
      perform t.call(u, 'ol_cons_join', format('%L, %s, %s, 20', gen_random_uuid(), w, x -> 'cons' ->> 'id'));
    end if;
  end loop;
  -- 4) строежи: всички възможни поръчки, най-скъпите първо
  s := t.call(u, 'ol_state', w::text);
  for o in select * from jsonb_array_elements(s -> 'offers') order by (value ->> 'reward')::bigint desc loop
    perform t.call(u, 'ol_start_build', format('%L, %s, %s', gen_random_uuid(), w, o ->> 'id'));
  end loop;
  -- 5) реинвестиция в техника (пази резерв за материали)
  s := t.call(u, 'ol_state', w::text); cash := (s -> 'company' ->> 'cash')::bigint;
  for i in 1 .. 3 loop
    perform t.buy_units(u, w, cash, lv, greatest(1500000, (select max(mat) from online.kinds where min_level <= lv) * 2));
    s := t.call(u, 'ol_state', w::text); cash := (s -> 'company' ->> 'cash')::bigint;
  end loop;
end $$;

create or replace function t.snap(w int, u uuid, bot text, d int) returns void language plpgsql as $$
declare c online.companies;
begin
  select * into c from online.companies where world_id = w and user_id = u;
  if c.id is null then return; end if;
  insert into t.sim values (d, bot, c.cash, (online.value_parts(c) ->> 'value')::bigint, online.level(c.xp), c.xp,
    (select count(*) from online.builds where company_id = c.id and status = 'running'),
    (select coalesce(sum(n), 0) from online.units where company_id = c.id), online.profit(c, 7))
  on conflict do nothing;
end $$;
