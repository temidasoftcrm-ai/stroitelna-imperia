#!/bin/bash
# Търг: рестарт на базата по време на наддаването и паралелно затваряне от няколко връзки → един победител, депозити веднъж.
set -e
q() { psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222
W=$(q "select id from online.worlds where slug = 'tender-1'")
q "delete from online.rate" >/dev/null
T=$(q "select id from online.tenders tt where world_id = $W and tier = 'local' and status = 'open' and not exists (select 1 from online.bids b where b.tender_id = tt.id) order by id limit 1")
BU=$(q "select budget from online.tenders where id = $T")
for U in $A $B; do q "select t.as('$U'); select public.ol_bid(gen_random_uuid(), $W, $T, ($BU * 0.9)::bigint) ->> 'ok'" | tail -1 | grep -q true || { echo "FAIL bid"; exit 1; }; done
echo " ok: две оферти подадени"
if [ -n "$PGDATA_DIR" ]; then /usr/lib/postgresql/16/bin/pg_ctl -D "$PGDATA_DIR" restart -m fast -w >/dev/null; echo " ok: базата е рестартирана по време на търга"; fi
N=$(q "select count(*) from online.bids where tender_id = $T and status = 'active'"); HELD=$(q "select sum(held) from online.companies where world_id = $W")
[ "$N" = 2 ] && [ "$HELD" -gt 0 ] && echo " ok: офертите и блокираните депозити са запазени след рестарта" || { echo "FAIL after restart"; exit 1; }
q "update online.worlds set shift_s = shift_s + 600 * 4 where id = $W" >/dev/null
for i in 1 2 3 4 5 6; do psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select online.resolve_tender($T)" >/dev/null 2>&1 & done
psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select online.tick()" >/dev/null 2>&1 &
wait
WON=$(q "select count(*) from online.bids where tender_id = $T and status = 'won'"); K=$(q "select count(*) from online.contracts where tender_id = $T")
REL=$(q "select count(*) from online.ledger l join online.bids b on l.ref = 'dep:' || b.id || ':rel' where b.tender_id = $T")
[ "$WON" = 1 ] && [ "$K" = 1 ] && [ "$REL" = 1 ] && echo " ok: 7 паралелни затваряния → 1 победител, 1 договор, 1 освободен депозит" || { echo "FAIL won=$WON k=$K rel=$REL"; exit 1; }
[ "$(q "select t.balanced()")" = t ] && echo " ok: журнал = наличност" || { echo "FAIL ledger"; exit 1; }
echo " TENDER RACE/RESTART: ALL PASSED"
