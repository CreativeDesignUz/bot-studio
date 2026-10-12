"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const result = await fetch("/api/auth/session",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});
      if (!result.ok) {const data = await result.json() as {error?:string}; throw new Error(data.error ?? "Не удалось войти");}
      router.replace("/workspace");router.refresh();
    } catch (e) { setError(e instanceof Error?e.message:"Не удалось войти"); }
    finally {setBusy(false);}
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-4 text-[#101828]">
    <section className="w-full max-w-[420px] rounded-[24px] border border-[#e4e7ec] bg-white p-8 shadow-sm">
      <div className="mb-7 flex items-center gap-3 text-xl font-semibold"><span className="grid size-11 place-items-center rounded-xl bg-[#6d45f5] text-white"><Bot/></span>Bot Studio</div>
      <h1 className="text-2xl font-semibold">Вход в аккаунт</h1>
      <p className="mt-2 text-sm text-[#667085]">Войдите, чтобы управлять своими ботами</p>
      <form onSubmit={login} className="mt-7 space-y-4">
        <label className="block text-sm font-medium">Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#d0d5dd] px-4 outline-none focus:border-[#6d45f5]" placeholder="you@example.com"/></label>
        <label className="block text-sm font-medium">Пароль<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#d0d5dd] px-4 outline-none focus:border-[#6d45f5]" placeholder="Введите пароль"/></label>
        {error&&<p role="alert" className="text-sm text-[#c01048]">{error}</p>}
        <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-[#101828] font-semibold text-white disabled:opacity-50">{busy?"Проверяем…":"Войти"}</button>
      </form>
    </section>
  </main>;
}
