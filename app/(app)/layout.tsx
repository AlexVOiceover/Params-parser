import { Suspense } from "react";
import { DroneParamsProvider } from "@/lib/drone-params-context";
import { AppHeader } from "@/components/app-header";
import { NavProgress } from "@/components/nav-progress";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <DroneParamsProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <NavProgress />
          <AppHeader />
          <main className="flex-1 overflow-y-auto min-h-0">{children}</main>
        </div>
      </DroneParamsProvider>
    </Suspense>
  );
}
