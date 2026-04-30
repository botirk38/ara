# ARRA — Briefcase Collect

> **Most tools show you who owes you money. ARRA gets them to pay.**

ARRA (Autonomous Revenue Recovery Agent) is a Briefcase-native money movement agent that recovers overdue invoices by calling, emailing, negotiating, sending payment links, and logging the outcome — with autonomy thresholds and safety guardrails.

## Quick Start

```bash
bun install
bun run db:setup    # Run migrations and seed demo data
bun run dev         # Start development server at http://localhost:3000
```

## Architecture

Single Next.js 14 App Router application with:

- **Drizzle ORM + Neon PostgreSQL** — 7 tables (customers, invoices, recovery_actions, autonomy_decisions, timeline_events, specter_enrichments, payment_links)
- **Vercel AI SDK + OpenAI** — LLM-powered recovery action drafting (phone scripts, emails)
- **SSE Streaming** — Real-time timeline updates during recovery
- **Twilio** — Outbound voice calls
- **Resend** — Email delivery
- **Specter** — Debtor risk intelligence enrichment

## Recovery Flow

```
User clicks "Recover"
  → Briefcase context loaded
  → Specter enriches debtor risk
  → Autonomy Gate (deterministic safety checks)
  → If blocked → escalate to human review
  → LLM drafts phone/email action
  → Execute via Twilio/Resend
  → Payment link generated
  → Confirmation email sent
  → Invoice status updated
  → Timeline logged
```

## Autonomy Gate

Deterministic (not LLM-driven) safety checks:
- Amount below £10k
- No dispute signal
- Under 90 days overdue
- Specter risk not high
- Customer relationship not risky

## Demo Data

5 seeded invoices covering different scenarios:

| Customer | Invoice | Amount | Days Overdue | Risk | Expected Outcome |
|---|---|---|---|---|---|
| Northwind Studios | INV-1023 | £4,200 | 32 | Medium | Phone → Promise to pay |
| Apex Legal Ltd | INV-1024 | £18,400 | 94 | High | **Blocked** → Human review |
| Bluefin Retail | INV-1025 | £2,100 | 12 | Low | Email → Sent |
| Camden Studio | INV-1026 | £950 | 5 | Low | Email → Friendly reminder |
| Albion Foods | INV-1027 | £5,050 | 48 | Medium | Phone → Payment plan |

## Environment Variables (Required)

```env
# Database (Neon PostgreSQL via Vercel integration)
DATABASE_URL=             # Pooled connection URL
DATABASE_URL_UNPOOLED=    # Direct connection URL

# LLM (required for recovery action drafting)
OPENAI_API_KEY=

# Voice calls (required for phone channel)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Email delivery (required for email channel)
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Deployment URL (required for webhooks and payment links)
NEXT_PUBLIC_BASE_URL=
```

All environment variables are required. The app will throw clear errors if any are missing.

## Scripts

```bash
bun run dev           # Development server
bun run build         # Production build
bun run lint          # ESLint
bun run db:generate   # Generate Drizzle migrations
bun run db:migrate    # Apply migrations
bun run db:seed       # Seed demo data
bun run db:setup      # Migrate + seed
```
