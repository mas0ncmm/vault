# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vault is a personal Vinted/reselling tracker app: a Next.js 14 (App Router) PWA with four features —
a stock tracker with profit/margin/ROI math, an AI listing generator, an AI "should I buy this to
resell" opportunity checker, and analytics. There is no backend database: all inventory data lives in
the browser's IndexedDB. The only server-side code is a single API route that proxies calls to the
Anthropic API so the API key never reaches the client.

## Commands

- `npm run dev` — start the Next.js dev server
- `npm run build` — production build (TypeScript build errors are ignored — see `next.config.mjs`)
- `npm run start` — run the production build

There is no lint script, no test suite, and no `tsconfig.json` in this repo. `app/page.tsx` is
TypeScript-in-name-only (JSX with no type annotations); don't assume type-checking will catch anything.

## Architecture

**Almost the entire app lives in one file: `app/page.tsx` (~2000 lines).** It is a single client
component (`"use client"`) that implements a hand-rolled router and every screen, with no external
state library, no CSS framework, and no component files outside this one. Before editing, `grep`/read
`app/page.tsx` for the section banner comments (`/* ==== ... ==== */`) — they divide it into:

- **Design tokens & helpers** (top of file) — the `T` color object, `display`/`body` font styles,
  money/date/JSON-extraction helpers (`gbp`, `pct`, `extractJson`, etc.). Reuse these instead of
  inlining new styles or formatting logic.
- **Storage layer** — a thin IndexedDB wrapper (`sGet`/`sSet`/`sDel` over a single `vault-db` object
  store) used as a generic key-value store. Items live under key `vault-items`, opportunity checks
  under `vault-checks`, and each item's photos are stored separately under `vault-imgs-<id>` (data
  URLs) so the main item list stays small. When adding a new persisted field, wire it through
  `blankItem()`, the relevant screen's form, and — if it should survive backup/restore — the
  export/import JSON shape in `SettingsScreen`.
- **`calc(item)`** — the single source of truth for derived financials (total purchase cost, total
  selling cost, profit, margin, ROI, days-to-sell, stock age). Every screen that shows money
  (Stock, Detail, Analytics) calls this rather than recomputing inline.
- **Shared UI primitives** — `Btn`, `Chip`, `Card`, `StatCard`, `Fi` (form field), `SectionBox`,
  `Banner`, `Empty`, `Spinner`, `ScreenHeader`, `PhotoGrid`. All styling is inline `style={{}}` objects
  built from the `T` token object — there is no Tailwind/CSS-in-JS library. Match this pattern rather
  than introducing a new styling approach.
- **Screens**, one function component each: `HomeScreen`, `StockScreen`, `DetailScreen`/`DetailInner`,
  `EditScreen`/`EditInner` (add/edit form), `GeneratorScreen`, `CheckerScreen`, `AnalyticsScreen`,
  `SettingsScreen`.
- **Shell/routing** — `AppShell` holds all app state (`items`, `checks`, current `screen`) and passes
  it down as props; `go({ name: "detail", id })`-style objects are the only "routing" — there is no
  Next.js file-based routing beyond the single `/` page. `BottomNav` and `go()` are how screens
  navigate. `VaultApp` (default export) wraps `AppShell` for the PWA viewport.

**AI integration** (`GeneratorScreen`, `CheckerScreen`, and the `askClaude`/`aiCallOnce` helpers in
`page.tsx`): the client builds a prompt (with `GEN_HONESTY` rules baked in to prevent the model from
inventing product claims), calls `POST /api/ai`, and expects a JSON object back which it parses with
`extractJson` (strips markdown fences, takes the outermost `{...}`). `askClaude` retries across
`AI_MODELS` (`claude-sonnet-5` then `claude-haiku-4-5-20251001`) with backoff, and degrades gracefully
(drops web search, drops to one photo) before surfacing an error. If you change the JSON contract the
AI is asked to return, update both the prompt string and the parsing/validation code right after it —
they're adjacent but not type-checked against each other.

`app/api/ai/route.js` is a stateless proxy to `https://api.anthropic.com/v1/messages`: it validates the
model against `ALLOWED_MODELS`, optionally gates on an `x-vault-pass` header matched against
`VAULT_PASSPHRASE`, caps `max_tokens` at 4000, and forwards `ANTHROPIC_API_KEY` server-side only. Keep
`ALLOWED_MODELS` here in sync with `AI_MODELS` in `page.tsx`.

## Conventions

- No component/module splitting: new screens or major features are expected to be added as new
  function components inside `app/page.tsx` alongside the existing ones, following the same
  banner-comment section style, rather than extracted into new files — that's a deliberate choice in
  this codebase's current state, not an oversight.
- All money is GBP; format with `gbp()`, not manual `£` string concatenation.
- Item `status` drives most business logic — see the `STATUSES`, `UNSOLD`, and `OWNED` arrays at the
  top of `page.tsx`. Adding a new status means updating all three plus `STATUS_COLOR`.
- The AI is explicitly instructed never to assert authenticity/condition/rarity claims it can't verify
  from the photos (`GEN_HONESTY` constant) — preserve this constraint if you touch the generator
  prompts.
- Required server env vars: `ANTHROPIC_API_KEY` (required for any AI feature to work) and
  `VAULT_PASSPHRASE` (optional; gates AI usage behind a passphrase set in the Settings screen).
