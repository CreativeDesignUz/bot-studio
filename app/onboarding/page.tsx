"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, Check, ChevronDown, CircleDollarSign, Clock3, CreditCard, ImagePlus, MapPin, Package, Palette, Plus, ShoppingBag, Sparkles, Store, Users, UtensilsCrossed } from "lucide-react";

type TemplateId = "delivery" | "store" | "service";
type Stage = "details" | "type" | "created" | "item" | "done";
type SaveState = "idle" | "saving" | "error";

type Template = {
  id: TemplateId;
  title: string;
  description: string;
  icon: typeof Bot;
  item: string;
  firstAction: string;
  nameLabel: string;
  namePlaceholder: string;
  priceLabel: string;
  capabilities: { icon: typeof Bot; title: string; text: string }[];
};

const templates: Template[] = [
  { id:"delivery", title:"Доставка еды", description:"Меню, корзина, адрес и статусы доставки.", icon:UtensilsCrossed, item:"блюдо", firstAction:"Добавить первое блюдо", nameLabel:"Название блюда", namePlaceholder:"Например, Плов праздничный", priceLabel:"Цена", capabilities:[
    { icon:UtensilsCrossed, title:"Меню", text:"Категории, фото и варианты блюда" },
    { icon:MapPin, title:"Доставка", text:"Зоны, адрес клиента и стоимость" },
    { icon:CreditCard, title:"Оплата", text:"Онлайн или наличными курьеру" },
  ] },
  { id:"store", title:"Интернет-магазин", description:"Каталог товаров, остатки, заказы и оплата.", icon:ShoppingBag, item:"товар", firstAction:"Добавить первый товар", nameLabel:"Название товара", namePlaceholder:"Например, Кроссовки Mono", priceLabel:"Цена", capabilities:[
    { icon:Package, title:"Каталог", text:"Товары, категории и остатки" },
    { icon:Store, title:"Заказы", text:"Корзина и статусы выполнения" },
    { icon:CircleDollarSign, title:"Оплата", text:"Платёжные сервисы и наличные" },
  ] },
  { id:"service", title:"Услуги и запись", description:"Услуги, специалисты, расписание и бронь.", icon:Sparkles, item:"услугу", firstAction:"Добавить первую услугу", nameLabel:"Название услуги", namePlaceholder:"Например, Консультация стилиста", priceLabel:"Стоимость", capabilities:[
    { icon:Sparkles, title:"Услуги", text:"Описание, длительность и цена" },
    { icon:Users, title:"Специалисты", text:"Сотрудники и их расписание" },
    { icon:Clock3, title:"Онлайн-запись", text:"Свободное время и напоминания" },
  ] },
];

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const createdPreview = searchParams.get("preview") === "created";
  const [stage, setStage] = useState<Stage>(() => createdPreview ? "created" : "details");
  const [templateId, setTemplateId] = useState<TemplateId | null>(() => createdPreview ? "store" : null);
  const [botName, setBotName] = useState(() => createdPreview ? "Mono Store" : "");
  const [botDescription, setBotDescription] = useState(() => createdPreview ? "Магазин одежды и аксессуаров с доставкой по Ташкенту." : "");
  const [primaryColor, setPrimaryColor] = useState("#6541F5");
  const [secondaryColor, setSecondaryColor] = useState("#F0ECFF");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [botId, setBotId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const template = useMemo(() => templates.find((item) => item.id === templateId) ?? templates[1], [templateId]);
  const TemplateIcon = template.icon;
  const progress = stage === "details" ? 20 : stage === "type" ? 40 : stage === "created" ? 60 : stage === "item" ? 80 : 100;

  useEffect(() => {
    document.documentElement.dataset.onboardingHydrated = "true";
    const telegram = (window as typeof window & { Telegram?: { WebApp?: { ready?:()=>void; expand?:()=>void; setHeaderColor?:(color:string)=>void; setBackgroundColor?:(color:string)=>void } } }).Telegram?.WebApp;
    telegram?.ready?.(); telegram?.expand?.(); telegram?.setHeaderColor?.("#ffffff"); telegram?.setBackgroundColor?.("#f5f6f8");
    if (telegram) document.documentElement.dataset.telegram = "true";
    return () => { delete document.documentElement.dataset.onboardingHydrated; delete document.documentElement.dataset.telegram; };
  }, []);

  useEffect(() => {
    return () => { if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview); };
  }, [logoPreview]);

  const selectLogo = (file: File | null) => {
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : "");
  };

  const initData = () => (window as typeof window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData;
  const requestKey = () => {
    const storageKey = "botStudioOnboardingRequestKey";
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID().replaceAll("-", "");
    sessionStorage.setItem(storageKey, created);
    return created;
  };

  const createBot = async () => {
    setSaveState("saving"); setSaveError("");
    const response = await fetch("/api/onboarding", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: initData(), botId, requestKey: requestKey(), botName, description: botDescription, templateType: template.id, primaryColor, secondaryColor }),
    });
    const result = await response.json().catch(() => ({ error:"Сервис сохранения временно недоступен" })) as { bot?: { id?: string }; error?: string };
    if (!response.ok || !result.bot?.id) { setSaveState("error"); setSaveError(result.error ?? "Не удалось создать бота"); return; }
    const nextBotId = result.bot.id;
    setBotId(nextBotId); localStorage.setItem("botStudioBotId", nextBotId);
    if (logoFile) {
      const form = new FormData(); form.append("botId", nextBotId); form.append("logo", logoFile);
      if (initData()) form.append("initData", initData()!);
      const logoResponse = await fetch("/api/bots/logo", { method:"POST", body:form });
      const logoResult = await logoResponse.json() as { logoUrl?: string; error?: string };
      if (logoResponse.ok && logoResult.logoUrl) setLogoUrl(logoResult.logoUrl);
      else setSaveError("Бот создан, но логотип не загрузился. Его можно добавить позже.");
    }
    setSaveState("idle"); setStage("created");
  };

  const saveFirstItem = async () => {
    setSaveState("saving"); setSaveError("");
    const response = await fetch("/api/onboarding", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: initData(), botId, requestKey: requestKey(), botName, description: botDescription, templateType: template.id, primaryColor, secondaryColor, item: { name: itemName, description, priceMinor: price ? Number(price) * 100 : undefined } }),
    });
    const result = await response.json().catch(() => ({ error:"Сервис сохранения временно недоступен" })) as { bot?: { id?: string }; error?: string };
    if (!response.ok) { setSaveState("error"); setSaveError(result.error ?? "Не удалось сохранить"); return; }
    if (result.bot?.id) setBotId(result.bot.id);
    sessionStorage.removeItem("botStudioOnboardingRequestKey");
    setSaveState("idle"); setStage("done");
  };

  return <main className="onboarding-shell"><div className="onboarding-app">
    <aside className="onboarding-sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><Bot /></span><span>Bot Studio</span></Link>
      <div className="onboarding-progress"><div><span>Создание бота</span><strong>{progress}%</strong></div><i><b style={{width:`${progress}%`}} /></i></div>
      <nav className="onboarding-steps">
        <Step number="1" label="Название и дизайн" active={stage === "details"} done={stage !== "details"} />
        <Step number="2" label="Тип и возможности" active={stage === "type"} done={stage === "created" || stage === "item" || stage === "done"} />
        <Step number="3" label="Бот создан" active={stage === "created"} done={stage === "item" || stage === "done"} />
        <Step number="4" label="Первый элемент" active={stage === "item"} done={stage === "done"} />
        <Step number="5" label="Готов к запуску" active={stage === "done"} done={false} />
      </nav>
      <div className="onboarding-tip"><Sparkles /><p><strong>Сначала создаём основу.</strong> Название, описание и дизайн сохранятся до начала наполнения.</p></div>
    </aside>
    <section className="onboarding-main">
      <header className="onboarding-header">
        <Link href="/" className="back-link"><ArrowLeft />Назад в кабинет</Link>
        <div className="onboarding-bot-chip"><span className="switcher-avatar violet" style={{background:secondaryColor,color:primaryColor}}>{logoPreview || logoUrl ? <img src={logoPreview || logoUrl} alt="" /> : templateId ? <TemplateIcon /> : <Bot />}</span><span><small>{stage === "created" || stage === "item" || stage === "done" ? "Бот создан" : "Новый бот"}</small><strong>{botName || "Без названия"}</strong></span><ChevronDown /></div>
      </header>
      <div className="onboarding-content">
        {stage === "details" && <DetailsStep template={template} botName={botName} setBotName={setBotName} botDescription={botDescription} setBotDescription={setBotDescription} primaryColor={primaryColor} setPrimaryColor={setPrimaryColor} secondaryColor={secondaryColor} setSecondaryColor={setSecondaryColor} logoPreview={logoPreview} setLogoFile={selectLogo} onNext={() => setStage("type")} />}
        {stage === "type" && <TypeStep selected={templateId} onSelect={setTemplateId} onBack={() => setStage("details")} onSave={createBot} saveState={saveState} saveError={saveError} />}
        {stage === "created" && <CreatedStep template={template} botName={botName} botDescription={botDescription} primaryColor={primaryColor} secondaryColor={secondaryColor} logoPreview={logoPreview || logoUrl} warning={saveError} botId={botId} onEdit={() => setStage("details")} onStart={() => setStage("item")} />}
        {stage === "item" && <ItemStep template={template} itemName={itemName} setItemName={setItemName} price={price} setPrice={setPrice} description={description} setDescription={setDescription} onBack={() => setStage("created")} onSave={saveFirstItem} botId={botId} saveState={saveState} saveError={saveError} />}
        {stage === "done" && <DoneStep template={template} botName={botName} itemName={itemName} price={price} botId={botId} onAdd={() => { setItemName(""); setPrice(""); setDescription(""); setStage("item"); }} />}
      </div>
    </section>
  </div></main>;
}

function DetailsStep({ template, botName, setBotName, botDescription, setBotDescription, primaryColor, setPrimaryColor, secondaryColor, setSecondaryColor, logoPreview, setLogoFile, onNext }: { template:Template; botName:string; setBotName:(value:string)=>void; botDescription:string; setBotDescription:(value:string)=>void; primaryColor:string; setPrimaryColor:(value:string)=>void; secondaryColor:string; setSecondaryColor:(value:string)=>void; logoPreview:string; setLogoFile:(file:File|null)=>void; onNext:()=>void }) {
  return <div className="flow-step"><div className="flow-heading"><span>Шаг 1 из 5</span><h1>Создайте основу бота</h1><p>Дайте боту название, коротко опишите его и настройте внешний вид.</p></div>
    <div className="bot-setup-layout"><div className="bot-setup-form">
      <div className="setup-fields">
        <label className="setup-logo"><span>Логотип</span><div>{logoPreview ? <img src={logoPreview} alt="Предпросмотр логотипа" /> : <ImagePlus />}<strong>{logoPreview ? "Заменить логотип" : "Загрузить логотип"}</strong><small>PNG или JPG до 2 МБ</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event)=>setLogoFile(event.target.files?.[0]??null)} /></div></label>
        <label><span>Название бота</span><input value={botName} onChange={(event)=>setBotName(event.target.value)} placeholder="Например, Mono Store" /></label>
        <label className="full"><span>Описание</span><textarea value={botDescription} onChange={(event)=>setBotDescription(event.target.value)} placeholder="Коротко расскажите клиенту, что умеет бот" /></label>
        <label className="color-field"><span>Основной цвет</span><div><input type="color" value={primaryColor} onChange={(event)=>setPrimaryColor(event.target.value)} /><b>{primaryColor.toUpperCase()}</b></div></label>
        <label className="color-field"><span>Дополнительный цвет</span><div><input type="color" value={secondaryColor} onChange={(event)=>setSecondaryColor(event.target.value)} /><b>{secondaryColor.toUpperCase()}</b></div></label>
      </div>
    </div><BotPreview template={template} name={botName} description={botDescription} primaryColor={primaryColor} secondaryColor={secondaryColor} logo={logoPreview} /></div>
    <div className="flow-actions"><span /><button className="flow-primary" disabled={!botName.trim() || !botDescription.trim()} onClick={onNext}>Выбрать тип бота <ArrowRight /></button></div>
  </div>;
}

function TypeStep({ selected, onSelect, onBack, onSave, saveState, saveError }: { selected:TemplateId|null; onSelect:(id:TemplateId)=>void; onBack:()=>void; onSave:()=>void; saveState:SaveState; saveError:string }) {
  const selectedTemplate = templates.find((item)=>item.id===selected);
  return <div className="flow-step"><div className="flow-heading"><span>Шаг 2 из 5</span><h1>Выберите тип бота</h1><p>После выбора сразу появятся разделы и возможности, подготовленные для этого бизнеса.</p></div>
    <div className="template-grid compact">{templates.map((item) => { const Icon = item.icon; return <button key={item.id} className={selected === item.id ? "selected" : ""} onClick={() => onSelect(item.id)}><span className="template-icon"><Icon /></span><span><strong>{item.title}</strong><small>{item.description}</small></span>{selected === item.id && <Check className="template-check" />}</button>; })}</div>
    {selectedTemplate ? <section className="type-capabilities"><span className="ready-badge"><Check />Структура готова</span><h2>Возможности «{selectedTemplate.title}»</h2><p>Эти разделы появятся в кабинете сразу после создания бота.</p><div className="capability-list">{selectedTemplate.capabilities.map(({icon:Icon,title,text})=><div key={title}><span><Icon/></span><p><strong>{title}</strong><small>{text}</small></p><Check/></div>)}</div></section> : <section className="type-placeholder"><Bot/><strong>Выберите один из вариантов</strong><p>Мы покажем, какие инструменты будут доступны в вашем боте.</p></section>}
    {saveError && <p className="save-error">{saveError}</p>}
    <div className="flow-actions"><button className="flow-secondary" onClick={onBack}><ArrowLeft />Назад</button><button className="flow-primary" disabled={!selected || saveState === "saving"} onClick={onSave}>{saveState === "saving" ? "Создаём бота…" : "Создать бота"} {saveState !== "saving" && <ArrowRight />}</button></div>
  </div>;
}

function BotPreview({ template, name, description, primaryColor, secondaryColor, logo }: { template:Template; name:string; description:string; primaryColor:string; secondaryColor:string; logo:string }) {
  const Icon = template.icon;
  return <aside className="bot-live-preview"><div className="preview-top"><span>Предпросмотр</span><i>Mini App</i></div><div className="preview-screen" style={{background:secondaryColor}}><div className="preview-logo" style={{background:primaryColor}}>{logo ? <img src={logo} alt="" /> : <Icon />}</div><h2>{name || "Название бота"}</h2><p>{description || "Здесь появится описание вашего бота."}</p><button style={{background:primaryColor}}>Начать</button><div className="preview-cards">{template.capabilities.slice(0,2).map(({title,icon:CardIcon})=><span key={title}><CardIcon/><b>{title}</b></span>)}</div></div></aside>;
}

function CreatedStep({ template, botName, botDescription, primaryColor, secondaryColor, logoPreview, warning, botId, onEdit, onStart }: { template:Template; botName:string; botDescription:string; primaryColor:string; secondaryColor:string; logoPreview:string; warning:string; botId:string|null; onEdit:()=>void; onStart:()=>void }) {
  return <div className="flow-step created-step"><div className="success-mark"><Check /></div><div className="flow-heading"><span>Основа готова</span><h1>Бот «{botName}» создан</h1><p>Основа создана. Сначала настройте приветственное сообщение и кнопки в Telegram. Каталог можно заполнить позже.</p></div>
    <div className="created-summary"><BotPreview template={template} name={botName} description={botDescription} primaryColor={primaryColor} secondaryColor={secondaryColor} logo={logoPreview} /><div className="created-next"><span className="ready-badge"><Check />Бот создан</span><h2>Настройте Telegram-бота</h2><p>Мы подготовили структуру «{template.title}». Первым делом настройте сообщение /start и кнопки. Добавлять товары прямо сейчас не обязательно.</p><div className="capability-list">{template.capabilities.map(({icon:CapabilityIcon,title,text})=><div key={title}><span><CapabilityIcon/></span><p><strong>{title}</strong><small>{text}</small></p><Check/></div>)}</div></div></div>
    {warning && <p className="save-error">{warning}</p>}
    <div className="flow-actions"><button className="flow-secondary" onClick={onEdit}><Palette />Изменить настройки</button><div className="flex flex-wrap gap-3"><button className="flow-secondary" onClick={onStart}>Добавить {template.item} позже или сейчас</button><Link className="flow-primary" href={botId?`/workspace/builder?bot=${encodeURIComponent(botId)}`:"/workspace"}>Настроить сообщение и кнопки <ArrowRight /></Link></div></div>
  </div>;
}

function ItemStep({ template, itemName, setItemName, price, setPrice, description, setDescription, onBack, onSave, botId, saveState, saveError }: { template:Template; itemName:string; setItemName:(v:string)=>void; price:string; setPrice:(v:string)=>void; description:string; setDescription:(v:string)=>void; onBack:()=>void; onSave:()=>void; botId:string|null; saveState:SaveState; saveError:string }) {
  return <div className="flow-step"><div className="flow-heading"><span>Шаг 3 из 4</span><h1>{template.firstAction}</h1><p>Бот уже создан. Теперь добавьте первый элемент, чтобы клиент увидел наполненный каталог.</p></div>
    <div className="item-editor"><label className="item-photo"><ImagePlus /><strong>Добавить фото</strong><small>JPG или PNG до 5 МБ</small><input className="sr-only" type="file" accept="image/*" /></label><div className="item-fields"><label><span>{template.nameLabel}</span><input autoFocus value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={template.namePlaceholder} /></label><label><span>{template.priceLabel}</span><div className="price-input"><input inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value.replace(/\D/g,""))} placeholder="0" /><b>сум</b></div></label><label className="full"><span>Короткое описание</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что важно знать клиенту?" /></label></div></div>
    {saveError && <p className="save-error">{saveError}</p>}
    <div className="flow-actions"><button className="flow-secondary" onClick={onBack}><ArrowLeft />Назад</button><div className="flex flex-wrap items-center justify-end gap-3"><Link className="flow-secondary" aria-disabled={saveState === "saving"} href={botId ? `/workspace/builder?bot=${encodeURIComponent(botId)}` : "/workspace"}>Пропустить и настроить позже <ArrowRight /></Link><button className="flow-primary" disabled={!itemName.trim() || saveState === "saving"} onClick={onSave}>{saveState === "saving" ? "Сохраняю…" : `Сохранить ${template.item}`} {saveState !== "saving" && <ArrowRight />}</button></div></div>
  </div>;
}

function DoneStep({ template, botName, itemName, price, botId, onAdd }: { template:Template; botName:string; itemName:string; price:string; botId:string|null; onAdd:()=>void }) {
  return <div className="flow-step done-step"><div className="success-mark"><Check /></div><div className="flow-heading"><span>Готов к работе</span><h1>Первый {template.item} добавлен</h1><p>{itemName} опубликован в «{botName}». Теперь можно открыть превью или продолжить наполнение.</p></div>
    <div className="first-item-card"><span className="first-item-image"><Package /></span><div><small>{template.item}</small><strong>{itemName}</strong><p>{price ? `${Number(price).toLocaleString("ru-RU")} сум` : "Цена не указана"}</p></div><span className="published-badge">Активен</span></div>
    <div className="launch-actions"><button className="flow-secondary" onClick={onAdd}><Plus />Добавить ещё</button><Link className="flow-primary" href={botId?`/workspace/builder?bot=${botId}`:"/workspace/builder"}>Настроить и посмотреть превью <ArrowRight /></Link></div>
  </div>;
}

function Step({ number, label, active, done }: { number:string; label:string; active:boolean; done:boolean }) { return <div className={`${active ? "active" : ""} ${done ? "done" : ""}`}><span>{done ? <Check /> : number}</span><strong>{label}</strong></div>; }
