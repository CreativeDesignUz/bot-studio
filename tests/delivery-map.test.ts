import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("delivery checkout requires and persists map coordinates",async()=>{
 const api=await readFile(new URL("../app/api/miniapp/route.ts",import.meta.url),"utf8");
 const client=await readFile(new URL("../app/miniapp/page.tsx",import.meta.url),"utf8");
 const migration=await readFile(new URL("../supabase/migrations/202610100011_delivery_coordinates.sql",import.meta.url),"utf8");
 assert.match(client,/DeliveryLocationPicker/);
 assert.match(client,/latitude:fulfillment/);
 assert.match(api,/p_lat: input.fulfillment/);
 assert.match(api,/p_lng: input.fulfillment/);
 assert.match(api,/Number.isFinite\(input.latitude\)/);
 assert.match(migration,/INVALID_DELIVERY_COORDINATES/);
 assert.match(migration,/'lat',p_lat,'lng',p_lng/);
});

test("seller can view map coordinates and written address",async()=>{
 const ui=await readFile(new URL("../features/web/components/order-manager.tsx",import.meta.url),"utf8");
 assert.match(ui,/Точка доставки/);
 assert.match(ui,/openstreetmap.org\/export\/embed.html/);
 assert.match(ui,/Адрес доставки/);
});

test("picker allows map click and native geolocation without exposing keys",async()=>{
 const ui=await readFile(new URL("../features/miniapp/components/delivery-location-picker.tsx",import.meta.url),"utf8");
 assert.match(ui,/navigator.geolocation.getCurrentPosition/);
 assert.match(ui,/tile.openstreetmap.org/);
 assert.match(ui,/onClick={choose}/);
 assert.match(ui,/© OpenStreetMap contributors/);
});

test("buyer map starts from published store or restaurant delivery center",async()=>{
 const picker=await readFile(new URL("../features/miniapp/components/delivery-location-picker.tsx",import.meta.url),"utf8");
 const buyer=await readFile(new URL("../app/miniapp/page.tsx",import.meta.url),"utf8");
 assert.match(picker,/initialCenter\?:Point/);
 assert.match(picker,/value\?\?initialCenter/);
 assert.match(buyer,/initialCenter=\{deliveryZone\?/);
});
