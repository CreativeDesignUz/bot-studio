"use client";

import {useEffect,useMemo,useState} from "react";
import {ArrowRight,Check,LoaderCircle,Moon,Palette,Sparkles,Sun} from "lucide-react";
import MiniAppLivePreview from "../workspace/miniapp-live-preview";

type Template="store"|"delivery"|"service"|"course";
type Layout="food01"|"food02";
type Mode="light"|"dark"|"customer";
type DefaultMode="system"|"light"|"dark";
type Design={layout:Layout;color:string;dark:boolean;themeMode:Mode;defaultTheme:DefaultMode};
type Props={botId:string;template:Template;initialColor:string;previouslySaved:boolean;onColorChange:(color:string)=>void;onContinue:()=>void};

const presets=[
 {name:"Фиолетовый",value:"#6541F5"},{name:"Оранжевый",value:"#E65D35"},
 {name:"Зелёный",value:"#00CD69"},{name:"Синий",value:"#2E9AFF"},
 {name:"Графит",value:"#242424"},
];
const colorPattern=/^#[0-9a-f]{6}$/i;
const card="rounded-[20px] border border-[#e0e5ed] bg-white p-5 sm:p-6";
const themeOptions=[
 {value:"light" as const,label:"Светлая",Icon:Sun},
 {value:"dark" as const,label:"Тёмная",Icon:Moon},
 {value:"customer" as const,label:"На выбор",Icon:Sparkles},
];
function telegramData(){return (window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";}

export default function MiniAppDesignStep({botId,template,initialColor,previouslySaved,onColorChange,onContinue}:Props){
 const [layout,setLayout]=useState<Layout>("food01");
 const [accent,setAccent]=useState(initialColor);
 const [themeMode,setThemeMode]=useState<Mode>("light");
 const [defaultTheme,setDefaultTheme]=useState<DefaultMode>("system");
 const [loaded,setLoaded]=useState(!previouslySaved);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const configurable=template==="delivery"||template==="store";
 const validColor=colorPattern.test(accent);
 const design=useMemo<Design>(()=>({
  layout,color:validColor?accent:"#6541F5",dark:themeMode==="dark",themeMode,defaultTheme
 }),[layout,accent,validColor,themeMode,defaultTheme]);

 useEffect(()=>{
  if(!previouslySaved||!configurable)return;
  const controller=new AbortController();
  void (async()=>{
   try{
    const response=await fetch("/api/miniapp/design?bot="+encodeURIComponent(botId),{
     headers:{"x-telegram-init-data":telegramData()},signal:controller.signal,cache:"no-store"
    });
    const result=await response.json() as {error?:string;design?:Partial<Design>};
    if(!response.ok||!result.design)throw new Error(result.error??"Не удалось загрузить дизайн.");
    if(controller.signal.aborted)return;
    setLayout(result.design.layout==="food02"?"food02":"food01");
    if(result.design.color&&colorPattern.test(result.design.color)){setAccent(result.design.color);onColorChange(result.design.color);}
    setThemeMode(["light","dark","customer"].includes(result.design.themeMode??"")?result.design.themeMode!:"light");
    setDefaultTheme(["light","dark","system"].includes(result.design.defaultTheme??"")?result.design.defaultTheme!:"system");
   }catch(e){
    if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Ошибка загрузки оформления.");
   }finally{if(!controller.signal.aborted)setLoaded(true);}
  })();
  return()=>controller.abort();
  // This is a one-time read when returning to an already saved design.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[botId,previouslySaved,configurable]);

 function changeColor(value:string){setAccent(value);onColorChange(value);setError("");}
 async function saveAndContinue(){
  if(saving)return;
  if(!configurable){onContinue();return;}
  if(!validColor){setError("Введите цвет в формате #RRGGBB.");return;}
  setSaving(true);setError("");
  try{
   const response=await fetch("/api/miniapp/design",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({botId,initData:telegramData(),...design})
   });
   const result=await response.json() as {ok?:boolean;error?:string};
   if(!response.ok||!result.ok)throw new Error(result.error??"Не удалось сохранить оформление.");
   onContinue();
  }catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить оформление.");}
  finally{setSaving(false);}
 }
 if(!configurable)return <section aria-label="Дизайн Mini App" className="space-y-5">
  <h1 className="text-3xl font-semibold tracking-tight">Дизайн Mini App</h1>
  <div className={card+" space-y-3"}><p className="font-semibold">Оформление для выбранного шаблона</p>
   <p className="text-sm leading-6 text-[#667085]">Редактор Food 01 и Food 02 сейчас доступен для доставки еды и интернет-магазина. Для выбранного шаблона базовое оформление создаётся автоматически. Вы сможете доработать его в редакторе.</p>
   <button type="button" onClick={onContinue} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#4420e7] px-5 text-sm font-semibold text-white">К запуску <ArrowRight size={16}/></button>
  </div></section>;

 return <section aria-label="Дизайн Mini App">
  <h1 className="text-3xl font-semibold tracking-tight">Дизайн Mini App</h1>
  <p className="mt-2 text-sm leading-6 text-[#667085]">Выберите стиль, цвет и тему. Изменения сразу появляются в живом предпросмотре.</p>
  {error&&<p role="alert" className="mt-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b42318]">{error}</p>}
  {!loaded?<div role="status" className={card+" mt-6 flex items-center gap-2 text-sm"}><LoaderCircle size={17} className="animate-spin"/>Загружаем оформление Mini App…</div>:
  <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,390px)]">
   <div className="min-w-0 space-y-5">
    <div className={card+" space-y-4"}>
     <div><h2 className="text-lg font-semibold">Стиль приложения</h2><p className="mt-1 text-xs text-[#667085]">Два готовых варианта расположения меню.</p></div>
     <div role="group" aria-label="Стиль Mini App" className="grid gap-3 sm:grid-cols-2">
      {([{id:"food01" as const,title:"Food 01",desc:"Список блюд"},{id:"food02" as const,title:"Food 02",desc:"Карточки сеткой"}]).map(item=>
       <button type="button" key={item.id} aria-pressed={layout===item.id} onClick={()=>setLayout(item.id)} className={"rounded-2xl border-2 p-3 text-left transition-all "+(layout===item.id?"border-[#6541F5] bg-[#f7f4ff]":"border-[#e3e7ee] bg-white hover:border-[#b0a5ed]")}>
        <div aria-hidden="true" className="rounded-xl border border-[#e5e7eb] bg-[#f7f8fa] p-3">
         <div className="mb-3 h-2 w-16 rounded-full" style={{background:validColor?accent:"#6541F5"}}/>
         <div className={item.id==="food01"?"flex flex-col gap-2":"grid grid-cols-2 gap-2"}>{Array.from({length:item.id==="food01"?3:4},(_,i)=>
          <div key={i} className={"rounded-md bg-white p-1.5 "+(item.id==="food01"?"flex items-center gap-2":"")}>
           <div className={item.id==="food01"?"size-7 shrink-0 rounded-md":"mb-2 aspect-[4/3] rounded-md"} style={{background:i%2===0?"#fee2d5":"#dbeafe"}}/>
           <div className="min-w-0 flex-1"><div className="h-1.5 w-4/5 rounded-full bg-[#cbd5e1]"/><div className="mt-1 h-1.5 w-1/2 rounded-full bg-[#e2e8f0]"/></div>
          </div>)}</div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2"><div><strong className="block text-sm">{item.title}</strong><span className="text-xs text-[#667085]">{item.desc}</span></div><span className={"grid size-6 place-items-center rounded-full border "+(layout===item.id?"border-[#6541F5] bg-[#6541F5] text-white":"border-[#d0d5dd] bg-white")}>{layout===item.id&&<Check size={15}/>}</span></div>
       </button>)}
     </div>
    </div>
    <div className={card+" space-y-4"}>
     <div className="flex items-center gap-2"><Palette size={19} className="text-[#6541F5]"/><h2 className="text-lg font-semibold">Основной цвет</h2></div>
     <div role="group" aria-label="Готовые цвета Mini App" className="flex flex-wrap gap-3">{presets.map(p=>
      <button key={p.value} type="button" title={p.name} aria-label={p.name} aria-pressed={accent.toLowerCase()===p.value.toLowerCase()} onClick={()=>changeColor(p.value)} className={"grid size-10 place-items-center rounded-full border-2 "+(accent.toLowerCase()===p.value.toLowerCase()?"border-[#101828]":"border-transparent")}><span className="grid size-8 place-items-center rounded-full text-white" style={{background:p.value}}>{accent.toLowerCase()===p.value.toLowerCase()&&<Check size={17} strokeWidth={3}/>}</span></button>)}</div>
     <label className="flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">Свой цвет</span><input type="color" aria-label="Палитра Mini App" value={validColor?accent:"#6541F5"} onChange={e=>changeColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg"/><input aria-label="HEX-код Mini App" value={accent} onChange={e=>changeColor(e.target.value)} maxLength={7} className={"h-10 w-28 rounded-xl border bg-white px-3 font-mono text-sm "+(validColor?"border-[#d0d5dd]":"border-[#dc2626]")}/></label>
    </div>
    <div className={card+" space-y-4"}>
     <div><h2 className="text-lg font-semibold">Тема приложения</h2><p className="mt-1 text-xs text-[#667085]">Можно закрепить тему или дать выбор покупателю.</p></div>
     <div role="group" aria-label="Тема Mini App" className="grid gap-2 sm:grid-cols-3">{themeOptions.map(option=>
      <button key={option.value} type="button" aria-pressed={themeMode===option.value} onClick={()=>setThemeMode(option.value)} className={"flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 text-xs font-semibold "+(themeMode===option.value?"border-[#6541F5] bg-[#f3f0ff] text-[#5934dc]":"border-[#e2e6ee] bg-white text-[#475467]")}><option.Icon size={17}/>{option.label}</button>)}</div>
     {themeMode==="customer"&&<label className="block text-sm font-semibold">Тема при первом открытии<select aria-label="Тема при первом открытии" value={defaultTheme} onChange={e=>setDefaultTheme(e.target.value as DefaultMode)} className="mt-2 h-11 w-full rounded-xl border border-[#d0d5dd] bg-white px-3 text-sm"><option value="system">Как в Telegram</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label>}
    </div>
    <div className="flex flex-col gap-3"><p className="text-xs leading-5 text-[#667085]">Сохранённый дизайн остаётся черновиком до публикации. Настройки можно изменить позже в админке.</p>
     <button type="button" onClick={()=>void saveAndContinue()} disabled={saving||!validColor} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#4420e7] px-5 text-sm font-semibold text-white disabled:opacity-50">{saving?<><LoaderCircle size={17} className="animate-spin"/>Сохраняем оформление…</>:<>Сохранить и продолжить <ArrowRight size={17}/></>}</button>
    </div>
   </div>
   <MiniAppLivePreview botId={botId} design={design}/>
  </div>}
 </section>;
}
