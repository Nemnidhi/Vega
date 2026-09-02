# Vega Design System

**Status:** Normative. This is the `design.md` every phase prompt refers to.
**Derived from:** the shipped implementation — `src/app/globals.css`, `src/components/dashboard/*`,
`src/components/ui/*` — not from a mockup. Where code and this document disagree, that is a bug in
one of them; fix it, don't fork it.
**Last reconciled with code:** 2026-08-31

Vega is an internal operations console, not a marketing surface. The design goal is **information
density with calm contrast**: many rows visible at once, thin borders, small type, one accent colour
used sparingly to mean "you are here" or "this is the primary action". Anything that reads as a
generic Bootstrap/shadcn dashboard — big padded cards, drop shadows, oversized headings, full-bleed
status colour — is wrong for Vega.

---

## 1. Colour tokens

All colours are CSS custom properties on `:root` in `src/app/globals.css` and exposed to Tailwind v4
through `@theme inline` as `vega-*` utilities (`bg-vega-surface-1`, `text-vega-text-muted`,
`border-vega-border`). **Never hard-code a hex value in a component.** The few that exist today
(`#0b141f` input fill, `#c4b5fd` accent text, `#7c3fe0` primary button fill, `#66dc91` success text)
are known debt — reuse the token where one exists.

### 1.1 Surfaces

| Token | Value | Use |
|---|---|---|
| `--vega-bg` | `#07111b` | page background |
| `--vega-bg-deep` | `#050d15` | recessed wells, canvas backdrop |
| `--vega-sidebar` | `#07101a` | left navigation |
| `--vega-topbar` | `#0a131d` | global command bar |
| `--vega-surface-1` | `#0d1620` | cards, panels, default raised surface |
| `--vega-surface-2` | `#111b26` | table headers, nested panels, badges |
| `--vega-surface-3` | `#15202c` | third-level nesting (use sparingly) |
| `--vega-surface-hover` | `#182432` | hover state on rows and nav items |
| `--vega-surface-selected` | `#19233a` | selected row / active subtle control |

Surfaces get *lighter* as they nest. Do not use shadows to express elevation — Vega expresses depth
with surface steps and borders. The one sanctioned shadow is on floating overlays (dropdowns,
popovers): `shadow-[0_16px_36px_rgba(0,0,0,0.35)]`.

### 1.2 Borders

| Token | Value | Use |
|---|---|---|
| `--vega-border-soft` | `#1c2936` | internal dividers, table row separators, shell edges |
| `--vega-border` | `#243241` | default component border (cards, inputs, buttons) |
| `--vega-border-strong` | `#344457` | emphasis, focus-adjacent, draggable handles |

Borders are always `1px`. The global `* { border-color: var(--color-border) }` rule means any
`border` utility without an explicit colour already lands on `--vega-border`.

### 1.3 Text

| Token | Value | Use |
|---|---|---|
| `--vega-text` | `#f1f5f9` | primary content, table cell values, headings |
| `--vega-text-secondary` | `#c3cdd8` | body copy, inactive nav labels, button labels |
| `--vega-text-muted` | `#8996a6` | labels, column headers, metadata, placeholders |
| `--vega-text-dim` | `#657385` | decorative only — nav index numbers, disabled hints |

Four steps, used in that order of prominence. A screen that needs a fifth is over-nested.

### 1.4 Accent

`--vega-purple` `#8b5cf6` is Vega's only accent. It means **active navigation, primary action, or
current selection** — nothing else. Do not use it to decorate.

| Token | Value | Use |
|---|---|---|
| `--vega-purple` | `#8b5cf6` | icons in active nav, active tab underline, primary border |
| `--vega-purple-hover` | `#956af7` | primary button hover |
| `--vega-purple-soft` | `rgba(139,92,246,0.14)` | active nav fill, subtle button fill, accent badge |
| `--vega-purple-border` | `rgba(139,92,246,0.46)` | border on any accented surface |
| `#c4b5fd` | — | text on an accented surface (no token yet; should get one) |

Focus rings are purple at low alpha: `focus-visible:ring-2 ring-vega-purple/20` on inputs,
`ring-vega-purple/40` on buttons, with the border shifting to `border-vega-purple/65`. Selection is
`::selection { background: rgba(139,92,246,0.3) }`.

### 1.5 Semantic colours

Each has a `-soft` companion at ~12–13% alpha for fills.

| Token | Value | Meaning |
|---|---|---|
| `--vega-blue` | `#3b82f6` | in progress, active work |
| `--vega-green` | `#22c55e` | completed, healthy, ready |
| `--vega-yellow` | `#eab308` | review, waiting, needs attention |
| `--vega-orange` | `#f97316` | high priority, degraded |
| `--vega-red` | `#ef4444` | blocked, overdue, cancelled, destructive |
| `--vega-cyan` | `#22d3ee` | informational / secondary series |

The standard pattern for a semantic chip is **soft fill + 25–35% border + full-strength text**:
`bg-vega-red/10 border border-vega-red/25 text-vega-red`. Never fill a large element with a
semantic colour at full strength — status is communicated by border, chip and icon, not by flooding
the surface. This applies especially to workflow nodes and table rows.

---

## 2. Status and priority mapping — canonical

> **Implemented in `src/lib/tasks/tone.ts`.** Import `statusTone`, `priorityTone`, `progressTone`,
> `dueLabel` and `humanize` from there; do not write another local mapping. This was previously
> reimplemented across eight files with results that disagreed — `IN_PROGRESS` rendered purple in
> the task detail tabs and blue on the canvas, `HIGH` priority yellow in one place and orange in
> another. The table below is the canonical mapping and is locked by assertions in
> `npm run test:task-foundation`. The remaining local copies in the leads, queries, blueprint,
> attendance and client-portal components still need folding in.

### 2.1 Task status

| Status | Colour | Badge variant |
|---|---|---|
| `NOT_STARTED` (legacy `todo`) | neutral surface-2 | `neutral` |
| `READY` | green | `success` (outline weight) |
| `IN_PROGRESS` (legacy `in_progress`) | **blue** | blue chip |
| `WAITING` | yellow | `warning` |
| `BLOCKED` | red | `danger` |
| `REVIEW` | yellow | `warning` |
| `CLIENT_REVIEW` | cyan | cyan chip |
| `COMPLETED` (legacy `done`) | green | `success` |
| `CANCELLED` | red, de-emphasised | `danger` |

Blue is reserved for *in progress*; green for *ready and completed*. `READY` and `COMPLETED` are
distinguished by fill weight (ready = border only, completed = soft fill), not by hue.

### 2.2 Priority

| Priority | Colour |
|---|---|
| `URGENT` | red |
| `HIGH` | **orange** |
| `MEDIUM` | purple soft |
| `LOW` | neutral muted |

### 2.3 Execution state (Workflow Execution Mode)

Expressed as **node border + optional ring**, never as node fill:

| State | Treatment |
|---|---|
| `completed` | `border-vega-green/60 bg-vega-green/5` |
| `active` | `border-vega-blue bg-vega-blue/5` |
| `ready` | `border-vega-green/50 bg-vega-surface-1` |
| `blocked` | `border-vega-red bg-vega-red/5` |
| `overdue` | `border-vega-red bg-vega-surface-1 ring-2 ring-vega-red/20` |
| `waiting` | `border-vega-yellow bg-vega-yellow/5` |
| `upcoming` | `border-vega-border bg-vega-surface-1 opacity-80` |

---

## 3. Typography

| Role | Size / weight | Token |
|---|---|---|
| Product wordmark | `27px / 600 / leading-7` | sidebar only |
| Page title | `text-lg–xl / 600` | `--vega-text` |
| Section / card title | `text-sm / 600 / leading-5` | `--vega-text` |
| Body, table cells | `text-xs` | `--vega-text` |
| Secondary body | `text-xs / leading-5` | `--vega-text-secondary` |
| Metadata, labels | `text-[10px] / leading-4` | `--vega-text-muted` |
| Column headers | `text-[10px] uppercase tracking-[0.08em]` | `--vega-text-muted` |
| Badge text | `text-[10px] / 500` | per variant |
| Codes, IDs, counters | `font-mono text-[10px]` | `--vega-text-dim` |

Fonts: `--app-font-sans` = Geist → Inter → Segoe UI → system stack.
`--app-font-mono` = Cascadia Code → IBM Plex Mono → SF Mono → Menlo → Consolas.
Body sets `line-height: 1.45` and `font-feature-settings: "ss01" 1, "cv05" 1` globally.

**Task and subtask codes** (`TASK-2478`, `ST-2478-1`) always render in mono, at `text-[10px]`, in
`--vega-text-muted` or dimmer, on the line *below* the title. The title is the primary read; the
code is a reference.

---

## 4. Metrics — the numbers that define Vega's density

These are load-bearing. A screen that changes them stops looking like Vega.

| Element | Value | Source |
|---|---|---|
| Sidebar width | **218px** | `sidebar.tsx:58` `w-[218px]` |
| Top command bar height | **62px** | `top-nav.tsx:86` `min-h-[62px]` |
| Sidebar nav item height | 40px (`h-10`) | `sidebar.tsx` |
| Default control height | **34px** (`h-[34px]`) | `Button` md, `Input`, global `select` |
| Small control height | 32px (`h-8`) | `Button` sm |
| Large control height | 40px (`h-10`) | `Button` lg — rare, forms only |
| Icon button | 34 × 34px | `top-nav.tsx` |
| Badge height | **22px** (`h-[22px]`) | `badge.tsx` |
| Table row height | **~50–54px** (`px-3 py-3`) | subtask table |
| Compact table row | `px-3 py-2` | preview / error tables only |
| Card radius | **8px** (`rounded-lg`) | `card.tsx` |
| Control radius | 6px (`rounded-md`) | buttons, inputs, badges, nav |
| Select radius | 7px (`0.4375rem`) | global `select` |
| Card padding | 16px (`p-4`), header `p-4 pb-2` | `card.tsx` |
| Global search field | 410px, `max-w-[36vw]` | `top-nav.tsx` |
| Context drawer | **~400px** | Task Workspace |
| Workflow node library | ~200px | Workflow Builder |
| Workflow inspector | ~290px | Workflow Builder |
| Workflow node width | 155–175px default, 180–520px resizable | `Task.workflowWidth` |
| Transition | `150ms` controls, `160ms` links, `ease` | global |

Spacing uses the Tailwind scale; the common rhythm is `gap-2` / `gap-3` between controls,
`space-y-1` between nav items, `space-y-2` between stacked list rows, `gap-3` in card grids.

---

## 5. Components

### 5.1 Button — `src/components/ui/button.tsx`

Four variants. One primary action per view.

| Variant | Treatment | Use |
|---|---|---|
| `primary` | `#7c3fe0` fill, purple border, white text | the single main action (`+ Create Task`) |
| `secondary` | surface-1 fill, `--vega-border`, secondary text | everything else |
| `subtle` | purple-soft fill, purple border, `#c4b5fd` text | toggles, active filters, accent affordances |
| `danger` | surface-1 fill, red border, red text | destructive only |

All: `rounded-md font-medium`, `disabled:opacity-50 disabled:cursor-not-allowed`,
`focus-visible:ring-2`. Sizes `sm` 32px / `md` 34px / `lg` 40px.

### 5.2 Badge — `src/components/ui/badge.tsx`

22px, `rounded-md`, `px-2`, `text-[10px] font-medium`. Variants `neutral` / `success` / `warning` /
`danger` / `accent`, each as `border + /10 fill + coloured text`. Use §2 to pick.

### 5.3 Card — `src/components/ui/card.tsx`

`rounded-lg border border-vega-border bg-vega-surface-1`. No shadow. Slots: `CardHeader` (`p-4 pb-2`),
`CardTitle` (`text-sm font-semibold`), `CardDescription` (`text-xs text-vega-text-muted`),
`CardContent` (`p-4`), `CardFooter` (`p-4 pt-0`).

**Cards are containers, not decoration.** Do not wrap each field of an entity in its own card — a
task header is *one* bordered header with vertical separators between fields, not six cards.

### 5.4 Input / Textarea / Select

34px, `rounded-md`, fill `#0b141f` (darker than surface-1 — inputs recede, they don't raise),
`border-vega-border`, `text-xs`, placeholder at `--vega-text-muted/85`. Focus:
`border-vega-purple/65` + `ring-2 ring-vega-purple/20`. `select` is styled globally in
`globals.css`; there is no `Select` component.

### 5.5 Missing primitives — known gap

`src/components/ui/` contains only `badge`, `button`, `card`, `input`, `textarea`. There is **no
table, drawer, tabs, dropdown, select, modal, avatar, progress-bar, skeleton or empty-state
primitive.** Every one is currently hand-rolled inline inside three files of 45 KB, 49 KB and 79 KB.
Any phase instruction to "reuse the existing table/drawer/tabs component" has nothing to reuse.
Extracting these against the specs in §6 is real, currently unowned work and should be scheduled
before further feature work lands in those files.

---

## 6. Patterns

### 6.1 Tables

```
thead  bg-vega-surface-2, text-left, text-[10px] uppercase tracking-[0.08em] text-vega-text-muted
th     px-3 py-3
tr     border-t border-vega-border-soft, hover:bg-vega-surface-hover
tr[selected]  bg-vega-surface-selected
td     px-3 py-3, text-xs text-vega-text
```

`table { border-collapse: separate; border-spacing: 0 }` is set globally — rows are separated by
`border-t`, never by `border-collapse`. Wide tables scroll inside their own `overflow-x-auto`
container; the page body never scrolls horizontally.

**Entity cell** (Task / Subtask column): title in `text-xs text-vega-text` on line one, mono code in
`text-[10px] text-vega-text-muted` on line two. **Assignee cell**: avatar + name, `gap-2`.
**Progress cell**: a 5–6px bar, `rounded-sm`, track `bg-vega-surface-2`, fill `bg-vega-blue` (or the
semantic colour of the row's state), with the percentage as `text-[10px]` beside it — never a
pie or a ring.

### 6.2 Tabs

Underline style, not pills:

```
container  flex, border-b border-vega-border-soft, overflow-x-auto
tab        px-3 py-3 text-xs font-medium whitespace-nowrap
active     border-b-2 border-vega-purple text-[#c4b5fd]
inactive   text-vega-text-muted hover:text-vega-text-secondary
```

### 6.3 Dropdowns and popovers

`absolute`, `rounded-md`, `border-vega-border`, background `#0a141f` (darker than the surface it
floats over), `shadow-[0_16px_36px_rgba(0,0,0,0.35)]`, `z-50`. Header row:
`border-b border-vega-border-soft px-3 py-2`, `text-xs font-semibold`. Scroll body at `max-h-80`.

### 6.4 Right context drawer

~400px. **On wide screens it reduces the workspace width rather than covering it** — it is a pane,
not a modal, and the table behind it must stay usable. Below `lg` it becomes an overlay sheet.
Sections inside are compact and collapsible, separated by `border-vega-border-soft`, each with a
`text-[10px] uppercase tracking-[0.08em]` header.

### 6.5 Empty, loading and error states

**Empty:** operational one-liners in `text-xs text-vega-text-muted`, plus the primary action if one
applies. No illustrations, no large headings, no centred hero copy.

**Loading:** skeletons that match the shape of the real content — table rows at real row height, KPI
tiles at real tile size — using `bg-vega-surface-2` blocks with a subtle pulse. Never a centred
spinner for a whole page.

**Error:** inline, `rounded-md border border-vega-red/25 bg-vega-red/10 p-3 text-xs text-vega-red`.
Errors appear next to the thing that failed, not as a toast that disappears.

### 6.6 KPI / stat tiles

Compact bordered tiles in a responsive grid (`sm:grid-cols-2 lg:grid-cols-4` or `-6`). Label in
`text-[10px] uppercase text-vega-text-muted`, value in `text-lg–xl font-semibold text-vega-text`,
optional delta as a semantic chip. Tile height stays near a single card's `p-4` — these are a
summary strip, not the page's main content.

### 6.7 Workflow canvas

Dark dotted grid on `--vega-bg-deep`. Edges are **thin, muted (`--vega-border-strong`), arrow-headed,
smooth-step/orthogonal** — no glow, no neon, no animation by default. A blocked or invalid edge is
red. Node status is a chip and a border, never a full-node fill (§1.5, §2.3). Minimap, zoom controls
and the status legend sit at the bottom; mode toggle (`Design | Execution`) top-centre; layout
controls top-right.

---

## 7. Shell

```
┌──────────┬──────────────────────────────────────────────┐
│          │  Top command bar — 62px, --vega-topbar       │
│ Sidebar  ├──────────────────────────────────────────────┤
│  218px   │                                              │
│  --vega- │  main — --vega-bg                            │
│  sidebar │  px-3 / sm:px-5 / lg:px-[22px]               │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Sidebar** (`lg:` and up only; `sticky top-0`, `h-screen`, `border-r border-vega-border-soft`):
brand block (36px purple-soft "V" tile + wordmark + `Nemnidhi Command Center` at `text-[10px]`),
then nav items at `h-10` with an 18px `lucide-react` icon at `strokeWidth={1.8}`, a truncating
label, and a zero-padded mono index (`01`, `02`) on the right. Active =
`border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd]` with a purple icon; inactive =
transparent border, `hover:bg-vega-surface-hover`. Footer pins the user card and a Collapse control.

**Top bar** (`sticky top-0 z-40`): mobile brand tile, then the 410px global search field. Right side:
`Quick Create` (34px, ghost with purple hover), 34px icon buttons for Settings and Notifications
(unread count as a red pill at `text-[9px]`), then the user menu.

Below `lg` the sidebar is hidden and navigation moves into the top bar, which renders its own
collapsible menu (the Menu / Close control in `top-nav.tsx`).

---

## 8. Responsive

Tailwind defaults: `sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280.

- **`lg`+** — full shell. Drawers reduce content width. Tables show all columns.
- **`md`–`lg`** — sidebar hidden, mobile nav active. Top-bar search and Quick Create still visible.
  Tables drop low-priority columns (Dependencies, Progress) before they scroll.
- **`< md`** — top-bar controls collapse to the brand tile and a menu. Tables become stacked
  cards or scroll horizontally inside their own container. The right drawer becomes a full-width
  sheet. The workflow canvas is view-and-pan only; structural editing is a desktop capability.

Icons are `lucide-react` at `strokeWidth={1.8}`, 18px in navigation, 16px (`h-4 w-4`) inline.

---

## 9. Rules

1. Use tokens. No new hex values in components.
2. Purple means active, primary, or selected. Nothing else.
3. Semantic colour goes on borders, chips and icons — never as a large fill.
4. One primary button per view.
5. Depth comes from surface steps and borders, not shadows. Overlays are the sole exception.
6. Controls are 34px. Rows are ~50–54px. Cards are `rounded-lg`; controls are `rounded-md`.
7. Codes and IDs are mono, `text-[10px]`, muted, secondary to the title.
8. Don't wrap single fields in cards. One header, vertical separators.
9. Empty and error states are operational text, not illustrations.
10. Skeletons match the real content's shape.
11. The page body never scrolls horizontally; wide content scrolls inside its own container.
