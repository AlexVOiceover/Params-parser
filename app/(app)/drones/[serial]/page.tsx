import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Link2 } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { fleetStatus, modelName } from "@/lib/fleet";
import { getEvents, getVersions } from "@/lib/history";
import { latestApproved, pendingProposal, modelHref } from "@/lib/versions";
import { FleetStatusBadge } from "@/components/status-badge";
import { HistoryTimeline } from "@/components/history-timeline";
import { DroneSettings } from "@/components/drone-settings";
import { StartHistoryButton } from "@/components/start-history-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ serial: string }> }): Promise<Metadata> {
  const { serial } = await params;
  return { title: `${decodeURIComponent(serial)} — AIR6` };
}

export default async function DronePage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial: raw } = await params;
  const serial = decodeURIComponent(raw);
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: drone }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("drones").select("id, serial, chip_id, client_id, variant_id").eq("serial", serial).maybeSingle(),
  ]);
  if (!drone) notFound();
  const role = profile?.role ?? null;
  const isAdmin = role === "admin";
  const isStaff = isAdmin || role === "contributor";

  const [{ data: variant }, { data: client }, { data: set }, { count: droneCount }] = await Promise.all([
    supabase.from("variants").select("id, name, family_id").eq("id", drone.variant_id).maybeSingle(),
    drone.client_id ? supabase.from("clients").select("name").eq("id", drone.client_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("client_sets").select("id").eq("drone_id", drone.id).eq("is_default", false).maybeSingle(),
    supabase.from("drones").select("id", { count: "exact", head: true }),
  ]);
  const { data: family } = variant?.family_id
    ? await supabase.from("families").select("name").eq("id", variant.family_id).maybeSingle()
    : { data: null };

  const [versions, events] = await Promise.all([getVersions(supabase, set?.id ?? null), getEvents(supabase, drone.id)]);
  const asRows = versions.map((v) => ({ id: v.id, version_label: v.label, needs_review: v.needsReview }));
  const target = latestApproved(asRows);
  const pending = pendingProposal(asRows);
  const lastVerified = events.find((e) => e.kind === "applied" || e.kind === "captured");
  const status = fleetStatus(!!drone.chip_id, target?.id ?? null, !!pending, lastVerified ? lastVerified.versionId : undefined);

  let settingsOptions: { clients: { id: string; name: string }[]; models: { id: string; name: string }[] } | null = null;
  if (isStaff) {
    const [{ data: clients }, { data: variants }, { data: families }] = await Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("variants").select("id, name, family_id"),
      supabase.from("families").select("id, name"),
    ]);
    const familyName = new Map((families ?? []).map((f) => [f.id, f.name]));
    settingsOptions = {
      clients: clients ?? [],
      models: (variants ?? [])
        .map((v) => ({ id: v.id, name: modelName(v.family_id ? familyName.get(v.family_id) : null, v.name) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  const model = modelName(family?.name, variant?.name);
  const showBack = isStaff || (droneCount ?? 0) > 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        {showBack && (
          <Link href="/" className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer w-fit">
            <ChevronLeft className="h-3.5 w-3.5" /> All drones
          </Link>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-mono text-2xl font-semibold text-foreground">{drone.serial}</h1>
          <FleetStatusBadge
            row={{ status, target: target?.version_label ?? null, pending: pending?.version_label ?? null, lastLabel: lastVerified?.label ?? null }}
            isStaff={isStaff}
          />
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-x-2 gap-y-1 flex-wrap">
          {isStaff
            ? <Link href={modelHref(drone.variant_id)} className="text-foreground hover:text-primary cursor-pointer">{model}</Link>
            : <span className="text-foreground">{model}</span>}
          {isStaff && <span>· {client?.name ?? "No client"}</span>}
          <span className="flex items-center gap-1">
            · <Link2 className="h-3 w-3" />
            {drone.chip_id ? <>flight controller <span className="font-mono">{drone.chip_id.slice(0, 8)}…</span></> : "flight controller not linked"}
          </span>
        </p>
      </header>

      {set ? (
        <HistoryTimeline
          kind="drone"
          setId={set.id}
          variantId={drone.variant_id}
          versions={versions}
          events={events}
          drone={{ id: drone.id, chipId: drone.chip_id, serial: drone.serial }}
          isAdmin={isAdmin}
          isStaff={isStaff}
          fileBase={drone.serial}
        />
      ) : isStaff ? (
        <StartHistoryButton droneId={drone.id} serial={drone.serial} variantId={drone.variant_id} clientId={drone.client_id} clientName={client?.name ?? null} />
      ) : (
        <p className="text-sm text-muted-foreground">This drone has no history yet. AIR6 will set it up.</p>
      )}

      {settingsOptions && (
        <DroneSettings
          droneId={drone.id}
          serial={drone.serial}
          chipId={drone.chip_id}
          clientId={drone.client_id}
          variantId={drone.variant_id}
          clients={settingsOptions.clients}
          models={settingsOptions.models}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
