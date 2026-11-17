import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, CircleDashed, Clock, Target } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { getFleet, modelName } from "@/lib/fleet";
import { getVersions, diffFromTemplate } from "@/lib/history";
import { droneHref, latestApproved, pendingProposal } from "@/lib/versions";
import { HistoryTimeline } from "@/components/history-timeline";
import { Badge, FleetStatusBadge } from "@/components/status-badge";
import { ModelSettings } from "@/components/model-settings";
import { cardClass, pageLeadClass, pageTitleClass, sectionTitleClass } from "@/components/ui/styles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Model — AIR6",
};

const DRONE_COLUMNS = "minmax(10rem, 1.3fr) minmax(8rem, 1fr) minmax(10.5rem, 1fr) 10.5rem 1rem";
const DIFF_HINT = "Managed params in its target that differ from the current template (per-drone params ignored)";

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
  const asRows = versions.map((v) => ({ id: v.id, version_label: v.label, needs_review: v.needsReview }));
  const current = latestApproved(asRows);
  const proposal = pendingProposal(asRows);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4">
        <Link href="/models" className="-my-2 flex w-fit items-center gap-1 py-2 text-[13px] font-medium text-primary hover:underline cursor-pointer">
          <ChevronLeft className="h-3.5 w-3.5" /> All models
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className={pageTitleClass}>{name}</h1>
            {current ? (
              <Badge tone="ok" title="New drones of this model start from it">
                <Target className="h-3 w-3" aria-hidden="true" />
                Template v{current.version_label}
              </Badge>
            ) : (
              <Badge tone="muted" title="No version of the template has been approved yet">
                <CircleDashed className="h-3 w-3" aria-hidden="true" />
                No template yet
              </Badge>
            )}
            {proposal && (
              <Badge tone="info" title="Waiting for an admin to approve it">
                <Clock className="h-3 w-3" aria-hidden="true" />
                v{proposal.version_label} to review
              </Badge>
            )}
          </div>
          {variant.description && <p className="mt-1 text-sm text-foreground">{variant.description}</p>}
          <p className={pageLeadClass}>
            The template is the reference config new {name} drones start from. Changing it does not change existing drones.
          </p>
        </div>
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

      <section className="flex flex-col gap-4">
        <div>
          <h2 className={sectionTitleClass}>Drones of this model ({drones.length})</h2>
          {drones.length > 0 && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Drones that need attention come first.
              {differences.size > 0 && " The counts compare each drone's target with the current template."}
            </p>
          )}
        </div>
        {drones.length === 0 ? (
          <div className={`${cardClass} px-5 py-6`}>
            <p className="text-sm font-medium text-foreground">None yet.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">A drone shows up here once this model is chosen for it, when it is added or in its settings.</p>
          </div>
        ) : (
          <ul className={`${cardClass} divide-y divide-border overflow-hidden`}>
            {drones.map((d) => {
              const differ = differences.get(d.id);
              const diff = differ === undefined ? null : differ === 0 ? "same as template" : `${differ} differ from template`;
              return (
                <li key={d.id}>
                  <Link
                    href={droneHref(d.serial)}
                    className="group flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-secondary/60 cursor-pointer md:grid md:items-center md:gap-4 md:py-2.5"
                    style={{ gridTemplateColumns: DRONE_COLUMNS }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-sm font-semibold text-foreground group-hover:text-primary">{d.serial}</span>
                      <span className="ml-auto shrink-0 md:hidden"><FleetStatusBadge row={d} isStaff /></span>
                    </span>
                    <span className="hidden truncate text-[13px] text-foreground md:block">
                      {d.clientName ?? <span className="text-muted-foreground">No client</span>}
                    </span>
                    <span className="hidden truncate text-[13px] text-muted-foreground md:block" title={diff ? DIFF_HINT : undefined}>{diff}</span>
                    <span className="hidden md:block"><FleetStatusBadge row={d} isStaff /></span>
                    <ChevronRight className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block" aria-hidden="true" />

                    <span className="text-xs leading-snug text-muted-foreground md:hidden" title={diff ? DIFF_HINT : undefined}>
                      {[d.clientName ?? "No client", diff].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {role === "admin" && (
        <ModelSettings variantId={variantId} familyId={variant.family_id} name={variant.name} description={variant.description} droneCount={drones.length} />
      )}
    </div>
  );
}
