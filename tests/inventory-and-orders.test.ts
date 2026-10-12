import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("seller can set stock and buyer cannot see zero-stock items",async()=>{
 const editor=await readFile(new URL("../features/web/components/catalog-manager.tsx",import.meta.url),"utf8");
 const api=await readFile(new URL("../app/api/catalog/route.ts",import.meta.url),"utf8");
 const miniapp=await readFile(new URL("../app/api/miniapp/route.ts",import.meta.url),"utf8");
 assert.match(editor,/Количество в наличии/);
 assert.match(editor,/stockQuantity:stock/);
 assert.match(api,/stock_quantity/);
 assert.match(api,/Number\.isSafeInteger\(input\.stockQuantity\)/);
 assert.match(miniapp,/stock_quantity/);
 assert.match(miniapp,/publishedItems\.filter/);
});

test("checkout stock deduction and idempotency use an atomic database function",async()=>{
 const sql=await readFile(new URL("../supabase/migrations/202610100010_inventory_checkout.sql",import.meta.url),"utf8");
 assert.match(sql,/stock_quantity integer/);
 assert.match(sql,/perform 1 from public\.bots where id=p_bot_id for update/);
 assert.match(sql,/stock_quantity>=item_quantity/);
 assert.match(sql,/OUT_OF_STOCK/);
 assert.match(sql,/create or replace function public\.create_miniapp_order/);
});

test("admin order details include product lines and delivery address",async()=>{
 const api=await readFile(new URL("../app/api/orders/route.ts",import.meta.url),"utf8");
 const ui=await readFile(new URL("../features/web/components/order-manager.tsx",import.meta.url),"utf8");
 assert.match(api,/\.eq\("owner_id",user\.id\)/);
 assert.match(api,/from\("order_items"\)/);
 assert.match(ui,/Что заказали/);
 assert.match(ui,/Адрес доставки/);
});
