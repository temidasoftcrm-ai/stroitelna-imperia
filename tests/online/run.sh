#!/bin/bash
# Пуска онлайн тестовете в чиста временна база: bash tests/online/run.sh <host-dir> <port>
set -e
H=${1:?socket dir}; PORT=${2:-55432}; DB=ol_test_$$
cd "$(dirname "$0")/../.."
psql -h "$H" -p "$PORT" -U postgres -q -c "create database $DB"
trap 'psql -h "$H" -p "$PORT" -U postgres -q -c "drop database $DB" >/dev/null' EXIT
psql -h "$H" -p "$PORT" -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f tests/online/00_stub_supabase.sql $(ls supabase/migrations/*.sql | sed 's/^/-f /') -f tests/online/01_helpers.sql >/dev/null
for f in tests/online/[1-9]*_*.sql; do
  echo "── $f"
  out=$(psql -h "$H" -p "$PORT" -U postgres -d $DB -q -v ON_ERROR_STOP=1 -t -f "$f" 2>&1) || { echo "$out" | grep -v '^ ok:' | grep -v '^\s*$'; exit 1; }
  echo "  $(echo "$out" | grep -c '^ ok:') проверки ✓  $(echo "$out" | grep -o 'STAGE.*PASSED')"
done
for f in tests/online/[1-9]*_*.sh; do
  echo "── $f"; H="$H" PORT="$PORT" DB=$DB PGDATA_DIR="$PGDATA_DIR" bash "$f" || exit 1
done
