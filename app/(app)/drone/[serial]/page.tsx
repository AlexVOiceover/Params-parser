import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * NFC sticker target. Middleware has already required a login; the lookup runs
 * on the caller's session, so a drone they can't see is simply "not found".
 */
export default async function DroneDeepLinkPage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;
  const decodedSerial = decodeURIComponent(serial).trim();
  const supabase = await createSessionClient();

  const { data: drone } = await supabase
    .from("drones")
    .select("id, variant_id")
    .eq("serial", decodedSerial)
    .maybeSingle();

  if (drone) {
    const [{ data: set }, { data: variant }] = await Promise.all([
      supabase.from("client_sets").select("id").eq("drone_id", drone.id).eq("is_default", false).maybeSingle(),
      supabase.from("variants").select("family_id").eq("id", drone.variant_id).maybeSingle(),
    ]);
    const { data: family } = variant
      ? await supabase.from("families").select("slug").eq("id", variant.family_id).maybeSingle()
      : { data: null };
    if (family) redirect(set ? `/${family.slug}/${drone.variant_id}/${set.id}` : `/${family.slug}/${drone.variant_id}`);
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-20 text-center flex flex-col gap-4 items-center">
      <p className="text-lg font-semibold text-foreground">Drone not found</p>
      <p className="text-sm text-muted-foreground">
        No drone <span className="font-mono">{decodedSerial}</span> is registered to your account.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
      >
        Go to catalog
      </Link>
    </div>
  );
}
