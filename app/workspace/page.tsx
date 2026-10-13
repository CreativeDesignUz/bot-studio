"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bot, CircleCheck, Clock3, TrendingUp } from "lucide-react";
import { productTemplates, type BotTemplateId } from "@/lib/product/templates";
import { useWorkspace } from "./workspace-shell";
import CatalogManager from "./catalog-manager";
import OrderManager from "./order-manager";
import ServiceRequestManager from "./service-request-manager";
import CampaignManager from "./campaign-manager";
import InventoryManager from "./inventory-manager";
import { WorkspaceInsights } from "./insights";

const content = {
  store: { kpis: [["18", "заказов сегодня", "+12%"], ["7 240 000 сум", "выручка", "+18%"], ["34", "товара заканчиваются", "Проверить"]], rows: [["#1048", "Сабина М.", "Кроссовки Mono", "690 000 сум", "Оплачен"], ["#1047", "Жасур Б.", "Худи Studio", "420 000 сум", "Новый"], ["#1046", "Лола Т.", "Сумка Mini", "530 000 сум", "Собран"]], goal: "Поднять средний чек", tip: "Добавьте комплект кроссовки + носки со скидкой 10%. Покажем его в корзине.", action: "Создать комплект" },
  delivery: { kpis: [["24", "заказа сегодня", "+9%"], ["4 860 000 сум", "выручка", "+14%"], ["31 мин", "средняя доставка", "−4 мин"]], rows: [["#1248", "Алишер К.", "Сет Филадельфия", "189 000 сум", "Готовится"], ["#1247", "Мадина Р.", "Пицца и напитки", "142 000 сум", "В пути"], ["#1246", "Тимур С.", "Комбо на двоих", "218 000 сум", "Доставлен"]], goal: "Вернуть постоянных гостей", tip: "Отправьте промокод тем, кто сделал два заказа, но не возвращался 21 день.", action: "Запустить акцию" },
  service: { kpis: [["11", "записей сегодня", "+22%"], ["2 310 000 сум", "ожидаемая выручка", "+8%"], ["3", "свободных окна", "Заполнить"]], rows: [["15:00", "Диана А.", "Окрашивание", "480 000 сум", "Подтверждена"], ["14:30", "Нигора У.", "Маникюр", "180 000 сум", "Ожидает"], ["13:00", "Камила Р.", "Стрижка", "220 000 сум", "Завершена"]], goal: "Заполнить свободные окна", tip: "Предложите клиентам поблизости скидку 15% на три свободных времени сегодня.", action: "Создать предложение" },
} as const;

export default function WorkspacePage() {
  const { bot } = useWorkspace();
  const query = useSearchParams();
  if (!bot) return <main className="grid min-h-[80vh] place-items-center p-5"><section className="max-w-lg rounded-3xl border bg-white p-8 text-center"><Bot className="mx-auto size-12 text-[#6541f5]"/><h1 className="mt-5 text-2xl font-semibold">Создайте первого бота</h1><p className="mt-3 text-sm text-[#667085]">Выберите шаблон и настройте приложение для своего бизнеса.</p><Link href="/onboarding" className="mt-6 inline-flex rounded-xl bg-[#101828] px-5 py-3 text-sm font-semibold text-white">Начать создание</Link></section></main>;
  const template = productTemplates[bot.template_type];
  const requested = query.get("section") ?? "overview";
  const section = ["overview", "catalog", "orders", "customers", "inventory", "marketing", "analytics"].includes(requested) ? requested : "overview";
  const title = section === "catalog" ? bot.template_type === "delivery" ? "Блюда" : bot.template_type === "service" ? "Услуги" : "Товары" : ({ overview: "Главная", orders: "Заказы", customers: "Клиенты", inventory: "Склад", marketing: "Акции", analytics: "Отчёты" }[section] ?? "Главная");
  const metrics = bot.metrics;
  const page = { ...content[bot.template_type], kpis: [[String(metrics.ordersToday), "заказов сегодня", "Сегодня"], [`${Math.round(metrics.revenueTodayMinor/100).toLocaleString("ru-RU")} сум`, "выручка сегодня", "Факт"], [String(metrics.catalogItems), "позиций в каталоге", "Каталог"]], rows: metrics.recentOrders.map(order => [`#${order.id.slice(0,6)}`, order.customer_name || "Клиент", "Заказ", `${Math.round(order.total_minor/100).toLocaleString("ru-RU")} сум`, order.status]) };
  return <main className="p-4 sm:p-7 lg:p-9">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs font-semibold text-[#6d45f5]">{template.label} · {bot.name}</p><h1 className="text-3xl font-semibold">{title}</h1></div><Link href="/onboarding" className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold">Создать бота</Link></header>
    {section === "catalog" ? <CatalogManager key={bot.id} botId={bot.id} type={bot.template_type}/> : section === "orders" ? bot.template_type === "service" ? <ServiceRequestManager key={bot.id} botId={bot.id}/> : <OrderManager key={bot.id} botId={bot.id}/> : section === "customers" ? <WorkspaceInsights key={bot.id} botId={bot.id} view="customers"/> : section === "inventory" ? <InventoryManager key={bot.id} botId={bot.id} type={bot.template_type}/> : section === "marketing" ? <CampaignManager key={bot.id} botId={bot.id}/> : section === "analytics" ? <WorkspaceInsights key={bot.id} botId={bot.id} view="analytics"/> : <Overview page={page} botType={bot.template_type}/>}
  </main>;
}

function Overview({ page, botType }: { page: {kpis:string[][];rows:string[][];goal:string;tip:string;action:string}; botType: BotTemplateId }) {
  const { bot } = useWorkspace();
  return <div className="space-y-5">
    <section className="grid gap-4 md:grid-cols-3">{page.kpis.map(([value, label, delta], index) => <article key={label} className="rounded-[20px] border border-[#e4e7ec] bg-white p-5"><div className="flex items-start justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#f0ecff] text-[#6d45f5]">{index === 0 ? <CircleCheck className="size-[18px]" /> : index === 1 ? <TrendingUp className="size-[18px]" /> : <Clock3 className="size-[18px]" />}</span><span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[11px] font-semibold text-[#027a48]">{delta}</span></div><strong className="mt-5 block text-[clamp(1.35rem,2vw,1.75rem)] tracking-[-.04em]">{value}</strong><span className="mt-1 block text-sm text-[#667085]">{label}</span></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.8fr)]"><article className="overflow-hidden rounded-[22px] border border-[#e4e7ec] bg-white"><div className="flex items-center justify-between border-b border-[#eaecf0] p-5"><div><h2 className="font-semibold">{botType === "service" ? "Ближайшие записи" : "Последние заказы"}</h2><p className="mt-1 text-xs text-[#98a2b3]">Данные из вашего бота</p></div><Link href={`/workspace?bot=${encodeURIComponent(bot?.id ?? "")}&section=orders`} className="text-sm font-semibold text-[#5934dc]">Открыть все</Link></div><div className="divide-y divide-[#eaecf0]">{page.rows.length?page.rows.map((row) => <div key={row[0]} className="grid grid-cols-[70px_minmax(95px,1fr)_minmax(130px,1.4fr)] items-center gap-3 px-5 py-4 text-sm sm:grid-cols-[80px_1fr_1.5fr_120px_110px]"><strong>{row[0]}</strong><span>{row[1]}</span><span className="truncate text-[#667085]">{row[2]}</span><span className="hidden sm:block">{row[3]}</span><span className="hidden w-fit rounded-full bg-[#f2f4f7] px-2.5 py-1 text-xs font-medium sm:block">{row[4]}</span></div>):<div className="p-8 text-center"><strong className="text-sm">Заказов пока нет</strong><p className="mt-1 text-xs text-[#98a2b3]">Они появятся здесь после запуска бота.</p></div>}</div></article><article className="rounded-[22px] bg-[#17132d] p-6 text-white"><span className="text-xs font-semibold uppercase tracking-[.14em] text-[#b9a8ff]">Идея для роста</span><h2 className="mt-4 text-xl font-semibold">{page.goal}</h2><p className="mt-3 text-sm leading-6 text-[#d0cbe7]">{page.tip}</p><Link href={`/workspace?bot=${encodeURIComponent(bot?.id ?? "")}&section=marketing`} className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#7654f6] px-4 text-sm font-semibold">{page.action}</Link></article></section>
  </div>;
}
