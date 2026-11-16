import type { Metadata } from "next";
import { AppProvider } from "@/lib/app-context";
import { ParamFilterApp } from "@/components/param-filter-app";

export const metadata: Metadata = {
  title: "Filter Tool — AIR6",
};

export default async function FilterPage({
  searchParams,
}: {
  searchParams: Promise<{ versionId?: string; family?: string; variant?: string; client?: string; version?: string }>;
}) {
  const { versionId, family, variant, client, version } = await searchParams;
  const catalogSource = family && variant && client && version
    ? { family, variant, client, version }
    : undefined;
  return (
    <AppProvider>
      <ParamFilterApp loadUrl={versionId && /^[0-9a-f-]{36}$/i.test(versionId) ? `/api/versions/${versionId}/file` : undefined} catalogSource={catalogSource} />
    </AppProvider>
  );
}
