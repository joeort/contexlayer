# Context Layer — CLAUDE.md

## What This Is

Context Layer is a multi-tenant SaaS middleware product. It connects to GTM systems (Salesforce, HubSpot, Gong, Snowflake, etc.), auto-discovers their schema, reverse-engineers metric definitions from existing reports, and serves precise organizational context to AI tools via MCP (Model Context Protocol). Business users never interact with it — it runs silently behind their AI tools.

## Monorepo Structure

```
apps/
  api/       Fastify 5 API server — REST endpoints + MCP server (port 3001)
  workers/   BullMQ worker processes — schema crawl, report analysis, embeddings
  web/       Next.js 15 admin UI — for implementation teams only (port 3000)

packages/
  shared/    TypeScript types shared across all apps
  database/  DB client (pg), repositories, SQL migrations
```

## Local Dev

```bash
# 1. Start infrastructure
bash infrastructure/docker/docker-compose.dev.sh

# 2. Install deps
pnpm install

# 3. Copy + fill env files
cp apps/api/.env.example apps/api/.env
cp apps/workers/.env.example apps/workers/.env
cp apps/web/.env.example apps/web/.env

# 4. Run migrations
pnpm db:migrate

# 5. Start all apps
pnpm dev
```

Services:
- Admin UI: http://localhost:3000
- API: http://localhost:3001
- MCP endpoint: http://localhost:3001/mcp/v1
- Health check: http://localhost:3001/health

## Key Design Decisions

### The "10 ARR Fields" Problem
Fields are clustered by semantic embedding similarity (cosine > 0.82). Report usage analysis then disambiguates which field is used for which purpose. Admins confirm and mark one field per concept as `is_preferred = true` in `field_annotations`. `FieldRepo.findPreferred()` returns the canonical field at query time.

### Temporal Metric Definitions
`metric_versions` has `effective_from`/`effective_to` dates. Always use `MetricRepo.getVersionAt(metric_id, date)` — never query metrics without a date. For period-spanning queries, `getVersionsInRange` returns all active versions and `SqlGenerator` produces a UNION query with per-period filters.

### MCP Authentication
API key format: `cl_org_{orgId}_{secret}`. Keys are resolved to org in the MCP route handler. Always hash keys before storing — never store plain.

### Connector Credentials
Credentials are stored encrypted in `connectors.credentials` JSONB. The encryption key is `CREDENTIAL_ENCRYPTION_KEY` env var. Use `ConnectorRepo.setCredentials()` and `getCredentials()` — never access the column directly.

### Report Analysis Pipeline
`ReportRepo.listPendingByPriority()` returns reports sorted by name signal (ARR, Booking, Pipeline first). The `report-analyze` worker calls Claude (claude-sonnet-4-6) to extract metric definitions. Confidence < 0.7 flags for manual review; > 0.9 auto-drafts.

## Tech Stack

| Component | Choice |
|---|---|
| API | Fastify 5 + TypeScript |
| Workers | BullMQ on Redis |
| Database | PostgreSQL 16 + pgvector (Supabase) |
| Admin UI | Next.js 15 (App Router) |
| Auth | Clerk (multi-tenant) |
| LLM | Anthropic SDK — claude-sonnet-4-6 |
| Hosting | Railway → AWS ECS |

## Phase Status

- [x] Phase 0: Monorepo foundation (complete)
- [x] Phase 1 MVP: Salesforce → MCP (complete)
  - Weeks 3-4: Salesforce OAuth + schema crawl
  - Weeks 5-6: Report analyzer + dictionary bootstrap
  - Weeks 7-8: Context engine + MCP server + admin test console
- [ ] Phase 2: HubSpot, Gong, Snowflake + multi-connector SQL generation (in progress)
  - HubSpot: OAuth, property schema crawl
  - Snowflake: credential form, INFORMATION_SCHEMA crawl
  - Gong: API key, call/transcript schema
- [ ] Phase 3: Commercial polish, SOC 2, billing
