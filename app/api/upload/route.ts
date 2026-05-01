import { NextRequest } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { parseParamFile } from "@/lib/param-engine";

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  function msg(text: string, error = false) {
    return encoder.encode(JSON.stringify({ text, error }) + "\n");
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 1. Verify session
        controller.enqueue(msg("Verifying session…"));
        const supabase = await createSessionClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          controller.enqueue(msg("Unauthorized", true));
          controller.close();
          return;
        }

        // 2. Verify role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (!profile || !["contributor", "admin"].includes(profile.role)) {
          controller.enqueue(msg("Forbidden — insufficient role", true));
          controller.close();
          return;
        }

        // 3. Parse form data
        // Modes:
        //   "existing"        — clientSetId provided
        //   "new-client-set"  — variantId + clientName + serial provided
        controller.enqueue(msg("Reading file…"));
        const formData = await request.formData();
        const mode = (formData.get("mode") as string | null) ?? "existing";
        const variantId = formData.get("variantId") as string | null;
        let clientSetId = formData.get("clientSetId") as string | null;
        const clientName = formData.get("clientName") as string | null;
        const serial = formData.get("serial") as string | null;
        const versionLabel = formData.get("versionLabel") as string;
        const changelog = (formData.get("changelog") as string | null) || null;
        const file = formData.get("file") as File | null;

        if (!file || !versionLabel) {
          controller.enqueue(msg("Missing required fields", true));
          controller.close();
          return;
        }
        if (mode === "existing" && !clientSetId) {
          controller.enqueue(msg("Client set id is required", true));
          controller.close();
          return;
        }
        if (mode === "new-client-set" && (!variantId || !clientName?.trim() || !serial?.trim())) {
          controller.enqueue(msg("Variant id, client name and serial are required", true));
          controller.close();
          return;
        }
        if (!/^\d+\.\d+$/.test(versionLabel.trim())) {
          controller.enqueue(msg("Invalid version format", true));
          controller.close();
          return;
        }

        const fileBuffer = await file.arrayBuffer();
        controller.enqueue(msg(`File read — ${(fileBuffer.byteLength / 1024).toFixed(1)} KB`));

        const admin = createAdminClient();

        // 3b. Create new client set under existing variant if needed
        if (mode === "new-client-set") {
          controller.enqueue(msg(`Creating client set "${clientName} · ${serial}"…`));
          const { data: newCs, error: csError } = await admin.from("client_sets").insert({
            client_name: clientName!.trim(),
            serial: serial!.trim(),
            variant_id: variantId!,
            created_by: user.id,
          }).select("id").single();
          if (csError || !newCs) {
            const errMsg = csError?.code === "23505"
              ? "This client + serial already exists for this variant"
              : (csError?.message ?? "unknown error");
            controller.enqueue(msg(`Failed to create client set: ${errMsg}`, true));
            controller.close();
            return;
          }
          clientSetId = newCs.id;
        }

        // 4. Upload file to storage
        const storagePath = `${clientSetId}/${versionLabel}.param`;
        controller.enqueue(msg(`Uploading to storage (${storagePath})…`));
        const { error: uploadError } = await admin.storage
          .from("param-files")
          .upload(storagePath, fileBuffer, { contentType: "text/plain", upsert: true });

        if (uploadError) {
          controller.enqueue(msg(`Storage upload failed: ${uploadError.message}`, true));
          controller.close();
          return;
        }
        controller.enqueue(msg("File stored successfully"));

        // 5. Mark previous versions of this client set as not latest
        controller.enqueue(msg("Updating version history…"));
        await admin.from("param_versions").update({ is_latest: false }).eq("client_set_id", clientSetId!);

        // 6. Insert new version record
        controller.enqueue(msg(`Creating version record (v${versionLabel})…`));
        const { data: pv, error: pvError } = await admin.from("param_versions").insert({
          client_set_id: clientSetId!,
          version_label: versionLabel,
          storage_path: storagePath,
          changelog,
          created_by: user.id,
          is_latest: true,
        }).select("id").single();

        if (pvError || !pv) {
          controller.enqueue(msg(`Failed to create version: ${pvError?.message ?? "unknown error"}`, true));
          controller.close();
          return;
        }

        // 7. Parse and store param values
        const fileText = Buffer.from(fileBuffer).toString("utf-8");
        const paramValues = parseParamFile(fileText).map(({ name, value }) => ({
          param_version_id: pv.id,
          name,
          value,
        }));

        controller.enqueue(msg(`Indexing ${paramValues.length} parameters…`));
        if (paramValues.length > 0) {
          await admin.from("param_values").insert(paramValues);
        }

        controller.enqueue(msg(`Done — v${versionLabel} uploaded with ${paramValues.length} params`));
        controller.enqueue(encoder.encode(JSON.stringify({ done: true, clientSetId }) + "\n"));
      } catch (e) {
        const msg2 = (e instanceof Error ? e.message : "Unexpected error");
        controller.enqueue(encoder.encode(JSON.stringify({ text: msg2, error: true }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}
