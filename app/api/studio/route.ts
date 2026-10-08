import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { botProfile, bots, channelConnections, commands, news, outboxEvents } from "@/db/schema";
import { getChannelAdapter } from "@/lib/channels/registry";
import type { ChannelKey } from "@/lib/channels/contracts";
const defaults = { id: 1, name: "Мой первый бот", username: "my_first_bot", description: "Отвечает на вопросы и делится новостями.", avatarKey: null, updatedAt: new Date().toISOString() };
const DEFAULT_BOT_ID = "bot_default";

async function ensureCoreBot() {
  const db = getDb();
  const [profile] = await db.select().from(botProfile).where(eq(botProfile.id, 1)).limit(1);
  const source = profile ?? defaults;
  const now = new Date().toISOString();
  await db.insert(bots).values({ id: DEFAULT_BOT_ID, name: source.name, username: source.username, description: source.description, avatarKey: source.avatarKey, createdAt: now, updatedAt: now }).onConflictDoNothing();
  return source;
}

async function snapshot() {
  const db = getDb();
  const source = await ensureCoreBot();
  const connections = await db.select().from(channelConnections).where(eq(channelConnections.botId, DEFAULT_BOT_ID));
  return {
    profile: { name: source.name, username: source.username, description: source.description, avatarKey: source.avatarKey },
    commands: await db.select().from(commands).orderBy(desc(commands.id)),
    news: await db.select().from(news).orderBy(desc(news.id)),
    connections: ["telegram", "whatsapp", "instagram", "webchat"].map((channel) => {
      const stored = connections.find((item) => item.channel === channel);
      return { channel, status: stored?.status ?? "not_connected", externalAccountId: stored?.externalAccountId ?? null, externalUsername: stored?.externalUsername ?? null, onboardingUrl: stored?.onboardingUrl ?? null };
    }),
  };
}
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
export async function GET() { try { return Response.json(await snapshot()); } catch { return Response.json({ error: "Не удалось загрузить рабочее пространство" }, { status: 500 }); } }
export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>; const db = getDb();
    if (payload.action === "saveProfile") { const input = (payload.profile ?? {}) as Record<string, unknown>; const values = { name: clean(input.name, 80), username: clean(input.username, 48).replace(/[^a-zA-Z0-9_]/g, ""), description: clean(input.description, 240), avatarKey: typeof input.avatarKey === "string" ? input.avatarKey : null, updatedAt: new Date().toISOString() }; if (!values.name || !values.username) return Response.json({ error: "Укажите название и username" }, { status: 400 }); await db.insert(botProfile).values({ id: 1, ...values }).onConflictDoUpdate({ target: botProfile.id, set: values }); const now = new Date().toISOString(); await db.insert(bots).values({ id: DEFAULT_BOT_ID, ...values, createdAt: now }).onConflictDoUpdate({ target: bots.id, set: values }); }
    else if (payload.action === "addCommand") { const input = (payload.command ?? {}) as Record<string, unknown>; const values = { command: clean(input.command, 32).replace(/[^a-zA-Z0-9_]/g, ""), description: clean(input.description, 80), response: clean(input.response, 1200), createdAt: new Date().toISOString() }; if (!values.command || !values.response) return Response.json({ error: "Заполните команду и ответ" }, { status: 400 }); await db.insert(commands).values(values).onConflictDoUpdate({ target: commands.command, set: values }); }
    else if (payload.action === "deleteCommand") await db.delete(commands).where(eq(commands.id, Number(payload.id)));
    else if (payload.action === "addNews") { const input = (payload.news ?? {}) as Record<string, unknown>; const status: "draft" | "published" = input.status === "published" ? "published" : "draft"; const values = { title: clean(input.title, 120), body: clean(input.body, 3000), status, createdAt: new Date().toISOString() }; if (!values.title || !values.body) return Response.json({ error: "Заполните заголовок и текст" }, { status: 400 }); const [created] = await db.insert(news).values(values).returning(); if (status === "published") { const now = new Date().toISOString(); await db.insert(outboxEvents).values({ id: crypto.randomUUID(), botId: DEFAULT_BOT_ID, type: "news.published", payloadJson: JSON.stringify({ newsId: created.id, title: created.title, body: created.body }), status: "pending", attempts: 0, createdAt: now, updatedAt: now }); } }
    else if (payload.action === "deleteNews") await db.delete(news).where(eq(news.id, Number(payload.id)));
    else if (payload.action === "prepareChannel") {
      const channel = clean(payload.channel, 30) as ChannelKey;
      if (channel !== "telegram") return Response.json({ error: "Этот канал пока в плане развития" }, { status: 400 });
      const profile = await ensureCoreBot();
      const prepared = await getChannelAdapter(channel).prepare({ id: DEFAULT_BOT_ID, name: profile.name, username: profile.username, description: profile.description, avatarKey: profile.avatarKey });
      const now = new Date().toISOString();
      const values = { botId: DEFAULT_BOT_ID, channel, status: prepared.status, externalAccountId: null, externalUsername: prepared.externalUsername, onboardingUrl: prepared.onboardingUrl, updatedAt: now };
      await db.insert(channelConnections).values({ id: `${DEFAULT_BOT_ID}:${channel}`, ...values, createdAt: now }).onConflictDoUpdate({ target: channelConnections.id, set: values });
    }
    else return Response.json({ error: "Неизвестное действие" }, { status: 400 });
    return Response.json(await snapshot());
  } catch (error) { return Response.json({ error: error instanceof Error && error.message.includes("UNIQUE") ? "Такая команда уже существует" : "Не удалось сохранить изменения" }, { status: 500 }); }
}
