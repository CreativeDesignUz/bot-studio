import { Suspense } from "react";
import WorkspaceShell from "./workspace-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f4f6f8] text-[#667085]">Загружаем кабинет…</main>}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </Suspense>
  );
}
