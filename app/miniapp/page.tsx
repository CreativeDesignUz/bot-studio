"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Minus, Plus, ShoppingBag, Store, Truck, UserRound, X } from "lucide-react";

type Item = { id: string; name: string; description: string; image_url: string | null; price_minor: number | null; currency: string };
type Shop = { bot: { id: string; name: string; description: string; logoUrl: string | null; color: string; template: string }; items: Item[] };
type Tab = "catalog" | "cart" | "profile";

const money = (value: number, currency = "UZS") => new Intl.NumberFormat("ru-RU", {
  style: "currency", currency, maximumFractionDigits: currency === "UZS" ? 0 : 2,
}).format(value / 100);

export default function MiniAppPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("catalog");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [quantityError, setQuantityError] = useState("");

  useEffect(() => {
    const telegram = (window as typeof window & { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void; initData?: string; initDataUnsafe?: { user?: { first_name?: string } } } } }).Telegram?.WebApp;
    telegram?.ready?.(); telegram?.expand?.();
    const botId = new URLSearchParams(window.location.search).get("bot");
    if (!botId) { Promise.resolve().then(() => { setError("Не указан магазин"); setLoading(false); }); return; }
    fetch("/api/miniapp?bot=" + encodeURIComponent(botId), { cache: "no-store" })
      .then(async response => { const body = await response.json() as Shop & { error?: string }; if (!response.ok) throw new Error(body.error ?? "Не удалось загрузить магазин"); return body as Shop; })
      .then(setShop).catch(e => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  const count = Object.values(cart).reduce((total, value) => total + value, 0);
  const selected = useMemo(() => (shop?.items ?? []).filter(item => cart[item.id] > 0), [shop, cart]);
  const total = selected.reduce((sum, item) => sum + Number(item.price_minor ?? 0) * cart[item.id], 0);
  const currency = shop?.items[0]?.currency ?? "UZS";
  const color = /^#[\da-f]{6}$/i.test(shop?.bot.color ?? "") ? shop!.bot.color : "#6541F5";

  function adjust(id: string, delta: number) {
    setQuantityError("");
    setCart(current => {
      const next = Math.max(0, Math.min(99, (current[id] ?? 0) + delta));
      if (next === 99 && delta > 0) setQuantityError("Не более 99 единиц одного товара");
      return { ...current, [id]: next };
    });
  }

  async function checkout() {
    if (!shop || sending || !selected.length) return;
    const telegram = (window as typeof window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    if (!telegram?.initData) { setError("Для оформления заказа откройте магазин через Telegram"); return; }
    setError(""); setSending(true);
    try {
      const response = await fetch("/api/miniapp", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ botId: shop.bot.id, initData: telegram.initData, name, fulfillment, address,
          items: selected.map(item => ({ id: item.id, quantity: cart[item.id] })) }),
      });
      const body = await response.json() as { error?: string; orderId?: string };
      if (!response.ok) throw new Error(body.error ?? "Не удалось оформить заказ");
      setSuccess(body.orderId ?? ""); setCart({}); setTab("catalog");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка заказа");
    } finally { setSending(false); }
  }

  if (loading) return <main className="grid min-h-dvh place-items-center text-[#667085]">Загружаем магазин…</main>;
  if (!shop) return <main className="grid min-h-dvh place-items-center p-6 text-center"><div><ShoppingBag className="mx-auto mb-4 size-10 text-[#98a2b3]"/><h1 className="text-xl font-bold">Магазин недоступен</h1><p className="mt-2 text-[#667085]">{error}</p></div></main>;

  return <main className="min-h-dvh bg-[#f7f8fa] pb-28 text-[#101828]" style={{ fontFamily: "system-ui, sans-serif" }}>
    <div className="mx-auto max-w-[550px]">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#e9edf2] bg-white/95 px-5 py-4 backdrop-blur">
        {shop.bot.logoUrl ? <img src={shop.bot.logoUrl} alt="" className="size-12 rounded-2xl object-cover"/> :
          <span className="grid size-12 place-items-center rounded-2xl text-white" style={{ backgroundColor: color }}><Store className="size-6"/></span>}
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold">{shop.bot.name}</h1><p className="truncate text-xs text-[#667085]">{shop.bot.description || "Добро пожаловать!"}</p></div>
        <span className="rounded-full bg-[#f0fdf4] px-3 py-1 text-xs font-semibold text-[#15803d]">Открыто</span>
      </header>

      {success && <section className="m-4 rounded-2xl border border-[#c3ebd0] bg-[#ecfdf3] p-5">
        <Check className="mb-2 text-[#12a150]"/><h2 className="font-bold">Заказ принят!</h2>
        <p className="mt-1 text-sm text-[#3a6650]">Номер заказа: {success.slice(0, 8).toUpperCase()}. Магазин получил вашу заявку.</p>
        <button onClick={() => setSuccess("")} className="mt-3 text-sm font-semibold underline">Закрыть</button>
      </section>}
      {error && <div className="m-4 flex items-start justify-between gap-2 rounded-xl bg-[#fff1f2] p-3 text-sm text-[#be123c]"><span>{error}</span><button onClick={()=>setError("")} aria-label="Закрыть"><X size={16}/></button></div>}
      {quantityError && <p className="mx-5 mt-2 text-xs text-[#b45309]">{quantityError}</p>}

      {tab === "catalog" && <>
        <section className="px-5 pb-3 pt-7"><div className="rounded-3xl p-6 text-white" style={{ background: `linear-gradient(120deg, ${color}, #20223a)` }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-80">Добро пожаловать</p>
          <h2 className="text-2xl font-bold leading-tight">{shop.bot.name}</h2>
          <p className="mt-2 max-w-xs text-sm opacity-90">{shop.bot.description || "Выберите понравившееся из нашего каталога"}</p>
        </div></section>
        <section className="px-5"><div className="mb-4 mt-5 flex items-center justify-between"><h2 className="text-xl font-bold">{shop.bot.template === "delivery" ? "Наше меню" : shop.bot.template === "service" ? "Услуги" : "Каталог"}</h2><span className="text-sm text-[#667085]">{shop.items.length} позиций</span></div>
          {!shop.items.length ? <div className="rounded-2xl bg-white p-9 text-center text-sm text-[#667085]">В каталоге пока нет товаров</div> :
          <div className="grid grid-cols-2 gap-3">{shop.items.map(item => <article key={item.id} className="overflow-hidden rounded-[22px] border border-[#edf0f4] bg-white shadow-sm">
            {item.image_url ? <img src={item.image_url} alt={item.name} className="aspect-[4/3] w-full object-cover"/> : <div className="grid aspect-[4/3] place-items-center bg-[#edf0f6]"><ShoppingBag size={29} color="#98a2b3"/></div>}
            <div className="p-3"><h3 className="line-clamp-2 min-h-10 text-sm font-semibold">{item.name}</h3><p className="mb-3 line-clamp-2 min-h-8 text-xs text-[#98a2b3]">{item.description}</p>
              <div className="flex items-center justify-between gap-1"><span className="text-sm font-bold">{item.price_minor == null ? "По запросу" : money(Number(item.price_minor), item.currency)}</span></div>
              {item.price_minor != null && <div className="mt-3 flex justify-end">{cart[item.id] ? <div className="flex items-center gap-3"><button className="grid size-9 place-items-center rounded-full bg-[#f2f4f7]" onClick={()=>adjust(item.id,-1)} aria-label="Убрать"><Minus size={16}/></button><b>{cart[item.id]}</b><button className="grid size-9 place-items-center rounded-full text-white" style={{backgroundColor:color}} onClick={()=>adjust(item.id,1)} aria-label="Добавить"><Plus size={16}/></button></div> :
                <button className="flex h-9 items-center gap-1 rounded-full px-4 text-sm font-semibold text-white" style={{backgroundColor:color}} onClick={()=>adjust(item.id,1)}><Plus size={16}/> Добавить</button>}</div>}
            </div></article>)}</div>}
        </section>
      </>}

      {tab === "cart" && <section className="px-5 pt-7"><div className="flex items-center gap-3"><button onClick={()=>setTab("catalog")} aria-label="Назад"><ArrowLeft/></button><h2 className="text-2xl font-bold">Корзина</h2></div>
        {!selected.length ? <div className="mt-8 rounded-2xl bg-white p-10 text-center"><ShoppingBag className="mx-auto mb-3 text-[#98a2b3]"/><p className="text-[#667085]">Корзина пока пуста</p><button onClick={()=>setTab("catalog")} className="mt-4 font-semibold underline">Открыть каталог</button></div> :
        <><div className="mt-6 space-y-3">{selected.map(item=><article key={item.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
          {item.image_url ? <img src={item.image_url} alt="" className="size-16 rounded-xl object-cover"/> : <span className="grid size-16 place-items-center rounded-xl bg-[#f2f4f7]"><ShoppingBag/></span>}
          <div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{item.name}</h3><span className="text-sm text-[#667085]">{money(Number(item.price_minor ?? 0), item.currency)}</span></div>
          <div className="flex items-center gap-2"><button onClick={()=>adjust(item.id,-1)} aria-label="Уменьшить"><Minus size={17}/></button><b>{cart[item.id]}</b><button onClick={()=>adjust(item.id,1)} aria-label="Увеличить"><Plus size={17}/></button></div>
        </article>)}</div>
          <div className="mt-6 rounded-2xl bg-white p-5"><h3 className="mb-4 font-bold">Оформление заказа</h3><label className="mb-3 block text-sm">Имя получателя<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} className="mt-1 block h-12 w-full rounded-xl border border-[#d0d5dd] px-3 outline-none focus:border-[#667085]" placeholder="Ваше имя"/></label>
            <div className="mb-3 grid grid-cols-2 gap-2"><button onClick={()=>setFulfillment("pickup")} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm ${fulfillment==="pickup"?"border-[#101828] bg-[#f2f4f7]":"border-[#d0d5dd]"}`}><Store size={16}/> Самовывоз</button><button onClick={()=>setFulfillment("delivery")} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm ${fulfillment==="delivery"?"border-[#101828] bg-[#f2f4f7]":"border-[#d0d5dd]"}`}><Truck size={16}/> Доставка</button></div>
            {fulfillment==="delivery" && <label className="block text-sm">Адрес доставки<textarea value={address} onChange={e=>setAddress(e.target.value)} maxLength={500} className="mt-1 block min-h-20 w-full rounded-xl border border-[#d0d5dd] p-3" placeholder="Улица, дом, квартира"/></label>}
            <div className="my-4 flex items-center justify-between border-t border-[#eaecf0] pt-4"><span className="text-[#667085]">Итого</span><b className="text-xl">{money(total,currency)}</b></div>
            <p className="mb-4 text-xs text-[#667085]">Оплата при получении. Стоимость доставки уточняется магазином.</p>
            <button onClick={checkout} disabled={sending || !name.trim() || (fulfillment==="delivery" && !address.trim())} style={{backgroundColor:color}} className="w-full rounded-xl py-4 font-semibold text-white disabled:opacity-50">{sending?"Оформляем…":"Оформить заказ"}</button>
          </div>
        </>}
      </section>}

      {tab === "profile" && <section className="px-5 pt-7"><UserRound className="mb-3 size-9" style={{color}}/><h2 className="text-2xl font-bold">Профиль</h2><p className="mt-3 text-sm text-[#667085]">Заказы оформляются через Telegram. История заказов появится в следующем обновлении.</p></section>}
    </div>

    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#e4e7ec] bg-white pb-[max(env(safe-area-inset-bottom),8px)]">
      <div className="mx-auto flex max-w-[550px] items-center justify-around p-2">
        {([{id:"catalog",label:"Каталог",icon:Store},{id:"cart",label:`Корзина${count?` · ${count}`:""}`,icon:ShoppingBag},{id:"profile",label:"Профиль",icon:UserRound}] as const).map(entry=>{
          const Icon=entry.icon;const active=tab===entry.id;
          return <button key={entry.id} onClick={()=>setTab(entry.id)} className="flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium" style={{color:active?color:"#98a2b3"}}><Icon size={23} strokeWidth={active?2.4:1.8}/>{entry.label}</button>;
        })}
      </div>
    </nav>
  </main>;
}
