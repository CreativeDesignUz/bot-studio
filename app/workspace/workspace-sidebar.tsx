"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {Bot,ChevronDown,ChevronRight,KeyRound,LayoutGrid,Palette,Plus,Settings2,ShieldCheck,UserRound,MessageSquareText,Workflow,Send,Truck} from "lucide-react";
import {productTemplates,type BotTemplateId} from "@/lib/product/templates";

type BotChoice={id:string;name:string;type:BotTemplateId};
type EditorSection="profile"|"message"|"buttons"|"miniapp"|"publish";
type Props={
 botId:string;botType:BotTemplateId;bots:BotChoice[];
 activeSection?:string;onSectionChange?:(id:string)=>void;
 onBotChange?:(id:string)=>void;editorSection?:EditorSection;
 onEditorSectionChange?:(id:EditorSection)=>void;
};
const base="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors";
const normal="text-[#596579] hover:bg-[#f7f7fc] hover:text-[#101828]";
const selected="bg-[#f0ecff] text-[#5634e8]";
const editorOptions=[
 {id:"profile" as const,label:"Профиль бота",icon:UserRound},
 {id:"message" as const,label:"Приветствие",icon:MessageSquareText},
 {id:"buttons" as const,label:"WorkFlow",icon:Workflow},
 {id:"miniapp" as const,label:"Мини-приложение",icon:LayoutGrid},
 {id:"publish" as const,label:"Подключение и запуск",icon:Send},
];
export default function WorkspaceSidebar({botId,botType,bots,activeSection,onSectionChange,onBotChange,editorSection,onEditorSectionChange}:Props){
 const isEditor=!!onEditorSectionChange;
 const [availableBots,setAvailableBots]=useState<BotChoice[]>(bots);
 useEffect(()=>{
  if(!isEditor)return;
  const controller=new AbortController();
  const telegram=(window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp;
  void fetch("/api/workspace",{headers:{"x-telegram-init-data":telegram?.initData??""},signal:controller.signal,cache:"no-store"})
   .then(async response=>response.ok?response.json():null)
   .then((data:{bots?:Array<{id:string;name:string;template_type:BotTemplateId}>}|null)=>{
    if(controller.signal.aborted||!data?.bots)return;
    setAvailableBots(data.bots.filter(bot=>bot.template_type in productTemplates).map(bot=>({id:bot.id,name:bot.name,type:bot.template_type})));
   }).catch(()=>{});
  return()=>controller.abort();
 },[isEditor]);
 const options=productTemplates[botType].modules;
 const linkFor=(section:string)=>"/workspace?bot="+encodeURIComponent(botId)+"&section="+encodeURIComponent(section);
 const nav=(id:string,label:string,Icon:typeof Bot)=>{
  const active=!isEditor&&activeSection===id;
  const cn=base+" "+(active?selected:normal);
  return onSectionChange?
   <button key={id} type="button" onClick={()=>onSectionChange(id)} aria-current={active?"page":undefined} className={cn}><Icon size={18}/>{label}</button>:
   <Link key={id} href={linkFor(id)} className={cn+" no-underline"}><Icon size={18}/>{label}</Link>;
 };
 return <aside aria-label="Боковая навигация Bot Studio" className="flex h-full min-h-0 w-full flex-col border-r border-[#e4e7ec] bg-white px-3 py-5">
  <Link href="/workspace" className="flex items-center gap-2.5 px-3 text-base font-bold text-[#101828] no-underline">
   <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#6541f5] text-white"><Bot size={20}/></span>Bot Studio
  </Link>
  <div className="mt-6 space-y-3 px-1">
   <Link href="/onboarding" className="flex min-h-11 items-center gap-2.5 rounded-xl bg-[#6541f5] px-3.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#5333d8]"><Plus size={19}/>Создать бота</Link>
   <label className="block"><span className="mb-1.5 block px-2 text-[10px] font-semibold uppercase tracking-[.13em] text-[#98a2b3]">Выбор бота</span>
    <span className="relative block">
     <select aria-label="Выбрать рабочего бота" value={botId} disabled={(!onBotChange&&!isEditor)||(isEditor?availableBots:bots).length<2} onChange={e=>{if(onBotChange)onBotChange(e.target.value);else if(isEditor)window.location.assign("/workspace/builder?bot="+encodeURIComponent(e.target.value));}} className="h-12 w-full appearance-none rounded-xl border border-[#e2e6ee] bg-[#f8f9fb] px-3 pr-8 text-sm font-semibold text-[#101828] outline-none focus:border-[#6541f5] disabled:cursor-default disabled:opacity-100">
      {(isEditor?availableBots:bots).length?(isEditor?availableBots:bots).map(bot=><option value={bot.id} key={bot.id}>{bot.name}</option>):<option value={botId}>Текущий бот</option>}
     </select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#667085]"/>
    </span>
   </label>
  </div>
  <div className="mt-5 min-h-0 flex-1 overflow-y-auto pb-3">
   <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#98a2b3]">Управление</p>
   <nav aria-label="Разделы кабинета" className="space-y-0.5">{options.map(({id,label,icon})=>nav(id,label,icon))}</nav>
   <p className="mb-2 mt-5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#98a2b3]">Настройки</p>
   <nav aria-label="Настройки приложения" className="space-y-0.5">
    {(botType==="store"||botType==="delivery")&&nav("miniapp_appearance","Оформление Mini App",Palette)}
    {(botType==="store"||botType==="delivery")&&nav("delivery_settings","Настройки доставки",Truck)}
    <Link href={"/workspace/builder?bot="+encodeURIComponent(botId)} className={base+" "+(isEditor?selected:normal)+" no-underline"}><Settings2 size={18}/>Настройки бота<ChevronRight size={16} className="ml-auto"/></Link>
    {isEditor&&<div className="ml-4 border-l border-[#e5dfff] pl-2">{editorOptions.map(({id,label,icon:Icon})=><button type="button" key={id} onClick={()=>onEditorSectionChange?.(id)} aria-current={editorSection===id?"page":undefined} className={base+" "+(editorSection===id?selected:normal)}><Icon size={16}/>{label}</button>)}</div>}
   </nav>
  </div>
  <nav aria-label="Аккаунт" className="border-t border-[#eaecf0] pt-3">
   <Link href="/workspace/account" className={base+" "+normal+" no-underline"}><UserRound size={18}/>Настройки доступа</Link>
  </nav>
 </aside>;
}
