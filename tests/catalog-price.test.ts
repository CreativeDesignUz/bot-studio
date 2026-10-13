import assert from "node:assert/strict";
import test from "node:test";
import { formatCatalogPrice, formatStoredPrice, priceToMinor } from "../lib/catalog/price";

test("groups UZS amounts without changing numeric value", () => {
  assert.equal(formatCatalogPrice("10000","UZS"), "10 000");
  assert.equal(formatCatalogPrice("100000","UZS"), "100 000");
  assert.equal(formatCatalogPrice("10 000","UZS"), "10 000");
  assert.equal(priceToMinor("100 000","UZS"),10_000_000);
  assert.equal(formatStoredPrice(1_000_000,"UZS"),"10 000");
});

test("formats USD amounts with up to two decimal places", () => {
  assert.equal(formatCatalogPrice("10000.50","USD"),"10 000.50");
  assert.equal(formatCatalogPrice("10000,99","USD"),"10 000.99");
  assert.equal(priceToMinor("10 000.50","USD"),1_000_050);
  assert.equal(formatStoredPrice(1_000_050,"USD"),"10 000.50");
});

test("invalid prices are rejected", () => {
  assert.throws(()=>priceToMinor("10.50","UZS"));
  assert.throws(()=>priceToMinor("5.999","USD"));
  assert.throws(()=>priceToMinor("-20","UZS"));
  assert.throws(()=>priceToMinor("100000000000000000000","UZS"));
  assert.equal(priceToMinor("","UZS"),null);
});
