export type CatalogCurrency = "UZS" | "USD";

export function formatCatalogPrice(value: string, currency: CatalogCurrency): string {
  const clean = value.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const point = clean.indexOf(".");
  const digits = currency === "UZS" ? clean.replace(/\D/g, "") : point < 0
    ? clean.replace(/\D/g, "")
    : clean.slice(0, point).replace(/\D/g, "") + "." + clean.slice(point + 1).replace(/\D/g, "").slice(0, 2);
  if (!digits) return "";
  const dot = digits.indexOf(".");
  const whole = dot < 0 ? digits : digits.slice(0, dot);
  const fractional = dot < 0 ? "" : digits.slice(dot);
  const grouped = (whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return grouped + fractional;
}

export function priceToMinor(value: string, currency: CatalogCurrency): number | null {
  if (!value.trim()) return null;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || (currency === "UZS" && normalized.includes(".")))
    throw new Error("Некорректная сумма.");
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 9_000_000_000_000)
    throw new Error("Сумма слишком большая.");
  return amount;
}

export function formatStoredPrice(minor: number, currency: CatalogCurrency): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return formatCatalogPrice(String(whole) + (currency === "USD" && fraction ? "." + String(fraction).padStart(2,"0") : ""), currency);
}
