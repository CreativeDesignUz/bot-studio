"use client";
import CatalogManager from "../catalog-manager";
import { useWorkspace } from "../workspace-shell";
import Link from "next/link";

// Keep old menu-editor URLs working with the same real catalog and workspace shell.
export default function RestaurantWorkspace() {
  const { bot } = useWorkspace();
  if (!bot) return <main className="p-7"><h1 className="text-2xl font-semibold">Создайте первого бота</h1><Link href="/onboarding" className="mt-4 inline-block text-[#6541f5]">Начать создание</Link></main>;
  return <main className="p-4 sm:p-7 lg:p-9"><h1 className="mb-7 text-3xl font-semibold">{bot.template_type === "delivery" ? "Блюда" : bot.template_type === "service" ? "Услуги" : "Товары"}</h1><CatalogManager key={bot.id} botId={bot.id} type={bot.template_type}/></main>;
}
