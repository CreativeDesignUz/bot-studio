# Bot Studio: Architecture issue register

Updated 2026-10-11. This is source-based analysis; changes are in draft PR #3, not deployed.

## Required protocol
1. Record architecture issue ID, exact files, observed symptom, root cause, data-flow boundary and customer risk **before fixing**.
2. State invariant, proposed architectural correction, migration/rollback compatibility and tests.
3. Implement on isolated branch, add regression coverage. Never edit previously applied migrations; add a new numbered migration.
4. Verify TypeScript/lint/tests/build, isolated DB integration and complete admin → publish → Mini App → order E2E.
5. Update [QA log](QA_ISSUE_LOG.md) with commit/PR, staging proof and release status. CI pass alone does not mean E2E verified.

## ARCH-001 — Draft catalog leaked into published Mini App [P0]
- **Files:** `app/api/miniapp/route.ts` GET, `app/api/catalog/route.ts`, `supabase/migrations/202610090006_security_stability.sql`, `supabase/migrations/202610100008_telegram_connection_idempotency.sql`.
- **Cause:** published_snapshot originally stored bot theme/profile, but buyer catalog and checkout read mutable `catalog_items` and `catalog_categories`. Draft edits could leak and prices diverge.
- **Invariant:** buyer GET/checkout use only last published catalog, including stable names and prices. Publish moves catalog+theme together.
- **Fix prepared:** new, unapplied `supabase/migrations/202610100009_published_catalog_snapshot.sql` captures items/categories within atomic publication attempt; buyer GET reads that snapshot; checkout uses published data. Hidden categories' items are filtered. Previous published stores bootstrap from their current catalog, since historical versions did not exist.
- **Release dependency:** migrate staging database BEFORE deploying buyer API, or it returns 503 for unsnapshotted stores. Test draft edits, category visibility, publish, price and order lines. No production migration applied.
- **Risk:** concurrency around publication, historic checkout behavior, snapshot size and SQL migration compatibility require live staging verification.
- **Status:** code patch prepared; SQL/staging E2E NOT verified.

## ARCH-002 — Idempotency key not bound to cart payload [P1]
- **File:** checkout RPC from migration 0008.
- **Cause:** same requestKey could return previous order even if the user changed cart or address.
- **Invariant:** exact same payload + key replays one order; changed payload + reused key is rejected.
- **Fix prepared:** migration 0009 adds `request_payload_hash` and collision checks on regular and unique-conflict replay paths.
- **Status:** patch prepared; parallel request tests and migration verification outstanding.

## ARCH-003 — Delivery is not backed by zones and calculated fees [P1]
- **Files:** `app/miniapp/page.tsx`, `app/api/miniapp/route.ts`, checkout RPC; admin delivery settings.
- **Cause:** checkout accepts a free-form address and persists `delivery_minor=0`; no spatial boundary validation or authoritative quote.
- **Invariant:** user sees price and eligibility before placing delivery order; server recomputes/validates coordinates, zone and fee; outside-zone order is rejected.
- **Fix design:** versioned owner-managed geozones, map location picker, server-side quote/validation, published delivery config, stable order total.
- **Status:** OPEN. Track [Issue #4](https://github.com/CreativeDesignUz/bot-studio/issues/4). Do not claim map/fees work or silently impose new charges.

## ARCH-004 — No true cross-app E2E test harness [P1]
- **Cause:** current CI checks static source, TypeScript, ESLint, unit tests and build but does not execute tenant-separated Supabase and real Telegram workflows.
- **Fix design:** isolated staging DB with two owners, Playwright authenticated browser/admin+Mini App flow, trace/screenshots, checkout idempotency and tenant tests, browser Telegram WebApp mocks and separate real-device tests.
- **Status:** OPEN. Track [Issue #5](https://github.com/CreativeDesignUz/bot-studio/issues/5). CI SUCCESS is not E2E SUCCESS.

## ARCH-005 — Platform chrome and mobile settings navigation [P2]
- **Cause:** synthetic Telegram top header in Mini App and unavailable mobile admin appearance navigation.
- **Fix in branch:** remove synthetic native header, make appearance available in mobile admin navigation; retain Telegram theme APIs.
- **Status:** code prepared, safe-area/bottom-sheet/fullscreen validation outstanding.

## Exit criteria
Release requires green CI, staging migration verified, E2E owner → publish → buyer → order, tenant isolation and documented production rollout. Do not merge or deploy without explicit approval.
