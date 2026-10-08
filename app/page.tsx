"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bell,
  Bot,
  ChevronRight,
  CircleHelp,
  Headphones,
  Home as HomeIcon,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  ShoppingBag,
  UserRound,
  Users,
  X,
} from "lucide-react";

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  colorScheme?: "light" | "dark";
  initData?: string;
  themeParams?: { bg_color?: string; text_color?: string };
};

type BotRow = {
  name: string;
  username: string;
  status: "active" | "offline";
  subscribers: string;
  messages: string;
  lastSeen: string;
  icon: typeof Bot;
  tone: string;
};

const bots: BotRow[] = [
  { name: "Поддержка 24/7", username: "support_bot", status: "active", subscribers: "5 230", messages: "312", lastSeen: "8 окт. 2026, 14:21", icon: Headphones, tone: "violet" },
  { name: "Новости бренда", username: "brand_news_bot", status: "active", subscribers: "4 812", messages: "198", lastSeen: "8 окт. 2026, 12:05", icon: Megaphone, tone: "blue" },
  { name: "Каталог товаров", username: "shop_catalog_bot", status: "offline", subscribers: "2 104", messages: "64", lastSeen: "8 окт. 2026, 09:17", icon: ShoppingBag, tone: "violet" },
  { name: "HR помощник", username: "hr_assistant_bot", status: "active", subscribers: "348", messages: "252", lastSeen: "8 окт. 2026, 15:03", icon: Users, tone: "violet" },
];

const navItems = [
  { id: "home", label: "Главная", icon: HomeIcon },
  { id: "bots", label: "Боты", icon: LayoutGrid },
  { id: "activity", label: "Активность", icon: Activity },
  { id: "help", label: "Помощь", icon: CircleHelp },
];

const mobileNavItems = [
  { id: "home", label: "Главная", icon: HomeIcon },
  { id: "bots", label: "Боты", icon: LayoutGrid },
  { id: "activity", label: "Активность", icon: Activity },
  { id: "profile", label: "Профиль", icon: UserRound },
];

export default function Home() {
  const [activeNav, setActiveNav] = useState("home");
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const telegram = (window as typeof window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    if (!telegram) return;
    telegram.ready?.();
    telegram.expand?.();
    document.documentElement.dataset.telegram = "true";
    return () => {
      delete document.documentElement.dataset.telegram;
    };
  }, []);

  const visibleBots = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return bots;
    return bots.filter((item) => `${item.name} ${item.username}`.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <main className="dashboard-shell">
      <div className="dashboard-app">
        <header className="dashboard-header">
          <Link className="brand" href="/" aria-label="Bot Studio — главная">
            <span className="brand-mark"><Bot aria-hidden="true" /></span>
            <span>Bot Studio</span>
          </Link>

          <nav className="desktop-nav" aria-label="Основная навигация">
            {navItems.map(({ id, label }) => (
              <button key={id} className={activeNav === id ? "active" : ""} onClick={() => setActiveNav(id)}>
                {label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <button className="round-action" aria-label="Поиск" onClick={() => document.getElementById("bot-search")?.focus()}><Search /></button>
            <div className="notification-wrap">
              <button className="round-action" aria-label="Уведомления" onClick={() => setNotificationsOpen((value) => !value)}>
                <Bell />
                <span className="notification-dot" />
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <button aria-label="Закрыть" onClick={() => setNotificationsOpen(false)}><X /></button>
                  <strong>Всё спокойно</strong>
                  <span>Новых уведомлений нет.</span>
                </div>
              )}
            </div>
            <button className="profile-action" aria-label="Профиль Алишера">A</button>
          </div>
        </header>

        <section className="dashboard-intro">
          <div>
            <h1>Добрый день, Алишер!</h1>
          </div>
          <Link className="create-bot" href="/studio"><Plus />Создать бота</Link>
        </section>

        <section className="desktop-metrics" aria-label="Основные показатели">
          <MetricCard icon={Bot} value="3" label="активных бота" />
          <MetricCard icon={Users} value="12 480" label="подписчиков" />
          <MetricCard icon={MessageCircle} value="826" label="сообщений сегодня" />
        </section>

        <section className="mobile-metrics" aria-label="Основные показатели">
          <MetricRow icon={Bot} label="Активные боты" value="3" />
          <MetricRow icon={Users} label="Подписчики" value="12 480" />
          <MetricRow icon={MessageCircle} label="Сообщения сегодня" value="826" />
        </section>

        <section className="bots-panel">
          <div className="bots-panel-head">
            <h2>Ваши боты</h2>
            <div className="bots-tools">
              <label className="search-field" htmlFor="bot-search">
                <Search />
                <input id="bot-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по ботам" />
                {query && <button onClick={() => setQuery("")} aria-label="Очистить поиск"><X /></button>}
              </label>
              <button className="all-bots" onClick={() => setQuery("")}>Все боты<ChevronRight /></button>
            </div>
          </div>

          <div className="bots-table" role="table" aria-label="Список ботов">
            <div className="bots-table-header" role="row">
              <span>Бот</span><span>Канал</span><span>Статус</span><span>Подписчики</span><span>Сообщений сегодня</span><span>Последняя активность</span><span />
            </div>
            <div className="bots-table-body">
              {visibleBots.map((bot) => <BotTableRow key={bot.username} bot={bot} />)}
              {!visibleBots.length && <div className="empty-search">Боты не найдены. Попробуйте другое название.</div>}
            </div>
          </div>
        </section>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Мобильная навигация">
        {mobileNavItems.map(({ id, label, icon: Icon }, index) => (
          index === 2 ? (
            <span className="mobile-nav-pair" key={id}>
              <Link className="mobile-create" href="/studio" aria-label="Создать бота"><Plus /></Link>
              <button className={activeNav === id ? "active" : ""} onClick={() => setActiveNav(id)}><Icon /><span>{label}</span></button>
            </span>
          ) : (
            <button key={id} className={activeNav === id ? "active" : ""} onClick={() => setActiveNav(id)}><Icon /><span>{label}</span></button>
          )
        ))}
      </nav>
    </main>
  );
}

function MetricCard({ icon: Icon, value, label }: { icon: typeof Bot; value: string; label: string }) {
  return <article className="metric-card"><span className="metric-icon"><Icon /></span><div><strong>{value}</strong><p>{label}</p></div></article>;
}

function MetricRow({ icon: Icon, value, label }: { icon: typeof Bot; value: string; label: string }) {
  return <div className="metric-row"><span className="metric-row-icon"><Icon /></span><span>{label}</span><strong>{value}</strong></div>;
}

function BotTableRow({ bot }: { bot: BotRow }) {
  const Icon = bot.icon;
  return (
    <Link className="bot-row" href="/studio" role="row">
      <span className="bot-identity"><span className={`bot-avatar ${bot.tone}`}><Icon /></span><span><strong>{bot.name}</strong><small>@{bot.username}</small></span></span>
      <span className="channel"><Send /><span>Telegram</span></span>
      <span className={`bot-status ${bot.status}`}><i />{bot.status === "active" ? "Активен" : "Отключён"}</span>
      <span className="numeric">{bot.subscribers}</span>
      <span className="numeric">{bot.messages}</span>
      <span className="last-seen">{bot.lastSeen}</span>
      <span className="row-action"><MoreVertical className="desktop-more" /><ChevronRight className="mobile-chevron" /></span>
    </Link>
  );
}
