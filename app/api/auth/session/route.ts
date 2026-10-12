import { getSupabaseServer } from "@/lib/supabase/server";

const COOKIE = "bot_studio_access_token";
function cookie(token: string, maxAge: number) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    const text = await request.text();
    if (text.length > 4096) return Response.json({error:"Invalid request"}, {status:413});
    body = JSON.parse(text);
  } catch {
    return Response.json({error:"Invalid request"}, {status:400});
  }
  if (typeof body.email !== "string" || typeof body.password !== "string" ||
      body.email.length > 254 || body.password.length > 1024) {
    return Response.json({error:"Invalid credentials"}, {status:400});
  }
  const auth = getSupabaseServer();
  const { data, error } = await auth.auth.signInWithPassword({
    email: body.email.trim(), password: body.password
  });
  if (error || !data.session || !data.user.email_confirmed_at) {
    return Response.json({error:"Неверные данные или email не подтверждён"}, {status:401});
  }
  const headers = new Headers({"content-type":"application/json","cache-control":"no-store"});
  headers.set("set-cookie", cookie(data.session.access_token, Math.min(data.session.expires_in,3600)));
  return new Response(JSON.stringify({ok:true}), {status:200,headers});
}

export async function DELETE() {
  return new Response(JSON.stringify({ok:true}),{
    headers:{"content-type":"application/json","set-cookie":cookie("",0),"cache-control":"no-store"}
  });
}
