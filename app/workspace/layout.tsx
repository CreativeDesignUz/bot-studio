import { Suspense } from "react";
import { WorkspaceShell } from "./workspace-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <Suspense><WorkspaceShell>{children}</WorkspaceShell></Suspense>;
}
