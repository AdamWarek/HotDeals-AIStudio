# Personal Deal Aggregator

A personal-use web app that scrapes, stores, and browses promotional deals from selected fashion and beauty retailers.

## Setup

1. Install dependencies:
   - `npm install`
2. Copy env template and fill required variables:
   - create `.env` based on `.env.example`
3. Run app in development:
   - `npm run dev`

## Supabase Visit Counters (Global, Edge-Only)

This project tracks global daily and total visits and displays them in the promo banner under the "Odświeżone ..." text.

### 1) Create Supabase project

- Create a new Supabase project in the dashboard.
- Copy:
  - `Project URL` -> `SUPABASE_URL`
  - `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY`

### 2) Configure environment variables

In `.env` set for local server/runtime:

- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in any `VITE_*` variable.

### 3) Run SQL migration

Run SQL from:

- `supabase/migrations/20260330_visit_counters.sql`

This migration:

- creates `visits_daily` and `visits_total`,
- enables RLS on both tables,
- revokes direct write access for `anon`/`authenticated`,
- creates `track_visit()` (`SECURITY DEFINER`) used by Edge Function.

Run additional hardening SQL:

- `supabase/migrations/20260331_visit_rate_limit.sql`

This migration:

- creates `visit_rate_limits`,
- adds `consume_visit_rate_limit(...)` (`SECURITY DEFINER`) for per-IP throttling.

### 4) Deploy Edge Function (`track-visit`)

Create/deploy function from:

- `supabase/functions/track-visit/index.ts`

Recommended function settings:

- `verify_jwt = false` (public counter endpoint)
- set function secrets:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ALLOWED_ORIGINS` (comma-separated, e.g. `https://adamwarek.github.io,http://localhost:3000`)
  - `VISITS_RATE_LIMIT_MAX_REQUESTS` (optional)
  - `VISITS_RATE_LIMIT_WINDOW_SECONDS` (optional)

### 5) Configure frontend endpoint

In `.env` (and production frontend env) set:

- `VITE_VISITS_EDGE_ENDPOINT=https://<project-ref>.functions.supabase.co/track-visit`

### 6) Verify endpoint

Call:

- `POST https://<project-ref>.functions.supabase.co/track-visit`

Expected response:

- `{ "dailyVisits": <int>, "totalVisits": <int> }`

## Security Checklist Before Deploy

- `SUPABASE_SERVICE_ROLE_KEY` exists only in Edge Function secrets.
- RLS enabled on `visits_daily` and `visits_total`.
- `anon` and `authenticated` cannot `insert/update/delete` visit tables directly.
- `VITE_VISITS_EDGE_ENDPOINT` points to deployed function URL.
- Edge Function CORS allowlist includes GitHub Pages domain and localhost dev.
- Function requires valid `Origin` header and rejects unknown origins.
- Function enforces per-IP+Origin rate limit in database.
- Function responses do not include stack traces or secrets.
