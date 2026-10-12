import { existsSync,readFileSync,mkdirSync,writeFileSync } from "node:fs";
import { join } from "node:path";
const root=process.cwd();
const has=(p)=>existsSync(join(root,p));
const source=(p)=>has(p)?readFileSync(join(root,p),"utf8"):"";
const checks=[
 ["Авторизация Google","app/api/auth/google/route.ts","app/auth/callback/page.tsx"],
 ["Авторизация Telegram","app/api/auth/telegram/oidc/start/route.ts","app/api/auth/telegram/oidc/callback/route.ts"],
 ["Создание бота","app/onboarding/page.tsx","app/api/onboarding/route.ts"],
 ["Изменение бота","app/workspace/builder/page.tsx","app/api/bots/draft/route.ts"],
 ["Добавление товара","app/workspace/catalog-manager.tsx","app/api/catalog/route.ts"],
 ["Стили Mini App","app/workspace/miniapp-appearance.tsx","app/api/miniapp/design/route.ts"],
 ["Фото товара (загрузка файла)","app/api/catalog/image-upload/route.ts"],
 ["Раздел заказы","app/workspace/order-manager.tsx","app/api/orders/route.ts"],
 ["Акции: интерфейс и API","app/workspace/campaign-manager.tsx","app/api/campaigns/route.ts"],
 ["Создание акции","app/api/campaigns/route.ts"],
 ["Детали заказа","app/workspace/order-manager.tsx"],
 ["Карта в заказе","app/workspace/order-manager.tsx"],
 ["Покупательский Mini App","app/miniapp/page.tsx","app/api/miniapp/route.ts"],
 ["Покупка через Mini App","app/miniapp/page.tsx","app/api/checkout/route.ts"]
];
const results=checks.map(([name,...paths])=>({name,codeFilesPresent:paths.every(has),missing:paths.filter(p=>!has(p)),liveE2E:"NOT_RUN"}));
const runtime=source("app/api/channels/telegram/project-runtime/route.ts");
const auth=source("lib/auth/app-user.ts");
const extra=[
 {name:"Telegram runtime: есть ссылка на покупательский Mini App",codeFilesPresent:runtime.includes("/miniapp?bot=")&&!runtime.includes("web_app:{url:new URL(\`/workspace"),missing:[],liveE2E:"NOT_RUN"},
 {name:"Telegram runtime: поддержка прямых зашифрованных ключей бота",codeFilesPresent:runtime.includes("getProjectBotToken")&&source("lib/channels/project-bot-token.ts").includes("decryptTelegramToken"),missing:[],liveE2E:"NOT_VERIFIABLE_IN_CI"},
 {name:"Google OAuth: поддержка authorization code callback",codeFilesPresent:!source("app/auth/callback/page.tsx").includes("требуется implicit callback"),missing:[],liveE2E:"NOT_RUN"},
 {name:"Подтверждение owner в API каталога",codeFilesPresent:source("app/api/catalog/route.ts").includes("owner_id"),missing:[],liveE2E:"NOT_RUN"},
 {name:"Карта доставки в заказе",codeFilesPresent:source("app/workspace/order-manager.tsx").includes("openstreetmap.org/export/embed.html"),missing:[],liveE2E:"NOT_RUN"},
 {name:"Детали заказа: отдельная страница",codeFilesPresent:has("app/workspace/orders/[orderId]/page.tsx"),missing:[],liveE2E:"NOT_RUN"},
 {name:"Публикация: каталог и дизайн фиксируются в snapshot",codeFilesPresent:source("app/api/publish/route.ts").includes("published_snapshot:snapshot"),missing:[],liveE2E:"NOT_RUN"},
 {name:"Активные акции применяются на сервере при оформлении заказа",codeFilesPresent:source("app/api/checkout/route.ts").includes("p_promo_code")&&source("supabase/migrations/202610120002_atomic_campaign_checkout.sql").includes("discount_amount")&&source("app/workspace/campaign-manager.tsx").includes('toggle(row'),missing:[],liveE2E:"NOT_RUN_MIGRATION_REQUIRED"},
 {name:"Фото товара: поддержка HTTPS ссылки",codeFilesPresent:source("app/api/catalog/route.ts").includes("imageUrl"),missing:[],liveE2E:"NOT_RUN"}
];
const all=[...results,...extra];
const failures=all.filter(c=>!c.codeFilesPresent);
const report={generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA??"local",warning:"Static code audit only. No Google/Telegram signed-in browsing, data mutation, or real checkout performed. Even zero code blockers is NOT a release approval.",total:all.length,blockers:failures.length,checks:all};
mkdirSync(join(root,"qa-results"),{recursive:true});
writeFileSync(join(root,"qa-results","qa-bot.json"),JSON.stringify(report,null,2));
writeFileSync(join(root,"qa-results","qa-bot.md"),"# Bot Studio QA bot — статический аудит\n\n**Внимание:** этот запуск НЕ проверяет авторизованные browser E2E.\n\n"+all.map(x=>"- "+(x.codeFilesPresent?"✅":"❌")+" "+x.name+(x.missing?.length?" — отсутствует: "+x.missing.join(", "):"")+"; LIVE="+x.liveE2E).join("\n")+"\n");
console.log(JSON.stringify({checks:all.length,blockers:failures.length,results:all.map(x=>({name:x.name,ok:x.codeFilesPresent}))},null,2));
if(process.env.GITHUB_STEP_SUMMARY)writeFileSync(process.env.GITHUB_STEP_SUMMARY,readFileSync(join(root,"qa-results","qa-bot.md")));
if(failures.length)process.exitCode=1;
