#!/bin/bash
# Едновременни заявки и рестарт на сървъра по време на строеж. Вика се от run.sh с H, PORT, DB, PGDATA (по избор).
set -e
q() { psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222
W=$(q "select id from online.worlds where slug = 'econ-1'")
CO=$(q "select id from online.companies where world_id = $W and user_id = '$A'")
# 1) 8 едновременни покупки на самосвал (150 €·100) при наличност точно за един
q "delete from online.rate; update online.companies set cash = 1500000 where id = $CO; insert into online.ledger (company_id, day, amount, cash_after, reason, note) select $CO, 0, 1500000 - (select coalesce(sum(amount),0) from online.ledger where company_id = $CO), 1500000, 'тест', 'изравняване за теста'" >/dev/null
T0=$(q "select n from online.units where company_id = $CO and type = 'truck'")
for i in 1 2 3 4 5 6 7 8; do
  psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$A'); select public.ol_buy_unit(gen_random_uuid(), $W, 'truck', 1) ->> 'ok'" > /tmp/race_$$_$i.txt 2>&1 &
done
wait
OKS=$(cat /tmp/race_$$_*.txt | grep -c '^true$' || true); rm -f /tmp/race_$$_*.txt
T1=$(q "select n from online.units where company_id = $CO and type = 'truck'"); CASH=$(q "select cash from online.companies where id = $CO")
[ "$OKS" = 1 ] && [ $((T1 - T0)) = 1 ] && [ "$CASH" = 0 ] && echo " ok: 8 едновременни покупки → точно 1 успешна, наличност 0 €" || { echo "FAIL race: ok=$OKS trucks +$((T1-T0)) cash=$CASH"; exit 1; }
# 2) 6 едновременни повторения на една и съща заявка (един req_id) → една покупка
q "update online.companies set cash = cash + 4500000 where id = $CO; insert into online.ledger (company_id, day, amount, cash_after, reason, note) values ($CO, 0, 4500000, (select cash from online.companies where id = $CO), 'тест', 'пари за теста')" >/dev/null
RQ=$(q "select gen_random_uuid()"); C0=$(q "select coalesce(n,0) from online.units where company_id = $CO and type = 'tractor'")
for i in 1 2 3 4 5 6; do psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$A'); select public.ol_buy_unit('$RQ', $W, 'tractor', 1) ->> 'ok'" >/dev/null 2>&1 & done; wait
C1=$(q "select n from online.units where company_id = $CO and type = 'tractor'")
[ $((C1 - C0)) = 1 ] && echo " ok: 6 едновременни повторения на една заявка → 1 покупка" || { echo "FAIL dup: +$((C1-C0))"; exit 1; }
# 3) рестарт по време на строеж: строежът и сроковете оцеляват; завършва и се плаща веднъж
OF=$(q "select id from online.offers where company_id = $CO and status = 'open' order by id limit 1")
R=$(q "select t.as('$A'); select public.ol_start_build(gen_random_uuid(), $W, $OF) ->> 'ok'" | tail -1)
[ "$R" = true ] || { echo "FAIL start build: $R"; exit 1; }
BID=$(q "select id from online.builds where offer_id = $OF"); END0=$(q "select end_at from online.builds where id = $BID")
if [ -n "$PGDATA_DIR" ]; then
  /usr/lib/postgresql/16/bin/pg_ctl -D "$PGDATA_DIR" restart -m fast -w >/dev/null
  echo " ok: сървърът на базата е рестартиран по време на строежа"
fi
END1=$(q "select end_at from online.builds where id = $BID"); ST=$(q "select status from online.builds where id = $BID")
[ "$END0" = "$END1" ] && [ "$ST" = running ] && echo " ok: строежът е запазен след рестарта (същият срок)" || { echo "FAIL restart"; exit 1; }
q "update online.worlds set shift_s = shift_s + 600 * 40 where id = $W" >/dev/null
q "select online.tick()" >/dev/null; q "select online.tick()" >/dev/null
N=$(q "select count(*) from online.ledger where company_id = $CO and ref = 'build:$BID'")
[ "$N" = 1 ] && echo " ok: строежът е завършен и платен точно веднъж след рестарта" || { echo "FAIL paid $N"; exit 1; }
BAL=$(q "select (select sum(amount) from online.ledger where company_id = c.id) = c.cash from online.companies c where id = $CO")
[ "$BAL" = t ] && echo " ok: журнал = наличност" || { echo "FAIL ledger"; exit 1; }
echo " RACE/RESTART: ALL PASSED"
