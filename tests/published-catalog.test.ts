import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Mini App public GET never reads live draft catalog",async()=>{
 const route=await readFile(new URL("../app/api/miniapp/route.ts",import.meta.url),"utf8");
 assert.match(route,/published\.catalog/);
 assert.match(route,/Array\.isArray\(catalog\.items\)/);
 const get=route.split("export async function POST")[0];
 assert.doesNotMatch(get,/supabase\.from\("catalog_items"\)/);
 assert.doesNotMatch(get,/supabase\.from\("catalog_categories"\)/);
});

test("published catalog is captured atomically and checkout uses published prices",async()=>{
 const migration=await readFile(new URL("../supabase/migrations/202610100009_published_catalog_snapshot.sql",import.meta.url),"utf8");
 assert.match(migration,/'catalog', public\.bot_studio_catalog_snapshot\(result\.id\)/);
 assert.match(migration,/published_snapshot=jsonb_set/);
 assert.match(migration,/jsonb_array_elements\(snapshot_items\)/);
 assert.match(migration,/published\.value->>'price_minor'/);
 assert.doesNotMatch(migration,/join public\.catalog_items ci on ci\.id=\(items\.value/);
});
