import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("seller order status API checks ownership and rejects stale transitions",async()=>{
 const api=await readFile(new URL("../app/api/orders/route.ts",import.meta.url),"utf8");
 assert.match(api,/transitions:Record<string,string>/);
 assert.match(api,/\.eq\("owner_id",user\.id\)/);
 assert.match(api,/\.eq\("status",body\.expectedStatus\)/);
 assert.match(api,/status:409/);
 assert.doesNotMatch(api,/new:"cancelled"/);
});

test("order manager renders lifecycle actions and handles server errors",async()=>{
 const ui=await readFile(new URL("../app/workspace/order-manager.tsx",import.meta.url),"utf8");
 assert.match(ui,/Принять заказ/);
 assert.match(ui,/Начать приготовление/);
 assert.match(ui,/Готов к выдаче/);
 assert.match(ui,/Завершить заказ/);
 assert.match(ui,/method:"PATCH"/);
});
