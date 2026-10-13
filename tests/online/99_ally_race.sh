#!/bin/bash
# Пари между съюзници: 8 едновременни подаръка над тавана → минава точно 1; насрещни подаръци едновременно → без блокиране, журналът е верен.
set -e
q() { psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222
W=$(q "select id from online.worlds where slug = 'am-1'")
CA=$(q "select id from online.companies where world_id = $W and name = 'П-А'"); CB=$(q "select id from online.companies where world_id = $W and name = 'П-Б'")
q "delete from online.rate; delete from online.ally_transfers where world_id = $W; select t.fund(id, 100000000) from online.companies where world_id = $W" >/dev/null
q "insert into online.alliances (a, b, status, requested_by, since) values (least($CA, $CB), greatest($CA, $CB), 'active', $CA, now() - interval '1 hour') on conflict (a, b) do update set status = 'active', since = excluded.since" >/dev/null
CAP=$(q "select t.as('$A'); select public.ol_ally_money($W) ->> 'cap_left'" | tail -1)
AMT=$(( CAP * 6 / 10 / 100 * 100 ))
for i in 1 2 3 4 5 6 7 8; do psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$A'); select public.ol_ally_gift(gen_random_uuid(), $W, $CB, $AMT)" >/dev/null 2>&1 & done; wait
N=$(q "select count(*) from online.ally_transfers where world_id = $W and from_c = $CA")
[ "$N" = 1 ] && echo " ok: 8 едновременни подаръка по 60% от тавана → минава точно 1" || { echo "FAIL gifts=$N"; exit 1; }
q "delete from online.rate" >/dev/null
for i in 1 2 3 4 5 6; do
  psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$B'); select public.ol_ally_gift(gen_random_uuid(), $W, $CA, 100000)" >/dev/null 2>&1 &
  psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$A'); select public.ol_ally_gift(gen_random_uuid(), $W, $CB, 100000)" >/dev/null 2>&1 &
done; wait
N=$(q "select count(*) from online.ally_transfers where world_id = $W")
L=$(q "select count(*) from online.ledger l join online.ally_transfers t on l.ref = 'gift:' || t.id where t.world_id = $W")
[ "$L" = $(( N * 2 )) ] && echo " ok: насрещни подаръци ($((N - 1)) минаха) — всеки записан точно по веднъж и при двете страни" || { echo "FAIL n=$N ledger=$L"; exit 1; }
[ "$(q "select t.balanced()")" = t ] && echo " ok: журнал = наличност" || { echo "FAIL ledger"; exit 1; }
echo " ALLY MONEY RACE: ALL PASSED"
