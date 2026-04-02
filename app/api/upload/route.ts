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
        controller.enqueue(msg("Reading file…"));
        const formData = await request.formData();
        const droneTypeId = formData.get("droneTypeId") as string;
        const paramSetId = formData.get("paramSetId") as string;
        const versionLabel = formData.get("versionLabel") as string;
        const changelog = (formData.get("changelog") as string | null) || null;
        const file = formData.get("file") as File | null;

        if (!file || !versionLabel || !droneTypeId || !paramSetId) {
          controller.enqueue(msg("Missing required fields", true));
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

        // 4. Upload file to storage
        const storagePath = `${paramSetId}/${versionLabel}.param`;
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

        // 5. Mark previous versions as not latest
        controller.enqueue(msg("Updating version history…"));
        await admin.from("param_versions").update({ is_latest: false }).eq("param_set_id", paramSetId);

        // 6. Insert new version record
        controller.enqueue(msg(`Creating version record (v${versionLabel})…`));
        const { data: pv, error: pvError } = await admin.from("param_versions").insert({
          param_set_id: paramSetId,
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
        controller.enqueue(encoder.encode(JSON.stringify({ done: true, paramSetId }) + "\n"));
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
