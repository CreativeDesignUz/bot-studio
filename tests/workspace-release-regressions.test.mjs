import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const src=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const has=(p)=>existsSync(new URL("../"+p,import.meta.url));
test("global stylesheet does not override all button text colors",()=>{
 const css=src("app/globals.css");
 assert.doesNotMatch(css,/button\s*\{\s*color\s*:\s*inherit/);
});
test("all seller tools and APIs stay connected",()=>{
 for(const p of ["app/workspace/catalog-manager.tsx","app/workspace/order-manager.tsx","app/workspace/campaign-manager.tsx","app/workspace/miniapp-appearance.tsx","app/api/catalog/route.ts","app/api/campaigns/route.ts","app/api/orders/route.ts","app/api/miniapp/design/route.ts"])assert.ok(has(p),p);
 const page=src("app/workspace/page.tsx");
 assert.match(page,/<CatalogManager/);assert.match(page,/<OrderManager/);assert.match(page,/<CampaignManager/);
 assert.match(page,/onClick=\{addPrimaryItem\}/);
 assert.match(page,/startCreating=\{catalogCreateRequest>0\}/);
});
test("product image upload checks ownership, file type and size",()=>{
 const api=src("app/api/catalog/image-upload/route.ts");
 assert.match(api,/owner_id/);assert.match(api,/photo\.size>3\*1024\*1024/);assert.match(api,/new Uint8Array/);assert.match(api,/storage\.from\("bot-assets"\)/);
 assert.match(src("app/workspace/catalog-manager.tsx"),/\/api\/catalog\/image-upload/);
});
test("catalog accepts standard UUID bot and item identifiers",()=>{
 const catalog=src("app/api/catalog/route.ts");
 assert.match(catalog,/\(\?:\[0-9a-f\]\{4\}-\)\{3\}/);
});
test("publishing preserves settings and snapshots published prices",()=>{
 const draft=src("app/api/bots/draft/route.ts");
 const publish=src("app/api/publish/route.ts");
 assert.match(draft,/settings:\s*\{\s*\.\.\.settings,/);
 assert.match(publish,/const settings=\{\.\.\.currentSettings,home_buttons:buttons,/);
 assert.match(publish,/publish_status:"published"/);
 assert.match(publish,/published_snapshot:snapshot/);
 assert.match(src("app/api/miniapp/route.ts"),/published_snapshot/);
});
test("BotFather connection and Telegram runtime remain wired securely",()=>{
 const route=src("app/api/channels/telegram/token/route.ts");
 const runtime=src("app/api/channels/telegram/project-runtime/route.ts");
 const builder=src("app/workspace/builder/page.tsx");
 assert.match(route,/getTelegramBotIdentity\(token\)/);
 assert.match(route,/encryptTelegramToken\(token, encryptionKey\)/);
 assert.match(route,/stage_direct_telegram_credential/);
 assert.match(route,/complete_direct_telegram_connection/);
 assert.match(route,/\.eq\("owner_id", user\.id\)/);
 assert.match(runtime,/claim_telegram_update/);
 assert.match(runtime,/callback_query/);
 assert.match(builder,/action:"inspect"/);
 assert.match(builder,/action:"connect"/);
 assert.match(builder,/Опубликовать и открыть Mini App/);
});
test("buyer Mini App uses Telegram-verified checkout with coordinates",()=>{
 const buyer=src("app/miniapp/page.tsx");
 const checkout=src("app/api/checkout/route.ts");
 assert.match(buyer,/\/api\/checkout/);
 assert.match(buyer,/latitude:fulfillment/);
 assert.match(checkout,/verifyTelegramInitData\(body\.initData, token\)/);
 assert.match(checkout,/rpc\("create_miniapp_order"/);
 assert.match(checkout,/p_delivery_address/);
 assert.match(src("app/api/channels/telegram/project-runtime/route.ts"),/miniapp\?bot=/);
});
test("promotion checkout uses atomic server-side discount and scoped coupon",()=>{
 const api=src("app/api/campaigns/route.ts");
 const checkout=src("app/api/checkout/route.ts");
 const sql=src("supabase/migrations/202610120002_atomic_campaign_checkout.sql");
 const miniapp=src("app/miniapp/page.tsx");
 assert.match(api,/is_active:false/);
 assert.match(api,/if\(body\.isActive\)/);
 assert.match(checkout,/p_promo_code:/);
 assert.match(miniapp,/promoCode:promoCode\.trim\(\)\.toUpperCase\(\)/);
 assert.match(sql,/bot_id=p_bot_id and upper\(code\)=normalized_code and is_active=true/);
 assert.match(sql,/usage_count=usage_count\+1/);
 assert.match(sql,/discount_amount/);
 assert.match(sql,/p_request_key/);
 assert.match(sql,/to service_role/i);
 assert.match(sql,/unique index if not exists/i);
});
test("Google login supports code exchange using PKCE",()=>{
 assert.match(src("app/login/page.tsx"),/flowType:"pkce"/);
 assert.match(src("app/auth/callback/page.tsx"),/exchangeCodeForSession/);
});
