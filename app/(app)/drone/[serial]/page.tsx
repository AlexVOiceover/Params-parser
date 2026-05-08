import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DroneDeepLinkPage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;
  const decodedSerial = decodeURIComponent(serial);

  // Use service role so this page works even when not logged in —
  // the visitor just tapped a physical NFC sticker and may not have a session.
  // We only expose a redirect to a public family/variant page, nothing sensitive.
  const supabase = createAdminClient();

  // Case-insensitive lookup of the serial in drones
  const { data: drone } = await supabase
    .from("drones")
    .select("id, serial, variant_id")
    .ilike("serial", decodedSerial)
    .maybeSingle();

  if (drone) {
    // Look up variant → family slug to build the redirect URL
    const { data: variant } = await supabase
      .from("variants")
      .select("id, family_id")
      .eq("id", drone.variant_id)
      .maybeSingle();

    if (variant?.family_id) {
      const { data: family } = await supabase
        .from("families")
        .select("slug")
        .eq("id", variant.family_id)
        .maybeSingle();

      if (family?.slug) {
        redirect(`/${family.slug}/${drone.variant_id}`);
      }
    }
  }

  // Drone not found or path lookup failed — show a friendly message
  return (
    <div className="max-w-sm mx-auto px-6 py-20 text-center flex flex-col gap-4 items-center">
      <p className="text-lg font-semibold text-foreground">Drone not registered</p>
      <p className="text-sm text-muted-foreground">
        Serial <span className="font-mono">{decodedSerial}</span> was not found in the catalog.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
      >
        Go to catalog
      </Link>
    </div>
  );
}
