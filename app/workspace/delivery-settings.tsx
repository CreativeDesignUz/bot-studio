"use client";
import {useEffect,useState} from "react";
import DeliveryLocationPicker,{type Point} from "../miniapp/delivery-location-picker";

type Zone={enabled:boolean;centerLat:number;centerLng:number;radiusKm:number;feeMinor:number};
const initial:Zone={enabled:false,centerLat:41.2995,centerLng:69.2401,radiusKm:5,feeMinor:0};
const initData=()=> (window as typeof window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
export default function DeliverySettings({botId}:{botId:string}){
 const [zone,setZone]=useState<Zone>(initial),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 useEffect(()=>{const c=new AbortController();async function load(){try{const r=await fetch("/api/delivery/settings?bot="+encodeURIComponent(botId),{headers:{"x-telegram-init-data":initData()},signal:c.signal});const body=await r.json() as {delivery?:Zone;error?:string};if(!r.ok)throw Error(body.error??"Не удалось загрузить настройки");if(!c.signal.aborted)setZone(body.delivery??initial);}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:"Ошибка загрузки");}finally{if(!c.signal.aborted)setLoading(false);}}void load();return()=>c.abort();},[botId]);
 async function save(){setSaving(true);setError("");setNotice("");try{const r=await fetch("/api/delivery/settings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({botId,initData:initData(),delivery:zone})});const body=await r.json() as {error?:string};if(!r.ok)throw Error(body.error??"Не удалось сохранить");setNotice("Черновик доставки сохранён. Опубликуйте бота, чтобы изменения появились у покупателей.");}catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}finally{setSaving(false);}}
 if(loading)return <section className="rounded-2xl bg-white p-6">Загружаем доставку…</section>;
 return <section className="space-y-5 rounded-2xl border border-[#e4e7ec] bg-white p-5 sm:p-7">
 <div><h2 className="text-xl font-semibold">Зона и стоимость доставки</h2><p className="mt-1 text-sm text-[#667085]">Общие настройки для доставки еды и интернет-магазина. Доступен один круговой район доставки; стоимость фиксированная в сумах.</p></div>
 <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={zone.enabled} onChange={e=>setZone(z=>({...z,enabled:e.target.checked}))}/>Принимать заказы с доставкой</label>
 <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-2"><p className="text-sm font-semibold">Центр зоны обслуживания</p><DeliveryLocationPicker value={{lat:zone.centerLat,lng:zone.centerLng}} onChange={(point:Point)=>setZone(z=>({...z,centerLat:point.lat,centerLng:point.lng}))}/></div>
 <div className="space-y-4">
 <label className="block text-sm font-medium">Радиус доставки, км<input type="number" min={0.1} max={100} step={0.1} value={zone.radiusKm} onChange={e=>setZone(z=>({...z,radiusKm:Number(e.target.value)}))} className="mt-2 h-11 w-full rounded-xl border px-3"/></label>
 <label className="block text-sm font-medium">Стоимость доставки, сум<input type="number" min={0} max={1000000} step={1} value={zone.feeMinor/100} onChange={e=>setZone(z=>({...z,feeMinor:Math.round(Number(e.target.value)*100)}))} className="mt-2 h-11 w-full rounded-xl border px-3"/></label>
 <p className="text-xs text-[#667085]">Покупатель увидит стоимость до заказа. Заказы вне радиуса будут отклонены сервером. Для доставки поддерживаются заказы в UZS.</p>
 </div></div>
 {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 {notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
 <button type="button" disabled={saving||zone.radiusKm<0.1||zone.radiusKm>100||zone.feeMinor<0} onClick={()=>void save()} className="rounded-xl bg-[#6541f5] px-5 py-3 font-semibold text-white disabled:opacity-50">{saving?"Сохраняем…":"Сохранить черновик"}</button>
 </section>;
}
