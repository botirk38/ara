# Testing ara API Routes

## Overview
ara is a Next.js 14 App Router application with Drizzle ORM + Neon Postgres. API routes are serverless functions deployed to Vercel.

## Devin Secrets Needed
- `VERCEL_TOKEN` — Vercel CLI token for deployment management and log access
- `SPECTER_API_KEY` — Specter API key for company risk enrichment (header: `X-API-KEY`)
- Database credentials are pulled automatically via `vercel link`

## Local Dev Setup
```bash
bun install
vercel link --yes --project ara --token="$VERCEL_TOKEN"  # pulls .env.local with DATABASE_URL
# Add SPECTER_API_KEY to .env.local if not present
bun run dev  # starts at http://localhost:3000
```

## Vercel Preview Deployments
- Preview deployments may have SSO protection (`ssoProtection.deploymentType: 'all_except_custom_domains'`)
- If preview URLs return 401, test locally instead by checking out the PR branch and running `bun run dev`
- Production URL (custom domain or `.vercel.app` alias) is typically accessible without SSO

## Vercel Runtime Logs
The Vercel CLI is the most reliable way to fetch runtime logs:
```bash
# Fetch error-level logs from the last 7 days
vercel logs --token="$VERCEL_TOKEN" --json --level=error --since=7d --limit=100 --no-follow --no-branch

# Filter by status code
vercel logs --token="$VERCEL_TOKEN" --json --since=7d --status-code=5xx --no-follow --no-branch

# Parse unique errors with a quick Python script
vercel logs --token="$VERCEL_TOKEN" --json --level=error --since=7d --limit=100 --no-follow --no-branch | python3 -c "
import json, sys
errors = {}
for line in sys.stdin:
    line = line.strip()
    if not line or not line.startswith('{'):
        continue
    try:
        entry = json.loads(line)
        path = entry.get('requestPath', 'unknown')
        msg = entry.get('message', '')[:80]
        key = (path, msg[:50])
        if key not in errors:
            errors[key] = {'path': path, 'message': msg, 'status': entry.get('responseStatusCode'), 'count': 0}
        errors[key]['count'] += 1
    except:
        pass
for k, v in errors.items():
    print(f\"{v['count']}x {v['status']} {v['path']}: {v['message']}\")
"
```

The REST API streaming endpoint (`/v1/projects/{projectId}/deployments/{deploymentId}/runtime-logs`) might return empty for deployments with no recent traffic. The CLI `vercel logs` command is more reliable.

Build logs use: `GET /v3/deployments/{idOrUrl}/events`

## Vercel Project IDs
- Project ID: `prj_23hgyqlp3Gi52lolu44yUyRWXEe6`
- Team ID: `team_HkkAXLjThsejtjfdKMzzvru8`
- Team slug: `nordlys-labs`

## API Route Testing Strategy
1. **Baseline on production** — confirm the bug exists by hitting the production URL
2. **Fix on local** — checkout the fix branch, run `bun run dev`, test against localhost
3. **Test patterns:**
   - Empty body (no Content-Type): catches unguarded `req.json()` calls
   - Empty JSON `{}`: catches missing field validation
   - Invalid field values: catches type/format validation
   - Form-encoded with bad Content-Type: catches unguarded `req.formData()` calls
   - Valid input: regression test to ensure the endpoint still works
4. Use `curl -s -X POST -w "\nHTTP:%{http_code}"` to capture both body and status code
5. **Multi-branch testing**: When testing fixes across multiple PRs, create a temp branch and merge all fix branches into it before starting the dev server

## Specter API Integration Testing

The Specter enrichment (`/api/specter/enrich`) calls the real Specter API at `https://app.tryspecter.com/api/v1`.

### Key endpoints used:
- `POST /companies` with `{"domain": "<domain>"}` — enrichment by domain (auth: `X-API-KEY` header)
- `GET /companies/search?query=<name>` — fallback search by company name

### Testing the real API path vs fallback:
- **Real API path**: Insert a test customer with a real company domain (e.g. `test@google.com`), then call `/api/specter/enrich`. Response should contain API-derived data (e.g. `organization_rank`, `employee_count`).
- **Fallback path**: Use seeded fictional customers (e.g. `cust-001` with domain `northwindstudios.co.uk`). Spectre API returns empty, code falls back to pre-seeded DB enrichment data.
- **Missing API key**: Remove `SPECTER_API_KEY` from `.env.local` and restart dev server. The `specterFetch` function throws, but `fetchFromSpecter` catches it and returns `null`, triggering the DB cache fallback.

### Risk signal derivation:
- `organization_rank <= 5000` → `low`
- `organization_rank <= 50000` → `medium`
- `organization_rank > 50000` → `high`
- No rank → `medium` (default)

### Inserting test customers via direct DB access:
```bash
export $(grep -v '^#' .env.local | xargs)
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
async function main() {
  await sql\`INSERT INTO customers (id, name, email, phone, relationship, avg_days_late, created_at)
    VALUES ('cust-test', 'Test Co', 'test@example.com', '+441234567890', 'good', 10, NOW()::text)
    ON CONFLICT (id) DO NOTHING\`;
  console.log('Inserted');
}
main().catch(e => { console.error(e); process.exit(1); });
"
```

Remember to clean up test data after testing:
```bash
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
async function main() {
  await sql\`DELETE FROM specter_enrichments WHERE customer_id = 'cust-test'\`;
  await sql\`DELETE FROM customers WHERE id = 'cust-test'\`;
  console.log('Cleaned up');
}
main().catch(e => { console.error(e); process.exit(1); });
"
```

## Key API Routes
| Route | Method | Content-Type | Purpose |
|---|---|---|---|
| `/api/invoices` | GET | — | List all invoices |
| `/api/invoices/[id]/recover` | POST | — | Trigger recovery flow (SSE stream) |
| `/api/invoices/[id]/reset-demo` | POST | — | Reset invoice to demo state |
| `/api/chat` | POST | application/json | AI chat with tool calling (requires OPENAI_API_KEY) |
| `/api/email` | POST | application/json | Send email (mock or Resend) |
| `/api/specter/enrich` | POST | application/json | Debtor risk enrichment (requires SPECTER_API_KEY) |
| `/api/slack/interactions` | POST | application/x-www-form-urlencoded | Slack interactive webhook |
| `/api/twilio/voice` | POST | — | TwiML voice response |
| `/api/twilio/gather` | POST | form-data | Twilio speech result webhook |

## Build & Lint
```bash
bun run build   # Next.js production build
bun run lint    # ESLint
```
Both must pass before creating PRs.

## Common Pitfalls
- `req.json()` in Next.js API routes throws `SyntaxError` on empty/malformed bodies — always wrap in try/catch
- `req.formData()` throws `TypeError` if Content-Type isn't `multipart/form-data` or `application/x-www-form-urlencoded` — check Content-Type header first
- `JSON.parse()` on user-supplied strings (e.g. Slack payloads) can throw — always wrap in try/catch
- Zod is already a dependency (`zod@^4.4.1`) — use it for request validation
  - **Zod v4 note**: `z.record()` requires 2 args: `z.record(z.string(), z.unknown())`, not `z.record(z.unknown())`
  - When validating complex schemas, prefer `.safeParse()` over `.parse()` to avoid unhandled exceptions
- Next.js `.env.local` is auto-loaded by the dev server — to test without a specific env var, you must remove it from the file and restart (not just unset it in the shell)
- When running direct DB queries outside Next.js (e.g. via `node -e`), use `export $(grep -v '^#' .env.local | xargs)` to load env vars into the shell first
