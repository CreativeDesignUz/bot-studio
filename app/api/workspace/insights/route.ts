import { logServerError } from "@/lib/observability/error-log";
import { resolveAppUser } from "@/lib/auth/app-user";

type Customer = {id:string;external_id:string;full_name:string|null;telegram_username:string|null;last_activity_at:string|null};
type Order = {id:string;customer_external_id:string|null;customer_name:string|null;status:string;payment_status:string|null;total_minor:number;created_at:string};
const safeDate = (s:string|null) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function GET(request:Request) {
  try {
    const url = new URL(request.url);
    const botId = url.searchParams.get("bot") ?? "";
    const start = url.searchParams.get("from");
    const end = url.searchParams.get("to");
    if (!/^[0-9a-f-]{36}$/i.test(botId) || !safeDate(start) || !safeDate(end) || (start && end && start>end)) {
      return Response.json({error:"Invalid report filters"},{status:400});
    }
    const identity = await resolveAppUser(request,request.headers.get("x-telegram-init-data")??"",false);
    if ("error" in identity) return Response.json({error:identity.error},{status:identity.status});
    const {supabase,user} = identity;
    const owner = await supabase.from("bots").select("id").eq("id",botId).eq("owner_id",user.id).maybeSingle();
    if (owner.error) throw owner.error;
    if (!owner.data) return Response.json({error:"Not found"},{status:404});
    const customersResult = await supabase.from("customers")
      .select("id,external_id,full_name,telegram_username,last_activity_at")
      .eq("bot_id",botId).order("last_activity_at",{ascending:false}).limit(500);
    if (customersResult.error) throw customersResult.error;
    let ordersQuery = supabase.from("orders")
      .select("id,customer_external_id,customer_name,status,payment_status,total_minor,created_at")
      .eq("bot_id",botId).order("created_at",{ascending:false}).limit(2000);
    if (start) ordersQuery=ordersQuery.gte("created_at",start+"T00:00:00.000Z");
    if (end) ordersQuery=ordersQuery.lt("created_at",new Date(Date.parse(end+"T00:00:00.000Z")+86400000).toISOString());
    const ordersResult=await ordersQuery;
    if (ordersResult.error) throw ordersResult.error;
    const orders=(ordersResult.data??[]) as Order[];
    const customers=(customersResult.data??[]) as Customer[];
    const stats = new Map<string,{orders:number;spent:number;lastOrder:string|null}>();
    for (const o of orders) {
      if (!o.customer_external_id) continue;
      const prev=stats.get(o.customer_external_id)??{orders:0,spent:0,lastOrder:null};
      prev.orders++;
      if (o.payment_status==="paid" || o.status==="completed" || o.status==="delivered") prev.spent+=Number(o.total_minor)||0;
      if (!prev.lastOrder || prev.lastOrder<o.created_at) prev.lastOrder=o.created_at;
      stats.set(o.customer_external_id,prev);
    }
    const byDay = new Map<string,{date:string;orders:number;revenue_minor:number}>();
    let gross=0, paid=0, cancelled=0;
    for (const o of orders) {
      const day=o.created_at.slice(0,10);
      const item=byDay.get(day)??{date:day,orders:0,revenue_minor:0};
      item.orders++;
      if (o.status==="cancelled" || o.status==="canceled") cancelled++;
      if (o.payment_status==="paid") {paid++;gross+=Number(o.total_minor)||0;item.revenue_minor+=Number(o.total_minor)||0;}
      byDay.set(day,item);
    }
    return Response.json({
      limited:customers.length===500||orders.length===2000,
      customers:customers.map(c=>({...c,...(stats.get(c.external_id)??{orders:0,spent:0,lastOrder:null})})),
      summary:{visitors:customers.length,orders:orders.length,paidOrders:paid,revenueMinor:gross,
        averageCheckMinor:paid?Math.round(gross/paid):0,cancelled},
      trend:[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date)),
      recentOrders:orders.slice(0,20)
    },{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    const errorId = logServerError("workspace.insights", error);
    return Response.json({error:"Analytics unavailable",errorId},{status:500});
  }
}
