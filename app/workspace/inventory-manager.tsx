"use client";
import { useEffect, useState } from "react";
import type { BotTemplateId } from "@/lib/product/templates";

type StockItem = { id: string; name: string; description: string; price_minor: number | null; stock_quantity: number | null; currency: string };
const initData = () => (window as typeof window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ?? "";

export default function InventoryManager({ botId, type }: { botId: string; type: BotTemplateId }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/catalog?bot=${encodeURIComponent(botId)}`, { headers: { "x-telegram-init-data": initData() }, signal: controller.signal });
        const result = await response.json() as { items?: StockItem[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Не удалось загрузить склад");
        if (!controller.signal.aborted) setItems(result.items ?? []);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Ошибка загрузки"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [botId]);

  async function save(item: StockItem) {
    const raw = edited[item.id];
    const quantity = raw === "" ? null : Number(raw);
    if (raw === undefined || (quantity !== null && (!/^\d+$/.test(raw) || !Number.isSafeInteger(quantity) || quantity > 100000000))) { setError("Введите целый остаток от 0 до 100 000 000 или оставьте поле пустым."); return; }
    setSaving(item.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/catalog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ botId, initData: initData(), id: item.id, name: item.name, description: item.description, priceMinor: item.price_minor, currency: item.currency, stockQuantity: quantity }) });
      const result = await response.json() as { item?: StockItem; error?: string };
      if (!response.ok || !result.item) throw new Error(result.error ?? "Не удалось сохранить остаток");
      setItems(current => current.map(row => row.id === item.id ? result.item! : row));
      setEdited(current => { const next = { ...current }; delete next[item.id]; return next; });
      setNotice(`Остаток «${item.name}» сохранён.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка сохранения"); }
    finally { setSaving(null); }
  }
  if (type === "service") return <section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Для услуг склад не используется</h2><p className="mt-2 text-sm text-[#667085]">Раздел остаётся в общей навигации кабинета.</p></section>;
  if (loading) return <p role="status">Загружаем остатки…</p>;
  return <section className="rounded-2xl border bg-white p-5">
    <p className="mb-5 text-sm text-[#667085]">Остатки позиций каталога. Пустое значение означает, что остаток не задан.</p>
    {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mb-4 text-sm text-green-700">{notice}</p>}
    {items.length ? <ul className="divide-y">{items.map(item => <li key={item.id} className="flex flex-wrap items-center gap-3 py-4"><span className="min-w-0 flex-1 text-sm font-semibold">{item.name}</span><label className="text-xs text-[#667085]">Остаток, шт<input inputMode="numeric" aria-label={`Остаток: ${item.name}`} value={edited[item.id] ?? String(item.stock_quantity ?? "")} onChange={event => setEdited(current => ({ ...current, [item.id]: event.target.value }))} className="mt-1 block h-10 w-32 rounded-xl border px-3 text-sm text-[#101828]"/></label><button type="button" disabled={saving !== null || edited[item.id] === undefined} onClick={() => void save(item)} className="mt-4 rounded-xl bg-[#101828] px-4 py-2 text-sm text-white disabled:opacity-40">{saving === item.id ? "Сохраняем…" : "Сохранить"}</button></li>)}</ul> : <p className="py-8 text-center text-sm text-[#667085]">Добавьте позиции в каталог — они появятся на складе.</p>}
    {items.length === 200 && <p className="mt-4 text-xs text-[#667085]">Показаны первые 200 позиций каталога.</p>}
  </section>;
}
