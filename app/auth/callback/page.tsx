"use client";

import { useEffect, useRef, useState } from "react";
import { clearGoogleBrowserSession, createGoogleBrowserClient } from "@/lib/auth/google-browser";

export default function GoogleCallbackPage() {
  // React Strict Mode may invoke effects twice in development. OAuth codes are single-use.
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function finishLogin() {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has("error")) {
          throw new Error("Google отклонил авторизацию. Повторите вход.");
        }
        const code = params.get("code");
        if (!code) throw new Error("Google не вернул код входа. Начните вход заново.");

        const response = await fetch("/api/auth/public-config", { cache: "no-store" });
        if (!response.ok) throw new Error("Не удалось получить настройки Google.");
        const config = await response.json() as { url?: string; key?: string };
        if (!config.url?.startsWith("https://") || !config.key) {
          throw new Error("Google OAuth не настроен.");
        }

        const client = createGoogleBrowserClient({ url: config.url, key: config.key });
        // Supabase PKCE verifier is retrieved from the SAME sessionStorage as on /login.
        const { data, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError || !data.session?.access_token || !data.session.refresh_token) {
          throw new Error("Google не подтвердил PKCE-сессию (" + (exchangeError?.code ?? "missing_session") + "). Начните вход заново.");
        }

        const sessionResponse = await fetch("/api/auth/oauth-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          credentials: "same-origin",
          body: JSON.stringify({
            token: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresIn: data.session.expires_in ?? 3600,
          }),
        });
        if (!sessionResponse.ok) {
          throw new Error("Ошибка серверной сессии Google (HTTP " + sessionResponse.status + ").");
        }

        client.auth.stopAutoRefresh();
        clearGoogleBrowserSession();
        window.history.replaceState(null, "", "/auth/callback");
        window.location.replace("/workspace");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Не удалось войти через Google.");
      }
    }

    void finishLogin();
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f4f6f8] px-6 text-[#101828]">
      <section className="w-full max-w-[420px] rounded-2xl bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Не удалось завершить вход</h1>
            <p role="alert" className="mt-3 text-sm leading-6 text-[#b42318]">{error}</p>
            <a href="/login" className="mt-6 inline-flex rounded-xl bg-[#6d45f5] px-5 py-3 text-sm font-semibold text-white">Вернуться ко входу</a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Подтверждаем Google-аккаунт…</h1>
            <p role="status" className="mt-3 text-sm text-[#667085]">Создаём защищённую сессию Bot Studio.</p>
          </>
        )}
      </section>
    </main>
  );
}
