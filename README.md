# Personal Deal Aggregator

A personal-use web app that scrapes, stores, and browses promotional deals from selected fashion and beauty retailers.

## Setup

1. Install dependencies:
   - `npm install`
2. Copy env template and fill required variables:
   - create `.env` based on `.env.example`
3. Run app in development:
   - `npm run dev`

## Supabase Visit Counters (Global)

This project tracks global daily and total visits and displays them in the promo banner under the "Odświeżone ..." text.

### 1) Create Supabase project

- Create a new Supabase project in the dashboard.
- Copy:
  - `Project URL` -> `SUPABASE_URL`
  - `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY`

### 2) Configure environment variables

In `.env` set:

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
- creates `track_visit()` (`SECURITY DEFINER`) used by backend API.

### 4) Verify API

Run app, then call:

- `POST /api/visits/track`

Expected response:

- `{ "dailyVisits": <int>, "totalVisits": <int> }`

## Security Checklist Before Deploy

- `SUPABASE_SERVICE_ROLE_KEY` exists only on server-side env.
- RLS enabled on `visits_daily` and `visits_total`.
- `anon` and `authenticated` cannot `insert/update/delete` visit tables directly.
- `POST /api/visits/track` has strict rate limit and rejects unexpected payload body.
- API responses do not include stack traces or secrets.
