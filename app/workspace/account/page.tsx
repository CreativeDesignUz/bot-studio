"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";

type Account={authenticated:boolean;user?:{name:string;telegram:string|null;telegramLinked:boolean;googleLinked:boolean}};
type Providers={google:{supabaseUrl:string;publishableKey:string}|null};

export default function AccountPage(){
 const [account,setAccount]=useState<Account|null>(null);
 const [providers,setProviders]=useState<Providers|null>(null);
 const [error,setError]=useState("");
 const [working,setWorking]=useState(false);
 const [justLinked,setJustLinked]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  void Promise.all([
   fetch("/api/auth/account",{cache:"no-store",signal:controller.signal}).then(r=>r.json() as Promise<Account>),
   fetch("/api/auth/providers",{cache:"no-store",signal:controller.signal}).then(r=>r.json() as Promise<Providers>),
  ]).then(([a,p])=>{if(!controller.signal.aborted){setAccount(a);setProviders(p)}})
    .catch(()=>{if(!controller.signal.aborted)setError("Не удалось загрузить настройки аккаунта.")});
  if(new URLSearchParams(window.location.search).get("linked")==="1")void Promise.resolve().then(()=>setJustLinked(true));
  return()=>controller.abort();
 },[]);
 async function connectGoogle(){
  if(!account?.authenticated||!providers?.google)return;
  setWorking(true);setError("");
  try{
   const {createClient}=await import("@supabase/supabase-js");
   const client=createClient(providers.google.supabaseUrl,providers.google.publishableKey,{
    auth:{persistSession:true,detectSessionInUrl:false,flowType:"pkce",storageKey:"bot-studio-supabase-google"},
   });
   const {error:oauthError}=await client.auth.signInWithOAuth({
    provider:"google",
    options:{redirectTo:window.location.origin+"/auth/callback?mode=link",queryParams:{prompt:"select_account"}},
   });
   if(oauthError)throw oauthError;
  }catch(e){setError(e instanceof Error?e.message:"Не удалось подключить Google.");setWorking(false)}
 }
 return <main className="min-h-dvh bg-[#f4f6f8] p-5 text-[#101828] sm:p-10">
  <div className="mx-auto max-w-2xl">
   <Link className="inline-flex items-center gap-2 text-sm text-[#5934dc]" href="/workspace"><ArrowLeft size={17}/> Назад в кабинет</Link>
   <section className="mt-6 rounded-3xl border border-[#e4e7ec] bg-white p-6 sm:p-9">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-[#f0ecff] p-3 text-[#5934dc]"><ShieldCheck/></span><div><h1 className="text-2xl font-bold">Безопасность аккаунта</h1><p className="mt-1 text-sm text-[#667085]">Вход через Google и Telegram в один кабинет.</p></div></div>
    {justLinked&&<p role="status" className="mt-6 rounded-xl bg-[#ecfdf3] p-4 text-sm text-[#027a48]">Google успешно привязан. Все ваши боты остались в этом кабинете.</p>}
    {error&&<p role="alert" className="mt-6 rounded-xl bg-[#fff1f1] p-4 text-sm text-[#b42318]">{error}</p>}
    {!account&&!error&&<p className="mt-6 text-sm text-[#667085]">Загружаем настройки…</p>}
    {account&&!account.authenticated&&<div className="mt-6"><p className="text-sm text-[#667085]">Для управления способами входа сначала авторизуйтесь.</p><Link className="mt-4 inline-flex rounded-xl bg-[#6541F5] px-5 py-3 text-sm font-semibold text-white" href="/auth">Войти</Link></div>}
    {account?.authenticated&&<div className="mt-7 space-y-4">
     <p className="text-sm text-[#667085]">Аккаунт: <strong className="text-[#101828]">{account.user?.name||"Пользователь"}</strong></p>
     <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e4e7ec] p-4"><span><strong className="block">Telegram</strong><small className="text-[#667085]">Вход через Telegram</small></span><span className="text-sm text-[#667085]">{account.user?.telegramLinked?<span className="inline-flex items-center gap-1 text-[#027a48]"><CheckCircle2 size={16}/> Подключён</span>:"Не подключён"}</span></div>
     <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e4e7ec] p-4"><span><strong className="block">Google</strong><small className="text-[#667085]">Дополнительный способ входа без потери ботов</small></span>
     {account.user?.googleLinked?<span className="inline-flex items-center gap-1 text-sm text-[#027a48]"><CheckCircle2 size={16}/> Подключён</span>:<button type="button" disabled={working||!providers?.google} onClick={()=>void connectGoogle()} className="inline-flex items-center gap-2 rounded-xl bg-[#6541F5] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{working&&<LoaderCircle className="animate-spin" size={16}/>}Привязать Google</button>}</div>
     {!providers?.google&&!account.user?.googleLinked&&<p className="text-xs text-[#9a3412]">Google станет доступен после включения OAuth в тестовой Supabase.</p>}
     <p className="text-xs leading-5 text-[#667085]">Привязка требует входа в оба аккаунта. Google-аккаунт, уже связанный с другим кабинетом, автоматически не объединяется.</p>
    </div>}
   </section>
  </div>
 </main>;
}
