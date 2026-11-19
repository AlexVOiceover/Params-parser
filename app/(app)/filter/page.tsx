import type { Metadata } from "next";
import { AppProvider } from "@/lib/app-context";
import { ParamFilterApp } from "@/components/param-filter-app";
import { createSessionClient } from "@/lib/supabase/server";
import { getPickerHistories } from "@/lib/version-picker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Filter — AIR6",
};

export default async function FilterPage({ searchParams }: { searchParams: Promise<{ versionId?: string }> }) {
  const { versionId } = await searchParams;
  const histories = await getPickerHistories(await createSessionClient());
  return (
    <AppProvider>
      <ParamFilterApp
        histories={histories}
        initialVersionId={versionId && /^[0-9a-f-]{36}$/i.test(versionId) ? versionId : undefined}
      />
    </AppProvider>
  );
}
