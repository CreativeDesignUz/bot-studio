"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bot, ChevronDown, ChevronRight, House, LogOut, Package, PanelLeftClose,
  PanelLeftOpen, Plus, Settings2, ShoppingBag, Smartphone, UserRound, Users, X,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceBot, WorkspaceUser } from "./workspace-shell";

const SIDEBAR_STORAGE_KEY = "bot-studio.sidebar.collapsed.v1";
type SidebarProps = {
  bots: WorkspaceBot[];
  bot: WorkspaceBot | null;
  user: WorkspaceUser;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
};
type NavLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate: () => void;
};
const navBase = "group flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 text-[14px] font-medium no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6d45f5]";
const navColor = (active: boolean) => active
  ? "bg-[#f0eaff] text-[#623cf2]"
  : "text-[#344054] hover:bg-[#f7f5ff] hover:text-[#5934dc]";
const badgeLabel = (n: number) => n > 99 ? "99+" : String(n);

function NavLink({ href, label, icon: Icon, active, collapsed, badge = 0, onNavigate }: NavLinkProps) {
  return (
    <a
      href={href}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`${navBase} ${navColor(active)} ${collapsed ? "lg:justify-center lg:px-2" : ""}`}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
      <span className={`min-w-0 flex-1 truncate ${collapsed ? "lg:hidden" : ""}`}>{label}</span>
      {badge > 0 && (
        <span
          aria-label={`Новых элементов: ${badge}`}
          className={`min-w-5 shrink-0 rounded-md bg-[#fee4e2] px-1.5 py-0.5 text-center text-[11px] font-semibold text-[#b42318] ${collapsed ? "lg:hidden" : ""}`}
        >{badgeLabel(badge)}</span>
      )}
      {badge > 0 && collapsed && (
        <span aria-hidden="true" className="absolute right-2 top-1.5 hidden size-2 rounded-full bg-[#f04438] lg:block" />
      )}
    </a>
  );
}

export default function WorkspaceSidebar({ bots, bot, user, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const query = useSearchParams();
  const activeSection = pathname.startsWith("/workspace/builder") ? "settings"
    : pathname.startsWith("/workspace/orders/") ? "orders"
      : pathname === "/workspace/restaurant" ? "catalog" : query.get("section") ?? "overview";
  const activeView = query.get("view") ?? "list";
  const [collapsed, setCollapsed] = useState(false);
  const [catalogExpanded, setCatalogExpanded] = useState(activeSection === "catalog");
  const [flyout, setFlyout] = useState<"catalog" | "bots" | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const root = useRef<HTMLAsideElement>(null);
  const profileRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"); }
    catch { /* Browser privacy settings may deny storage. */ }
  }, []);
  useEffect(() => {
    if (activeSection === "catalog") setCatalogExpanded(true);
  }, [activeSection]);
  useEffect(() => {
    if (!flyout && !profileOpen) return;
    function outside(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (flyout && !root.current?.contains(event.target)) setFlyout(null);
      if (profileOpen && !profileRoot.current?.contains(event.target)) setProfileOpen(false);
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { setFlyout(null); setProfileOpen(false); }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keydown); };
  }, [flyout, profileOpen]);

  const closeOverlays = () => { setMobileOpen(false); setFlyout(null); setProfileOpen(false); };
  const toggleWidth = () => {
    setCollapsed(value => {
      const next = !value;
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch { /* Ignore storage failures. */ }
      return next;
    });
    setFlyout(null);
  };
  const href = (section: string, view?: string) => {
    const params = new URLSearchParams();
    if (bot) params.set("bot", bot.id);
    params.set("section", section);
    if (view) params.set("view", view);
    return `/workspace?${params}`;
  };
  const productLabel = bot?.template_type === "delivery" ? "Блюда"
    : bot?.template_type === "service" ? "Услуги" : "Товары";
  const selectedBot = bot?.id ?? "";
  const initial = Array.from(user.firstName?.trim() || "П")[0]?.toLocaleUpperCase("ru-RU") ?? "П";
  const detailClass = "block rounded-lg px-3 py-2.5 text-[13px] no-underline transition-colors focus-visible:outline-2 focus-visible:outline-[#6d45f5]";
  const subItems = [
    { label: `Все ${productLabel.toLowerCase()}`, href: href("catalog", "list"), view: "list" },
    { label: `Создать ${bot?.template_type === "delivery" ? "блюдо" : bot?.template_type === "service" ? "услугу" : "товар"}`, href: href("catalog", "create"), view: "create" },
    { label: "Категории", href: href("catalog", "categories"), view: "categories" },
  ];
  const badge = bot?.metrics.newOrders ?? 0;

  return (
    <>
      {mobileOpen && <button type="button" aria-label="Закрыть меню" onClick={closeOverlays} className="fixed inset-0 z-40 bg-[#101828]/40 lg:hidden" />}
      <aside
        ref={root}
        id="workspace-sidebar"
        aria-label="Навигация Bot Studio"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh shrink-0 flex-col border-r border-[#eaecf0] bg-white px-3 py-5 shadow-xl transition-[width,transform] duration-200 ease-out lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 lg:shadow-none ${collapsed ? "w-[272px] lg:w-[76px]" : "w-[272px] lg:w-[272px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-6 flex shrink-0 items-center justify-between gap-1 px-1">
          <a href={href("overview")} onClick={closeOverlays} title="Bot Studio — Главная" className="flex min-w-0 items-center gap-2.5 text-[#101828] no-underline">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#6d45f5] text-white"><Bot className="size-5" /></span>
            <span className={`truncate text-[18px] font-bold tracking-tight ${collapsed ? "lg:hidden" : ""}`}>Bot Studio</span>
          </a>
          <button
            type="button"
            aria-label={collapsed ? "Развернуть сайдбар" : "Свернуть сайдбар"}
            aria-expanded={!collapsed}
            title={collapsed ? "Развернуть сайдбар" : "Свернуть сайдбар"}
            onClick={toggleWidth}
            className={`hidden size-9 shrink-0 place-items-center rounded-lg text-[#667085] transition-colors hover:bg-[#f2f4f7] hover:text-[#101828] focus-visible:outline-2 focus-visible:outline-[#6d45f5] lg:grid ${collapsed ? "lg:absolute lg:left-[50px] lg:top-[29px] lg:size-6 lg:rounded-md lg:border lg:border-[#e4e7ec] lg:bg-white" : ""}`}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden="true" /> : <PanelLeftClose className="size-[18px]" aria-hidden="true" />}
          </button>
          <button type="button" onClick={closeOverlays} aria-label="Закрыть меню" className="grid size-9 place-items-center rounded-lg hover:bg-[#f2f4f7] lg:hidden"><X className="size-5" /></button>
        </div>

        {bots.length > 0 && bot && (
          <div className={`relative mb-6 shrink-0 ${collapsed ? "lg:mb-5" : ""}`}>
            <p className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[.14em] text-[#98a2b3] ${collapsed ? "lg:hidden" : ""}`}>Ваши боты</p>
            <label className={`relative block ${collapsed ? "lg:hidden" : ""}`}>
              <span className="sr-only">Выбрать бота</span>
              <select
                aria-label="Выбрать бота"
                value={selectedBot}
                onChange={event => { location.assign(`/workspace?bot=${encodeURIComponent(event.target.value)}&section=overview`); }}
                className="h-12 w-full cursor-pointer appearance-none truncate rounded-xl border border-[#e4e7ec] bg-[#f9fafb] px-3 pr-9 text-sm font-semibold outline-none focus:border-[#6d45f5]"
              >{bots.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
            </label>
            {collapsed && (
              <div className="relative hidden lg:block">
                <button
                  type="button"
                  title="Выбрать бота"
                  aria-label="Выбрать бота"
                  aria-expanded={flyout === "bots"}
                  onClick={() => { setFlyout(flyout === "bots" ? null : "bots"); setProfileOpen(false); }}
                  className="grid size-11 w-full place-items-center rounded-xl bg-[#f0eaff] text-[#623cf2] hover:bg-[#e9dfff]"
                ><Bot className="size-5" /></button>
                {flyout === "bots" && <div className="absolute left-[calc(100%+12px)] top-0 z-50 w-60 rounded-xl border border-[#eaecf0] bg-white p-2 shadow-xl">
                  <p className="px-2 py-2 text-xs font-semibold text-[#667085]">Выбрать бота</p>
                  {bots.map(item => <a key={item.id} href={`/workspace?bot=${encodeURIComponent(item.id)}&section=overview`} className={`${detailClass} ${item.id === selectedBot ? navColor(true) : navColor(false)}`}>{item.name}</a>)}
                </div>}
              </div>
            )}
          </div>
        )}

        <nav aria-label="Разделы кабинета" className={`min-h-0 flex-1 space-y-1 ${collapsed ? "lg:overflow-visible" : "overflow-y-auto"}`}>
          <NavLink href={href("overview")} label="Главная" icon={House} active={activeSection === "overview"} collapsed={collapsed} onNavigate={closeOverlays} />
          <div className="relative">
            <NavLink href={href("orders")} label="Заказы" icon={ShoppingBag} active={activeSection === "orders"} collapsed={collapsed} badge={badge} onNavigate={closeOverlays} />
          </div>
          <div className="relative">
            <div className={`${navBase} ${navColor(activeSection === "catalog")} ${collapsed ? "lg:justify-center lg:px-2" : ""}`}>
              {collapsed ? (
                <button
                  type="button"
                  aria-label={productLabel}
                  title={productLabel}
                  aria-expanded={flyout === "catalog"}
                  aria-controls="sidebar-catalog-flyout"
                  onClick={() => { setFlyout(flyout === "catalog" ? null : "catalog"); setProfileOpen(false); }}
                  className="hidden size-7 place-items-center focus-visible:outline-2 focus-visible:outline-[#6d45f5] lg:grid"
                ><Package aria-hidden="true" className="size-5" /></button>
              ) : null}
              <a
                href={href("catalog", "list")}
                aria-current={activeSection === "catalog" ? "page" : undefined}
                onClick={closeOverlays}
                className={`flex min-w-0 flex-1 items-center gap-3 text-inherit no-underline ${collapsed ? "lg:hidden" : ""}`}
              ><Package aria-hidden="true" className="size-5 shrink-0" /><span className="truncate">{productLabel}</span></a>
              <button
                type="button"
                aria-label={catalogExpanded ? "Свернуть подразделы товаров" : "Раскрыть подразделы товаров"}
                aria-expanded={catalogExpanded}
                aria-controls="sidebar-catalog-submenu"
                onClick={() => setCatalogExpanded(value => !value)}
                className={`ml-auto grid size-7 shrink-0 place-items-center rounded-md hover:bg-[#e9e0ff] focus-visible:outline-2 focus-visible:outline-[#6d45f5] ${collapsed ? "lg:hidden" : ""}`}
              ><ChevronRight aria-hidden="true" className={`size-4 transition-transform duration-150 ${catalogExpanded ? "rotate-90" : ""}`} /></button>
            </div>
            {catalogExpanded && <div id="sidebar-catalog-submenu" className={`mt-1 space-y-0.5 pl-11 pr-2 ${collapsed ? "lg:hidden" : ""}`}>
              {subItems.map(item => <a
                key={item.view}
                href={item.href}
                onClick={closeOverlays}
                aria-current={activeSection === "catalog" && activeView === item.view ? "page" : undefined}
                className={`${detailClass} ${activeSection === "catalog" && activeView === item.view ? "bg-[#f0eaff] font-semibold text-[#623cf2]" : "text-[#667085] hover:bg-[#f7f5ff] hover:text-[#5934dc]"}`}
              >{item.label}</a>)}
            </div>}
            {collapsed && flyout === "catalog" && <div id="sidebar-catalog-flyout" className="absolute left-[calc(100%+12px)] top-0 z-50 hidden w-56 rounded-xl border border-[#eaecf0] bg-white p-2 shadow-xl lg:block">
              <p className="px-3 py-2 text-xs font-semibold text-[#667085]">{productLabel}</p>
              {subItems.map(item => <a key={item.view} href={item.href} onClick={closeOverlays} className={`${detailClass} ${activeView === item.view && activeSection === "catalog" ? navColor(true) : navColor(false)}`}>{item.label}</a>)}
            </div>}
          </div>
          <NavLink href={href("customers")} label="Клиенты" icon={Users} active={activeSection === "customers"} collapsed={collapsed} onNavigate={closeOverlays} />
          <NavLink
            href={bot ? `/workspace/builder?bot=${encodeURIComponent(bot.id)}` : "/onboarding"}
            label="Настройки бота" icon={Settings2} active={activeSection === "settings"}
            collapsed={collapsed} onNavigate={closeOverlays}
          />
          <NavLink href={href("miniapp_appearance")} label="Настройки Mini App" icon={Smartphone} active={activeSection === "miniapp_appearance"} collapsed={collapsed} onNavigate={closeOverlays} />
          <NavLink href={href("profile")} label="Профиль" icon={UserRound} active={activeSection === "profile"} collapsed={collapsed} onNavigate={closeOverlays} />
        </nav>

        <div className="relative mt-4 shrink-0 border-t border-[#eaecf0] pt-4" ref={profileRoot}>
          <button
            type="button"
            title={collapsed ? "Меню профиля" : undefined}
            aria-label="Меню профиля"
            aria-expanded={profileOpen}
            aria-controls="sidebar-profile-menu"
            onClick={() => { setProfileOpen(value => !value); setFlyout(null); }}
            className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-[#f7f5ff] focus-visible:outline-2 focus-visible:outline-[#6d45f5] ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eee9ff] text-sm font-semibold text-[#5934dc]">{initial}</span>
            <span className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <span className="block truncate text-sm font-semibold">{user.firstName || "Пользователь"}</span>
              <span className="mt-1 block truncate text-xs text-[#98a2b3]" title={user.email ?? undefined}>{user.email || "Email не указан"}</span>
            </span>
            <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-[#667085] ${collapsed ? "lg:hidden" : ""}`} />
          </button>
          {profileOpen && (
            <div
              id="sidebar-profile-menu"
              className={`absolute bottom-[calc(100%+10px)] z-50 w-60 rounded-2xl border border-[#eaecf0] bg-white p-2 shadow-xl ${collapsed ? "left-0 lg:left-[calc(100%+14px)] lg:bottom-0" : "left-0"}`}
            >
              <div className="border-b border-[#f2f4f7] px-3 py-2">
                <p className="truncate text-sm font-semibold">{user.firstName || "Пользователь"}</p>
                <p className="mt-1 truncate text-xs text-[#98a2b3]">{user.email || "Email не указан"}</p>
              </div>
              <a href={href("profile")} onClick={closeOverlays} className={`${detailClass} mt-1 flex items-center gap-3 text-[#344054] hover:bg-[#f7f5ff]`}>
                <UserRound aria-hidden="true" className="size-4" /> Мой профиль
              </a>
              <form action="/api/auth/logout" method="post" className="border-t border-[#f2f4f7] pt-1">
                <button type="submit" className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-[#b42318] hover:bg-[#fef3f2]">
                  <LogOut aria-hidden="true" className="size-4" /> Выйти
                </button>
              </form>
            </div>
          )}
        </div>
        {bots.length === 0 && <a href="/onboarding" title="Создать бота" className={`mt-3 flex items-center gap-2 rounded-xl bg-[#6d45f5] p-3 text-sm font-semibold text-white no-underline hover:bg-[#5934dc] ${collapsed ? "lg:justify-center" : ""}`}><Plus className="size-4" /><span className={collapsed ? "lg:hidden" : ""}>Создать бота</span></a>}
      </aside>
    </>
  );
}
