# Supabase Security Advisors

## Overview

Supabase provides automated security and performance advisors that scan your
project for misconfigurations. Running them periodically helps catch issues
like missing RLS policies, overly permissive storage buckets, and unsafe JWT
settings.

## Prerequisites

The MCP token used to invoke Supabase tools must have **owner** permissions
on the project. Publishable (anon) or authenticated keys cannot run advisors.
Use the service_role key or a Supabase access token with owner scope.

## How to Run

### Via MCP (programmatic)

```js
// Security advisors
await supabase.get_advisors({ type: "security" });

// Performance advisors
await supabase.get_advisors({ type: "performance" });
```

### Via Supabase Dashboard (manual)

1. Go to https://supabase.com/dashboard/project/[project-ref]
2. Navigate to **Database** → **Security Advisor** (for RLS, RCE, extensions)
3. Navigate to **Database** → **Performance Advisor** (for index suggestions, query optimization)
4. Review each finding and follow the linked remediation guide

## What to Check

### RLS (Row Level Security)

Every public table must have RLS enabled and at least one policy. The advisor
flags tables where:

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` was never run
- No SELECT/INSERT/UPDATE/DELETE policy exists for any role
- Policies use `USING (true)` on production (allows everyone everything)

**Production rule**: zero tables with missing RLS. Every policy must be
scoped to the appropriate role (`authenticated`, `service_role`, etc.).

### Storage Buckets

Each bucket's access policies are reviewed:

- `fotos-clientes`: authenticated upload, public read
- `logos`: admin-only write, public read
- No bucket should allow anon/unauthorized writes

### JWT / Auth

- `anon` key should never have write access on production tables
- JWT expiry must be reasonable (≤ 1 week for regular sessions)
- MFA policies should be enforced for admin accounts

### Extensions

- Unused extensions should be dropped (attack surface reduction)
- `pg_graphql`, `pg_net`, and `pg_cron` need explicit review if enabled

## Remediation Workflow

1. Run `get_advisors({ type: "security" })` and `get_advisors({ type: "performance" })`
2. For each finding, the advisor returns a `remediation_url` — open it for step-by-step fix instructions
3. Apply fixes via migration (`supabase_apply_migration` or `supabase_execute_sql`)
4. Re-run advisors to confirm resolution
5. Critical findings (RLS missing on tables with sensitive data, public write access) must be resolved before deployment

## Scheduled Cadence

| Check | Frequency |
|-------|-----------|
| Security advisor | Every deploy + monthly |
| Performance advisor | After schema changes + quarterly |
| RLS audit | Every deploy (CI gate) |
