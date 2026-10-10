"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, ExternalLink, ImagePlus, KeyRound, Package, Rocket, Send, ShoppingBag, Sparkles, UtensilsCrossed } from "lucide-react";

type Stage = 0 | 1 | 2 | 3;
type TemplateId = "delivery" | "store" | "service" | "course";
type ConnectionChoice = "new" | "existing" | "later";
type TelegramIdentity = {name:string;username:string};
const templates = [
 {id:"store" as const,title:"Интернет-магазин",description:"Товары, каталог, корзина и заказы",Icon:ShoppingBag},
 {id:"delivery" as const,title:"Доставка еды",description:"Меню, оформление заказов и доставка",Icon:UtensilsCrossed},
 {id:"service" as const,title:"Услуги и запись",description:"Заявки, услуги и клиенты",Icon:Clock3},
 {id:"course" as const,title:"Обучение",description:"Курсы, уроки и доступ к материалам",Icon:BookOpen},
];
const stages = ["Telegram","Шаблон","Настройка","Запуск"];
const card = "rounded-[18px] border border-[#e0e5ed] bg-white p-5";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#4420e7] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#d7dce6] bg-white px-5 text-sm font-medium text-[#101828] disabled:opacity-50";
function telegramData(){return (window as typeof window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??""}
function getKey(){const key="botStudioOnboardingRequestKeyV2";let value=sessionStorage.getItem(key);if(!value){value=crypto.randomUUID().replaceAll("-","");sessionStorage.setItem(key,value)}return value}

export default function OnboardingPage(){
 const router=useRouter();
 const [stage,setStage]=useState<Stage>(0);
 const [choice,setChoice]=useState<ConnectionChoice>("new");
 const [templateId,setTemplateId]=useState<TemplateId>("store");
 const [name,setName]=useState("");
 const [description,setDescription]=useState("");
 const [color,setColor]=useState("#6541F5");
 const [avatar,setAvatar]=useState<File|null>(null);
 const [avatarUrl,setAvatarUrl]=useState("");
 const [botId,setBotId]=useState<string|null>(null);
 const [token,setToken]=useState("");
 const [credentialId,setCredentialId]=useState("");
 const [verified,setVerified]=useState<TelegramIdentity|null>(null);
 const [connected,setConnected]=useState<TelegramIdentity|null>(null);
 const [published,setPublished]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [progressNotice,setProgressNotice]=useState("");
 const template=useMemo(()=>templates.find(item=>item.id===templateId)??templates[0],[templateId]);
 const SelectedIcon=template.Icon;
 useEffect(()=>{if(!avatar)return;const url=URL.createObjectURL(avatar);setAvatarUrl(url);return()=>URL.revokeObjectURL(url)},[avatar]);
 const resetMessage=()=>{setError("");setProgressNotice("")};
 const goBack=()=>{resetMessage();setStage(s=>Math.max(0,s-1) as Stage)};
 async function ensureBot():Promise<string|null>{
  if(botId)return botId;
  if(!name.trim()){setError("Введите название бота.");return null}
  setBusy(true);resetMessage();
  try{
   const response=await fetch("/api/onboarding",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData:telegramData(),requestKey:getKey(),botName:name.trim(),description:description.trim(),templateType:templateId,primaryColor:color,secondaryColor:"#F0ECFF"})});
   const result=await response.json() as {bot?:{id?:string};error?:string};
   if(!response.ok||!result.bot?.id)throw new Error(result.error??"Не удалось создать бота.");
   const id=result.bot.id;setBotId(id);localStorage.setItem("botStudioBotId",id);
   if(avatar){
    const form=new FormData();form.append("botId",id);form.append("logo",avatar);if(telegramData())form.append("initData",telegramData());
    const upload=await fetch("/api/bots/logo",{method:"POST",body:form});
    if(!upload.ok)setProgressNotice("Бот сохранён. Аватар пока не загрузился — его можно добавить в редакторе.");
   }
   return id;
  }catch(e){setError(e instanceof Error?e.message:"Не удалось создать бота.");return null}
  finally{setBusy(false)}
 }
 async function nextFromSetup(){
  const id=await ensureBot();
  if(id){resetMessage();setStage(3)}
 }
 async function inspectToken(){
  const id=await ensureBot();if(!id)return;
  if(!token.trim()){setError("Вставьте токен, полученный в BotFather.");return}
  setBusy(true);resetMessage();
  try{
   const response=await fetch("/api/channels/telegram/token",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"inspect",botId:id,token:token.trim(),initData:telegramData()})});
   const result=await response.json() as {bot?:TelegramIdentity;credentialId?:string;error?:string};
   if(!response.ok||!result.bot||!result.credentialId)throw new Error(result.error??"Telegram не подтвердил токен.");
   setCredentialId(result.credentialId);setVerified(result.bot);setToken("");
  }catch(e){setError(e instanceof Error?e.message:"Не удалось проверить токен.")}
  finally{setBusy(false)}
 }
 async function connect(){
  if(!botId||!credentialId)return;
  setBusy(true);resetMessage();
  try{
   const response=await fetch("/api/channels/telegram/token",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"connect",botId,credentialId,initData:telegramData()})});
   const result=await response.json() as {connected?:boolean;bot?:TelegramIdentity;error?:string};
   if(!response.ok||!result.connected)throw new Error(result.error??"Не удалось подключить Telegram.");
   setConnected(result.bot??verified);setCredentialId("");setVerified(null);
   setProgressNotice("Telegram-бот подключён. Можно перейти к запуску.");
  }catch(e){setError(e instanceof Error?e.message:"Ошибка подключения.")}
  finally{setBusy(false)}
 }
 async function publish(){
  if(!botId||!connected)return;
  setBusy(true);resetMessage();
  try{
   const response=await fetch("/api/publish",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData:telegramData(),botId,name,description,color,buttons:[]})});
   const result=await response.json() as {status?:string;error?:string};
   if(!response.ok||result.status!=="published")throw new Error(result.error??"Публикация не завершена.");
   setPublished(true);sessionStorage.removeItem("botStudioOnboardingRequestKeyV2");
  }catch(e){setError(e instanceof Error?e.message:"Публикация не завершена.")}
  finally{setBusy(false)}
 }
 return <main className="min-h-dvh bg-[#f6f7fa] text-[#101828]">
  <header className="border-b border-[#e5e7eb] bg-white"><div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5">
    <Link href="/workspace" className="flex items-center gap-3 text-lg font-bold text-[#101828] no-underline"><span className="grid size-10 place-items-center rounded-xl bg-[#4420e7] text-white"><Bot size={22}/></span>Bot Studio</Link>
    <Link href="/workspace" className="text-sm font-medium text-[#667085] no-underline">В кабинет <ArrowRight size={15} className="inline"/></Link>
  </div></header>
  <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-10 lg:grid-cols-[270px_minmax(0,1fr)]">
   <aside className="lg:sticky lg:top-8 lg:self-start">
    <p className="text-xs font-semibold uppercase tracking-widest text-[#98a2b3]">Создание бота</p>
    <nav aria-label="Этапы создания" className="mt-5 flex flex-wrap gap-2 lg:flex-col">{stages.map((title,i)=><div key={title} aria-current={stage===i?"step":undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${stage===i?"bg-[#eee9ff] font-semibold text-[#4420e7]":i<stage?"text-[#166534]":"text-[#667085]"}`}><span className={`grid size-8 shrink-0 place-items-center rounded-full ${stage===i?"bg-[#4420e7] text-white":i<stage?"bg-[#dcfce7] text-[#166534]":"bg-[#edf0f5]"}`}>{i<stage?<Check size={16}/>:i+1}</span><span>{title}</span></div>)}</nav>
    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#e6e9f1]"><div className="h-full rounded-full bg-[#6541F5] transition-all" style={{width:`${(stage+1)*25}%`}}/></div>
    <p className="mt-3 text-xs text-[#98a2b3]">Шаг {stage+1} из 4</p>
   </aside>
   <div className="min-w-0">
    {error&&<div role="alert" className="mb-5 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b42318]">{error}</div>}
    {progressNotice&&<div role="status" className="mb-5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">{progressNotice}</div>}
    {stage===0&&<section>
     <h1 className="text-3xl font-semibold tracking-tight">Подключите Telegram</h1><p className="mt-2 text-sm text-[#667085]">Новый бот или уже существующий? Выберите удобный вариант.</p>
     <div className="mt-8 grid gap-3 sm:grid-cols-2">
      {([{value:"new",title:"Создать нового бота",desc:"Покажем, как создать бота через BotFather",Icon:Bot},{value:"existing",title:"Подключить существующего",desc:"Проверим токен и подключим вашего бота",Icon:KeyRound}] as const).map(item=><button type="button" onClick={()=>setChoice(item.value)} key={item.value} className={`${card} flex min-h-[180px] flex-col items-start text-left transition-colors ${choice===item.value?"!border-[#6541F5] !bg-[#f8f6ff]":"hover:border-[#aaa0f0]"}`}><item.Icon className="text-[#6541F5]" size={26}/><strong className="mt-4 text-base">{item.title}</strong><span className="mt-2 text-sm text-[#667085]">{item.desc}</span><span className="mt-auto pt-4 text-xs font-semibold text-[#6541F5]">{choice===item.value?"Выбрано":"Выбрать"}</span></button>)}
     </div>
     {choice==="new"&&<div className={card+" mt-4"}><p className="text-sm font-semibold">Что нужно сделать позже</p><p className="mt-2 text-sm text-[#667085]">Откройте <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[#4420e7]">@BotFather</a>, отправьте /newbot, задайте название и username, затем скопируйте токен. Вставим его на этапе настройки.</p></div>}
     <button type="button" onClick={()=>setChoice("later")} className="mt-4 text-sm text-[#667085] underline underline-offset-4">Подключить Telegram позже</button>
    </section>}
    {stage===1&&<section>
     <h1 className="text-3xl font-semibold tracking-tight">Выберите шаблон</h1><p className="mt-2 text-sm text-[#667085]">Кабинет и Mini App подстроятся под тип бизнеса. Шаблон можно доработать позже.</p>
     <div className="mt-8 grid gap-3 sm:grid-cols-2">{templates.map(item=><button type="button" key={item.id} onClick={()=>setTemplateId(item.id)} className={`${card} flex min-h-[145px] flex-col items-start text-left ${templateId===item.id?"!border-[#6541F5] !bg-[#f8f6ff]":""}`}><item.Icon className="text-[#6541F5]" size={25}/><strong className="mt-3 text-base">{item.title}</strong><span className="mt-1 text-sm text-[#667085]">{item.description}</span></button>)}</div>
    </section>}
    {stage===2&&<section>
     <h1 className="text-3xl font-semibold tracking-tight">Настройте бота</h1><p className="mt-2 text-sm text-[#667085]">Задайте основные данные. Всё остальное можно настроить позже в редакторе.</p>
     <div className="mt-8 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]"><div className={card+" space-y-4"}>
      <label className="block text-sm font-medium">Название бота <span className="text-red-500">*</span><input maxLength={64} value={name} onChange={event=>setName(event.target.value)} placeholder="Например, Мой магазин" className="mt-2 h-11 w-full rounded-lg border border-[#d7dce6] px-3 outline-[#6541F5]"/></label>
      <label className="block text-sm font-medium">Описание<textarea maxLength={512} rows={3} value={description} onChange={event=>setDescription(event.target.value)} placeholder="Чем бот поможет вашим клиентам?" className="mt-2 w-full rounded-lg border border-[#d7dce6] p-3 outline-[#6541F5]"/></label>
      <div className="flex items-center gap-3"><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[#eee9ff] text-[#6541F5]">{avatarUrl?<img src={avatarUrl} alt="Предпросмотр аватара" className="size-full object-cover"/>:<ImagePlus size={23}/>}</div><label className="block min-w-0 text-sm font-medium">Аватар (необязательно)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{const f=event.target.files?.[0]??null;if(f&&f.size>2*1024*1024){setError("Максимальный размер изображения — 2 МБ.");return}setAvatar(f)}} className="mt-2 block w-full text-xs"/></label></div>
      <label className="flex items-center gap-3 text-sm font-medium">Основной цвет <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="size-10 cursor-pointer rounded-lg"/><span className="font-mono text-xs text-[#667085]">{color}</span></label>
      {choice!=="later"&&!connected&&<div className="border-t border-[#e5e7eb] pt-5">
       <p className="text-sm font-semibold">Подключение через BotFather</p>
       <p className="mt-1 text-xs text-[#667085]">Сначала сохраните проект, затем проверьте токен. Не отправляйте токен в чат или другим людям.</p>
       {!verified?<div className="mt-3 flex gap-2"><input type="password" autoComplete="off" value={token} onChange={event=>setToken(event.target.value)} placeholder="Telegram Bot API token" className="h-11 min-w-0 flex-1 rounded-lg border border-[#d7dce6] px-3 text-sm"/><button type="button" onClick={()=>void inspectToken()} disabled={busy||!name.trim()||!token.trim()} className={secondary}>Проверить</button></div>:
       <div className="mt-3 rounded-xl bg-[#f3f0ff] p-4 text-sm"><strong>{verified.name} · @{verified.username}</strong><div className="mt-3 flex gap-2"><button className={primary} disabled={busy} onClick={()=>void connect()}>Подтвердить подключение</button><button className={secondary} onClick={()=>{setVerified(null);setCredentialId("")}}>Другой токен</button></div></div>}
      </div>}
      {connected&&<p className="flex items-center gap-2 rounded-lg bg-[#f0fdf4] p-3 text-sm text-[#166534]"><CheckCircle2 size={18}/>Telegram подключён: @{connected.username}</p>}
     </div>
     <aside className={card}><div className="flex items-center gap-2 text-xs font-semibold text-[#667085]"><Sparkles size={16}/>Предпросмотр</div><div className="mt-4 rounded-xl px-4 py-9 text-center text-white" style={{background:color}}><div className="mx-auto grid size-16 place-items-center overflow-hidden rounded-full bg-white/20">{avatarUrl?<img src={avatarUrl} className="size-full object-cover" alt=""/>:<SelectedIcon size={30}/>}</div><h2 className="mt-4 font-semibold">{name||"Название бота"}</h2><p className="mt-2 text-xs opacity-80">{description||template.description}</p></div><p className="mt-3 text-xs text-[#98a2b3]">Полный предпросмотр Telegram и Mini App доступен в редакторе.</p></aside>
     </div>
    </section>}
    {stage===3&&<section>
      <h1 className="text-3xl font-semibold tracking-tight">{published?"Бот опубликован!":"Проверка и запуск"}</h1><p className="mt-2 text-sm text-[#667085]">{published?"Можно открыть Telegram или продолжить настройку.":"Проверьте готовность бота перед публикацией."}</p>
      <div className={card+" mt-8 space-y-4"}>
       <div className="flex items-center gap-3"><CheckCircle2 className="text-[#16a34a]"/><span className="flex-1 text-sm">Проект «{name}» создан</span><span className="text-xs text-[#16a34a]">Готово</span></div>
       <div className="flex items-center gap-3">{connected?<CheckCircle2 className="text-[#16a34a]"/>:<KeyRound className="text-[#d97706]"/>}<span className="flex-1 text-sm">{connected?`Telegram подключён: @${connected.username}`:"Telegram ещё не подключён"}</span>{!connected&&<button type="button" onClick={()=>setStage(2)} className="text-xs font-semibold text-[#4420e7]">Подключить</button>}</div>
       <div className="flex items-center gap-3"><CheckCircle2 className="text-[#16a34a]"/><span className="flex-1 text-sm">Выбран шаблон «{template.title}»</span></div>
       <div className="rounded-xl bg-[#f7f8fb] p-4 text-sm text-[#667085]">Приветствие, кнопки, первый товар или услуга настраиваются в редакторе. Для публикации потребуется публичный HTTPS-адрес приложения.</div>
      </div>
      {published&&connected&&<a target="_blank" rel="noreferrer" href={`https://t.me/${connected.username}`} className={secondary+" mt-5 no-underline"}>Открыть бота в Telegram <ExternalLink size={17}/></a>}
    </section>}
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] pt-6">
     {stage===0?<Link href="/workspace" className={secondary+" no-underline"}><ArrowLeft size={16}/>Отмена</Link>:<button type="button" onClick={goBack} className={secondary}><ArrowLeft size={16}/>Назад</button>}
     {stage<2?<button type="button" onClick={()=>{resetMessage();setStage((stage+1) as Stage)}} className={primary}>Продолжить <ArrowRight size={16}/></button>:
      stage===2?<button type="button" onClick={()=>void nextFromSetup()} disabled={busy||!name.trim()} className={primary}>{busy?"Сохраняем…":"К проверке"} <ArrowRight size={16}/></button>:
      <div className="flex flex-wrap gap-2">
       <Link href={botId?`/workspace/builder?bot=${encodeURIComponent(botId)}`:"/workspace"} className={secondary+" no-underline"}>Открыть редактор <ArrowRight size={16}/></Link>
       {!published&&<button type="button" onClick={()=>void publish()} disabled={busy||!connected} className={primary}>{busy?"Публикуем…":"Опубликовать бота"} <Rocket size={17}/></button>}
       {published&&<button type="button" onClick={()=>router.push("/workspace")} className={primary}>Перейти в кабинет <ChevronRight size={16}/></button>}
      </div>}
    </div>
   </div>
  </div>
 </main>
}
