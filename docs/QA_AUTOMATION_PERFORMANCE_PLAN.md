# Bot Studio — QA automation and speed plan

2026-10-11. Planning document. Do not treat unexecuted E2E scans as passing.

## 1. Safe staging environment
- Isolated Supabase database, test Telegram bot and 2 test owners; sample store and restaurant, test categories, inventory and orders.
- Apply SQL migrations 0009, 0010, 0011 and 0012 in order on staging; inspect each for rollback and permissions.
- Do not run destructive scans or synthetic orders against production.

## 2. QA Agent
- Playwright runs: create bot → edit catalog → set stock → publish → buyer sees published items → choose delivery pin inside/outside radius → check delivery fee → place order → verify seller order/address/coordinates/status and stock changes.
- Run same scenarios for delivery restaurant and online store. Test owner/tenant isolation, same requestKey replay, insufficient inventory, light/dark and mobile viewports.
- Collect traces, screenshots and test results in GitHub Actions. Create one Issue per unique defect with commit and exact test case; notify test Telegram chat after configured securely.
- Real native Telegram sheet and fullscreen on Android/iOS require separate device testing; browser simulation is not equivalent.

## 3. Free / open-source checking tools
- **Playwright**: browser E2E and visual regression; open source. https://playwright.dev/docs/ci
- **Google PageSpeed Insights / Lighthouse**: test publicly reachable pages on mobile and desktop. https://pagespeed.web.dev/
- **OWASP ZAP**: open-source passive security checks; active checks only on authorized staging. https://www.zaproxy.org/docs/automate/
- **npm audit / GitHub Dependabot**: dependency vulnerabilities; review false positives and updates before merging.
- **axe-core**: automated accessibility smoke checks, plus manual keyboard and contrast testing. https://github.com/dequelabs/axe-core
- Free software does not imply unlimited free cloud runner minutes or traffic. Store secrets only in GitHub Actions secrets.

## 4. Performance optimization, after correctness
- Establish measured baselines: mobile LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 on suitable real-user data; target key authenticated interactions and API p95 on staging, record baseline before choosing budgets.
- Minimize Mini App first-load JS, defer checkout map and noncritical imagery, size/compress product photos, avoid redundant API round trips.
- Check Supabase indexes for tenant-scoped catalog, order and stock queries; avoid N+1 order line queries and costly large snapshot serialization.
- Cache immutable product images and assets with appropriate headers; keep inventory, checkout pricing and owner-scoped order data uncached.
- Test on slow Android/Telegram connection, repeat light/dark and both templates.

## 5. Release gate
1. Green lint/types/unit/build.
2. SQL migrations executed on staging with rollback strategy and real DB integration tests, especially concurrent checkout.
3. Playwright owner-to-buyer cross-app scenarios passing for food AND store.
4. Screen-level visual QA in real Telegram.
5. Security/a11y/performance baseline with reproducible reports. All P0 issues resolved, P1 risk explicitly accepted or corrected.

Reference architecture: [ARCHITECTURE_ISSUES.md](ARCHITECTURE_ISSUES.md). Current issues: #4 and #5.
