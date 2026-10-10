"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { formatCatalogPrice, formatStoredPrice, priceToMinor, type CatalogCurrency } from "@/lib/catalog/price";

type Item = { id: string; name: string; description: string; price_minor: number | null; is_active: boolean; currency: string };
type ApiResult = { items?: Item[]; item?: Item; error?: string };
const formatMoney = (minor: number, currency: string) => `${formatStoredPrice(minor, currency === "USD" ? "USD" : "UZS")} ${currency === "USD" ? "$" : "сум"}`;
const telegramData = () => (window as typeof window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ?? "";

export default function CatalogManager({ botId, type }: { botId: string; type: "service" | "store" | "delivery" }) {
  const noun = type === "service" ? "услугу" : type === "delivery" ? "блюдо" : "товар";
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Item | null | "new">(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<CatalogCurrency>("UZS");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/catalog?bot=" + encodeURIComponent(botId), { headers: { "x-telegram-init-data": telegramData() }, cache: "no-store" });
      const body = await response.json() as ApiResult;
      if (!response.ok) throw new Error(body.error ?? "Не удалось загрузить каталог.");
      setItems(body.items ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка загрузки."); }
    finally { setLoading(false); }
  }, [botId]);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  function open(item?: Item) {
    setEditing(item ?? "new"); setName(item?.name ?? ""); setDescription(item?.description ?? "");
    const nextCurrency: CatalogCurrency = item?.currency === "USD" ? "USD" : "UZS";
    setCurrency(nextCurrency);
    setPrice(item?.price_minor == null ? "" : formatStoredPrice(item.price_minor, nextCurrency)); setActive(item?.is_active ?? true); setError("");
  }

  async function save() {
    let priceMinor: number | null;
    try { priceMinor = priceToMinor(price, currency); }
    catch { setError("Введите корректную сумму. Для UZS — целое число, для USD — максимум 2 знака после точки."); return; }
    if (!name.trim()) { setError("Введите название."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/catalog", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ botId, initData: telegramData(), ...(editing !== "new" && editing ? { id: editing.id } : {}),
          name: name.trim(), description: description.trim(), priceMinor, currency, isActive: active }) });
      const body = await response.json() as ApiResult;
      if (!response.ok) throw new Error(body.error ?? "Не удалось сохранить.");
      setEditing(null); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить."); }
    finally { setSaving(false); }
  }

  async function archive(item: Item) {
    if (!window.confirm(`Скрыть «${item.name}» из Mini App?`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/catalog", { method: "DELETE", headers: { "content-type": "application/json" },
        body: JSON.stringify({ botId, id: item.id, initData: telegramData() }) });
      const body = await response.json() as ApiResult;
      if (!response.ok) throw new Error(body.error ?? "Не удалось скрыть.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось скрыть."); }
    finally { setSaving(false); }
  }

  return <section className="overflow-hidden rounded-[22px] border border-[#e4e7ec] bg-white">
    <div className="flex flex-wrap items-center gap-3 border-b border-[#eaecf0] p-5">
      <label className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#98a2b3]"/>
        <input value={query} onChange={e=>setQuery(e.target.value)} className="h-11 w-full rounded-xl border border-[#e4e7ec] pl-10 pr-3 text-sm" placeholder="Поиск по каталогу"/></label>
      <button type="button" onClick={()=>open()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#101828] px-4 text-sm font-semibold !text-white"><Plus className="size-4"/>Добавить {noun}</button>
    </div>
    {error && <p role="alert" className="m-5 rounded-xl bg-[#fff1f2] p-3 text-sm text-[#be123c]">{error}</p>}
    {loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-[#667085]"><LoaderCircle className="size-4 animate-spin"/>Загружаем реальные данные…</div> :
      items.filter(item=>[item.name,item.description].join(" ").toLowerCase().includes(query.toLowerCase())).length === 0
      ? <div className="p-12 text-center"><h2 className="text-lg font-semibold">Пока нет {type==="service"?"услуг":type==="delivery"?"блюд":"товаров"}</h2>
          <p className="mt-2 text-sm text-[#667085]">Добавьте первый элемент, и он появится в Mini App после обновления.</p>
          <button type="button" onClick={()=>open()} className="mt-5 rounded-xl bg-[#6541f5] px-5 py-3 text-sm font-semibold !text-white">Добавить {noun}</button></div>
      : <div className="divide-y divide-[#eaecf0]">{items.filter(item=>[item.name,item.description].join(" ").toLowerCase().includes(query.toLowerCase())).map(item=><div key={item.id} className="flex flex-wrap items-center gap-4 p-5">
          <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.name}</strong><p className="mt-1 line-clamp-2 text-xs text-[#667085]">{item.description || "Без описания"}</p></div>
          <span className="text-sm font-semibold">{item.price_minor === null ? "Цена по запросу" : formatMoney(item.price_minor,item.currency)}</span>
          <span className={item.is_active?"rounded-full bg-[#ecfdf3] px-2 py-1 text-xs text-[#027a48]":"rounded-full bg-[#f2f4f7] px-2 py-1 text-xs text-[#667085]"}>{item.is_active?"Активен":"Скрыт"}</span>
          <button type="button" onClick={()=>open(item)} aria-label={"Изменить "+item.name} className="grid size-10 place-items-center rounded-xl border border-[#d0d5dd]"><Pencil className="size-4"/></button>
          {item.is_active&&<button type="button" disabled={saving} onClick={()=>void archive(item)} aria-label={"Скрыть "+item.name} className="grid size-10 place-items-center rounded-xl border border-[#d0d5dd] text-[#b42318]"><Trash2 className="size-4"/></button>}
        </div>)}</div>}
    {editing!==null&&<div className="fixed inset-0 z-50 grid place-items-center bg-[#101828]/60 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{editing==="new"?"Добавить":"Редактировать"} {noun}</h2><button type="button" onClick={()=>setEditing(null)} aria-label="Закрыть"><X/></button></div>
        <div className="mt-5 space-y-4"><label className="block text-sm font-medium">Название<input maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d0d5dd] px-3"/></label>
          <label className="block text-sm font-medium">Описание<textarea maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[#d0d5dd] p-3"/></label>
          <div className="block text-sm font-medium"><span>Цена</span><div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-[#d0d5dd] focus-within:border-[#6541f5]">
            <input aria-label="Стоимость" inputMode={currency==="UZS"?"numeric":"decimal"} value={price} onChange={e=>setPrice(formatCatalogPrice(e.target.value,currency))} placeholder={currency==="UZS"?"10 000":"100.00"} className="h-11 min-w-0 flex-1 px-3 outline-none"/>
            <select aria-label="Валюта" value={currency} onChange={e=>{const next=e.target.value as CatalogCurrency;setPrice(formatCatalogPrice(price.replace(/\\s/g,"").split(".")[0],next));setCurrency(next);}} className="min-w-28 border-l border-[#d0d5dd] bg-[#f9fafb] px-3 text-sm font-semibold outline-none">
              <option value="UZS">UZS · сум</option><option value="USD">USD · $</option>
            </select></div><p className="mt-1 text-xs font-normal text-[#667085]">Валюта сохраняется вместе с ценой, конвертация не выполняется.</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Показывать в Mini App</label></div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={()=>setEditing(null)} className="h-11 rounded-xl border px-4 text-sm">Отмена</button>
          <button type="button" disabled={saving} onClick={()=>void save()} className="h-11 rounded-xl bg-[#6541f5] px-5 text-sm font-semibold !text-white disabled:opacity-60">{saving?"Сохраняем…":"Сохранить"}</button></div>
      </div></div>}
  </section>;
}
