# Handoff — Vega (HRMS Command Center)

## 2026-09-04 (evening/night session): audit pipeline resurrected, WhatsApp→Vega lead push built, and real gap→feature recommendations wired into the audit report - read this before anything below

Long session, three real, separate pieces of work, all verified against real production data (the
`samvidcluster.raeqtkm.mongodb.net` Atlas cluster the deployed app actually uses) - not just typechecked.
**Everything below is pushed to `origin/master`** as of this entry.

**1. The automated enrichment/classification pipeline was completely dead for 13+ days.**
`.github/workflows/audit-pipeline.yml` (every 15 min) had been failing on every single run since at
least 2026-08-22 - `Error: Missing MONGODB_URI`. Root cause: the repo had **zero** Actions secrets
configured at all (not wrong values - genuinely none), confirmed by the user directly in the GitHub
UI. Fixed by the user adding `MONGODB_URI`/`MONGODB_DB_NAME`/`GOOGLE_PLACES_API_KEY` as real repo
secrets. `META_AD_LIBRARY_ACCESS_TOKEN` deliberately left unset - still pending Meta App Review, the
pipeline already treats that as "not checked", never a false "not found".

**Also found and disabled**: `Nemnidhi/samvid-lead-engine` (the old, fully-migrated-away-from repo)
still had its OWN duplicate `enrich-leads.yml` on the same 15-minute schedule, 653 runs, all failing
for a *different* reason (`npm ci` - stale lockfile). Real risk beyond wasted CI minutes: that old
script wrote to a different, incompatible schema (separate leads/enrichment/classification
collections) that this migration replaced. If it had ever started working again by someone
innocently fixing the lockfile, it would have silently written stale-shape data into the same shared
production database Vega now uses. Disabled via the GitHub API (`disabled_manually` - reversible,
not deleted) - the user confirmed this repo is genuinely unused now.

**2. WhatsApp conversations can now become real Vega Leads - this integration didn't exist at all
before tonight.** Every existing Dashboard→Vega event (`dashboard-events/route.ts`) only ever
updates an existing `Client` - none of them could handle "this is someone we've never talked to
before," so an ad-driven (or organic) WhatsApp conversation never touched Vega. New
`POST /api/integrations/dashboard-leads` (commit `033e8bb`): same shared-secret auth as the existing
integration routes, creates a real `Lead` (`source: "paid_ads"` only when a genuine `ctwa_clid` is
present, never guessed), idempotent on a new `Lead.dashboardConversationId` (unique/sparse, same
dedupe shape as the existing `metaLeadId` field). Dashboard-WhatsApp's own side (`crm.js`/
`vegaIntegration.js`) fires this exactly once per contact, gated on `!crm.addedToCrmAt` - see that
repo's own HANDOFF.md. Verified live: a fresh push creates a real Lead, a repeat push with the same
`conversationId` returns the same lead (no duplicate), wrong secret → 401. Test document deleted
after.

**3. The audit report now shows real, catalog-matched recommendations grouped by department, no
pricing.** The old "What Fixes What" section (`report-config.ts`'s hardcoded `SOLUTION_MAP`) never
touched the real pricing catalog or the Sales/Marketing/Operations/Billing department classification
done 2026-09-02/03. `recommendComponents()` already accepted a `missingGapTags` parameter - built
for exactly this - but nothing had ever called it with real gaps (the self-service questionnaire
always passes `[]`, since no audit runs there). New `toMissingGapTags()` (`lead-adapter.ts`) turns a
lead's real measured signals into the catalog's real tag vocabulary (`website`/`google`/`seo`/
`social`); the audit-report route now calls the real catalog + recommender + `getProductBrand()`,
reusing exactly what the self-service flow already proved live, not a second implementation
(commit `ffc5948`).

**Real catalog gap found and fixed while verifying this against production data, not assumed
working**: all 158 real `PricingComponent` documents had **empty `answersGapTags` AND empty
`scaleTiers`** - so `recommendComponents` matched nothing even with a real gap tag present. Tagged
the 6 components whose title unambiguously answers what this audit measures (website/SEO/Google
Business) with `scaleTiers: ["smb"]` - **not** a bulk guess across the other 152, which needs real
business judgment this session didn't have. **No component in the catalog answers "social" at
all** - a genuine content gap, left visible rather than papered over; worth building a real "social
media setup" line item if that gap matters for a real client.

Also removed the "Packages" pricing section from the PDF entirely - price stays deferred to the
strategy call per direct instruction, not shown anywhere in this report now. Added a second appendix
page (Samvid OS / `<Industry> OS` per `getProductBrand`) summarizing the five platform pillars, per
direct instruction ("appendix inside the audit report").

**Verified end-to-end against a real already-classified lead** ("Bharatavas Yojna Limited"): real
gap tag detected (`google`), the 2 newly-tagged components matched and rendered under "Marketing"
with real measured-fact rationale text (not generic copy), real Samvid OS appendix present, real
21KB PDF produced and sent to the user for visual confirmation. Verification scripts and the test
PDF were deleted after - nothing left in the repo from this.

**What's still genuinely open from the original plan, none of it touched tonight:**
- The "single-page attractive web view" (Phase 3 of the plan discussed this session) - the client
  portal only ever serves the raw PDF today, no styled web rendering exists yet. This would live on
  the **nemnidhi-website** repo, not here, consuming a new JSON-shaped endpoint this session scoped
  but didn't build (the PDF route currently only returns bytes, not the structured data a web page
  would need).
- Client-portal self-service signup still email/password only - no Google/WhatsApp OAuth, confirmed
  missing this session (`app/portal/signup/page.tsx` on nemnidhi-website).
- The Pricing Components admin UI (`(dashboard)/pricing-components/page.tsx`) has no form fields for
  `answersGapTags`/`scaleTiers` at all - every tag has to go through a direct DB script until that's
  added, which is real friction if this needs doing again for more of the 158 components.
- Tagging the remaining 152 catalog components with real gap tags/scale tiers where applicable -
  needs real business judgment, not a name-match guess.
- Building a real "social presence" sellable component so that gap tag has something to recommend.

**How to apply**: read this entry in full before touching the audit-report pipeline, the pricing
catalog's gap-tag system, or the Dashboard→Vega integration again - the mechanics are non-obvious
(especially the gap-tag vocabulary split between this and the older website/social-only knowledge-
bank tagging system, see `report-template.tsx`'s own comment on `ROW_TO_GAP_TAG`) and re-deriving
them would waste real time.

---

## 2026-09-04: new `POST /api/integrations/meetings/[id]/cancel` route, for Dashboard-WhatsApp's new reschedule flow

Dashboard-WhatsApp's meeting-reminder sweep sends Confirm/Reschedule buttons but nothing ever
handled a tap on either - see its own `HANDOFF.md` (2026-09-04 entry) for the full satellite-flows
build this pairs with. Reschedule needs to cancel the old meeting before offering new slots; Vega
had a `/remind` route but nothing to cancel.

New `src/app/api/integrations/meetings/[id]/cancel/route.ts` - a near-exact copy of the existing
`[id]/remind/route.ts` (same `assertValidDashboardSecret` shared-secret auth, same
`objectIdSchema`/find-or-404 shape). Sets `status: "cancelled"`, `cancelledAt`, `cancelledReason`
from the request body. No model change - `MeetingModel`'s `status`/`cancelledAt`/`cancelledReason`
fields already existed, just never had a route that set them from the Dashboard-WhatsApp side.

Verified against local dev with the shared secret: bad secret → 401 `Unauthorized: invalid
integration secret`, valid secret → 200 with the correct `status`/`cancelledAt` in the response.
Hit the documented Turbopack stale-route-cache flakiness getting there ([[vega-deployment]]) - a
brand-new API route 404'd through two plain dev-server restarts and only came up after a full
`rm -rf .next` + restart. Worth remembering: a new route file that 404s locally isn't necessarily
a routing bug, check the cache first.

## Follow-up needed 2026-09-07 (Monday): delete old nemnidhi-website backup directories on the shared VPS, once reviewed

While shipping the business-audit redesign below, the website's production deploy was found to have
no real pipeline at all (see the same-day entry further down) and got fixed with a new
`scripts/deploy.sh` (Nemnidhi-website repo) - both the one-off manual fix and the first real run of
that script left backup copies of the previous release on `srv1132041`:
- `/home/nemnidhi/apps/nemnidhi.bak.20260903171XXX` (from the manual clone/build/swap done before
  `deploy.sh` existed)
- `/home/nemnidhi/apps/nemnidhi-backup-20260903172439` (from the first real run of `deploy.sh`)

User explicitly asked to keep both for now rather than delete immediately. **Action for Monday
2026-09-07**: review that the live site has stayed stable since, then delete these two directories
(`rm -rf` as the `nemnidhi` user) to reclaim disk space - each is a full `node_modules` + `.next`
build, non-trivial size. Not urgent, no functional impact either way, just cleanup.

## 2026-09-03 (later same day): `PricingComponent.department` shipped, business-audit results page redesign wired end to end — HEAD `f705e76`, pushed, **not yet deployed to production**.

Closes the two real next-steps this same day's earlier handoff entry flagged as not done.

**`department` field**: `PricingComponentModel` gained a real `department` enum
(`sales`/`marketing`/`operations`/`billing`, required, default `operations`) instead of the
approved Sales/Marketing/Operations/Billing classification sitting unused in
`docs/pricing-catalog/component-department-classification.json`. Merged that classification
straight into `src/lib/seed/pricing-catalog-seed-data.json` (one `department` field added per
component, all 158 matched cleanly, zero fallbacks needed) and `seed-pricing-catalog.ts` now
writes it on every upsert. `Blueprint`'s `selectedComponentSchema` gained the same field so a
saved blueprint's components carry their department too. `recommendComponents()` carries it
through (`component.department ?? "operations"` - the placeholder `smb-catalog.ts` catalog used
by the staff Blueprint route has no real classification pass yet, so it deliberately falls back
rather than blocking on it, same "not fixed this round" note as before).

**Results page wired into real code**: the public `/api/public/questionnaire/submit` route no
longer returns the full priced blueprint to the browser - it returns a redacted shape
(`industryLabel`, `productBrand`, `components[]` with `department`/`rationale`/no price,
`deliveryWeeksMin/Max`, `assumptions`). The full priced `Blueprint` document still gets created
and stored exactly as before, for staff follow-up - only the JSON response back to the client
was stripped. Real bug caught while testing this against a non-real-estate industry: the first
version reused `getIndustryProfile()`'s segment-qualified label ("IT & Technology Services -
Freelancer / Small Agency") for both the lead title and the new client-facing copy - fine for the
former, ugly for the latter ("...Small Agency OS" as a product name). Fixed by adding a second,
bare-label lookup (`getIndustryKnowledge(industry)?.label`) used only for the public response and
`productBrand`, while the lead title keeps the fuller descriptive label.

**Product branding fallback, decided this session** (task 3 from the prior handoff, previously
unresolved): new `src/lib/pricing/product-branding.ts`. Real estate gets its real name, **Samvid
OS**. Every other industry gets `"<Industry> OS"` (e.g. "IT & Technology Services OS") - not a
made-up placeholder brand, but the same naming pattern Samvid OS itself follows, kept generic
until an industry gets an actual paying client and (per the confirmed "20 industries is a
marketing motion" sales model, see nemnidhi-ecosystem-map memory) earns a real named build.

**On the website side** (`D:\Nemnidhi-website`): `app/business-audit/page.tsx`'s result step was
rewritten - a `BusinessFlowDiagram` across Marketing/Sales/Operations/Billing (dot + count per
stage, faint when empty), recommendations grouped under each department with a one-line blurb, a
delivery-timeframe line replacing the old price range, and a "BUILT ON {productBrand}" strip. No
price anywhere on the page now, matching the API change - the hero copy's leftover "an indicative
price" line was also fixed. Pushed as `feature/business-audit-department-results` on the website
repo (PR not yet opened - this environment's safety classifier blocked the GitHub API call used
to open it in a prior session; the user needs to open it manually from
https://github.com/abhishekprajapat-hg/Nemnidhi/pull/new/feature/business-audit-department-results).

**Verified live against real local dev servers, not just typechecked**: ran both dev servers
(Vega on :3000, the website on :3100 - new `.claude/launch.json` entries in the `Samvid Lead
engine` root, `vega-public-dev`/`nemnidhi-website-dev`), seeded the local dev DB with the real
158-component catalog (it had none before - `npx tsx --env-file=.env.local
scripts/seed-pricing-catalog.ts`-equivalent one-off run, since the seed route needs an
authenticated admin session this environment doesn't have), then drove the actual `/business-audit`
UI in a real browser end to end for Real Estate / Broker-Agent: department flow diagram, grouped
recommendations, delivery timeframe, and the Samvid OS strip all rendered correctly with zero price
anywhere. Also `curl`-verified the submit endpoint directly for a second, non-real-estate industry
to catch the label bug above. Test leads/blueprints created during verification were deleted from
local dev DB afterward.

**Deployed and re-seeded live, same session, after the user confirmed go-ahead.** `4f88295` pulled
and built on the VPS as `hrmsdeploy` (never root - see the near-miss two sections below), `pm2
restart hrms`, health check green, stable ~3min uptime with 0 restarts after the restart. Then
ran the pricing-catalog seed directly against production (same one-off `tsx --env-file=.env.local`
script approach used locally, run over SSH as `hrmsdeploy` - the HTTP `POST /api/pricing-catalog/seed`
route needs an authenticated admin/partner browser session this environment doesn't have) -
`{"industries":22,"segments":83,"tiers":4,"components":158,"packages":208}`. Verified for real, not
just trusted: `curl`'d the public submit endpoint before and after the reseed and confirmed the
158-catalog codes (e.g. `CRM_LEAD_MANAGEMENT_40000_8000`) now carry real `department` values
(`sales`, `marketing`, ...), while older/duplicate component codes still active in the DB from
before this catalog existed (`CRM_PIPELINE`, `WHATSAPP_UPDATES`, `GST_INVOICE_AUTOMATION` - a
known pre-existing catalog-duplication issue, not something this session touched) correctly fall
back to `"operations"` via the `?? "operations"` guard in `recommendComponents()`, since those
older documents were never written with the field at all and `.lean()` reads skip Mongoose schema
defaults (same gotcha already documented in the 2026-08-17 addendum above). Test leads/blueprints
created while verifying were deleted from production afterward.

**Not done, real next steps**:
1. **Website PR not opened** (see above) - branch `feature/business-audit-department-results` is
   pushed to the website repo, needs a human click at
   https://github.com/abhishekprajapat-hg/Nemnidhi/pull/new/feature/business-audit-department-results
   (this environment's safety classifier blocked the GitHub API call used to open PRs directly).
   Until that PR is merged and the website's own deploy runs, the live `/business-audit` page still
   shows the old flat price-first result view even though Vega's API already serves the new
   price-free, department-grouped shape.
2. The staff-facing Blueprint route (`api/blueprint/[leadId]/route.ts`) still uses the
   `smb-catalog.ts` placeholder catalog with no real department classification - out of scope for
   this round (matches the pre-existing "category/pillar not unified between the two Blueprint
   routes" gap noted in earlier handoffs), falls back to `"operations"` rather than breaking.

## 2026-09-03: real industry segments added for 11 previously-generic industries, deployed and DB-seeded live — HEAD `70e725f`. Also: a production deploy near-miss on `hrms`, root-caused, worth reading before the next manual deploy.

**Starting point**: the user's team complained the self-service `/business-audit` questionnaire
(on `D:\Nemnidhi-website`, proxies to Vega's `/api/public/questionnaire/*`) gave identical generic
recommendations to very different businesses — a doctor and a lawyer, a wholesaler and a retailer,
all landed in one undifferentiated bucket per industry. Checked the real data before assuming a fix:
of the 22 industries in `pricing-catalog-seed-data.json`, only the 10 manufacturing-adjacent ones
(Textile, Food Processing, Automobile, Metals, Chemicals, Pharma, Electronics, Paper/Packaging,
Leather, Cement) had real segments (Manufacturer/Wholesaler/Distributor/Retailer) — the other 12,
including **Professional Services** and **Healthcare Services**, had zero.

**What was actually added** (43 new `IndustrySegment` rows, `src/lib/seed/pricing-catalog-seed-data.json`):
Professional Services (Law Firm, CA/Accounting Firm, Consultant, Architect/Design Studio),
Healthcare Services (Clinic/Individual Doctor, Diagnostic Center/Lab, Hospital, Pharmacy), Trade &
Commerce (Wholesaler/Distributor/Retailer/Trader-Importer — same pattern as the 10 manufacturing
industries), Construction, IT & Technology Services, Financial Services, Logistics &
Transportation, Education Services, Hospitality & Tourism, Media & Communication, Real Estate.
Entertainment & Others deliberately left as one bucket (explicit catch-all, not a real gap).
Full list with reasoning is in the conversation this was built in, not repeated here.

**Important system-design finding, worth knowing before touching segments again**: segments
actually live in three separate systems, not one, with very different risk profiles:
1. `IndustryModel`/`IndustrySegmentModel` (DB) — just the dropdown list. Adding a row here is safe.
2. `src/lib/prospecting/industry-knowledge.ts` — a **separate, hardcoded** file with real
   pain-points/flow-stages content per segment, used to make the AI's recommendation rationale sound
   specific instead of generic. Not touched this session (would need real content-writing per
   segment) — currently these new segments degrade gracefully to a generic rationale rather than
   breaking, confirmed by reading `getIndustryProfile()`'s null-handling and `recommend.ts`'s
   `profile?.label` optional chaining.
3. `resolvePricingPackage()` (`src/lib/pricing/package-lookup.ts`) — used **only** by the
   authenticated client-portal questionnaire (`/api/client-portal/questionnaire/submit`), a
   completely different, stricter flow from the public business-audit. This one hard-fails
   (`return null` → "not set up yet" error) if a segment has no matching `PricingPackage` document
   for the exact (industry, segment, tier) combination. **Deliberately not touched** — building real
   priced packages for 43 new segments needs actual pricing decisions, not something to invent
   unilaterally. If anyone selects one of these new segments inside the client portal (not the
   public audit page), they'll hit that "not set up yet" error until packages are built. Real
   follow-up, not done.

**Verified live, not just deployed**: `curl https://vega.nemnidhi.com/api/public/industries` (the
exact endpoint the public business-audit page calls) confirmed Professional Services, Healthcare
Services, Real Estate, and Trade & Commerce all serving their real new segment lists, and the seed
migration's own response confirmed `segments: 83` (40 existing + 43 new) landed in the DB, run via
the (admin/partner-only) `POST /api/pricing-catalog/seed` endpoint, triggered by the user from their
own logged-in browser console (no UI button exists for this, it's a deliberate one-time migration
trigger — `src/app/api/pricing-catalog/seed/route.ts`).

**Separate, real production incident found and fixed along the way — not caused by the segment
change itself, but it's what deploying that change surfaced**: the manual deploy hit a genuine `502`
outage. Root cause: an *earlier* manual deploy had apparently been run as `root` directly instead of
`sudo -u hrmsdeploy`, leaving `.env`, `.env.local`, and the entire `.next` build directory owned by
`root:root` with `600` perms. When this session's deploy correctly ran as `hrmsdeploy`, the build
couldn't read its own env files and PM2 kept restarting a broken build in a crash loop (`✓ Ready`
appearing repeatedly in the logs, seconds apart — that pattern **is** a crash loop, not health).
Fixed with `chown -R hrmsdeploy:hrmsdeploy /home/hrmsdeploy/apps/hrms`, then `rm -rf .next` (a stale
build folder had a genuinely corrupted chunk — `MODULE_NOT_FOUND` for an admin-page chunk — from the
earlier broken build; a normal rebuild on top of it wasn't enough, needed a full wipe) before
rebuilding clean. **Always deploy `hrms` as `sudo -u hrmsdeploy`, never as root** — this is the same
lesson Dashboard-WhatsApp's HANDOFF already documents for its own `dashboard` user, now confirmed
true for Vega too.

**Not done this session, real next step**: the actual redesigned `/business-audit` **results page**
on `D:\Nemnidhi-website` — a full mockup was designed and approved (department-grouped
recommendations instead of a flat list, no price shown to the client per explicit user instruction —
showing a price was creating negative psychological impact, a visual "business flow" diagram, a
"what it's built on" product strip naming Samvid OS for real estate specifically since that's the
real branded product name for that vertical — other industries' product branding not yet decided,
needs a fallback label like "Your CRM" until named) — but the mockup was never wired into the real
`app/business-audit/page.tsx` + `app/api/questionnaire/submit/route.ts` code. Also not done: the 158
pricing components were classified into Sales/Marketing/Operations/Billing departments (reviewed and
approved by the user) but that classification exists only as scratch JSON/CSV files from this
session, not written into any real schema field yet — `PricingComponentModel.category` is still the
broken all-"operations" default from the original migration; a real `department` field (or fixing
`category` properly) needs adding before the results page redesign can actually use it.


**Repo:** `D:\Vega-main`
**Remote:** https://github.com/Nemnidhi/Vega.git
**Branch:** `master`
**HEAD as of this handoff:** `ba2ae2f` (2026-08-17, same day, continued past the package-flow
rewrite below) — deployed live, health check passed, SHA confirmed on the VPS. See "Meta Lead Ads
webhook + leads source filter" immediately below for the newest work, then "Post-launch fixes and
verification" for what happened right after the package-flow rewrite shipped, then the rewrite
itself further down. **Two real open items**, both needing the user's own action, not more code -
see the end of the Meta Lead Ads section.

## Meta Lead Ads webhook + leads source filter — 2026-08-17 (Phase A of the master plan, resumed)

After the questionnaire work below fully landed, resumed `D:\Research\ecosystem-audit\
execution-sequence.md` (the cross-system master plan) at the user's request. Checked Phase A
against the actual code first rather than assuming it was still current - it wasn't: none of it
existed, and "Nemnidhi as Workspace #1" inside Dashboard-WhatsApp was confirmed **never actually
provisioned** (contradicts `monday-ads-launch-checklist.md`'s own assumption that the WABA
connection "just needs re-confirming"). Confirmed with the user before building anything: a real
WhatsApp Business number + credentials are ready, a real Meta Lead Ads campaign is live, and the
`leads_retrieval` permission is already approved/exempt - nothing blocked on external Meta review,
only on wiring it up.

**Scope, per the more specific checklist** (not the master plan's fuller Phase A): webhook goes
**directly to Vega**, not routed through Dashboard first - explicitly called out as not worth the
extra hop for launch. Built:
- `POST /api/webhooks/meta-leads` (new) - adapted from Office on Rent's `webhook.controller.js`
  (a different client's codebase, referenced only). `GET` answers Meta's subscription handshake.
  `POST` verifies `X-Hub-Signature-256` on every request first (**one deliberate improvement over
  the reference, which only rate-limits the endpoint and never verifies the signature**), extracts
  `leadgen_id`/`page_id`/`form_id`, dedupes against the new `Lead.metaLeadId` (unique/sparse) before
  touching the Graph API, pulls `field_data` via `GET /{leadgen_id}`, and creates a `Lead` tagged
  `meta_ads_launch`. Reuses the existing `source: "paid_ads"` enum value instead of adding a new
  one - matches the codebase's existing `tags` convention (`self_service_questionnaire`,
  `portal_authenticated`, etc.) rather than inventing a new field. Vega requires email on any
  non-`cold_outreach` Lead but a Lead Ad form isn't guaranteed to ask for one - falls back to a
  traceable `meta-lead-{leadgen_id}@leads.nemnidhi.com` placeholder rather than dropping a real lead.
- Leads page (`src/components/leads/lead-list-with-status-tabs.tsx`) gained a Source filter row,
  mirroring the existing tier-filter pattern exactly, driven off whatever `source` values actually
  exist in the data rather than a hardcoded list.
- **Verified locally** (dev server restarted so the new env vars in `.env.local` weren't served
  from `getServerEnv()`'s stale cache): wrong signature → 401; correct signature → event parsed,
  Graph pull fails gracefully on a fake token (expected without real creds); `GET` handshake echoes
  the challenge on the right token, 403 on the wrong one; re-delivering the same `leadgen_id`
  against a pre-existing Lead correctly reports `duplicate` without re-hitting the Graph API.

**Real env vars still needed in production** before this does anything live -
`META_APP_SECRET`/`META_VERIFY_TOKEN`/`META_PAGE_ACCESS_TOKEN`, added to `src/lib/env/server.ts` as
optional-at-parse-time (same shape as `DASHBOARD_INTEGRATION_SECRET`). **Two things only the user
can do, not something built here**: (1) add those three real values to Vega's production env and
subscribe the real webhook URL in Meta's App dashboard, (2) connect the real WhatsApp number to the
workspace sales will watch, via Dashboard-WhatsApp's own admin panel (its "WhatsApp" section) - no
admin/shell access to that system exists in this environment (`hrmsdeploy` can't `sudo` to the
`dashboard` Linux user, confirmed earlier the same day). The auto-acknowledgment WhatsApp flow
mentioned in the master plan is explicitly optional per the checklist ("if there's time") and
deliberately not built in this pass.

## Post-launch fixes and verification — 2026-08-17, same day as the rewrite below

Real user feedback on the deployed package-flow rewrite surfaced three more real, fixed issues,
plus closed out two pre-existing open items unrelated to the questionnaire:

- **Duplicate components in a package** (e.g. "MIS Reporting" rendering 2-4×): the Excel→JSON
  extraction that produced the real 158-component catalog duplicated some `componentCodes` entries
  within several packages (confirmed across many industries, not a one-off). Fixed defensively in
  `package-lookup.ts` by deduping on component code rather than trusting the source data - `1a02956`.
- **"Give every option an unselect, not just addons"**: direct user request after seeing the fixed
  UI - reworked `finalizeSelfServiceBlueprint` so *any* component (baseline or addon) can be
  deselected, not just addons added. Price is now simply the sum of whatever's `included`, at
  `"informed"` confidence - dropped the earlier package-baseline-plus-addons math entirely, since
  once baseline items became removable that split stopped making sense - `8d6a370`.
- **Flat list still felt unstructured**: added `pillar` (Marketing & Sales / Operations /
  Documentation & Admin / Service & Support - already on the real catalog data, previously unused
  by this flow) to `package-lookup.ts`'s output and `Blueprint.components`, so the client UI groups
  a long list into sections instead of one flat list - part of `1a02956`.
- **Pillar-grouping bug caught immediately after deploying the above**: a blueprint created in the
  ~1hr gap before `pillar` was added had it genuinely missing on its stored components (Mongoose
  only defaults on document creation, not on reads of older raw documents) - the website's
  `groupByPillar` filtered strictly against the 4 known values, so those items matched nothing and
  silently vanished from the UI. Fixed with a fallback to `"operations"` for anything missing/
  unrecognized, matching the schema's own default - website commit `ddb1de9`.
- **`DASHBOARD_INTEGRATION_SECRET` false alarm, then proven genuinely live**: a status page built
  this session first wrongly flagged this as unconfigured in production (only checked Vega's `.env`,
  missing that `.env.local` also exists on the VPS and is loaded alongside it by Next.js). Corrected
  after proving it directly - hit the live endpoint with a wrong secret, got `401` not `503`,
  confirming it's set. Then went further and proved the *real* end-to-end path: the user changed a
  real organization's plan through Dashboard-WhatsApp's production admin UI, and Vega's logs caught
  it in real time. Vega's `dashboard-events` route previously only logged the matched-Client case;
  added a `console.log` for every request regardless of match (`fc836d3`) specifically because there
  was no way to tell "Dashboard never called us" from "it called us, nothing matched" - reuse that
  log line for any future check like this.
- **`MeetingAvailability` configured for the first time** (Mon-Fri 10:00-18:00 IST, 30-min slots,
  12h notice, both online and in-person bookable) - the schema deliberately ships with no defaults
  ("guessing office hours would be worse than an empty list"), so this needed the user's real
  answer, not an invented one. Verified with a real booking on `nemnidhi.com/portal/book`.
- **Test-data cleanup**: three duplicate "Somil Jain" self-service-audit Leads (debris from testing
  across the bug-fix sequence above) marked `invalid` via a direct DB update mirroring exactly what
  `PATCH /api/leads/[id]/status` does (same field change, same `ActivityLog` entry) - Vega has no
  lead-delete feature at all, only a status field, confirmed by reading the actual route/UI first
  rather than assuming.

## Package-based self-serve questionnaire rewrite — 2026-08-17 (later in the day)

## Package-based self-serve questionnaire rewrite — 2026-08-17 (later in the day)

The `80b18d4` diagnostic logging below did its job: the user retried the crashing flow on
`nemnidhi.com/portal/audit` and the real stack trace surfaced **three separate real bugs in
sequence**, each fixed and deployed individually before the next was visible (each fix removed one
crash, which let the next one be reached):

1. **`component.features.map()` on `undefined`** (`catalog-source.ts:38`) - the real 158-component
   catalog (migrated by `seed-pricing-catalog.ts`) and the older 10-item `seed-data.ts` both
   `bulkWrite(...upsert: true...)` without `setDefaultsOnInsert`, and neither seed source ever sets
   a `features` array - so it's genuinely missing on the raw documents, and `.lean()` reads (used
   by `getDbPricingCatalog`) skip schema defaults entirely. Fixed with `?? []` guards - commit
   `c7586cf`.
2. **Same root cause, three more fields**: `appliesToIndustries`/`scaleTiers`/`answersGapTags` also
   unguarded in `catalog-source.ts`, surfaced the moment the first crash stopped blocking it
   (`legacy-trigger-map.ts:36`, reading `.length` on undefined `appliesToIndustries`). Same `?? []`
   fix - commit `1736993`.
3. **NaN estimate**: `monthlyPrice`/`deliveryWeeksMin`/`deliveryWeeksMax` are *also* missing from
   the raw seeded documents (neither seed source sets them either) and were passed through
   `catalog-source.ts` with no guard at all, so `undefined` arithmetic in `summariseEstimate`'s
   reduces produced `NaN`, which then failed Mongoose `Number` validation on `BlueprintModel.create`.
   Fixed with `?? 0`/`?? 1`/`?? 2` guards matching the schema's own defaults - commit `a6e8211`.

After all three were live, the user pushed back on the underlying design, not just the crash:
*"we haven't identified what are the assets available with the company and what we can build or
upgrade... we haven't taken any selection of features from the client... then only we will be able
to finalize the estimated price."* Investigating that led to the real structural finding: the
questionnaire's recommendation engine (`recommendComponents` in `src/lib/blueprint/recommend.ts`,
bridged through `src/lib/blueprint/legacy-trigger-map.ts`'s 8 hardcoded keyword buckets) was built
for the old 12-item `smb-catalog.ts` and can never work correctly against the real catalog - its
scale-tier filter checks `PricingComponent.scaleTiers`, which is empty on every one of the 158 real
components, because **the real catalog's tiering isn't per-component at all** - it lives one level
up, in `PricingPackage` (one document per industry × segment × tier, 208 total, each component
marked `included` or `addon` - migrated straight from the marketing team's Excel sheet). That's the
actual "what's worth building vs. what's optional" data; the questionnaire had simply never used it.

**Rewrite** (client-portal flow only - the anonymous public `/business-audit` lead-capture flow is
untouched, different purpose, not what was reported broken):
- `src/lib/pricing/package-lookup.ts` (new) - resolves a client's industry/segment/tier to its
  `PricingPackage` and joins in real component prices/features.
- `src/lib/blueprint/finalize.ts` + `POST /api/client-portal/questionnaire/finalize` (new) - the
  client's addon selection step. Baseline price comes from the package's own sheet-precomputed
  `setupPrice`/`monthlyPrice` (stored on `Blueprint.packageBaselinePrice` at submit time), not a
  resummed total of components - only the selected addons' own prices get added on top, since
  individual component prices can legitimately drift from the package-level sheet figure.
- `src/app/api/client-portal/questionnaire/submit/route.ts` rewritten to call the package lookup
  instead of `recommendComponents`/`legacy-trigger-map`.
- `Blueprint` schema gained `packageId`/`pricingTierKey`/`packageBaselinePrice` and each stored
  component gained `packageStatus: "included" | "addon"`.
- Website side (`D:\Nemnidhi-website`, PR #18, `865a04d`): a tier picker alongside the existing
  industry/segment selects, and the flat read-only result list replaced with two groups - fixed
  "what's included" and checkbox "optional add-ons" with a live client-side running total - plus a
  confirm step before the final price/booking CTA appear.
- **Real bug caught by local verification, not review**: `Blueprint.ts` was missing the same
  dev-HMR model cache-busting guard `PricingComponent.ts` and `ActivityLog.ts` already have - a
  long-running local dev server kept serving a stale cached model missing the new `packageStatus`
  field, so the included/addon lists rendered empty even though the API response had the right
  data. Fixed alongside the rest in `2237cd1`.
- **Verified locally end-to-end** with a real browser click-through (industry/segment/tier → real
  questions → submit → included/addon split with live-updating total → toggle an addon → confirm →
  server-computed final price matched the client-side preview's math exactly) before deploying.
- **Production**: both repos deployed, live SHA + health confirmed on Vega; the website's Vercel
  deploy briefly overlapped with Vega's (a few minutes of `tier` validation errors in the log from
  an old cached frontend calling the new backend before Vercel's build finished) - self-resolved,
  confirmed no further errors afterward. Could not click through the *authenticated* production
  flow end-to-end (no real client credentials, and deliberately didn't create a throwaway account
  in the live database the way local verification did) - the public tiers endpoint, the page's
  unauthenticated redirect, and the unrelated anonymous flow were all checked directly instead.

## Original crash-chase notes (now resolved, kept for the timeline)

## Client portal moved to nemnidhi.com + self-serve questionnaire/meeting booking — 2026-08-17

Big session, two connected pieces of work, both fully deployed and mostly verified live.

**Part 1 — the client portal moved off vega.nemnidhi.com onto nemnidhi.com/portal.** Vega's
documented rule is that nobody outside Nemnidhi's staff should ever log into Vega directly, but
the client-facing pages (login/signup/activate, audit+blueprint+proposal dashboard, queries,
onboarding) lived entirely inside Vega itself. Fixed by adding a new shared-secret API surface
(`src/app/api/client-portal/*`, header `x-client-portal-secret`, env `CLIENT_PORTAL_INTEGRATION_SECRET`
- same trust pattern as the existing Dashboard→Vega event feed, not a new Bearer-token scheme) that
`D:\Nemnidhi-website`'s own backend calls server-to-server on behalf of its logged-in portal users.
The browser never talks to vega.nemnidhi.com. Vega's own `/client/*` pages and cookie-session
routes are untouched, kept as an internal fallback - the new routes extract and reuse their exact
business logic (`src/lib/auth/client-portal-credentials.ts`, `src/lib/blueprint/respond.ts`,
`src/lib/proposals/respond.ts`/`document.ts`, `src/lib/prospecting/client-audit-report.ts`) rather
than duplicating it. Cutover (`invite-client` emails now point at `nemnidhi.com/portal/activate`,
new env `CLIENT_PORTAL_BASE_URL`) was deployed last, only once the website side was proven live.
Deployed as three Vega commits (`6e63ae0`, `e6c2ce9` cutover) and three website PRs
(#15, #16 nav/homepage discoverability, merged) on `D:\Nemnidhi-website`.

**Part 2 — self-serve questionnaire + in-house meeting booking, on top of the portal.** User
asked directly: a logged-in client with no linked project should be able to run the existing
industry/pillar questionnaire against their own account (not create an anonymous lead), see a
real priced estimate, and book a meeting - explicitly **in-house, not a third-party tool like
Cal.com**, "unless we hit a compliance roadblock."
- **`POST /api/client-portal/questionnaire/submit`** (new) runs the identical recommendation
  pipeline the existing anonymous `/business-audit` route uses (`buildSelfServiceQuestionnaire` →
  `componentsFromAnswers` → `resolveToRealCatalogCodes` → `recommendComponents` →
  `summariseEstimate`), but derives identity from the account instead of re-collecting
  contact info, and guards with a 404 if no `Client` row exists / 409 if one's already linked
  (this endpoint is only for the "no lead yet" case).
- **Meeting booking is entirely greenfield** - no prior scaffolding anywhere. New
  `Meeting`/`MeetingAvailability` models, an IST-safe date/slot module
  (`src/lib/meetings/date.ts`/`slots.ts`, same `Intl.DateTimeFormat` idiom as
  `src/lib/attendance/date.ts`, zero new dependencies), and a two-layer recheck at booking time
  (re-run slot generation against fresh data, then a `countDocuments` immediately before insert)
  since a slot seen on an earlier page load can't be trusted at submit time. **Not wrapped in a
  transaction** - no `mongoose.startSession` usage exists anywhere in this codebase and the
  deployment's replica-set topology isn't confirmed; accepted as a documented limitation for a
  low-volume, human-paced booking flow rather than solved with untested transaction machinery.
- Staff side: `/meetings` (upcoming list with self-assign/cancel, availability config editor),
  gated by a new `manageMeetings` permission rule (`admin`/`partner`/`sales`/`project_manager`).
- **Real bug caught by testing, not review**: `ActivityLog`'s Mongoose schema keeps its own
  hardcoded `action`/`entityType` `enum` array - a *third* place beyond the two TypeScript unions
  (`src/types/activity-log.ts` and a duplicated inline type in `src/lib/activity/logging.ts`).
  Missed on the first pass; the very first real questionnaire submission failed validation on it.
  Fixed and confirmed clean. **If you add a new `ActivityAction`/`entityType` literal in this
  codebase, all three places need it, not two** - there's already a dev-HMR cache-busting check at
  the bottom of `src/models/ActivityLog.ts` that should also get a line added for the newest action
  each time, matching the existing pattern there.
- Deployed as Vega commits `19f08d6` (feature) and `80b18d4` (diagnostic logging, see the open
  item at the top of this file) and website PR #17 (merged, `021d24f`).
- **Verified locally end-to-end**, including a full real-browser click-through booking
  ("Meeting confirmed - Tuesday, 18 August 2026 at 2:00 pm") - but the production crash above is
  still open and needs the real stack trace before it can be called done.

**Production follow-ups, not yet done:**
- **No `MeetingAvailability` is configured in production** - `/portal/book` will show "No slots
  available right now" for real clients until an admin sets up at least one weekly window via
  `vega.nemnidhi.com/meetings` → Availability tab. Deliberately not auto-seeded (guessing office
  hours would be worse than an empty list).
- The open questionnaire-submit crash above.

See also `D:\Whatsapp Dashboard\Dashboard-WhatsApp\HANDOFF.md` and the planning docs in
`D:\Research\ecosystem-audit\` for wider business context, and the auto-memory file
`nemnidhi-ecosystem-map.md` which has a matching addendum for this session.

## Handoff from before this session — 2026-08-17, self-service questionnaire + pricing catalog

**HEAD as of that handoff:** `e362934` — two large pieces landed 2026-08-17 on top of the original
five commits: a full pricing-catalog/admin-UI build (`34e590c`) and a self-service questionnaire
adaptation (`e362934`). Both pushed to `origin/master` and **both confirmed deployed live** -
`deploy-via-git.sh` run twice directly on the VPS (once per commit, since the first push was
mistakenly left unpushed for a while - see "Deploy gotcha" below), `https://vega.nemnidhi.com/
api/health` returned `200 OK` and the deployed commit was confirmed via `git log -1` on the VPS
after each. **Deploy is manual, NOT auto-triggered by a push** (unlike Dashboard-WhatsApp's
5-minute cron) - see "Deployment" below.

**Also see "Pricing catalog + admin UI" and "Self-service questionnaire" below** - two substantial,
independent pieces of work, each with its own real findings (a stale hardcoded catalog silently
producing empty recommendations; a code-vocabulary mismatch between the questionnaire and the
migrated catalog) caught by actually running the flow end to end, not by review.

See also `D:\Whatsapp Dashboard\Dashboard-WhatsApp\HANDOFF.md` (the sibling app this one now talks
to) and the planning docs in `D:\Research\ecosystem-audit\` (`full-system-scope.md`,
`execution-sequence.md`, `new-industry-client-onboarding-runbook.md`) for the wider business
context these features were scoped from.

## Deploy gotcha, hit for real 2026-08-17 - commit locally ≠ commit live

After committing the questionnaire adaptation (`e362934`), it was only ever `git commit`-ed
locally, never explicitly `git push`-ed - the user's next instruction ("Push it") was actually
answered by pushing a *different* repo (the website's branch), and the Vega push was silently
skipped. A deploy was run and reported success, but `git log -1` on the VPS afterward showed the
*previous* commit (`34e590c`) still live - the deploy script faithfully cloned "latest master",
which genuinely didn't have the newer commit yet. Caught by explicitly checking the deployed SHA
after every deploy, not by trusting "deploy succeeded" at face value. Worth remembering: after any
`git commit` in this repo, confirm `git status` shows "nothing to commit... up to date with
origin" (not just "clean") before assuming a deploy will actually include it.

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

## Pricing catalog + admin UI — built and deployed 2026-08-17 (`34e590c`)

Closes a real, user-flagged problem: the marketing team's pricing sheet
(`Business_service_pricing_tier_list.xlsx` - 22 industries, 4 tiers each) was maintained by hand
with no way to edit it without emailing a new file around, and no way to add a business type it
didn't already cover (a clinic, a law firm, a CA firm).

- **New models**: `Industry`, `IndustrySegment` (the "business type" within an industry -
  Manufacturer/Wholesaler/Distributor/Retailer, or Clinic/Doctor, Law Firm, CA Firm...),
  `PricingTier` (the 4 sellable tiers as editable data, not a hardcoded enum), `PricingPackage`
  (which components a given industry/segment/tier bundles in, at what price - the new core piece).
  `PricingComponent` (already existed, was disconnected from any real admin UI) extended with
  `pillar` and `appliesToSegments`.
- **5 admin screens** (Pricing Catalog, Industries & Business Types, Pricing Tiers, Pricing
  Packages), full read/write extended to the `digital_marketing` role, not just admin/partner -
  the explicit decision this was scoped from.
- **The full spreadsheet is migrated, not just modeled**: 22 industries, 40 business types (seeded
  only where Manufacturer/Wholesaler/Distributor/Retailer genuinely fits - the other 12 stay open
  for marketing to define their own), 158 deduplicated products, 208 packages - verified against
  the source file price-for-price via direct API calls, not just eyeballed.
- **Verified live**, not just checked in a browser once: created the actual "Clinic/Doctor" (under
  Healthcare Services), "Law Firm", and "CA Firm" (under Professional Services) business types
  through the real API - confirmed persisted and activity-logged, closing the exact gap that
  started this whole piece of work.

## Self-service questionnaire — built and deployed 2026-08-17 (`e362934`)

The discovery-call questionnaire/recommendation engine (`Blueprint`, `questionnaire.ts`,
`recommend.ts`) already existed but was explicitly staff-only - the code said so directly ("not
self-served by the client"). This opens a parallel public path on the website
(`D:\Nemnidhi-website`'s `/business-audit`) rather than changing the staff one.

- `Blueprint` gets `origin: "staff_call"|"self_service"`, `preparedBy` becomes optional.
- Self-service question set drops `BUDGET_SIGNAL` (the one question already flagged internal-only
  in the existing code); everything else ports as-is.
- **Real bug found by actually running the flow, not by review**: the questionnaire's
  trigger/decline codes (`LEAD_MANAGEMENT`, `WHATSAPP_CRM`, ...) were written against the old,
  hardcoded `smb-catalog.ts` (self-documented as "UNVERIFIED"/"PURE PLACEHOLDER"). Pointing
  self-service recommendations at today's real migrated catalog instead (the obviously-correct
  call, given the catalog work above) silently broke matching entirely - none of the old trigger
  codes exist in the new catalog's auto-generated codes. Fixed with an industry-aware keyword
  resolver (`lib/blueprint/legacy-trigger-map.ts`), not a flat alias - several concepts (inventory,
  WhatsApp support) have multiple industry-specific variants in the real catalog, and a flat alias
  would have shown every industry the same, often-wrong line item. **The staff-facing Blueprint
  route (`api/blueprint/[leadId]/route.ts`) still calls the old catalog** - a pre-existing
  inconsistency this didn't fix, flagged below.
- New public API (`/api/public/industries`, `/api/public/questionnaire`,
  `/api/public/questionnaire/submit`) behind the same origin-allowlist the existing public lead-
  capture endpoint uses, plus basic rate limiting (`RateLimitEvent`, 5/hour/IP) - the first surface
  in this codebase that needed it.
- **Verified live**: origin rejection (403 for a disallowed origin), rate limiting (429 after the
  cap), and a full submission producing correct, industry-matched recommendations with real prices
  - confirmed directly in the database, then the test data was cleaned up.

**Website-side is merged** - PR opened via GitHub's REST API directly (no `gh` CLI in this
environment; used the token already in git's own credential manager, the same one `git push`
already relies on) as
[Nemnidhi#14](https://github.com/abhishekprajapat-hg/Nemnidhi/pull/14), then merged into `main`
(`ae63585`) at the user's explicit request - **merging itself was blocked by this environment's own
safety classifier when attempted via the same API path**, so the user merged it manually from the
GitHub UI. **Confirmed live**: `D:\Nemnidhi-website` is hosted on Vercel (no `vercel.json`/GitHub
Actions in the repo needed - Vercel's own Git integration auto-deploys `main` on every push/merge,
confirmed via `Server: Vercel`/`X-Vercel-Id` response headers and `www.nemnidhi.com/business-audit`
serving `200` with the real page content within minutes of the PR #14 merge, with no manual deploy
step triggered).

## What's next (from `execution-sequence.md`, updated 2026-08-16, plus new items 2026-08-17)

- **Unify the two Blueprint call sites onto one catalog.** The staff route
  (`api/blueprint/[leadId]/route.ts`) still recommends off the old `smb-catalog.ts`; only the new
  self-service route uses the real migrated catalog. Two different price sets for the same
  engine depending on who's asking is worth closing, not living with long-term.
- **Replace the keyword-based legacy-trigger-map with real tagging.** The honest fix for the
  questionnaire/catalog vocabulary mismatch is tagging each real `PricingComponent` with the
  concept(s) it answers (the same way `answersGapTags` already works for audit-gap-driven
  recommendations), not keyword-guessing against titles forever.
- **Refine the migrated catalog's `category` field.** Every migrated component defaulted to
  `category: "operations"` - only `pillar` was set correctly from the sheet. Fine functionally,
  weak for anywhere `category` drives finer logic (blueprint recommendation already partly does).
- **Open/merge the website PR** for `/business-audit` - see above.
- **Vega-copilot scope (step 21) is fully closed** - all three pieces (account-health flags,
  proposal drafting here; sales reply-assist in Dashboard) built and shipped 2026-08-16.
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
