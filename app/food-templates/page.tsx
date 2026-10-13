"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Home, MapPin, Moon, Plus, Search, ShoppingBag, Sun, Trash2, UserRound, UtensilsCrossed } from "lucide-react";

type Mode="minimal"|"expressive";
type Banner={id:string;title:string;subtitle:string;button:string;enabled:boolean;image:string};
const photos={
 burger:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=85",
 pizza:"https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=700&q=85",
 sushi:"https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=700&q=85",
 fries:"https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=85",
};
const initial:Banner[]=[
 {id:"a",title:"Обед уже рядом",subtitle:"От любимых ресторанов за 25–35 минут",button:"−25% на первый заказ",enabled:true,image:photos.burger},
 {id:"b",title:"Вкуснее вместе",subtitle:"Пора порадовать себя любимым!",button:"Заказать сейчас",enabled:true,image:photos.pizza},
];
const categories=[{name:"Бургеры",image:photos.burger},{name:"Пицца",image:photos.pizza},{name:"Суши",image:photos.sushi},{name:"Фри",image:photos.fries}];
const food=[{name:"Чеддер бургер",cost:"49 000 сум",image:photos.burger,kind:"Бургеры"},{name:"Пицца Маргарита",cost:"79 000 сум",image:photos.pizza,kind:"Пицца"},{name:"Суши сет",cost:"95 000 сум",image:photos.sushi,kind:"Суши"},{name:"Картофель фри",cost:"24 000 сум",image:photos.fries,kind:"Фри"}];
const presets=[{name:"Коралл",hex:"#FF5A3C"},{name:"Фиолетовый",hex:"#6541F5"},{name:"Зелёный",hex:"#13A874"},{name:"Синий",hex:"#2563EB"},{name:"Чёрный",hex:"#242424"}];
const field="h-10 min-w-0 w-full rounded-lg border border-[#dde2ea] bg-transparent px-3 text-sm outline-none focus:border-[#6541F5]";
function Photo({src,alt,className}:{src:string;alt:string;className?:string}){return <img src={src} alt={alt} className={"block object-cover "+(className??"")}/>}
export default function FoodTemplatesPage(){
 const [mode,setMode]=useState<Mode>("minimal");
 const [accent,setAccent]=useState("#E65D35");
 const [dark,setDark]=useState(false);
 const [banners,setBanners]=useState<Banner[]>(initial);
 const [activeBanner,setActiveBanner]=useState(0);
 const [filter,setFilter]=useState("");
 const [category,setCategory]=useState("Все");
 const [activeTab,setActiveTab]=useState<"home"|"search"|"orders"|"profile">("home");
 const [cart,setCart]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);
 const current=banners.filter(x=>x.enabled);
 const banner=current[activeBanner%Math.max(1,current.length)];
 const filtered=useMemo(()=>food.filter(x=>(category==="Все"||category===x.kind)&&x.name.toLowerCase().includes(filter.toLowerCase())),[filter,category]);
 const bg=dark?"#121417":mode==="minimal"?"#FAFAF8":"#F7F8FA";
 const cardBg=dark?"#20242A":"#FFFFFF";
 const txt=dark?"#F6F7F8":"#182128";
 const muted=dark?"#ABB2BB":"#68756D";
 function choose(m:Mode){setMode(m);setAccent(m==="minimal"?"#E65D35":"#FF5A3C");setCategory("Все");setActiveTab("home")}
 function addBanner(){setBanners(list=>list.length>=6?list:[...list,{id:crypto.randomUUID(),title:"Новый баннер",subtitle:"Описание предложения",button:"",enabled:true,image:photos.burger}]);setActiveBanner(0)}
 function update(id:string,patch:Partial<Banner>){setBanners(list=>list.map(x=>x.id===id?{...x,...patch}:x))}
 return <main className="min-h-dvh bg-[#F6F7FA] px-4 py-6 text-[#101828] md:px-7">
  <div className="mx-auto max-w-[1220px]">
   <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><Link href="/onboarding" className="inline-flex items-center gap-2 text-sm text-[#6541F5] no-underline"><ArrowLeft size={16}/>Мастер создания</Link><h1 className="mt-2 text-2xl font-bold">Шаблоны доставки еды</h1><p className="mt-1 text-sm text-[#667085]">Два дизайна из Figma · настройка цветов, режима и баннеров</p></div><span className="rounded-full bg-[#EEE9FF] px-3 py-2 text-xs font-medium text-[#5934DC]">Предпросмотр темы · без публикации</span></div>
   <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
    <div className="space-y-4">
     <section className="rounded-[18px] border border-[#E3E7EF] bg-white p-5"><h2 className="font-semibold">1. Вариант оформления</h2><div className="mt-4 grid grid-cols-2 gap-3">{([{id:"minimal",name:"Food 01 · Minimal",desc:"Светлый, спокойный и воздушный"},{id:"expressive",name:"Food 02 · Expressive",desc:"Яркий, насыщенный, акцент на фото"}] as const).map(x=><button key={x.id} onClick={()=>choose(x.id)} className={`rounded-xl border p-4 text-left ${mode===x.id?"border-[#6541F5] bg-[#F5F2FF]":"border-[#E3E7EF]"}`}><strong className="text-sm">{x.name}</strong><p className="mt-2 text-xs text-[#667085]">{x.desc}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#6541F5]">{mode===x.id?<><Check size={14}/>Выбрано</>:"Выбрать"}</span></button>)}</div></section>
     <section className="rounded-[18px] border border-[#E3E7EF] bg-white p-5"><h2 className="font-semibold">2. Бренд и тема</h2><p className="mt-1 text-xs text-[#667085]">Цвет применяется к кнопкам, фильтрам и акцентам. Структура шаблона сохраняется.</p><div className="mt-4 flex flex-wrap gap-3">{presets.map(x=><button key={x.hex} type="button" title={x.name} onClick={()=>setAccent(x.hex)} aria-label={`Выбрать цвет ${x.name}`} className={`grid size-10 place-items-center rounded-full border-4 border-white ring-2 ${accent===x.hex?"ring-[#6541F5]":"ring-transparent"}`} style={{background:x.hex}}>{accent===x.hex&&<Check className="text-white" size={17}/>}</button>)}<label className="flex items-center gap-2 text-xs text-[#667085]"><input aria-label="Свой цвет" type="color" value={accent} onChange={e=>setAccent(e.target.value)} className="size-9 cursor-pointer"/>Свой цвет</label></div><div className="mt-5 flex items-center justify-between"><div><strong className="text-sm">Тёмная тема</strong><p className="text-xs text-[#667085]">Отдельный режим оформления Mini App</p></div><button role="switch" aria-checked={dark} type="button" onClick={()=>setDark(x=>!x)} className={`flex h-9 w-16 items-center rounded-full p-1 ${dark?"bg-[#6541F5]":"bg-[#e3e7ed]"}`}><span className={`grid size-7 place-items-center rounded-full bg-white shadow transition-transform ${dark?"translate-x-7":""}`}>{dark?<Moon size={14}/>:<Sun size={14}/>}</span></button></div></section>
     <section className="rounded-[18px] border border-[#E3E7EF] bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">3. Баннеры главной</h2><button onClick={addBanner} disabled={banners.length>=6} className="inline-flex items-center gap-1 rounded-lg bg-[#F0ECFF] px-3 py-2 text-xs font-semibold text-[#6541F5] disabled:opacity-50"><Plus size={15}/>Баннер</button></div><p className="mt-1 text-xs text-[#667085]">До шести баннеров. Кнопка необязательна. Переключать можно стрелками в превью.</p>
      <div className="mt-4 space-y-3">{banners.map((b,i)=><div key={b.id} className="rounded-xl border border-[#E3E7EF] p-3"><div className="mb-3 flex items-center justify-between"><label className="flex cursor-pointer items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={b.enabled} onChange={e=>update(b.id,{enabled:e.target.checked})}/>Баннер {i+1}</label><button aria-label="Удалить баннер" onClick={()=>setBanners(l=>l.filter(x=>x.id!==b.id))} className="text-[#98A2B3]"><Trash2 size={16}/></button></div><div className="grid gap-2 sm:grid-cols-2"><input className={field} aria-label="Заголовок баннера" placeholder="Заголовок" value={b.title} onChange={e=>update(b.id,{title:e.target.value})}/><input className={field} aria-label="Описание баннера" placeholder="Подзаголовок" value={b.subtitle} onChange={e=>update(b.id,{subtitle:e.target.value})}/><input className={field} aria-label="Кнопка баннера" placeholder="Кнопка (необязательно)" value={b.button} onChange={e=>update(b.id,{button:e.target.value})}/><input className={field} aria-label="Ссылка фото баннера" placeholder="URL фотографии" value={b.image} onChange={e=>update(b.id,{image:e.target.value})}/></div></div>)}</div>
     </section>
     <p className="text-xs leading-5 text-[#667085]">Фотографии — временные демонстрационные изображения, не карточки настоящих товаров. Перед публикацией предприниматель заменит их собственными изображениями или лицензированными материалами.</p>
    </div>
    <div className="lg:sticky lg:top-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Предпросмотр клиента</h2><span className="text-xs text-[#667085]">390 × 844</span></div>
     <div className="mx-auto flex h-[min(844px,88dvh)] min-h-[540px] w-full max-w-[390px] flex-col overflow-hidden rounded-[28px] border-[5px] border-[#1A2029] shadow-[0_18px_55px_rgba(0,0,0,.16)]" style={{background:bg,color:txt}}>
      <div className="flex h-[42px] shrink-0 items-center justify-between px-5 text-sm" style={{background:cardBg}}><ChevronLeft size={21}/><span className="text-xs" style={{color:muted}}>mini app</span><span>•••</span></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-5">
       {activeTab==="home"||activeTab==="search"?<>
        {mode==="minimal"?<><div className="mt-4 flex items-center justify-between"><h2 className="text-[30px] font-semibold">TAM</h2><span className="text-[11px] font-semibold" style={{color:accent}}>● ОТКРЫТО</span></div><p className="mt-2 text-xs" style={{color:muted}}><MapPin size={13} className="inline"/> Ташкент, ул. Амира Темура, 15 ▾</p></>:<p className="mt-4 text-sm font-semibold"><MapPin size={14} className="mr-1 inline" style={{color:accent}}/>Доставим на Амир Темур, 15 ▾</p>}
        <label className="mt-4 flex h-12 items-center gap-3 rounded-[15px] px-4" style={{background:cardBg,color:muted}}><Search size={18}/><input value={filter} onChange={e=>{setFilter(e.target.value);setActiveTab("search")}} placeholder={mode==="minimal"?"Блюдо, ресторан или кухня":"Блюдо или ресторан"} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" style={{color:txt}}/></label>
        {current.length>0&&banner&&<div className="relative mt-5 overflow-hidden rounded-[22px] p-5" style={{background:mode==="minimal"&&!dark?"#F9DDC8":dark?"#34241F":accent,color:mode==="minimal"&&!dark?"#17211D":"white",minHeight:mode==="minimal"?177:155}}>
         <div className="relative z-10 max-w-[60%]"><span className="text-[10px] font-semibold opacity-75">{mode==="expressive"?"ТОЛЬКО СЕГОДНЯ":"СПЕЦИАЛЬНОЕ ПРЕДЛОЖЕНИЕ"}</span><h3 className="mt-2 text-xl font-bold leading-6">{banner.title}</h3><p className="mt-2 text-[11px] leading-4 opacity-85">{banner.subtitle}</p>{banner.button&&<button onClick={()=>setCategory("Все")} className="mt-3 rounded-full px-3 py-2 text-[10px] font-semibold" style={{background:mode==="minimal"?"white":"#ffffffee",color:accent}}>{banner.button}</button>}</div>
         {banner.image&&<Photo src={banner.image} alt="" className="absolute -right-3 bottom-0 h-[85%] w-[47%] rounded-l-[20px]"/>}
         {current.length>1&&<div className="absolute bottom-2 left-4 right-4 z-20 flex items-center justify-between"><button aria-label="Предыдущий баннер" onClick={()=>setActiveBanner(i=>(i+current.length-1)%current.length)} className="rounded-full bg-black/15 p-1 text-white"><ChevronLeft size={14}/></button><span className="text-[10px] text-white">{activeBanner%current.length+1}/{current.length}</span><button aria-label="Следующий баннер" onClick={()=>setActiveBanner(i=>(i+1)%current.length)} className="rounded-full bg-black/15 p-1 text-white"><ChevronRight size={14}/></button></div>}
        </div>}
        <h3 className="mt-6 text-[19px] font-semibold">{mode==="minimal"?"Что хочется сегодня?":"Что будем есть?"}</h3>
        {mode==="minimal"?<div className="mt-3 grid grid-cols-4 gap-2">{categories.map(cat=><button key={cat.name} onClick={()=>{setCategory(cat.name);setActiveTab("search")}} className="overflow-hidden rounded-[17px] p-[5px] pb-2 text-center" style={{background:cardBg}}><Photo src={cat.image} alt="" className="h-[56px] w-full rounded-xl"/><span className="mt-1 block truncate text-[11px] font-semibold">{cat.name}</span></button>)}</div>:<div className="mt-3 flex gap-2 overflow-x-auto pb-1">{categories.map(cat=><button key={cat.name} onClick={()=>{setCategory(cat.name);setActiveTab("search")}} className="shrink-0 rounded-[13px] px-3 py-2 text-xs font-semibold" style={{background:category===cat.name?accent:cardBg,color:category===cat.name?"white":txt}}>{cat.name}</button>)}</div>}
        <h3 className="mt-6 text-[19px] font-semibold">{mode==="minimal"?"Рестораны рядом":"Популярное рядом"}</h3>
        {mode==="expressive"?<div className="mt-3 flex gap-3 overflow-x-auto pb-1">{filtered.length?filtered.map(item=><button key={item.name} onClick={()=>setSelected(item.name)} className="w-[165px] shrink-0 rounded-[18px] p-[10px] text-left" style={{background:cardBg}}><Photo src={item.image} alt={item.name} className="h-[116px] w-full rounded-[13px]"/><strong className="mt-2 block text-[13px]">{item.name}</strong><span className="mt-2 block text-[13px] font-semibold" style={{color:accent}}>{item.cost}</span></button>):<p className="py-5 text-xs" style={{color:muted}}>Ничего не найдено</p>}</div>:<div className="mt-3 space-y-3">{filtered.length?filtered.slice(0,4).map((item,i)=><button key={item.name} onClick={()=>setSelected(item.name)} className="flex w-full items-center gap-3 rounded-2xl p-[10px] text-left" style={{background:cardBg}}><Photo src={item.image} alt={item.name} className="h-[63px] w-[82px] rounded-xl"/><span><strong className="block text-sm">{i===0?"Oqtepa Lavash":item.name}</strong><span className="mt-1 block text-xs" style={{color:muted}}>★ 4.8 · 25–35 мин</span><span className="mt-1 block text-[11px]" style={{color:accent}}>От 12 000 сум</span></span></button>):<p className="py-5 text-xs" style={{color:muted}}>Ничего не найдено</p>}</div>}
       </>:<div className="grid h-full place-items-center text-center text-sm" style={{color:muted}}>{activeTab==="orders"?"Заказы появятся после оформления.":"Профиль клиента"}</div>}
       {selected&&<div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-5" onClick={()=>setSelected(null)}><div onClick={e=>e.stopPropagation()} className="w-full max-w-[370px] rounded-3xl p-5" style={{background:cardBg,color:txt}}><button className="mb-3 text-sm" onClick={()=>setSelected(null)}>← Назад</button>{food.filter(x=>x.name===selected).map(x=><div key={x.name}><Photo src={x.image} alt={x.name} className="h-48 w-full rounded-xl"/><h3 className="mt-4 text-xl font-bold">{x.name}</h3><p className="mt-2" style={{color:accent}}>{x.cost}</p><button onClick={()=>{setCart(n=>n+1);setSelected(null)}} className="mt-5 h-11 w-full rounded-xl font-semibold text-white" style={{background:accent}}>Добавить в корзину</button></div>)}</div></div>}
      </div>
      <nav className="grid h-[70px] shrink-0 grid-cols-4 border-t px-2" style={{background:cardBg,borderColor:dark?"#333941":"#e8e8e8"}}>{([{id:"home",label:"Главная",Icon:Home},{id:"search",label:"Поиск",Icon:Search},{id:"orders",label:"Заказы",Icon:ShoppingBag},{id:"profile",label:"Профиль",Icon:UserRound}] as const).map(t=><button key={t.id} onClick={()=>setActiveTab(t.id)} className="flex flex-col items-center justify-center gap-1 text-[11px]" style={{color:activeTab===t.id?accent:muted}}><t.Icon size={19}/><span>{t.label}{t.id==="orders"&&cart>0?` · ${cart}`:""}</span></button>)}</nav>
     </div>
    </div>
   </div>
  </div>
 </main>
}
