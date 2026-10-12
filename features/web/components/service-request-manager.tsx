"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, LoaderCircle, RefreshCw, X } from "lucide-react";

type Request={id:string;customer_name:string;status:string;payment_status:string;total_minor:number;currency:string;created_at:string;payload:{service_name?:string;brief?:string;phone?:string};order_items?:{item_name:string}[]};
const initData=()=>(window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
const labels:Record<string,string>={new:"Новая",confirmed:"Подтверждена · ожидает оплаты",in_progress:"В работе",completed:"Завершена",cancelled:"Отменена"};
export default function ServiceRequestManager({botId}:{botId:string}){
  const [items,setItems]=useState<Request[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/workspace/service-requests?bot="+encodeURIComponent(botId),{headers:{"x-telegram-init-data":initData()},cache:"no-store"});
      const result=await response.json() as {requests?:Request[];error?:string};
      if(!response.ok)throw new Error(result.error??"Не удалось получить заявки.");
      setItems(result.requests??[]);
    }catch(e){setError(e instanceof Error?e.message:"Ошибка загрузки.");}
    finally{setLoading(false);}
  },[botId]);
  useEffect(()=>{void Promise.resolve().then(load)},[load]);
  async function transition(item:Request,status:string){
    setBusy(item.id);setError("");
    try{
      const response=await fetch("/api/workspace/service-requests",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({botId,requestId:item.id,status,initData:initData()})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??"Статус не обновлён.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Не удалось изменить заявку.");}
    finally{setBusy(null);}
  }
  return <section className="overflow-hidden rounded-[22px] border border-[#e4e7ec] bg-white">
    <div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-semibold">Заявки на услуги</h2><p className="mt-1 text-xs text-[#667085]">Настоящие обращения клиентов из Telegram Mini App</p></div>
      <button onClick={()=>void load()} className="rounded-xl border p-2.5" aria-label="Обновить заявки"><RefreshCw size={18}/></button></div>
    {error&&<p role="alert" className="m-5 rounded-xl bg-[#fff1f2] p-3 text-sm text-[#be123c]">{error}</p>}
    {loading?<div className="flex justify-center gap-2 p-14 text-[#667085]"><LoaderCircle className="animate-spin"/>Загружаем…</div>:
      !items.length?<div className="p-12 text-center"><h3 className="font-semibold">Заявок пока нет</h3><p className="mt-2 text-sm text-[#667085]">Они появятся после того, как клиент отправит обращение через Mini App.</p></div>:
      <div className="divide-y">{items.map(item=><article key={item.id} className="p-5">
        <button className="flex w-full items-center justify-between gap-4 text-left" onClick={()=>setExpanded(expanded===item.id?null:item.id)}>
          <div className="min-w-0"><strong className="block truncate text-sm">{item.payload?.service_name??item.order_items?.[0]?.item_name??"Услуга"}</strong><span className="mt-1 block text-xs text-[#667085]">{item.customer_name} · #{item.id.slice(0,8).toUpperCase()}</span></div>
          <div className="flex shrink-0 items-center gap-3"><span className="text-xs font-medium">{labels[item.status]??item.status}</span><ArrowUpRight size={16}/></div>
        </button>
        {expanded===item.id&&<div className="mt-4 rounded-xl bg-[#f9fafb] p-4">
          <p className="text-xs text-[#667085]">Задача клиента</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.payload?.brief||"Без комментария"}</p>
          <p className="mt-3 text-xs text-[#667085]">Контакт: {item.payload?.phone||"Связь через Telegram (контакт не указан)"}</p>
          <p className="mt-3 text-sm font-semibold">{new Intl.NumberFormat("ru-RU",{style:"currency",currency:item.currency,maximumFractionDigits:item.currency==="UZS"?0:2}).format(item.total_minor/100)}</p>
          {item.status==="confirmed"&&<p className="mt-2 rounded-lg bg-[#fff7ed] p-3 text-xs text-[#9a3412]">Оплата не подключена. Статус «Подтверждена» не означает, что клиент оплатил услугу.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {item.status==="new"&&<button disabled={busy!==null} onClick={()=>void transition(item,"confirmed")} className="flex items-center gap-2 rounded-xl bg-[#101828] px-4 py-2.5 text-sm font-semibold !text-white disabled:opacity-50"><Check size={16}/>Подтвердить</button>}
            {item.status==="confirmed"&&<button disabled={busy!==null} onClick={()=>void transition(item,"in_progress")} className="rounded-xl bg-[#101828] px-4 py-2.5 text-sm font-semibold !text-white disabled:opacity-50">Взять в работу</button>}
            {item.status==="in_progress"&&<button disabled={busy!==null} onClick={()=>void transition(item,"completed")} className="rounded-xl bg-[#101828] px-4 py-2.5 text-sm font-semibold !text-white disabled:opacity-50">Завершить</button>}
            {["new","confirmed","in_progress"].includes(item.status)&&<button disabled={busy!==null} onClick={()=>void transition(item,"cancelled")} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm disabled:opacity-50"><X size={16}/>Отменить</button>}
          </div>
        </div>}
      </article>)}</div>}
  </section>;
}
