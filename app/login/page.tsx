"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Bot, Send, ShieldCheck } from "lucide-react";

declare global { interface Window { Telegram?: { WebApp?: { initData?: string } } } }

export default function LoginPage() {
  const router=useRouter();
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    if(query.get("error")==="telegram_auth"){
      const messages:Record<string,string>={token_exchange:"Telegram отклонил подтверждение входа. Проверьте Client Secret и разрешённый адрес возврата в BotFather.",missing_token:"Telegram не передал токен пользователя.",account_sync:"Telegram подтвердил вход, но не удалось сохранить профиль пользователя.",identity_verification:"Не удалось проверить подпись авторизации Telegram.",unexpected:"Не удалось завершить вход. Повторите попытку."};
      queueMicrotask(()=>setError(messages[query.get("stage")??""]??"Не удалось завершить авторизацию Telegram. Повторите попытку."));
    }else if(query.get("error")==="telegram_session"){
      queueMicrotask(()=>setError("Сессия Telegram истекла или была прервана. Попробуйте войти снова."));
    }
    const initData=window.Telegram?.WebApp?.initData;
    if(initData) {
      queueMicrotask(()=>setBusy(true));
      fetch("/api/auth/telegram",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData})})
      .then(async r=>{if(!r.ok)throw new Error("Не удалось подтвердить аккаунт Telegram");router.replace("/workspace");router.refresh();})
      .catch(e=>setError(e.message)).finally(()=>setBusy(false));
    }
  },[router]);
  async function loginGoogle(){
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/auth/public-config",{cache:"no-store"});
      const config=await response.json() as {url?:string;key?:string};
      if(!response.ok||!config.url||!config.key)throw new Error("Google OAuth не настроен");
      const client=createClient(config.url,config.key,{auth:{flowType:"pkce",persistSession:true,detectSessionInUrl:false}});
      const {data,error:oauthError}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/auth/callback",skipBrowserRedirect:true}});
      if(oauthError||!data.url)throw new Error("Не удалось начать вход с Google");
      location.assign(data.url);
    }catch(e){setError(e instanceof Error?e.message:"Ошибка Google OAuth");setBusy(false);}
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-4 text-[#101828]">
    <section className="w-full max-w-[420px] rounded-[24px] border border-[#e4e7ec] bg-white p-8 shadow-sm">
      <div className="mb-7 flex items-center gap-3 text-xl font-semibold"><span className="grid size-11 place-items-center rounded-xl bg-[#6d45f5] text-white"><Bot/></span>Bot Studio</div>
      <h1 className="text-2xl font-semibold">Добро пожаловать</h1>
      <p className="mt-2 text-sm text-[#667085]">Войдите, чтобы создавать ботов и управлять ими</p>
      <div className="mt-8 space-y-3">
        <button type="button" onClick={()=>void loginGoogle()} disabled={busy} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#d0d5dd] font-semibold hover:bg-[#f9fafb] disabled:opacity-50"><ShieldCheck size={20}/> Продолжить с Google</button>
        <div className="relative py-2 text-center text-xs text-[#98a2b3]">или</div>
        <a href="/api/auth/telegram/oidc/start" className="flex h-12 items-center justify-center gap-3 rounded-xl bg-[#e9eef5] font-semibold hover:bg-[#e1e9f4]"><Send size={19}/> Продолжить с Telegram</a>
      </div>
      {busy&&<p className="mt-5 text-center text-sm text-[#667085]">Проверяем аккаунт…</p>}
      {error&&<p role="alert" className="mt-5 text-sm text-[#c01048]">{error}</p>}
      <p className="mt-7 text-center text-xs text-[#98a2b3]">Без пароля. Безопасный вход через Google или Telegram.</p>
    </section>
  </main>;
}
