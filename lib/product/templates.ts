import { BarChart3, CalendarDays, Headphones, Megaphone, Package, ShoppingBag, Store, Truck, Users, WalletCards, Warehouse } from "lucide-react";

export type BotTemplateId = "store" | "delivery" | "service";

export const productTemplates = {
  store: { label: "Интернет-магазин", itemLabel: "товар", modules: [
    { id: "overview", label: "Обзор", icon: Store }, { id: "catalog", label: "Товары", icon: ShoppingBag },
    { id: "orders", label: "Заказы", icon: WalletCards }, { id: "inventory", label: "Склад", icon: Warehouse },
    { id: "customers", label: "Клиенты", icon: Users }, { id: "marketing", label: "Продажи", icon: Megaphone },
    { id: "support", label: "Поддержка", icon: Headphones }, { id: "analytics", label: "Отчёты", icon: BarChart3 },
  ] },
  delivery: { label: "Доставка еды", itemLabel: "блюдо", modules: [
    { id: "overview", label: "Обзор", icon: Store }, { id: "catalog", label: "Меню", icon: Package },
    { id: "orders", label: "Заказы", icon: WalletCards }, { id: "delivery", label: "Доставка", icon: Truck },
    { id: "customers", label: "Клиенты", icon: Users }, { id: "marketing", label: "Акции", icon: Megaphone },
    { id: "support", label: "Поддержка", icon: Headphones }, { id: "analytics", label: "Отчёты", icon: BarChart3 },
  ] },
  service: { label: "Услуги и запись", itemLabel: "услуга", modules: [
    { id: "overview", label: "Обзор", icon: Store }, { id: "catalog", label: "Услуги", icon: Package },
    { id: "appointments", label: "Записи", icon: CalendarDays }, { id: "staff", label: "Сотрудники", icon: Users },
    { id: "customers", label: "Клиенты", icon: Users }, { id: "payments", label: "Оплаты", icon: WalletCards },
    { id: "support", label: "Отзывы", icon: Headphones }, { id: "analytics", label: "Отчёты", icon: BarChart3 },
  ] },
} as const;
