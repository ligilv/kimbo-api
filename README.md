# Kimbo API

The backend for [Kimbo](https://github.com/ligilv/Kimbo-app), a chat-style calorie and protein tracker. It does three jobs:

1. **Understands meals.** Text ("2 chapati and dal") and/or a photo go in; structured food items with calories and macros come out, via Google Gemini.
2. **Backs up the user's data.** The phone is the main copy; it sends its profile and meals here in the background, stored in Postgres (Supabase).
3. **Writes Kimbo's take.** A short, personal insight from a 7- or 30-day summary.

The Gemini key lives only here, never in the app.

Built with NestJS 12 (ESM), Prisma 7 + PostgreSQL, zod for validation, `@google/genai`, and Vitest.

## Endpoints

Every request is JSON. Sync endpoints need an `x-device-id` header (8–64 chars of `A-Za-z0-9_-`): there are no accounts, so each install has a random id that keeps phones apart. It is not authentication.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/meals/parse` | `{ text?, image?: { base64, mimeType } }` → `{ items: [...], clarification: string \| null }`. If the meal is too vague, `items` is empty and `clarification` is one question to ask the user. |
| `POST` | `/insights` | A summary the app works out (averages, days on target, kcal per meal slot, top food names; no raw meal text) → `{ insight }`, two short sentences. |
| `PUT` | `/profile` | Create or replace this device's profile (onboarding answers). |
| `PUT` | `/meals/:id` | Create or replace one meal and its items. Last write wins by the app's `updatedAt`, so an offline queue replaying out of order can't overwrite newer data. |
| `DELETE` | `/meals/:id` | Delete one meal. Safe to repeat. |
| `GET` | `/meals?from=YYYY-MM-DD&to=YYYY-MM-DD` | This device's meals in a date range, in the same shape as `PUT`. |
| `DELETE` | `/me` | "Delete my data" in the app: removes the device; the database cascades to its profile, meals and items. Safe to repeat. |

Errors: `400` with a readable message for bad input, `429` when rate-limited, `502` when Gemini fails or returns something unusable.

## How it's put together

```
src/
  meals/       POST /meals/parse
    meals.controller.ts        HTTP only: validate body, call the service
    meals.service.ts           validates the model's JSON, retries once if it's malformed
    meal-analyzer.ts           MealAnalyzer interface (the "port")
    gemini-meal-analyzer.ts    the Gemini implementation: main model, then backup model
    meal-prompt.ts, meal.schema.ts
  insights/    POST /insights
    gemini-insight-writer.ts   InsightWriter interface + Gemini implementation
    insight.schema.ts
  sync/        profile + meals backup, DELETE /me
  database/    PrismaService (pooled connection)
  common/      x-device-id decorator, zod validation pipe
prisma/        schema + migrations
```

Each feature is its own Nest module. Controllers only handle HTTP; logic sits in services. The AI providers sit behind small interfaces (`MealAnalyzer`, `InsightWriter`) injected by token, so tests swap in a fake, and switching to another model provider means writing one class.

### Decisions worth knowing

- **Gemini with a fallback.** Main model `gemini-3.5-flash-lite`, backup `gemini-3.5-flash`, both set in `.env`. Each gets one short attempt with SDK retries off (6 s for text, 15 s for photos, 8 s for insights), so the app's own timeout is never hit while the SDK quietly retries for a minute. Lite is the main model because the free tier allows only 20 requests a day on `gemini-3.5-flash`; flash is the backup for when lite is busy (Google returns 503 "high demand" at peaks).
- **Never trust the model's output.** Gemini is asked for JSON matching a schema, and the service still validates it with zod. If it's malformed, the service tries once more, then returns a clean 502.
- **Facts, not numbers, for insights.** The insight endpoint turns the summary into plain sentences ("Protein target reached on 0 of 6 logged days") before asking Gemini, and the prompt forbids claiming a target was met unless the facts say so. Early versions misread raw numbers and praised a user who had missed protein every day.
- **Rate limits.** 20 requests a minute per IP for parsing and 10 for insights, so a demo can't burn the Gemini free tier. Sync allows 120, since it's frequent and costs no AI quota.
- **Photos.** Accepted as base64 JPEG/PNG up to about 3 MB. The JSON body limit is raised to 5 MB in `main.ts`. The app already shrinks photos to 1024 px before sending.
- **Dates are strings.** A meal's `date` is the user's local `YYYY-MM-DD`, stored as text, so a 1 a.m. snack in India never shifts to the previous day in UTC.
- **Database.** Supabase Postgres. The running server uses the pooled connection (port 6543, PgBouncer); migrations use the direct or session connection (port 5432). Row-level security is on. The API connects as the owner, and nothing else can read the tables.

## Running it

Needs Node ≥ 22 and a Postgres database (a free Supabase project works).

```sh
npm install                 # also generates the Prisma client
cp .env.example .env        # fill in the values below
npx prisma migrate deploy --config prisma7.config.ts
npm run start:dev           # http://localhost:3000, reloads on code changes (not on .env changes)
```

`.env`:

| Variable | |
|---|---|
| `DATABASE_URL` | Pooled connection string (Supabase: Connect → Transaction pooler, port 6543, add `?pgbouncer=true`) |
| `DIRECT_URL` | Direct or session connection (port 5432), for migrations |
| `GEMINI_API_KEY` | From Google AI Studio |
| `GEMINI_MODEL` | Optional, default `gemini-3.5-flash-lite` |
| `GEMINI_FALLBACK_MODEL` | Optional, default `gemini-3.5-flash` |
| `PORT` | Optional, default `3000` |

The server starts without a Gemini key. Only the AI endpoints fail, with a clear 502 explaining the key is missing.

Try it:

```sh
curl -X POST localhost:3000/meals/parse -H 'content-type: application/json' \
  -d '{"text":"2 chapati and a bowl of dal"}'
```

## Tests and checks

```sh
npm test        # Vitest: controllers via supertest, with Gemini and Prisma faked
npm run lint    # oxlint
npx tsc --noEmit
```

The tests cover input validation, retry on bad model output, the main → backup model fallback, last-write-wins sync, device scoping (one device can never touch another's meals), cascade delete and how insight facts are worded.

## Known limits

- **No accounts.** The device id keeps data apart, but anyone holding an id could read that device's data. Real sign-in (phone OTP or Google) is the next step, and it would also let a reinstalled app download its meals back with `GET /meals`.
- **The Supabase project is in Sydney,** so saves take 3–5 s from India. They run in the background, so users don't wait, but a closer region would be better for production.
