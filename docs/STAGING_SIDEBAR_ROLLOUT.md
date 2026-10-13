# Bot Studio — Staging sidebar rollout

- Target: Cloudflare Worker `bot-studio-staging` only.
- Git branch: `feat/unified-collapsible-sidebar-20261013`.
- Source PR: https://github.com/CreativeDesignUz/bot-studio/pull/17
- Baseline Staging Worker version before rollout: `59942813-e06c-48a2-817f-c2ee7b864496` (deployment 2026-10-12).
- Cloudflare Workers Builds deploy command: `npx wrangler deploy --config dist/server/wrangler.json --name bot-studio-staging --strict --keep-vars`.
- Never deploy to `bot-studio` Production.
- Verify after rollout: login page, Google OAuth browser E2E, Telegram OAuth browser E2E, persisted session after refresh, profile POST logout, all seven nav items, catalog create/list/categories, bot selector, 272px/76px desktop sidebar, mobile drawer, inaccessible other owner's bot IDs.
- CI tests alone do not prove auth works. Block production until human-verified E2E.
- Revert if critical regression occurs: use Cloudflare Worker Deployments API to set previous version `59942813-e06c-48a2-817f-c2ee7b864496` to 100%; verify immediately.
