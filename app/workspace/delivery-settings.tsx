"use client";
import {useEffect,useState} from "react";
import DeliveryLocationPicker,{type Point} from "../miniapp/delivery-location-picker";

type Zone={enabled:boolean;centerLat:number;centerLng:number;radiusKm:number;feeMinor:number};
const initial:Zone={enabled:false,centerLat:41.2995,centerLng:69.2401,radiusKm:5,feeMinor:0};
const initData=()=> (window as typeof window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
export default function DeliverySettings({botId}:{botId:string}){
 const [zone,setZone]=useState<Zone>(initial),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [radiusText,setRadiusText]=useState(String(initial.radiusKm));
 const [feeText,setFeeText]=useState(String(initial.feeMinor/100));
 const radius=radiusText.trim()?Number(radiusText.replace(",",".")):NaN;
 const fee=feeText.trim()?Number(feeText.replace(/\s/g,"")):NaN;
 const radiusValid=Number.isFinite(radius)&&radius>=0.1&&radius<=100;
 const feeValid=Number.isSafeInteger(fee)&&fee>=0&&fee<=1000000;
 const inputsValid=radiusValid&&feeValid;
 function changeRadius(value:string){if(/^\d{0,3}(?:[.,]\d{0,3})?$/.test(value)){setRadiusText(value);setNotice("");}}
 function changeFee(value:string){if(/^[\d\s]{0,13}$/.test(value)){setFeeText(value);setNotice("");}}

 useEffect(()=>{const c=new AbortController();async function load(){try{const r=await fetch("/api/delivery/settings?bot="+encodeURIComponent(botId),{headers:{"x-telegram-init-data":initData()},signal:c.signal});const body=await r.json() as {delivery?:Zone;error?:string};if(!r.ok)throw Error(body.error??"Не удалось загрузить настройки");if(!c.signal.aborted){const next=body.delivery??initial;setZone(next);setRadiusText(String(next.radiusKm));setFeeText(String(next.feeMinor/100));}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:"Ошибка загрузки");}finally{if(!c.signal.aborted)setLoading(false);}}void load();return()=>c.abort();},[botId]);
 async function save(){
  setNotice("");
  if(!inputsValid){setError("Проверьте данные: радиус от 0,1 до 100 км, стоимость от 0 до 1 000 000 сум.");return}
  const next:Zone={...zone,radiusKm:radius,feeMinor:fee*100};
  setSaving(true);setError("");
  try{
   const r=await fetch("/api/delivery/settings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({botId,initData:initData(),delivery:next})});
   const body=await r.json() as {error?:string};
   if(!r.ok)throw Error(body.error??"Не удалось сохранить");
   setZone(next);
   setNotice("Черновик доставки сохранён. Опубликуйте бота, чтобы изменения появились у покупателей.");
  }catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}
  finally{setSaving(false);}
 }
 if(loading)return <section className="rounded-2xl bg-white p-6">Загружаем доставку…</section>;
 return <section className="space-y-5 rounded-2xl border border-[#e4e7ec] bg-white p-5 sm:p-7">
 <div><h2 className="text-xl font-semibold">Зона и стоимость доставки</h2><p className="mt-1 text-sm text-[#667085]">Общие настройки для доставки еды и интернет-магазина. Доступен один круговой район доставки; стоимость фиксированная в сумах.</p></div>
 <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={zone.enabled} onChange={e=>setZone(z=>({...z,enabled:e.target.checked}))}/>Принимать заказы с доставкой</label>
 <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-2"><p className="text-sm font-semibold">Центр зоны обслуживания</p><DeliveryLocationPicker value={{lat:zone.centerLat,lng:zone.centerLng}} onChange={(point:Point)=>setZone(z=>({...z,centerLat:point.lat,centerLng:point.lng}))}/></div>
 <div className="space-y-4">
 <label className="block text-sm font-medium">Радиус доставки
  <span className="mt-2 flex h-12 items-center overflow-hidden rounded-xl border border-[#d0d5dd] bg-white transition-colors focus-within:border-[#6541f5] focus-within:ring-2 focus-within:ring-[#6541f5]/15">
   <input aria-label="Радиус доставки" type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={radiusText} onChange={e=>changeRadius(e.target.value)} placeholder="Например, 5" className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm text-[#101828] outline-none"/>
   <span aria-hidden="true" className="pointer-events-none flex h-full shrink-0 items-center border-l border-[#eaecf0] bg-[#f9fafb] px-4 text-sm font-semibold text-[#667085]">км</span>
  </span>
 </label>
 <label className="block text-sm font-medium">Стоимость доставки
  <span className="mt-2 flex h-12 items-center overflow-hidden rounded-xl border border-[#d0d5dd] bg-white transition-colors focus-within:border-[#6541f5] focus-within:ring-2 focus-within:ring-[#6541f5]/15">
   <input aria-label="Стоимость доставки" type="text" inputMode="numeric" autoComplete="off" spellCheck={false} value={feeText} onChange={e=>changeFee(e.target.value)} placeholder="Например, 15 000" className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm text-[#101828] outline-none"/>
   <span aria-hidden="true" className="pointer-events-none flex h-full shrink-0 items-center border-l border-[#eaecf0] bg-[#f9fafb] px-4 text-sm font-semibold text-[#667085]">сум</span>
  </span>
 </label>
 <p className="text-xs text-[#667085]">Покупатель увидит стоимость до заказа. Заказы вне радиуса будут отклонены сервером. Для доставки поддерживаются заказы в UZS.</p>
 </div></div>
 {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 {notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
 <button type="button" disabled={saving||!inputsValid} onClick={()=>void save()} className="rounded-xl bg-[#6541f5] px-5 py-3 font-semibold text-white disabled:opacity-50">{saving?"Сохраняем…":"Сохранить черновик"}</button>
 </section>;
}
