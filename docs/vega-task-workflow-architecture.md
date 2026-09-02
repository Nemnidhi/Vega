# Vega — Task & Workflow Architecture Audit (Phase 0)

**Date:** 2026-08-31
**Scope:** Read-only audit of the Vega working tree at `C:\Users\abhishe\OneDrive\Desktop\HRMS`, cross-checked against `github.com/Nemnidhi/Vega` @ `4c919d5`.
**Status:** Architecture analysis only. No code written. Phase 1 not started.

---

## 0. Executive summary — read this before Phase 1

The 14-phase plan was written against a Vega that does not match the Vega on disk. Five findings change what Phase 1 should be.

### 0.1 `design.md` does not exist — BLOCKER

Every phase opens with "Read `design.md` before implementing anything." There is no `design.md`:

- not at repo root (local or committed),
- not in `docs/` (which contains only `samvid-migration-runbook.md`),
- no file in the tree references the string `design.md`.

**However**, the approved visual language it describes is already implemented in code, and matches the phase prompts almost exactly:

| Spec in phase prompts | Where it already lives | Value |
|---|---|---|
| 218px sidebar | `src/components/dashboard/sidebar.tsx:58` | `w-[218px]` ✅ |
| 62px top command bar | `src/components/dashboard/top-nav.tsx:86` | `min-h-[62px]` ✅ |
| dark navy surfaces | `src/app/globals.css` | `--vega-bg: #07111b`, `--vega-surface-1/2/3` ✅ |
| thin borders | `globals.css` | `--vega-border: #243241`, `-soft`, `-strong` ✅ |
| purple active states | `globals.css` | `--vega-purple: #8b5cf6` + soft/border variants ✅ |
| semantic status colors | `globals.css` | blue / green / yellow / orange / red / cyan + `-soft` ✅ |
| 34px controls | `globals.css` `select { min-height: 2.125rem }` | ✅ (34px) |

**Decision needed:** either (a) locate/supply the real `design.md`, or (b) accept `src/app/globals.css` + the shell components as the normative design source and let me write `design.md` from them so future phases have the file they are told to read. Until one of those happens, "follow `design.md`" is unenforceable and every visual review in Phases 2/3/7/14 has no reference.

### 0.2 The Project module has been deleted from the working tree — BLOCKER

13 files that exist at `4c919d5` are gone locally:

```
src/models/Project.ts
src/types/project.ts
src/lib/validation/project.ts
src/lib/notifications/assignment-email.ts
src/components/projects/project-assignment-board.tsx
src/components/projects/task-queue-launcher-trigger.tsx
src/app/(dashboard)/projects/page.tsx
src/app/(dashboard)/projects/[projectId]/page.tsx
src/app/api/projects/route.ts
src/app/api/projects/[id]/route.ts
src/app/api/projects/[id]/tasks/route.ts
src/app/api/projects/[id]/tasks/[taskId]/route.ts
src/app/api/projects/[id]/tasks/[taskId]/alert/route.ts
```

This is not sync corruption. The removal is *consistent*: `src/models/index.ts` no longer exports `ProjectModel`, `src/types/index.ts` no longer re-exports `@/types/project`, `src/components/dashboard/nav-items.ts` no longer has a `Projects` entry, and `src/lib/dashboard/queries.ts` was rewritten to drop every project query (`getDevelopers`, `applyProjectPopulation`, `buildProjectAccessQuery` all removed and replaced with `getClientQueries`). Zero references to Project survive anywhere in `src/`. The empty `src/app/api/projects/**` and `src/components/projects/` directories are leftovers.

**Why it probably happened:** at `4c919d5` Vega had *two* task systems — the `Task` collection **and** an embedded `Project.tasks[]` array with its own `assignedDeveloperId`, `completedByDeveloperId` and `tasks.history[]`. Deleting Project resolved that duplication in the bluntest possible way.

**Consequence for the plan:** `Project` is listed as a source-of-truth business entity in the data invariant. Phase 7's route is `/projects/[projectId]/workflow`. Phase 11 is an entire Project Command Center. Phase 12 links Change Orders to project execution. **None of that has anything to attach to right now.** The working tree's task/workflow system is anchored on **Task**, not Project: `TaskDependency` is scoped by `parentTaskId`, workflow layout lives on the parent Task, and the Workflow Builder is a tab inside `/tasks/[id]`.

**Decision needed** (this is the single largest fork in the plan):

- **Option P1 — Task-rooted (matches what is built).** Accept that a "project" in Vega is a root Task with children. Drop Phase 11's separate Project Command Center, keep the workflow at `/tasks/[id]`, and re-point Phase 12's change-order link at the root Task. Least work, no duplication, but Vega loses a first-class Project entity and the Lead → Client → Project → Delivery spine that `HANDOFF.md:280` still describes.
- **Option P2 — Restore Project as a thin container.** Bring back `Project` from `4c919d5` but **strip `Project.tasks[]` entirely** (that embedded array is the "second disconnected task system" the global rules forbid), leaving Project as: title, description, status, clientId, leadId, scopeManifestId, team, dates. Then re-scope `TaskDependency` and workflow layout from `parentTaskId` to `projectId`, and root Tasks gain a required-ish `projectId`. This is what the 14-phase plan actually assumes. Higher cost, needs a migration for existing `Project.tasks[]` rows in production.

I recommend **P2 with the embedded array stripped**, because Phases 11 and 12 and the commercial execution gate (Scope-Lock → Proposal → Onboarding → Engineering) only make sense against a Project. But it is your call, and it must be made before any Phase 1 code is written — it determines whether the dependency and layout scope key is `parentTaskId` or `projectId`.

### 0.3 Everything in the working tree is uncommitted — RISK

`.git/HEAD` → `refs/heads/master`, reflog tip `4c919d5` (`pull --ff-only vega master`, 2026-08-17). That is identical to `origin`. So **every one of the ~30 new files below, plus the 13 deletions above, exists only as unstaged changes in a OneDrive folder.** No branch, no commit, no push, no backup.

Before any further work: commit this to a branch. If the Project deletion turns out to be wrong (see 0.2), `git checkout 4c919d5 -- src/models/Project.ts ...` recovers it — but only while the objects survive.

### 0.4 Phases 1–9 are already ~70–85% implemented

The working tree already contains, uncommitted:

| Phase | Status | Evidence |
|---|---|---|
| 1 — advanced task data foundation | **largely done** | `models/Task.ts` extended with code / parentTaskId / rootTaskId / priority / startAt / effort / progress / tags / stage / order / checklist / comments / attachments |
| 2 — `/tasks` page redesign | **partial** | `tasks-view.tsx` (45 KB) exists with tabs `tasks / calendar / analytics / kpis` — not the spec'd toolbar, saved views, or 10-column table |
| 3 — Task Workspace `/tasks/[id]` | **largely done** | `app/(dashboard)/tasks/[id]/page.tsx` + `task-detail-tabs.tsx` (79 KB), tabs `Overview / Subtasks / Workflow / Timeline / AI Assistant / Files / Comments / Activity` |
| 4 — dependency engine | **done** | `models/TaskDependency.ts`, `lib/tasks/dependencies.ts` with server-side DFS cycle detection, `lib/tasks/workflow-execution.ts` |
| 5 — Excel/CSV import | **done** | `models/ImportJob.ts`, `lib/tasks/import-subtasks.ts` (23 KB) — SHA-256 file-hash idempotency, formula-injection rejection, transactional execute |
| 6 — workflow data foundation | **done, different shape** | layout stored *on* Task, not in a separate model — see §5.3 |
| 7 — Workflow Builder | **done** | `task-workflow-builder.tsx` (49 KB) on `@xyflow/react` ^12.11.5, with MiniMap / Controls / Auto Arrange / Undo / Fullscreen / Design↔Execution toggle |
| 8 — task ↔ workflow sync | **structurally satisfied** | single Task collection backs table, workspace, workflow and Gantt |
| 9 — execution mode | **done** | `getWorkflowExecutionSummary` returns counts, `nextAvailableTasks`, `blockedTasks`, `overdueTasks`, `criticalBlockers` |
| 10 — approval/condition/milestone/wait | **partial** | node types exist as enum values + `workflowDecision` branching; no `TaskApproval` record (no requestedBy / respondedAt / notes) |
| 11 — Project tab / command center | **not started, and unbuildable** | Project module deleted |
| 12 — change order ↔ task link | **not started** | `Task` has no `changeOrderId` |
| 13 — workflow versioning | **not started** | no version model; also see §5.7 — recommend not building it |

Running Phases 1–7 as written would rebuild this from scratch, which is exactly the "do NOT create a second disconnected task system" failure the global rules exist to prevent. **The plan needs re-baselining against what is on disk**, not against the empty-repo assumption it was written under.

### 0.5 There is no test infrastructure

`package.json` has `lint` only — no `test`, no `typecheck`, no test runner, no test files anywhere in `src/`. The single verification asset is `scripts/validate-task-subtask-schemas.ts` (7.8 KB, run via `npm run test:subtasks`). Phase 14's "run unit tests, integration tests, API tests" cannot be satisfied today. Standing up a runner (vitest is the low-friction choice with this stack) is itself a work item that no phase currently owns.

---

## 1. Task system — as built

### 1.1 Model: `src/models/Task.ts`

Single collection. Self-referencing hierarchy. **Answer to the Phase 0 A-vs-B question: A (self-referencing Task records) — already chosen, already implemented, and correct.** Do not introduce a separate Subtask model.

| Field | Type | Notes |
|---|---|---|
| `title` | String 3–200 | required |
| `description` | String ≤2000 | |
| `status` | enum | **11 values — see §1.2** |
| `priority` | enum | `LOW / MEDIUM / HIGH / URGENT`, default `MEDIUM`, indexed |
| `code` | String, uppercase, `unique: true, sparse: true` | display id, not `_id` |
| `assignedToUserId` | ObjectId→User | **required**, indexed. Single assignee only — no multi-assignee support |
| `createdBy` | ObjectId→User | required |
| `parentTaskId` | ObjectId→Task | null for root, indexed |
| `rootTaskId` | ObjectId→Task | indexed |
| `leadId` / `clientId` / `projectId` / `kpiId` | ObjectId | all optional, all indexed. `projectId` still `ref: "Project"` — **a dangling ref, see §1.6** |
| `startAt` / `dueAt` / `completedAt` | Date | indexed (start, due) |
| `estimatedEffortHours` / `actualEffortHours` | Number ≥0 | spec asked for minutes; hours is what exists |
| `progressPercent` | Number 0–100 | |
| `tags` | [String] | |
| `stage` | String ≤120 | free text, mirrors `workflowGroup` |
| `order` | Number, indexed | sibling ordering |
| `workflowPositionX/Y`, `workflowWidth` (180–520), `workflowCollapsed`, `workflowGroup` | canvas layout **on the Task** | |
| `workflowNodeType` | enum | `SUBTASK / MILESTONE / APPROVAL / CONDITION / MERGE / WAIT / START / END` |
| `workflowDecision` | String, uppercase ≤40 | drives conditional branch selection |
| `workflowStages[]` | subdoc `{key,name,color,collapsed,order}` | stage list, stored on the **root** task |
| `importJobId`, `importExternalId`, `importFingerprint` | import provenance | |
| `attachments[]`, `comments[]`, `checklist[]` | embedded subdocs with `_id` | |
| `workflowTemplate` | enum | legacy: `custom / client_delivery / lead_to_delivery / marketing_campaign / n8n_automation` |
| `flowSteps[]` | legacy | superseded by child tasks |
| **`subTasks[]`** | **legacy embedded array** | **see §1.3 — this is the real duplication risk** |

### 1.2 Status: dual enum, union'd for backward compatibility

`taskStatusValues` = `["todo","in_progress","done", "NOT_STARTED","READY","IN_PROGRESS","WAITING","BLOCKED","REVIEW","COMPLETED","CANCELLED"]`.

The compatibility decision Phase 1 asked for has already been made, and made the safe way — the old lowercase trio was kept in the enum rather than migrated. But the split leaked into behaviour:

- **Root tasks** go through `POST/PATCH /api/tasks` → `createTaskSchema`/`updateTaskSchema` → `taskStatusSchema` = lowercase only.
- **Subtasks** go through `/api/tasks/[id]/subtasks/*` → `advancedTaskStatusSchema` = uppercase only.

So a root task can never be `BLOCKED` or `READY`, and a subtask can never be `todo`. `getCompletionFields()` (`lib/tasks/subtasks.ts`) only recognises `COMPLETED`/`CANCELLED`; `syncParentTaskProgress()` counts only `status === "COMPLETED"` children, so a parent whose children are all legacy-`done` computes 0% progress.

Spec-to-reality mapping (no `client_review` exists today):

| Spec status | Vega |
|---|---|
| `todo` / `backlog` | `NOT_STARTED` (legacy `todo`) |
| `ready` | `READY` |
| `in_progress` | `IN_PROGRESS` (legacy `in_progress`) |
| `blocked` | `BLOCKED` |
| `in_review` | `REVIEW` |
| `client_review` | **missing** |
| `done` | `COMPLETED` (legacy `done`) |
| `cancelled` | `CANCELLED` |
| — | `WAITING` (extra, used by WAIT nodes) |

**Recommendation:** unify on the uppercase set for *both* levels, keep the three legacy values in the schema enum forever for old rows, and add a read-time normaliser (`todo→NOT_STARTED`, `in_progress→IN_PROGRESS`, `done→COMPLETED`) rather than a destructive migration. Add `CLIENT_REVIEW` if the client-approval flow in Phase 10 needs it.

### 1.3 Two subtask representations coexist — must be resolved in Phase 1

1. **Child `Task` documents** (`parentTaskId` set) — the real system. Used by `/api/tasks/[id]/subtasks/*`, the Task Workspace, dependencies, the Workflow Builder, import and analytics.
2. **`Task.subTasks[]` embedded array** — the legacy system. Still written by `POST /api/tasks` and `PATCH /api/tasks/[id]` (`normalizeSubTasks`), still populated (`.populate("subTasks.assignedToUserId")`) in `GET /api/tasks`, `getTasksForUser` and `getTaskDetailForUser`, and still rendered by `tasks-view.tsx`.

A task created from `/tasks` with subtasks produces embedded rows that are **invisible** to the Workspace, the dependency engine and the workflow canvas. This is precisely the "duplicated task data" the invariant forbids, and it is live today.

**Recommendation:** Phase 1's first real deliverable is a one-way migration — for every task with a non-empty `subTasks[]`, create child `Task` documents (carrying `title / description / status / dueAt / assignedToUserId / order / sourceSheet / sourceRow`), then stop writing the array (leave the schema path in place, read-only, until the migration is verified in production). Remove `normalizeSubTasks` from both `/api/tasks` handlers in the same change.

### 1.4 Task code generation

`generateSubtaskCode()` in `lib/tasks/subtasks.ts`. Child codes derive from the parent: `${PARENT-CODE}-ST-001`, falling back to `TASK-${parentId.slice(-6)}-ST-001` when the parent has no code. Uniqueness is a `TaskModel.exists({code})` probe in a loop of 25, then a timestamp suffix.

Two gaps against the spec:
- The spec wants `TASK-2478` / `ST-2478-1`. Vega produces `TASK-ABC123-ST-001`. Cosmetic, but no monotonic counter exists — **there is no root-task code generator at all**; `POST /api/tasks` never sets `code`, so root tasks created from the UI have no code and their children get the `slice(-6)` fallback.
- The check-then-insert probe is racy. `code` has a unique sparse index so the DB will reject a collision, but the request 500s rather than retrying. A `Counter` collection with `findOneAndUpdate({$inc})` is the standard fix and would also give the spec's `TASK-2478` shape.

### 1.5 Comments / attachments / checklist / activity / notifications

All embedded on `Task`, all with `_id`, all populated through `populateTaskRelations()`. **Reuse these — do not build new stores.**

- **Attachments** are `{name, url, mimeType, sizeBytes, uploadedBy, uploadedAt}`. There is **no upload endpoint and no storage adapter anywhere in the tree** — the URL is caller-supplied. Phase 3 "Files" and Phase 14 "attachment access" have no backend to test. This is an unowned gap.
- **Comments** support mentions via `notifyCommentMentions()`.
- **Activity** goes through `logActivity()` (`lib/activity/logging.ts`) → `ActivityLogModel`, with `entityType: "task"` and ~20 `subtask_*` / `workflow_*` / `approval_*` actions already in the enum.
- **Notifications**: `models/Notification.ts` + `lib/notifications/workflow.ts` (16 KB, 12 notify functions), with a unique partial index on `{recipientUserId, dedupeKey}` for dedupe. In-app only; `channels` defaults to `["in_app"]` and nothing emails.

### 1.6 Dangling `ref: "Project"`

`Task.projectId` is declared `ref: "Project"`, but no `Project` model is registered any more. Any `.populate("projectId")` will throw Mongoose `MissingSchemaError` at runtime. Nothing currently populates it, so it is latent — but `taskAnalyticsFiltersSchema` accepts a `projectId` filter and `applyTaskWorkflowTemplateSchema` accepts a `projectId`, so tasks can still be *tagged* with a project id that resolves to nothing. Resolve as part of the §0.2 decision.

---

## 2. Project system — as built

**Nothing exists locally.** For reference, at `4c919d5` `src/models/Project.ts` was: `title`, `description`, `status`, `assignedDeveloperId`, `createdBy`, and an embedded `tasks[]` array carrying `assignedDeveloperId`, `completedByDeveloperId` and a `history[]` audit trail (dev-HMR model-reset guard keyed on `tasks.completedByDeveloperId` / `tasks.history`). Access control lived in `lib/dashboard/queries.ts::buildProjectAccessQuery` — developers saw projects where `assignedDeveloperId` or `tasks.assignedDeveloperId` matched them.

There was **no relationship at all** between `Project` and `ScopeManifest`, `Proposal` or `ChangeOrder` — those all hang off `Lead`/`Client` (see §3.5). So "Project ↔ Scope-Lock ↔ Proposal ↔ Change Order" as described in the phase prompts is **aspirational, not existing**; Phase 11/12 would be building those links for the first time.

---

## 3. Shared infrastructure — reusable inventory

### 3.1 Auth & session
- `lib/auth/session.ts` — `getCurrentSession()` reads the `hrms_session` cookie, verifies via `lib/auth/token.ts`, returns `{userId, email, role, fullName}`. 7-day expiry.
- `lib/auth/role-access.ts` — `requireRoleAccess(roles, {redirectTo, loginPath})` for **server pages** (redirects).
- `lib/auth/permissions.ts` — `getActorContext()` for **API routes** (throws `"Unauthorized"`); `canAccessAtLeast` / `assertRoleAccess({atLeast, oneOf})` over a numeric `roleMatrix` (`client 1 < developer 2 < sales/digital_marketing 3 < project_manager 4 < partner 5 < admin 6`); and the `permissionRules` map.

**Security note:** `getActorContext({allowHeaderFallback: true})` trusts raw `x-user-id` / `x-user-role` request headers. That is a complete authentication bypass for any route that opts in. No task route uses it today — keep it that way, and Phase 14 should assert it.

### 3.2 Task-relevant permission rules
```
assignTasksToOthers: admin, partner, project_manager
manageKpis:          admin, partner, project_manager
manageScope:         admin, partner, project_manager
approveHighTicket:   admin, partner
createChangeOrders:  admin, partner, project_manager, sales, digital_marketing
```
Task ownership check is `canAccessTask()` in `lib/tasks/subtasks.ts`: an `assignTasksToOthers` role sees everything; otherwise assignee-or-creator, with a one-hop fallback to the parent task's assignee/creator. **There is no project-scoped or team-scoped visibility** — a developer sees only tasks assigned to or created by them (or their parent's). Phase 14's role matrix testing should start here.

### 3.3 API conventions
`lib/api/responses.ts`: `ok(data, init)` → `{success:true, data}`; `fail(msg, status, details)` → `{success:false, error:{message, details}}`; `ApiError(message, status)` for exact codes; `handleApiError` maps `ZodError`→422 and otherwise **substring-matches the error message** (`"unauthorized"`→401, `"forbidden"`→403, `"not found"`→404, else 400). Fragile but universal — follow it, don't replace it.

Route shape everywhere: `connectToDatabase()` → `getActorContext()` → `objectIdSchema.parse(id)` → zod parse body → load + authorize → mutate → `populateTaskRelations` → `ok(serializeForJson(...))`, all inside `try/catch { return handleApiError(error) }`.

### 3.4 Database
`lib/db/mongodb.ts` — cached global connection. Transactions are used in `import-subtasks.ts` and `workflow-templates.ts` via `mongoose.startSession()` + `withTransaction`; they require a replica set, so single-node local Mongo will fail those paths.

### 3.5 Business-rule modules (must not be bypassed)
- `lib/workflows/lead-guards.ts` and `lib/workflows/change-order.ts` — existing gates.
- `ScopeManifest` → `leadId`; `Proposal` → `leadId`; `ChangeOrder` → `leadId + clientId + proposalId + scopeManifestId` with `approvalStatus: draft|pending|approved|rejected`, `approvedBy`, `approvedAt`.
- `POST /api/leads/[id]/engineering-start` is the existing engineering gate.

**None of these touch Task.** Phase 12's "change order → execution tasks" link does not exist in any form: `Task` has no `changeOrderId`, and `ChangeOrder` has no task linkage.

### 3.6 UI primitives
`src/components/ui/` contains only `badge`, `button`, `card`, `input`, `textarea`. **There is no table, drawer, tabs, dropdown, select or modal primitive.** Every one of those is hand-rolled inline inside the three giant task components (`task-detail-tabs.tsx` 79 KB, `task-workflow-builder.tsx` 49 KB, `tasks-view.tsx` 45 KB). Any phase that says "reuse existing table/drawer/tabs components" has nothing to reuse — extracting them is real, unowned work, and those three files are already past the size where they can be reviewed sensibly.

Icons: `lucide-react` ^1.34.0 (4 files). Canvas: `@xyflow/react` ^12.11.5 with its stylesheet imported in `globals.css`. Both are already installed and working — Phase 7's "verify compatibility before adopting XYFlow" is settled.

---

## 4. Recommended architecture

### 4.1 Hierarchy (as built — Option P1)

```
Root Task                      Task { parentTaskId: null, rootTaskId: null }
  ├── workflowStages[]         stage definitions (embedded on root)
  ├── Child Task               Task { parentTaskId: root, rootTaskId: root }
  │     ├── checklist[] / comments[] / attachments[]   (embedded)
  │     ├── workflowPosition{X,Y} / Width / Collapsed / Group   (layout, on the task)
  │     └── workflowNodeType / workflowDecision                 (node semantics)
  └── TaskDependency { parentTaskId, predecessorSubtaskId, successorSubtaskId, type, branchKey }

Views over the same rows:  Task table · Subtask table · Workflow canvas · Execution mode · Timeline/Gantt · Analytics
```

Depth is effectively two levels: `generateSubtaskCode` and `syncParentTaskProgress` both assume one parent hop, and dependencies are scoped by a single `parentTaskId`. Arbitrary nesting is **not** supported today despite `rootTaskId` existing.

### 4.2 Hierarchy (if Project is restored — Option P2)

```
Lead → Client → ScopeManifest → Proposal ─┐
                                          ├→ Project (thin container, NO embedded tasks[])
                              ChangeOrder ┘        ├── WorkflowStage (project-scoped)
                                                   ├── Root Task (projectId required)
                                                   │     └── Child Task
                                                   └── TaskDependency (projectId-scoped)
```
Under P2 the scope key for dependencies, layout and stages moves from `parentTaskId` to `projectId`, which is a schema + index + query change across `TaskDependency`, `lib/tasks/dependencies.ts`, `workflow-execution.ts` and every `/api/tasks/[id]/subtasks/*` route. That is the cost of P2, and it is why the decision must precede Phase 1.

### 4.3 Minimum supporting models — verdict on each

| Asked for | Verdict |
|---|---|
| **TaskDependency** | **Exists, keep.** Re-scope to `projectId` only under P2. |
| **WorkflowStage** | **Exists as embedded `Task.workflowStages[]`.** Keep embedded under P1. Promote to a collection under P2 (stages become project-level, shared across root tasks). |
| **WorkflowLayout / NodePosition** | **Do not create.** Layout already lives on the Task (`workflowPositionX/Y`, `Width`, `Collapsed`, `Group`). Phase 6 asks for a separate model to avoid duplicating task data — storing layout *on* the task achieves that goal more directly: one document, no join, no drift, and structurally impossible to duplicate `title`/`status`/`assignee`. The invariant is satisfied; a second model would only add a join. **Recommend explicitly amending Phase 6.** |
| **WorkflowCondition** | **Do not create.** Branching is already structured and safe: `TaskDependency.branchKey` + `Task.workflowDecision`, evaluated by `isDependencyBranchActive()`. No user JavaScript, no eval. Matches Phase 10's constraint exactly. |
| **TaskApproval** | **Create — this is the one genuine gap.** Today an APPROVAL node is just `workflowNodeType: "APPROVAL"` + a `workflowDecision` string. There is no `requestedBy`, `approver`, `requestedAt`, `respondedAt`, `decision` or `notes`, so Phase 10's approval requirements and Phase 14's "approval blocking" cannot be built or tested. Recommend an embedded `Task.approval` subdocument rather than a collection — one approval per node, no cross-task queries needed, and it stays inside the existing single-source-of-truth Task. |
| **TaskImportJob** | **Exists as `ImportJob`, keep.** Scoped `parentTaskId`; SHA-256 `fileHash` for idempotency; `status: previewed→validated→imported/failed`; per-row `issues[]`; `createdSubtaskIds` / `createdDependencyIds` for rollback; caps at 5 MB / 1000 rows; rejects `=`/`+`/`-`/`@` formula-injection in text fields; executes inside a transaction. Genuinely solid. |
| **WorkflowVersion** | **Do not create.** Phase 13 says to build it only if justified. Vega has one internal PM audience, immediate-save semantics throughout, and a Publish button would be cosmetic — the phase prompt itself forbids faking it. **Recommend dropping Phase 13 and removing any Publish affordance from the Workflow Builder header.** Revisit only if PMs ask for reviewable draft workflows. |

---

## 5. API surface — existing contracts

All responses are `{success, data}` / `{success, error}`. All require a session via `getActorContext()`.

### 5.1 Root tasks
| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/api/tasks?status=&assignedToUserId=&all=1` | session | `parentTaskId: null` only; non-managers silently narrowed to own tasks; limit 500 |
| `POST` | `/api/tasks` | session; `assignTasksToOthers` to assign out | **still writes legacy `subTasks[]`** |
| `PATCH` | `/api/tasks/[id]` | assignee/creator or manager | legacy lowercase statuses only |
| `DELETE` | `/api/tasks/[id]` | assignee/creator or manager | hard delete + `deleteMany({parentTaskId})`; **orphans `TaskDependency` rows, `ImportJob.createdSubtaskIds`, and `Notification` rows** |
| `GET` | `/api/tasks/analytics` | session | `taskAnalyticsFiltersSchema` |
| `GET` | `/api/tasks/[id]/activity` | session | |
| `POST` | `/api/tasks/[id]/ai-assistant` | session | OpenAI-backed, see §6.4 |
| `POST` | `/api/tasks/workflow-notifications/sweep` | ≥ `project_manager` | due/overdue sweep |

### 5.2 Subtasks — `/api/tasks/[id]/subtasks`
| Method | Path | Notes |
|---|---|---|
| `GET` | `/` | filters `status`, `priority`, `assignedToUserId`, `q`; returns each subtask with `blockedBy[]` / `blocking[]` |
| `POST` | `/` | `createAdvancedSubtaskSchema`; generates `code`; `syncParentTaskProgress`; `notifySubtaskCreated` |
| `GET/PATCH/DELETE` | `/[subtaskId]` | |
| `POST` | `/[subtaskId]/duplicate` | |
| `PATCH` | `/[subtaskId]/reschedule` | `shiftDependents` flag |
| `PATCH` | `/bulk` | ≤1000 ids, `updateAdvancedSubtaskSchema` minus comments |
| `PATCH` | `/bulk-assign` | ≤1000 ids |
| `PATCH` | `/reorder` | ≤1000 `{id, order}` |
| `GET/POST` | `/dependencies` | `createSubtaskDependencySchema` |
| `DELETE` | `/dependencies/[dependencyId]` | |
| `GET` | `/execution` | `getWorkflowExecutionSummary` |
| `PATCH` | `/workflow-layout` | `updateWorkflowLayoutSchema`; bulkWrite positions + root `workflowStages` |
| `POST` | `/import` | upload + parse + preview |
| `POST` | `/import/validate` | mapping + row validation |
| `POST` | `/import/execute` | transactional |
| `GET` | `/import/template` | XLSX template download |

### 5.3 Templates — `/api/task-workflow-templates`
`GET/POST /`, `GET/PATCH /[templateId]`, `POST /[templateId]/apply|duplicate|archive`, `POST /from-task`. Managed by `admin / partner / project_manager`.

### 5.4 Gaps to fill
- No `POST /api/tasks/[id]/duplicate` (root level) — only subtask duplication.
- No archive semantics anywhere; `DELETE` is a hard delete. Phase 2/3 both say "archive" — that concept does not exist.
- No bulk operations on **root** tasks (Phase 2's bulk toolbar).
- No attachment upload endpoint (§1.5).
- No `code` generation for root tasks (§1.4).

### 5.5 Existing indexes
```
Task:            status, dueAt, assignedToUserId, code (unique sparse), leadId, clientId,
                 projectId, parentTaskId, rootTaskId, kpiId, priority, startAt, order,
                 workflowNodeType, importJobId, importFingerprint
                 { parentTaskId, order, createdAt }
                 { parentTaskId, status, priority }
                 { projectId, parentTaskId }
                 { parentTaskId, importFingerprint } unique partial
TaskDependency:  parentTaskId, predecessorSubtaskId, successorSubtaskId, dependencyType
                 { predecessorSubtaskId, successorSubtaskId, dependencyType } unique
                 { successorSubtaskId, createdAt }
                 { parentTaskId, predecessorSubtaskId }
                 { parentTaskId, successorSubtaskId }
ImportJob:       parentTaskId, fileType, fileHash, status, createdBy
                 { parentTaskId, createdAt: -1 }, { parentTaskId, fileHash }
Notification:    recipientUserId, actorId, type, entityType, entityId, subtaskId, readAt, dedupeKey
                 { recipientUserId, dedupeKey } unique partial
                 { recipientUserId, readAt, createdAt: -1 }
ActivityLog:     action, actorId, entityType, entityId, { createdAt: -1 }
```

### 5.6 Recommended additional indexes
```
Task:        { assignedToUserId: 1, status: 1, dueAt: 1 }   // "My Tasks" / Overdue views (Phase 2 KPI cards)
             { parentTaskId: 1, workflowNodeType: 1 }        // canvas node-type filtering
             { rootTaskId: 1, order: 1 }                     // only if nesting beyond 2 levels is ever enabled
ActivityLog: { entityType: 1, entityId: 1, createdAt: -1 }   // the Activity tab currently has no compound index
             (add before Phase 3 ships — this query runs on every workspace load)
Task:        { projectId: 1, status: 1, dueAt: 1 }           // P2 only, for the Project Tasks tab
```

---

## 6. Risks and open questions

**CRITICAL**
1. `design.md` does not exist. No phase can comply with its own first instruction. (§0.1)
2. The Project module is deleted. Phases 11 and 12 have nothing to build on, and `Task.projectId`'s `ref: "Project"` is a runtime landmine for any future `.populate()`. (§0.2, §1.6)
3. All of this work is uncommitted, on top of a pristine `4c919d5`, in a OneDrive folder. One bad sync and it is gone. (§0.3)

**HIGH**
4. Two live subtask representations (`Task.subTasks[]` vs child Tasks) — data created via `/tasks` is invisible to the Workspace, dependency engine and canvas. (§1.3)
5. Split status enums mean `syncParentTaskProgress` reports 0% for any parent whose children use legacy statuses. (§1.2)
6. `DELETE /api/tasks/[id]` orphans `TaskDependency`, `Notification` and `ImportJob` references. (§5.1)
7. No test infrastructure at all; Phase 14 as written is unexecutable. (§0.5)
8. Files/attachments have a schema but no upload path or storage adapter. (§1.5)

**MEDIUM**
9. Task code generation is racy and has no root-task generator. (§1.4)
10. `PATCH /workflow-layout` fires `notifyWorkflowChanged` on **every** node drag-save — Phase 8 explicitly says canvas position changes should not generate noise. Should be silent, or debounced to a single event per session.
11. Three components at 45–79 KB with no extracted primitives. Any further feature work makes them worse. (§3.6)
12. Transactions require a replica set; single-node local Mongo silently fails import and template-apply.
13. `getActorContext({allowHeaderFallback:true})` is an auth bypass if ever enabled on a task route. (§3.1)
14. `lib/tasks/ai-assistant.ts` calls `api.openai.com` (`OPENAI_API_KEY`, default model `gpt-5-mini`) and is surfaced as an "AI Assistant" tab in the Workspace. It proposes subtasks, dependencies and workflows. It is **not** used for progress calculation, so it does not violate the Phase 9 rule — but it is an undocumented external dependency and cost centre that no phase in the plan accounts for, and its output writes into real task data.

**Decisions needed before Phase 1 begins**
- **D1.** Where is `design.md`, or do I generate it from `globals.css` + the shell components?
- **D2.** Option P1 (Task-rooted, drop Phases 11–12 as written) or Option P2 (restore Project as a thin container, strip `Project.tasks[]`, migrate)?
- **D3.** Confirm the plan is re-baselined against what already exists rather than rebuilt — otherwise Phases 1–7 will duplicate ~250 KB of working code.
- **D4.** Accept the two amendments recommended above: no separate WorkflowLayout model (§4.3), and drop Phase 13 versioning (§4.3).

---

*Phase 0 complete. Stopping here as instructed — Phase 1 not started.*

---

## 7. Decisions taken — 2026-08-31

- **D1 RESOLVED.** `design.md` did not exist and has now been written at the repo root, derived from `globals.css` + the shell and `ui/` components rather than from a mockup. It is normative from here. It also records two things the audit found: the eight divergent `statusVariant`/`statusTone` copies (canonical mapping now defined in design.md §2), and the fact that `src/components/ui/` has no table/drawer/tabs/dropdown/modal primitive to reuse (§5.5).
- **D2 RESOLVED — Option P2.** Project is restored as a *thin container*: title, description, status, clientId, leadId, scopeManifestId, team, dates. `Project.tasks[]` is **not** restored — that embedded array is the second task system the invariant forbids. Dependency, workflow-layout and stage scoping moves from `parentTaskId` to `projectId`. Existing production `Project.tasks[]` rows need a migration into child Task documents, folded into the same migration as the `Task.subTasks[]` work in §1.3.
- **D4 ACCEPTED.** No separate WorkflowLayout model (layout stays on the Task — §4.3). Phase 13 versioning dropped; no Publish affordance in the Workflow Builder header.
- **D3 outstanding** — plan re-baselining against the ~250 KB of existing working-tree code, to be confirmed before Phase 1 implementation starts.
