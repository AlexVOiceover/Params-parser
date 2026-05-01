import type { Metadata } from "next";
import { AppProvider } from "@/lib/app-context";
import { ParamFilterApp } from "@/components/param-filter-app";

export const metadata: Metadata = {
  title: "Filter Tool — AIR6",
};

export default async function FilterPage({
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
