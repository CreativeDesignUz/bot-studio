import assert from "node:assert/strict";
import test from "node:test";
import { resolvePublicAppOrigin } from "../lib/http/public-origin";

test("uses the configured public origin instead of a request host", () => {
  assert.equal(resolvePublicAppOrigin("https://attacker.example/api/publish", "https://app.example.com"), "https://app.example.com");
});

test("rejects unsafe configured URLs and unconfigured production hosts", () => {
  for (const value of ["http://app.example.com", "https://user:pass@app.example.com", "https://app.example.com/path"]) {
    assert.throws(() => resolvePublicAppOrigin("https://request.example/api", value), /PUBLIC_APP_URL_INVALID/);
  }
  assert.throws(() => resolvePublicAppOrigin("https://attacker.example/api"), /PUBLIC_APP_URL_REQUIRED/);
});

test("allows local development and Cloudflare quick tunnels without production configuration", () => {
  assert.equal(resolvePublicAppOrigin("http://127.0.0.1:4173/api"), "http://127.0.0.1:4173");
  assert.equal(resolvePublicAppOrigin("https://demo.trycloudflare.com/api"), "https://demo.trycloudflare.com");
});
