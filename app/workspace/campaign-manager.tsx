"use client";
import {useEffect,useState} from "react";
type Campaign={id:string;name:string;code:string|null;discount_type:string;discount_value:number;is_active:boolean;created_at:string};
export default function CampaignManager({botId}:{botId:string}){
 const [rows,setRows]=useState<Campaign[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [name,setName]=useState(""),[code,setCode]=useState(""),[type,setType]=useState("percent"),[amount,setAmount]=useState("10");
 const telegramData=()=> (window as typeof window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData??"";
 useEffect(()=>{const abort=new AbortController();void (async()=>{try{
 const r=await fetch("/api/campaigns?bot="+encodeURIComponent(botId),{headers:{"x-telegram-init-data":telegramData()},signal:abort.signal,cache:"no-store"});
 const b=await r.json() as {campaigns?:Campaign[];error?:string};if(!r.ok)throw new Error(b.error??"Не удалось загрузить акции");
 if(!abort.signal.aborted)setRows(b.campaigns??[]);
 }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Ошибка загрузки");}finally{if(!abort.signal.aborted)setLoading(false);}})();return()=>abort.abort();},[botId]);
 async function create(){setSaving(true);setError("");setNotice("");try{
 const r=await fetch("/api/campaigns",{method:"POST",headers:{"content-type":"application/json","x-telegram-init-data":telegramData()},body:JSON.stringify({botId,name,code,discountType:type,discountValue:type==="percent"?Number(amount):type==="fixed"?Math.round(Number(amount)*100):0})});
 const b=await r.json() as {campaign?:Campaign;error?:string};if(!r.ok||!b.campaign)throw new Error(b.error??"Не удалось сохранить");
 setRows(old=>[b.campaign!,...old]);setName("");setCode("");setNotice("Черновик акции создан. Публикация будет доступна после проверки применения скидки к заказу.");
 }catch(e){setError(e instanceof Error?e.message:"Ошибка создания");}finally{setSaving(false);}}
 if(loading)return <section className="rounded-2xl border bg-white p-8">Загружаем акции…</section>;
 return <div className="space-y-5">
 <section className="rounded-2xl border border-[#e4e7ec] bg-white p-6">
 <h2 className="text-xl font-semibold">Создать акцию</h2>
 <p className="mt-2 text-sm text-[#667085]">Акции пока сохраняются как черновики: применять скидки к покупателям без проверки сервера нельзя.</p>
 <div className="mt-5 grid gap-4 sm:grid-cols-2">
 <label className="text-sm font-medium">Название<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} className="mt-2 h-11 w-full rounded-xl border px-3" placeholder="Скидка на обед"/></label>
 <label className="text-sm font-medium">Промокод (необязательно)<input value={code} onChange={e=>setCode(e.target.value)} maxLength={32} className="mt-2 h-11 w-full rounded-xl border px-3" placeholder="LUNCH10"/></label>
 <label className="text-sm font-medium">Тип акции<select className="mt-2 h-11 w-full rounded-xl border px-3" value={type} onChange={e=>setType(e.target.value)}><option value="percent">Процент</option><option value="fixed">Фиксированная сумма</option><option value="free_delivery">Бесплатная доставка</option></select></label>
 {type!=="free_delivery"&&<label className="text-sm font-medium">Размер {type==="percent"?"(%)":"(сум)"}<input inputMode="numeric" type="number" min="0" max={type==="percent"?"100":undefined} value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3"/></label>}
 </div>
 {error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
 {notice&&<p role="status" className="mt-4 text-sm text-[#027a48]">{notice}</p>}
 <button type="button" onClick={()=>void create()} disabled={saving||name.trim().length<2} className="mt-5 rounded-xl bg-[#6541f5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving?"Сохраняем…":"Сохранить черновик"}</button>
 </section>
 <section className="rounded-2xl border border-[#e4e7ec] bg-white p-6"><h2 className="mb-4 text-lg font-semibold">Мои акции</h2>{rows.length===0?<p className="text-sm text-[#667085]">Пока нет акций</p>:<div className="divide-y">{rows.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><strong className="text-sm">{row.name}</strong><p className="mt-1 text-xs text-[#667085]">{row.code??"Без промокода"} · {row.discount_type==="percent"?row.discount_value+"%":row.discount_type==="free_delivery"?"Бесплатная доставка":row.discount_value/100+" сум"}</p></div><span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-xs font-semibold text-[#475467]">Черновик</span></div>)}</div>}</section>
 </div>;
}
