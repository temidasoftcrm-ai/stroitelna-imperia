#!/bin/bash
# Пазар: много едновременни покупки от една оферта → не се продава повече от наличното; стоката и парите се запазват.
set -e
q() { psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222; V=33333333-3333-3333-3333-333333333333
W=$(q "select id from online.worlds where slug = 'market-1'")
CA=$(q "select id from online.companies where world_id = $W and user_id = '$A'")
q "delete from online.rate; select t.fund(id, 50000000) from online.companies where world_id = $W" >/dev/null
q "select online.inv_add($CA, 'steel', 10)" >/dev/null
ASK=$(q "select t.as('$A'); select public.ol_sell_order(gen_random_uuid(), $W, 'steel', 10, 80000) ->> 'ask'" | tail -1)
TOTAL0=$(q "select coalesce(sum(qty),0) from (select qty from online.inventory where good='steel' union all select qty from online.asks where good='steel' and status='open') x")
for i in 1 2 3 4; do for U in $B $V; do psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$U'); select public.ol_buy(gen_random_uuid(), $W, 'steel', 4, 90000)" >/dev/null 2>&1 & done; done; wait
SOLD=$(q "select coalesce(sum(qty),0) from online.trades where ask_id = $ASK"); LEFT=$(q "select qty from online.asks where id = $ASK")
TOTAL1=$(q "select coalesce(sum(qty),0) from (select qty from online.inventory where good='steel' union all select qty from online.asks where good='steel' and status='open') x")
[ "$(echo "$SOLD == 10" | bc)" = 1 ] && [ "$(echo "$LEFT == 0" | bc)" = 1 ] && echo " ok: 8 едновременни покупки по 4 т от оферта от 10 т → продадени точно 10 т" || { echo "FAIL sold=$SOLD left=$LEFT"; exit 1; }
[ "$(echo "$TOTAL0 == $TOTAL1" | bc)" = 1 ] && echo " ok: стоманата в света е запазена ($TOTAL1 т)" || { echo "FAIL total $TOTAL0 -> $TOTAL1"; exit 1; }
[ "$(q "select t.balanced()")" = t ] && echo " ok: журнал = наличност" || { echo "FAIL ledger"; exit 1; }
PAID=$(q "select -sum(l.amount) from online.ledger l join online.companies c on c.id = l.company_id where c.world_id = $W and l.reason = 'стоки' and l.note like '%Стомана%'"); [ "$PAID" = 800000 ] && echo " ok: купувачите платиха точно 10 × 800 €" || { echo "FAIL paid $PAID"; exit 1; }
echo " MARKET RACE: ALL PASSED"
