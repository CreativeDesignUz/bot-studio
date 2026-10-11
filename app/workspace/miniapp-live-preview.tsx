"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, MousePointerClick } from "lucide-react";

export type MiniAppPreviewDesign = {
  layout?: "food01"|"food02";
  color?: string;
  dark?: boolean;
  themeMode?: "light"|"dark"|"customer";
  defaultTheme?: "system"|"light"|"dark";
  banner?: {
    enabled:boolean;title:string;description:string;imageUrl:string;
    buttonEnabled:boolean;buttonText:string;
    linkType:"category"|"product"|"page"|"external";target:string;
  };
};

export default function MiniAppLivePreview({
  botId, design, className="",
}:{
  botId:string;design?:MiniAppPreviewDesign;className?:string;
}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const [frameLoaded,setFrameLoaded]=useState(false);
  const link="/miniapp?bot="+encodeURIComponent(botId)+"&preview=1";

  useEffect(()=>{
    if(!frameLoaded||!design)return;
    frame.current?.contentWindow?.postMessage(
      {type:"bot-studio:preview-design",botId,design},window.location.origin
    );
  },[botId,design,frameLoaded]);

  return <section aria-label="Живой предпросмотр Mini App" className={"min-w-0 "+className}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold text-[#101828]">Живой Mini App</h3>
        <p className="mt-1 text-xs text-[#667085]">Меняйте настройки слева и нажимайте внутри приложения.</p>
      </div>
      <a className="inline-flex items-center gap-1 text-xs font-semibold text-[#6541F5]" href={link} target="_blank" rel="noopener noreferrer">На весь экран <ExternalLink size={13}/></a>
    </div>
    <div className="relative mx-auto w-full max-w-[400px] overflow-hidden rounded-[28px] border-[5px] border-[#222635] bg-[#f7f8fa] shadow-[0_18px_40px_rgba(16,24,40,0.15)]">
      <div className="flex h-10 items-center justify-between bg-[#222635] px-4 text-xs text-white/80">
        <span>9:41</span><span className="inline-flex items-center gap-1"><MousePointerClick size={13}/> Интерактивный режим</span>
      </div>
      <iframe key={botId} ref={frame} src={link} title="Интерактивный предпросмотр Mini App"
        onLoad={()=>setFrameLoaded(true)}
        className="block h-[630px] w-full border-0 bg-[#f7f8fa]" loading="lazy"
      />
    </div>
    <p className="mt-3 text-center text-xs leading-5 text-[#667085]">
      Это черновик. Можно листать меню, открывать блюда и собирать корзину. Реальные заказы здесь отключены.
    </p>
  </section>;
}
