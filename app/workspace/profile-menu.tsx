"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";

type ProfileMenuProps = {
  firstName?: string;
  activeBotId?: string;
};

export default function ProfileMenu({ firstName, activeBotId }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = firstName?.trim() || "Пользователь";
  const initial = Array.from(label)[0]?.toLocaleUpperCase("ru-RU") ?? "П";
  const profileHref = "/workspace?section=profile" + (activeBotId ? "&bot=" + encodeURIComponent(activeBotId) : "");

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Меню профиля"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="workspace-profile-dropdown"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded-full p-1 transition hover:bg-[#f2f4f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d45f5]"
      >
        <span className="grid size-10 place-items-center rounded-full bg-[#eee9ff] text-sm font-semibold text-[#5934dc]">
          {initial}
        </span>
        <ChevronDown aria-hidden="true" className={`size-4 text-[#667085] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id="workspace-profile-dropdown"
          role="group"
          aria-label="Действия с профилем"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[256px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#eaecf0] bg-white p-2 text-[#101828] shadow-[0_18px_42px_rgba(16,24,40,0.14)]"
        >
          <div className="border-b border-[#f2f4f7] px-3 py-3">
            <p className="text-xs text-[#98a2b3]">Ваш аккаунт</p>
            <p className="mt-1 truncate text-sm font-semibold" title={label}>{label}</p>
          </div>
          <a
            href={profileHref}
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#344054] no-underline transition hover:bg-[#f7f7fb]"
          >
            <UserRound aria-hidden="true" className="size-[18px]" />
            Мой профиль
          </a>
          <div className="mx-2 my-1 border-t border-[#f2f4f7]" />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-[#b42318] transition hover:bg-[#fef3f2]"
            >
              <LogOut aria-hidden="true" className="size-[18px]" />
              Выйти
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
