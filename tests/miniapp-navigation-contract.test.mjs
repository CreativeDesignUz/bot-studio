import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("app/miniapp/page.tsx");
const map=read("app/miniapp/delivery-location-picker.tsx");
test("buyer profile is accessible via bottom navigation and renders content",()=>{
 assert.match(app,/id:"profile",label:"Профиль"/);
 assert.match(app,/onClick=\{\(\)=>setTab\(entry\.id\)\}/);
 assert.match(app,/tab === "profile"/);
 assert.match(app,/>Профиль<\/h2>/);
});
test("both retail products and food dishes have interactive details and add to cart",()=>{
 assert.match(app,/onClick=\{\(\)=>setDetailId\(item\.id\)\}/);
 assert.match(app,/\{detailItem&&<div/);
 assert.doesNotMatch(app,/\{isFood&&detailItem&&<div/);
 assert.match(app,/aria-label=\{"Детали товара "\+detailItem\.name\}/);
 assert.match(app,/adjust\(detailItem\.id,1\)/);
});
test("Mini App delivery map opens on delivery selection and permits map picking",()=>{
 assert.match(app,/fulfillment==="delivery".*DeliveryLocationPicker/);
 assert.match(map,/tile\.openstreetmap\.org/);
 assert.match(map,/onChange\(/);
 assert.match(app,/setDeliveryPoint\(point\)/);
});
