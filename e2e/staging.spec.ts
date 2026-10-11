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
