# Bot Studio instructions for GitHub AI tools

Read and follow the repository root `AGENTS.md` before changing code.

Key constraints:

- Cloudflare Workers + Vinext is the supported runtime; do not rewrite code to satisfy Vercel.
- Use Supabase Staging ref `eslbcwopolrxoptcxqhp` for approved tests. Never change Production ref `xpylzfdwudtaceysfcwd` without explicit user approval.
- Never expose or commit secrets, Telegram tokens, cookies, `.env*`, `supabase/.temp/`, `.wrangler/`, or generated `dist/`.
- Preserve tenant isolation, seller/buyer separation, server-side authorization, Telegram initData verification, idempotency, and existing JSON settings.
- Do not add mocks to authenticated production flows and do not duplicate existing modules.
- Run `npm run check` before proposing a Pull Request. Do not merge or deploy production.
