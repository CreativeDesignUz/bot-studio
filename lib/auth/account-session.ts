import { env } from "cloudflare:workers";

const COOKIE="bot_studio_auth";
const maxAge=14*24*3600;
const enc=new TextEncoder();

function toHex(bytes:Uint8Array){return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
function bytes(hex:string){return Uint8Array.from(hex.match(/../g)??[],h=>parseInt(h,16))}
async function hmac(value:string){
 const secret=env.BOT_STUDIO_AUTH_SECRET;
 if(!secret||secret.length<32)throw new Error("BOT_STUDIO_AUTH_SECRET is missing or too short");
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return toHex(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(value))));
}
export async function issueAuthCookie(userId:string){
 const deadline=Math.floor(Date.now()/1000)+maxAge;
 const nonce=toHex(crypto.getRandomValues(new Uint8Array(12)));
 const content=`${userId}.${deadline}.${nonce}`;
 return `${COOKIE}=${content}.${await hmac(content)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function clearAuthCookie(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export async function readAuthUserId(request:Request):Promise<string|null>{
 const raw=request.headers.get("cookie")??"";
 const cookie=raw.split(";").map(part=>part.trim()).find(part=>part.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
 if(!cookie||cookie.length>280)return null;
 const parts=cookie.split(".");
 if(parts.length!==4||!/^[a-f0-9-]{36}$/i.test(parts[0])||!/^\d{10}$/.test(parts[1])||!/^[a-f0-9]{24}$/.test(parts[2])||!/^[a-f0-9]{64}$/.test(parts[3]))return null;
 const exp=Number(parts[1]);
 if(exp<Math.floor(Date.now()/1000)||exp>Math.floor(Date.now()/1000)+maxAge)return null;
 try{
  const expected=bytes(await hmac(parts.slice(0,3).join("."))),given=bytes(parts[3]);
  if(expected.length!==given.length)return null;
  return verifyConstantTime(expected,given)?parts[0]:null;
 }catch{return null}
}
function verifyConstantTime(a:Uint8Array,b:Uint8Array){
 let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
 return difference===0;
}
