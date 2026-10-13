-- „Онлайн империя“ — ПАРИ МЕЖДУ СЪЮЗНИЦИ: подарък или заем.
-- Правила срещу измами (втори акаунт, който „храни“ главния):
--   • само между активни съюзници, чийто съюз е на поне 3 игрални дни;
--   • таван: изпратеното (подаръци + отпуснати заеми) за последните 7 игрални дни ≤ 10% от собствената стойност на изпращача;
--   • минимум 1 000 €; фирма с просрочен съюзен заем не може да подарява и да дава заеми;
--   • всеки превод се записва в журнала и в дневника на администратора;
--   • ПОДАРЪЦИТЕ не се броят за ръст в сезона на получателя (резултатът им се приспада).
-- ЗАЕМ: заемодателят предлага сума, срок (3–30 дни) и лихва за целия срок (0–10%); заемополучателят приема или отказва.
--   При приемане парите се прехвърлят. Длъжникът връща по всяко време; на падежа сървърът сам събира, колкото има в наличност,
--   и опитва всеки ден, докато се изплати (просрочен). Заемодателят може да опрости остатъка.
--   В стойността: вземането е актив за заемодателя, задължението — пасив за длъжника (заемът не вдига стойността).

create table online.ally_transfers (
  id bigserial primary key,
  world_id int not null references online.worlds on delete cascade,
  from_c bigint not null references online.companies on delete cascade,
  to_c bigint not null references online.companies on delete cascade,
  kind text not null check (kind in ('gift', 'loan')),
  amount bigint not null check (amount > 0),
  rate_pct int not null default 0 check (rate_pct between 0 and 10),
  days int check (days between 3 and 30),
  owed bigint not null default 0,          -- главница + лихва (за заем)
  paid bigint not null default 0 check (paid >= 0),
  status text not null check (status in ('done', 'offered', 'open', 'overdue', 'repaid', 'forgiven', 'declined', 'cancelled')),
  day int not null,                        -- ден на превода (за тавана)
  due_day int,
  created_at timestamptz not null default now(),
  check (from_c <> to_c)
);
create index ally_transfers_from on online.ally_transfers (from_c, day);
create index ally_transfers_to on online.ally_transfers (to_c);
create index ally_transfers_due on online.ally_transfers (due_day) where status in ('open', 'overdue');

create or replace function online.ally_min_days() returns int language sql immutable as $$ select 3 $$;
create or replace function online.ally_cap_pct() returns numeric language sql immutable as $$ select 0.10 $$;
create or replace function online.ally_min_amount() returns bigint language sql immutable as $$ select 100000::bigint $$;

-- вземания (+) и задължения (−) по съюзни заеми
create or replace function online.ally_net(p_company bigint) returns bigint language sql stable as $$
  select (coalesce((select sum(owed - paid) from online.ally_transfers where from_c = p_company and status in ('open', 'overdue')), 0)
        - coalesce((select sum(owed - paid) from online.ally_transfers where to_c = p_company and status in ('open', 'overdue')), 0))::bigint
$$;
-- получени подаръци от даден момент (за сезона)
create or replace function online.gifts_in(p_company bigint, p_since timestamptz) returns bigint language sql stable as
  $$ select coalesce(sum(amount), 0)::bigint from online.ally_transfers where to_c = p_company and kind = 'gift' and status = 'done' and created_at >= p_since $$;
-- изпратено за последните 7 игрални дни
create or replace function online.ally_sent7(c online.companies) returns bigint language sql stable as $$
  select coalesce(sum(t.amount), 0)::bigint from online.ally_transfers t, online.worlds w
   where w.id = c.world_id and t.from_c = c.id and t.day > online.wday(w) - 7 and (t.kind = 'gift' or t.status in ('open', 'overdue', 'repaid', 'forgiven'))
$$;
create or replace function online.ally_cap(c online.companies) returns bigint language sql stable as
  $$ select greatest(0, floor(greatest(0, (online.own_parts(c) ->> 'own')::numeric) * online.ally_cap_pct()) - online.ally_sent7(c))::bigint $$;
create or replace function online.ally_age_ok(x bigint, y bigint) returns boolean language sql stable as $$
  select exists (select 1 from online.alliances al join online.companies c on c.id = x join online.worlds w on w.id = c.world_id
                  where al.a = least(x, y) and al.b = greatest(x, y) and al.status = 'active'
                    and extract(epoch from (now() - al.since)) >= online.ally_min_days() * w.day_seconds)
$$;
create or replace function online.ally_overdue(x bigint) returns boolean language sql stable as
  $$ select exists (select 1 from online.ally_transfers where to_c = x and status = 'overdue') $$;
-- заключва двете фирми в нарастващ ред (без взаимно блокиране при насрещни преводи)
create or replace function online.lock2(x bigint, y bigint) returns void language sql as
  $$ select 1 from online.companies where id in (x, y) order by id for update $$;

-- проверки, общи за подарък и заем (изпращач c → получател t); null = всичко е наред
create or replace function online.ally_check(c online.companies, t online.companies, amt bigint) returns jsonb language plpgsql stable as $$
declare cap bigint;
begin
  if t.id is null then return online.fail('no_target', 'Няма такава фирма.'); end if;
  if not online.is_ally(c.id, t.id) then return online.fail('not_ally', 'Пари се изпращат само на съюзници.'); end if;
  if not online.ally_age_ok(c.id, t.id) then return online.fail('too_new', format('Съюзът трябва да е поне на %s игрални дни.', online.ally_min_days())); end if;
  if online.ally_overdue(c.id) then return online.fail('overdue', 'Първо върни просрочения си заем.'); end if;
  if amt is null or amt < online.ally_min_amount() then return online.fail('bad_amount', format('Минимумът е %s €.', online.eur(online.ally_min_amount()))); end if;
  cap := online.ally_cap(c);
  if amt > cap then return online.fail('cap', format('Тази седмица можеш да изпратиш още до %s € (10%% от стойността на фирмата за 7 дни).', online.eur(cap))); end if;
  return null;
end $$;

-- събиране на заем: взима от длъжника до p_max (или колкото има), плаща на заемодателя; връща платеното
create or replace function online.ally_collect(p_loan bigint, p_max bigint, p_ref text) returns bigint language plpgsql as $$
declare l online.ally_transfers; cash bigint; amt bigint; fn text; tn text;
begin
  select * into l from online.ally_transfers where id = p_loan;
  if l.status not in ('open', 'overdue') then return 0; end if;
  perform online.lock2(l.from_c, l.to_c);
  select * into l from online.ally_transfers where id = p_loan for update;
  if l.status not in ('open', 'overdue') then return 0; end if;
  select greatest(0, c.cash) into cash from online.companies c where id = l.to_c;
  amt := least(l.owed - l.paid, coalesce(p_max, l.owed - l.paid), cash);
  if amt <= 0 then return 0; end if;
  select name into fn from online.companies where id = l.from_c; select name into tn from online.companies where id = l.to_c;
  if not online.money(l.to_c, -amt, 'съюзен заем', format('Връщане на заем към %s', fn), p_ref || ':out') then return 0; end if;
  perform online.money(l.from_c, amt, 'съюзен заем', format('%s върна по заема', tn), p_ref || ':in');
  update online.ally_transfers set paid = paid + amt, status = case when paid + amt >= owed then 'repaid' else status end where id = l.id;
  if l.paid + amt >= l.owed then
    perform online.note(l.from_c, 'good', format('💸 %s изплати заема', tn), format('Общо %s €.', online.eur(l.owed)));
  end if;
  return amt;
end $$;

-- падежи: всеки цикъл събира падналите и просрочените заеми (всеки поотделно — една грешка не спира останалите)
create or replace function online.ally_tick() returns int language plpgsql as $$
declare l record; n int := 0; got bigint; d int;
begin
  for l in select t.*, online.wday(w) wd from online.ally_transfers t join online.worlds w on w.id = t.world_id
            where w.status = 'open' and t.status in ('open', 'overdue') and t.due_day <= online.wday(w) order by t.id loop
    begin
      got := online.ally_collect(l.id, null, 'alrep:' || l.id || ':' || l.wd);
      if l.status = 'open' and exists (select 1 from online.ally_transfers where id = l.id and status = 'open') then
        update online.ally_transfers set status = 'overdue' where id = l.id;
        perform online.note(l.to_c, 'bad', '⏰ Просрочен заем от съюзник', format('Остават %s €. Сървърът взима всеки ден от наличността, докато се изплати. Дотогава не можеш да изпращаш пари.',
          online.eur((select owed - paid from online.ally_transfers where id = l.id))));
        perform online.note(l.from_c, 'bad', format('⏰ %s не върна заема навреме', (select name from online.companies where id = l.to_c)), 'Сървърът ще събира от наличността му всеки ден.');
      end if;
      n := n + (got > 0)::int;
    exception when others then null;   -- ще опита отново в следващия цикъл
    end;
  end loop;
  return n;
end $$;

-- ═══════════════════ API ═══════════════════
create or replace function online.transfer_pub(t online.ally_transfers, me bigint) returns jsonb language sql stable as $$
  select jsonb_build_object('id', t.id, 'kind', t.kind, 'out', t.from_c = me, 'other', case when t.from_c = me then t.to_c else t.from_c end,
    'other_name', (select name from online.companies where id = case when t.from_c = me then t.to_c else t.from_c end),
    'amount', t.amount, 'rate_pct', t.rate_pct, 'days', t.days, 'owed', t.owed, 'paid', t.paid, 'status', t.status, 'day', t.day, 'due_day', t.due_day)
$$;

create or replace function public.ol_ally_money(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies; w online.worlds;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  select * into w from online.worlds where id = p_world;
  return jsonb_build_object('ok', true, 'day', online.wday(w), 'cap_left', online.ally_cap(c), 'sent7', online.ally_sent7(c),
    'min_amount', online.ally_min_amount(), 'min_days', online.ally_min_days(), 'cap_pct', online.ally_cap_pct(), 'overdue', online.ally_overdue(c.id),
    'allies', coalesce((select jsonb_agg(jsonb_build_object('id', co.id, 'name', co.name, 'ready', online.ally_age_ok(c.id, co.id),
        'ready_in_min', greatest(0, ceil((online.ally_min_days() * w.day_seconds - extract(epoch from (now() - al.since))) / 60))::int) order by co.name)
       from online.alliances al join online.companies co on co.id = case when al.a = c.id then al.b else al.a end
      where (al.a = c.id or al.b = c.id) and al.status = 'active'), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(online.transfer_pub(t, c.id) order by (t.status in ('offered', 'open', 'overdue')) desc, t.id desc)
       from (select * from online.ally_transfers where (from_c = c.id or to_c = c.id) and status not in ('declined', 'cancelled') order by id desc limit 30) t), '[]'::jsonb));
end $$;

-- подарък: парите отиват веднага
create or replace function public.ol_ally_gift(p_req uuid, p_world int, p_company bigint, p_amount bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; t online.companies; w online.worlds; amt bigint := round(coalesce(p_amount, 0) / 100.0) * 100; tid bigint;
begin
  r := online.req_begin(u, p_req, 'ally_gift'); if r is not null then return r; end if;
  -- двете фирми се заключват в нарастващ ред ПРЕДИ уреждането (иначе насрещни преводи се блокират взаимно)
  perform online.lock2((select id from online.companies where world_id = p_world and user_id = u), (select id from online.companies where id = p_company and world_id = p_world));
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into t from online.companies where id = p_company and world_id = p_world and id <> c.id;
  if t.id is not null then perform online.lock2(c.id, t.id); end if;
  select * into c from online.companies where id = c.id;
  r := online.ally_check(c, t, amt);
  if r is not null then return online.req_end(u, p_req, r); end if;
  select * into w from online.worlds where id = p_world;
  insert into online.ally_transfers (world_id, from_c, to_c, kind, amount, status, day) values (p_world, c.id, t.id, 'gift', amt, 'done', online.wday(w)) returning id into tid;
  if not online.money(c.id, -amt, 'подарък', format('🎁 Подарък за съюзника %s', t.name), 'gift:' || tid) then
    raise exception 'no_money';   -- отменя и записа на превода
  end if;
  perform online.money(t.id, amt, 'подарък', format('🎁 Подарък от съюзника %s', c.name), 'gift:' || tid);
  perform online.note(t.id, 'good', format('🎁 %s ти подари %s €', c.name, online.eur(amt)), 'Подаръците не се броят за ръст в сезона.');
  perform online.log(p_world, c.id, u, 'ally_gift', jsonb_build_object('to', t.id, 'to_name', t.name, 'amount', amt));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'id', tid));
exception when raise_exception then
  if sqlerrm = 'no_money' then return online.req_end(u, p_req, online.fail('no_money', 'Нямаш толкова налични пари.')); end if;
  raise;
end $$;

-- предложение за заем (парите се прехвърлят, когато съюзникът приеме)
create or replace function public.ol_ally_loan(p_req uuid, p_world int, p_company bigint, p_amount bigint, p_days int, p_rate_pct int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; t online.companies; w online.worlds; amt bigint := round(coalesce(p_amount, 0) / 100.0) * 100; tid bigint;
begin
  r := online.req_begin(u, p_req, 'ally_loan'); if r is not null then return r; end if;
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into t from online.companies where id = p_company and world_id = p_world and id <> c.id;
  r := online.ally_check(c, t, amt);
  if r is not null then return online.req_end(u, p_req, r); end if;
  if p_days is null or p_days not between 3 and 30 then return online.req_end(u, p_req, online.fail('bad_days', 'Срокът е от 3 до 30 игрални дни.')); end if;
  if p_rate_pct is null or p_rate_pct not between 0 and 10 then return online.req_end(u, p_req, online.fail('bad_rate', 'Лихвата е от 0 до 10% за целия срок.')); end if;
  if c.cash < amt then return online.req_end(u, p_req, online.fail('no_money', 'Нямаш толкова налични пари.')); end if;
  if (select count(*) from online.ally_transfers where from_c = c.id and to_c = t.id and status = 'offered') >= 3 then
    return online.req_end(u, p_req, online.fail('too_many', 'Вече има 3 чакащи предложения към тази фирма.'));
  end if;
  select * into w from online.worlds where id = p_world;
  insert into online.ally_transfers (world_id, from_c, to_c, kind, amount, rate_pct, days, owed, status, day)
    values (p_world, c.id, t.id, 'loan', amt, p_rate_pct, p_days, amt + amt * p_rate_pct / 100, 'offered', online.wday(w)) returning id into tid;
  perform online.note(t.id, 'invite', format('💸 %s ти предлага заем %s €', c.name, online.eur(amt)),
    format('Срок %s дни, лихва %s%% (общо за връщане %s €). Приеми или откажи в 🏦.', p_days, p_rate_pct, online.eur(amt + amt * p_rate_pct / 100)));
  return online.req_end(u, p_req, jsonb_build_object('ok', true, 'id', tid));
end $$;

-- p_action: 'accept' / 'decline' (длъжникът), 'cancel' (заемодателят, докато е предложение), 'forgive' (заемодателят опрощава остатъка)
create or replace function public.ol_ally_loan_act(p_req uuid, p_world int, p_loan bigint, p_action text) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; l online.ally_transfers; lender online.companies; w online.worlds; cap bigint;
begin
  r := online.req_begin(u, p_req, 'ally_loan_act'); if r is not null then return r; end if;
  -- двете фирми се заключват в нарастващ ред ПРЕДИ уреждането (иначе насрещни преводи се блокират взаимно)
  perform online.lock2((select from_c from online.ally_transfers where id = p_loan), (select to_c from online.ally_transfers where id = p_loan));
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into l from online.ally_transfers where id = p_loan and world_id = p_world and kind = 'loan' and (from_c = c.id or to_c = c.id);
  if not found then return online.req_end(u, p_req, online.fail('no_loan', 'Няма такъв заем.')); end if;
  perform online.lock2(l.from_c, l.to_c);
  select * into l from online.ally_transfers where id = l.id for update;
  select * into lender from online.companies where id = l.from_c;
  select * into w from online.worlds where id = p_world;
  if p_action = 'accept' and l.to_c = c.id and l.status = 'offered' then
    -- проверките на заемодателя важат към момента на приемане (таван, наличност, съюз)
    if not online.is_ally(l.from_c, l.to_c) then return online.req_end(u, p_req, online.fail('not_ally', 'Вече не сте съюзници.')); end if;
    if online.ally_overdue(l.from_c) then return online.req_end(u, p_req, online.fail('overdue', 'Заемодателят има просрочен заем.')); end if;
    cap := online.ally_cap(lender);
    if l.amount > cap then return online.req_end(u, p_req, online.fail('cap', format('%s е изчерпал седмичния си таван (остават %s €).', lender.name, online.eur(cap)))); end if;
    if not online.money(l.from_c, -l.amount, 'съюзен заем', format('Заем за %s (%s дни, %s%%)', c.name, l.days, l.rate_pct), 'aloan:' || l.id) then
      return online.req_end(u, p_req, online.fail('no_money', format('%s вече няма толкова пари.', lender.name)));
    end if;
    perform online.money(c.id, l.amount, 'съюзен заем', format('Заем от %s — върни %s € до ден %s', lender.name, online.eur(l.owed), online.wday(w) + l.days), 'aloan:' || l.id);
    update online.ally_transfers set status = 'open', day = online.wday(w), due_day = online.wday(w) + l.days where id = l.id;
    perform online.note(l.from_c, 'good', format('💸 %s прие заема', c.name), format('Връщане %s € до ден %s.', online.eur(l.owed), online.wday(w) + l.days));
    perform online.log(p_world, c.id, u, 'ally_loan', jsonb_build_object('from', l.from_c, 'from_name', lender.name, 'amount', l.amount, 'owed', l.owed, 'days', l.days));
    return online.req_end(u, p_req, jsonb_build_object('ok', true));
  elsif p_action = 'decline' and l.to_c = c.id and l.status = 'offered' then
    update online.ally_transfers set status = 'declined' where id = l.id;
    perform online.note(l.from_c, 'info', format('%s отказа заема', c.name), null);
    return online.req_end(u, p_req, jsonb_build_object('ok', true));
  elsif p_action = 'cancel' and l.from_c = c.id and l.status = 'offered' then
    update online.ally_transfers set status = 'cancelled' where id = l.id;
    return online.req_end(u, p_req, jsonb_build_object('ok', true));
  elsif p_action = 'forgive' and l.from_c = c.id and l.status in ('open', 'overdue') then
    update online.ally_transfers set status = 'forgiven' where id = l.id;
    perform online.note(l.to_c, 'good', format('🎁 %s опрости заема ти', c.name), format('Не дължиш остатъка от %s €.', online.eur(l.owed - l.paid)));
    perform online.log(p_world, c.id, u, 'ally_forgive', jsonb_build_object('to', l.to_c, 'left', l.owed - l.paid));
    return online.req_end(u, p_req, jsonb_build_object('ok', true));
  end if;
  return online.req_end(u, p_req, online.fail('bad_action', 'Действието не е възможно в това състояние.'));
end $$;

-- длъжникът връща (част или всичко) по всяко време
create or replace function public.ol_ally_repay(p_req uuid, p_world int, p_loan bigint, p_amount bigint) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); r jsonb; c online.companies; l online.ally_transfers; got bigint;
begin
  r := online.req_begin(u, p_req, 'ally_repay'); if r is not null then return r; end if;
  -- двете фирми се заключват в нарастващ ред ПРЕДИ уреждането (иначе насрещни преводи се блокират взаимно)
  perform online.lock2((select from_c from online.ally_transfers where id = p_loan), (select to_c from online.ally_transfers where id = p_loan));
  c := online.my_company(u, p_world);
  if c.id is null then return online.req_end(u, p_req, online.fail('no_company', 'Нямаш фирма в този свят.')); end if;
  select * into l from online.ally_transfers where id = p_loan and world_id = p_world and to_c = c.id and status in ('open', 'overdue');
  if not found then return online.req_end(u, p_req, online.fail('no_loan', 'Няма такъв активен заем.')); end if;
  if coalesce(p_amount, 0) <= 0 then return online.req_end(u, p_req, online.fail('bad_amount', 'Въведи сума.')); end if;
  select cash into c.cash from online.companies where id = c.id;
  if c.cash < least(p_amount, l.owed - l.paid) then return online.req_end(u, p_req, online.fail('no_money', 'Нямаш толкова налични пари.')); end if;
  got := online.ally_collect(l.id, p_amount, 'alpay:' || p_req);
  return online.req_end(u, p_req, jsonb_build_object('ok', got > 0, 'paid', got, 'left', l.owed - l.paid - got));
end $$;

-- ── стойността включва съюзните заеми; сезонът приспада подаръците; tick събира падежите ──
create or replace function online.own_parts(c online.companies) returns jsonb language sql stable as $$
  with u as (select coalesce(sum(u.n * t.cost / 2), 0)::bigint v from online.units u join online.unit_types t using (type) where u.company_id = c.id),
       f as (select coalesce(sum(f.n * t.cost / 2), 0)::bigint v from online.facilities f join online.facility_types t using (type) where f.company_id = c.id),
       w as (select coalesce(sum(b.mat), 0)::bigint v from online.builds b where b.company_id = c.id and b.status = 'running'),
       g as (select coalesce(sum(floor(q.qty * gd.price * online.buyback_pct())), 0)::bigint v from (
               select good, qty from online.inventory where company_id = c.id
               union all select good, qty from online.asks where company_id = c.id and status = 'open') q join online.goods gd using (good)),
       s as (select online.stakes(c.id) v),
       k as (select coalesce(sum((r.fee * greatest(0, extract(epoch from (r.end_at - online.wnow(ww)))) / greatest(1, extract(epoch from (r.end_at - r.start_at))))::bigint), 0)::bigint v
               from online.conc_rounds r join online.worlds ww on ww.id = r.world_id where r.holder = c.id and r.status = 'active')
  select jsonb_build_object('cash', c.cash, 'held', c.held, 'units', u.v, 'facilities', f.v, 'goods', g.v, 'wip', w.v, 'stakes', s.v, 'concessions', k.v,
                            'debt', c.debt, 'ally', online.ally_net(c.id), 'own', online.ally_net(c.id) + c.cash + c.held + u.v + f.v + g.v + w.v + s.v + k.v - c.debt) from u, f, w, g, s, k
$$;

create or replace function public.ol_ranking_formula() returns text language sql immutable as
  $$ select 'Стойност = (наличност + блокирани депозити и оферти + техника и производства по 50% + стоки по изкупната цена (60%) + строежи в ход + дялове в консорциуми и платени концесии + вземания по съюзни заеми − дълг − задължения по съюзни заеми) × непродадения дял на фирмата + дяловете ѝ в други фирми. Заемът не вдига стойността — дългът се приспада. Печалба = приходи от строежи, договори, продажби, дивиденти и концесии − материали, стоки, енергия, гориво, поддръжка, концесионни такси и лихви − задържани депозити за последните 7 игрални дни.' $$;

create or replace function online.season_finish(p_season bigint) returns void language plpgsql as $$
declare s online.seasons; w online.worlds; r record;
begin
  select * into s from online.seasons where id = p_season for update;
  if s.status <> 'active' then return; end if;
  select * into w from online.worlds where id = s.world_id;
  if s.ends_at > online.wnow(w) then return; end if;
  update online.season_entries e set final_value = online.cvalue(e.company_id) where e.season_id = s.id;
  update online.season_entries e set score = e.final_value - e.baseline - online.gifts_in(e.company_id, e.joined_at) where e.season_id = s.id;
  update online.season_entries e set rank = q.rk from (
      select e2.company_id, row_number() over (partition by e2.division order by e2.score desc, e2.joined_at, e2.company_id) rk
        from online.season_entries e2 join online.companies c on c.id = e2.company_id
       where e2.season_id = s.id and not exists (select 1 from online.members m where m.world_id = s.world_id and m.user_id = c.user_id and m.banned)) q
   where e.season_id = s.id and e.company_id = q.company_id;
  update online.seasons set status = 'ended' where id = s.id;
  for r in select * from online.season_entries where season_id = s.id and rank is not null loop
    perform online.note(r.company_id, case when r.rank <= 3 then 'level' else 'info' end,
      case when r.rank <= 3 then format('%s Сезон %s: %s място в %s!', (array['🥇', '🥈', '🥉'])[r.rank], s.n, r.rank, online.division_nm(r.division))
           else format('Сезон %s приключи: %s място в %s', s.n, r.rank, online.division_nm(r.division)) end,
      format('Ръст на стойността: %s €. Започва нов сезон.', online.eur(r.score)));
  end loop;
  perform online.log(s.world_id, null, null, 'season_end', jsonb_build_object('season', s.id, 'n', s.n));
end $$;

create or replace function public.ol_season(p_world int) returns jsonb language plpgsql security definer set search_path = online, public as $$
declare u uuid := online.me(); c online.companies; w online.worlds; s online.seasons;
begin
  c := online.my_company(u, p_world);
  if c.id is null then return online.fail('no_company', 'Нямаш фирма в този свят.'); end if;
  select * into w from online.worlds where id = p_world;
  select * into s from online.seasons where world_id = p_world and status = 'active';
  if s.id is not null then perform online.season_enroll(s); end if;
  return jsonb_build_object('ok', true, 'server_now', online.wnow(w),
    'rules', format('Резултат = ръст на стойността от влизането в сезона (по формулата на класацията). Новите фирми влизат по всяко време — броим от момента на влизане. Дивизията се определя от нивото при влизане: 🌱 Новаци 1–5, ⚙️ Професионалисти 6–12, 👑 Магнати 13+. Сезонът трае %s игрални дни; първите трима във всяка дивизия получават трофей. Изгонените не се класират. Подаръците от съюзници не се броят за ръст.', online.cfg(w, 'season_days', 30)),
    'season', case when s.id is null then null else jsonb_build_object('id', s.id, 'n', s.n, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'my_division', (select division from online.season_entries where season_id = s.id and company_id = c.id),
      'divisions', (select jsonb_object_agg(d, rows) from (
          select e.division d, jsonb_agg(jsonb_build_object('name', co.name, 'brand', co.brand, 'score', online.cvalue(co.id) - e.baseline - online.gifts_in(co.id, e.joined_at), 'joined_at', e.joined_at, 'me', co.id = c.id)
                   order by online.cvalue(co.id) - e.baseline - online.gifts_in(co.id, e.joined_at) desc, e.joined_at) rows
            from online.season_entries e join online.companies co on co.id = e.company_id
           where e.season_id = s.id and not exists (select 1 from online.members m where m.world_id = p_world and m.user_id = co.user_id and m.banned)
           group by e.division) q)) end,
    'archive', coalesce((select jsonb_agg(jsonb_build_object('n', ss.n, 'ended', ss.ends_at,
        'top', (select jsonb_agg(jsonb_build_object('division', e.division, 'rank', e.rank, 'name', co.name, 'brand', co.brand, 'score', e.score) order by e.division, e.rank)
                  from online.season_entries e join online.companies co on co.id = e.company_id where e.season_id = ss.id and e.rank <= 3)) order by ss.n desc)
       from online.seasons ss where ss.world_id = p_world and ss.status = 'ended'), '[]'::jsonb));
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
  n := n + online.ally_tick();
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
