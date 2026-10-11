import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("delivery settings are owner-scoped and allowed for store and restaurant",async()=>{
 const api=await readFile(new URL("../app/api/delivery/settings/route.ts",import.meta.url),"utf8");
 const ui=await readFile(new URL("../app/workspace/page.tsx",import.meta.url),"utf8");
 assert.match(api,/\.eq\("owner_id",identity\.user\.id\)/);
 assert.match(api,/\["store","delivery"\]/);
 assert.match(api,/delivery_zone:zone/);
 assert.match(ui,/DeliverySettings/);
});
test("server order checks published radius and fee and stores amount",async()=>{
 const sql=await readFile(new URL("../supabase/migrations/202610100012_delivery_zone_fee.sql",import.meta.url),"utf8");
 assert.match(sql,/published_snapshot->'settings'->'delivery_zone'/);
 assert.match(sql,/OUTSIDE_DELIVERY_ZONE/);
 assert.match(sql,/delivery_amount/);
 assert.match(sql,/total_amount\+delivery_amount/);
 assert.match(sql,/DELIVERY_REQUIRES_UZS/);
});
test("Mini App shows coverage and shipping amount from published settings",async()=>{
 const api=await readFile(new URL("../app/api/miniapp/route.ts",import.meta.url),"utf8");
 const ui=await readFile(new URL("../app/miniapp/page.tsx",import.meta.url),"utf8");
 assert.match(api,/publishedSettings\.delivery_zone/);
 assert.match(ui,/deliveryDistanceKm/);
 assert.match(ui,/money\(deliveryFee,"UZS"\)/);
 assert.match(ui,/deliveryInvalid/);
});
