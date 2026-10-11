"use client";
import { useEffect, useState } from "react";

type Category={id:string;name:string};
type Item={id:string;name:string};
type Banner={enabled:boolean;title:string;description:string;imageUrl:string;buttonEnabled:boolean;buttonText:string;linkType:"category"|"product"|"page"|"external";target:string};
type Design={layout:"food01"|"food02";color:string;dark:boolean;themeMode:"light"|"dark"|"customer";defaultTheme:"system"|"light"|"dark";banner:Banner};
const initial:Design={layout:"food01",color:"#E65D35",dark:false,themeMode:"light",defaultTheme:"system",banner:{enabled:true,title:"Вкусная еда рядом",description:"Выбирайте любимые блюда и оформляйте заказ",imageUrl:"",buttonEnabled:false,buttonText:"Смотреть меню",linkType:"page",target:"catalog"}};
const telegramData=()=> (window as typeof window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
export default function MiniAppAppearance({botId}:{botId:string}){
 const [design,setDesign]=useState<Design>(initial);
 const [categories,setCategories]=useState<Category[]>([]);
 const [items,setItems]=useState<Item[]>([]);
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
    const headers={"x-telegram-init-data":telegramData()};
    const [dr,cr,ir]=await Promise.all([
     fetch("/api/miniapp/design?bot="+encodeURIComponent(botId),{headers,signal:abort.signal,cache:"no-store"}),
     fetch("/api/catalog/categories?bot="+encodeURIComponent(botId),{headers,signal:abort.signal,cache:"no-store"}),
     fetch("/api/catalog?bot="+encodeURIComponent(botId),{headers,signal:abort.signal,cache:"no-store"})
    ]);
    const [db,cb,ib]=await Promise.all([dr.json(),cr.json(),ir.json()]);
    if(!dr.ok||!cr.ok||!ir.ok)throw new Error(db.error??cb.error??ib.error??"Не удалось загрузить настройки");
    if(!abort.signal.aborted){
     setDesign({...initial,...db.design,banner:{...initial.banner,...db.design?.banner}});
     setCategories(cb.categories??[]);setItems(ib.items??[]);
    }
   }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Ошибка загрузки");}
   finally{if(!abort.signal.aborted)setLoading(false);}
  }
  void load();return()=>abort.abort();
 },[botId]);
 async function save(){
  setSaving(true);setMessage("");setError("");
  try{
   const res=await fetch("/api/miniapp/design",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({botId,initData:telegramData(),...design})});
   const body=await res.json();
   if(!res.ok)throw new Error(body.error??"Не удалось сохранить");
   setMessage("Черновик оформления сохранён. Опубликуйте изменения, чтобы их увидели покупатели.");
  }catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}
  finally{setSaving(false);}
 }
 const field="w-full rounded-xl border border-[#d0d5dd] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#6541f5]";
 const label="mb-1.5 block text-xs font-semibold text-[#475467]";
 if(loading)return <div className="rounded-2xl bg-white p-8 text-sm">Загрузка настроек Mini App…</div>;
 return <section className="space-y-5 rounded-2xl border border-[#e4e7ec] bg-white p-5">
  <div><h2 className="text-xl font-semibold">Оформление Mini App</h2><p className="mt-1 text-sm text-[#667085]">Шаблон, тема и контент главного баннера. Изменения сохраняются в черновик.</p></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  {message&&<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
  <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
   <label><span className={label}>Шаблон</span><select className={field} value={design.layout} onChange={e=>update({layout:e.target.value as Design["layout"]})}><option value="food01">Food 01</option><option value="food02">Food 02</option></select></label>
   <label><span className={label}>Основной цвет</span><div className="flex gap-2"><input type="color" value={design.color} onChange={e=>update({color:e.target.value})} aria-label="Выбрать цвет" className="h-10 w-14 cursor-pointer rounded-lg"/><input className={field} value={design.color} onChange={e=>update({color:e.target.value})} maxLength={7}/></div></label>
   <label><span className={label}>Тема для покупателей</span><select className={field} value={design.themeMode} onChange={e=>update({themeMode:e.target.value as Design["themeMode"]})}><option value="light">Только светлая</option><option value="dark">Только тёмная</option><option value="customer">Покупатель выбирает сам</option></select></label>
   {design.themeMode==="customer"&&<label><span className={label}>Тема при первом открытии</span><select className={field} value={design.defaultTheme} onChange={e=>update({defaultTheme:e.target.value as Design["defaultTheme"]})}><option value="system">Как в Telegram</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label>}
  </div>
  <div className="space-y-4 border-t pt-4">
   <div className="flex justify-between gap-3"><div><h3 className="font-semibold">Баннер на главной</h3><p className="text-xs text-[#667085]">Отключение не удаляет содержимое</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={design.banner.enabled} onChange={e=>banner({enabled:e.target.checked})}/>Показывать</label></div>
   {design.banner.enabled&&<>
    <label className="block"><span className={label}>Заголовок</span><input className={field} maxLength={100} value={design.banner.title} onChange={e=>banner({title:e.target.value})}/></label>
    <label className="block"><span className={label}>Описание</span><textarea rows={2} maxLength={300} className={field} value={design.banner.description} onChange={e=>banner({description:e.target.value})}/></label>
    <label className="block"><span className={label}>Ссылка на изображение (HTTPS)</span><input type="url" className={field} value={design.banner.imageUrl} onChange={e=>banner({imageUrl:e.target.value})} placeholder="https://example.com/banner.jpg"/></label>
    {design.banner.imageUrl.startsWith("https://")&&<img src={design.banner.imageUrl} alt="Предпросмотр баннера" className="h-32 w-full rounded-xl object-cover"/>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={design.banner.buttonEnabled} onChange={e=>banner({buttonEnabled:e.target.checked})}/>Кнопка на баннере</label>
    {design.banner.buttonEnabled&&<div className="grid gap-3 sm:grid-cols-2">
     <label><span className={label}>Название кнопки</span><input className={field} maxLength={50} value={design.banner.buttonText} onChange={e=>banner({buttonText:e.target.value})}/></label>
     <label><span className={label}>Действие кнопки</span><select className={field} value={design.banner.linkType} onChange={e=>banner({linkType:e.target.value as Banner["linkType"],target:e.target.value==="page"?"catalog":""})}><option value="page">Раздел Mini App</option><option value="category">Категория</option><option value="product">Блюдо</option><option value="external">Внешняя ссылка</option></select></label>
     <label className="sm:col-span-2"><span className={label}>Куда ведёт кнопка</span>
     {design.banner.linkType==="external"?<input className={field} type="url" placeholder="https://example.com" value={design.banner.target} onChange={e=>banner({target:e.target.value})}/>:
      <select className={field} value={design.banner.target} onChange={e=>banner({target:e.target.value})}><option value="">Выберите назначение</option>
       {(design.banner.linkType==="page"?[{id:"catalog",name:"Меню"},{id:"cart",name:"Корзина"},{id:"profile",name:"Профиль"}]:design.banner.linkType==="category"?categories:items).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>}
     </label>
    </div>}
   </>}
  </div>
  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-xs text-[#667085]">Настройки попадут к покупателям после публикации.</span><button disabled={saving||!/#[0-9A-F]{6}/i.test(design.color)} onClick={()=>void save()} className="rounded-xl bg-[#6541f5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving?"Сохранение…":"Сохранить черновик"}</button></div>
 </section>;
}
