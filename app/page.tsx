"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, Bot, Box, Check, ChevronDown, CircleHelp, Home, Megaphone, MessageCircle, Package, Plus, Search, Settings, ShoppingBag, Sparkles, Store, Users, WalletCards, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type TelegramWebApp = { ready?: () => void; expand?: () => void };
type IconType = typeof Bot;
type Order = { id: string; customer: string; product: string; amount: string; time: string; status: "new" | "paid" | "ready" };
type StudioBot = { id: string; name: string; username: string; kind: string; status: "active" | "offline"; icon: IconType; tone: "violet" | "blue" | "orange"; metrics: { orders: string; revenue: string; messages: string }; orders: Order[] };

const bots: StudioBot[] = [
  { id: "delivery", name: "Доставка еды", username: "delivery_food_bot", kind: "Доставка", status: "active", icon: Package, tone: "violet", metrics: { orders: "24", revenue: "4 860 000 сум", messages: "86" }, orders: [
    { id: "#1248", customer: "Алишер К.", product: "Сет Филадельфия", amount: "189 000 сум", time: "14:32", status: "new" },
    { id: "#1247", customer: "Мадина Р.", product: "Пицца и напитки", amount: "142 000 сум", time: "14:18", status: "paid" },
    { id: "#1246", customer: "Тимур С.", product: "Комбо на двоих", amount: "218 000 сум", time: "13:56", status: "ready" },
    { id: "#1245", customer: "Азиза Н.", product: "Бургер классик", amount: "84 000 сум", time: "13:41", status: "paid" },
  ] },
  { id: "shop", name: "Интернет-магазин", username: "brand_shop_bot", kind: "Магазин", status: "active", icon: ShoppingBag, tone: "blue", metrics: { orders: "17", revenue: "7 240 000 сум", messages: "43" }, orders: [
    { id: "#938", customer: "Сабина М.", product: "Кроссовки Mono", amount: "690 000 сум", time: "14:26", status: "paid" },
    { id: "#937", customer: "Жасур Б.", product: "Худи Studio", amount: "420 000 сум", time: "13:52", status: "new" },
    { id: "#936", customer: "Лола Т.", product: "Сумка Mini", amount: "530 000 сум", time: "12:48", status: "ready" },
  ] },
  { id: "salon", name: "Салон красоты", username: "beauty_booking_bot", kind: "Запись на услуги", status: "active", icon: Sparkles, tone: "orange", metrics: { orders: "11", revenue: "2 310 000 сум", messages: "28" }, orders: [
    { id: "#B-72", customer: "Диана А.", product: "Окрашивание", amount: "480 000 сум", time: "15:00", status: "paid" },
    { id: "#B-71", customer: "Нигора У.", product: "Маникюр", amount: "180 000 сум", time: "14:30", status: "new" },
    { id: "#B-70", customer: "Камила Р.", product: "Стрижка", amount: "220 000 сум", time: "13:00", status: "ready" },
  ] },
];

const navigation = [
  { id: "home", label: "Главная", icon: Home },
  { id: "catalog", label: "Товары и услуги", icon: Box },
  { id: "orders", label: "Заказы", icon: WalletCards },
  { id: "clients", label: "Клиенты", icon: Users },
  { id: "mailings", label: "Рассылки", icon: Megaphone },
];

export default function HomePage() {
  const [activeBotId, setActiveBotId] = useState(bots[0].id);
  const [activeNav, setActiveNav] = useState("home");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const activeBot = bots.find((item) => item.id === activeBotId) ?? bots[0];

  useEffect(() => {
    const saved = window.localStorage.getItem("bot-studio-active-bot");
    if (saved && bots.some((item) => item.id === saved)) {
      queueMicrotask(() => setActiveBotId(saved));
    }
    const telegram = (window as typeof window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    telegram?.ready?.(); telegram?.expand?.();
    if (telegram) document.documentElement.dataset.telegram = "true";
    return () => { delete document.documentElement.dataset.telegram; };
  }, []);

  const selectBot = (id: string) => { setActiveBotId(id); window.localStorage.setItem("bot-studio-active-bot", id); };

  return (
    <main className="dashboard-shell">
      <div className="dashboard-app">
        <aside className="studio-sidebar">
          <Link className="brand" href="/"><span className="brand-mark"><Bot /></span><span>Bot Studio</span></Link>
          <div className="sidebar-caption">Рабочий бот</div>
          <DesktopBotSwitcher activeBot={activeBot} onSelect={selectBot} />
          <nav className="sidebar-nav" aria-label="Разделы кабинета">
            {navigation.map(({ id, label, icon: Icon }) => <button key={id} className={activeNav === id ? "active" : ""} onClick={() => setActiveNav(id)}><Icon /><span>{label}</span></button>)}
          </nav>
          <div className="sidebar-spacer" />
          <button className="sidebar-service"><CircleHelp /><span>Помощь</span></button>
          <button className="sidebar-service"><Settings /><span>Настройки</span></button>
          <Link className="sidebar-create" href="/onboarding"><Plus />Создать нового бота</Link>
        </aside>

        <section className="dashboard-main">
          <header className="mobile-topbar">
            <MobileBotSwitcher activeBot={activeBot} onSelect={selectBot} />
            <div className="mobile-top-actions"><button className="round-action" aria-label="Уведомления" onClick={() => setNotificationsOpen((value) => !value)}><Bell /><span className="notification-dot" /></button><button className="profile-action">A</button></div>
          </header>
          <header className="dashboard-header">
            <label className="global-search"><Search /><input placeholder="Поиск по кабинету" aria-label="Поиск по кабинету" /></label>
            <div className="header-actions"><div className="notification-wrap"><button className="round-action" aria-label="Уведомления" onClick={() => setNotificationsOpen((value) => !value)}><Bell /><span className="notification-dot" /></button>{notificationsOpen && <NotificationPopover onClose={() => setNotificationsOpen(false)} />}</div><button className="profile-action">A</button></div>
          </header>
          <div className="dashboard-content">
            <section className="dashboard-intro">
              <div><span className="context-label">{activeBot.kind}</span><h1>Добрый день, Алишер!</h1><p>Сегодня в <strong>{activeBot.name}</strong> всё работает стабильно.</p></div>
              <Link className="primary-action" href="/workspace"><Settings />Управлять бизнесом</Link>
            </section>
            <section className="metrics-grid" aria-label={`Основные показатели ${activeBot.name}`}>
              <MetricCard icon={WalletCards} value={activeBot.metrics.orders} label="заказа сегодня" note="+4 за последний час" />
              <MetricCard icon={Store} value={activeBot.metrics.revenue} label="выручка сегодня" note="Оплачено 82%" />
              <MetricCard icon={MessageCircle} value={activeBot.metrics.messages} label="новых сообщений" note="Средний ответ 1 мин" />
            </section>
            <section className="activity-panel">
              <div className="panel-heading"><div><span className="eyebrow">Сегодня</span><h2>Последние заказы</h2></div><button>Все заказы <ChevronDown /></button></div>
              <div className="orders-table" role="table"><div className="orders-head" role="row"><span>Заказ</span><span>Клиент</span><span>Позиция</span><span>Сумма</span><span>Статус</span><span>Время</span></div>{activeBot.orders.map((order) => <OrderRow key={order.id} order={order} />)}</div>
            </section>
          </div>
        </section>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Мобильная навигация">{navigation.slice(0, 4).map(({ id, label, icon: Icon }) => <button key={id} className={activeNav === id ? "active" : ""} onClick={() => setActiveNav(id)}><Icon /><span>{label}</span></button>)}</nav>
    </main>
  );
}

function DesktopBotSwitcher({ activeBot, onSelect }: { activeBot: StudioBot; onSelect: (id: string) => void }) {
  const Icon = activeBot.icon;
  return <DropdownMenu><DropdownMenuTrigger asChild><button className="bot-switcher"><span className={`switcher-avatar ${activeBot.tone}`}><Icon /></span><span className="switcher-copy"><strong>{activeBot.name}</strong><small>@{activeBot.username}</small></span><ChevronDown className="switcher-chevron" /></button></DropdownMenuTrigger><DropdownMenuContent className="bot-menu" align="start" sideOffset={8}><div className="bot-menu-label">Переключить бота</div><DropdownMenuRadioGroup value={activeBot.id} onValueChange={onSelect}>{bots.map((bot) => { const ItemIcon = bot.icon; return <DropdownMenuRadioItem className="bot-menu-item" key={bot.id} value={bot.id}><span className={`switcher-avatar ${bot.tone}`}><ItemIcon /></span><span className="switcher-copy"><strong>{bot.name}</strong><small>@{bot.username}</small></span>{bot.id === activeBot.id && <Check className="menu-check" />}</DropdownMenuRadioItem>; })}</DropdownMenuRadioGroup><DropdownMenuSeparator /><Link className="menu-create" href="/onboarding"><Plus />Создать нового бота</Link></DropdownMenuContent></DropdownMenu>;
}

function MobileBotSwitcher({ activeBot, onSelect }: { activeBot: StudioBot; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = activeBot.icon;
  return <>
    <button className="mobile-bot-switcher" onClick={() => setOpen(true)}><span className={`switcher-avatar ${activeBot.tone}`}><Icon /></span><span className="switcher-copy"><small>Текущий бот</small><strong>{activeBot.name}</strong></span><ChevronDown /></button>
    {open && createPortal(<div className="bot-sheet-layer" role="dialog" aria-modal="true" aria-label="Выберите бота" onClick={() => setOpen(false)}>
      <div className="bot-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-handle" /><div className="drawer-header"><h2>Выберите бота</h2><p>Показатели кабинета изменятся после выбора.</p></div>
        <div className="drawer-bots">{bots.map((bot) => { const ItemIcon = bot.icon; return <button className={bot.id === activeBot.id ? "selected" : ""} key={bot.id} onClick={() => { onSelect(bot.id); setOpen(false); }}><span className={`switcher-avatar ${bot.tone}`}><ItemIcon /></span><span className="switcher-copy"><strong>{bot.name}</strong><small>@{bot.username}</small></span>{bot.id === activeBot.id ? <Check /> : <span className="status-dot" />}</button>; })}<Link className="drawer-create" href="/onboarding"><Plus />Создать нового бота</Link></div>
      </div>
    </div>, document.body)}
  </>;
}

function MetricCard({ icon: Icon, value, label, note }: { icon: IconType; value: string; label: string; note: string }) { return <article className="metric-card"><span className="metric-icon"><Icon /></span><div><strong>{value}</strong><p>{label}</p><small>{note}</small></div></article>; }
function OrderRow({ order }: { order: Order }) { const label = order.status === "new" ? "Новый" : order.status === "paid" ? "Оплачен" : "Готов"; return <div className="order-row" role="row"><strong>{order.id}</strong><span>{order.customer}</span><span>{order.product}</span><span>{order.amount}</span><span className={`order-status ${order.status}`}><i />{label}</span><span>{order.time}</span></div>; }
function NotificationPopover({ onClose }: { onClose: () => void }) { return <div className="notification-popover"><button onClick={onClose} aria-label="Закрыть"><X /></button><strong>Новый заказ</strong><span>В выбранном боте появился новый заказ.</span></div>; }
