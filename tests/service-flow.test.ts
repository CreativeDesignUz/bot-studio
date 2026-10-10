import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("service template shows request-first Mini App rather than shopping cart",async()=>{
  const main=await readFile(new URL("../app/miniapp/page.tsx",import.meta.url),"utf8");
  const service=await readFile(new URL("../app/miniapp/service-miniapp.tsx",import.meta.url),"utf8");
  assert.match(main,/shop\.bot\.template === "service"/);
  assert.match(service,/Оставить заявку/);
  assert.match(service,/Отправить заявку/);
  assert.match(service,/После подтверждения/);
  assert.doesNotMatch(service,/Самовывоз|Доставка|Корзина|Добавить в корзину/);
});
test("service inquiries are validated using Telegram and constrained to owner",async()=>{
  const api=await readFile(new URL("../app/api/service-requests/route.ts",import.meta.url),"utf8");
  const owner=await readFile(new URL("../app/api/workspace/service-requests/route.ts",import.meta.url),"utf8");
  assert.match(api,/verifyTelegramInitData/);
  assert.match(api,/create_miniapp_order/);
  assert.match(api,/source:"service_request"/);
  assert.match(owner,/\.eq\("owner_id",user\.id\)/);
  assert.match(owner,/confirmed/);
  assert.match(owner,/in_progress/);
});
