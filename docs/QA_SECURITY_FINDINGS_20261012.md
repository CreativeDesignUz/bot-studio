# QA security findings — 2026-10-12

Source: GitHub Actions workflow run 38220332821, `npm audit --audit-level=high --omit=dev`.

## Release blocking
- **Critical:** `next@16.3.4` (audit advisory affected range: 16.0.0–16.3.7). Includes an RCE advisory for next/og ImageResponse. Verify actual exposure but do not waive.
- **High:** `sharp <0.35.5`, reported vulnerability in librsvg dependency.
- **High:** `source-map-js 1.0.0–1.2.1`, event-loop DoS advisory.
- **Moderate:** `fast-uri 3.0.0–3.1.7` and `baseline-browser-mapping 2.0.0–2.10.x`.

## Required resolution
1. Update dependencies **and lockfile together** in a tested branch (Next.js >=16.4.0 subject to upstream compatibility check; sharp >=0.35.5; correct transitive packages).
2. Avoid `npm audit fix --force` without reviewing breaking changes, particularly vinext compatibility.
3. Repeat npm ci, typecheck, lint, automated tests, production build, audit; require all green.
4. Verify whether Next.js runtime vulnerabilities apply to the deployed vinext/Cloudflare path; record evidence rather than assuming safe.
5. Require integration QA against staging before merging/deploying.

## Other open risk
- Buyer bot still sends customers to seller /workspace (release blocking).
- Buyer storefront/cart absent in inspected repository.
- Checkout SQL RPC migration not yet deployed or exercised against staging.
- Skipped E2E test is explicitly **not** an acceptance pass.

QA must report failure until vulnerabilities and integration blockers are resolved.
