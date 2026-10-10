"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ArrowRight, CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";

type Providers={google:{supabaseUrl:string;publishableKey:string}|null;telegram:{username:string}|null};
type TelegramUser={id:number;first_name:string;last_name?:string;username?:string;auth_date:number;hash:string;photo_url?:string};
declare global{interface Window{onBotStudioTelegramAuth?:(user:TelegramUser)=>void}}
const card="relative w-full max-w-[460px] overflow-hidden rounded-[20px] bg-[#f9fafb] px-6 py-8 shadow-[0_12px_40px_1px_rgba(0,0,0,.06)] sm:px-8";
const accent="#3d1ddd";
export default function LoginPage({callback=false}:{callback?:boolean}){
 const [mode,setMode]=useState<"login"|"signup">("login");
 const [providers,setProviders]=useState<Providers|null>(null);
 const [error,setError]=useState("");
 const [working,setWorking]=useState(false);
 const widgetRef=useRef<HTMLDivElement>(null);
 const clientRef=useRef<SupabaseClient|null>(null);
 const isCallback=callback;
 const getClient=useCallback((config:Providers["google"])=>{
  if(!config)throw new Error("Google OAuth не настроен в Supabase.");
  if(!clientRef.current)clientRef.current=createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:true,detectSessionInUrl:true,flowType:"implicit",storageKey:"bot-studio-supabase-google"}});
  return clientRef.current;
 },[]);
 const finish=useCallback(async(payload:object)=>{
  const response=await fetch("/api/auth/account",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const result=await response.json() as {error?:string};
  if(!response.ok)throw new Error(result.error??"Вход не завершён.");
  window.location.replace("/workspace");
 },[]);

 useEffect(()=>{
  const controller=new AbortController();
  void fetch("/api/auth/providers",{signal:controller.signal}).then(r=>r.json()).then((data:Providers)=>{if(!controller.signal.aborted)setProviders(data)}).catch(()=>{if(!controller.signal.aborted)setError("Не удалось загрузить способы входа.")});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  if(!isCallback||!providers)return;
  let cancel=false;
  async function exchange(){
   if(!providers?.google){setError("Google ещё не настроен.");return}
   setWorking(true);
   try{
    const client=getClient(providers.google);
    const {data,error:sessionError}=await client.auth.getSession();
    if(sessionError||!data.session?.access_token)throw new Error("Google не вернул сессию. Попробуйте войти ещё раз.");
    if(cancel)return;
    await finish({provider:"google",accessToken:data.session.access_token});
   }catch(e){if(!cancel)setError(e instanceof Error?e.message:"Ошибка входа.");}
   finally{if(!cancel)setWorking(false)}
  }
  void exchange();return()=>{cancel=true}
 },[isCallback,providers,getClient,finish]);
 useEffect(()=>{
  if(isCallback||!providers?.telegram||!widgetRef.current)return;
  window.onBotStudioTelegramAuth=async(user)=>{
   setWorking(true);setError("");
   try{await finish({provider:"telegram",telegram:user})}
   catch(e){setError(e instanceof Error?e.message:"Telegram не подтвердил вход.");setWorking(false)}
  };
  const mount=widgetRef.current;mount.innerHTML="";
  const script=document.createElement("script");
  script.src="https://telegram.org/js/telegram-widget.js?22";
  script.async=true;
  script.setAttribute("data-telegram-login",providers.telegram.username);
  script.setAttribute("data-size","large");
  script.setAttribute("data-radius","8");
  script.setAttribute("data-request-access","write");
  script.setAttribute("data-onauth","onBotStudioTelegramAuth(user)");
  mount.appendChild(script);
  return()=>{if(window.onBotStudioTelegramAuth)delete window.onBotStudioTelegramAuth;mount.innerHTML=""};
 },[providers?.telegram?.username,isCallback,finish]);

 async function googleLogin(){
  setWorking(true);setError("");
  try{
   const client=getClient(providers?.google??null);
   const {error:oauthError}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/auth/callback"}});
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
     <div className="flex items-center gap-3 text-[12px] text-[#8f909a]"><div className="h-px flex-1 bg-[#e5e7eb]"/>или<div className="h-px flex-1 bg-[#e5e7eb]"/></div>
     <div className="flex min-h-[44px] items-center justify-center rounded-[8px] border border-[#654be7] bg-white px-3">
      {providers?.telegram?<div ref={widgetRef} aria-label="Авторизация через Telegram" className="flex justify-center"/>:<span className="text-[12px] text-[#718096]">Telegram Login не настроен</span>}
     </div>
     <p className="text-center text-[12px] leading-5 text-[#718096]">После входа ваши боты и настройки будут доступны в кабинете.</p>
     <div className="pt-2 text-center text-[14px]">{mode==="login"?"Ещё нет аккаунта?":"Уже есть аккаунт?"} <button type="button" onClick={()=>{setMode(mode==="login"?"signup":"login");setError("")}} className="ml-1 font-semibold text-[#3d1ddd]">{mode==="login"?"Регистрация":"Войти"}</button></div>
     <p className="pt-2 text-center text-[11px] leading-5 text-[#94a3b8]">Для Telegram требуется публичный HTTPS-домен, привязанный через @BotFather.</p>
    </div>}
   </div>
  </div>
 </main>
}
