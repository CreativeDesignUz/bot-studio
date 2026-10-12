"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
export default function AuthCallback(){
  const [error,setError]=useState("");
  useEffect(()=>{
    const run=async()=>{
      try{
        const cfg=await fetch("/api/auth/public-config",{cache:"no-store"}).then(r=>r.json()) as {url?:string;key?:string};
        if(!cfg.url||!cfg.key)throw new Error("Вход через Google не настроен");
        const client=createClient(cfg.url,cfg.key,{auth:{detectSessionInUrl:false,persistSession:true,flowType:"pkce",storage:window.sessionStorage}});
        const params=new URLSearchParams(location.search);
        if(params.has("error"))throw new Error("Google отклонил вход: "+(params.get("error_description")??params.get("error"))?.slice(0,180));
        let token="";
        const hash=new URLSearchParams(window.location.hash.slice(1));
        if(hash.get("access_token"))token=hash.get("access_token")!;
        else if(new URLSearchParams(location.search).get("code")){
          const code=new URLSearchParams(location.search).get("code")!;
          const {data,error:exchangeError}=await client.auth.exchangeCodeForSession(code);
          if(exchangeError||!data.session?.access_token)throw new Error("Ошибка обмена Google OAuth: "+(exchangeError?.code??"missing_session"));
          token=data.session.access_token;
        }
        else {const {data}=await client.auth.getSession();token=data.session?.access_token??"";}
        if(!token)throw new Error("Google не вернул сессию");
        const response=await fetch("/api/auth/oauth-session",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});
        if(!response.ok)throw new Error("Ошибка серверной сессии Google (HTTP "+response.status+")");
        // The access token now lives in an HttpOnly application cookie. Do not
        // call Supabase signOut here: even a local sign-out can revoke the very
        // token the server has just verified and stored.
        client.auth.stopAutoRefresh();
        const projectRef=new URL(cfg.url).hostname.split(".")[0];
        const storagePrefix=`sb-${projectRef}-auth-token`;
        for(let index=sessionStorage.length-1;index>=0;index--){
          const key=sessionStorage.key(index);
          if(key?.startsWith(storagePrefix))sessionStorage.removeItem(key);
        }
        window.location.replace("/workspace");
      }catch(e){setError(e instanceof Error?e.message:"Ошибка авторизации");}
    };
    void run();
  },[]);
  return <main className="grid min-h-screen place-items-center px-6">{error?<div role="alert"><p>{error}</p><a className="underline" href="/login">Вернуться ко входу</a></div>:<p>Завершаем вход через Google…</p>}</main>;
}
