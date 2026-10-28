import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { LogSpikeHarness } from "@/components/log-spike-harness";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Log throughput spike — AIR6",
};

export default async function LogSpikePage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <p className="text-xs text-muted-foreground mb-6">Admin · temporary measurement harness</p>
      <h1 className="text-xl font-semibold mb-2">Log throughput spike</h1>
      <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
        Measures sustained throughput of a MAVLink dataflash log transfer. The transferred bytes are
        discarded — only the rate matters. The vehicle must be <span className="font-semibold text-foreground">disarmed</span>,
        or ArduPilot ignores the request.
      </p>
      <LogSpikeHarness />
    </div>
  );
}
