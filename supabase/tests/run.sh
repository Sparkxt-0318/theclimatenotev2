#!/usr/bin/env bash
# Applies every migration to a throwaway database and runs the RLS tests.
set -euo pipefail
export PATH=/usr/lib/postgresql/16/bin:$PATH
HOST=${PGHOST_DIR:-/var/tmp}; PORT=${PGPORT:-55432}
PSQL="psql -h $HOST -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "drop database if exists climatenote_test;" -c "create database climatenote_test;" >/dev/null
$PSQL -d climatenote_test -f supabase/tests/00_supabase_shim.sql
for f in supabase/migrations/*.sql; do $PSQL -d climatenote_test -f "$f"; done
psql -h $HOST -p $PORT -U postgres -d climatenote_test -v ON_ERROR_STOP=1 -f supabase/tests/01_rls_test.sql
