import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const callback = readFileSync(new URL("../app/auth/callback/page.tsx", import.meta.url), "utf8");
const browser = readFileSync(new URL("../lib/auth/google-browser.ts", import.meta.url), "utf8");

test("Google PKCE callback exchanges an authorization code only once", () => {
  assert.match(browser, /detectSessionInUrl: false/);
  assert.match(browser, /storage: window.sessionStorage/);
  assert.match(callback, /started.current/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.doesNotMatch(callback, /auth.signOut/);
  assert.match(callback, /stopAutoRefresh/);
});

test("Google callback separates OAuth, code exchange and server session failures", () => {
  assert.match(callback, /params.has\("error"\)/);
  assert.match(callback, /exchangeError\?\.code/);
  assert.match(callback, /sessionResponse.status/);
});
