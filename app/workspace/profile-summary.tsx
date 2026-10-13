import { CircleCheck, ShieldCheck, UserRound } from "lucide-react";

type ProfileSummaryProps = {
  firstName?: string;
  telegramLinked?: boolean;
};

export default function ProfileSummary({ firstName, telegramLinked }: ProfileSummaryProps) {
  const name = firstName?.trim() || "Пользователь";

  return (
    <div className="max-w-[760px] space-y-5">
      <section className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#f0ecff] text-[#6d45f5]">
            <UserRound aria-hidden="true" className="size-7" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold">{name}</h2>
            <p className="mt-1 text-sm text-[#667085]">Личный аккаунт Bot Studio</p>
          </div>
        </div>
        <div className="mt-7 border-t border-[#eaecf0] pt-6">
          <p className="text-xs font-medium text-[#667085]">Имя в профиле</p>
          <p className="mt-2 text-sm font-semibold">{name}</p>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#e4e7ec] bg-white p-5 sm:p-7">
        <h2 className="text-base font-semibold">Безопасность аккаунта</h2>
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          Для входа используются защищённые сервисы Google и Telegram. Пароль Bot Studio не требуется.
        </p>
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#f8f9fc] p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#6d45f5]">
            {telegramLinked ? <CircleCheck aria-hidden="true" className="size-5" /> : <ShieldCheck aria-hidden="true" className="size-5" />}
          </span>
          <div>
            <p className="text-sm font-semibold">Telegram</p>
            <p className="mt-1 text-xs text-[#667085]">
              {telegramLinked ? "Привязан к вашему профилю" : "Не привязан к вашему профилю"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
