"use client";
import {useState} from "react";
import {MapPin, LocateFixed, Minus, Plus} from "lucide-react";
export type Point={lat:number;lng:number};
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
function world(p:Point,z:number){const size=256*2**z;const lat=clamp(p.lat,-85.0511,85.0511);return {x:(p.lng+180)/360*size,y:(1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*size};}
function position(x:number,y:number,z:number):Point{const size=256*2**z;return {lng:((x/size)*360+540)%360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*y/size)))*180/Math.PI};}
const valid=(p:Point)=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.lat>=-85&&p.lat<=85&&p.lng>=-180&&p.lng<=180;
export default function DeliveryLocationPicker({value,onChange}:{value:Point|null;onChange:(value:Point)=>void}){
 const [center,setCenter]=useState<Point>(value??{lat:41.2995,lng:69.2401});
 const [zoom,setZoom]=useState(15);
 const [error,setError]=useState("");
 const at=world(center,zoom),tiles=[] as {key:string;url:string;x:number;y:number}[],baseX=Math.floor(at.x/256),baseY=Math.floor(at.y/256);
 const max=2**zoom;
 for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const tx=baseX+x,ty=baseY+y;if(ty<0||ty>=max)continue;tiles.push({key:tx+":"+ty,url:"https://tile.openstreetmap.org/"+zoom+"/"+((tx%max+max)%max)+"/"+ty+".png",x:tx*256-at.x+160,y:ty*256-at.y+140});}
 function choose(e:React.MouseEvent<HTMLDivElement>){const rect=e.currentTarget.getBoundingClientRect();const p=position(at.x+e.clientX-rect.left-rect.width/2,at.y+e.clientY-rect.top-rect.height/2,zoom);if(valid(p)){setCenter(p);onChange(p);setError("");}}
 function locate(){if(!navigator.geolocation){setError("Геолокация недоступна");return;}navigator.geolocation.getCurrentPosition(({coords})=>{const p={lat:coords.latitude,lng:coords.longitude};if(valid(p)){setCenter(p);onChange(p);setError("");}},{enableHighAccuracy:true,timeout:10000},); }
 return <div className="space-y-2">
  <div className="relative h-[280px] overflow-hidden rounded-2xl border border-[#d0d5dd] bg-[#e7ebea]" role="group" aria-label="Карта выбора точки доставки">
   <div onClick={choose} className="absolute inset-0 cursor-crosshair overflow-hidden" aria-label="Нажмите на карте, чтобы выбрать точку">
    {tiles.map(tile=><img key={tile.key} src={tile.url} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{width:256,height:256,left:tile.x,top:tile.y}}/>)}
   </div>
   <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-lg"><MapPin size={35} fill={value?"#00CD69":"#6541F5"} color="#ffffff"/></div>
   <div className="absolute right-2 top-2 flex flex-col gap-1"><button type="button" aria-label="Приблизить карту" onClick={()=>setZoom(z=>Math.min(18,z+1))} className="rounded-lg bg-white p-2 shadow"><Plus size={18}/></button><button type="button" aria-label="Отдалить карту" onClick={()=>setZoom(z=>Math.max(10,z-1))} className="rounded-lg bg-white p-2 shadow"><Minus size={18}/></button><button type="button" onClick={locate} aria-label="Моё местоположение" className="rounded-lg bg-white p-2 shadow"><LocateFixed size={18}/></button></div>
   <div className="absolute bottom-1 right-2 rounded bg-white/90 px-1 text-[10px] text-[#394150]"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></div>
  </div>
  <p className="text-xs text-[#667085]">Нажмите на карте или определите местоположение. Убедитесь, что метка стоит на нужном здании.</p>
  {value?<p className="text-xs font-semibold text-[#027a48]">Точка выбрана: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>:<p className="text-xs text-[#b54708]">Подтвердите точку доставки на карте</p>}
  {error&&<p role="alert" className="text-xs text-[#b42318]">{error}</p>}
 </div>;
}
