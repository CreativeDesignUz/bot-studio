"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send } from "lucide-react";
import { createGoogleBrowserClient } from "@/lib/auth/google-browser";

declare global { interface Window { Telegram?: { WebApp?: { initData?: string } } } }

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("error") === "telegram_auth") {
      const stages: Record<string, string> = {
        token_exchange: "Telegram не подтвердил вход. Проверьте домен и настройки OAuth в BotFather.",
        missing_token: "Telegram не вернул токен пользователя.",
        account_sync: "Не удалось сохранить профиль Telegram. Попробуйте ещё раз.",
        identity_verification: "Не удалось подтвердить Telegram-аккаунт.",
        unexpected: "Не удалось завершить вход Telegram. Повторите попытку.",
      };
      queueMicrotask(() => setError(stages[query.get("stage") ?? ""] ?? "Не удалось войти через Telegram."));
    } else if (query.get("error") === "telegram_session") {
      queueMicrotask(() => setError("Срок подтверждения Telegram истёк. Начните вход заново."));
    }

    // The Telegram Mini App flow is separate from the website OIDC login.
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    queueMicrotask(() => setBusy(true));
    void fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData }),
      cache: "no-store",
    }).then((response) => {
      if (!response.ok) throw new Error("Не удалось подтвердить Telegram-аккаунт.");
      router.replace("/workspace");
      router.refresh();
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Ошибка Telegram."))
      .finally(() => setBusy(false));
  }, [router]);

  async function loginGoogle() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/public-config", { cache: "no-store" });
      if (!response.ok) throw new Error("Не удалось получить настройки Google.");
      const config = await response.json() as { url?: string; key?: string };
      if (!config.url?.startsWith("https://") || !config.key) {
        throw new Error("Google OAuth пока не настроен для этого сайта.");
      }

      // Supabase handles Google's consent, redirect and PKCE verifier.
      const client = createGoogleBrowserClient({ url: config.url, key: config.key });
      const { data, error: oauthError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth/callback",
          skipBrowserRedirect: true,
        },
      });
      if (oauthError || !data.url) throw new Error("Не удалось начать вход через Google.");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка Google OAuth.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f4f6f8] px-4 py-8 text-[#101828]">
      <section className="w-full max-w-[440px] rounded-[24px] border border-[#e4e7ec] bg-white p-7 shadow-[0_12px_40px_rgba(16,24,40,.06)] sm:p-9">
        <div className="mb-8 flex items-center gap-3 text-xl font-semibold">
          <span className="grid size-11 place-items-center rounded-xl bg-[#6d45f5] text-white"><Bot /></span>
          Bot Studio
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Войти в Bot Studio</h1>
        <p className="mt-2 text-sm leading-6 text-[#667085]">Войдите или создайте аккаунт, чтобы управлять своими ботами, заказами и Mini App.</p>
        <div className="mt-8 space-y-3">
          <button type="button" disabled={busy} onClick={() => void loginGoogle()}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#d0d5dd] bg-white px-4 text-sm font-semibold transition hover:bg-[#f9fafb] disabled:opacity-60">
            <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.4 0 24 0 14.6 5.4 6.5 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h13c-.6 3-2.3 5.5-4.8 7.2l7.7 6C44.4 38 47 31.9 47 24.6z"/>
              <path fill="#FBBC05" d="M10.5 28.6a14.4 14.4 0 0 1-.8-4.6c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
            </svg>
            Продолжить через Google
          </button>
          <div className="flex items-center gap-3 py-1 text-xs text-[#98a2b3]">
            <span className="h-px flex-1 bg-[#eaecf0]" />или<span className="h-px flex-1 bg-[#eaecf0]" />
          </div>
          <button type="button" disabled={busy} onClick={() => window.location.assign("/api/auth/telegram/oidc/start")}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#e9eef5] px-4 text-sm font-semibold transition hover:bg-[#e1e9f4] disabled:opacity-60">
            <Send className="size-5 text-[#229ed9]" />Продолжить через Telegram
          </button>
        </div>
        {busy && <p role="status" className="mt-5 text-center text-sm text-[#667085]">Подключаем авторизацию…</p>}
        {error && <p role="alert" className="mt-5 rounded-lg bg-[#fff1f3] p-3 text-sm text-[#b42318]">{error}</p>}
        <p className="mt-7 text-center text-xs leading-5 text-[#98a2b3]">После входа откроется ваш личный кабинет.</p>
      </section>
    </main>
  );
}
