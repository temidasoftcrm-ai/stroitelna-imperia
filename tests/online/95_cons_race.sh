#!/bin/bash
# Консорциум: двама едновременно влизат за последните дялове → сборът никога не минава 100%.
set -e
q() { psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222; V=33333333-3333-3333-3333-333333333333
W=$(q "select id from online.worlds where slug = 'cons-1'")
q "delete from online.rate; update online.companies set xp = 1000000 where world_id = $W" >/dev/null
K=$(q "select t.as('$A'); select public.ol_cons_found(gen_random_uuid(), $W, 'capecairo', 60, true) ->> 'cons'" | tail -1)
for U in $B $V $B $V; do psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$U'); select public.ol_cons_join(gen_random_uuid(), $W, $K, 40)" >/dev/null 2>&1 & done; wait
SUM=$(q "select sum(pct) from online.cmembers where consortium_id = $K"); N=$(q "select count(*) from online.cmembers where consortium_id = $K"); ST=$(q "select status from online.consortia where id = $K")
[ "$SUM" = 100 ] && [ "$N" = 2 ] && [ "$ST" = building ] && echo " ok: 4 едновременни опита за последните 40% → точно 1 влиза, 100%, строежът тръгва" || { echo "FAIL sum=$SUM n=$N st=$ST"; exit 1; }
[ "$(q "select t.balanced()")" = t ] && echo " ok: журнал = наличност (никой не е платил без да влезе)" || { echo "FAIL ledger"; exit 1; }
echo " CONSORTIA RACE: ALL PASSED"
