"use client";
import {useEffect,useState} from "react";
type Order={id:string;customer_name:string;customer_external_id:string|null;status:string;total_minor:number;delivery_minor:number;currency:string;fulfillment_type:string|null;delivery_address:unknown;created_at:string;items:{item_name:string;quantity:number;unit_price_minor:number}[]};
const initData=()=> (window as typeof window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
export default function OrderManager({botId}:{botId:string}){
 const [orders,setOrders]=useState<Order[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{const controller=new AbortController();
 async function load(){try{const response=await fetch("/api/orders?bot="+encodeURIComponent(botId),{headers:{"x-telegram-init-data":initData()},cache:"no-store",signal:controller.signal});const body=await response.json() as {orders?:Order[];error?:string};if(!response.ok)throw new Error(body.error??"Не удалось получить заказы");if(!controller.signal.aborted)setOrders(body.orders??[]);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Ошибка загрузки");}finally{if(!controller.signal.aborted)setLoading(false);}}
 void load();return()=>controller.abort();},[botId]);
 if(loading)return <div className="rounded-2xl bg-white p-8">Загружаем заказы…</div>;
 if(error)return <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">{error}</p>;
 if(!orders.length)return <div className="rounded-2xl bg-white p-8 text-[#667085]">Пока нет заказов. Когда покупатель оформит заказ, он появится здесь.</div>;
 return <div className="space-y-4">{orders.map(order=>{
 const address=order.delivery_address&&typeof order.delivery_address==="object"&&!Array.isArray(order.delivery_address)?order.delivery_address as Record<string,unknown>:{};
 return <article key={order.id} className="rounded-2xl border border-[#e4e7ec] bg-white p-5">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Заказ №{order.id.slice(0,8).toUpperCase()}</h2><span className="rounded-lg bg-[#f2f4f7] px-3 py-1 text-sm">{order.status}</span></div>
  <p className="mt-2 text-xs text-[#667085]">{new Date(order.created_at).toLocaleString("ru-RU")}</p>
  <div className="mt-4 grid gap-3 sm:grid-cols-2"><p className="text-sm"><b>Покупатель:</b> {order.customer_name}</p><p className="text-sm"><b>Получение:</b> {order.fulfillment_type==="delivery"?"Доставка":"Самовывоз"}</p></div>
  <h3 className="mb-2 mt-4 font-semibold">Что заказали</h3><ul className="space-y-2">{order.items.map((item,i)=><li key={i} className="flex justify-between gap-2 text-sm"><span>{item.item_name} × {item.quantity}</span><span>{(item.unit_price_minor*item.quantity/100).toLocaleString("ru-RU")} {order.currency}</span></li>)}</ul>
  {order.fulfillment_type==="delivery"&&<p className="mt-4 rounded-xl bg-[#f9fafb] p-3 text-sm"><b>Адрес доставки:</b> {typeof address.address==="string"?address.address:"Не указан"}<span className="mt-1 block text-xs text-[#667085]">Точка на карте отсутствует, пока покупатель не выбирает геопозицию.</span></p>}
  <div className="mt-4 border-t pt-3 text-right font-semibold">Итого: {(order.total_minor/100).toLocaleString("ru-RU")} {order.currency}</div>
 </article>})}</div>;
}
