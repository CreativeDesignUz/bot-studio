"use client";
import {useEffect,useMemo,useState} from "react";
import {Download,Search,Users,ShoppingCart,Wallet,RotateCcw} from "lucide-react";

type Customer={id:string;external_id:string;full_name:string|null;telegram_username:string|null;last_activity_at:string|null;orders:number;spent:number;lastOrder:string|null};
type Trend={date:string;orders:number;revenue_minor:number};
type Insights={limited:boolean;customers:Customer[];summary:{visitors:number;orders:number;paidOrders:number;revenueMinor:number;averageCheckMinor:number;cancelled:number};trend:Trend[];recentOrders:{id:string;customer_name:string|null;status:string;total_minor:number;created_at:string}[]};
const money=(x:number)=>Math.round(x/100).toLocaleString("ru-RU")+" сум";
const date=(x:string|null)=>x?new Date(x).toLocaleDateString("ru-RU"):"—";
function csv(rows:string[][]) {
  const data="\uFEFF"+rows.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([data],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download="bot-studio-report.csv";link.click();URL.revokeObjectURL(url);
}
export function WorkspaceInsights({botId,view}:{botId:string;view:"customers"|"analytics"}) {
  const [data,setData]=useState<Insights|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<Customer|null>(null);
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  useEffect(()=>{
    let active=true;
    async function load(){
      setLoading(true);setError("");setData(null);setSelected(null);
      try {
        const tg=(window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
        const query=new URLSearchParams({bot:botId});
        if(from)query.set("from",from);if(to)query.set("to",to);
        const r=await fetch("/api/workspace/insights?"+query,{headers:{"x-telegram-init-data":tg}});
        if(r.status===401){location.replace("/login");return;}
        if(!r.ok)throw new Error("Не удалось получить данные");
        const result=await r.json() as Insights;if(active)setData(result);
      }catch(e){if(active)setError(e instanceof Error?e.message:"Ошибка загрузки");}
      finally{if(active)setLoading(false);}
    }
    void load();return()=>{active=false;};
  },[botId,from,to]);
  const customers=useMemo(()=>data?.customers.filter(c=>(c.full_name+" "+c.telegram_username+" "+c.external_id).toLowerCase().includes(search.toLowerCase()))??[],[data,search]);
  if(loading)return <div className="rounded-2xl border bg-white p-10 text-center text-[#667085]">Загружаем реальные данные…</div>;
  if(error)return <div role="alert" className="rounded-2xl border bg-white p-10 text-center text-[#c01048]">{error}</div>;
  if(!data)return null;
  const s=data.summary;
  return <div className="space-y-5">
    {data.limited&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Отображается ограниченная выборка (500 клиентов или 2000 заказов). Данные за пределами лимита не включены в показатели.</div>}
    {view==="customers"?<>
      <div className="grid gap-4 sm:grid-cols-3">
        {[[Users,"Пользователей бота",s.visitors],[ShoppingCart,"Заказов за период",s.orders],[RotateCcw,"Клиентов с заказами",data.customers.filter(c=>c.orders>0).length]].map((item)=><div key={String(item[1])} className="rounded-2xl border border-[#e4e7ec] bg-white p-5"><div className="flex items-center gap-2 text-sm text-[#667085]"><Users className="size-4"/>{String(item[1])}</div><strong className="mt-4 block text-2xl">{item[2] as number}</strong></div>)}
      </div>
      <div className="flex flex-wrap gap-3"><label className="relative flex-1"><Search className="absolute left-3 top-3 size-5 text-[#98a2b3]"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по клиентам" className="h-11 w-full rounded-xl border bg-white pl-10 pr-4"/></label>
      <button onClick={()=>csv([["Имя","Telegram","Telegram ID","Заказов","Покупок (сум)"],...customers.map(c=>[c.full_name??"",c.telegram_username??"",c.external_id,String(c.orders),String(Math.round(c.spent/100))])])} className="flex h-11 items-center gap-2 rounded-xl border bg-white px-4"><Download className="size-4"/>CSV</button></div>
      <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-[#f9fafb] text-[#667085]"><tr>{["Клиент","Telegram","Заказы","Покупки","Активность"].map(t=><th key={t} className="p-4 font-medium">{t}</th>)}</tr></thead><tbody>{customers.map(c=><tr key={c.id} onClick={()=>setSelected(c)} className="cursor-pointer border-t hover:bg-[#faf9ff]"><td className="p-4 font-semibold">{c.full_name||"Без имени"}</td><td className="p-4">{c.telegram_username?"@"+c.telegram_username:"—"}</td><td className="p-4">{c.orders}</td><td className="p-4">{money(c.spent)}</td><td className="p-4">{date(c.last_activity_at)}</td></tr>)}</tbody></table>{!customers.length&&<p className="p-10 text-center text-[#667085]">Клиентов пока нет</p>}</div>
      {selected&&<section className="rounded-2xl border bg-white p-6"><div className="flex justify-between"><h2 className="text-xl font-semibold">Карточка: {selected.full_name||"Клиент"}</h2><button onClick={()=>setSelected(null)} className="text-sm text-[#6d45f5]">Закрыть</button></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p>Telegram: {selected.telegram_username?"@"+selected.telegram_username:"—"}</p><p>Telegram ID: {selected.external_id}</p><p>Последняя активность: {date(selected.last_activity_at)}</p><p>Последний заказ: {date(selected.lastOrder)}</p><p>Заказов: {selected.orders}</p><p>Покупок: {money(selected.spent)}</p></div><p className="mt-5 text-xs text-[#667085]">Отправка личного сообщения появится после настройки защищённой системы уведомлений и согласий клиентов.</p></section>}
    </>:<>
      <div className="flex flex-wrap items-end gap-3"><label className="text-xs text-[#667085]">С<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 block h-11 rounded-xl border bg-white px-3"/></label><label className="text-xs text-[#667085]">По<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 block h-11 rounded-xl border bg-white px-3"/></label><button onClick={()=>csv([["Дата","Заказы","Оплаченная выручка (сум)"],...data.trend.map(t=>[t.date,String(t.orders),String(Math.round(t.revenue_minor/100))])])} className="flex h-11 items-center gap-2 rounded-xl border bg-white px-4"><Download className="size-4"/>Скачать CSV</button></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[Wallet,"Оплаченная выручка",money(s.revenueMinor)],[ShoppingCart,"Всего заказов",String(s.orders)],[Wallet,"Средний оплаченный чек",money(s.averageCheckMinor)],[RotateCcw,"Отмены",String(s.cancelled)]].map((item)=><div key={String(item[1])} className="rounded-2xl border bg-white p-5"><span className="flex items-center gap-2 text-sm text-[#667085]"><Wallet className="size-4"/>{String(item[1])}</span><strong className="mt-4 block text-xl">{String(item[2])}</strong></div>)}</div>
      <section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Выручка по дням</h2><p className="mb-5 text-xs text-[#667085]">По подтверждённым платежам, сум</p><div className="flex h-48 items-end gap-2">{data.trend.map(t=><div key={t.date} title={t.date+": "+money(t.revenue_minor)} style={{height:Math.max(3,t.revenue_minor/Math.max(1,...data.trend.map(x=>x.revenue_minor))*100)+"%"}} className="min-w-2 flex-1 rounded-t bg-[#7655ee]"/> )}</div>{!data.trend.length&&<p className="text-center text-sm text-[#667085]">Заказов за период нет</p>}</section>
    </>}
  </div>;
}
