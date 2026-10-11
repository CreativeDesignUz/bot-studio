"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Minus, Plus, Search, ShoppingBag, Store, Truck, UserRound, X } from "lucide-react";
import ServiceMiniApp from "./service-miniapp";

type Item = { id: string; name: string; description: string; image_url: string | null; price_minor: number | null; currency: string; category_id?:string|null;ingredients?:string[];allergens?:string[];preparation_minutes?:number|null };
type Shop = { bot: { id: string; name: string; description: string; logoUrl: string | null; color: string; template: string }; items: Item[]; categories?:{id:string;name:string;position:number}[]; design?:{layout?:"food01"|"food02";color?:string;dark?:boolean;themeMode?:"light"|"dark"|"customer";defaultTheme?:"system"|"light"|"dark";banner?:{enabled:boolean;title:string;description:string;imageUrl:string;buttonEnabled:boolean;buttonText:string;linkType:"category"|"product"|"page"|"external";target:string}}|null };
type Tab = "catalog" | "cart" | "profile";

const money = (value: number, currency = "UZS") => new Intl.NumberFormat("ru-RU", {
  style: "currency", currency, maximumFractionDigits: currency === "UZS" ? 0 : 2,
}).format(value / 100);

export default function MiniAppPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [customerTheme,setCustomerTheme]=useState<"light"|"dark"|null>(null);
  const [telegramTheme,setTelegramTheme]=useState<"light"|"dark">("light");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("catalog");
  const [category,setCategory]=useState("all");
  const [foodSearch,setFoodSearch]=useState("");
  const [detailId,setDetailId]=useState<string|null>(null);
  const [showFoodCategories,setShowFoodCategories]=useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [quantityError, setQuantityError] = useState("");
  const checkoutKey = useRef<string | null>(null);

  useEffect(() => {
    const telegram = (window as typeof window & { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void; initData?: string; initDataUnsafe?: { user?: { first_name?: string } } } } }).Telegram?.WebApp;
    telegram?.ready?.(); telegram?.expand?.();
    const botId = new URLSearchParams(window.location.search).get("bot");
    if (!botId) { Promise.resolve().then(() => { setError("Не указан магазин"); setLoading(false); }); return; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetch("/api/miniapp?bot=" + encodeURIComponent(botId), { cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json() as Shop & { error?: string }; if (!response.ok) throw new Error(body.error ?? "Не удалось загрузить магазин"); return body as Shop; })
      .then(data => { if (!controller.signal.aborted) { setShop(data); setError(""); } })
      .catch(e => {
        if (controller.signal.aborted && !controller.signal.reason) return;
        setError(controller.signal.aborted ? "Сервер не ответил за 12 секунд. Проверьте интернет и попробуйте снова." : e instanceof Error ? e.message : "Ошибка загрузки");
      })
      .finally(() => { clearTimeout(timeout); setLoading(false); });
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [retryCount]);

  useEffect(()=>{
    const telegram=(window as typeof window & {Telegram?:{WebApp?:{colorScheme?:string;onEvent?:(name:string,cb:()=>void)=>void;offEvent?:(name:string,cb:()=>void)=>void;setHeaderColor?:(color:string)=>void;setBackgroundColor?:(color:string)=>void}}}).Telegram?.WebApp;
    const sync=()=>setTelegramTheme(telegram?.colorScheme==="dark"?"dark":"light");
    sync();telegram?.onEvent?.("themeChanged",sync);
    return ()=>telegram?.offEvent?.("themeChanged",sync);
  },[]);
  useEffect(()=>{
    if(!shop)return;
    queueMicrotask(()=>{try{const saved=localStorage.getItem("miniapp-theme:"+shop.bot.id);setCustomerTheme(saved==="light"||saved==="dark"?saved:null);}catch{setCustomerTheme(null);}});
  },[shop?.bot.id]);
  function setBuyerTheme(next:"light"|"dark"){
    setCustomerTheme(next);
    if(shop)try{localStorage.setItem("miniapp-theme:"+shop.bot.id,next);}catch{}
  }
  function bannerAction(){
    const b=shop?.design?.banner;
    if(!b?.buttonEnabled)return;
    if(b.linkType==="external"){
      const webApp=(window as typeof window & {Telegram?:{WebApp?:{openLink?:(url:string)=>void}}}).Telegram?.WebApp;
      try{const url=new URL(b.target);if(url.protocol!=="https:")return; if(webApp?.openLink)webApp.openLink(url.toString());else window.open(url.toString(),"_blank","noopener,noreferrer");}catch{}
    }else if(b.linkType==="page" && ["catalog","cart","profile"].includes(b.target)){
      setTab(b.target as Tab);setShowFoodCategories(false);
    }else if(b.linkType==="category" && shop?.categories?.some(c=>c.id===b.target)){
      setCategory(b.target);setTab("catalog");setShowFoodCategories(true);
    }else if(b.linkType==="product" && shop?.items.some(i=>i.id===b.target)){
      setDetailId(b.target);setTab("catalog");
    }
  }

  const count = Object.values(cart).reduce((total, value) => total + value, 0);
  const selected = useMemo(() => (shop?.items ?? []).filter(item => cart[item.id] > 0), [shop, cart]);
  const total = selected.reduce((sum, item) => sum + Number(item.price_minor ?? 0) * cart[item.id], 0);
  const currency = selected[0]?.currency ?? "UZS";
  const mixedCurrency = new Set(selected.map(item => item.currency)).size > 1;
  const isFood=shop?.bot.template==="delivery";
  const themeMode=shop?.design?.themeMode??(shop?.design?.dark?"dark":"light");
  const defaultTheme=shop?.design?.defaultTheme??"system";
  const preferredTheme=customerTheme??(defaultTheme==="system"?telegramTheme:defaultTheme);
  const dark=isFood&&(themeMode==="dark"||(themeMode==="customer"&&preferredTheme==="dark"));
  const foodStyle=shop?.design?.layout==="food02"?"food02":"food01";
  const color = isFood&&/^#[\da-f]{6}$/i.test(shop?.design?.color??"")?shop!.design!.color!: /^#[\da-f]{6}$/i.test(shop?.bot.color ?? "") ? shop!.bot.color : "#6541F5";
  const paper=dark?"#20242A":"#fff";const pageBg=dark?"#111418":"#f7f8fa";const ink=dark?"#f9fafb":"#18212b";const hint=dark?"#abb3c1":"#687281";
  useEffect(()=>{
    if(!shop||shop.bot.template!=="delivery")return;
    const webApp=(window as typeof window & {Telegram?:{WebApp?:{setHeaderColor?:(color:string)=>void;setBackgroundColor?:(color:string)=>void}}}).Telegram?.WebApp;
    webApp?.setHeaderColor?.(dark?"#20242A":"#edf0f2");
    webApp?.setBackgroundColor?.(dark?"#111418":"#f7f8fa");
  },[dark,shop?.bot.id]);
  const detailItem=(shop?.items??[]).find(item=>item.id===detailId);
  const visibleFood=(shop?.items??[]).filter(x=>(category==="all"||x.category_id===category)&&[x.name,x.description].join(" ").toLowerCase().includes(foodSearch.trim().toLowerCase()));

  function adjust(id: string, delta: number) {
    checkoutKey.current = null;
    setQuantityError("");
    setCart(current => {
      const next = Math.max(0, Math.min(99, (current[id] ?? 0) + delta));
      if (next === 99 && delta > 0) setQuantityError("Не более 99 единиц одного товара");
      return { ...current, [id]: next };
    });
  }

  async function checkout() {
    if (!shop || sending || !selected.length) return;
    if (mixedCurrency) { setError("В одном заказе нельзя смешивать сумы и доллары. Выберите позиции в одной валюте."); return; }
    const telegram = (window as typeof window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    if (!telegram?.initData) { setError("Для оформления заказа откройте магазин через Telegram"); return; }
    checkoutKey.current ??= crypto.randomUUID().replaceAll("-", "");
    setError(""); setSending(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/miniapp", {
        method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ botId: shop.bot.id, initData: telegram.initData, requestKey: checkoutKey.current, name, fulfillment, address,
          items: selected.map(item => ({ id: item.id, quantity: cart[item.id] })) }),
      });
      const body = await response.json() as { error?: string; orderId?: string };
      if (!response.ok) throw new Error(body.error ?? "Не удалось оформить заказ");
      setSuccess(body.orderId ?? ""); setCart({}); checkoutKey.current = null; setTab("catalog");
    } catch (e) {
      setError(controller.signal.aborted
        ? "Не удалось получить подтверждение заказа за 15 секунд. Проверьте заказы перед повтором: запрос мог быть принят рестораном."
        : e instanceof Error ? e.message : "Ошибка заказа");
    } finally { clearTimeout(timeout); setSending(false); }
  }

  if (loading) return <main className="grid min-h-dvh place-items-center text-[#667085]">Загружаем магазин…</main>;
  if (!shop) return <main className="grid min-h-dvh place-items-center p-6 text-center"><div><ShoppingBag className="mx-auto mb-4 size-10 text-[#98a2b3]"/><h1 className="text-xl font-bold">Магазин недоступен</h1><p role="alert" className="mt-2 text-[#667085]">{error}</p><button type="button" className="mt-5 rounded-xl bg-[#6541F5] px-5 py-3 font-semibold text-white" onClick={()=>{setError("");setLoading(true);setRetryCount(x=>x+1)}}>Попробовать снова</button></div></main>;

  if (shop.bot.template === "service") return <ServiceMiniApp shop={shop}/>;

  return <main className="min-h-dvh pb-28" style={{fontFamily:"Inter,system-ui,sans-serif",background:pageBg,color:ink}}>
    <div className="mx-auto max-w-[550px]">
      {isFood&&themeMode==="customer"&&<div className="flex justify-end gap-2 px-5 pt-2 text-xs"><button type="button" aria-pressed={!dark} onClick={()=>setBuyerTheme("light")} className="rounded-full px-3 py-1" style={{background:!dark?color:paper,color:!dark?"white":ink}}>Светлая</button><button type="button" aria-pressed={!!dark} onClick={()=>setBuyerTheme("dark")} className="rounded-full px-3 py-1" style={{background:dark?color:paper,color:dark?"white":ink}}>Тёмная</button></div>}

      {isFood?<div className="px-5 pt-4"><p className="text-sm font-semibold" style={{color:ink}}>{shop.bot.name}</p></div>:
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#e9edf2] bg-white/95 px-5 py-4 backdrop-blur">
        {shop.bot.logoUrl ? <img src={shop.bot.logoUrl} alt="" className="size-12 rounded-2xl object-cover"/> :
          <span className="grid size-12 place-items-center rounded-2xl text-white" style={{ backgroundColor: color }}><Store className="size-6"/></span>}
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold">{shop.bot.name}</h1><p className="truncate text-xs text-[#667085]">{shop.bot.description || "Добро пожаловать!"}</p></div>
        <span className="rounded-full bg-[#f0fdf4] px-3 py-1 text-xs font-semibold text-[#15803d]">Открыто</span>
      </header>}
      {success && <section className="m-4 rounded-2xl border border-[#c3ebd0] bg-[#ecfdf3] p-5">
        <Check className="mb-2 text-[#12a150]"/><h2 className="font-bold">Заказ принят!</h2>
        <p className="mt-1 text-sm text-[#3a6650]">Номер заказа: {success.slice(0, 8).toUpperCase()}. Магазин получил вашу заявку.</p>
        <button onClick={() => setSuccess("")} className="mt-3 text-sm font-semibold underline">Закрыть</button>
      </section>}
      {error && <div className="m-4 flex items-start justify-between gap-2 rounded-xl bg-[#fff1f2] p-3 text-sm text-[#be123c]"><span>{error}</span><button onClick={()=>setError("")} aria-label="Закрыть"><X size={16}/></button></div>}
      {quantityError && <p className="mx-5 mt-2 text-xs text-[#b45309]">{quantityError}</p>}

      {tab === "catalog" && (isFood? <section className="px-5 pb-7 pt-7">
        <div className="flex items-center justify-between">
          <h1 className="text-[25px] font-bold leading-tight">{showFoodCategories?"Категории":foodStyle==="food01"?"Что будем есть?":"Доставка любимой еды"}</h1>
          {!showFoodCategories&&<button onClick={()=>setShowFoodCategories(true)} className="text-xs font-semibold" style={{color}}>Все категории →</button>}
          {showFoodCategories&&<button onClick={()=>{setShowFoodCategories(false);setCategory("all")}} className="text-xs font-semibold" style={{color}}>Главная</button>}
        </div>
        <label className="mt-6 flex h-[45px] items-center gap-3 rounded-[12px] px-4" style={{background:paper,color:hint}}><Search size={17}/><input value={foodSearch} onChange={e=>setFoodSearch(e.target.value)} placeholder="Поиск и фильтры" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" style={{color:ink}}/></label>
        {showFoodCategories?<>
          <div className="mt-6 grid grid-cols-2 gap-[10px]">{shop.categories?.map(c=><button key={c.id} onClick={()=>setCategory(c.id)} className="h-[46px] rounded-[13px] px-[14px] text-left text-[13px] font-semibold" style={{background:category===c.id?(dark?"#45302e":"#fff0e8"):paper,color:ink,border:category===c.id?`1px solid ${color}`:"1px solid transparent"}}>{c.name}</button>)}</div>
          <div className="mt-7 space-y-3">{visibleFood.map(item=><article key={item.id} className="flex min-h-[92px] items-center gap-3 overflow-hidden rounded-[14px] p-3" style={{background:dark?"#302623":"#fff0e8"}}>
            {item.image_url?<img src={item.image_url} loading="lazy" decoding="async" className="h-[68px] w-[68px] rounded-[11px] object-cover" alt={item.name}/>:<div className="grid h-[68px] w-[68px] rounded-[11px] place-items-center" style={{background:color}}><ShoppingBag className="text-white"/></div>}
            <div className="min-w-0 flex-1"><button type="button" onClick={()=>setDetailId(item.id)} className="truncate text-left text-[14px] font-semibold underline-offset-2 hover:underline">{item.name}</button><p className="mt-1 text-xs" style={{color:hint}}>{item.price_minor==null?"По запросу":money(Number(item.price_minor),item.currency)}</p></div>
            <button aria-label={`Добавить ${item.name}`} onClick={()=>adjust(item.id,1)} className="grid size-8 shrink-0 place-items-center rounded-full text-white" style={{background:color}}><Plus size={16}/></button>
          </article>)}</div>
        </>:<>
          {shop.design?.banner?.enabled!==false&&<div className="relative mt-5 overflow-hidden rounded-[21px] p-5" style={{background:foodStyle==="food01"?(dark?"#452c27":"#fff0e8"):color,minHeight:155}}>
           <div className="relative z-10 max-w-[66%]"><p className="text-[10px] font-semibold uppercase tracking-wider" style={{color:foodStyle==="food01"?color:"#fff"}}>Готовим с любовью</p><h2 className="mt-2 text-[21px] font-bold leading-tight" style={{color:foodStyle==="food01"?ink:"#fff"}}>{shop.design?.banner?.title||"Вкусная еда рядом"}</h2><p className="mt-2 text-xs" style={{color:foodStyle==="food01"?hint:"#fff"}}>{shop.design?.banner?.description||"Выбирайте любимые блюда и оформляйте заказ"}</p>
           {shop.design?.banner?.buttonEnabled&&<button type="button" onClick={bannerAction} className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold" style={{background:foodStyle==="food01"?color:"#fff",color:foodStyle==="food01"?"#fff":color}}>{shop.design.banner.buttonText}</button>}</div>
           {(shop.design?.banner?.imageUrl||shop.items[0]?.image_url)&&<img src={shop.design?.banner?.imageUrl||shop.items[0]?.image_url||""} alt="" className="absolute -bottom-3 -right-6 size-[145px] rounded-full object-cover"/>}
          </div>}
          <div className="mt-6 flex items-center justify-between"><h2 className="text-lg font-bold">Категории</h2><button onClick={()=>setShowFoodCategories(true)} className="text-xs font-semibold" style={{color}}>Все →</button></div>
          <div className={foodStyle==="food01"?"mt-3 grid grid-cols-2 gap-2":"mt-3 flex gap-2 overflow-x-auto pb-2"}>{(shop.categories??[]).slice(0,6).map(c=><button key={c.id} onClick={()=>{setCategory(c.id);setShowFoodCategories(true)}} className={foodStyle==="food01"?"h-[46px] rounded-[13px] px-[14px] text-left text-[13px] font-semibold":"shrink-0 rounded-[13px] px-4 py-3 text-[13px] font-semibold"} style={{background:paper}}>{c.name}</button>)}</div>
          <h2 className="mb-3 mt-7 text-lg font-bold">Популярные блюда</h2>
          <div className={foodStyle==="food01"?"space-y-3":"grid grid-cols-2 gap-3"}>{visibleFood.length===0&&<p className="text-sm" style={{color:hint}}>Блюда не найдены</p>}{visibleFood.map(item=><article key={item.id} className={foodStyle==="food01"?"flex items-center gap-3 rounded-[14px] p-3":"overflow-hidden rounded-[16px] p-2"} style={{background:paper}}>
           {item.image_url?<img src={item.image_url} alt={item.name} loading="lazy" decoding="async" className={foodStyle==="food01"?"h-[78px] w-[92px] rounded-[11px] object-cover":"aspect-[4/3] w-full rounded-[12px] object-cover"}/>:<div className="grid h-[78px] w-[92px] place-items-center rounded-xl" style={{background:color}}><ShoppingBag className="text-white"/></div>}
           <div className="min-w-0 flex-1"><button type="button" onClick={()=>setDetailId(item.id)} className="mt-2 line-clamp-2 text-left text-[14px] font-semibold underline-offset-2 hover:underline">{item.name}</button><p className="mt-1 text-xs" style={{color:hint}}>{item.price_minor==null?"По запросу":money(Number(item.price_minor),item.currency)}</p><button onClick={()=>adjust(item.id,1)} disabled={item.price_minor==null} className="mt-2 inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold text-white disabled:opacity-50" style={{background:color}}><Plus size={14}/> Добавить</button></div>
          </article>)}</div>
        </>}
      </section>:<>

        <section className="px-5 pb-3 pt-7"><div className="rounded-3xl p-6 text-white" style={{ background: `linear-gradient(120deg, ${color}, #20223a)` }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-80">Добро пожаловать</p>
          <h2 className="text-2xl font-bold leading-tight">{shop.bot.name}</h2>
          <p className="mt-2 max-w-xs text-sm opacity-90">{shop.bot.description || "Выберите понравившееся из нашего каталога"}</p>
        </div></section>
        <section className="px-5"><div className="mb-4 mt-5 flex items-center justify-between"><h2 className="text-xl font-bold">{shop.bot.template === "delivery" ? "Наше меню" : shop.bot.template === "service" ? "Услуги" : "Каталог"}</h2><span className="text-sm text-[#667085]">{shop.items.length} позиций</span></div>
          {shop.bot.template==="delivery"&&!!shop.categories?.length&&<div className="mb-4 flex gap-2 overflow-x-auto pb-2"><button type="button" onClick={()=>setCategory("all")} className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold" style={{background:category==="all"?color:"#fff",color:category==="all"?"#fff":"#667085"}}>Все блюда</button>{shop.categories.map(c=><button key={c.id} type="button" onClick={()=>setCategory(c.id)} className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold" style={{background:category===c.id?color:"#fff",color:category===c.id?"#fff":"#667085"}}>{c.name}</button>)}</div>}
          {!shop.items.length ? <div className="rounded-2xl bg-white p-9 text-center text-sm text-[#667085]">В каталоге пока нет товаров</div> :
          <div className="grid grid-cols-2 gap-3">{shop.items.filter(item=>category==="all"||item.category_id===category).map(item => <article key={item.id} className="overflow-hidden rounded-[22px] border border-[#edf0f4] bg-white shadow-sm">
            {item.image_url ? <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover"/> : <div className="grid aspect-[4/3] place-items-center bg-[#edf0f6]"><ShoppingBag size={29} color="#98a2b3"/></div>}
            <div className="p-3"><h3 className="line-clamp-2 min-h-10 text-sm font-semibold">{item.name}</h3><p className="mb-3 line-clamp-2 min-h-8 text-xs text-[#98a2b3]">{item.description}</p>
              <div className="flex items-center justify-between gap-1"><span className="text-sm font-bold">{item.price_minor == null ? "По запросу" : money(Number(item.price_minor), item.currency)}</span></div>
              {item.price_minor != null && <div className="mt-3 flex justify-end">{cart[item.id] ? <div className="flex items-center gap-3"><button className="grid size-9 place-items-center rounded-full bg-[#f2f4f7]" onClick={()=>adjust(item.id,-1)} aria-label="Убрать"><Minus size={16}/></button><b>{cart[item.id]}</b><button className="grid size-9 place-items-center rounded-full text-white" style={{backgroundColor:color}} onClick={()=>adjust(item.id,1)} aria-label="Добавить"><Plus size={16}/></button></div> :
                <button className="flex h-9 items-center gap-1 rounded-full px-4 text-sm font-semibold text-white" style={{backgroundColor:color}} onClick={()=>adjust(item.id,1)}><Plus size={16}/> Добавить</button>}</div>}
            </div></article>)}</div>}
        </section>
      
      </>)}

      {isFood&&detailItem&&<div className="fixed inset-0 z-50 grid items-end bg-black/60 p-0 sm:place-items-center sm:p-4" role="presentation" onClick={()=>setDetailId(null)}>
        <section role="dialog" aria-modal="true" aria-label={"Описание блюда "+detailItem.name} className="max-h-[88dvh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl" style={{background:paper,color:ink}} onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">О блюде</h2><button type="button" aria-label="Закрыть описание" onClick={()=>setDetailId(null)}><X/></button></div>
          {detailItem.image_url&&<img src={detailItem.image_url} alt={detailItem.name} className="mt-4 aspect-[16/9] w-full rounded-2xl object-cover"/>}
          <h3 className="mt-4 text-xl font-bold">{detailItem.name}</h3>
          <p className="mt-2 text-sm" style={{color:hint}}>{detailItem.description}</p>
          {!!detailItem.ingredients?.length&&<p className="mt-4 text-sm"><strong>Состав:</strong> {detailItem.ingredients.join(", ")}</p>}
          {!!detailItem.allergens?.length&&<p className="mt-2 text-sm"><strong>Аллергены:</strong> {detailItem.allergens.join(", ")}</p>}
          {detailItem.preparation_minutes!=null&&<p className="mt-2 text-sm">Приготовление: {detailItem.preparation_minutes} мин</p>}
          <div className="mt-5 flex items-center justify-between gap-3"><strong>{detailItem.price_minor==null?"Цена по запросу":money(detailItem.price_minor,detailItem.currency)}</strong>
          <button type="button" disabled={detailItem.price_minor==null} onClick={()=>{adjust(detailItem.id,1);setDetailId(null)}} className="rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40" style={{background:color}}>Добавить в корзину</button></div>
        </section>
      </div>}
      {tab === "cart" && <section className="px-5 pt-7" style={{color:ink}}><div className="flex items-center gap-3"><button onClick={()=>setTab("catalog")} aria-label="Назад"><ArrowLeft/></button><h2 className="text-2xl font-bold">Корзина</h2></div>
        {!selected.length ? <div className="mt-8 rounded-2xl bg-white p-10 text-center"><ShoppingBag className="mx-auto mb-3 text-[#98a2b3]"/><p className="text-[#667085]">Корзина пока пуста</p><button onClick={()=>setTab("catalog")} className="mt-4 font-semibold underline">Открыть каталог</button></div> :
        <><div className="mt-6 space-y-3">{selected.map(item=><article key={item.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
          {item.image_url ? <img src={item.image_url} alt="" className="size-16 rounded-xl object-cover"/> : <span className="grid size-16 place-items-center rounded-xl bg-[#f2f4f7]"><ShoppingBag/></span>}
          <div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{item.name}</h3><span className="text-sm text-[#667085]">{money(Number(item.price_minor ?? 0), item.currency)}</span></div>
          <div className="flex items-center gap-2"><button onClick={()=>adjust(item.id,-1)} aria-label="Уменьшить"><Minus size={17}/></button><b>{cart[item.id]}</b><button onClick={()=>adjust(item.id,1)} aria-label="Увеличить"><Plus size={17}/></button></div>
        </article>)}</div>
          <div className="mt-6 rounded-2xl bg-white p-5"><h3 className="mb-4 font-bold">Оформление заказа</h3><label className="mb-3 block text-sm">Имя получателя<input value={name} onChange={e=>{checkoutKey.current=null;setName(e.target.value)}} maxLength={100} className="mt-1 block h-12 w-full rounded-xl border border-[#d0d5dd] px-3 outline-none focus:border-[#667085]" placeholder="Ваше имя"/></label>
            <div className="mb-3 grid grid-cols-2 gap-2"><button onClick={()=>{checkoutKey.current=null;setFulfillment("pickup")}} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm ${fulfillment==="pickup"?"border-[#101828] bg-[#f2f4f7]":"border-[#d0d5dd]"}`}><Store size={16}/> Самовывоз</button><button onClick={()=>{checkoutKey.current=null;setFulfillment("delivery")}} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm ${fulfillment==="delivery"?"border-[#101828] bg-[#f2f4f7]":"border-[#d0d5dd]"}`}><Truck size={16}/> Доставка</button></div>
            {fulfillment==="delivery" && <label className="block text-sm">Адрес доставки<textarea value={address} onChange={e=>{checkoutKey.current=null;setAddress(e.target.value)}} maxLength={500} className="mt-1 block min-h-20 w-full rounded-xl border border-[#d0d5dd] p-3" placeholder="Улица, дом, квартира"/></label>}
            {mixedCurrency && <p role="alert" className="mb-3 rounded-lg bg-[#fff7ed] p-3 text-sm text-[#9a3412]">Для заказа выберите позиции в одной валюте: UZS или USD.</p>}
            <div className="my-4 flex items-center justify-between border-t border-[#eaecf0] pt-4"><span className="text-[#667085]">Итого</span><b className="text-xl">{mixedCurrency ? "Разные валюты" : money(total,currency)}</b></div>
            <p className="mb-4 text-xs text-[#667085]">Оплата при получении. Стоимость доставки уточняется магазином.</p>
            <button onClick={checkout} disabled={sending || mixedCurrency || !name.trim() || (fulfillment==="delivery" && !address.trim())} style={{backgroundColor:color}} className="w-full rounded-xl py-4 font-semibold text-white disabled:opacity-50">{sending?"Оформляем…":"Оформить заказ"}</button>
          </div>
        </>}
      </section>}

      {tab === "profile" && <section className="px-5 pt-7"><UserRound className="mb-3 size-9" style={{color}}/><h2 className="text-2xl font-bold">Профиль</h2><p className="mt-3 text-sm text-[#667085]">Заказы оформляются через Telegram. История заказов появится в следующем обновлении.</p></section>}
    </div>

    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#e4e7ec] pb-[max(env(safe-area-inset-bottom),8px)]" style={{background:dark?"#20242A":"white"}}>
      <div className="mx-auto flex max-w-[550px] items-center justify-around p-2" style={{background:dark?"#20242A":"white"}}>
        {([{id:"catalog",label:"Каталог",icon:Store},{id:"cart",label:`Корзина${count?` · ${count}`:""}`,icon:ShoppingBag},{id:"profile",label:"Профиль",icon:UserRound}] as const).map(entry=>{
          const Icon=entry.icon;const active=tab===entry.id;
          return <button key={entry.id} onClick={()=>setTab(entry.id)} className="flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium" style={{color:active?color:"#98a2b3"}}><Icon size={23} strokeWidth={active?2.4:1.8}/>{entry.label}</button>;
        })}
      </div>
    </nav>
  </main>;
}
