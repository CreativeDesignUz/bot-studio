import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: {email?:unknown;password?:unknown};
  try {const raw=await request.text(); if(raw.length>4096) return Response.json({error:"Invalid request"},{status:413});body=JSON.parse(raw);}
  catch {return Response.json({error:"Invalid request"},{status:400});}
  if(typeof body.email!=="string"||typeof body.password!=="string"||body.email.length>254||body.password.length<10||body.password.length>1024) {
    return Response.json({error:"Email или пароль некорректны (минимум 10 символов)"},{status:400});
  }
  const supabase=getSupabaseServer();
  const {error}=await supabase.auth.signUp({email:body.email.trim(),password:body.password});
  if(error) return Response.json({error:"Не удалось зарегистрировать аккаунт"},{status:400});
  return Response.json({ok:true,message:"Проверьте почту и подтвердите email для входа"});
}
