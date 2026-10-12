"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, Chrome } from "lucide-react";

declare global { interface Window { Telegram?: { WebApp?: { initData?: string } }; onBotStudioTelegramAuth?: (user: Record<string, unknown>) => void } }

export default function LoginPage() {
  const router=useRouter();
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [telegramUsername,setTelegramUsername]=useState("");
  useEffect(()=>{
    fetch("/api/auth/providers").then(r=>r.json()).then((data:{telegramBotUsername?:string})=>setTelegramUsername(data.telegramBotUsername??"")).catch(()=>{});
    const initData=window.Telegram?.WebApp?.initData;
    if(initData) {
      setBusy(true);
      fetch("/api/auth/telegram",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData})})
      .then(async r=>{if(!r.ok)throw new Error("Не удалось подтвердить аккаунт Telegram");router.replace("/workspace");router.refresh();})
      .catch(e=>setError(e.message)).finally(()=>setBusy(false));
    }
  },[router]);
  useEffect(()=>{
    if(!telegramUsername)return;
    window.onBotStudioTelegramAuth=(user)=>{
      setBusy(true);setError("");
      fetch("/api/auth/telegram",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({login:user})})
      .then(async r=>{if(!r.ok)throw new Error("Не удалось подтвердить Telegram");router.replace("/workspace");router.refresh();})
      .catch(e=>setError(e.message)).finally(()=>setBusy(false));
    };
    const script=document.createElement("script");
    script.src="https://telegram.org/js/telegram-widget.js?22";
    script.async=true;
    script.setAttribute("data-telegram-login",telegramUsername);
    script.setAttribute("data-size","large");
    script.setAttribute("data-radius","12");
    script.setAttribute("data-onauth","onBotStudioTelegramAuth(user)");
    script.setAttribute("data-request-access","write");
    const el=document.getElementById("telegram-login-widget");
    el?.appendChild(script);
    return ()=>{script.remove();delete window.onBotStudioTelegramAuth;};
  },[telegramUsername,router]);
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-4 text-[#101828]">
    <section className="w-full max-w-[420px] rounded-[24px] border border-[#e4e7ec] bg-white p-8 shadow-sm">
      <div className="mb-7 flex items-center gap-3 text-xl font-semibold"><span className="grid size-11 place-items-center rounded-xl bg-[#6d45f5] text-white"><Bot/></span>Bot Studio</div>
      <h1 className="text-2xl font-semibold">Добро пожаловать</h1>
      <p className="mt-2 text-sm text-[#667085]">Войдите, чтобы создавать ботов и управлять ими</p>
      <div className="mt-8 space-y-3">
        <a href="/api/auth/google" aria-disabled={busy} className="flex h-12 items-center justify-center gap-3 rounded-xl border border-[#d0d5dd] font-semibold hover:bg-[#f9fafb]"><Chrome size={20}/> Продолжить с Google</a>
        <div className="relative py-2 text-center text-xs text-[#98a2b3]">или</div>
        {telegramUsername ? <div id="telegram-login-widget" className="flex min-h-12 items-center justify-center"/> :
          <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e9eef5] px-4 text-sm text-[#667085]"><Send size={18}/> Telegram временно недоступен: бот не настроен</div>}
      </div>
      {busy&&<p className="mt-5 text-center text-sm text-[#667085]">Проверяем аккаунт…</p>}
      {error&&<p role="alert" className="mt-5 text-sm text-[#c01048]">{error}</p>}
      <p className="mt-7 text-center text-xs text-[#98a2b3]">Без пароля. Безопасный вход через Google или Telegram.</p>
    </section>
  </main>;
}
