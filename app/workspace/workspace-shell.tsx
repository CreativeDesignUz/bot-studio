"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bot, ChevronDown, House, Menu, Package, Settings, ShoppingBag, UserRound, Users, Warehouse, X } from "lucide-react";
import type { BotTemplateId } from "@/lib/product/templates";

export type BotMetrics = { ordersToday: number; revenueTodayMinor: number; catalogItems: number; customers: number; recentOrders: { id: string; customer_name: string; status: string; total_minor: number }[] };
export type WorkspaceBot = { id: string; name: string; username: string | null; template_type: BotTemplateId; metrics: BotMetrics };
type WorkspaceData = { bots: WorkspaceBot[]; user: { firstName: string; telegramLinked: boolean } };
type WorkspaceContextValue = WorkspaceData & { bot: WorkspaceBot | null; loading: boolean; error: string };
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace provider is missing");
  return value;
}

const sections = [
  { id: "overview", label: "Главная", icon: House },
  { id: "catalog", label: "Блюда/Товары", icon: Package },
  { id: "orders", label: "Заказы", icon: ShoppingBag },
  { id: "customers", label: "Клиенты", icon: Users },
  { id: "inventory", label: "Склад", icon: Warehouse },
] as const;

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const query = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData>({ bots: [], user: { firstName: "", telegramLinked: false } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const requestedId = query.get("bot");
  const bot = data.bots.find(item => item.id === requestedId) ?? data.bots[0] ?? null;

  useEffect(() => {
    const controller = new AbortController();
    const telegram = (window as typeof window & { Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } } }).Telegram?.WebApp;
    telegram?.ready?.(); telegram?.expand?.();
    void (async () => {
      try {
        const response = await fetch("/api/workspace", { headers: { "x-telegram-init-data": telegram?.initData ?? "" }, signal: controller.signal, cache: "no-store" });
        if (response.status === 401) { router.replace("/login"); return; }
        if (!response.ok) throw new Error("Не удалось загрузить кабинет. Повторите попытку.");
        const result = await response.json() as WorkspaceData;
        if (!controller.signal.aborted) setData(result);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Ошибка загрузки кабинета");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [router]);

  // URL carries the selection through links, browser history and direct page loads.
  useEffect(() => {
    if (loading || !bot) return;
    if (requestedId !== bot.id) {
      const next = new URLSearchParams(query.toString());
      next.set("bot", bot.id);
      router.replace(`${pathname}?${next}`, { scroll: false });
    }
  }, [bot, loading, pathname, query, requestedId, router]);

  const section = query.get("section") ?? "overview";
  const isSettings = pathname.startsWith("/workspace/builder");
  const isProfile = pathname === "/workspace/profile";
  const current = pathname.startsWith("/workspace/orders/") ? "orders" : pathname === "/workspace/restaurant" ? "catalog" : section;
  const href = (sectionId: string) => `/workspace?${new URLSearchParams({ ...(bot ? { bot: bot.id } : {}), section: sectionId })}`;
  const linkClass = (active: boolean) => `flex h-12 shrink-0 items-center gap-3 rounded-xl px-4 text-[15px] font-medium no-underline focus-visible:outline-2 focus-visible:outline-[#6541f5] ${active ? "bg-[#f0eaff] text-[#623cf2]" : "text-[#101828] hover:bg-[#f8f7ff]"}`;
  const navigate = () => setMobileOpen(false);

  return <WorkspaceContext.Provider value={{ ...data, bot, loading, error }}>
    <div className="min-h-screen bg-[#f4f6f8] text-[#101828]">
      <button type="button" aria-label="Открыть меню" aria-expanded={mobileOpen} aria-controls="workspace-sidebar" onClick={() => setMobileOpen(true)} className="m-3 inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-4 lg:hidden"><Menu className="size-5" />Меню</button>
      {mobileOpen && <button type="button" aria-label="Закрыть меню" onClick={navigate} className="fixed inset-0 z-40 bg-black/30 lg:hidden" />}
      <div className="flex min-h-screen">
        <aside id="workspace-sidebar" aria-label="Навигация кабинета" onKeyDown={event => { if (event.key === "Escape") navigate(); }} className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[270px] shrink-0 flex-col border-r border-[#e4e7ec] bg-white px-4 py-6 lg:sticky lg:top-0 ${mobileOpen ? "" : "hidden lg:flex"}`}>
          <div className="mb-8 flex shrink-0 items-center justify-between">
            <Link href={href("overview")} onClick={navigate} className="flex items-center gap-3 px-2 text-xl font-bold text-[#101828] no-underline"><span className="grid size-11 place-items-center rounded-2xl bg-[#6d45f5] text-white"><Bot className="size-6" /></span>Bot Studio</Link>
            <button type="button" aria-label="Закрыть меню" onClick={navigate} className="grid size-9 place-items-center rounded-lg lg:hidden"><X className="size-5" /></button>
          </div>
          <div className="h-[104px] shrink-0">
            {bot && <label className="block"><span className="mb-3 block px-2 text-xs font-semibold text-[#98a2b3]">Выбор бота</span><span className="relative block"><select aria-label="Выбор бота" value={bot.id} onChange={event => {
              const next = new URLSearchParams(query.toString()); next.set("bot", event.target.value);
              // A detail URL belongs to its old bot; switch to the new bot's order list.
              const target = pathname.startsWith("/workspace/orders/") ? "/workspace" : pathname;
              if (target !== pathname) next.set("section", "orders");
              router.push(`${target}?${next}`); navigate();
            }} className="h-14 w-full appearance-none truncate rounded-2xl border border-[#e1e5ee] bg-[#f8f9fc] px-4 pr-10 text-sm font-semibold focus:border-[#6d45f5]">{data.bots.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2" /></span></label>}
          </div>
          <nav aria-label="Разделы бота" className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {sections.filter(item => bot || item.id === "overview").map(({ id, label, icon: Icon }) => <Link key={id} href={href(id)} onClick={navigate} aria-current={!isSettings && !isProfile && current === id ? "page" : undefined} className={linkClass(!isSettings && !isProfile && current === id)}><Icon className="size-5 shrink-0" /><span className="truncate">{id === "catalog" ? bot?.template_type === "delivery" ? "Блюда" : bot?.template_type === "service" ? "Услуги" : "Товары" : label}</span></Link>)}
            {bot && <Link href={`/workspace/builder?${new URLSearchParams({ bot: bot.id })}`} onClick={navigate} aria-current={isSettings ? "page" : undefined} className={linkClass(isSettings)}><Settings className="size-5 shrink-0" /><span>Настройки бота</span></Link>}
          </nav>
          <div className="mt-5 shrink-0 border-t border-[#e4e7ec] pt-5"><Link href={`/workspace/profile${bot ? `?${new URLSearchParams({ bot: bot.id })}` : ""}`} onClick={navigate} aria-current={isProfile ? "page" : undefined} className={linkClass(isProfile)}><UserRound className="size-5 shrink-0" />Профиль</Link></div>
        </aside>
        <div className="min-w-0 flex-1">
          {loading ? <div role="status" className="grid min-h-[70vh] place-items-center text-sm text-[#667085]">Загружаем кабинет…</div> : error ? <div role="alert" className="p-8"><p>{error}</p><button type="button" onClick={() => location.reload()} className="mt-4 rounded-xl bg-[#101828] px-4 py-3 text-white">Повторить</button></div> : children}
        </div>
      </div>
    </div>
  </WorkspaceContext.Provider>;
}
