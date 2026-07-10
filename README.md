# Kinsen Used Cars

**Kinsen Used Cars** is the public-facing marketplace and admin back-office for Kinsen Hellas' used-vehicle leasing and sales business. It lets customers browse the current stock, filter by price/monthly price/spec, favorite vehicles, submit leasing/financing/test-drive leads, and contact the company — while the admin back-office manages inventory, leads, contact messages, FAQ content, and site settings. Vehicle stock is kept in sync automatically via an external "car-stock" webhook integration.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS
- **Database / ORM:** PostgreSQL + Prisma
- **Auth:** NextAuth v5 (Credentials provider, JWT sessions, bcryptjs password hashing)
- **Validation:** Zod
- **Email:** Nodemailer (best-effort notifications, no-ops if SMTP isn't configured)
- **Seeding:** `tsx` running `prisma/seed.ts`

## Prerequisites

- **Node.js 20.9+**
- **PostgreSQL 15+** (local install, Docker, or a hosted instance)

Don't have Postgres installed locally? The fastest path is a free hosted instance from one of these — each gives you a ready-to-use `DATABASE_URL` in under a minute:

- [Neon](https://neon.tech) — serverless Postgres, generous free tier
- [Supabase](https://supabase.com) — Postgres + free tier, includes a dashboard
- [Railway](https://railway.app) — one-click Postgres plugin

Copy the connection string it gives you into `DATABASE_URL` in your `.env` file.

## Setup

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL, NEXTAUTH_SECRET, CARSTOCK_API_KEY, etc.
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

The app will be available at `http://localhost:3000`.

### Generating `NEXTAUTH_SECRET`

`NEXTAUTH_SECRET` must be a random string of at least 32 bytes. Generate one with:

- macOS/Linux: `openssl rand -base64 32`
- Windows (PowerShell): `[Convert]::ToBase64String((1..32|%{Get-Random -Max 256}))`

### Default admin login

The seed script creates a default super-admin account:

- **Email:** `admin@kinsen.local`
- **Password:** `change-me-after-login`

Log in at `/login` and **change this password immediately** — it's a well-known default and should never be used in a real deployment.

## Environment variables

See `.env.example` for the full list. The essentials to fill in before running the app:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret used to sign NextAuth session tokens |
| `NEXTAUTH_URL` | Base URL of the app (e.g. `http://localhost:3000`) |
| `CARSTOCK_API_KEY` | Shared secret required by the car-stock integration endpoints (see below) |
| `SMTP_*` / `CONTACT_NOTIFICATION_EMAIL` | Optional — enables email notifications for contact form submissions |
| `UPLOAD_DRIVER` / `UPLOAD_DIR` | Local vehicle image upload storage (S3/Cloudinary settings are placeholders, not yet implemented) |

## Car-stock integration

The app exposes a small set of endpoints for the external car-stock system to push inventory updates and pull display data. All three require an `Authorization: Bearer <CARSTOCK_API_KEY>` header matching the `CARSTOCK_API_KEY` environment variable — requests without a valid key are rejected with `401`, and if `CARSTOCK_API_KEY` isn't configured on the server at all, the endpoints reject every request with `500` rather than silently allowing access.

| Method & path | Purpose |
| --- | --- |
| `POST /api/integrations/carstock/cars-updated` | Push a batch of vehicle stock updates (create/update/freeze/delete). Accepts either a bare JSON array or `{ "items": [...] }`. Returns import counts and an `importLogId`. |
| `GET /api/integrations/carstock/available-colors` | Returns the distinct list of colors currently available across active, non-deleted stock. |
| `POST /api/integrations/carstock/display-cars` | Returns the full list of active, non-deleted vehicles currently eligible for public display. |

Every import is recorded as an `ImportLog` row (status, counts, per-item errors) for auditing in the admin back-office.

## Project structure

```
src/
  app/                    # Next.js App Router routes (public pages, admin, API)
    api/                  # Public API routes + car-stock integration endpoints
  components/             # Shared React components
  lib/                    # Framework-agnostic helpers: prisma client, auth, rate-limit,
                           # email, validators (zod schemas), slug generation, normalization
  server/
    services/             # Business logic layer used by API routes and server actions
                           # (vehicle, favorite, lead, contact, auth, settings, faq, import)
prisma/
  schema.prisma           # Database schema
  seed.ts                 # Demo data seed script (admin user, vehicles, FAQ, settings)
```

## Available scripts

```bash
npm run dev          # Start the dev server
npm run build        # Production build
npm run start        # Start the production server
npm run lint         # ESLint
npm run typecheck    # TypeScript check (no emit)
npx prisma migrate dev   # Apply/create migrations
npx prisma db seed       # Run prisma/seed.ts
npx prisma studio        # Browse the database
```
