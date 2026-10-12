import { env } from "cloudflare:workers";
export async function GET() {
  return Response.json({telegramBotUsername:(env as typeof env & {TELEGRAM_LOGIN_BOT_USERNAME?:string}).TELEGRAM_LOGIN_BOT_USERNAME??""},{headers:{"cache-control":"no-store"}});
}
