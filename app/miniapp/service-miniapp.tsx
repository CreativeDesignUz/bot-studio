"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, ClipboardList, UserRound, X } from "lucide-react";

type Item={id:string;name:string;description:string;image_url:string|null;price_minor:number|null;currency:string};
type Shop={bot:{id:string;name:string;description:string;logoUrl:string|null;color:string;template:string};items:Item[]};
type Request={id:string;status:string;payment_status:string;total_minor:number;currency:string;created_at:string;payload:{service_name?:string;brief?:string};order_items?:{item_name:string}[]};
const money=(amount:number,currency:string)=>new Intl.NumberFormat("ru-RU",{style:"currency",currency,maximumFractionDigits:currency==="UZS"?0:2}).format(amount/100);
const statusText:Record<string,string>={new:"На рассмотрении",confirmed:"Подтверждена · ожидает оплаты",in_progress:"В работе",completed:"Завершена",cancelled:"Отменена"};

export default function ServiceMiniApp({shop}:{shop:Shop}){
  const [tab,setTab]=useState<"catalog"|"requests"|"profile">("catalog");
  const [selected,setSelected]=useState<Item|null>(null);
  const [step,setStep]=useState<"detail"|"form"|"success">("detail");
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [brief,setBrief]=useState("");
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");
  const [requestId,setRequestId]=useState("");
  const [requests,setRequests]=useState<Request[]>([]);
  const [requestsLoading,setRequestsLoading]=useState(false);
  const requestKey=useRef<string|null>(null);
  const color=/^#[\da-f]{6}$/i.test(shop.bot.color)?shop.bot.color:"#6541F5";
  const initData=()=>(window as typeof window&{Telegram?:{WebApp?:{initData?:string;initDataUnsafe?:{user?:{first_name?:string}}}}}).Telegram?.WebApp?.initData??"";

  useEffect(()=>{
    const telegram=(window as typeof window&{Telegram?:{WebApp?:{initDataUnsafe?:{user?:{first_name?:string}}}}}).Telegram?.WebApp;
    const first=telegram?.initDataUnsafe?.user?.first_name;
    if(first) Promise.resolve().then(()=>setName(first));
  },[]);

  async function loadRequests(){
    setRequestsLoading(true);setError("");
    try{
      const response=await fetch("/api/service-requests?bot="+encodeURIComponent(shop.bot.id),{headers:{"x-telegram-init-data":initData()},cache:"no-store"});
      const result=await response.json() as {requests?:Request[];error?:string};
      if(!response.ok)throw new Error(result.error??"Не удалось получить заявки.");
      setRequests(result.requests??[]);
    }catch(e){setError(e instanceof Error?e.message:"Ошибка загрузки.");}
    finally{setRequestsLoading(false)}
  }
  function switchTab(next:"catalog"|"requests"|"profile"){
    setTab(next);setSelected(null);setError("");
    if(next==="requests")void loadRequests();
  }
  function openService(item:Item){setSelected(item);setStep("detail");setError("");requestKey.current=null;setBrief("");}
  async function submit(){
    if(!selected||sending)return;
    const data=initData();
    if(!data){setError("Откройте Mini App через Telegram для отправки заявки.");return}
    requestKey.current??=crypto.randomUUID().replaceAll("-","");
    setSending(true);setError("");
    try{
      const response=await fetch("/api/service-requests",{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({botId:shop.bot.id,itemId:selected.id,initData:data,requestKey:requestKey.current,name,phone,brief})});
      const result=await response.json() as {requestId?:string;error?:string};
      if(!response.ok||!result.requestId)throw new Error(result.error??"Не удалось отправить заявку.");
      setRequestId(result.requestId);setStep("success");requestKey.current=null;
    }catch(e){setError(e instanceof Error?e.message:"Ошибка отправки.");}
    finally{setSending(false)}
  }
  const action="w-full rounded-xl px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50";
  return <main className="min-h-dvh bg-[#f7f8fa] pb-28 text-[#101828]">
    <div className="mx-auto max-w-[550px]">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white px-5 py-4">
        {shop.bot.logoUrl?<img src={shop.bot.logoUrl} className="size-12 shrink-0 rounded-xl object-cover" alt=""/>:<span className="grid size-12 place-items-center rounded-xl text-white" style={{background:color}}><BriefcaseBusiness/></span>}
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-semibold">{shop.bot.name}</h1><p className="truncate text-xs text-[#667085]">Онлайн-услуги · по заявке</p></div>
      </header>
      {error&&<div role="alert" className="m-4 flex justify-between rounded-xl bg-[#fff1f2] p-3 text-sm text-[#be123c]">{error}<button onClick={()=>setError("")} aria-label="Закрыть"><X size={16}/></button></div>}
      {tab==="catalog"&&!selected&&<section className="px-5 pt-7">
        <h2 className="text-2xl font-bold">Услуги</h2><p className="mt-2 text-sm text-[#667085]">Выберите услугу и отправьте заявку. Оплата только после подтверждения.</p>
        {!shop.items.length?<div className="mt-6 rounded-2xl bg-white p-8 text-center text-[#667085]">Услуг пока нет</div>:<div className="mt-6 space-y-3">{shop.items.map(item=><article key={item.id} className="rounded-2xl border border-[#e4e7ec] bg-white p-4">
          <div className="flex gap-3">{item.image_url?<img src={item.image_url} className="size-20 rounded-xl object-cover" alt=""/>:<div className="grid size-20 shrink-0 place-items-center rounded-xl bg-[#f2f4f7]"><BriefcaseBusiness className="text-[#98a2b3]"/></div>}
            <div className="min-w-0 flex-1"><h3 className="font-semibold">{item.name}</h3><p className="mt-1 line-clamp-2 text-xs text-[#667085]">{item.description}</p><p className="mt-2 font-bold">{item.price_minor==null?"Цена по запросу":money(item.price_minor,item.currency)}</p></div></div>
          <button onClick={()=>openService(item)} className="mt-4 w-full rounded-xl border border-[#d0d5dd] py-3 text-sm font-semibold">Подробнее</button>
        </article>)}</div>}
      </section>}
      {tab==="catalog"&&selected&&<section className="px-5 pt-6">
        <button onClick={()=>{if(step==="form")setStep("detail");else{setSelected(null);setError("")}}} className="flex items-center gap-2 text-sm text-[#667085]"><ArrowLeft size={18}/>Назад</button>
        {step==="detail"&&<div className="mt-5 rounded-2xl bg-white p-5">
          <h2 className="text-2xl font-bold">{selected.name}</h2><p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#475467]">{selected.description||"Онлайн-услуга по заявке"}</p>
          <div className="mt-5 space-y-3 border-t border-[#eaecf0] pt-5 text-sm">
            <div className="flex justify-between"><span>Стоимость</span><b>{selected.price_minor==null?"По согласованию":money(selected.price_minor,selected.currency)}</b></div>
            <div className="flex justify-between"><span>Формат</span><b>Онлайн</b></div>
            <div className="flex justify-between"><span>Оплата</span><b>После подтверждения</b></div>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#667085]">Сначала вы отправляете заявку. Исполнитель проверяет её, затем согласовывает дальнейшие действия и оплату.</p>
          <button onClick={()=>setStep("form")} className={action+" mt-5"} style={{background:color}}>Оставить заявку</button>
        </div>}
        {step==="form"&&<div className="mt-5 rounded-2xl bg-white p-5">
          <h2 className="text-xl font-bold">Заявка на услугу</h2><p className="mt-2 text-sm text-[#667085]">{selected.name}</p>
          <label className="mt-5 block text-sm font-medium">Имя<input value={name} maxLength={100} onChange={e=>{setName(e.target.value);requestKey.current=null}} className="mt-2 h-12 w-full rounded-xl border px-3" placeholder="Как к вам обращаться?"/></label>
          <label className="mt-4 block text-sm font-medium">Телефон или контакт в Telegram (необязательно)<input value={phone} maxLength={40} onChange={e=>{setPhone(e.target.value);requestKey.current=null}} className="mt-2 h-12 w-full rounded-xl border px-3" placeholder="+998 или @username"/></label>
          <label className="mt-4 block text-sm font-medium">Опишите задачу<textarea value={brief} maxLength={2000} onChange={e=>{setBrief(e.target.value);requestKey.current=null}} rows={5} className="mt-2 w-full rounded-xl border p-3" placeholder="Что нужно сделать? Какие есть пожелания?"/></label>
          <div className="mt-5 rounded-xl bg-[#f5f3ff] p-4 text-sm">Стоимость: <b>{selected.price_minor==null?"По согласованию":money(selected.price_minor,selected.currency)}</b><p className="mt-1 text-xs text-[#667085]">Сейчас ничего оплачивать не нужно.</p></div>
          <button onClick={()=>void submit()} disabled={sending||name.trim().length<2||brief.trim().length<5} className={action+" mt-5"} style={{background:color}}>{sending?"Отправляем…":"Отправить заявку"}</button>
        </div>}
        {step==="success"&&<div className="mt-5 rounded-2xl bg-white p-8 text-center">
          <CheckCircle2 className="mx-auto size-14 text-[#12a150]"/><h2 className="mt-4 text-xl font-bold">Заявка отправлена</h2>
          <p className="mt-2 text-sm text-[#667085]">Заявка №{requestId.slice(0,8).toUpperCase()} принята и ожидает рассмотрения. Оплата будет обсуждаться после подтверждения.</p>
          <button onClick={()=>switchTab("requests")} className={action+" mt-6"} style={{background:color}}>Мои заявки</button>
        </div>}
      </section>}
      {tab==="requests"&&<section className="px-5 pt-7"><h2 className="text-2xl font-bold">Мои заявки</h2>
        {requestsLoading?<p className="mt-6 text-[#667085]">Загружаем заявки…</p>:!requests.length?<p className="mt-6 rounded-2xl bg-white p-7 text-center text-[#667085]">Заявок пока нет</p>:
        <div className="mt-5 space-y-3">{requests.map(request=><article key={request.id} className="rounded-2xl bg-white p-5"><h3 className="font-semibold">{request.payload?.service_name??request.order_items?.[0]?.item_name??"Услуга"}</h3>
          <p className="mt-1 text-xs text-[#667085]">№{request.id.slice(0,8).toUpperCase()}</p><p className="mt-3 text-sm font-medium">{statusText[request.status]??request.status}</p>
          <p className="mt-1 text-sm text-[#667085]">{money(request.total_minor,request.currency)}</p>
          {request.status==="confirmed"&&<p className="mt-3 rounded-xl bg-[#fff7ed] p-3 text-xs text-[#9a3412]">Заявка подтверждена. Онлайн-оплата пока не подключена; исполнитель свяжется с вами для согласования оплаты.</p>}
        </article>)}</div>}
      </section>}
      {tab==="profile"&&<section className="px-5 pt-7"><UserRound className="size-9" style={{color}}/><h2 className="mt-3 text-2xl font-bold">Профиль</h2><p className="mt-3 text-sm text-[#667085]">Ваши обращения доступны во вкладке «Мои заявки».</p></section>}
    </div>
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-white pb-[max(8px,env(safe-area-inset-bottom))]"><div className="mx-auto flex max-w-[550px] justify-around p-2">
      {([{id:"catalog",label:"Услуги",icon:BriefcaseBusiness},{id:"requests",label:"Мои заявки",icon:ClipboardList},{id:"profile",label:"Профиль",icon:UserRound}] as const).map(item=><button key={item.id} onClick={()=>switchTab(item.id)} className="flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs" style={{color:tab===item.id?color:"#98a2b3"}}><item.icon size={22}/>{item.label}</button>)}
    </div></nav>
  </main>;
}
