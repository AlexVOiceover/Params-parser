import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { DeleteDroneButton } from "@/components/delete-drone-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fleet — AIR6",
};

type SortKey = "serial" | "client" | "family" | "version";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  col,
  current,
  dir,
  baseUrl,
}: {
  label: string;
  col: SortKey;
  current: SortKey;
  dir: SortDir;
  baseUrl: string;
}) {
  const isActive = current === col;
  const nextDir: SortDir = isActive && dir === "asc" ? "desc" : "asc";
  const Icon = isActive ? (dir === "asc" ? ChevronUp : ChevronDown) : null;
  return (
    <th className="px-4 py-2.5 text-left font-medium">
      <Link
        href={`${baseUrl}?sort=${col}&dir=${nextDir}`}
        className={`flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer whitespace-nowrap ${isActive ? "text-foreground" : ""}`}
      >
        {label}
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
      </Link>
    </th>
  );
}

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const { sort, dir } = await searchParams;
  const sortKey: SortKey = (["serial", "client", "family", "version"].includes(sort ?? "") ? sort : "client") as SortKey;
  const sortDir: SortDir = dir === "desc" ? "desc" : "asc";

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();

  const { data: drones } = await admin
    .from("drones")
    .select("id, serial, client_id, variant_id")
    .order("serial");

  const droneIds = (drones ?? []).map((d) => d.id);
  const variantIds = [...new Set((drones ?? []).map((d) => d.variant_id))];
  const clientIds = [...new Set((drones ?? []).map((d) => d.client_id).filter((id): id is string => !!id))];

  const [{ data: variants }, { data: families }, { data: clients }, { data: clientSets }] = await Promise.all([
    variantIds.length
      ? admin.from("variants").select("id, name, family_id").in("id", variantIds)
      : Promise.resolve({ data: [] }),
    admin.from("families").select("id, name, slug"),
    clientIds.length
      ? admin.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] }),
    droneIds.length
      ? admin.from("client_sets").select("id, drone_id, variant_id").in("drone_id", droneIds).eq("is_default", false)
      : Promise.resolve({ data: [] }),
  ]);

  const clientSetIds = (clientSets ?? []).map((cs) => cs.id);
  const { data: latestVersions } = clientSetIds.length
    ? await admin.from("param_versions").select("client_set_id, version_label").in("client_set_id", clientSetIds).eq("is_latest", true)
    : { data: [] };

  const variantMap = new Map((variants ?? []).map((v) => [v.id, v]));
  const familyMap = new Map((families ?? []).map((f) => [f.id, f]));
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const clientSetByDrone = new Map((clientSets ?? []).map((cs) => [cs.drone_id, cs]));
  const latestVersionByClientSet = new Map((latestVersions ?? []).map((v) => [v.client_set_id, v.version_label]));

  const rows = (drones ?? []).map((d) => {
    const variant = variantMap.get(d.variant_id);
    const family = variant?.family_id ? familyMap.get(variant.family_id) : null;
    const clientName = d.client_id ? (clientMap.get(d.client_id) ?? null) : null;
    const cs = clientSetByDrone.get(d.id);
    const version = cs ? latestVersionByClientSet.get(cs.id) : null;
    const paramSetUrl = family?.slug && variant && cs ? `/${family.slug}/${variant.id}/${cs.id}` : null;
    return {
      id: d.id,
      serial: d.serial,
      clientName,
      familyName: family?.name ?? "—",
      variantName: variant?.name ?? "—",
      version: version ? parseInt(version, 10) : null,
      versionLabel: version ?? null,
      paramSetUrl,
    };
  }).sort((a, b) => {
    let cmp = 0;
    if (sortKey === "serial") cmp = a.serial.localeCompare(b.serial);
    else if (sortKey === "client") cmp = (a.clientName ?? "").localeCompare(b.clientName ?? "");
    else if (sortKey === "family") cmp = `${a.familyName}/${a.variantName}`.localeCompare(`${b.familyName}/${b.variantName}`);
    else if (sortKey === "version") cmp = (a.version ?? -1) - (b.version ?? -1);
    return sortDir === "desc" ? -cmp : cmp;
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs mb-6 flex-wrap">
        <Link href="/" className="text-primary hover:underline cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-foreground font-medium">Fleet</span>
      </nav>

      <h1 className="text-xl font-semibold text-foreground mb-1">Fleet</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {rows.length} drone{rows.length !== 1 ? "s" : ""} registered across all clients.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drones registered yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-xs text-muted-foreground">
                <SortHeader label="Serial" col="serial" current={sortKey} dir={sortDir} baseUrl="/admin/drones" />
                <SortHeader label="Client" col="client" current={sortKey} dir={sortDir} baseUrl="/admin/drones" />
                <SortHeader label="Family / Variant" col="family" current={sortKey} dir={sortDir} baseUrl="/admin/drones" />
                <SortHeader label="Version" col="version" current={sortKey} dir={sortDir} baseUrl="/admin/drones" />
                <th className="px-4 py-2.5 text-left font-medium">Param set</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="group/row hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{row.serial}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground">
                    {row.clientName ?? <span className="text-muted-foreground italic">No client</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {row.familyName} / {row.variantName}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {row.versionLabel
                      ? <span className="font-mono text-primary">v{row.versionLabel}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {row.paramSetUrl
                      ? <Link href={row.paramSetUrl} className="text-primary hover:underline cursor-pointer">View</Link>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DeleteDroneButton droneId={row.id} serial={row.serial} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
