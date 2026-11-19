import { redirect } from "next/navigation";
import { droneHref } from "@/lib/versions";

/** NFC sticker target (kept for stickers already in the field). Login is enforced by middleware. */
export default async function DroneDeepLinkPage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  redirect(droneHref(decodeURIComponent(serial).trim()));
}
