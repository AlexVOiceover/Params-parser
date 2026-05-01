import type { Metadata } from "next";
import { AppProvider } from "@/lib/app-context";
import { ParamFilterApp } from "@/components/param-filter-app";

export const metadata: Metadata = {
  title: "Filter Tool — AIR6",
};

export default async function FilterPage({
  searchParams,
}: {
  searchParams: Promise<{ load?: string; family?: string; variant?: string; version?: string }>;
}) {
  const { load, family, variant, version } = await searchParams;
  const catalogSource = family && variant && version ? { family, variant, version } : undefined;
  return (
    <AppProvider>
      <ParamFilterApp loadUrl={load} catalogSource={catalogSource} />
    </AppProvider>
  );
}
