import { Suspense } from "react";
import { DroneParamsProvider } from "@/lib/drone-params-context";
import { AppHeader } from "@/components/app-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <DroneParamsProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto min-h-0">{children}</main>
        </div>
      </DroneParamsProvider>
    </Suspense>
  );
}
