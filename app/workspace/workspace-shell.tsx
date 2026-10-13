"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Menu } from "lucide-react";
import type { BotTemplateId } from "@/lib/product/templates";
import WorkspaceSidebar from "./workspace-sidebar";

export type BotMetrics = {
  ordersToday: number;
  revenueTodayMinor: number;
  catalogItems: number;
  customers: number;
  newOrders?: number;
  recentOrders: { id: string; customer_name: string; status: string; total_minor: number }[];
};
export type WorkspaceBot = {
  id: string;
  name: string;
  username: string | null;
  template_type: BotTemplateId;
  metrics: BotMetrics;
};
export type WorkspaceUser = { firstName: string; email?: string | null; telegramLinked: boolean };
type WorkspaceResponse = { bots: WorkspaceBot[]; user: WorkspaceUser };
type WorkspaceContext = {
  bots: WorkspaceBot[];
  bot: WorkspaceBot | null;
  user: WorkspaceUser;
  loading: boolean;
  error: string;
};
const Context = createContext<WorkspaceContext | null>(null);
export function useWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("WorkspaceShell is required");
  return ctx;
}

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const query = useSearchParams();
  const [data, setData] = useState<WorkspaceResponse>({
    bots: [], user: { firstName: "", email: null, telegramLinked: false },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const requestedId = query.get("bot");
  const bot = data.bots.find(item => item.id === requestedId) ?? data.bots[0] ?? null;

  useEffect(() => {
    const controller = new AbortController();
    const telegram = (window as typeof window & {
      Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
    }).Telegram?.WebApp;
    telegram?.ready?.();
    telegram?.expand?.();

    void (async () => {
      try {
        const response = await fetch("/api/workspace", {
          headers: { "x-telegram-init-data": telegram?.initData ?? "" },
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("Не удалось загрузить кабинет");
        const result = await response.json() as WorkspaceResponse;
        if (!controller.signal.aborted) setData(result);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Ошибка загрузки");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <Context.Provider value={{ bots: data.bots, bot, user: data.user, loading, error }}>
      <div className="min-h-screen bg-[#f4f6f8] text-[#101828]">
        <header className="flex h-14 items-center gap-3 border-b border-[#eaecf0] bg-white px-4 lg:hidden">
          <button type="button" aria-label="Открыть меню" aria-expanded={mobileOpen} aria-controls="workspace-sidebar" onClick={() => setMobileOpen(true)} className="grid size-10 place-items-center rounded-xl border border-[#e4e7ec] hover:bg-[#f7f5ff]"><Menu className="size-5" /></button>
          <a href="/workspace" className="flex items-center gap-2 text-base font-bold text-[#101828] no-underline"><span className="grid size-8 place-items-center rounded-lg bg-[#6d45f5] text-white"><Bot className="size-[18px]" /></span>Bot Studio</a>
        </header>
        <div className="flex min-h-[calc(100vh-56px)] lg:min-h-screen">
          <WorkspaceSidebar
            bots={data.bots}
            bot={bot}
            user={data.user}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
          />
          <div className="min-w-0 flex-1" data-workspace-content>
          {loading
            ? <div role="status" className="grid min-h-[75vh] place-items-center p-8 text-sm text-[#667085]">Загружаем кабинет…</div>
            : error
              ? <div role="alert" className="p-8"><p>{error}</p><button type="button" onClick={() => location.reload()} className="mt-4 rounded-xl bg-[#101828] px-4 py-3 text-white">Повторить</button></div>
              : children}
          </div>
        </div>
      </div>
    </Context.Provider>
  );
}
