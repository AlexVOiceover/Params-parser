import { redirect } from "next/navigation";
import { modelHref } from "@/lib/versions";

/** Old catalog URL for a variant: now its model page. */
export default async function OldVariantPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  redirect(modelHref(variantId));
}
