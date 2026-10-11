import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("buyer menu reads only published category and item snapshot", async () => {
  const code = await readFile(new URL("../app/api/miniapp/route.ts", import.meta.url), "utf8");
  assert.match(code, /published\.catalog/);
  assert.match(code, /catalog\.items/);
  assert.match(code, /catalog\.categories/);
  assert.match(code, /publishedItems\.filter/);
});

test("buyer-visible design reads only the immutable published snapshot", async () => {
  const code = await readFile(new URL("../app/api/miniapp/route.ts", import.meta.url), "utf8");
  assert.match(code, /published\.settings/);
  assert.match(code, /publishedSettings\.miniapp_design/);
  assert.doesNotMatch(code, /bot\.settings/);
});

test("editor explains explicit publish after saving food styling", async () => {
  const code = await readFile(new URL("../app/workspace/builder/page.tsx", import.meta.url), "utf8");
  assert.match(code, /Черновик дизайна сохранён/);
  assert.match(code, /публикации бота/);
});
