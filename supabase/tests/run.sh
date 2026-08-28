#!/usr/bin/env bash
#
# Applies every migration to a throwaway database and runs the RLS tests.
#
# Works against a locally started cluster (the default below) or any Postgres
# reachable through the standard PG* environment variables, which is how CI
# runs it against its service container.
set -euo pipefail

export PATH="/usr/lib/postgresql/16/bin:$PATH"

# Default to a local socket-based cluster; CI sets PGHOST/PGPORT/PGPASSWORD.
: "${PGHOST:=/var/tmp}"
: "${PGPORT:=55432}"
: "${PGUSER:=postgres}"
export PGHOST PGPORT PGUSER

TEST_DB="climatenote_test"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

echo "Using postgres at ${PGHOST}:${PGPORT} as ${PGUSER}"

"${PSQL[@]}" -d postgres -c "drop database if exists ${TEST_DB};" >/dev/null
"${PSQL[@]}" -d postgres -c "create database ${TEST_DB};" >/dev/null

# The shim recreates the parts of a Supabase project the migrations depend on
# (the auth and storage schemas, auth.uid(), the anon/authenticated roles).
# It is never applied to the hosted project, which already provides them.
"${PSQL[@]}" -d "$TEST_DB" -f supabase/tests/00_supabase_shim.sql

for migration in supabase/migrations/*.sql; do
  echo "  applying $(basename "$migration")"
  "${PSQL[@]}" -d "$TEST_DB" -f "$migration"
done

psql -v ON_ERROR_STOP=1 -d "$TEST_DB" -f supabase/tests/01_rls_test.sql
