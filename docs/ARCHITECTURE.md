# Bot Studio — module boundaries

This branch is a staged source-structure refactor. Public URLs, worker names, Supabase schemas and encrypted credential formats must **not** change.

## Layout
- `app/` — Next.js file-based routes and API adapters. Keep route URLs unchanged for existing customers and Telegram webhooks.
- `features/web/components/` — owner dashboard, catalog editor, order management, delivery settings and onboarding UI.
- `features/miniapp/components/` — buyer-facing mobile Telegram Mini App, map picker and interactive private live preview.
- `features/telegram/components/` — Telegram chat previews for the editor.
- `features/telegram/server/` — server-only Telegram credential selection (V1/V2 keys).
- `lib/auth/`, `lib/bots/`, `lib/channels/`, `lib/telegram/` — shared domain logic; migrate incrementally only with regression tests.
- `supabase/migrations/` — database migrations are immutable history and must not be deleted, renamed or squashed in this refactor.

## Rules
1. Admin UI and buyer UI are separate lazy-loaded feature modules; never import admin panels into buyer Mini App.
2. Backend routes must obtain Telegram bot tokens from `resolveTelegramChannelToken`; no route may manually choose an encryption key. Never log or cache decrypted tokens.
3. Authentication, ownership checks, price calculation, published catalog boundaries, and Mini App signature verification remain server-side.
4. Keep separate staging and production resources. No auto-deploy for this branch; merge only after full CI and test-user E2E.
5. Do not delete feature modules based on filenames. Verify import usage, tests and runtime paths before removal.
6. Prefer small domain components with typed props and accessible states. Reduce client bundle cost by loading heavy optional areas via `next/dynamic`.

## Verified cleanup
62 unused generic UI/connector presentation files were removed after checking imports in app, shared libraries, scripts and tests. This reduces maintenance and source clutter, but **does not by itself guarantee an improvement to runtime bundle size**.

## Outstanding work after CI
- Split large dashboard/editor/Mini App pages into smaller view components.
- Adopt consistent input, modal and button components across web screens; avoid reintroducing unused generic component catalogs.
- Profile JS chunk sizes and API p95 latency before claiming performance gains.
- Test a real dedicated QA Telegram bot with V2 credentials end-to-end: connect, publish, order, operator dashboard.
