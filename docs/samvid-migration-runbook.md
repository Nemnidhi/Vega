# Samvid → Vega migration runbook

Migrating 1,115 cold prospects (plus their audit signals, tiers and one
generated report) from the standalone Samvid Lead Engine into Vega's unified
`Lead` model.

Every step below has been rehearsed end-to-end against a scratch database
(`vega_dev`), including a full rollback and restore. What has **not** been
rehearsed is running it against Vega production, because that database holds
real clients, projects and HR records.

---

## Before you start

**You need:**

| Item | Where it goes | Status |
|---|---|---|
| Vega production `MONGODB_URI` | `.env.local` | **not yet supplied** |
| Vega production `MONGODB_DB_NAME` | `.env.local` | **not yet supplied** |
| `SAMVID_MONGODB_URI` / `SAMVID_MONGODB_DB` | `.env.local` | already set |
| `GEMINI_API_KEY` | Vercel + `.env.local` | already set locally |
| `GOOGLE_PLACES_API_KEY` | Vercel + GitHub secrets | already set locally |
| SMTP creds (`SMTP_HOST/PORT/USER/PASS/FROM_EMAIL`) | Vercel only | **deliberately unset locally** |

**Understand what this does to the CRM.** After migration the Leads list is
overwhelmingly cold prospects. Anyone using Vega for inbound sales will see
their board change completely. Confirm with whoever uses it daily.

---

## 1. Back up the target database

Take a backup **before** the first write. Two layers, because they cover
different failures:

**a. An Atlas snapshot** — the real safety net. Confirm one exists in the
Atlas UI and note its timestamp. This is the only thing that restores
indexes, users and validation rules.

**b. A document-level export** you can inspect and selectively restore:

```bash
npm run backup:db -- --out ./backups/pre-migration
```

`mongodump` is **not installed** on the machine this was built on, so this
uses the MongoDB driver already in the project. Documents are written as
newline-delimited Extended JSON, which preserves ObjectIds, Dates and the
report PDF Buffers — plain JSON would silently destroy all three. Verified
on a real 1,115-lead database: ObjectIds, nested `checkedAt` dates and a
3,558-byte PDF all survived the round trip.

It does **not** capture indexes, users or validation rules. That is what the
Atlas snapshot is for.

To restore:

```bash
npm run backup:db -- --restore ./backups/pre-migration          # dry run
npm run backup:db -- --restore ./backups/pre-migration --apply
```

Restore refuses to write into a non-empty collection unless `--force` is
also passed, so it cannot silently double-insert.

The rollback script in the last section is precise but only covers documents
this migration created; the backup covers everything else.

---

## 2. Pre-flight (read-only)

```bash
npm run preflight:migration
```

Reports what is already in the target, whether the migration has run before,
and — importantly — whether any incoming lead would **duplicate a business
already in the CRM** by email or business name. The migration keys only on
`prospecting.legacyLeadId`, so a business already present under a different
record would end up represented twice.

Exits non-zero on a blocker. Warnings need a human decision, not a shrug.

---

## 3. Dry run the migration

```bash
npm run migrate:samvid
```

Must reproduce these known-good figures before you go further:

```
prepared 1115 lead(s), skipped 0
tier distribution:  {"C":735,"B":67,"D":313}
industry resolved:  {"real_estate":1115}
industry confidence: {"explicit":1115}
segment split:      {"broker_agent":1115}
google business found: 1022
website found:         340
reports to migrate:    1
```

If any number differs, stop and find out why. These are the tier figures
*before* the Google name check — step 5 changes them deliberately.

---

## 4. Apply the migration

```bash
npm run migrate:samvid -- --apply
```

Idempotent: upserts on `prospecting.legacyLeadId`, so re-running updates in
place rather than duplicating.

---

## 5. Correct the Google false positives, then re-tier

Places text search returns the nearest match rather than nothing, so 214 of
the 1,022 "found" listings are a different business. This runs **offline** —
the listing name is already stored, so no Places quota is used.

```bash
npm run recheck:google           # dry run
npm run recheck:google -- --apply
npm run classify:leads -- 2000 --reclassify
```

Expected after this step:

| | Before | After |
|---|---|---|
| Google found | 1,022 | **808** |
| Tier B | 67 | **239** |
| Tier C | 735 | **605** |
| Tier D | 313 | **271** |

Leads already at `reported`/`sent` are deliberately **not** re-tiered — their
PDF has already been generated and the record must not silently disagree
with it.

---

## 6. Verify

```bash
npm run verify:migration
```

Counts, a 25-lead field-level diff against the source, signal totals, and PDF
validity. Exits non-zero on any mismatch.

Then spot-check by hand in the UI: open `/leads`, confirm the tier filter and
coverage tiles populate, open a lead and confirm the Digital Presence Audit
card shows tier, industry and signals.

---

## 7. Deploy

Add to the Vega Vercel project (Settings → Environment Variables):

- `GEMINI_API_KEY`
- `GOOGLE_PLACES_API_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`

**Vercel env changes need an explicit redeploy to take effect** — verify live
behaviour afterwards, not just that the UI shows them saved.

Add to GitHub repo secrets (Settings → Secrets and variables → Actions) so
the 15-minute cron can run:

- `MONGODB_URI`, `MONGODB_DB_NAME`, `GOOGLE_PLACES_API_KEY`,
  `META_AD_LIBRARY_ACCESS_TOKEN`

Note the rename: Samvid used `MONGODB_DB`, Vega uses `MONGODB_DB_NAME`.

Trigger `.github/workflows/audit-pipeline.yml` manually once via
`workflow_dispatch` with a small batch and confirm it behaves before trusting
the schedule.

---

## 8. Retire Samvid — last, and reversibly

Only after the merged system is confirmed working end-to-end:

- **Archive**, do not delete, the `samvid-lead-engine` Vercel deployment.
- **Do not drop** the `samvid_lead_engine` database. It is the source of
  truth this migration reads from, and the only way to re-run step 4.

---

## Rollback

```bash
npm run rollback:samvid           # dry run
npm run rollback:samvid -- --apply
```

Deletes only documents this migration created, identified by
`prospecting.legacyLeadId` / `legacyLeadId`. Unrelated Vega data is never
touched.

**It refuses to delete leads that have been worked since migration** — moved
down the sales pipeline, linked to a client, or had their report sent.
Deleting those would destroy real work. They are listed and skipped; clear
them by hand if the rollback must be total.

Rehearsed on the scratch database: rolled back 1,113 leads (correctly keeping
2 worked ones), re-migrated, and the tier distribution came back identical.

---

## Known issues carried into production

- **`"Nature Yards Private Limited"`** — the one lead at `reported` — has a
  stored tier of C while its signals say D. This predates the migration: it
  was classified before its Google check was backfilled, then moved to
  `reported` and never revisited. Left as-is by decision; revisit when
  reports are next worked on.
- **Meta is still stubbed** pending App Review, so `metaAds.checked` is
  always false and **no lead can reach Tier A** ("confirmed no presence"
  requires all three channels checked).
- **Outreach copy and the LLM prompt are industry-aware, but 2 of the 21
  sectors in the workbooks have no knowledge-bank entry** (Cement & Building
  Materials, Entertainment/Events/Fitness). Those leads import fine and get
  generic report copy.
