"use client";

import { ArrowLeft, Bell, Grid2X2, MoreHorizontal, Paperclip, Search, Smartphone, VolumeX, Wifi, BatteryFull, Signal } from "lucide-react";

type Props={name:string;description:string;color:string;buttons:{id:string;label:string;action:string}[];view:"profile"|"chat"};

export default function FigmaTelegramPreview({name,description,color,buttons,view}:Props){
 const visibleName=name.trim()||"Название бота";
 const greeting=description.trim()||"Приветствуем! Добро пожаловать в наш бот.";
 return <div className="flex h-[min(800px,calc(100dvh-175px))] min-h-[340px] w-full max-w-[370px] flex-col overflow-hidden rounded-[15px] bg-[#eef2f4] text-[#080b2b]">
  <div className="flex h-[34px] items-center justify-between px-6 text-[12px] font-semibold"><span>9:41</span><div className="flex items-center gap-1"><Signal size={13}/><Wifi size={13}/><BatteryFull size={17}/></div></div>
  {view==="profile"?<>
   <section className="flex min-h-[180px] flex-col items-center pt-6">
    <div className="flex w-full justify-start pl-4"><ArrowLeft size={19}/></div>
    <span className="mt-[-7px] grid size-[72px] place-items-center rounded-full text-[25px] font-semibold text-white" style={{background:color}}>{visibleName.slice(0,1).toUpperCase()}</span>
    <h3 className="mt-3 max-w-[90%] truncate text-[17px] font-semibold">{visibleName}</h3><p className="text-[11px] text-[#8d969f]">Telegram-бот</p>
   </section>
   <div className="mx-3 grid grid-cols-4 gap-1.5">{[{icon:Bell,label:"mute"},{icon:Search,label:"search"},{icon:Smartphone,label:"share"},{icon:MoreHorizontal,label:"more"}].map(x=><div key={x.label} className="flex h-[48px] flex-col items-center justify-center rounded-[7px] bg-white text-[#297bff]"><x.icon size={16}/><small className="mt-0.5 text-[10px]">{x.label}</small></div>)}</div>
   <div className="mx-3 mt-4 rounded-lg bg-white px-4"><div className="border-b border-[#e7eaf0] py-3"><small className="block text-[11px] text-[#98a2b3]">link</small><span className="text-[13px] text-[#267bff]">@{visibleName.toLowerCase().replace(/\s+/g,"_")}</span></div><div className="py-3"><small className="block text-[11px] text-[#98a2b3]">description</small><p className="mt-1 line-clamp-3 text-[12px] leading-[17px]">{description||"Описание бота"}</p></div></div>
   <div className="mt-4 border-b border-[#dce4e9] bg-white"><div className="flex gap-4 overflow-hidden px-4 py-3 text-[11px] text-[#969da5]"><strong className="border-b-2 border-[#2389ff] pb-2 text-[#2389ff]">Visions</strong><span>Media</span><span>Files</span><span>Voice</span><span>Links</span><span>Music</span></div></div>
   <div className="grid min-h-0 flex-1 grid-cols-3 gap-[2px] bg-[#dce4e9] p-[2px]">{Array.from({length:6},(_,i)=><div key={i} className="grid place-items-center bg-[#dce3e8] text-[#a5b2bd]"><Grid2X2 size={19}/></div>)}</div>
  </>:<>
   <div className="flex h-[62px] items-center gap-3 border-b border-[#cbd9e3] px-3"><span className="text-[13px] text-[#2d8dff]">‹ Chats</span><div className="min-w-0 flex-1 text-center"><div className="truncate text-[14px] font-semibold">{visibleName}</div><div className="text-[10px] text-[#8d969f]">last seen just now</div></div><span className="grid size-8 place-items-center rounded-full text-xs font-semibold text-white" style={{background:color}}>{visibleName[0]?.toUpperCase()}</span></div>
   <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-[#d2e2ed] px-5">
    <div className="grid size-14 place-items-center rounded-2xl bg-[#e8f1fa] text-3xl">🤖</div>
    <div className="max-w-[85%] rounded-[28px] bg-[#1989eb] px-6 py-5 text-center text-[13px] leading-5 text-white shadow-sm">{greeting}</div>
    {buttons.length>0&&<div className="w-full max-w-[85%] space-y-1">{buttons.slice(0,3).map(b=><div key={b.id} className="rounded-lg bg-white/90 px-3 py-2 text-center text-[12px] font-medium text-[#2389ed]">{b.label}</div>)}</div>}
   </div>
   <div className="flex h-[53px] items-center gap-2 px-3 text-[#a3aab3]"><Paperclip size={19}/><span className="flex-1 rounded-full border border-[#d1d7df] bg-white px-4 py-2 text-xs">Message</span><VolumeX size={18}/></div>
  </>}
  <div className="flex h-5 shrink-0 items-center justify-center"><div className="h-1 w-28 rounded-full bg-[#101828]"/></div>
 </div>
}
