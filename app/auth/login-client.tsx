"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";

type Providers={google:{supabaseUrl:string;publishableKey:string}|null;googleSetupRequired?:boolean;telegram:{username:string}|null};
const card="relative w-full max-w-[460px] overflow-hidden rounded-[20px] bg-[#f9fafb] px-6 py-8 shadow-[0_12px_40px_1px_rgba(0,0,0,.06)] sm:px-8";
export default function LoginPage({callback=false}:{callback?:boolean}){
 const [mode,setMode]=useState<"login"|"signup">("login");
 const [providers,setProviders]=useState<Providers|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{
  const code=new URLSearchParams(window.location.search).get("error");
  if(!code)return;
  const messages:Record<string,string>={
   telegram_session_expired:"Сессия входа Telegram истекла или не сохранилась. Попробуйте войти ещё раз в том же браузере.",
   telegram_state_invalid:"Telegram вернул неверное подтверждение запроса. Попробуйте снова.",
   telegram_exchange_failed:"Telegram не выдал токен авторизации. Проверьте Client Secret и Redirect URI.",
   telegram_missing_identity:"Telegram не вернул подтверждённую личность.",
   telegram_account_failed:"Telegram подтвердил вход, но сервер не смог создать кабинет. Требуется проверка Supabase.",
   telegram_login_failed:"Ошибка проверки ответа Telegram. Повторите попытку или сообщите код ошибки.",
   telegram_not_configured:"Telegram OIDC не настроен на сервере."
  };
  void Promise.resolve().then(()=>setError(messages[code]??"Не удалось завершить вход. Код: "+code));
 },[]);
 const [working,setWorking]=useState(false);
 const clientRef=useRef<SupabaseClient|null>(null);
 const isCallback=callback;
 const exchangeStarted=useRef(false);
 const [isPublicDomain,setIsPublicDomain]=useState(false);
 useEffect(()=>{void Promise.resolve().then(()=>setIsPublicDomain(window.location.protocol==="https:"&&!["localhost","127.0.0.1"].includes(window.location.hostname)))},[]);
 const getClient=useCallback(async(config:Providers["google"])=>{
  if(!config)throw new Error("Google OAuth не настроен в Supabase.");
  if(!clientRef.current){
   const {createClient}=await import("@supabase/supabase-js");
   clientRef.current=createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:true,detectSessionInUrl:false,flowType:"pkce",storageKey:"bot-studio-supabase-google"}});
  }
  return clientRef.current;
 },[]);
 const finish=useCallback(async(payload:object)=>{
  const response=await fetch("/api/auth/account",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const result=await response.json() as {error?:string};
  if(!response.ok)throw new Error(result.error??"Вход не завершён.");
  window.location.replace("mode" in payload && payload.mode==="link"?"/workspace/account?linked=1":"/workspace");
 },[]);

 useEffect(()=>{
  const controller=new AbortController();
  void fetch("/api/auth/providers",{signal:controller.signal}).then(r=>r.json() as Promise<Providers>).then(data=>{if(!controller.signal.aborted)setProviders(data)}).catch(()=>{if(!controller.signal.aborted)setError("Не удалось загрузить способы входа.")});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  if(!isCallback||!providers||exchangeStarted.current)return;
  exchangeStarted.current=true;
  let cancelled=false;
  async function exchange(){
   setWorking(true);
   try{
    const params=new URLSearchParams(window.location.search);
    const denied=params.get("error");
    if(denied)throw new Error("Google отменил вход или не подтвердил доступ.");
    const code=params.get("code");
    if(!code||code.length>2048)throw new Error("Google не вернул код подтверждения. Попробуйте снова.");
    if(!providers?.google)throw new Error("Google пока не настроен в тестовой Supabase.");
    const client=await getClient(providers.google);
    // PKCE verifier is verified by Supabase before issuing an access token.
    const {data,error:exchangeError}=await client.auth.exchangeCodeForSession(code);
    if(exchangeError||!data.session?.access_token)throw new Error("Сессия Google не подтверждена. Начните вход заново.");
    if(cancelled)return;
    await finish({provider:"google",accessToken:data.session.access_token,mode:params.get("mode")==="link"?"link":"login"});
   }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Не удалось подтвердить Google.");}
   finally{if(!cancelled)setWorking(false)}
  }
  void exchange();
  return()=>{cancelled=true};
 },[isCallback,providers,getClient,finish]);

 async function googleLogin(){
  setWorking(true);setError("");
  try{
   const client=await getClient(providers?.google??null);
   const {error:oauthError}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/auth/callback",queryParams:{prompt:"select_account"}}});
   if(oauthError)throw oauthError;
  }catch(e){setError(e instanceof Error?e.message:"Не удалось подключить Google.");setWorking(false)}
 }
 return <main className="flex min-h-dvh items-center justify-center bg-[#f9fafb] px-4 py-8 text-[#060317]">
  <div className={card}>
   <div aria-hidden className="pointer-events-none absolute -top-[220px] left-1/2 size-[255px] -translate-x-1/2 rounded-full bg-[#a78bfa]/40 blur-[75px]"/>
   <div aria-hidden className="pointer-events-none absolute -top-[165px] -left-[190px] size-[255px] rounded-full bg-[#b7b8fa]/55 blur-[85px]"/>
   <div aria-hidden className="pointer-events-none absolute -right-[130px] -top-[150px] size-[275px] rounded-full bg-[#a7cbff]/50 blur-[95px]"/>
   <div className="relative">
    <div className="mx-auto grid size-[60px] place-items-center rounded-[13px] bg-[#3d1ddd] text-white shadow-sm">
     <svg width="40" height="40" viewBox="0 0 40 40" aria-label="Bot Studio"><path fill="#fff" d="M20 0l4.9 14.3L40 20l-15.1 5.7L20 40l-4.9-14.3L0 20l15.1-5.7z"/></svg>
    </div>
    <h1 className="mt-4 text-center text-[24px] font-bold leading-[30px] tracking-[.2px]">{isCallback?"Подтверждаем вход":mode==="login"?"Войти в Bot Studio":"Создать аккаунт"}</h1>
    <p className="mt-2 text-center text-[14px] leading-6 text-[#718096]">{isCallback?"Проверяем вашу Google-сессию":mode==="login"?"Продолжите с Google или Telegram":"Зарегистрируйтесь через Google или Telegram"}</p>
    {error&&<div role="alert" className="mt-5 flex items-start gap-2 rounded-[8px] border border-[#ffd5d5] bg-[#fff1f1] p-3 text-[12px] text-[#b42318]"><CircleAlert size={17} className="shrink-0"/><span>{error}</span></div>}
    {isCallback?<div className="mt-8 flex flex-col items-center gap-4 py-10"><LoaderCircle className="size-8 animate-spin text-[#3d1ddd]"/><p className="text-sm text-[#718096]">{working?"Создаём защищённую сессию…":"Ожидаем подтверждения"}</p><Link href="/auth" className="text-sm text-[#3d1ddd]">Вернуться к входу</Link></div>:
    <div className="mt-8 space-y-4">
     <button type="button" disabled={working||!providers?.google} onClick={()=>void googleLogin()} className="flex h-[40px] w-full items-center justify-center gap-3 rounded-[8px] bg-[#3d1ddd] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#3318c0] disabled:opacity-55">
      {working?<LoaderCircle size={17} className="animate-spin"/>:<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.75 7.18l7.7 5.98C44.39 38.03 46.98 31.91 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.6.27-3.14.76-4.59l-7.9-6.14A23.9 23.9 0 0 0 0 24c0 3.86.92 7.5 2.6 10.73l7.93-6.14z"/><path fill="#34A853" d="M24 48c6.48 0 11.91-2.13 15.89-5.82l-7.7-5.98c-2.14 1.44-4.85 2.3-8.19 2.3-6.3 0-11.64-4.1-13.47-9.91l-7.9 6.14C6.54 42.6 14.64 48 24 48z"/></svg>}
      Продолжить через Google
     </button>
     {!providers?.google&&<p className="rounded-lg bg-[#fff7ed] p-3 text-left text-[12px] leading-5 text-[#9a3412]">Google пока не включён в тестовом Supabase. Включите Authentication → Sign In / Providers → Google и настройте Client ID / Secret. До этого вход через Google недоступен.</p>}
     <div className="flex items-center gap-3 text-[12px] text-[#8f909a]"><div className="h-px flex-1 bg-[#e5e7eb]"/>или<div className="h-px flex-1 bg-[#e5e7eb]"/></div>
     <div className="flex min-h-[44px] items-center justify-center rounded-[8px] border border-[#654be7] bg-white px-3">
      {providers?.telegram&&isPublicDomain?<a href="/api/auth/telegram/start" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#54a9eb] px-6 text-sm font-semibold text-white">Войти через Telegram</a>:<span className="text-[12px] text-[#718096]">{!isPublicDomain?"Вход через Telegram доступен только на публичном HTTPS-домене":"Telegram OIDC не настроен"}</span>}
     </div>
     <p className="text-center text-[12px] leading-5 text-[#718096]">После входа ваши боты и настройки будут доступны в кабинете.</p>
     <div className="pt-2 text-center text-[14px]">{mode==="login"?"Ещё нет аккаунта?":"Уже есть аккаунт?"} <button type="button" onClick={()=>{setMode(mode==="login"?"signup":"login");setError("")}} className="ml-1 font-semibold text-[#3d1ddd]">{mode==="login"?"Регистрация":"Войти"}</button></div>
     <p className="pt-2 text-center text-[11px] leading-5 text-[#94a3b8]">Для Telegram нужен постоянный HTTPS-домен, зарегистрированный у бота через @BotFather. На localhost вход недоступен.</p>
    </div>}
   </div>
  </div>
 </main>
}
