"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { formatCatalogPrice, formatStoredPrice, priceToMinor, type CatalogCurrency } from "@/lib/catalog/price";

type Item = { id: string; name: string; description: string; price_minor: number | null; is_active: boolean; currency: string; image_url?:string|null;category_id?:string|null; ingredients?:string[];allergens?:string[];preparation_minutes?:number|null;stock_quantity?:number|null };
type Category={id:string;name:string;position:number;is_active:boolean};
type ApiResult = { items?: Item[]; categories?:Category[]; item?: Item; created?:number; error?: string };
const formatMoney = (minor: number, currency: string) => `${formatStoredPrice(minor, currency === "USD" ? "USD" : "UZS")} ${currency === "USD" ? "$" : "сум"}`;
const telegramData = () => (window as typeof window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ?? "";

export default function CatalogManager({ botId, type }: { botId: string; type: "service" | "store" | "delivery" }) {
  const noun = type === "service" ? "услугу" : type === "delivery" ? "блюдо" : "товар";
  const [items, setItems] = useState<Item[]>([]);
  const [categories,setCategories]=useState<Category[]>([]);
  const [categoryId,setCategoryId]=useState("");
  const [categoryName,setCategoryName]=useState("");
  const [editingCategory,setEditingCategory]=useState<Category|"new"|null>(null);
  const [imageUrl,setImageUrl]=useState("");
  const [uploadingImage,setUploadingImage]=useState(false);
  const [ingredients,setIngredients]=useState("");
  const [allergens,setAllergens]=useState("");
  const [preparationMinutes,setPreparationMinutes]=useState("");
  const [chosenCategory,setChosenCategory]=useState("all");
  const [menuView,setMenuView]=useState<"items"|"categories">("items");
  const [notice,setNotice]=useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Item | null | "new">(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock,setStock]=useState("");
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
      if(type==="delivery"||type==="store"){
        const categoriesResponse=await fetch("/api/catalog/categories?bot="+encodeURIComponent(botId),{headers:{"x-telegram-init-data":telegramData()},cache:"no-store"});
        const categoriesBody=await categoriesResponse.json() as ApiResult;
        if(!categoriesResponse.ok)throw new Error(categoriesBody.error??"Не удалось загрузить категории.");
        setCategories(categoriesBody.categories??[]);
      } else setCategories([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка загрузки."); }
    finally { setLoading(false); }
  }, [botId,type]);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  async function categoryRequest(method:"POST"|"DELETE", payload:Record<string,unknown>){
    setSaving(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/catalog/categories",{method,headers:{"content-type":"application/json"},body:JSON.stringify({botId,initData:telegramData(),...payload})});
      const body=await response.json() as {error?:string};
      if(!response.ok)throw new Error(body.error??"Ошибка сохранения категории.");
      setEditingCategory(null);await refresh();setNotice("Категории обновлены.");
    }catch(e){setError(e instanceof Error?e.message:"Не удалось обновить категорию.")}
    finally{setSaving(false)}
  }
  function open(item?: Item) {
    setEditing(item ?? "new"); setName(item?.name ?? ""); setDescription(item?.description ?? "");setCategoryId(item?.category_id ?? (chosenCategory === "all" ? "" : chosenCategory));setImageUrl(item?.image_url??"");setIngredients((item?.ingredients??[]).join(", "));setAllergens((item?.allergens??[]).join(", "));setPreparationMinutes(item?.preparation_minutes==null?"":String(item.preparation_minutes));
    const nextCurrency: CatalogCurrency = item?.currency === "USD" ? "USD" : "UZS";
    setCurrency(nextCurrency);
    setStock(item?.stock_quantity == null ? "" : String(item.stock_quantity));
    setPrice(item?.price_minor == null ? "" : formatStoredPrice(item.price_minor, nextCurrency)); setActive(item?.is_active ?? true); setError("");
  }

  async function uploadImage(file:File){
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size===0||file.size>5*1024*1024){setError("Загрузите JPG, PNG или WebP до 5 МБ.");return}
    setUploadingImage(true);setError("");
    try{
      const form=new FormData();
      form.append("botId",botId);form.append("initData",telegramData());form.append("image",file);
      const response=await fetch("/api/catalog/image",{method:"POST",body:form});
      const result=await response.json() as {imageUrl?:string;error?:string};
      if(!response.ok||!result.imageUrl)throw new Error(result.error??"Не удалось загрузить фото.");
      setImageUrl(result.imageUrl);
    }catch(cause){setError(cause instanceof Error?cause.message:"Не удалось загрузить фото.");}
    finally{setUploadingImage(false);}
  }

  async function save() {
    let priceMinor: number | null;
    try { priceMinor = priceToMinor(price, currency); }
    catch { setError("Введите корректную сумму. Для UZS — целое число, для USD — максимум 2 знака после точки."); return; }
    if (!name.trim()) { setError("Введите название."); return; }
    if (stock!=="" && (!/^\d+$/.test(stock)||!Number.isSafeInteger(Number(stock))||Number(stock)>100000000)){setError("Остаток должен быть целым числом от 0 до 100 000 000.");return;}
    if(type==="delivery" && preparationMinutes!=="" && (!/^\d{1,3}$/.test(preparationMinutes)||Number(preparationMinutes)>360)) {setError("Время приготовления: от 0 до 360 минут.");return;}
    if(uploadingImage){setError("Дождитесь завершения загрузки фото.");return;}
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/catalog", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ botId, initData: telegramData(), ...(editing !== "new" && editing ? { id: editing.id } : {}),
          name: name.trim(), description: description.trim(), priceMinor, currency, stockQuantity:stock===""?null:Number(stock), isActive: active, categoryId:categoryId||null,imageUrl:imageUrl||null,
          ...(type==="delivery"?{ingredients:ingredients.split(",").map(x=>x.trim()).filter(Boolean),allergens:allergens.split(",").map(x=>x.trim()).filter(Boolean),preparationMinutes:preparationMinutes===""?null:Number(preparationMinutes)}:{}) }) });
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
      
      {(type==="delivery"||type==="store")&&<button type="button" onClick={()=>{setMenuView("categories");setEditingCategory("new");setCategoryName("")}} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d0d5dd] px-4 text-sm font-semibold">+ Категория</button>}
      <button type="button" onClick={()=>{setMenuView("items");open()}} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#101828] px-4 text-sm font-semibold !text-white"><Plus className="size-4"/>Добавить {noun}</button>
    </div>
    {(type==="delivery"||type==="store")&&<div className="flex gap-2 border-b border-[#eaecf0] px-5 py-3" role="tablist" aria-label="Управление меню">
      <button type="button" role="tab" aria-selected={menuView==="items"} onClick={()=>setMenuView("items")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${menuView==="items"?"bg-[#101828] text-white":"bg-[#f2f4f7] text-[#475467]"}`}>{type==="delivery"?"Блюда":"Товары"} ({items.length})</button>
      <button type="button" role="tab" aria-selected={menuView==="categories"} onClick={()=>setMenuView("categories")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${menuView==="categories"?"bg-[#101828] text-white":"bg-[#f2f4f7] text-[#475467]"}`}>Категории ({categories.length})</button>
    </div>}
    {notice&&<p role="status" className="mx-5 mt-4 rounded-lg bg-[#ecfdf3] p-3 text-sm text-[#027a48]">{notice}</p>}
    {error && <p role="alert" className="m-5 rounded-xl bg-[#fff1f2] p-3 text-sm text-[#be123c]">{error}</p>}
    {menuView==="items"&&(type==="delivery"||type==="store")&&categories.filter(c=>c.is_active).length>0&&<div className="flex gap-2 overflow-x-auto border-b border-[#eaecf0] px-5 py-3"><button onClick={()=>setChosenCategory("all")} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${chosenCategory==="all"?"bg-[#6541f5] text-white":"bg-[#f2f4f7] text-[#667085]"}`}>Все блюда</button>{categories.filter(c=>c.is_active).map(c=><button key={c.id} onClick={()=>{setChosenCategory(c.id);setMenuView("items")}} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${chosenCategory===c.id?"bg-[#6541f5] text-white":"bg-[#f2f4f7] text-[#667085]"}`}>{c.name}</button>)}</div>}
    {menuView==="categories"&&(type==="delivery"||type==="store")&&categories.length>0&&<div className="border-b border-[#eaecf0] px-5 py-3">
      <p className="mb-2 text-xs font-semibold text-[#667085]">Управление категориями</p>
      <div className="flex flex-wrap gap-2">{categories.map(c=><div key={c.id} className="flex items-center gap-1 rounded-lg border border-[#e4e7ec] px-2 py-1 text-xs">
        <span className={c.is_active?"text-[#344054]":"text-[#98a2b3]"}>{c.name}{!c.is_active?" (скрыта)":""}</span>
        <button type="button" aria-label={"Редактировать категорию "+c.name} onClick={()=>{setEditingCategory(c);setCategoryName(c.name)}} className="p-1"><Pencil className="size-3.5"/></button>
        <button type="button" disabled={saving} onClick={()=>void categoryRequest("POST",{id:c.id,name:c.name,position:Math.min(0,...categories.map(x=>x.position))-1,isActive:c.is_active})} className="p-1 disabled:opacity-30" aria-label={"Переместить в начало "+c.name}>⇤</button>
        <button type="button" disabled={saving} onClick={()=>void categoryRequest("POST",{id:c.id,name:c.name,position:Math.max(0,...categories.map(x=>x.position))+1,isActive:c.is_active})} className="p-1 disabled:opacity-30" aria-label={"Переместить в конец "+c.name}>⇥</button>
        <button type="button" disabled={saving} onClick={()=>void categoryRequest("POST",{id:c.id,name:c.name,position:c.position,isActive:!c.is_active})} className="p-1">{c.is_active?"Скрыть":"Показать"}</button>
        <button type="button" disabled={saving} onClick={()=>{if(window.confirm("Удалить категорию? Сначала перенесите все блюда."))void categoryRequest("DELETE",{id:c.id})}} className="p-1 text-[#b42318]" aria-label={"Удалить "+c.name}><Trash2 className="size-3.5"/></button>
      </div>)}</div>
    </div>}
    {menuView==="categories"&&!loading&&categories.length===0&&<div className="p-10 text-center text-sm text-[#667085]">Категорий пока нет. Нажмите «+ Категория», чтобы создать первую.</div>}
    {menuView==="items"&&(loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-[#667085]"><LoaderCircle className="size-4 animate-spin"/>Загружаем реальные данные…</div> :
      items.filter(item=>(chosenCategory==="all"||item.category_id===chosenCategory)&&[item.name,item.description].join(" ").toLowerCase().includes(query.toLowerCase())).length === 0
      ? <div className="p-12 text-center"><h2 className="text-lg font-semibold">Пока нет {type==="service"?"услуг":type==="delivery"?"блюд":"товаров"}</h2>
          <p className="mt-2 text-sm text-[#667085]">Добавьте первый элемент, сохраните изменения и опубликуйте приложение, чтобы покупатели увидели меню.</p>
          <button type="button" onClick={()=>open()} className="mt-5 rounded-xl bg-[#6541f5] px-5 py-3 text-sm font-semibold !text-white">Добавить {noun}</button></div>
      : <div className="divide-y divide-[#eaecf0]">{items.filter(item=>(chosenCategory==="all"||item.category_id===chosenCategory)&&[item.name,item.description].join(" ").toLowerCase().includes(query.toLowerCase())).map(item=><div key={item.id} className="flex flex-wrap items-center gap-4 p-5">
          {item.image_url&&<img src={item.image_url} alt="" className="size-16 shrink-0 rounded-xl object-cover"/>}
          <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.name}</strong><p className="mt-1 text-xs text-[#6541f5]">{categories.find(c=>c.id===item.category_id)?.name??""}</p><p className="mt-1 line-clamp-2 text-xs text-[#667085]">{item.description || "Без описания"}</p>{type==="delivery"&&item.preparation_minutes!=null&&<p className="mt-1 text-xs text-[#667085]">{item.preparation_minutes} мин · приготовление</p>}</div>
          <span className="text-sm font-semibold">{item.price_minor === null ? "Цена по запросу" : formatMoney(item.price_minor,item.currency)}</span>
          {(type==="delivery"||type==="store")&&<span className="text-xs text-[#667085]">Остаток: {item.stock_quantity===null||item.stock_quantity===undefined?"Без учёта":item.stock_quantity}</span>}
          <span className={item.is_active?"rounded-full bg-[#ecfdf3] px-2 py-1 text-xs text-[#027a48]":"rounded-full bg-[#f2f4f7] px-2 py-1 text-xs text-[#667085]"}>{item.is_active?"Активен":"Скрыт"}</span>
          <button type="button" onClick={()=>open(item)} aria-label={"Изменить "+item.name} className="grid size-10 place-items-center rounded-xl border border-[#d0d5dd]"><Pencil className="size-4"/></button>
          {item.is_active&&<button type="button" disabled={saving} onClick={()=>void archive(item)} aria-label={"Скрыть "+item.name} className="grid size-10 place-items-center rounded-xl border border-[#d0d5dd] text-[#b42318]"><Trash2 className="size-4"/></button>}
        </div>)}</div>)}
    {editingCategory!==null&&<div className="fixed inset-0 z-50 grid place-items-center bg-[#101828]/60 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{editingCategory==="new"?"Новая категория":"Редактировать категорию"}</h2><button type="button" onClick={()=>setEditingCategory(null)} aria-label="Закрыть"><X/></button></div>
      <label className="mt-5 block text-sm font-medium">Название<input maxLength={80} value={categoryName} onChange={e=>setCategoryName(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d0d5dd] px-3"/></label>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={()=>setEditingCategory(null)} className="h-11 rounded-xl border px-4">Отмена</button>
      <button type="button" disabled={saving||!categoryName.trim()} onClick={()=>void categoryRequest("POST",{...(editingCategory==="new"?{position:categories.length}:{id:editingCategory.id}),name:categoryName.trim()})} className="h-11 rounded-xl bg-[#6541f5] px-5 text-sm font-semibold !text-white disabled:opacity-60">Сохранить</button></div>
    </div></div>}
    {editing!==null&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/60 p-3 sm:p-5">
      <div role="dialog" aria-modal="true" aria-label={editing==="new"?"Добавить "+noun:"Редактировать "+noun} className="flex max-h-[min(85dvh,740px)] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#eaecf0] px-5 py-4 sm:px-6"><h2 className="text-lg font-semibold">{editing==="new"?"Добавить":"Редактировать"} {noun}</h2><button type="button" onClick={()=>setEditing(null)} aria-label="Закрыть" className="grid size-9 place-items-center rounded-lg hover:bg-[#f2f4f7]"><X size={19}/></button></div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {error&&<p role="alert" className="rounded-lg bg-[#fff1f2] p-3 text-sm text-[#be123c]">{error}</p>}<label className="block text-sm font-medium">Название<input maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d0d5dd] px-3"/></label>
          <label className="block text-sm font-medium">Описание<textarea maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[#d0d5dd] p-3"/></label>
          {(type==="delivery"||type==="store")&&<label className="block text-sm font-medium">Категория<select value={categoryId} onChange={e=>setCategoryId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#d0d5dd] px-3"><option value="">Без категории</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          <div className="space-y-3 text-sm font-medium"><p>{type==="delivery"?"Фото блюда":"Фото товара"}</p>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#d0d5dd] bg-[#f9fafb] p-4 text-center transition-colors hover:border-[#6541f5]">
             {uploadingImage?<LoaderCircle className="size-6 animate-spin text-[#6541f5]"/>:<Upload className="size-6 text-[#6541f5]"/>}
             <span className="text-sm font-semibold text-[#4420e7]">{uploadingImage?"Загружаем фото…":"Загрузить фото с устройства"}</span>
             <span className="text-xs font-normal text-[#667085]">JPG, PNG или WebP до 5 МБ</span>
             <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Загрузить фото" disabled={uploadingImage||saving} className="sr-only" onChange={event=>{const file=event.target.files?.[0];if(file)void uploadImage(file);event.currentTarget.value="";}}/>
            </label>
            {imageUrl&&/^https:\/\//i.test(imageUrl)&&<div className="relative"><img src={imageUrl} loading="lazy" alt="Предпросмотр фотографии" className="h-32 w-full rounded-xl bg-[#f2f4f7] object-cover"/><button type="button" onClick={()=>setImageUrl("")} className="absolute right-2 top-2 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold">Убрать фото</button></div>}
            <details className="text-xs font-normal text-[#667085]"><summary className="cursor-pointer">Или вставить ссылку на изображение</summary><input type="url" aria-label="HTTPS-ссылка на фото" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." className="mt-2 h-10 w-full rounded-xl border border-[#d0d5dd] px-3"/></details>
           </div>
                    {type==="delivery"&&<>
            <label className="block text-sm font-medium">Состав блюда<input value={ingredients} onChange={e=>setIngredients(e.target.value)} placeholder="Говядина, рис, морковь" className="mt-2 h-11 w-full rounded-xl border border-[#d0d5dd] px-3"/><span className="mt-1 block text-xs font-normal text-[#667085]">Разделяйте ингредиенты запятыми</span></label>
            <label className="block text-sm font-medium">Аллергены<input value={allergens} onChange={e=>setAllergens(e.target.value)} placeholder="Орехи, глютен" className="mt-2 h-11 w-full rounded-xl border border-[#d0d5dd] px-3"/></label>
            <label className="block text-sm font-medium">Время приготовления, мин<input type="number" min={0} max={360} value={preparationMinutes} onChange={e=>setPreparationMinutes(e.target.value)} placeholder="25" className="mt-2 h-11 w-full rounded-xl border border-[#d0d5dd] px-3"/></label>
          </>}
          <div className="block text-sm font-medium"><span>Цена</span><div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-[#d0d5dd] focus-within:border-[#6541f5]">
            <input aria-label="Стоимость" inputMode={currency==="UZS"?"numeric":"decimal"} value={price} onChange={e=>setPrice(formatCatalogPrice(e.target.value,currency))} placeholder={currency==="UZS"?"10 000":"100.00"} className="h-11 min-w-0 flex-1 px-3 outline-none"/>
            <select aria-label="Валюта" value={currency} onChange={e=>{const next=e.target.value as CatalogCurrency;setPrice(formatCatalogPrice(price.replace(/\s/g,"").split(".")[0],next));setCurrency(next);}} className="min-w-28 border-l border-[#d0d5dd] bg-[#f9fafb] px-3 text-sm font-semibold outline-none">
              <option value="UZS">UZS · сум</option><option value="USD">USD · $</option>
            </select></div><p className="mt-1 text-xs font-normal text-[#667085]">Валюта сохраняется вместе с ценой, конвертация не выполняется.</p></div>
          {(type==="delivery"||type==="store")&&<label className="block text-sm font-medium">Количество в наличии<input type="number" min={0} max={100000000} step={1} value={stock} onChange={e=>setStock(e.target.value)} placeholder="Не ограничено" className="mt-2 h-11 w-full rounded-xl border border-[#d0d5dd] px-3"/><span className="mt-1 block text-xs font-normal text-[#667085]">0 — скрыть у покупателя, пусто — не учитывать остаток. После заказа количество уменьшится.</span></label>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Показывать в Mini App</label></div>
        <div className="flex shrink-0 justify-end gap-3 border-t border-[#eaecf0] bg-white px-5 py-3 sm:px-6"><button type="button" onClick={()=>setEditing(null)} className="h-10 rounded-xl border px-4 text-sm">Отмена</button>
          <button type="button" disabled={saving||uploadingImage} onClick={()=>void save()} className="h-10 rounded-xl bg-[#6541f5] px-5 text-sm font-semibold !text-white disabled:opacity-60">{saving?"Сохраняем…":"Сохранить"}</button></div>
      </div></div>}
  </section>;
}
