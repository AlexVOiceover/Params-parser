import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { getFleet, modelName } from "@/lib/fleet";
import { getVersions, diffFromTemplate } from "@/lib/history";
import { droneHref } from "@/lib/versions";
import { HistoryTimeline } from "@/components/history-timeline";
import { FleetStatusBadge } from "@/components/status-badge";
import { ModelSettings } from "@/components/model-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Model — AIR6",
};

export default async function ModelPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? null;
  if (role !== "admin" && role !== "contributor") redirect("/");

  const { data: variant } = await supabase.from("variants").select("id, name, description, family_id").eq("id", variantId).maybeSingle();
  if (!variant) notFound();
  const [{ data: family }, { data: template }, fleet] = await Promise.all([
    variant.family_id ? supabase.from("families").select("name").eq("id", variant.family_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("client_sets").select("id").eq("variant_id", variantId).eq("is_default", true).maybeSingle(),
    getFleet(supabase),
  ]);
  const versions = await getVersions(supabase, template?.id ?? null);
  const drones = fleet.filter((d) => d.variantId === variantId);
  const differences = await diffFromTemplate(supabase, versions, drones.map((d) => d.id));
  const name = modelName(family?.name, variant.name);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href="/models" className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer w-fit">
          <ChevronLeft className="h-3.5 w-3.5" /> All models
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
        {variant.description && <p className="text-sm text-foreground">{variant.description}</p>}
        <p className="text-sm text-muted-foreground">
          The template is the reference config new {name} drones start from. Changing it does not change existing drones.
        </p>
      </header>

      <HistoryTimeline
        kind="model"
        setId={template?.id ?? null}
        variantId={variantId}
        versions={versions}
        events={[]}
        drone={null}
        isAdmin={role === "admin"}
        isStaff
        fileBase={name.replace(/\s*·\s*/g, "-")}
        filterSource={{ family: family?.name ?? "", variant: variant.name, client: "Template" }}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Drones of this model ({drones.length})</h2>
        {drones.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet.</p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {drones.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2">
                <Link href={droneHref(d.serial)} className="font-mono text-sm text-foreground hover:text-primary cursor-pointer">{d.serial}</Link>
                <span className="text-xs text-muted-foreground flex-1 truncate">{d.clientName ?? "No client"}</span>
                {differences.has(d.id) && (
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap" title="Managed params in its target that differ from the current template (per-drone params ignored)">
                    {differences.get(d.id) === 0 ? "same as template" : `${differences.get(d.id)} differ from template`}
                  </span>
                )}
                <FleetStatusBadge row={d} isStaff />
              </li>
            ))}
          </ul>
        )}
      </section>

      {role === "admin" && (
        <ModelSettings variantId={variantId} familyId={variant.family_id} name={variant.name} description={variant.description} droneCount={drones.length} />
      )}
    </div>
  );
}
