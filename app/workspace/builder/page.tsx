"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, Check, ChevronRight, Eye, GripVertical, ImagePlus, LoaderCircle, Plus, Save, Send, Trash2 } from "lucide-react";

type ActionButton={id:string;label:string;action:string};
type PublishState="idle"|"validating"|"saving"|"publishing"|"published"|"connection"|"error";
type LoadState="loading"|"ready"|"error";
type DraftResponse={bot?:{name:string;description:string;primary_color:string;settings?:{home_buttons?:ActionButton[]}};error?:string};
type ErrorResponse={error?:string};

export default function BotBuilder(){
 const searchParams=useSearchParams();
 const botId=searchParams.get("bot");
 const [name,setName]=useState(""),[description,setDescription]=useState(""),[color,setColor]=useState("#6541F5");
 const [buttons,setButtons]=useState<ActionButton[]>([]);
 const [connectUrl,setConnectUrl]=useState<string|null>(null);
 const [dirty,setDirty]=useState(false),[saved,setSaved]=useState(true),[publishState,setPublishState]=useState<PublishState>("idle");
 const [loadState,setLoadState]=useState<LoadState>("loading"),[loadError,setLoadError]=useState("");
 useEffect(()=>{
  const tg=(window as typeof window&{Telegram?:{WebApp?:{ready?:()=>void;expand?:()=>void;initData?:string}}}).Telegram?.WebApp;
  tg?.ready?.();tg?.expand?.();
  const controller=new AbortController();
  async function loadBot(){
   if(!botId){setLoadError("Не указан бот для редактирования.");setLoadState("error");return}
   setLoadState("loading");setLoadError("");
   try{
    const response=await fetch(`/api/bots/draft?bot=${encodeURIComponent(botId)}`,{headers:{"x-telegram-init-data":tg?.initData??""},signal:controller.signal});
    const result=await response.json() as DraftResponse;
    if(!response.ok||!result.bot)throw new Error(result.error||"Не удалось загрузить бота.");
    setName(result.bot.name);setDescription(result.bot.description);setColor(result.bot.primary_color);setButtons(result.bot.settings?.home_buttons??[]);
    setDirty(false);setSaved(true);setLoadState("ready");
   }catch(error){
    if(controller.signal.aborted)return;
    setLoadError(error instanceof Error?error.message:"Не удалось загрузить бота.");setLoadState("error");
   }
  }
  void loadBot();
  return()=>controller.abort();
 },[botId]);
 function change(fn:()=>void){fn();setDirty(true);setSaved(false);if(publishState==="published")setPublishState("idle")}
 async function save(){
  if(!botId||loadState!=="ready"){setPublishState("error");return false}
  setLoadError("");setPublishState("saving");
  const telegram=(window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp;
  try{
   const response=await fetch("/api/bots/draft",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData:telegram?.initData,botId,name,description,color,buttons})});
   const result=await response.json() as ErrorResponse;
   if(!response.ok)throw new Error(result.error||"Не удалось сохранить изменения.");
   setDirty(false);setSaved(true);setPublishState("idle");return true;
  }catch(error){setLoadError(error instanceof Error?error.message:"Не удалось сохранить изменения.");setPublishState("error");return false}
 }
 async function publish(){
  if(dirty&&!(await save()))return;
  setLoadError("");setPublishState("validating");await new Promise(r=>setTimeout(r,500));setPublishState("publishing");
  const telegram=(window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp;
  try{
   const response=await fetch("/api/publish",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData:telegram?.initData,botId,name,description,color,buttons})});
   const result=await response.json() as {status?:string;requiresTelegramConnection?:boolean;connectUrl?:string;error?:string};
   if(result.requiresTelegramConnection&&result.connectUrl){setConnectUrl(result.connectUrl);setPublishState("connection");return}
   if(!response.ok||result.status!=="published")throw new Error(result.error||"Публикация не завершена. Повторите попытку.");
   setPublishState("published");
  }catch(error){setLoadError(error instanceof Error?error.message:"Не удалось опубликовать бота.");setPublishState("error")}
 }
 if(loadState==="loading")return <main className="grid min-h-screen place-items-center bg-[#f4f6f8] text-sm text-[#667085]"><span className="flex items-center gap-3"><LoaderCircle className="size-5 animate-spin"/>Загружаем данные бота…</span></main>;
 if(loadState==="error")return <main className="grid min-h-screen place-items-center bg-[#f4f6f8] p-5 text-[#101828]"><section className="w-full max-w-lg rounded-[24px] border border-[#e4e7ec] bg-white p-8 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff1f3] text-[#c01048]"><Bot/></span><h1 className="mt-5 text-2xl font-semibold">Не удалось открыть редактор</h1><p className="mt-2 text-sm leading-6 text-[#667085]">{loadError}</p><div className="mt-6 flex justify-center gap-3"><Link href="/workspace" className="inline-flex h-11 items-center rounded-xl border border-[#d0d5dd] px-4 text-sm font-semibold no-underline">В кабинет</Link><button onClick={()=>location.reload()} className="h-11 rounded-xl bg-[#101828] px-5 text-sm font-semibold text-white">Повторить</button></div></section></main>;
 return <main className="min-h-screen bg-[#f4f6f8] text-[#101828]">
  <header className="sticky top-0 z-30 flex min-h-[68px] flex-wrap items-center gap-3 border-b border-[#e4e7ec] bg-white/95 px-4 py-3 backdrop-blur sm:px-7"><Link href="/workspace" className="grid size-10 place-items-center rounded-xl border border-[#e4e7ec]"><ArrowLeft className="size-4"/></Link><span className="grid size-10 place-items-center rounded-xl bg-[#f0ecff] text-[#6d45f5]"><Bot className="size-5"/></span><div><strong className="block text-sm">Редактор бота</strong><span className="text-xs text-[#98a2b3]">{saved&&!dirty?"Все изменения сохранены":"Есть несохранённые изменения"}</span></div><div className="ml-auto flex gap-2"><button onClick={save} disabled={!dirty||publishState!=="idle"} className="flex h-10 items-center gap-2 rounded-xl border border-[#d0d5dd] px-3 text-sm font-semibold disabled:opacity-40"><Save className="size-4"/><span className="hidden sm:inline">Сохранить</span></button><button onClick={publish} disabled={publishState!=="idle"&&publishState!=="published"} className="flex h-10 items-center gap-2 rounded-xl bg-[#101828] px-4 text-sm font-semibold text-white disabled:opacity-60"><Send className="size-4"/>{publishState==="published"?"Опубликовано":"Опубликовать"}</button></div></header>
  <div className="mx-auto grid max-w-[1580px] gap-5 p-4 sm:p-7 xl:grid-cols-[250px_minmax(0,1fr)_360px]">
   <aside className="hidden rounded-[22px] border border-[#e4e7ec] bg-white p-3 xl:block"><p className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[#98a2b3]">Настройка</p>{["Основное","Меню","Кнопки","Доставка","Оплата","Уведомления"].map((item,index)=><button key={item} className={`flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-medium ${index===0?"bg-[#f0ecff] text-[#5934dc]":"text-[#667085]"}`}>{item}<ChevronRight className="size-4"/></button>)}<div className="mt-6 rounded-2xl bg-[#f9fafb] p-4"><strong className="text-sm">Готовность 78%</strong><div className="mt-3 h-2 rounded-full bg-[#eaecf0]"><div className="h-full w-[78%] rounded-full bg-[#6d45f5]"/></div><p className="mt-3 text-xs leading-5 text-[#667085]">Добавьте логотип и подключите оплату перед запуском.</p></div></aside>
   <section className="space-y-5"><div className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7"><span className="text-xs font-semibold text-[#6d45f5]">Профиль</span><h1 className="mt-1 text-2xl font-semibold">Как бот выглядит для клиента</h1><p className="mt-1 text-sm text-[#667085]">Изменения сразу появляются в превью справа.</p><div className="mt-6 grid gap-5 sm:grid-cols-[150px_1fr]"><label className="grid aspect-square cursor-pointer place-items-center rounded-[22px] border-2 border-dashed border-[#d0d5dd] bg-[#f9fafb] text-center"><span><ImagePlus className="mx-auto size-6 text-[#6d45f5]"/><strong className="mt-2 block text-sm">Логотип</strong><small className="text-[#98a2b3]">PNG или JPG</small></span><input hidden type="file" accept="image/*"/></label><div className="space-y-4"><Field label="Название"><input value={name} onChange={e=>change(()=>setName(e.target.value))}/></Field><Field label="Описание"><textarea value={description} onChange={e=>change(()=>setDescription(e.target.value))}/></Field><Field label="Основной цвет"><div className="flex items-center gap-3"><input type="color" value={color} onChange={e=>change(()=>setColor(e.target.value))} className="size-11 rounded-xl border border-[#d0d5dd] p-1"/><input value={color} onChange={e=>change(()=>setColor(e.target.value))} className="h-11 flex-1 rounded-xl border border-[#d0d5dd] px-3"/></div></Field></div></div></div>
    <div className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7"><div className="flex items-start justify-between"><div><span className="text-xs font-semibold text-[#6d45f5]">Главный экран</span><h2 className="mt-1 text-xl font-semibold">Кнопки бота</h2><p className="mt-1 text-sm text-[#667085]">Порядок здесь совпадает с Mini App.</p></div><button onClick={()=>change(()=>setButtons(v=>[...v,{id:crypto.randomUUID(),label:"Новая кнопка",action:"custom"}]))} className="grid size-10 place-items-center rounded-xl bg-[#f0ecff] text-[#5934dc]"><Plus className="size-4"/></button></div><div className="mt-5 space-y-3">{buttons.map((button,index)=><div key={button.id} className="flex items-center gap-3 rounded-2xl border border-[#e4e7ec] p-3"><GripVertical className="size-4 text-[#98a2b3]"/><span className="grid size-8 place-items-center rounded-lg bg-[#f2f4f7] text-xs font-semibold">{index+1}</span><input value={button.label} onChange={e=>change(()=>setButtons(v=>v.map(x=>x.id===button.id?{...x,label:e.target.value}:x)))} className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm font-medium outline-none"/><button onClick={()=>change(()=>setButtons(v=>v.filter(x=>x.id!==button.id)))} className="grid size-8 place-items-center rounded-lg text-[#98a2b3] hover:bg-[#fff1f3] hover:text-[#c01048]"><Trash2 className="size-4"/></button></div>)}</div></div>
   </section>
   <aside className="xl:sticky xl:top-[92px] xl:h-fit"><div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-semibold"><Eye className="size-4"/>Живое превью</span><span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[11px] font-semibold text-[#027a48]">Mini App</span></div><div className="mx-auto max-w-[360px] overflow-hidden rounded-[34px] border-[8px] border-[#101828] bg-[#f5f6f8] shadow-[0_28px_70px_rgba(16,24,40,.18)]"><div className="flex items-center justify-center bg-white px-4 py-3 text-xs font-semibold">{name}</div><div className="min-h-[570px] p-4"><div className="rounded-[24px] p-5 text-white" style={{background:color}}><span className="grid size-12 place-items-center rounded-2xl bg-white/20"><Bot/></span><h3 className="mt-5 text-xl font-semibold">{name||"Название бота"}</h3><p className="mt-2 text-sm leading-5 text-white/80">{description||"Описание появится здесь"}</p></div><div className="mt-4 space-y-2">{buttons.map(button=><button key={button.id} className="flex h-12 w-full items-center justify-between rounded-2xl border border-[#e4e7ec] bg-white px-4 text-left text-sm font-semibold shadow-sm">{button.label}<ChevronRight className="size-4 text-[#98a2b3]"/></button>)}</div></div><div className="grid grid-cols-3 border-t border-[#e4e7ec] bg-white p-2 text-center text-[10px] text-[#667085]"><span>Главная</span><span>Заказы</span><span>Профиль</span></div></div></aside>
  </div>
  {publishState!=="idle"&&publishState!=="published"&&publishState!=="connection"&&publishState!=="error"&&<PublishOverlay state={publishState}/>} 
  {publishState==="published"&&<div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#101828] px-5 py-4 text-sm font-semibold text-white shadow-xl"><Check className="size-5 text-[#6ce9a6]"/>Бот опубликован. Изменения доступны в Telegram.</div>}
  {publishState==="error"&&<div className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#7a271a] px-5 py-4 text-sm font-semibold text-white shadow-xl"><span className="flex-1">{loadError||"Не удалось выполнить операцию. Повторите попытку."}</span><button onClick={()=>setPublishState("idle")}><Trash2 className="size-4"/></button></div>}
  {publishState==="connection"&&connectUrl&&<div className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#101828] px-5 py-4 text-sm text-white shadow-xl"><span className="flex-1"><strong className="block">Проект сохранён</strong><small className="text-white/70">Подтвердите создание бота в Telegram — после этого публикация завершится автоматически.</small></span><a href={connectUrl} className="shrink-0 rounded-xl bg-white px-4 py-2 font-semibold text-[#101828]">Открыть Telegram</a></div>}
 </main>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span className="mb-2 block text-sm font-medium">{label}</span><span className="[&>input]:h-11 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-[#d0d5dd] [&>input]:px-3 [&>textarea]:min-h-24 [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-[#d0d5dd] [&>textarea]:p-3">{children}</span></label>}
function PublishOverlay({state}:{state:PublishState}){const title=state==="saving"?"Сохраняем изменения":state==="validating"?"Проверяем данные":"Публикуем в Telegram";const text=state==="publishing"?"Собираем новую версию Mini App и обновляем меню бота. Обычно это занимает до минуты.":"Проверяем обязательные поля, изображения и настройки кнопок.";return <div className="fixed inset-0 z-50 grid place-items-center bg-[#101828]/45 p-4"><div className="w-full max-w-md rounded-[24px] bg-white p-7 text-center shadow-2xl"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f0ecff] text-[#6d45f5]"><LoaderCircle className="size-7 animate-spin"/></span><h2 className="mt-5 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#667085]">{text}</p><div className="mt-6 h-2 overflow-hidden rounded-full bg-[#eaecf0]"><div className={`h-full rounded-full bg-[#6d45f5] transition-all ${state==="publishing"?"w-[82%]":"w-[45%]"}`}/></div><p className="mt-3 text-xs text-[#98a2b3]">Не закрывайте окно до завершения публикации</p></div></div>}
