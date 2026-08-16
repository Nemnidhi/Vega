# Handoff — Vega (HRMS Command Center)

**Repo:** `D:\Vega-main`
**Remote:** https://github.com/Nemnidhi/Vega.git
**Branch:** `master`
**HEAD as of this handoff:** `6539ffb` — five commits shipped 2026-08-16 (below). All pushed to
`origin/master`. **Deploy is manual, NOT auto-triggered by a push** (unlike Dashboard-WhatsApp's
5-minute cron) - see "Deployment" below before assuming production reflects any of this.
**A production deploy was kicked off at the end of this session** (`deploy-via-git.sh`, run
directly on the VPS) covering all five commits below at once - confirm `https://vega.nemnidhi.com/
api/health` and, ideally, actually exercise the Tasks/Clients/Proposals pages in production before
trusting this is fully live.

This is the first `HANDOFF.md` this repo has had - written because a large amount landed in one
session and a fresh window picking this up needs the context below rather than re-deriving it.
See also `D:\Whatsapp Dashboard\Dashboard-WhatsApp\HANDOFF.md` (the sibling app this one now talks
to) and the planning docs in `D:\Research\ecosystem-audit\` (`full-system-scope.md`,
`execution-sequence.md`, `new-industry-client-onboarding-runbook.md`) for the wider business
context these features were scoped from.

## What Vega actually is, for anyone new to this repo

Not a generic CRM - the internal command-center for Nemnidhi's own agency operations. Single
tenant by design (it's Nemnidhi's own business, not sold to anyone) - `Lead` → `Proposal` →
`Client` → `Project` → `ChangeOrder` → `Blueprint`, plus `Attendance`/`LeaveRequest`/`ActivityLog`
for internal HR. Absorbed `samvid-lead-engine`'s cold-prospect Digital Presence Audit logic via
`docs/samvid-migration-runbook.md` (1,115 leads migrated into the unified `Lead` model). In the
wider Nemnidhi ecosystem, Vega is the "management/relationship spine" - Dashboard-WhatsApp is the
multi-tenant operational product Nemnidhi's clients actually use.

## Five commits, 2026-08-16 — DONE, pushed, deploy in progress

1. **`7ac6fc3` Internal task management with calendar and KPI progress tracking.** New `Task`
   model (title/status/dueAt, optional links to `Lead`/`Client`/`Project`) and `Kpi` model (a
   numeric target assigned to a role, a specific user, or both - "per role and per individual"
   was the actual requirement, not just one or the other). Progress is always computed live from
   linked `Task` completions (`lib/kpi/progress.ts`), never stored/duplicated, so it can't drift.
   New `/tasks` page: list with create/complete/delete, a month-grid calendar of tasks by due
   date, and a KPI tab with progress bars. `assignTasksToOthers`/`manageKpis` permission rules
   (admin/partner/project_manager) gate assigning work to others and managing KPIs; everyone else
   manages their own tasks and sees KPIs assigned to them or their role.
2. **`b5c4432` Deploy script health-check fix.** `scripts/deploy-via-git.sh`'s health check used
   to `sleep 5` then curl once - this app's cold boot regularly takes 25-30s (visible in its own
   `pm2 logs hrms` - "Ready in 27.5s" etc.), so the fixed sleep produced a false-negative 502 that
   looked like a failed deploy when the app was actually fine, just still starting. Now polls
   every 5s up to 60s, only fails loud (with the last real response) if it genuinely never comes
   up. **Hit this exact false alarm for real once this session** before the fix existed - confirmed
   via `pm2 status` (genuinely online, real memory usage, not a crash-loop) and a delayed re-check
   (clean 200 ~20s later) that it was the check firing too early, not a real failure.
3. **`c05ef48` Dashboard→Vega event feed — receiver side.** New `POST /api/integrations/
   dashboard-events` - server-to-server only, authenticated with a shared secret header
   (`DASHBOARD_INTEGRATION_SECRET`, optional in the env schema so an unconfigured environment
   doesn't fail its whole env parse - the route itself rejects the request, not the process, when
   it's unset). New `Client.dashboardOrganizationId` link field (the piece that was missing -
   Vega's `Client` and Dashboard's `Organization` had no way to reference each other before this)
   plus rolled-up summary fields (`dashboardPlan`, `dashboardPlanUpdatedAt`,
   `dashboardLastEventAt`) - deliberately never stores Dashboard's raw operational data, per the
   "Vega reads signals, not detail" boundary from `full-system-scope.md`. Full event history goes
   through the existing `ActivityLog` (extended `entityType` to include `"client"`, `action` to
   include `"dashboard_event_received"`) instead of a new parallel log. Only one event type
   exists today: `plan_changed`, fired from Dashboard's `PUT /admin/entitlements/plan`. An org
   with no matching `Client` (e.g. Dashboard's own Workspace #1) is a normal outcome, not an
   error - the sender shouldn't need to know which orgs map to real Vega clients.
4. **`8019aea` Account-health flags on the Clients page.** First slice of the "Vega copilot"
   internal-AI scope. `lib/clients/health.ts` computes one of four states (not linked / no
   recent signal >14 days / plan downgraded / plan upgraded / active) purely from data Vega
   already has - the feed's `plan_changed` events plus `dashboardLastEventAt` recency.
   Deliberately honest about the current limit: only plan changes flow through the feed so far,
   no real usage/activity signal - extending the feed with something richer (message volume,
   active-conversation count) is the natural next step before this gets more useful. Shown as a
   badge on `/clients`, computed via one batched `ActivityLog` aggregation in `getClients()`, not
   a query per client.
5. **`6539ffb` AI drafting assist on the proposal generator.** Second slice of the Vega-copilot
   scope. New `POST /api/proposals/draft` (`lib/proposals/draft.ts`) turns a signed
   `ScopeManifest`'s `businessObjective`/`timelineAssumptions` into real client-facing prose for
   the `Proposal` form's `projectSummary`/`timeline` fields - the two fields that were previously
   just a raw string / semicolon-joined list, since the proposal page already copies
   `exclusions`/`changeOrderClause` straight from the scope manifest (redrafting those would have
   been duplicate logic pretending AI wrote something it didn't). Reuses the exact Groq-primary/
   Gemini-fallback/plain-template-fallback resilience pattern already proven in
   `lib/prospecting/generate-paragraph.ts` (the audit-report paragraph generator) - same shape,
   new domain, not a new pattern.

**The third slice of the Vega-copilot scope, sales reply-assist, lives in Dashboard-WhatsApp's
Inbox, not here** - see that repo's `HANDOFF.md`. "Vega copilot" was always the umbrella name for
AI pointed inward at Nemnidhi's own ops; that specific piece is Workspace #1's sales team using
Dashboard's own Inbox, not a new Vega surface.

## Deployment

Production (`vega.nemnidhi.com`) runs on a **self-hosted VPS** (`72.60.97.58`, SSH port `2424`,
user `hrmsdeploy`), **not Vercel** - `vega-rose.vercel.app` is stale info from before the app
moved and now returns Vercel's own `DEPLOYMENT_NOT_FOUND`, don't use or trust that URL again. PM2
process name `hrms`, app dir `/home/hrmsdeploy/apps/hrms`. This VPS also hosts Dashboard-WhatsApp
(`/opt/dashboard-whatsapp`, different Linux user `dashboard`) - the two apps are on the same
machine but fully separate PM2 daemons/users; `sudo -u dashboard` is needed to touch that app's
files from the `hrmsdeploy` session, and vice versa.

**Deploy is manual - pushing to `origin/master` does nothing on its own.** Run directly on the
VPS as `hrmsdeploy`:
```bash
bash /home/hrmsdeploy/apps/hrms/scripts/deploy-via-git.sh
```
Clones `master` fresh into a temp dir, builds it there, and only swaps it into place (keeping a
timestamped backup of the previous release) if the build succeeds - production is never touched
by a failed build. Restarts PM2 and polls the health check (see item 2 above for why that's a
poll now, not a fixed sleep).

**Health check:** `curl https://vega.nemnidhi.com/api/health` → `{"status":"ok","database":
"connected"}`. There's no `.last-deploy-sha`-style tracking here the way Dashboard-WhatsApp has -
no remote way to confirm which exact commit is live short of SSHing in and checking `git log -1`
inside `/home/hrmsdeploy/apps/hrms`.

**Production env vars needed for the Dashboard→Vega feed (item 3 above) to do anything:**
`DASHBOARD_INTEGRATION_SECRET` in `/home/hrmsdeploy/apps/hrms/.env.local`, must exactly match
Dashboard-WhatsApp's `VEGA_INTEGRATION_SECRET`. **Already added, 2026-08-16**, confirmed via a
clean `tail` read-back and a `pm2 restart hrms --update-env`. Not yet verified against a real
production plan change end to end (only tested locally) - watch for the first real one.

## Environment gotchas (local dev)

- **Local dev DB is `vega_dev` on the same Atlas cluster as production** (`MONGODB_DB_NAME` in
  `.env.local`) - a genuine scratch database, safe to seed/mutate freely, already has the 1,115
  migrated leads in it from the Samvid migration rehearsal.
- **Turbopack dev-server flakiness, hit repeatedly this session - treat as environmental, not a
  code bug.** `npm run dev` (Next.js 16 + Turbopack) regularly gets stuck showing the route's
  `loading.tsx` Suspense skeleton forever in the browser, even though the server log shows a
  clean `200` (sometimes 20-50s on a cold compile - "Slow filesystem detected" is self-flagged at
  every boot). Confirmed multiple times this session that this happens on completely
  unrelated/untouched routes too (`/leads`, `/dashboard`), not just newly-changed ones - proof
  it's the dev server, not a real bug. Fix: kill all `node.exe`, `rm -rf .next`, restart `npm run
  dev`, and use a **fresh browser tab** (a tab loaded before the restart stays stuck even after
  the server's healthy again). If that still doesn't render, don't keep burning time on it -
  verify the actual logic directly instead: call the API route with `fetch()` executed in-page
  (browser JS-eval), which includes the httpOnly session cookie automatically and sidesteps the
  page-render pipeline entirely while still proving the real code path against real data. This is
  exactly how items 3-5 above were verified when the page itself wouldn't render.
- **No test suite exists in this repo** (`package.json` has no `test` script, `npm run lint` via
  ESLint is the only automated check besides `tsc --noEmit`). Both were run clean before every
  commit above; this is a gap worth knowing about, not something fixed this session.
- **Local `GEMINI_API_KEY` looks stale/wrong** (`AQ.Ab8...`, doesn't match Google's usual
  `AIzaSy...` format) - both Groq (no key locally, expected) and Gemini fell through to the
  template fallback when testing item 5 above. Not a code issue - `lib/prospecting/
  generate-paragraph.ts` reads the identical env var and would be equally affected. Production's
  key may well be different/valid; not verified either way this session.

## What's next (from `execution-sequence.md`, updated 2026-08-16)

- **Vega-copilot scope (step 21) is now fully closed** - all three pieces (account-health flags,
  proposal drafting here; sales reply-assist in Dashboard) built and shipped the same day.
- **Natural next step for account-health flags**: extend the Dashboard→Vega feed with a real
  usage/activity event (not just `plan_changed`) so the health signal reflects actual product
  usage, not just plan trend - this was explicitly deferred as a fast-follow, not forgotten.
  See Dashboard-WhatsApp's `HANDOFF.md` item 5 for the sender-side pattern to extend, and match
  its exact shape (`{dashboardOrganizationId, event, data}`) on the receiver side here.
- **BillStack's Razorpay setup** deliberately not started - no client needs billing yet, and the
  three subscription Plans/webhook need to be created in Razorpay's own dashboard by a human
  (real business decision on pricing, plus credentials only the user can access) - revisit when a
  real client actually signs.
- **Samvid OS / vertical-module consolidation** (whether the real-estate vertical folds into
  Dashboard's core or stays separate) - deliberately still parked until a second vertical exists
  to generalize from.
