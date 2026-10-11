import { expect, test } from "@playwright/test";

test("public entry redirects to authentication", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", { name: /Войти в Bot Studio/i })).toBeVisible();
});

test("testbase health and provider discovery are available", async ({ request }) => {
  const health = await request.get("/api/health/supabase");
  expect(health.ok()).toBeTruthy();
  await expect(health.json()).resolves.toMatchObject({ connected: true, database: "supabase", ok: true });

  const providers = await request.get("/api/auth/providers");
  expect(providers.ok()).toBeTruthy();
  const body = await providers.json();
  expect(body).toHaveProperty("google");
  expect(body).toHaveProperty("telegram");
});

test("legacy shared-data APIs stay closed", async ({ request }) => {
  for (const path of ["/api/studio", "/api/avatar"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(410);
  }
});

test("authentication layout fits a mobile viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only assertion");
  await page.goto("/auth");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole("button", { name: /Продолжить через Google/i })).toBeVisible();
});

test("Telegram OIDC is enabled and starts an authorization-code flow", async ({ request, page }) => {
  const providers = await request.get("/api/auth/providers");
  expect(providers.ok()).toBeTruthy();
  const config = await providers.json();
  expect(config.telegram, "Staging must advertise configured Telegram OIDC").not.toBeNull();
  await page.goto("/auth");
  await expect(page.getByRole("link", { name: /Войти через Telegram/ })).toBeVisible();
  const start = await request.get("/api/auth/telegram/start", { maxRedirects: 0 });
  expect(start.status()).toBe(302);
  const destination = new URL(start.headers()["location"]);
  expect(destination.hostname).toBe("oauth.telegram.org");
  expect(destination.searchParams.get("response_type")).toBe("code");
  expect(destination.searchParams.get("code_challenge_method")).toBe("S256");
  expect(destination.searchParams.get("redirect_uri")).toBe("https://bot-studio-staging.slavnauz.workers.dev/api/auth/telegram/callback");
  expect(destination.searchParams.get("client_id")).toMatch(/^[0-9]+$/);
  expect(destination.searchParams.has("bot_id")).toBe(false);
});

test("Telegram callback fails closed without valid CSRF cookie", async ({ request }) => {
  const response = await request.get("/api/auth/telegram/callback?code=fake&state=fake", { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers()["location"]).toContain("/auth?error=telegram_session_expired");
});

// This blocks releases if the exact Cloudflare Worker encryption configuration is broken.
test("Telegram token encryption round-trip works on deployed Worker", async ({ request }) => {
  const response = await request.get("/api/health/telegram-encryption");
  expect(response.status(), "BotFather token encryption must be ready before onboarding").toBe(200);
  const payload = await response.json();
  expect(payload).toEqual({ ready: true, component: "telegram-token-encryption" });
});


/**
 * Safe browser-flow QA: no real Telegram bot is modified, no Supabase rows are created.
 * Real Telegram getMe/webhook/publishing still require a dedicated QA bot fixture.
 */
for (const kind of ["Доставка еды", "Интернет-магазин"] as const) {
  test(`Four-stage onboarding UI with simulated APIs — ${kind}`, async ({ page }) => {
    const mockId = "c86fd579-1498-462f-8980-83a52aa42e1f";
    let inspected = false;
    let connected = false;
    let published = false;
    // A verified account is required for the real onboarding page.
    await page.route("**/api/auth/account",route=>route.fulfill({
      status:200,contentType:"application/json",body:JSON.stringify({authenticated:true})
    }));
    await page.route("**/api/onboarding", async (route) => {
      const payload = route.request().postDataJSON() as { botName?: string; templateType?: string };
      expect(payload.botName).toBe("QA E2E demo");
      expect(payload.templateType).toBe(kind === "Доставка еды" ? "delivery" : "store");
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({bot:{id:mockId}})});
    });
    await page.route("**/api/channels/telegram/token", async (route) => {
      const payload = route.request().postDataJSON() as {action?:string};
      if (payload.action === "inspect") {
        inspected = true;
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({credentialId:"c3d21650-e18c-4f9a-83a9-9a2663df04ee",bot:{id:123456789,name:"QA bot",username:"BotStudioQaTestBot"}})});
      } else if (payload.action === "connect") {
        connected = true;
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({connected:true,bot:{name:"QA bot",username:"BotStudioQaTestBot"}})});
      } else throw Error(`Unexpected mocked Telegram action: ${payload.action}`);
    });
    await page.route("**/api/publish", async (route) => {
      const payload=route.request().postDataJSON() as {botId?:string};
      expect(payload.botId).toBe(mockId);
      published=true;
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"published"})});
    });

    await page.goto("/onboarding");
    await expect(page.getByRole("heading",{name:"Подключите Telegram"})).toBeVisible();
    await page.getByRole("button",{name:/Подключить существующего/}).click();
    await page.getByRole("button",{name:/Продолжить/}).click();
    await expect(page.getByRole("heading",{name:"Выберите шаблон"})).toBeVisible({timeout:15000});
    await page.getByRole("button",{name:new RegExp(kind)}).click();
    await page.getByRole("button",{name:/Продолжить/}).click();
    await expect(page.getByRole("heading",{name:"Настройте бота"})).toBeVisible({timeout:15000});
    await page.getByRole("textbox",{name:/Название бота/}).fill("QA E2E demo");
    await page.getByRole("textbox",{name:/Описание/}).fill("Safe mock QA browser test");
    await expect(page.getByText("QA E2E demo")).toBeVisible();
    await page.getByPlaceholder("Telegram Bot API token").fill("123456789:"+ "A".repeat(46));
    await page.getByRole("button",{name:"Проверить",exact:true}).click();
    await expect(page.getByText(/QA bot · @BotStudioQaTestBot/)).toBeVisible();
    await page.getByRole("button",{name:"Подтвердить подключение"}).click();
    await expect(page.getByText("Telegram подключён: @BotStudioQaTestBot")).toBeVisible();
    await page.getByRole("button",{name:/К проверке/}).click();
    await expect(page.getByRole("heading",{name:"Проверка и запуск"})).toBeVisible();
    await expect(page.getByText("Проект «QA E2E demo» создан")).toBeVisible();
    await page.getByRole("button",{name:/Опубликовать бота/}).click();
    await expect(page.getByRole("heading",{name:"Бот опубликован!"})).toBeVisible();
    expect({inspected,connected,published}).toEqual({inspected:true,connected:true,published:true});
  });
}


test("owner draft preview is not publicly readable",async({request})=>{
 const response=await request.get("/api/miniapp/preview?bot=11111111-1111-4111-8111-111111111111");
 expect([401,403,404]).toContain(response.status());
 expect(response.headers()["cache-control"]??"").not.toContain("public");
});

for(const template of ["delivery","store"] as const){
 test(`interactive draft Mini App uses real cart and updates theme — ${template}`,async({page})=>{
  const id="11111111-1111-4111-8111-111111111111";
  await page.route("**/api/miniapp/preview?bot=*",async route=>{
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    bot:{id,name:template==="delivery"?"QA Food":"QA Store",description:"Предпросмотр",logoUrl:null,color:"#E65D35",template},
    items:[{id:"33333333-3333-4333-8333-333333333333",name:"QA блюдо",description:"Свежее",image_url:null,price_minor:2500000,currency:"UZS",category_id:"22222222-2222-4222-8222-222222222222"}],
    categories:[{id:"22222222-2222-4222-8222-222222222222",name:"Горячее",position:0}],
    design:{layout:"food01",color:"#E65D35",themeMode:"light",defaultTheme:"system",banner:{enabled:true,title:"Вкусная еда рядом",description:"Выбирайте любимое",imageUrl:"",buttonEnabled:false,buttonText:"",linkType:"page",target:"catalog"}}
   })});
  });
  await page.goto(`/miniapp?bot=${id}&preview=1`);
  await expect(page.getByText("Предпросмотр · изменения не опубликованы")).toBeVisible();
  await expect(page.getByText("QA блюдо")).toBeVisible();
  await page.evaluate(botId=>window.postMessage({type:"bot-studio:preview-design",botId,design:{layout:"food02",color:"#6541F5",dark:true,themeMode:"dark",defaultTheme:"dark",banner:{enabled:true,title:"Меню за минуту",description:"Тест баннера",imageUrl:"",buttonEnabled:false,buttonText:"",linkType:"page",target:"catalog"}}},window.location.origin),id);
  await expect(page.locator("main").last()).toHaveCSS("background-color","rgb(17, 20, 24)");
  if(template==="delivery")await expect(page.getByText("Меню за минуту")).toBeVisible();
  await page.getByRole("button",{name:/Добавить/}).first().click();
  await page.getByRole("button",{name:/Корзина/}).last().click();
  await expect(page.getByText("Оформление заказа")).toBeVisible();
  await expect(page.getByRole("button",{name:/Заказ недоступен в предпросмотре/})).toBeDisabled();
 });
}


test("Google PKCE redirects with code challenge instead of implicit access token",async({page})=>{
 let authorizeUrl="";
 await page.route("**/api/auth/providers",route=>route.fulfill({
  status:200,contentType:"application/json",
  body:JSON.stringify({google:{supabaseUrl:"https://qa-login-auth.supabase.co",publishableKey:"sb_publishable_testing"},telegram:null}),
 }));
 await page.route("https://qa-login-auth.supabase.co/auth/v1/authorize**",route=>{
  authorizeUrl=route.request().url();
  return route.abort();
 });
 await page.goto("/auth");
 await page.getByRole("button",{name:/Продолжить через Google/}).click();
 await expect.poll(()=>authorizeUrl,{timeout:10000}).toContain("/auth/v1/authorize");
 const url=new URL(authorizeUrl);
 expect(url.searchParams.get("provider")).toBe("google");
 expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{40,}$/);
 expect(url.searchParams.get("code_challenge_method")?.toLowerCase()).toBe("s256");
 expect(url.searchParams.get("redirect_to")).toContain("/auth/callback");
});

test("Google callback rejects missing authorization code without creating a session",async({page})=>{
 let posts=0;
 await page.route("**/api/auth/providers",route=>route.fulfill({
  status:200,contentType:"application/json",
  body:JSON.stringify({google:{supabaseUrl:"https://qa-login-auth.supabase.co",publishableKey:"sb_publishable_testing"},telegram:null}),
 }));
 await page.route("**/api/auth/account",route=>{posts++;return route.abort()});
 await page.goto("/auth/callback");
 await expect(page.getByRole("alert")).toContainText("Google не вернул код подтверждения");
 expect(posts).toBe(0);
});

test("linking Google without a verified session is rejected",async({request})=>{
 const response=await request.post("/api/auth/account",{
  data:{provider:"google",mode:"link",accessToken:"not-an-oauth-token"},
 });
 expect([400,401]).toContain(response.status());
});


// QA 2026-10-11: actual admin UI and theme-picker regression
test("admin cabinet renders the selected delivery bot and exposes creation", async ({ page }) => {
  const id = "d071c20c-b54c-45cc-8033-982a09c945a1";
  await page.route("**/api/workspace", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({bots:[{
      id,name:"QA Delivery Cabinet",username:"qa_delivery_staging_bot",template_type:"delivery",
      metrics:{ordersToday:2,revenueTodayMinor:5000000,catalogItems:3,customers:2,recentOrders:[]}
    }]}),
  }));
  await page.goto("/workspace");
  await expect(page.getByRole("heading",{name:"Обзор"})).toBeVisible();
  await expect(page.locator("select").first()).toHaveValue(id);
  await expect(page.getByRole("link",{name:"Создать ещё бота"})).toBeVisible();
});

test("admin theme and template picker saves customer choice and default dark mode", async ({ page }) => {
  const id = "d071c20c-b54c-45cc-8033-982a09c945a1";
  const banner = {enabled:true,title:"QA баннер",description:"Тест",imageUrl:"",buttonEnabled:false,buttonText:"",linkType:"page",target:"catalog"};
  const initialDesign = {layout:"food01",color:"#E65D35",dark:false,themeMode:"light",defaultTheme:"system",banner};
  let submitted:Record<string,unknown>|null=null;
  await page.route("**/api/workspace",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({bots:[{id,name:"QA Food",username:"qa_food_bot",template_type:"delivery",
      metrics:{ordersToday:0,revenueTodayMinor:0,catalogItems:0,customers:0,recentOrders:[]}}]}),
  }));
  await page.route("**/api/miniapp/design**",async route=>{
    if(route.request().method()==="POST"){
      submitted=route.request().postDataJSON() as Record<string,unknown>;
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true})});
    }
    return route.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({design:initialDesign,templateType:"delivery"})});
  });
  await page.route("**/api/catalog/categories?bot=*",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({categories:[]})
  }));
  await page.route("**/api/catalog?bot=*",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({items:[]})
  }));
  await page.route("**/api/miniapp/preview?bot=*",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({
      bot:{id,name:"QA Food",description:"preview",logoUrl:null,color:"#E65D35",template:"delivery"},
      design:initialDesign,items:[],categories:[]
    })
  }));
  await page.goto("/workspace");
  await expect(page.getByRole("heading",{name:"Обзор"})).toBeVisible();
  await page.getByRole("button",{name:"Оформление Mini App"}).click();
  await expect(page.locator("h2",{hasText:"Оформление Mini App"})).toBeVisible();
  await page.locator("label").filter({hasText:"Шаблон"}).locator("select").selectOption("food02");
  await page.locator("label").filter({hasText:"Тема для покупателей"}).locator("select").selectOption("dark");
  await expect(page.locator("label").filter({hasText:"Тема для покупателей"}).locator("select")).toHaveValue("dark");
  await page.locator("label").filter({hasText:"Тема для покупателей"}).locator("select").selectOption("customer");
  await page.locator("label").filter({hasText:"Тема при первом открытии"}).locator("select").selectOption("dark");
  await page.getByRole("button",{name:"Сохранить черновик"}).click();
  await expect(page.getByRole("status")).toContainText("Черновик оформления сохранён");
  expect(submitted).toMatchObject({botId:id,layout:"food02",themeMode:"customer",defaultTheme:"dark"});
});

test("cabinet and design APIs reject unsigned requests", async ({ request }) => {
  const id = "d071c20c-b54c-45cc-8033-982a09c945a1";
  for (const path of ["/api/workspace","/api/bots/draft?bot="+id,"/api/miniapp/design?bot="+id]) {
    const result=await request.get(path);
    expect([401,403],path+" must not expose an account to guests").toContain(result.status());
  }
});


test("onboarding requires login before creating a bot in the browser",async({page})=>{
  await page.route("**/api/auth/account",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({authenticated:false})
  }));
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/auth$/);
});

test("onboarding API rejects unsigned bot creation",async({request})=>{
  const response=await request.post("/api/onboarding",{data:{
    botName:"Unauthorized QA",templateType:"delivery",requestKey:"a".repeat(32)
  }});
  expect([401,403]).toContain(response.status());
});

test("unsigned admin workspace redirects to login",async({page})=>{
  await page.route("**/api/workspace",route=>route.fulfill({
    status:401,contentType:"application/json",body:JSON.stringify({error:"Войдите в аккаунт."})
  }));
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/auth$/);
});
