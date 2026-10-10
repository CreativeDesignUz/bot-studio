import { resolveAppUser, withSessionCookie } from "@/lib/auth/app-user";

const menu=[
 {category:"Плов",name:"Ташкентский плов",description:"Рис, говядина, морковь, нут, зира · 400 г",price:48000,image:"https://images.unsplash.com/photo-1633945274309-2c16c9682a8c?auto=format&fit=crop&w=800&q=80"},
 {category:"Плов",name:"Самаркандский плов",description:"Рис, говядина, жёлтая морковь, нут · 400 г",price:52000,image:"https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=800&q=80"},
 {category:"Горячие блюда",name:"Манты с говядиной",description:"Манты на пару с мясом и луком · 5 шт.",price:45000,image:"https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80"},
 {category:"Горячие блюда",name:"Лагман",description:"Домашняя лапша, говядина и овощи · 450 г",price:43000,image:"https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=800&q=80"},
 {category:"Горячие блюда",name:"Нарын",description:"Тонкая лапша с отварным мясом и луком · 350 г",price:51000,image:"https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=800&q=80"},
 {category:"Выпечка",name:"Самса с говядиной",description:"Слоёное тесто, говядина, лук · 1 шт.",price:16000,image:"https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80"},
 {category:"Выпечка",name:"Самса с тыквой",description:"Слоёное тесто, тыква, лук · 1 шт.",price:14000,image:"https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80"},
 {category:"Шашлык",name:"Шашлык из говядины",description:"Говядина на углях, лук, соус · 1 шампур",price:28000,image:"https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=800&q=80"},
 {category:"Шашлык",name:"Кийма шашлык",description:"Рубленое мясо на углях · 1 шампур",price:24000,image:"https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=800&q=80"},
 {category:"Супы",name:"Шурпа из говядины",description:"Наваристый бульон, мясо, картофель, овощи · 450 мл",price:39000,image:"https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80"},
 {category:"Напитки",name:"Айран",description:"Освежающий кисломолочный напиток · 500 мл",price:12000,image:"https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80"},
 {category:"Напитки",name:"Зелёный чай",description:"Традиционный зелёный чай · чайник 500 мл",price:10000,image:"https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80"},
];
const uuid=(v:unknown)=>typeof v==="string"&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(v);
export async function POST(request:Request){
 let data:{botId?:string;initData?:string}={};
 try{data=await request.json()}catch{return Response.json({error:"Неверный запрос"},{status:400})}
 if(!uuid(data.botId))return Response.json({error:"Укажите бота"},{status:400});
 const id=data.botId!;
 const identity=await resolveAppUser(request,data.initData??"");
 if("error" in identity)return Response.json({error:identity.error},{status:identity.status});
 const {supabase,user,setCookie}=identity;
 const {data:bot}=await supabase.from("bots").select("id,template_type").eq("id",id).eq("owner_id",user.id).maybeSingle();
 if(!bot||bot.template_type!=="delivery")return Response.json({error:"Демо-меню можно добавить только своему боту доставки еды"},{status:403});
 const {data:existing,error:existingError}=await supabase.from("catalog_items").select("name").eq("bot_id",id).eq("item_type","dish");
 if(existingError)return Response.json({error:"Не удалось проверить меню"},{status:500});
 if((existing??[]).length)return Response.json({error:"Меню уже содержит блюда. Чтобы не перезаписать их, демо-меню загружается только в пустой каталог."},{status:409});
 const categoryNames=[...new Set(menu.map(x=>x.category))];
 const {data:old,error:oldError}=await supabase.from("catalog_categories").select("id,name").eq("bot_id",id);
 if(oldError)return Response.json({error:"Не удалось проверить категории"},{status:500});
 const categories=new Map((old??[]).map(x=>[x.name,x.id] as const));
 for(const [i,name] of categoryNames.entries()){
  if(categories.has(name))continue;
  const {data:category,error}=await supabase.from("catalog_categories").insert({bot_id:id,name,position:i,is_active:true}).select("id").single();
  if(error||!category)return Response.json({error:"Не удалось сохранить категории. Повторите попытку."},{status:500});
  categories.set(name,category.id)
 }
 // Demo prices only. Items remain editable; seed is intentionally not automatic.
 const {data:added,error}=await supabase.from("catalog_items").insert(menu.map((item,i)=>({
  bot_id:id,item_type:"dish",name:item.name,description:item.description,price_minor:item.price*100,
  currency:"UZS",is_active:true,image_url:item.image,category_id:categories.get(item.category),position:i
 }))).select("id");
 if(error)return Response.json({error:"Не удалось добавить блюда. Проверьте каталог."},{status:500});
 return withSessionCookie({created:added?.length??0,categories:categoryNames},200,setCookie);
}
