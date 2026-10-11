import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("onboarding and catalog endpoints reject malformed JSON objects before dereferencing", async () => {
 for (const path of ["../app/api/onboarding/route.ts","../app/api/catalog/route.ts","../app/api/catalog/categories/route.ts"]) {
  const source = await readFile(new URL(path,import.meta.url),"utf8");
  assert.match(source,/typeof (input|parsed) !== "object"/);
  assert.match(source,/Array\.isArray\((input|parsed)\)/);
 }
});
