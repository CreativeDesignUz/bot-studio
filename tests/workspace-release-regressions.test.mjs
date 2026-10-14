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
 assert.match(page,/startCreating=\{view === "create" \|\| catalogCreateRequest>0\}/);
});
test("product image upload checks ownership, file type and size",()=>{
 const api=src("app/api/catalog/image-upload/route.ts");
 assert.match(api,/owner_id/);assert.match(api,/photo\.size>3\*1024\*1024/);assert.match(api,/new Uint8Array/);assert.match(api,/storage\.from\("bot-assets"\)/);
 assert.match(src("app/workspace/catalog-manager.tsx"),/\/api\/catalog\/image-upload/);
});
test("catalog editor remains usable on small screens and includes direct image upload",()=>{
 const catalog=src("app/workspace/catalog-manager.tsx");
 assert.match(catalog,/max-h-\[calc\(100dvh-1\.5rem\)\]/);
 assert.match(catalog,/overflow-y-auto/);
 assert.match(catalog,/accept="image\/jpeg,image\/png,image\/webp"/);
 assert.match(catalog,/Фото блюда/);
});
test("workspace exposes real bot and Mini App settings instead of decorative controls",()=>{
 const workspace=src("app/workspace/page.tsx");
 const builder=src("app/workspace/builder/page.tsx");
 const sidebar=src("app/workspace/workspace-sidebar.tsx");
 assert.match(sidebar,/aria-label="Выбрать бота"/);
 assert.match(sidebar,/href="\/onboarding"/);
 assert.match(workspace,/templateType=\{bot\.template_type\}/);
 assert.match(builder,/scrollToSection/);
 assert.match(builder,/aria-label="Разделы настроек бота"/);
 assert.doesNotMatch(builder,/xl:grid-cols-\\[250px_minmax/);
 assert.match(builder,/encryptionReady===false/);
 assert.match(builder,/section=miniapp_appearance/);
 assert.doesNotMatch(builder,/\["Основное","Меню","Кнопки","Доставка","Оплата","Уведомления"\]/);
});
test("critical bot settings links bypass broken Vinext client navigation",()=>{
 const sidebar=src("app/workspace/workspace-sidebar.tsx");
 const onboarding=src("app/onboarding/page.tsx");
 const builder=src("app/workspace/builder/page.tsx");
 assert.match(sidebar,/href=\{bot \? `\/workspace\/builder\?bot=/);
 assert.doesNotMatch(sidebar,/<Link href=\{.*\/workspace\/builder/);
 assert.match(onboarding,/<a className="flow-primary" href=\{botId\?`\/workspace\/builder\?bot=/);
 assert.match(builder,/<a href=\{`\/workspace\?bot=\$\{encodeURIComponent\(botId\)\}&section=miniapp_appearance`\}/);
});
test("seller can preview current Mini App draft without exposing it publicly",()=>{
 const api=src("app/api/miniapp/route.ts");
 const builder=src("app/workspace/builder/page.tsx");
 assert.match(api,/searchParams\.get\("preview"\)===\s*"1"/);
 assert.match(api,/resolveAppUser/);
 assert.match(api,/\.eq\("owner_id",identity\.user\.id\)/);
 assert.match(builder,/preview=1/);
 assert.match(src("app/miniapp/page.tsx"),/preview\?"&preview=1"/);
});
test("Mini App appearance supports every MVP business template and light-dark modes",()=>{
 const designApi=src("app/api/miniapp/design/route.ts");
 const appearance=src("app/workspace/miniapp-appearance.tsx");
 const buyer=src("app/miniapp/page.tsx");
 assert.doesNotMatch(designApi,/Food-темы доступны только/);
 assert.match(appearance,/templateType:TemplateType/);
 assert.match(appearance,/Светлая тема/);
 assert.match(appearance,/Тёмная тема/);
 assert.match(buyer,/const dark=themeMode===/);
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
test("onboarding never claims a draft item is already published",()=>{
 const onboarding=src("app/onboarding/page.tsx");
 assert.doesNotMatch(onboarding,/\{itemName\} опубликован/);
 assert.match(onboarding,/сохранён в каталоге/);
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
 assert.match(src("lib/auth/google-browser.ts"),/flowType: "pkce"/);
 assert.match(src("app/login/page.tsx"),/createGoogleBrowserClient/);
 assert.match(src("app/auth/callback/page.tsx"),/exchangeCodeForSession/);
});

test("shared sidebar remains a single layout across pages and respects URL navigation",()=>{
 const layout=src("app/workspace/layout.tsx");
 const shell=src("app/workspace/workspace-shell.tsx");
 const menu=src("app/workspace/workspace-sidebar.tsx");
 assert.match(layout,/<WorkspaceShell>/);
 assert.match(shell,/<WorkspaceSidebar/);
 assert.match(shell,/cache: "no-store"/);
 for(const label of ["Главная","Заказы","Клиенты","Настройки бота","Настройки Mini App","Профиль"])
  assert.ok(menu.includes(label),label);
 assert.match(menu,/view: "create"/);
 assert.match(menu,/view: "categories"/);
 assert.match(src("app/workspace/catalog-manager.tsx"),/initialView = "items"/);
 assert.match(src("app/workspace/page.tsx"),/initialView=\{view === "categories" \? "categories" : "items"\}/);
 assert.match(menu,/aria-current=\{active \? "page"/);
 assert.match(menu,/aria-expanded=\{catalogExpanded\}/);
 assert.match(menu,/PanelLeftClose/);
 assert.match(menu,/PanelLeftOpen/);
 assert.match(menu,/localStorage\.setItem\(SIDEBAR_STORAGE_KEY/);
 assert.match(menu,/lg:w-\[76px\]/);
 assert.match(menu,/lg:w-\[272px\]/);
 assert.match(menu,/aria-label="Меню профиля"/);
 assert.match(menu,/action="\/api\/auth\/logout" method="post"/);
 assert.match(menu,/newOrders/);
 assert.match(src("app/api/workspace/route.ts"),/newOrders\.count/);
});
