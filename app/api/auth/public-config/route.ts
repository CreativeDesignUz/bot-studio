import { env } from "cloudflare:workers";
export async function GET(){return Response.json({url:env.SUPABASE_URL??"",key:env.SUPABASE_PUBLISHABLE_KEY??""},{headers:{"cache-control":"no-store"}});}
