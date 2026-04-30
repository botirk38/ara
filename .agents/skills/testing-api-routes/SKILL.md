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
To get runtime/function logs (not build logs):
```bash
curl -s -N -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v1/projects/{projectId}/deployments/{deploymentId}/runtime-logs?teamId={teamId}"
```
- This is a streaming endpoint — it returns live logs as NDJSON
- To capture logs: start streaming in background, trigger requests, then read output
- Build logs use a different endpoint: `GET /v3/deployments/{idOrUrl}/events`

## API Route Testing Strategy
1. **Baseline on production** — confirm the bug exists by hitting the production URL
2. **Fix on local** — checkout the fix branch, run `bun run dev`, test against localhost
3. **Test patterns:**
   - Empty body (no Content-Type): catches unguarded `req.json()` calls
   - Empty JSON `{}`: catches missing field validation
   - Invalid field values: catches type/format validation
   - Valid input: regression test to ensure the endpoint still works
4. Use `curl -s -X POST -w "\nHTTP:%{http_code}"` to capture both body and status code

## Key API Routes
| Route | Method | Content-Type | Purpose |
|---|---|---|---|
| `/api/invoices` | GET | — | List all invoices |
| `/api/invoices/[id]/recover` | POST | — | Trigger recovery flow (SSE stream) |
| `/api/invoices/[id]/reset-demo` | POST | — | Reset invoice to demo state |
| `/api/email` | POST | application/json | Send email (mock or Resend) |
| `/api/specter/enrich` | POST | application/json | Debtor risk enrichment |
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
- Zod is already a dependency (`zod@^4.4.1`) — use it for request validation
- The app uses Neon serverless Postgres — DATABASE_URL comes from Vercel env vars
