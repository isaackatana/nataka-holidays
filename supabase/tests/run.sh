#!/usr/bin/env bash
# Rebuilds a scratch database, applies every migration in order, then runs the
# security / business-rule tests against it. Safe: it only touches the database
# named below (default nataka_test) on a LOCAL PostgreSQL, never your live Supabase.
#
#   bash supabase/tests/run.sh
#
# Needs: PostgreSQL 15+ running locally, `psql` on your PATH, python3, and a
# database user allowed to create databases and roles (e.g. PGUSER=postgres).
set -euo pipefail
cd "$(dirname "$0")"
export TEST_DB="${TEST_DB:-nataka_test}"

psql -q -d postgres -c "drop database if exists ${TEST_DB}" -c "create database ${TEST_DB}"
psql -q -v ON_ERROR_STOP=1 -d "${TEST_DB}" -f supabase_shim.sql
for f in ../migrations/*.sql; do
  echo "applying $(basename "$f")"
  psql -q -v ON_ERROR_STOP=1 -d "${TEST_DB}" -f "$f"
done
python3 security_test.py
