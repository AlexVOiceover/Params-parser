import { AppProvider } from "@/lib/app-context";
import { ParamFilterApp } from "@/components/param-filter-app";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ load?: string; drone?: string; set?: string; version?: string }>;
}) {
  const { load, drone, set, version } = await searchParams;
  const catalogSource = drone && set && version ? { drone, set, version } : undefined;
  return (
    <AppProvider>
      <ParamFilterApp loadUrl={load} catalogSource={catalogSource} />
    </AppProvider>
  );
}
