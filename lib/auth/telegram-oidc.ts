import {env} from "cloudflare:workers";
const base="https://oauth.telegram.org";
const cookie="bot_studio_oidc";
const encoder=new TextEncoder();
export function oidcConfig(){const id=env.TELEGRAM_OIDC_CLIENT_ID?.trim()??"";const secret=env.TELEGRAM_OIDC_CLIENT_SECRET?.trim()??"";return /^\d{6,20}$/.test(id)&&secret.length>=12?{id,secret}:null;}
function b64(bytes:Uint8Array){return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join("")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
export function randomUrlString(size=32){return b64(crypto.getRandomValues(new Uint8Array(size)));}
export async function challenge(verifier:string){return b64(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(verifier))));}
export async function signedState(state:string,verifier:string){const key=await crypto.subtle.importKey("raw",encoder.encode(env.BOT_STUDIO_AUTH_SECRET??""),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64(new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(state+"."+verifier))));}
export async function verifyState(value:string){const parts=value.split(".");if(parts.length!==4)return null;const [state,verifier,created,mac]=parts;const time=Number(created);if(!Number.isSafeInteger(time)||Math.abs(Date.now()-time)>300000)return null;const expected=await signedState(state,verifier+"."+created);if(expected.length!==mac.length)return null;let diff=0;for(let i=0;i<mac.length;i++)diff|=expected.charCodeAt(i)^mac.charCodeAt(i);return diff===0?{state,verifier}:null;}
export function stateCookie(value:string,maxAge=300){return `${cookie}=${encodeURIComponent(value)}; Path=/api/auth/telegram; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;}
export const clearStateCookie=()=>stateCookie("",0);
export function readStateCookie(request:Request){const part=(request.headers.get("cookie")??"").split(";").map(s=>s.trim()).find(s=>s.startsWith(cookie+"="));return part?decodeURIComponent(part.slice(cookie.length+1)):null;}
export const redirectUri=(request:Request)=>new URL("/api/auth/telegram/callback",request.url).toString();
export async function verifyIdToken(jwt:string,clientId:string){
 const parts=jwt.split(".");if(parts.length!==3||jwt.length>10000)throw Error("Invalid token");
 function decode(segment:string){return Uint8Array.from(atob(segment.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(segment.length/4)*4,"=")),c=>c.charCodeAt(0));}
 const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))) as {alg?:string;kid?:string};
 if(header.alg!=="RS256"||!header.kid)throw Error("Unsupported token signature");
 const res=await fetch(base+"/.well-known/jwks.json",{signal:AbortSignal.timeout(6000)});
 if(!res.ok)throw Error("Telegram keys unavailable");
 const keys=await res.json() as {keys?:Array<JsonWebKey&{kid?:string}>};
 const jwk=keys.keys?.find(k=>k.kid===header.kid&&k.kty==="RSA"&&(!k.alg||k.alg==="RS256"));
 if(!jwk)throw Error("Unknown signing key");
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(parts[2]),encoder.encode(parts[0]+"."+parts[1])))throw Error("Invalid signature");
 const claim=JSON.parse(new TextDecoder().decode(decode(parts[1]))) as {iss?:string;aud?:string|string[];sub?:string;exp?:number;iat?:number;name?:string;given_name?:string;family_name?:string;preferred_username?:string};
 const now=Math.floor(Date.now()/1000);
 if(claim.iss!==base||!(typeof claim.aud==="string"?claim.aud===clientId:claim.aud?.includes(clientId))||!claim.sub||!/^[0-9]{1,25}$/.test(claim.sub)||!claim.exp||claim.exp<=now||!claim.iat||claim.iat>now+60)throw Error("Invalid token claims");
 return {id:claim.sub,first_name:(claim.given_name??claim.name??"Telegram").slice(0,100),last_name:(claim.family_name??"").slice(0,100),username:(claim.preferred_username??"").slice(0,100)||null};
}
