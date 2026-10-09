"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, Check, ChevronRight, Eye, GripVertical, LoaderCircle, Plus, Save, Send, Trash2, MessageCircle, Smartphone, ExternalLink } from "lucide-react";

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
 const [activeSection,setActiveSection]=useState<"message"|"buttons"|"miniapp"|"publish">("message");
 const [previewMode,setPreviewMode]=useState<"telegram"|"miniapp">("telegram");
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
  <header className="sticky top-0 z-30 flex min-h-[68px] flex-wrap items-center gap-3 border-b border-[#e4e7ec] bg-white/95 px-4 py-3 backdrop-blur sm:px-7"><Link href="/workspace" className="grid size-10 place-items-center rounded-xl border border-[#e4e7ec]"><ArrowLeft className="size-4"/></Link><span className="grid size-10 place-items-center rounded-xl bg-[#f0ecff] text-[#6d45f5]"><Bot className="size-5"/></span><div><strong className="block text-sm">Редактор бота</strong><span className="text-xs text-[#98a2b3]">{saved&&!dirty?"Все изменения сохранены":"Есть несохранённые изменения"}</span></div><div className="ml-auto flex gap-2"><button onClick={save} disabled={!dirty||publishState!=="idle"} className="flex h-10 items-center gap-2 rounded-xl border border-[#d0d5dd] px-3 text-sm font-semibold disabled:opacity-40"><Save className="size-4"/><span className="hidden sm:inline">Сохранить</span></button><button type="button" onClick={publish} disabled={publishState!=="idle"&&publishState!=="published"} style={{color:"#ffffff"}} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#101828] px-4 text-sm font-semibold disabled:opacity-60"><Send className="size-4 shrink-0"/><span>{publishState==="published"?"Опубликовано":"Опубликовать"}</span></button></div></header>
  <div className="mx-auto grid max-w-[1580px] gap-5 p-4 sm:p-7 xl:grid-cols-[250px_minmax(0,1fr)_360px]">
   <aside className="rounded-[22px] border border-[#e4e7ec] bg-white p-3 xl:sticky xl:top-[92px] xl:h-fit">
    <p className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[#98a2b3]">Telegram-бот</p>
    {([{id:"message",label:"Приветственное сообщение",icon:MessageCircle},{id:"buttons",label:"Кнопки под сообщением",icon:Bot},{id:"miniapp",label:"Мини-приложение",icon:Smartphone},{id:"publish",label:"Подключение и запуск",icon:Send}] as const).map(item=>{
     const Icon=item.icon;
     return <button key={item.id} type="button" onClick={()=>{setActiveSection(item.id);setPreviewMode(item.id==="miniapp"?"miniapp":"telegram")}} className={`mb-1 flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium ${activeSection===item.id?"bg-[#f0ecff] text-[#5934dc]":"text-[#667085] hover:bg-[#f9fafb]"}`}><Icon className="size-4 shrink-0"/><span className="flex-1">{item.label}</span><ChevronRight className="size-4"/></button>
    })}
    <div className="mt-6 rounded-2xl bg-[#f9fafb] p-4"><strong className="text-sm">Как это работает</strong><p className="mt-2 text-xs leading-5 text-[#667085]">1. Настройте сообщение /start и кнопки.<br/>2. При необходимости наполните Mini App.<br/>3. Подключите Telegram и опубликуйте.</p></div>
   </aside>
   <section className="space-y-5">
    {activeSection==="message" && <div className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7">
      <span className="text-xs font-semibold text-[#6d45f5]">Шаг 1 · Telegram</span>
      <h1 className="mt-2 text-2xl font-semibold">Приветственное сообщение</h1>
      <p className="mt-2 text-sm leading-6 text-[#667085]">Именно это сообщение клиент получит в чате, когда нажмёт <strong>/start</strong>. Меняйте текст и сразу смотрите результат справа.</p>
      <div className="mt-6 space-y-5">
       <Field label="Название бота"><input value={name} maxLength={64} onChange={e=>change(()=>setName(e.target.value))}/></Field>
       <Field label="Текст сообщения /start"><textarea rows={6} maxLength={512} value={description} placeholder="Здравствуйте! Добро пожаловать. Чем можем помочь?" onChange={e=>change(()=>setDescription(e.target.value))}/></Field>
       <p className="text-xs text-[#98a2b3]">{description.length}/512 символов · сейчас текст хранится как описание бота</p>
       <button type="button" onClick={()=>setActiveSection("buttons")} className="inline-flex items-center gap-2 rounded-xl bg-[#6541f5] px-5 py-3 text-sm font-semibold text-white">Настроить кнопки <ChevronRight className="size-4"/></button>
      </div>
    </div>}
    {activeSection==="buttons" && <div className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7">
      <span className="text-xs font-semibold text-[#6d45f5]">Шаг 2 · Telegram</span>
      <h1 className="mt-2 text-2xl font-semibold">Кнопки под сообщением</h1>
      <p className="mt-2 text-sm leading-6 text-[#667085]">Эти кнопки появятся прямо под сообщением /start. При нажатии клиент откроет ваш Mini App. Если ничего не добавлять, будет кнопка «Открыть приложение».</p>
      <div className="mt-6 space-y-3">{buttons.map((button,index)=><div key={button.id} className="flex items-center gap-3 rounded-2xl border border-[#e4e7ec] p-3"><GripVertical className="size-4 shrink-0 text-[#98a2b3]"/><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f2f4f7] text-xs font-semibold">{index+1}</span><div className="min-w-0 flex-1"><input aria-label={`Текст кнопки ${index+1}`} maxLength={60} value={button.label} onChange={e=>change(()=>setButtons(v=>v.map(x=>x.id===button.id?{...x,label:e.target.value}:x)))} placeholder="Название кнопки" className="h-10 w-full bg-transparent text-sm font-medium outline-none"/><p className="text-xs text-[#98a2b3]">Открывает Mini App</p></div><button type="button" onClick={()=>change(()=>setButtons(v=>v.filter(x=>x.id!==button.id)))} aria-label="Удалить кнопку" className="grid size-9 shrink-0 place-items-center rounded-lg text-[#98a2b3] hover:bg-[#fff1f3] hover:text-[#c01048]"><Trash2 className="size-4"/></button></div>)}</div>
      <button type="button" onClick={()=>change(()=>setButtons(v=>[...v,{id:crypto.randomUUID(),label:"Открыть каталог",action:"home"}]))} disabled={buttons.length>=8} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-[#d0d5dd] px-4 text-sm font-semibold disabled:opacity-40"><Plus className="size-4"/>Добавить кнопку</button>
      <p className="mt-4 text-xs text-[#667085]">Дополнительные действия кнопок и ветвления диалога добавим отдельно. Сейчас все кнопки открывают Mini App.</p>
    </div>}
    {activeSection==="miniapp" && <div className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7">
      <span className="text-xs font-semibold text-[#6d45f5]">Шаг 3 · Mini App</span>
      <h1 className="mt-2 text-2xl font-semibold">Мини-приложение для клиентов</h1>
      <p className="mt-2 text-sm leading-6 text-[#667085]">Mini App — это отдельный интерфейс с каталогом, корзиной и заказами. Для создания Telegram-бота добавлять блюдо не обязательно.</p>
      <div className="mt-6 space-y-4"><Field label="Основной цвет Mini App"><div className="flex items-center gap-3"><input type="color" value={color} onChange={e=>change(()=>setColor(e.target.value))} className="size-11 rounded-xl border border-[#d0d5dd] p-1"/><input value={color} onChange={e=>change(()=>setColor(e.target.value))} className="h-11 flex-1 rounded-xl border border-[#d0d5dd] px-3"/></div></Field><div className="rounded-2xl bg-[#f9fafb] p-4 text-sm leading-6 text-[#667085]">Товары, фотографии и категории настраиваются в каталоге кабинета. Отсутствие товаров не мешает сохранить бота.</div><Link href="/workspace" className="inline-flex items-center gap-2 rounded-xl border border-[#d0d5dd] px-4 py-3 text-sm font-semibold">Перейти в кабинет <ExternalLink className="size-4"/></Link></div>
    </div>}
    {activeSection==="publish" && <div className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7">
      <span className="text-xs font-semibold text-[#6d45f5]">Шаг 4 · Запуск</span>
      <h1 className="mt-2 text-2xl font-semibold">Подключить Telegram</h1>
      <p className="mt-2 text-sm leading-6 text-[#667085]">Сохраните приветствие и кнопки, затем нажмите «Опубликовать» вверху. Если Telegram ещё не подключён, система предложит подтвердить создание бота через управляющий аккаунт.</p>
      <button type="button" onClick={publish} disabled={publishState!=="idle"&&publishState!=="published"} className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-[#101828] px-6 text-sm font-semibold text-white disabled:opacity-40"><Send className="size-4"/>Опубликовать бота</button>
      <p className="mt-4 text-xs text-[#98a2b3]">Предпросмотр справа не отправляет сообщения в Telegram, пока бот не подключён и не опубликован.</p>
    </div>}
   </section>
   <aside className="xl:sticky xl:top-[92px] xl:h-fit">
     <div className="mb-3"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-semibold"><Eye className="size-4"/>Предпросмотр клиента</span><span className="text-xs text-[#667085]">Не отправляется в Telegram</span></div>
      <div className="mt-3 grid grid-cols-2 rounded-xl bg-[#e9edf3] p-1"><button type="button" onClick={()=>setPreviewMode("telegram")} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold ${previewMode==="telegram"?"bg-white text-[#101828] shadow-sm":"text-[#667085]"}`}><MessageCircle className="size-4"/>Telegram</button><button type="button" onClick={()=>setPreviewMode("miniapp")} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold ${previewMode==="miniapp"?"bg-white text-[#101828] shadow-sm":"text-[#667085]"}`}><Smartphone className="size-4"/>Mini App</button></div></div>
     {previewMode==="telegram" ? <div className="mx-auto max-w-[360px] overflow-hidden rounded-[24px] border border-[#dbe1ea] bg-[#dbe8e5] shadow-[0_20px_60px_rgba(16,24,40,.13)]">
       <div className="flex items-center gap-3 bg-white px-4 py-3"><ArrowLeft className="size-4 text-[#667085]"/><span className="grid size-10 place-items-center rounded-full text-white" style={{backgroundColor:color}}><Bot className="size-5"/></span><div className="min-w-0"><strong className="block truncate text-sm">{name||"Ваш Telegram-бот"}</strong><small className="text-[#4c9a76]">бот · предпросмотр</small></div></div>
       <div className="flex min-h-[490px] flex-col justify-end gap-3 bg-[radial-gradient(#b9d0c7_1px,transparent_1px)] bg-[length:18px_18px] p-4">
        <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-sm bg-[#dbffc8] px-3 py-2 text-sm shadow-sm">/start <small className="ml-2 text-[10px] text-[#8b9b87]">12:30</small></div>
        <div className="max-w-[94%] overflow-hidden rounded-2xl rounded-bl-sm bg-white shadow-sm">
         <div className="whitespace-pre-wrap break-words px-3 py-3 text-sm leading-6">{description.trim()||"Здравствуйте! Добро пожаловать в наш бот."}<small className="ml-2 text-[10px] text-[#98a2b3]">12:30</small></div>
         <div className="border-t border-[#e4e7ec]">{(buttons.length?buttons:[{id:"default",label:"Открыть приложение",action:"home"}]).map(button=><div key={button.id} className="flex min-h-11 items-center justify-center gap-2 border-b border-[#f2f4f7] px-3 py-2 text-center text-sm font-semibold text-[#3784b6]">{button.label||"Открыть приложение"}<ExternalLink className="size-3"/></div>)}</div>
        </div>
       </div>
       <div className="flex items-center gap-3 bg-white px-4 py-3 text-[#98a2b3]"><span className="flex-1 rounded-full bg-[#f2f4f7] px-4 py-2 text-sm">Сообщение…</span><Send className="size-5"/></div>
      </div> :
      <div className="mx-auto max-w-[360px] overflow-hidden rounded-[34px] border-[8px] border-[#101828] bg-[#f5f6f8] shadow-[0_28px_70px_rgba(16,24,40,.18)]"><div className="flex items-center justify-center bg-white px-4 py-3 text-xs font-semibold">{name}</div><div className="min-h-[510px] p-4"><div className="rounded-[24px] p-5 text-white" style={{background:color}}><span className="grid size-12 place-items-center rounded-2xl bg-white/20"><Bot/></span><h3 className="mt-5 text-xl font-semibold">{name||"Название бота"}</h3><p className="mt-2 text-sm leading-5 text-white/80">{description||"Описание появится здесь"}</p></div><div className="mt-4 rounded-2xl border border-[#e4e7ec] bg-white p-5 text-center text-sm text-[#667085]">Здесь появятся товары и услуги из каталога.</div></div><div className="border-t border-[#e4e7ec] bg-white px-4 py-3 text-center text-[11px] text-[#98a2b3]">Макет Mini App · навигация появится в рабочем приложении</div></div>}
   </aside>
  </div>
  {publishState!=="idle"&&publishState!=="published"&&publishState!=="connection"&&publishState!=="error"&&<PublishOverlay state={publishState}/>} 
  {publishState==="published"&&<div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#101828] px-5 py-4 text-sm font-semibold text-white shadow-xl"><Check className="size-5 text-[#6ce9a6]"/>Бот опубликован. Изменения доступны в Telegram.</div>}
  {publishState==="error"&&<div className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#7a271a] px-5 py-4 text-sm font-semibold text-white shadow-xl"><span className="flex-1">{loadError||"Не удалось выполнить операцию. Повторите попытку."}</span><button onClick={()=>setPublishState("idle")}><Trash2 className="size-4"/></button></div>}
  {publishState==="connection"&&connectUrl&&<div className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#101828] px-5 py-4 text-sm text-white shadow-xl"><span className="flex-1"><strong className="block">Проект сохранён</strong><small className="text-white/70">Подтвердите создание бота в Telegram — после этого публикация завершится автоматически.</small></span><a href={connectUrl} className="shrink-0 rounded-xl bg-white px-4 py-2 font-semibold text-[#101828]">Открыть Telegram</a></div>}
 </main>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span className="mb-2 block text-sm font-medium">{label}</span><span className="[&>input]:h-11 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-[#d0d5dd] [&>input]:px-3 [&>textarea]:min-h-24 [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-[#d0d5dd] [&>textarea]:p-3">{children}</span></label>}
function PublishOverlay({state}:{state:PublishState}){const title=state==="saving"?"Сохраняем изменения":state==="validating"?"Проверяем данные":"Публикуем в Telegram";const text=state==="publishing"?"Собираем новую версию Mini App и обновляем меню бота. Обычно это занимает до минуты.":"Проверяем обязательные поля, изображения и настройки кнопок.";return <div className="fixed inset-0 z-50 grid place-items-center bg-[#101828]/45 p-4"><div className="w-full max-w-md rounded-[24px] bg-white p-7 text-center shadow-2xl"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f0ecff] text-[#6d45f5]"><LoaderCircle className="size-7 animate-spin"/></span><h2 className="mt-5 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#667085]">{text}</p><div className="mt-6 h-2 overflow-hidden rounded-full bg-[#eaecf0]"><div className={`h-full rounded-full bg-[#6d45f5] transition-all ${state==="publishing"?"w-[82%]":"w-[45%]"}`}/></div><p className="mt-3 text-xs text-[#98a2b3]">Не закрывайте окно до завершения публикации</p></div></div>}
