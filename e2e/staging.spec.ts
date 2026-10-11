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
