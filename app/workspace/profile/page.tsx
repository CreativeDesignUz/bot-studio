"use client";
import { useState } from "react";
import { useWorkspace } from "../workspace-shell";

export default function ProfilePage() {
  const { user } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось выйти. Повторите попытку.");
      location.replace("/login");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка выхода"); setBusy(false); }
  }
  return <main className="p-4 sm:p-7 lg:p-9"><h1 className="mb-7 text-3xl font-semibold">Профиль</h1><section className="max-w-xl rounded-2xl border bg-white p-6"><dl className="space-y-5"><div><dt className="text-sm text-[#667085]">Имя</dt><dd className="mt-1 font-semibold">{user.firstName || "Не указано"}</dd></div><div><dt className="text-sm text-[#667085]">Telegram</dt><dd className="mt-1 font-semibold">{user.telegramLinked ? "Подключён" : "Не подключён"}</dd></div></dl>{error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}<button type="button" disabled={busy} onClick={() => void logout()} className="mt-7 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50">{busy ? "Выходим…" : "Выйти из аккаунта"}</button></section></main>;
}
