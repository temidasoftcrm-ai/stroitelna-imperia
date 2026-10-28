-- coop_guard v2 (28.10.2026): таванът се смята от ПОСЛЕДНАТА снимка, не от пика за 24 ч.
-- Беше: изпратеното след пика (най-високите пари за 24 ч) ≤ пика × 1,25 + 200 000. Печалбата след пика не се брои →
-- играч с автопилот в много градове праща 40% от печалбата в холдинга непрекъснато и за няколко часа запълва тавана
-- (на 28.10: пик 308 млн, изпратени 385 млн за 10 ч, 406 превода) → всеки следващ превод — 400 „Сумата е повече от парите ти“.
-- Сега: изпратеното СЛЕД последната снимка ≤ парите В нея × 1,25 + 200 000. Снимката е на всяка минута и вече отразява
-- изпратеното преди нея (играта вади сумата от касата си преди превода), така че пак не можеш да пратиш повече, отколкото имаш.
-- Дневният таван (day_max) и таванът за една операция (op_max) остават.
create or replace function coop.guard_money(u uuid, k text, amt bigint) returns void language plpgsql as $$
declare s coop.snaps; day bigint; since bigint; cap numeric; m numeric;
begin
  if u is null or coalesce(amt, 0) <= 0 then return; end if;
  if amt > coop.lim('op_max') then raise exception 'coop_limit: Сумата е над тавана за една операция (% €).', coop.lim('op_max')::bigint; end if;
  perform pg_advisory_xact_lock(hashtextextended('coop_flows:' || u::text, 0));   -- две паралелни заявки на един играч — една след друга
  select coalesce(sum(amount), 0) into day from coop.flows where user_id = u and at > now() - interval '24 hours';
  if day + amt > coop.lim('day_max') then raise exception 'coop_limit: Над дневния таван на партньорските преводи (% € за 24 ч).', coop.lim('day_max')::bigint; end if;
  select * into s from coop.snaps where user_id = u;
  m := case when s.user_id is not null and jsonb_typeof(s.data -> 'money') = 'number' then (s.data ->> 'money')::numeric end;
  if m is null or s.at < now() - interval '24 hours' then
    if day + amt > coop.lim('no_snap_max') then raise exception 'coop_limit: Играта ти още не е синхронизирана с облака — опитай пак след минута.'; end if;
  else
    select coalesce(sum(amount), 0) into since from coop.flows where user_id = u and at >= s.at;
    cap := greatest(m, 0) * coop.lim('peak_mult') + coop.lim('peak_pad');
    if since + amt > cap then raise exception 'coop_limit: Сумата е повече от парите ти (по последната синхронизация) — опитай пак след минута.'; end if;
  end if;
  insert into coop.flows (user_id, kind, amount) values (u, k, amt);
end $$;
