import { env } from "cloudflare:workers";
export async function GET() {
  return Response.json({telegramBotUsername:env.TELEGRAM_LOGIN_BOT_USERNAME??""},{headers:{"cache-control":"no-store"}});
}
