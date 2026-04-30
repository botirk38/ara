# Testing ara API Routes

## Overview
ara is a Next.js 14 App Router application with Drizzle ORM + Neon Postgres. API routes are serverless functions deployed to Vercel.

## Devin Secrets Needed
- `VERCEL_TOKEN` — Vercel CLI token for deployment management and log access
- Database credentials are pulled automatically via `vercel link`

## Local Dev Setup
```bash
bun install
vercel link --yes --project ara --token="$VERCEL_TOKEN"  # pulls .env.local with DATABASE_URL
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

## Key API Routes
| Route | Method | Content-Type | Purpose |
|---|---|---|---|
| `/api/invoices` | GET | — | List all invoices |
| `/api/invoices/[id]/recover` | POST | — | Trigger recovery flow (SSE stream) |
| `/api/invoices/[id]/reset-demo` | POST | — | Reset invoice to demo state |
| `/api/chat` | POST | application/json | AI chat with tool calling (requires OPENAI_API_KEY) |
| `/api/email` | POST | application/json | Send email (mock or Resend) |
| `/api/specter/enrich` | POST | application/json | Debtor risk enrichment |
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
  - When validating complex SDK types (like AI SDK's `UIMessage`), validate the structural shape and cast after: `parsed.data.messages as unknown as UIMessage[]`
- The app uses Neon serverless Postgres — DATABASE_URL comes from Vercel env vars
- `/api/chat` requires `OPENAI_API_KEY` for the LLM call, but error handling validation fires before the LLM call — so you can test validation without the key
