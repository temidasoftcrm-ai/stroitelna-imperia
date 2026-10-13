-- търговете в едно ниво са от различни видове (начинаещите винаги имат търг без кран)
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
                online.cfg(w, 'start_days', 2)::int, k.need,
                online.wnow(w), online.wnow(w) + make_interval(secs => bid_days * w.day_seconds));
      have := have + 1; n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
