import { AppProvider } from "@/lib/app-context";
import { ParamFilterApp } from "@/components/param-filter-app";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ load?: string }>;
}) {
  const { load } = await searchParams;
  return (
    <AppProvider>
      <ParamFilterApp loadUrl={load} />
    </AppProvider>
  );
}
