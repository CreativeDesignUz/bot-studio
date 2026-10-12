"use client";
import { useEffect, useState } from "react";
import { ExternalLink, ImagePlus, Moon, ShoppingBag, Sun } from "lucide-react";

type TemplateType="delivery"|"store"|"service";
type Category={id:string;name:string};
type Item={id:string;name:string;image_url?:string|null;price_minor?:number|null;currency?:string};
type Banner={enabled:boolean;title:string;description:string;imageUrl:string;buttonEnabled:boolean;buttonText:string;linkType:"category"|"product"|"page"|"external";target:string};
type Design={layout:"food01"|"food02";color:string;dark:boolean;themeMode:"light"|"dark"|"customer";defaultTheme:"system"|"light"|"dark";banner:Banner};
const initial:Design={layout:"food01",color:"#E65D35",dark:false,themeMode:"light",defaultTheme:"system",banner:{enabled:true,title:"Добро пожаловать",description:"Выбирайте товары и услуги прямо в Telegram",imageUrl:"",buttonEnabled:false,buttonText:"Смотреть каталог",linkType:"page",target:"catalog"}};
const telegramData=()=> (window as typeof window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
const money=(minor:number,currency="UZS")=>`${Math.round(minor/100).toLocaleString("ru-RU")} ${currency==="USD"?"$":"сум"}`;

export default function MiniAppAppearance({botId,templateType}:{botId:string;templateType:TemplateType}){
 const [design,setDesign]=useState<Design>(initial);
 const [categories,setCategories]=useState<Category[]>([]);
 const [items,setItems]=useState<Item[]>([]);
 const [previewTheme,setPreviewTheme]=useState<"light"|"dark">("light");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const update=(change:Partial<Design>)=>setDesign(d=>({...d,...change}));
 const banner=(change:Partial<Banner>)=>setDesign(d=>({...d,banner:{...d.banner,...change}}));
 useEffect(()=>{
  const abort=new AbortController();
  async function load(){
   setLoading(true);setError("");setMessage("");
   try{
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(botId))throw new Error("Не удалось определить выбранного бота. Обновите кабинет.");
    const headers={"x-telegram-init-data":telegramData()};
    const [dr,cr,ir]=await Promise.all([
     fetch("/api/miniapp/design?bot="+encodeURIComponent(botId),{headers,signal:abort.signal,cache:"no-store"}),
     fetch("/api/catalog/categories?bot="+encodeURIComponent(botId),{headers,signal:abort.signal,cache:"no-store"}),
     fetch("/api/catalog?bot="+encodeURIComponent(botId),{headers,signal:abort.signal,cache:"no-store"})
    ]);
    const [db,cb,ib]=await Promise.all([dr.json(),cr.json(),ir.json()]) as [{error?:string;design?:Partial<Design>},{categories?:Category[]},{items?:Item[]}];
    if(!dr.ok)throw new Error(db.error??"Не удалось загрузить оформление Mini App");
    if(!abort.signal.aborted){
     const loaded={...initial,...db.design,banner:{...initial.banner,...db.design?.banner}};
     setDesign(loaded);setPreviewTheme(loaded.themeMode==="dark"?"dark":loaded.defaultTheme==="dark"?"dark":"light");
     setCategories(cr.ok?cb.categories??[]:[]);setItems(ir.ok?ib.items??[]:[]);
    }
   }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Ошибка загрузки");}
   finally{if(!abort.signal.aborted)setLoading(false);}
  }
  void load();return()=>abort.abort();
 },[botId]);
 async function save(){
  setSaving(true);setMessage("");setError("");
  try{
   const res=await fetch("/api/miniapp/design",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({botId,initData:telegramData(),...design,dark:design.themeMode==="dark"})});
   const body=await res.json() as {error?:string};
   if(!res.ok)throw new Error(body.error??"Не удалось сохранить");
   setMessage("Черновик сохранён. Проверьте его в предпросмотре и опубликуйте, когда всё готово.");
  }catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}
  finally{setSaving(false);}
 }
 const field="w-full rounded-xl border border-[#d0d5dd] bg-white px-3 py-2.5 text-sm text-[#101828] outline-none focus:border-[#6541f5]";
 const label="mb-1.5 block text-xs font-semibold text-[#475467]";
 const isDark=previewTheme==="dark";
 const paper=isDark?"#20242a":"#ffffff",page=isDark?"#111418":"#f6f7f9",ink=isDark?"#f9fafb":"#18212b",muted=isDark?"#aeb6c2":"#667085";
 const itemName=templateType==="delivery"?"блюдо":templateType==="service"?"услугу":"товар";
 if(loading)return <div className="rounded-2xl bg-white p-8 text-sm">Загрузка настроек Mini App…</div>;
 return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
  <div className="space-y-5 rounded-2xl border border-[#e4e7ec] bg-white p-5 sm:p-6">
   <div><h2 className="text-xl font-semibold">Оформление Mini App</h2><p className="mt-1 text-sm text-[#667085]">Цвет, дизайн, светлая и тёмная темы. Справа показывается текущий черновик.</p></div>
   {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   {message&&<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
   <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
    <label><span className={label}>Вид каталога</span><select className={field} value={design.layout} onChange={e=>update({layout:e.target.value as Design["layout"]})}><option value="food01">Список с крупными карточками</option><option value="food02">Компактная сетка</option></select></label>
    <label><span className={label}>Основной цвет</span><div className="flex gap-2"><input type="color" value={design.color} onChange={e=>update({color:e.target.value})} aria-label="Выбрать цвет" className="h-10 w-14 cursor-pointer rounded-lg"/><input className={field} value={design.color} onChange={e=>update({color:e.target.value})} maxLength={7}/></div></label>
    <label><span className={label}>Тема для покупателей</span><select className={field} value={design.themeMode} onChange={e=>{const mode=e.target.value as Design["themeMode"];update({themeMode:mode,dark:mode==="dark"});if(mode!=="customer")setPreviewTheme(mode)}}><option value="light">Только светлая</option><option value="dark">Только тёмная</option><option value="customer">Покупатель выбирает сам</option></select></label>
    {design.themeMode==="customer"&&<label><span className={label}>Тема при первом открытии</span><select className={field} value={design.defaultTheme} onChange={e=>{const mode=e.target.value as Design["defaultTheme"];update({defaultTheme:mode});if(mode!=="system")setPreviewTheme(mode)}}><option value="system">Как в Telegram</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label>}
   </div>
   <div className="space-y-4 border-t pt-4">
    <div className="flex justify-between gap-3"><div><h3 className="font-semibold">Баннер на главной</h3><p className="text-xs text-[#667085]">Показывается над каталогом</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={design.banner.enabled} onChange={e=>banner({enabled:e.target.checked})}/>Показывать</label></div>
    {design.banner.enabled&&<>
     <label className="block"><span className={label}>Заголовок</span><input className={field} maxLength={100} value={design.banner.title} onChange={e=>banner({title:e.target.value})}/></label>
     <label className="block"><span className={label}>Описание</span><textarea rows={2} maxLength={300} className={field} value={design.banner.description} onChange={e=>banner({description:e.target.value})}/></label>
     <label className="block"><span className={label}>Изображение баннера (HTTPS)</span><input type="url" className={field} value={design.banner.imageUrl} onChange={e=>banner({imageUrl:e.target.value})} placeholder="https://example.com/banner.jpg"/></label>
     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={design.banner.buttonEnabled} onChange={e=>banner({buttonEnabled:e.target.checked})}/>Кнопка на баннере</label>
     {design.banner.buttonEnabled&&<div className="grid gap-3 sm:grid-cols-2">
      <label><span className={label}>Название кнопки</span><input className={field} maxLength={50} value={design.banner.buttonText} onChange={e=>banner({buttonText:e.target.value})}/></label>
      <label><span className={label}>Действие кнопки</span><select className={field} value={design.banner.linkType} onChange={e=>banner({linkType:e.target.value as Banner["linkType"],target:e.target.value==="page"?"catalog":""})}><option value="page">Раздел Mini App</option><option value="category">Категория</option><option value="product">{templateType==="delivery"?"Блюдо":templateType==="service"?"Услуга":"Товар"}</option><option value="external">Внешняя ссылка</option></select></label>
      <label className="sm:col-span-2"><span className={label}>Куда ведёт кнопка</span>{design.banner.linkType==="external"?<input className={field} type="url" placeholder="https://example.com" value={design.banner.target} onChange={e=>banner({target:e.target.value})}/>:<select className={field} value={design.banner.target} onChange={e=>banner({target:e.target.value})}><option value="">Выберите назначение</option>{(design.banner.linkType==="page"?[{id:"catalog",name:"Каталог"},{id:"cart",name:"Корзина"},{id:"profile",name:"Профиль"}]:design.banner.linkType==="category"?categories:items).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>}</label>
     </div>}
    </>}
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-xs text-[#667085]">Покупатели увидят изменения только после публикации.</span><div className="flex flex-wrap gap-2"><a href={`/miniapp?bot=${encodeURIComponent(botId)}&preview=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#d0d5dd] px-4 py-3 text-sm font-semibold no-underline">Открыть превью <ExternalLink className="size-4"/></a><button disabled={saving||!/^#[0-9A-F]{6}$/i.test(design.color)} onClick={()=>void save()} className="rounded-xl bg-[#6541f5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving?"Сохранение…":"Сохранить черновик"}</button></div></div>
  </div>
  <aside className="xl:sticky xl:top-[92px] xl:h-fit"><div className="mb-3 flex items-center justify-between"><strong className="text-sm">Предпросмотр</strong><div className="flex rounded-xl bg-white p-1 shadow-sm"><button type="button" onClick={()=>setPreviewTheme("light")} aria-label="Светлая тема" className={`grid size-8 place-items-center rounded-lg ${!isDark?"bg-[#f0ecff] text-[#6541f5]":"text-[#98a2b3]"}`}><Sun className="size-4"/></button><button type="button" onClick={()=>setPreviewTheme("dark")} aria-label="Тёмная тема" className={`grid size-8 place-items-center rounded-lg ${isDark?"bg-[#344054] text-white":"text-[#98a2b3]"}`}><Moon className="size-4"/></button></div></div>
   <div className="mx-auto max-w-[360px] overflow-hidden rounded-[34px] border-[7px] border-[#101828] shadow-[0_24px_60px_rgba(16,24,40,.18)]" style={{background:page,color:ink}}><div className="min-h-[590px] p-4">
    {design.banner.enabled&&<div className="relative overflow-hidden rounded-[22px] p-5" style={{background:isDark?"#302b35":"#f0ecff"}}><div className="relative z-10 max-w-[70%]"><h3 className="text-lg font-bold">{design.banner.title||"Ваш баннер"}</h3><p className="mt-2 text-xs leading-5" style={{color:muted}}>{design.banner.description||"Описание предложения"}</p>{design.banner.buttonEnabled&&<span className="mt-3 inline-flex rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{background:design.color}}>{design.banner.buttonText||"Открыть"}</span>}</div>{design.banner.imageUrl.startsWith("https://")&&<img src={design.banner.imageUrl} alt="" className="absolute -bottom-3 -right-5 size-28 rounded-full object-cover"/>}</div>}
    <h3 className="mb-3 mt-5 font-bold">{templateType==="delivery"?"Популярные блюда":templateType==="service"?"Услуги":"Каталог"}</h3><div className={design.layout==="food02"?"grid grid-cols-2 gap-2":"space-y-2"}>{items.slice(0,4).map(item=><article key={item.id} className={design.layout==="food02"?"overflow-hidden rounded-2xl p-2":"flex items-center gap-3 rounded-2xl p-3"} style={{background:paper}}>{item.image_url?<img src={item.image_url} alt="" className={design.layout==="food02"?"aspect-[4/3] w-full rounded-xl object-cover":"size-16 shrink-0 rounded-xl object-cover"}/>:<span className={`${design.layout==="food02"?"aspect-[4/3] w-full":"size-16 shrink-0"} grid place-items-center rounded-xl`} style={{background:design.color}}><ShoppingBag className="size-5 text-white"/></span>}<div className="min-w-0 flex-1"><strong className="line-clamp-2 text-xs">{item.name}</strong><span className="mt-1 block text-[11px]" style={{color:muted}}>{item.price_minor==null?"По запросу":money(item.price_minor,item.currency)}</span></div></article>)}</div>{items.length===0&&<div className="grid min-h-40 place-items-center rounded-2xl border border-dashed p-5 text-center text-xs" style={{borderColor:isDark?"#475467":"#d0d5dd",color:muted}}><span><ImagePlus className="mx-auto mb-2 size-6"/>Добавьте первый {itemName}, и он появится здесь</span></div>}
   </div></div>
  </aside>
 </section>;
}
