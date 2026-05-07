# HRMS Command Center MVP

Strategic lead-to-delivery system built in phased architecture with full MongoDB-backed workflows.

## Delivered Scope (Phases 1-12)

- Foundation architecture with Next.js App Router + TypeScript.
- MongoDB schemas with validation and cross-model relationships.
- Multi-intake lead capture (software, infrastructure, legal-tech, retainer).
- Silent lead scoring with priority bands:
  - `80+` => Heavy Artillery / Partner Negotiation
  - `50-79` => Standard Sales Pipeline
  - `<50` => Volume Pipeline
- Scope-Lock Vault with mandatory discovery fields.
- Proposal generator with status workflow and PDF-ready output.
- Dynamic pricing engine with margin-protected final price calculation.
- Change-order protection for out-of-scope requests post `Closed Won`.
- Role-aware API enforcement.
- Activity logging and audit trail endpoints.
- Premium command-center UI routes for dashboard and operations pages.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- MongoDB + Mongoose
- Zod validation

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Configure `.env.local`:

```env
NEXT_PUBLIC_APP_NAME=HRMS Command Center
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_BASE_URL=https://your-live-domain.com
MONGODB_URI=mongodb://127.0.0.1:27017/hrms
MONGODB_DB_NAME=hrms
AUTH_SECRET=replace-with-a-32-char-secret
AUTH_TRUST_HOST=true
LEAD_CAPTURE_ALLOWED_ORIGINS=https://nemnidhi.com,https://www.nemnidhi.com
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=alerts@your-company.com
SMTP_PASS=replace-with-smtp-password
SMTP_FROM_EMAIL=alerts@your-company.com
SMTP_FROM_NAME=HRMS Command Center
```

4. Run app:

```bash
npm run dev
```

5. Validate build:

```bash
npm run lint
npm run build
```

Project and task assignment emails are sent only when SMTP variables are configured.
Use `APP_BASE_URL` as your live domain to ensure email links never point to localhost.

## Core Routes

### App Pages

- `/dashboard`
- `/leads`
- `/leads/[id]`
- `/pipeline`
- `/scope/[leadId]`
- `/proposals`
- `/proposals/[id]`
- `/pricing-components`
- `/change-orders`
- `/clients/[id]/vault`

### Core APIs

- `GET/POST /api/leads`
- `GET/PATCH /api/leads/[id]`
- `PATCH /api/leads/[id]/status`
- `GET /api/leads/[id]/engineering-start`
- `POST /api/public/leads` (public website intake, origin allowlist enforced)
- `GET/PUT /api/scope/[leadId]`
- `GET/POST /api/proposals`
- `GET/PATCH /api/proposals/[id]`
- `GET /api/proposals/[id]/pdf` (print/PDF-ready HTML)
- `GET/POST /api/pricing-components`
- `PATCH /api/pricing-components/[id]`
- `POST /api/pricing-components/seed`
- `GET/POST /api/change-orders`
- `GET /api/clients/[id]/vault`
- `GET /api/activity-logs`
- `GET /api/dashboard`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

## Seed Data

Seed pricing catalog from API:

```bash
curl -X POST http://localhost:3000/api/pricing-components/seed
```

Includes:

- Basic intake system
- CRM pipeline
- WhatsApp updates
- e-Courts sync
- Client dashboard
- GST invoice automation
- HRMS module
- AI drafting copilot
- Judgment summarizer
- Custom integration

## Rule Enforcement (Final Integration)

- No lead can become `closed_won` without:
  - completed + signed scope manifest
  - signed proposal
- Engineering start check blocks execution before scope lock and signed proposal.
- High-ticket proposal sign-off requires Partner/Admin.
- Pricing margin is protected by default.
- Out-of-scope requests after `closed_won` are forced into Change Orders.
- Sensitive actions are logged in `ActivityLog`.

## Auth Session Flow

- Open `/login`
- Sign in with email + role
- Session cookie is issued (`httpOnly`) and protected routes open
- Use `Logout` from dashboard shell to clear session

All operational APIs now require authenticated session.

## Folder Structure

- `src/models`: Mongoose schemas
- `src/lib/leads`: scoring engine
- `src/lib/workflows`: scope/closed-won/change-order guards
- `src/lib/pricing`: pricing engine + seed catalog
- `src/lib/proposals`: proposal output template
- `src/lib/activity`: audit logging
- `src/app/api`: all operational APIs
- `src/app/(dashboard)`: command-center pages
- `src/components`: reusable UI and module components
