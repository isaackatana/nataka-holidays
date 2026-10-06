"""Tiny test harness: runs SQL as a Supabase-style role (anon / authenticated)
against a LOCAL scratch Postgres. See README.md in this folder."""
import subprocess, sys, json

import os
DB = os.environ.get('TEST_DB', 'nataka_test')
results = []

def sh(sql, role=None, sub=None):
    """Run SQL in one transaction as a Supabase-style role. Returns (ok, output)."""
    sql = sql.strip()
    if not sql.endswith(';'):
        sql += ';'
    pre = ''
    if role:
        pre += f"set local role {role};\n"
    if sub:
        pre += f"select set_config('request.jwt.claim.sub', '{sub}', true);\n"
    script = f"begin;\n{pre}{sql}\ncommit;\n"
    p = subprocess.run(['psql', '-d', DB, '-v', 'ON_ERROR_STOP=1', '-tA', '-q'],
                       input=script, capture_output=True, text=True)
    return p.returncode == 0, (p.stdout + p.stderr).strip()

def scalar(sql):
    ok, out = sh(sql)
    assert ok, out
    return out.split('\n')[-1].strip()

def expect_ok(name, sql, role=None, sub=None, contains=None):
    ok, out = sh(sql, role, sub)
    good = ok and (contains is None or contains in out)
    results.append((good, name, out if not good else ''))

def expect_fail(name, sql, role=None, sub=None, contains=None):
    ok, out = sh(sql, role, sub)
    good = (not ok) and (contains is None or contains.lower() in out.lower())
    results.append((good, name, out if not good else ''))

def check(name, cond, detail=''):
    results.append((bool(cond), name, '' if cond else detail))

def report():
    failed = [r for r in results if not r[0]]
    for good, name, detail in results:
        print(('PASS  ' if good else 'FAIL  ') + name + ('' if good else f'\n      -> {detail[:300]}'))
    print(f"\n{len(results)-len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)
