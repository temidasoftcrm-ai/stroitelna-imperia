#!/bin/bash
# Дялове: двама купувачи едновременно за последните 5% → продават се най-много 5%; никой не плаща без дял.
set -e
q() { psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222; V=33333333-3333-3333-3333-333333333333
W=$(q "select id from online.worlds where slug = 'fin-1'")
q "delete from online.rate; select t.fund(id, 100000000) from online.companies where world_id = $W" >/dev/null
FAIR=$(q "select t.as('$A'); select public.ol_finance($W) ->> 'fair_pct'" | tail -1)
q "select t.as('$A'); select public.ol_share_offer(gen_random_uuid(), $W, 5, $FAIR)" >/dev/null
SO=$(q "select id from online.share_offers where world_id = $W and status = 'open'")
for i in 1 2 3; do for U in $B $V; do psql -h "$H" -p "$PORT" -U postgres -d "$DB" -q -t -A -c "select t.as('$U'); select public.ol_buy_shares(gen_random_uuid(), $W, $SO, 5)" >/dev/null 2>&1 & done; done; wait
SOLD=$(q "select coalesce(sum(pct), 0) from online.holdings h join online.companies c on c.id = h.issuer where c.world_id = $W")
[ "$SOLD" = 5 ] && echo " ok: 6 едновременни покупки на последните 5% → продадени точно 5%" || { echo "FAIL sold=$SOLD"; exit 1; }
[ "$(q "select t.balanced()")" = t ] && echo " ok: журнал = наличност" || { echo "FAIL ledger"; exit 1; }
echo " SHARES RACE: ALL PASSED"
