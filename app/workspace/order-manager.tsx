"use client";
import {useEffect,useState} from "react";
type Order={id:string;customer_name:string;customer_external_id:string|null;status:string;total_minor:number;delivery_minor:number;currency:string;fulfillment_type:string|null;delivery_address:unknown;created_at:string;items:{item_name:string;quantity:number;unit_price_minor:number}[]};
const initData=()=> (window as typeof window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
export default function OrderManager({botId}:{botId:string}){
 const [orders,setOrders]=useState<Order[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const [newOrders,setNewOrders]=useState(0);
 const [savingId,setSavingId]=useState("");
 const statusActions:Record<string,{next:string;label:string}>={new:{next:"confirmed",label:"Принять заказ"},confirmed:{next:"in_progress",label:"Начать приготовление"},in_progress:{next:"ready",label:"Готов к выдаче"},ready:{next:"completed",label:"Завершить заказ"}};
 async function advance(order:Order){const action=statusActions[order.status];if(!action)return;setSavingId(order.id);setError("");try{const response=await fetch("/api/orders",{method:"PATCH",headers:{"content-type":"application/json","x-telegram-init-data":initData()},body:JSON.stringify({botId,orderId:order.id,expectedStatus:order.status,status:action.next})});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error??"Не удалось изменить статус");setOrders(old=>old.map(item=>item.id===order.id?{...item,status:action.next}:item));}catch(e){setError(e instanceof Error?e.message:"Ошибка изменения статуса");}finally{setSavingId("");}}
 useEffect(()=>{
  const controller=new AbortController();
  let first=true;let known=new Set<string>();
  async function load(){
   try{
    const response=await fetch("/api/orders?bot="+encodeURIComponent(botId),{headers:{"x-telegram-init-data":initData()},cache:"no-store",signal:controller.signal});
    const body=await response.json() as {orders?:Order[];error?:string};
    if(!response.ok)throw new Error(body.error??"Не удалось получить заказы");
    if(!controller.signal.aborted){
      const next=body.orders??[];
      if(!first){const added=next.filter(o=>!known.has(o.id));if(added.length)setNewOrders(n=>n+added.length);}
      known=new Set(next.map(o=>o.id));first=false;setOrders(next);setError("");
    }
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Ошибка загрузки");}
   finally{if(!controller.signal.aborted)setLoading(false);}
  }
  void load();
  const interval=setInterval(()=>{if(!controller.signal.aborted)void load();},15000);
  return()=>{controller.abort();clearInterval(interval);};
 },[botId]);
 if(loading)return <div className="rounded-2xl bg-white p-8">Загружаем заказы…</div>;
 if(error)return <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">{error}</p>;
 if(!orders.length)return <div className="rounded-2xl bg-white p-8 text-[#667085]">Пока нет заказов. Когда покупатель оформит заказ, он появится здесь.</div>;
 return <div className="space-y-4">{newOrders>0&&<div role="status" className="flex items-center justify-between rounded-xl bg-[#ecfdf3] p-4 text-sm text-[#027a48]"><span>Новых заказов: {newOrders}</span><button type="button" onClick={()=>setNewOrders(0)} className="font-semibold underline">Просмотрено</button></div>}{orders.map(order=>{
 const address=order.delivery_address&&typeof order.delivery_address==="object"&&!Array.isArray(order.delivery_address)?order.delivery_address as Record<string,unknown>:{};
 return <article key={order.id} className="rounded-2xl border border-[#e4e7ec] bg-white p-5">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Заказ №{order.id.slice(0,8).toUpperCase()}</h2><span className="rounded-lg bg-[#f2f4f7] px-3 py-1 text-sm">{order.status}</span></div>
  <p className="mt-2 text-xs text-[#667085]">{new Date(order.created_at).toLocaleString("ru-RU")}</p>
  <div className="mt-4 grid gap-3 sm:grid-cols-2"><p className="text-sm"><b>Покупатель:</b> {order.customer_name}</p><p className="text-sm"><b>Получение:</b> {order.fulfillment_type==="delivery"?"Доставка":"Самовывоз"}</p></div>
  <h3 className="mb-2 mt-4 font-semibold">Что заказали</h3><ul className="space-y-2">{order.items.map((item,i)=><li key={i} className="flex justify-between gap-2 text-sm"><span>{item.item_name} × {item.quantity}</span><span>{(item.unit_price_minor*item.quantity/100).toLocaleString("ru-RU")} {order.currency}</span></li>)}</ul>
  {order.fulfillment_type==="delivery"&&<p className="mt-4 rounded-xl bg-[#f9fafb] p-3 text-sm"><b>Адрес доставки:</b> {typeof address.address==="string"?address.address:"Не указан"}{typeof address.lat==="number"&&typeof address.lng==="number"&&Number.isFinite(address.lat)&&Number.isFinite(address.lng)&&Math.abs(address.lat)<=85&&Math.abs(address.lng)<=180?<span className="mt-2 block"><a href={"https://www.openstreetmap.org/?mlat="+address.lat+"&mlon="+address.lng+"#map=17/"+address.lat+"/"+address.lng} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#027a48] underline">Открыть точку на карте ↗</a><span className="mt-1 block text-xs text-[#667085]">Координаты: {address.lat}, {address.lng}</span><iframe title="Точка доставки" loading="lazy" className="mt-2 h-48 w-full rounded-xl border" src={"https://www.openstreetmap.org/export/embed.html?bbox="+(address.lng-0.005)+","+(address.lat-0.003)+","+(address.lng+0.005)+","+(address.lat+0.003)+"&marker="+address.lat+","+address.lng}/></span>:<span className="mt-1 block text-xs text-[#667085]">Координаты не переданы — заказ был оформлен без выбора точки.</span>}</p>}
  {statusActions[order.status]&&<div className="mt-4"><button type="button" disabled={savingId===order.id} onClick={()=>void advance(order)} className="rounded-xl bg-[#6541f5] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{savingId===order.id?"Сохраняем…":statusActions[order.status].label}</button></div>}
  <div className="mt-4 border-t pt-3 text-right font-semibold">Итого: {(order.total_minor/100).toLocaleString("ru-RU")} {order.currency}</div>
 </article>})}</div>;
}
