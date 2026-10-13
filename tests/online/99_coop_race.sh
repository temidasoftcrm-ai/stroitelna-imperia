#!/bin/bash
# Партньорство: 8 едновременни получавания на една пратка → получава се точно веднъж; 6 повторения на една заявка → 1 пратка.
set -e
q() { psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222
q "delete from coop.pairs" >/dev/null
CODE=$(q "select t.as('$A'); select public.coop_create() ->> 'code'" | tail -1)
q "select t.as('$B'); select public.coop_join('$CODE')" >/dev/null
RQ=$(q "select gen_random_uuid()")
for i in 1 2 3 4 5 6; do psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$A'); select public.coop_send('$RQ', 'gift', '{\"amount\": 500}')" >/dev/null 2>&1 & done; wait
N=$(q "select count(*) from coop.parcels where req = '$RQ'")
[ "$N" = 1 ] && echo " ok: 6 едновременни повторения на една заявка → 1 пратка" || { echo "FAIL sends=$N"; exit 1; }
ID=$(q "select id from coop.parcels where req = '$RQ'")
OUT=$(for i in 1 2 3 4 5 6 7 8; do psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$B'); select public.coop_claim($ID) ->> 'ok'" 2>/dev/null & done; wait)
OK=$(echo "$OUT" | grep -c '^true$' || true)
[ "$OK" = 1 ] && echo " ok: 8 едновременни получавания → пратката е дадена точно веднъж" || { echo "FAIL claims=$OK"; exit 1; }
echo " COOP RACE: ALL PASSED"
