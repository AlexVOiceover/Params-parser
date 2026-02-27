import { AppProvider } from "@/lib/app-context";
import { ParamFilterApp } from "@/components/param-filter-app";

export default function Page() {
  return (
    <AppProvider>
      <ParamFilterApp />
    </AppProvider>
  );
}
