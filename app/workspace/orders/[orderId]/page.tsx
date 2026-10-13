"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import {useWorkspace} from "../../workspace-shell";
type Order={id:string;customer_name:string;status:string;currency:string;total_minor:number;delivery_minor:number;fulfillment_type:string|null;delivery_address:unknown;created_at:string;items:{item_name:string;quantity:number;unit_price_minor:number}[]};
export default function OrderDetailPage(){
 const params=useParams<{orderId:string}>();
 const {bot}=useWorkspace();
 const botId=bot?.id??"",orderId=params.orderId;
 const [order,setOrder]=useState<Order|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{const abort=new AbortController();void (async()=>{try{
 if(!/^[0-9a-f-]{36}$/i.test(botId)||!/^[0-9a-f-]{36}$/i.test(orderId))throw new Error("Некорректный заказ");
 const tg=(window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
 const response=await fetch("/api/orders?bot="+encodeURIComponent(botId),{headers:{"x-telegram-init-data":tg},signal:abort.signal,cache:"no-store"});
 const data=await response.json() as {orders?:Order[];error?:string};
 if(!response.ok)throw new Error(data.error??"Не удалось загрузить заказ");
 const found=data.orders?.find(o=>o.id===orderId);
 if(!found)throw new Error("Заказ не найден или недоступен");
 if(!abort.signal.aborted)setOrder(found);
 }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Ошибка заказа");}finally{if(!abort.signal.aborted)setLoading(false);}})();return()=>abort.abort();},[botId,orderId]);
 const loc=order?.delivery_address&&typeof order.delivery_address==="object"&&!Array.isArray(order.delivery_address)?order.delivery_address as Record<string,unknown>:{};
 const valid=typeof loc.lat==="number"&&typeof loc.lng==="number"&&Number.isFinite(loc.lat)&&Number.isFinite(loc.lng)&&Math.abs(loc.lat)<=85&&Math.abs(loc.lng)<=180;
 const marker=valid?String(loc.lat)+","+String(loc.lng):"";
 return <main className="min-h-screen bg-[#f4f6f8] px-4 py-8 text-[#101828]"><div className="mx-auto max-w-3xl">
 <Link href={"/workspace?bot="+encodeURIComponent(botId)+"&section=orders"} className="text-sm font-semibold text-[#6541f5]">← Вернуться в кабинет</Link>
 <h1 className="my-6 text-2xl font-bold">Детали заказа</h1>
 {loading?<section className="rounded-2xl bg-white p-6">Загрузка…</section>:error?<p role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">{error}</p>:order&&<div className="space-y-4">
 <section className="rounded-2xl border bg-white p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">№ {order.id.slice(0,8).toUpperCase()}</h2><span className="rounded-full bg-[#f0eaff] px-3 py-1 text-sm">{order.status}</span></div>
 <p className="mt-3 text-sm text-[#667085]">{new Date(order.created_at).toLocaleString("ru-RU")}</p><p className="mt-4 text-sm"><b>Покупатель:</b> {order.customer_name}</p><p className="mt-1 text-sm"><b>Получение:</b> {order.fulfillment_type==="delivery"?"Доставка":"Самовывоз"}</p></section>
 <section className="rounded-2xl border bg-white p-6"><h3 className="font-semibold">Состав заказа</h3><ul className="mt-4 divide-y">{order.items.map((x,i)=><li key={i} className="flex justify-between gap-3 py-3 text-sm"><span>{x.item_name} × {x.quantity}</span><span>{(x.unit_price_minor*x.quantity/100).toLocaleString("ru-RU")} {order.currency}</span></li>)}</ul><p className="mt-4 text-right font-bold">Итого: {(order.total_minor/100).toLocaleString("ru-RU")} {order.currency}</p></section>
 {order.fulfillment_type==="delivery"&&<section className="rounded-2xl border bg-white p-6"><h3 className="font-semibold">Адрес доставки</h3><p className="mt-2 text-sm">{typeof loc.address==="string"?loc.address:"Адрес не указан"}</p>{valid?<div className="mt-4"><iframe title="Карта заказа" loading="lazy" className="h-72 w-full rounded-xl border" src={"https://www.openstreetmap.org/export/embed.html?bbox="+(Number(loc.lng)-0.005)+","+(Number(loc.lat)-0.003)+","+(Number(loc.lng)+0.005)+","+(Number(loc.lat)+0.003)+"&marker="+marker}/><a className="mt-3 block text-sm font-semibold text-[#6541f5]" target="_blank" rel="noopener noreferrer" href={"https://www.openstreetmap.org/?mlat="+loc.lat+"&mlon="+loc.lng+"#map=17/"+marker.replace(",","/")}>Открыть на карте ↗</a></div>:<p className="mt-2 text-sm text-[#667085]">Координаты не переданы.</p>}</section>}
 </div>}
 </div></main>;
}
