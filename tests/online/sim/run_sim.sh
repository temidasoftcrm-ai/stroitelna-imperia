#!/bin/bash
# Симулация на баланса: bash tests/online/sim/run_sim.sh <socket-dir> [дни=90] [порт=55432]
# Създава временна база, прилага миграциите, пуска ботовете ден по ден и печата обобщение.
set -e
H=${1:?socket dir}; DAYS=${2:-90}; PORT=${3:-55432}; DB=ol_sim_$$
cd "$(dirname "$0")/../../.."
q() { psql -h "$H" -p "$PORT" -U postgres -d $DB -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
psql -h "$H" -p "$PORT" -U postgres -q -c "create database $DB"
trap 'psql -h "$H" -p "$PORT" -U postgres -q -c "drop database $DB" >/dev/null' EXIT
psql -h "$H" -p "$PORT" -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f tests/online/00_stub_supabase.sql $(ls supabase/migrations/*.sql | sed 's/^/-f /') -f tests/online/01_helpers.sql -f tests/online/sim/balance_sim.sql >/dev/null 2>&1
BOTS="builder tender producer investor late"
i=0; for b in $BOTS; do i=$((i+1)); q "insert into auth.users values ('00000000-0000-0000-0000-00000000000$i', '$b@sim')" >/dev/null; done
W=$(q "insert into online.worlds (slug, name, private, test, day_seconds) values ('sim', 'Симулация', false, true, 600) returning id")
mk() { q "select t.call('00000000-0000-0000-0000-00000000000$1', 'ol_create_company', format('%L, $W, %L, %L, %L', gen_random_uuid(), 'Бот $2', '$3', '$4'))" >/dev/null; }
mk 1 builder titan sofia; mk 2 tender atlas plovdiv; mk 3 producer industrial varna; mk 4 investor horizon burgas
for d in $(seq 1 $DAYS); do
  [ $d = 30 ] && mk 5 late imperial ruse
  i=0; for b in $BOTS; do i=$((i+1)); out=$(q "select t.bot($W, '00000000-0000-0000-0000-00000000000$i', '$b', $d)" 2>&1) || { [ $b = late ] && [ $d -lt 30 ] || echo "  (бот $b, ден $d: $(echo "$out" | grep -m1 ERROR))"; }; done
  q "update online.worlds set shift_s = shift_s + 600 where id = $W; select online.tick(); select online.tick()" >/dev/null
  i=0; for b in $BOTS; do i=$((i+1)); q "select t.snap($W, '00000000-0000-0000-0000-00000000000$i', '$b', $d)" >/dev/null; done
  [ $((d % 10)) = 0 ] && echo "  … ден $d"
done
echo; echo "═══ Ниво / стойност (хил. €) / печалба за 7 дни (хил. €) ═══"
q "select rpad('ден', 5) || string_agg(rpad(bot, 26), '' order by bot) from (select distinct bot from t.sim) b"
q "select rpad(day::text, 5) || string_agg(rpad(format('L%s %s / %s', level, round(value / 100000.0), round(profit7 / 100000.0)), 26), '' order by bot) from t.sim where day in (5, 10, 20, 30, 45, 60, 75, 90) or day = $DAYS group by day order by day"
echo; echo "═══ Ден, на който е достигнато ниво ═══"
q "select bot || ': ' || string_agg(format('L%s→д%s', level, d), ' ' order by level) from (select bot, level, min(day) d from t.sim group by bot, level) x group by bot order by bot"
echo; echo "═══ Икономиката на света ═══"
q "select format('търгове: %s възложени, %s без оферти; договори: %s изпълнени, %s провалени', (select count(*) from online.tenders where status = 'awarded'), (select count(*) from online.tenders where status = 'no_bids'), (select count(*) from online.contracts where status = 'done'), (select count(*) from online.contracts where status = 'failed'))"
q "select format('пазар: %s сделки за %s €; консорциуми: %s (работещи %s, разпаднати %s); концесии: %s възложени', (select count(*) from online.trades), (select coalesce(round(sum(qty * price) / 100), 0) from online.trades), (select count(*) from online.consortia), (select count(*) from online.consortia where status in ('operating', 'expired')), (select count(*) from online.consortia where status = 'dissolved'), (select count(*) from online.conc_rounds where status in ('active', 'ended')))"
echo; echo "═══ Пари по причина за целия период (хил. €) ═══"
q "select rpad(reason, 16) || string_agg(lpad(round(s / 100000.0)::text, 10), '' order by bot) from (select l.reason, replace(c.name, 'Бот ', '') bot, sum(l.amount) s from online.ledger l join online.companies c on c.id = l.company_id group by 1, 2) x group by reason order by reason"
q "select rpad('', 16) || string_agg(lpad(replace(name, 'Бот ', ''), 10), '' order by replace(name, 'Бот ', '')) from online.companies"
echo; [ "$(q "select t.balanced()")" = t ] && echo "журнал = наличност ✓" || echo "ЖУРНАЛЪТ НЕ СЪВПАДА ✗"
