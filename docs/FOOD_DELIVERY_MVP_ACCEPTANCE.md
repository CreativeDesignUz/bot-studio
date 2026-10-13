# Bot Studio: Food Delivery MVP - architecture and acceptance (2026-10-11)

Source: Bot_Constructor_TZ_MVP.docx, version 4.0, user Figma, and current branch source inspection.
Scope: ONE vertical: delivery food. Work branch fix/task-02a-security-stability, no production DB, hosting or webhook change.

## Rules
- Seller workspace, Telegram chat, and buyer Mini App are separate products and permissions.
- Draft is not Published. Changes to themes, content and copy visible only after explicit publish. Versioned snapshot and atomic pointer to the active publication.
- Every bot, item, category, order and webhook is tenant-scoped. RLS plus explicit API ownership checks; cross-bot references forbidden.
- Client is display-only for prices. Backend recomputes UZS integer-minor-unit prices, modifier prices, availability, fee and discount.
- Secrets live server-side, signing/replay protection for Telegram and payment webhooks, idempotency for checkout and onboarding.
- Testbase only. Never merge main, deploy Cloudflare, migrate production or reassign live Telegram webhooks without explicit consent.
- React/TypeScript/Next/Vinext backend with Supabase PostgreSQL; no unnecessary second Java backend.
- Demo items and mock analytics must never masquerade as actual restaurant orders.
- Buyer preview is clickable and must never create real orders or initiate payment.

## P0 blockers (current repository inspection; not runtime E2E verification)
1. Mini App client fetch has no timeout/retry; indefinite loading possible. Add abort, explicit error and retry.
2. Buyer endpoint needs active+published bot, plus three sequential database queries; measure latency, optimize safely.
3. Theme is served from current bot.settings.miniapp_design, not published_snapshot. Unpublished edits may appear to buyer: violates requirement.
4. Complete Telegram bot /start and menu button to correct buyer URL must be verified on an actual phone using testbase.
5. Ownership and tenant boundary tests are necessary even with server-side Supabase service role.
6. Real Click/Payme payment verification and callbacks are not demonstrated in the inspected code paths. No launch with actual payments until implemented and tested.
7. Delivery zones, delivery fee, address verification, branch and order state transitions need end-to-end proof.

## P1 product gaps
8. Restaurant menu editor uses local initialCategories and initialDishes rather than persisted per-bot backend data.
9. Food 01 and Food 02 editor theme settings exist; preview is only a stylized summary, not clickable Figma-accurate storefront.
10. Food demo-seed refuses to insert into existing menus; photos are example Unsplash URLs and must be product-correct.
11. Seller workspace has demoBots/mock data alongside actual stats; no unlabelled mock data in live dashboard.
12. No proven persisted food modifiers, availability schedules and category reorder end-to-end.

## Verified improvements superseding older audit
- Project Telegram runtime uses /miniapp not /workspace, secret-token header and claim_telegram_update replay protection.
- Onboarding uses save_bot_onboarding RPC with requestKey, requiring DB-side integration validation.
- Publish pipeline uses prepare_bot_publication and runTelegramPublication; verify failures/retry behavior in running environment.
- CI includes TypeScript, ESLint, automated tests and production build.
- Theme settings API stores per-bot config in Supabase settings, subject to publication-version fix.

## Acceptance checklist
[ ] Google / Telegram login works with recoverable seller identity and proper expiry.
[ ] BotFather connects bot and rejects invalid/duplicate tokens.
[ ] Create food bot without mandatory first dish, safe retry without duplicates.
[ ] Editor maintains independent Telegram welcome and Mini App hero, revisioned draft/save/publish.
[ ] Category/dish CRUD with variants, modifiers, options, stock, photo upload, visibility and reorder.
[ ] Color, dark mode, Food 01/02, banner, tabbar and Figma fidelity tested.
[ ] Real Telegram customer opens Mini App quickly; timeout, offline and error states work.
[ ] Search, detail, cart quantities, price changes, stock and duplicate clicks handled.
[ ] Delivery/pickup, address/geo, zone/fee, location/branch, closed restaurant supported.
[ ] Server recalculates totals and checkout is idempotent.
[ ] Click and Payme payment attempts verified by signed server callbacks; refund and duplicate webhooks.
[ ] Seller accepts/prepares/delivers with permitted order transitions and audit history.
[ ] Customer sees progress and receives reliable notification.
[ ] Cross-tenant denial; CSRF/origin; secrets and service role protected; rate-limits and retries.
[ ] Automated TS/lint/tests/build and mobile buyer+seller end-to-end test with testbase.
[ ] Source of truth and operational runbook/metrics for error rates, loading latency and webhook lag.

## Work order
TASK F-00 runtime diagnostics and Mini App loading/retry.
TASK F-01 security + tenant isolation + publication snapshot correctness.
TASK F-02 publish/connect + real Telegram e2e.
TASK F-03 persistent restaurant data model/menu and edit flows.
TASK F-04 Figma-matched buyer UI and interactive no-write preview.
TASK F-05 order/checkout, delivery zones and status machine.
TASK F-06 real payments/notifications/refunds and resilience.
TASK F-07 end-to-end acceptance, operational readiness and later hosting decision.

Per-task done: source change; DB migrations only on testbase and after explicit permission; user-facing states; negative tests; green CI; test evidence; known risks.

This is a source-level audit, NOT a claim that production or running Telegram is verified.

## Explicit user confirmation (2026-10-11): maps and operator-controlled payment gateway are mandatory

### Customer map / delivery zones
- Buyer Mini App: geolocation permission, address autocomplete/search via licensed geocoder, map pin drag/select, map confirmation, house/entrance/floor/apartment/comment.
- Restaurant operator: location/branch CRUD, working hours, service polygons/radii, delivery minimum amount, fee and estimated time; pickup selection.
- Backend: validated zone membership and pricing quote before checkout, persisted geocoordinates, fail closed outside coverage, do not trust client fee or coordinates alone.
- Maps: MapLibre-compatible UI; choose licensed tiles/geocoding/routing provider with production quotas, key proxying, attribution, and offline/error states. Do not assume public OSM tiles are unlimited.

### Operator-controlled payment gateway (platform level)
- Bot Studio PLATFORM OPERATOR manages provider connections, credentials, configuration, provider availability, and routing centrally. Individual restaurant managers must not see platform secrets.
- Customer chooses Click or Payme in Mini App where enabled; server creates provider payment attempt for its order; signed callback verifies final status and updates payment/order atomically with idempotency.
- Operator administration: ledger/transaction search, reconciliation, provider failures, payment disputes/refunds, payout accounting, platform fee policy, audit and restricted RBAC.
- Crucial settlement decision: operator-managed integration is not the same as operator acting as merchant of record. Determine contractual merchant account, settlement destination, aggregation/split payouts, commissions and legally authorized refunds with the provider before accepting real money; do not assume blanket merchant-of-record permissions.
- Keep provider credentials server-side and separate TESTBASE sandbox from future production. Orders always store merchant/restaurant IDs, amounts, currency, payment attempts and fee breakdown for audit.
- Cash-on-delivery/pickup can exist as an explicit allowed method with proper order/payment state, but must not be represented as successful online payment.

Acceptance: real location outside delivery area cannot checkout as delivery; operator can disable provider; duplicate provider callback never double-credits; cancellation and refund are audited; restaurant sees its own order/payment status but not platform credentials nor another restaurant transactions.

## MVP payment product decision (2026-10-11; overrides earlier proposed platform payout ledger)

The restaurant decides whether to accept online payment. The owner-facing setup asks **«Включить онлайн-оплату?»** (no by default), then shows available payment methods e.g. Payme, Click, Uzum **only where an integration is actually supported and configured**. A selected provider must not appear as active merely because its checkbox is ticked.

The Bot Studio operator/admin manages which gateways are supported, provider integrations/credentials and enabling/disabling them for restaurant accounts. Settlement to the individual restaurant bank account and legal onboarding/KYC are handled by the operator/provider and restaurant under their own agreements. Bot Studio must NOT promise or build automatic custody, splitting or payout of customer funds as part of MVP. The system stores only the references/statuses required for order processing, refunds and audit, not a platform wallet.

Restaurant flow: Payments settings > toggle online payments > choose available providers > configure/verify merchant account (with operator assistance as required) > show connected / pending / unavailable statuses > Save draft > Publish. Customer sees only enabled AND successfully connected payment options in the published storefront, plus cash-on-delivery if explicitly enabled. If no online provider connected, online payment is unavailable, not simulated as successful.

Provider API: adapter interface per integration (Click/Payme first as actual implementations permit, Uzum when verified); create attempt, verify callback server-side, idempotent update, reconcile failed/pending state. Avoid assuming Uzum payment API/merchant setup without verification. Refunds must respect supported provider and authority, not imply platform can withdraw or redistribute merchant funds.

MVP acceptance:
- Seller may keep online payments OFF and receive pay-on-delivery orders if configured.
- Seller cannot enable a provider which the operator has not configured/approved.
- An enabled provider in draft is invisible until publish; live storefront displays only actually available methods.
- Callback signature and idempotency validated; double callback cannot double-apply payment; no secret leaked.
- Operator cannot automatically redirect funds from one restaurant to another via Bot Studio.
