"use client";

import {useCallback,useEffect,useState} from "react";
import {Bell,LoaderCircle,X} from "lucide-react";

type Notification={id:string;title:string;body:string;created_at:string};
const initData=()=> (window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
export default function DemoNotifications({botId}:{botId:string}){
 const [open,setOpen]=useState(false);
 const [loading,setLoading]=useState(false);
 const [notifications,setNotifications]=useState<Notification[]>([]);
 const [error,setError]=useState("");
 const reload=useCallback(async()=>{
  if(!botId)return;
  setLoading(true);setError("");
  try{
   const r=await fetch("/api/demo-content?bot="+encodeURIComponent(botId),{
    headers:{"x-telegram-init-data":initData()},cache:"no-store"
   });
   const d=await r.json() as {notifications?:Notification[];error?:string};
   if(!r.ok)throw new Error(d.error??"Не удалось загрузить уведомления.");
   setNotifications(d.notifications??[]);
  }catch(e){setError(e instanceof Error?e.message:"Ошибка загрузки уведомлений.");}
  finally{setLoading(false);}
 },[botId]);
 useEffect(()=>{
  const listener=(event:Event)=>{
   const d=(event as CustomEvent<{botId:string}>).detail;
   if(d?.botId===botId)void reload();
  };
  window.addEventListener("botstudio:demo-updated",listener);
  return()=>window.removeEventListener("botstudio:demo-updated",listener);
 },[botId,reload]);
 return <div className="relative ml-auto">
  <button type="button" aria-label="Уведомления" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void reload()}} className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-[#e4e7ec] bg-white"><Bell size={18}/>{notifications.length>0&&<span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#6541f5]"/>}</button>
  {open&&<div className="absolute right-0 top-14 z-[60] w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-[0_16px_50px_rgba(16,24,40,.16)]">
   <div className="flex items-center justify-between border-b border-[#eaecf0] px-4 py-3"><strong className="text-sm">Уведомления</strong><button type="button" aria-label="Закрыть уведомления" onClick={()=>setOpen(false)}><X size={17}/></button></div>
   {loading?<p role="status" className="flex items-center gap-2 p-5 text-sm text-[#667085]"><LoaderCircle className="size-4 animate-spin"/>Загружаем…</p>
    :error?<p role="alert" className="p-4 text-sm text-[#b42318]">{error}</p>
    :notifications.length?<div className="max-h-80 divide-y divide-[#eaecf0] overflow-y-auto">{notifications.map(n=><div key={n.id} className="p-4"><div className="flex items-center gap-2"><span className="rounded bg-[#f3e8ff] px-1.5 py-0.5 text-[10px] font-bold text-[#6d28d9]">ДЕМО</span><strong className="text-sm">{n.title}</strong></div><p className="mt-1 text-xs leading-5 text-[#667085]">{n.body}</p></div>)}</div>
    :<p className="p-5 text-sm text-[#667085]">Уведомлений пока нет.</p>}
   <p className="border-t border-[#eaecf0] bg-[#f9fafb] px-4 py-3 text-[11px] leading-4 text-[#667085]">Демо-уведомления видны только в кабинете. Они не отправляются покупателям.</p>
  </div>}
 </div>;
}
