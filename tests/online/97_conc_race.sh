#!/bin/bash
# Концесии: едновременни вдигания на една оферта и паралелно затваряне → един концесионер, парите връщани веднъж.
set -e
q() { psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222
W=$(q "select id from online.worlds where slug = 'conc-1'")
q "delete from online.rate; update online.worlds set cfg = cfg || '{\"max_concessions\":5}' where id = $W; select t.units(id, 'crew', 9), t.units(id, 'truck', 9), t.units(id, 'tractor', 9), t.units(id, 'loader', 9), t.units(id, 'crane', 9) from online.companies where world_id = $W" >/dev/null
R=$(q "select id from online.conc_rounds where world_id = $W and status = 'auction' order by id limit 1"); MIN=$(q "select t.min_bid from online.conc_rounds r join online.conc_types t on t.key = r.ctype where r.id = $R")
for i in 1 2 3 4 5; do psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$A'); select public.ol_conc_bid(gen_random_uuid(), $W, $R, $MIN + $i * 1000000)" >/dev/null 2>&1 & done
psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$B'); select public.ol_conc_bid(gen_random_uuid(), $W, $R, $MIN + 500000)" >/dev/null 2>&1 &
wait
AM=$(q "select amount from online.conc_bids b join online.companies c on c.id = b.company_id where round_id = $R and c.user_id = '$A'"); HELD=$(q "select held from online.companies where world_id = $W and user_id = '$A'")
[ "$AM" = "$HELD" ] && echo " ok: 5 едновременни вдигания → блокирано е точно колкото е офертата ($((AM/100)) €)" || { echo "FAIL raise am=$AM held=$HELD"; exit 1; }
q "update online.worlds set shift_s = shift_s + 600 * 4 where id = $W" >/dev/null
for i in 1 2 3 4 5 6; do psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select online.conc_resolve($R)" >/dev/null 2>&1 & done; wait
HOLD=$(q "select count(*) from online.conc_rounds where id = $R and status = 'active'"); FEE=$(q "select count(*) from online.ledger where ref = 'conc:$R:fee'"); REL=$(q "select count(*) from online.ledger l join online.conc_bids b on l.ref = 'cbid:' || b.id || ':rel' where b.round_id = $R")
[ "$HOLD" = 1 ] && [ "$FEE" = 1 ] && [ "$REL" = 2 ] && echo " ok: 6 паралелни затваряния → 1 концесионер, 1 такса, всяка оферта освободена веднъж" || { echo "FAIL hold=$HOLD fee=$FEE rel=$REL"; exit 1; }
[ "$(q "select sum(held) from online.companies where world_id = $W")" = 0 ] && [ "$(q "select t.balanced()")" = t ] && echo " ok: блокирани 0 €, журнал = наличност" || { echo "FAIL ledger"; exit 1; }
echo " CONCESSIONS RACE: ALL PASSED"
