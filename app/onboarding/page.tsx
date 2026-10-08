"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bot, Check, ChevronDown, CircleDollarSign, Clock3, CreditCard, ImagePlus, MapPin, Package, Palette, Plus, Send, Settings2, ShoppingBag, Sparkles, Store, Users, UtensilsCrossed } from "lucide-react";

type TemplateId = "delivery" | "store" | "service";
type Stage = "type" | "empty" | "item" | "done";

type Template = {
  id: TemplateId;
  title: string;
  description: string;
  icon: typeof Bot;
  item: string;
  itemPlural: string;
  firstAction: string;
  nameLabel: string;
  namePlaceholder: string;
  priceLabel: string;
  capabilities: { icon: typeof Bot; title: string; text: string }[];
};

const templates: Template[] = [
  { id:"delivery", title:"Доставка еды", description:"Меню, корзина, адрес и статусы доставки.", icon:UtensilsCrossed, item:"блюдо", itemPlural:"блюда", firstAction:"Добавить первое блюдо", nameLabel:"Название блюда", namePlaceholder:"Например, Плов праздничный", priceLabel:"Цена", capabilities:[
    { icon:UtensilsCrossed, title:"Меню", text:"Категории, фото и варианты блюда" },
    { icon:MapPin, title:"Доставка", text:"Зоны, адрес клиента и стоимость" },
    { icon:CreditCard, title:"Оплата", text:"Онлайн или наличными курьеру" },
  ] },
  { id:"store", title:"Интернет-магазин", description:"Каталог товаров, остатки, заказы и оплата.", icon:ShoppingBag, item:"товар", itemPlural:"товары", firstAction:"Добавить первый товар", nameLabel:"Название товара", namePlaceholder:"Например, Кроссовки Mono", priceLabel:"Цена", capabilities:[
    { icon:Package, title:"Каталог", text:"Товары, категории и остатки" },
    { icon:Store, title:"Заказы", text:"Корзина и статусы выполнения" },
    { icon:CircleDollarSign, title:"Оплата", text:"Платёжные сервисы и наличные" },
  ] },
  { id:"service", title:"Услуги и запись", description:"Услуги, специалисты, расписание и бронь.", icon:Sparkles, item:"услугу", itemPlural:"услуги", firstAction:"Добавить первую услугу", nameLabel:"Название услуги", namePlaceholder:"Например, Консультация стилиста", priceLabel:"Стоимость", capabilities:[
    { icon:Sparkles, title:"Услуги", text:"Описание, длительность и цена" },
    { icon:Users, title:"Специалисты", text:"Сотрудники и их расписание" },
    { icon:Clock3, title:"Онлайн-запись", text:"Свободное время и напоминания" },
  ] },
];

export default function OnboardingPage() {
  const [stage, setStage] = useState<Stage>("type");
  const [templateId, setTemplateId] = useState<TemplateId>("delivery");
  const [botName, setBotName] = useState("Новый бот");
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [botId, setBotId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const template = useMemo(() => templates.find((item) => item.id === templateId) ?? templates[0], [templateId]);
  const TemplateIcon = template.icon;
  const progress = stage === "type" ? 20 : stage === "empty" ? 45 : stage === "item" ? 75 : 100;

  useEffect(() => {
    document.documentElement.dataset.onboardingHydrated = "true";
    const telegram = (window as typeof window & { Telegram?: { WebApp?: { ready?:()=>void; expand?:()=>void; setHeaderColor?:(color:string)=>void; setBackgroundColor?:(color:string)=>void } } }).Telegram?.WebApp;
    telegram?.ready?.(); telegram?.expand?.(); telegram?.setHeaderColor?.("#ffffff"); telegram?.setBackgroundColor?.("#f5f6f8");
    if (telegram) document.documentElement.dataset.telegram = "true";
    return () => { delete document.documentElement.dataset.onboardingHydrated; delete document.documentElement.dataset.telegram; };
  }, []);

  const resetItem = () => { setItemName(""); setPrice(""); setDescription(""); setStage("empty"); };

  const saveFirstItem = async () => {
    const telegram = (window as typeof window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    setSaveState("saving");
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        initData: telegram?.initData,
        botName,
        templateType: template.id,
        item: { name: itemName, description, priceMinor: price ? Number(price) * 100 : undefined },
      }),
    });
    if (!response.ok) { setSaveState("error"); return; }
    const result = await response.json() as { bot?: { id?: string } };
    if (result.bot?.id) { localStorage.setItem("botStudioBotId", result.bot.id); setBotId(result.bot.id); }
    setSaveState("idle");
    setStage("done");
  };

  return <main className="onboarding-shell">
    <div className="onboarding-app">
      <aside className="onboarding-sidebar">
        <Link href="/" className="brand"><span className="brand-mark"><Bot /></span><span>Bot Studio</span></Link>
        <div className="onboarding-progress"><div><span>Запуск бота</span><strong>{progress}%</strong></div><i><b style={{width:`${progress}%`}} /></i></div>
        <nav className="onboarding-steps">
          <Step number="1" label="Тип бота" active={stage === "type"} done={stage !== "type"} />
          <Step number="2" label="Возможности" active={stage === "empty"} done={stage === "item" || stage === "done"} />
          <Step number="3" label={`Первый ${template.item}`} active={stage === "item"} done={stage === "done"} />
          <Step number="4" label="Готов к запуску" active={stage === "done"} done={false} />
        </nav>
        <div className="onboarding-tip"><Sparkles /><p><strong>Не нужно настраивать всё сразу.</strong> Для запуска достаточно первого элемента — остальное добавите позже.</p></div>
      </aside>

      <section className="onboarding-main">
        <header className="onboarding-header">
          <Link href="/" className="back-link"><ArrowLeft />Назад в кабинет</Link>
          <div className="onboarding-bot-chip"><span className="switcher-avatar violet"><TemplateIcon /></span><span><small>Новый бот</small><strong>{botName}</strong></span><ChevronDown /></div>
        </header>

        <div className="onboarding-content">
          {stage === "type" && <TypeStep selected={templateId} onSelect={setTemplateId} botName={botName} setBotName={setBotName} onNext={() => setStage("empty")} />}
          {stage === "empty" && <EmptyStep template={template} botName={botName} onBack={() => setStage("type")} onNext={() => setStage("item")} />}
          {stage === "item" && <ItemStep template={template} itemName={itemName} setItemName={setItemName} price={price} setPrice={setPrice} description={description} setDescription={setDescription} onBack={() => setStage("empty")} onSave={saveFirstItem} saveState={saveState} />}
          {stage === "done" && <DoneStep template={template} botName={botName} itemName={itemName} price={price} botId={botId} onAdd={resetItem} />}
        </div>
      </section>
    </div>
  </main>;
}

function TypeStep({ selected, onSelect, botName, setBotName, onNext }: { selected:TemplateId; onSelect:(id:TemplateId)=>void; botName:string; setBotName:(value:string)=>void; onNext:()=>void }) {
  return <div className="flow-step"><div className="flow-heading"><span>Шаг 1 из 4</span><h1>Чем будет заниматься бот?</h1><p>Выберем готовую структуру. Её можно изменить после запуска.</p></div>
    <label className="bot-name-field"><span>Название проекта</span><input value={botName} onChange={(event) => setBotName(event.target.value)} placeholder="Название бота" /></label>
    <div className="template-grid">{templates.map((template) => { const Icon = template.icon; return <button key={template.id} className={selected === template.id ? "selected" : ""} onClick={() => onSelect(template.id)}><span className="template-icon"><Icon /></span><span><strong>{template.title}</strong><small>{template.description}</small></span>{selected === template.id && <Check className="template-check" />}</button>; })}</div>
    <div className="flow-actions"><span /><button className="flow-primary" disabled={!botName.trim()} onClick={onNext}>Создать структуру <ArrowRight /></button></div>
  </div>;
}

function EmptyStep({ template, botName, onBack, onNext }: { template:Template; botName:string; onBack:()=>void; onNext:()=>void }) {
  const Icon = template.icon;
  return <div className="flow-step"><div className="flow-heading"><span>Шаг 2 из 4</span><h1>{botName} пока пуст</h1><p>Мы подготовили структуру «{template.title}». Вот что уже умеет ваш будущий бот.</p></div>
    <div className="empty-preview"><div className="empty-visual"><span><Icon /></span><i /><i /><i /></div><div><span className="ready-badge"><Check />Основа готова</span><h2>Добавьте {template.item}</h2><p>После первого элемента появится каталог, а вы сможете открыть превью и проверить путь клиента.</p></div></div>
    <div className="capability-grid">{template.capabilities.map(({icon:CapabilityIcon,title,text}) => <article key={title}><span><CapabilityIcon /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
    <div className="starter-checklist"><div><Palette /><span><strong>Дизайн</strong><small>Цвет и логотип можно настроить позже</small></span><Check /></div><div><Settings2 /><span><strong>Основные настройки</strong><small>Созданы автоматически по шаблону</small></span><Check /></div><div><Send /><span><strong>Telegram</strong><small>Подключим после наполнения</small></span><span className="later">Позже</span></div></div>
    <div className="flow-actions"><button className="flow-secondary" onClick={onBack}><ArrowLeft />Назад</button><button className="flow-primary" onClick={onNext}><Plus />{template.firstAction}</button></div>
  </div>;
}

function ItemStep({ template, itemName, setItemName, price, setPrice, description, setDescription, onBack, onSave, saveState }: { template:Template; itemName:string; setItemName:(v:string)=>void; price:string; setPrice:(v:string)=>void; description:string; setDescription:(v:string)=>void; onBack:()=>void; onSave:()=>void; saveState:"idle"|"saving"|"error" }) {
  return <div className="flow-step"><div className="flow-heading"><span>Шаг 3 из 4</span><h1>{template.firstAction}</h1><p>Только основные поля. Фото и дополнительные настройки можно добавить позже.</p></div>
    <div className="item-editor"><label className="item-photo"><ImagePlus /><strong>Добавить фото</strong><small>JPG или PNG до 5 МБ</small><input className="sr-only" type="file" accept="image/*" /></label><div className="item-fields"><label><span>{template.nameLabel}</span><input autoFocus value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={template.namePlaceholder} /></label><label><span>{template.priceLabel}</span><div className="price-input"><input inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value.replace(/\D/g,""))} placeholder="0" /><b>сум</b></div></label><label className="full"><span>Короткое описание</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что важно знать клиенту?" /></label></div></div>
    {saveState === "error" && <p className="save-error">Не удалось сохранить в базе. Проверьте подключение Supabase и повторите.</p>}
    <div className="flow-actions"><button className="flow-secondary" onClick={onBack}><ArrowLeft />Назад</button><button className="flow-primary" disabled={!itemName.trim() || saveState === "saving"} onClick={onSave}>{saveState === "saving" ? "Сохраняю…" : `Сохранить ${template.item}`} {saveState !== "saving" && <ArrowRight />}</button></div>
  </div>;
}

function DoneStep({ template, botName, itemName, price, botId, onAdd }: { template:Template; botName:string; itemName:string; price:string; botId:string|null; onAdd:()=>void }) {
  return <div className="flow-step done-step"><div className="success-mark"><Check /></div><div className="flow-heading"><span>Первый результат</span><h1>Бот больше не пуст</h1><p>{itemName} добавлен в «{botName}». Теперь можно открыть клиентское превью или продолжить наполнение.</p></div>
    <div className="first-item-card"><span className="first-item-image"><Package /></span><div><small>{template.item}</small><strong>{itemName}</strong><p>{price ? `${Number(price).toLocaleString("ru-RU")} сум` : "Цена не указана"}</p></div><span className="published-badge">Активен</span></div>
    <div className="launch-actions"><button className="flow-secondary" onClick={onAdd}><Plus />Добавить ещё</button><Link className="flow-primary" href={botId?`/workspace/builder?bot=${botId}`:"/workspace/builder"}>Настроить и посмотреть превью <ArrowRight /></Link></div>
  </div>;
}

function Step({ number, label, active, done }: { number:string; label:string; active:boolean; done:boolean }) { return <div className={`${active ? "active" : ""} ${done ? "done" : ""}`}><span>{done ? <Check /> : number}</span><strong>{label}</strong></div>; }
