"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Bot, ChevronDown, CircleCheck, Clock3, MoreHorizontal, Plus, Search, Settings, TrendingUp } from "lucide-react";
import { BotTemplateId, productTemplates } from "@/lib/product/templates";

const demoBots: { id: string; name: string; type: BotTemplateId; username: string }[] = [
  { id: "shop", name: "Mono Store", type: "store", username: "mono_store_bot" },
  { id: "food", name: "Osh Express", type: "delivery", username: "osh_express_bot" },
  { id: "beauty", name: "Aura Beauty", type: "service", username: "aura_booking_bot" },
];

const content = {
  store: { kpis: [["18", "заказов сегодня", "+12%"], ["7 240 000 сум", "выручка", "+18%"], ["34", "товара заканчиваются", "Проверить"]], rows: [["#1048", "Сабина М.", "Кроссовки Mono", "690 000 сум", "Оплачен"], ["#1047", "Жасур Б.", "Худи Studio", "420 000 сум", "Новый"], ["#1046", "Лола Т.", "Сумка Mini", "530 000 сум", "Собран"]], goal: "Поднять средний чек", tip: "Добавьте комплект кроссовки + носки со скидкой 10%. Покажем его в корзине.", action: "Создать комплект" },
  delivery: { kpis: [["24", "заказа сегодня", "+9%"], ["4 860 000 сум", "выручка", "+14%"], ["31 мин", "средняя доставка", "−4 мин"]], rows: [["#1248", "Алишер К.", "Сет Филадельфия", "189 000 сум", "Готовится"], ["#1247", "Мадина Р.", "Пицца и напитки", "142 000 сум", "В пути"], ["#1246", "Тимур С.", "Комбо на двоих", "218 000 сум", "Доставлен"]], goal: "Вернуть постоянных гостей", tip: "Отправьте промокод тем, кто сделал два заказа, но не возвращался 21 день.", action: "Запустить акцию" },
  service: { kpis: [["11", "записей сегодня", "+22%"], ["2 310 000 сум", "ожидаемая выручка", "+8%"], ["3", "свободных окна", "Заполнить"]], rows: [["15:00", "Диана А.", "Окрашивание", "480 000 сум", "Подтверждена"], ["14:30", "Нигора У.", "Маникюр", "180 000 сум", "Ожидает"], ["13:00", "Камила Р.", "Стрижка", "220 000 сум", "Завершена"]], goal: "Заполнить свободные окна", tip: "Предложите клиентам поблизости скидку 15% на три свободных времени сегодня.", action: "Создать предложение" },
} as const;

export default function WorkspacePage() {
  const [bots, setBots] = useState<typeof demoBots>([]);
  const [loading, setLoading] = useState(true);
  const [botId, setBotId] = useState("");
  const [section, setSection] = useState("overview");
  const bot = bots.find((item) => item.id === botId) ?? bots[0] ?? demoBots[0];
  const template = productTemplates[bot.type];
  const page = content[bot.type];
  const currentSection = useMemo(() => template.modules.some((item) => item.id === section) ? section : "overview", [section, template]);
  const sectionName = template.modules.find((item) => item.id === currentSection)?.label ?? "Обзор";

  useEffect(() => {
    const telegram = (window as typeof window & { Telegram?: { WebApp?: { ready?:()=>void; expand?:()=>void; setHeaderColor?:(color:string)=>void; setBackgroundColor?:(color:string)=>void } } }).Telegram?.WebApp;
    telegram?.ready?.(); telegram?.expand?.(); telegram?.setHeaderColor?.("#ffffff"); telegram?.setBackgroundColor?.("#f4f6f8");
    if (telegram) document.documentElement.dataset.telegram = "true";
    const initData=(telegram as {initData?:string}|undefined)?.initData??"";
    fetch("/api/workspace",{headers:{"x-telegram-init-data":initData}}).then(response=>response.ok?response.json():Promise.reject()).then((result:{bots:{id:string;name:string;username:string|null;template_type:BotTemplateId}[]})=>{const loaded=result.bots.map(item=>({id:item.id,name:item.name,type:item.template_type,username:item.username??`studio_${item.id.slice(0,8)}_bot`}));setBots(loaded);const requested=new URLSearchParams(location.search).get("bot");setBotId(loaded.some(item=>item.id===requested)?requested!:loaded[0]?.id??"");}).finally(()=>setLoading(false));
    return () => { delete document.documentElement.dataset.telegram; };
  }, []);

  function switchBot(nextId: string) {
    const next = bots.find((item) => item.id === nextId);
    setBotId(nextId);
    if (next && !productTemplates[next.type].modules.some((item) => item.id === section)) setSection("overview");
  }

  if(loading)return <main className="grid min-h-screen place-items-center bg-[#f4f6f8] text-sm text-[#667085]">Загружаем кабинет…</main>;
  if(!bots.length)return <main className="grid min-h-screen place-items-center bg-[#f4f6f8] p-5 text-[#101828]"><section className="w-full max-w-lg rounded-[24px] border border-[#e4e7ec] bg-white p-8 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f0ecff] text-[#6d45f5]"><Bot/></span><h1 className="mt-5 text-2xl font-semibold">Создайте первого бота</h1><p className="mt-2 text-sm leading-6 text-[#667085]">Выберите готовый тип бизнеса, добавьте первый товар или услугу — и сразу увидите Mini App.</p><Link href="/onboarding" className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#101828] px-5 text-sm font-semibold text-white no-underline">Начать создание</Link></section></main>;
  return <main className="min-h-screen bg-[#f4f6f8] text-[#101828]">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="hidden w-[248px] shrink-0 border-r border-[#e4e7ec] bg-white p-4 lg:flex lg:flex-col">
        <Link href="/" className="mb-7 flex items-center gap-2.5 px-2 py-2 font-semibold text-[#101828] no-underline"><span className="grid size-9 place-items-center rounded-xl bg-[#6d45f5] text-white"><Bot className="size-5" /></span>Bot Studio</Link>
        <label className="mb-6 block"><span className="mb-2 block px-2 text-[11px] font-semibold uppercase tracking-[.14em] text-[#98a2b3]">Рабочий бот</span><span className="relative block"><select value={botId} onChange={(event) => switchBot(event.target.value)} className="h-14 w-full appearance-none rounded-2xl border border-[#e4e7ec] bg-[#f9fafb] px-3 pr-9 text-sm font-semibold outline-none focus:border-[#6d45f5]">{bots.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" /></span></label>
        <nav className="space-y-1">{template.modules.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setSection(id)} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${currentSection === id ? "bg-[#f0ecff] text-[#5934dc]" : "text-[#667085] hover:bg-[#f9fafb]"}`}><Icon className="size-[18px]" />{label}</button>)}</nav>
        <div className="mt-auto space-y-1 border-t border-[#eaecf0] pt-4"><Link href="/studio" className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#667085] no-underline hover:bg-[#f9fafb]"><Settings className="size-[18px]" />Настройки бота</Link><Link href="/onboarding" className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#5934dc] no-underline hover:bg-[#f0ecff]"><Plus className="size-[18px]" />Создать ещё бота</Link></div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-[#e4e7ec] bg-white/90 px-4 backdrop-blur-xl sm:px-7">
          <label className="relative min-w-0 flex-1 lg:hidden"><select value={botId} onChange={(event) => switchBot(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[#e4e7ec] bg-white px-3 pr-9 text-sm font-semibold">{bots.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" /></label>
          <label className="relative hidden max-w-md flex-1 lg:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#98a2b3]" /><input className="h-11 w-full rounded-xl border border-[#e4e7ec] bg-[#f9fafb] pl-10 pr-4 text-sm outline-none focus:border-[#6d45f5]" placeholder="Поиск по кабинету" /></label>
          <button className="ml-auto grid size-11 place-items-center rounded-xl border border-[#e4e7ec] bg-white"><Bell className="size-[18px]" /></button><span className="grid size-10 place-items-center rounded-full bg-[#eee9ff] text-sm font-semibold text-[#5934dc]">A</span>
        </header>
        <div className="border-b border-[#e4e7ec] bg-white px-4 py-2 lg:hidden"><div className="flex gap-1 overflow-x-auto">{template.modules.map(({ id, label }) => <button key={id} onClick={() => setSection(id)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${currentSection === id ? "bg-[#101828] text-white" : "bg-[#f2f4f7] text-[#667085]"}`}>{label}</button>)}</div></div>
        <div className="p-4 sm:p-7 lg:p-9">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold text-[#6d45f5]">{template.label} · @{bot.username}</p><h1 className="text-2xl font-semibold tracking-[-.035em] sm:text-3xl">{sectionName}</h1><p className="mt-1.5 text-sm text-[#667085]">{currentSection === "overview" ? "Главное за сегодня и следующий шаг для роста." : `Управляйте разделом «${sectionName}» без перехода в другие сервисы.`}</p></div><button className="flex h-11 items-center gap-2 rounded-xl bg-[#101828] px-4 text-sm font-semibold text-white"><Plus className="size-4" />Добавить {template.itemLabel}</button></div>
          {bot.type === "delivery" && currentSection === "catalog" ? <RestaurantMenuEntry /> : currentSection === "overview" ? <Overview page={page} botType={bot.type} /> : <ModuleView name={sectionName} itemLabel={template.itemLabel} botType={bot.type} />}
        </div>
      </section>
    </div>
  </main>;
}

function RestaurantMenuEntry(){return <section className="rounded-[22px] border border-[#e4e7ec] bg-white p-6 sm:p-8"><span className="grid size-12 place-items-center rounded-2xl bg-[#fff0e8] text-[#ef6820]"><Plus/></span><h2 className="mt-5 text-xl font-semibold">Соберите меню ресторана</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#667085]">Импортируйте Excel-файл или добавляйте категории, подкатегории и блюда вручную. Перед публикацией система покажет ошибки.</p><Link href="/workspace/restaurant" className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#101828] px-4 text-sm font-semibold text-white no-underline">Открыть редактор меню</Link></section>}

function Overview({ page, botType }: { page: typeof content[BotTemplateId]; botType: BotTemplateId }) {
  return <div className="space-y-5">
    <section className="grid gap-4 md:grid-cols-3">{page.kpis.map(([value, label, delta], index) => <article key={label} className="rounded-[20px] border border-[#e4e7ec] bg-white p-5"><div className="flex items-start justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#f0ecff] text-[#6d45f5]">{index === 0 ? <CircleCheck className="size-[18px]" /> : index === 1 ? <TrendingUp className="size-[18px]" /> : <Clock3 className="size-[18px]" />}</span><span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[11px] font-semibold text-[#027a48]">{delta}</span></div><strong className="mt-5 block text-[clamp(1.35rem,2vw,1.75rem)] tracking-[-.04em]">{value}</strong><span className="mt-1 block text-sm text-[#667085]">{label}</span></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.8fr)]"><article className="overflow-hidden rounded-[22px] border border-[#e4e7ec] bg-white"><div className="flex items-center justify-between border-b border-[#eaecf0] p-5"><div><h2 className="font-semibold">{botType === "service" ? "Ближайшие записи" : "Последние заказы"}</h2><p className="mt-1 text-xs text-[#98a2b3]">Обновлено только что</p></div><button className="text-sm font-semibold text-[#5934dc]">Открыть все</button></div><div className="divide-y divide-[#eaecf0]">{page.rows.map((row) => <div key={row[0]} className="grid grid-cols-[70px_minmax(95px,1fr)_minmax(130px,1.4fr)] items-center gap-3 px-5 py-4 text-sm sm:grid-cols-[80px_1fr_1.5fr_120px_110px]"><strong>{row[0]}</strong><span>{row[1]}</span><span className="truncate text-[#667085]">{row[2]}</span><span className="hidden sm:block">{row[3]}</span><span className="hidden w-fit rounded-full bg-[#f2f4f7] px-2.5 py-1 text-xs font-medium sm:block">{row[4]}</span></div>)}</div></article><article className="rounded-[22px] bg-[#17132d] p-6 text-white"><span className="text-xs font-semibold uppercase tracking-[.14em] text-[#b9a8ff]">Идея для роста</span><h2 className="mt-4 text-xl font-semibold">{page.goal}</h2><p className="mt-3 text-sm leading-6 text-[#d0cbe7]">{page.tip}</p><button className="mt-6 h-11 rounded-xl bg-[#7654f6] px-4 text-sm font-semibold">{page.action}</button></article></section>
  </div>;
}

function ModuleView({ name, itemLabel, botType }: { name: string; itemLabel: string; botType: BotTemplateId }) {
  const empty = ["Поддержка", "Отзывы", "Отчёты"].includes(name);
  return <section className="overflow-hidden rounded-[22px] border border-[#e4e7ec] bg-white"><div className="flex items-center gap-3 border-b border-[#eaecf0] p-5"><label className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#98a2b3]" /><input className="h-10 w-full rounded-xl border border-[#e4e7ec] pl-10 pr-3 text-sm" placeholder={`Поиск: ${name.toLowerCase()}`} /></label><button className="grid size-10 place-items-center rounded-xl border border-[#e4e7ec]"><MoreHorizontal className="size-5" /></button></div>{empty ? <div className="grid min-h-[360px] place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f0ecff] text-[#6d45f5]"><TrendingUp /></span><h2 className="mt-4 text-lg font-semibold">Данные появятся после первых операций</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#667085]">Раздел «{name}» уже подключён к структуре {productTemplates[botType].label.toLowerCase()}.</p></div></div> : <div className="divide-y divide-[#eaecf0]">{[1,2,3,4].map((index) => <div key={index} className="flex items-center gap-4 p-5"><span className="grid size-11 place-items-center rounded-xl bg-[#f2f4f7] font-semibold text-[#475467]">{index}</span><div className="min-w-0 flex-1"><strong className="block text-sm">{name}: запись {index}</strong><span className="mt-1 block truncate text-xs text-[#98a2b3]">Реальные поля и действия сохраняются в Supabase</span></div><span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-xs font-medium text-[#027a48]">Активен</span></div>)}</div>}<div className="border-t border-[#eaecf0] bg-[#f9fafb] px-5 py-4 text-xs text-[#667085]">Следующий шаг: добавить первый {itemLabel} и проверить клиентский путь в Telegram.</div></section>;
}
