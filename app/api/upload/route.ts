import { NextRequest } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { parseParamFile, writeParamFile } from "@/lib/param-engine";

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
        //   "new-client-set"  — variantId + clientName + serial (+ clientId/droneId) provided
        //   "new-drone"       — variantId + clientId + serial provided; registers the
        //                       drone inline, then creates its client_set. Used when a
        //                       param set arrives by email for a drone that was
        //                       never connected here.
        //   "default"         — variantId provided; resolves or creates the variant's Default client_set
        controller.enqueue(msg("Reading file…"));
        const formData = await request.formData();
        const mode = (formData.get("mode") as string | null) ?? "existing";
        const variantId = formData.get("variantId") as string | null;
        let clientSetId = formData.get("clientSetId") as string | null;
        const clientId = formData.get("clientId") as string | null;
        let droneId = formData.get("droneId") as string | null;
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
        if (mode === "default" && !variantId) {
          controller.enqueue(msg("Variant id is required", true));
          controller.close();
          return;
        }
        if (mode === "new-drone" && (!variantId || !clientId || !serial?.trim())) {
          controller.enqueue(msg("Variant, client and serial are required", true));
          controller.close();
          return;
        }
        if (!/^\d+$/.test(versionLabel.trim())) {
          controller.enqueue(msg("Invalid version format — must be a whole number (e.g. 1)", true));
          controller.close();
          return;
        }

        const fileBuffer = await file.arrayBuffer();
        controller.enqueue(msg(`File read — ${(fileBuffer.byteLength / 1024).toFixed(1)} KB`));

        const admin = createAdminClient();

        // 3a. Default mode — find or create the variant's Default client_set
        if (mode === "default") {
          controller.enqueue(msg("Resolving Default param set…"));
          const { data: existing } = await admin
            .from("client_sets")
            .select("id")
            .eq("variant_id", variantId!)
            .eq("is_default", true)
            .maybeSingle();
          if (existing) {
            clientSetId = existing.id;
          } else {
            const { data: newCs, error: csError } = await admin.from("client_sets").insert({
              client_name: "Default",
              serial: "",
              variant_id: variantId!,
              is_default: true,
              created_by: user.id,
            }).select("id").single();
            if (csError || !newCs) {
              controller.enqueue(msg(`Failed to create Default param set: ${csError?.message ?? "unknown error"}`, true));
              controller.close();
              return;
            }
            clientSetId = newCs.id;
          }
        }

        // 3a-bis. new-drone mode — register the drone, then fall through to
        // client_set creation with the id we just minted.
        if (mode === "new-drone") {
          const trimmedSerial = serial!.trim();
          controller.enqueue(msg(`Registering drone "${trimmedSerial}"…`));

          // Reuse an existing drone with this serial for this client if one is
          // already registered, so re-uploading a file is idempotent.
          const { data: existingDrone } = await admin
            .from("drones")
            .select("id, variant_id")
            .eq("client_id", clientId!)
            .eq("serial", trimmedSerial)
            .maybeSingle();

          if (existingDrone) {
            if (existingDrone.variant_id !== variantId) {
              controller.enqueue(msg(
                `Drone "${trimmedSerial}" is already registered to this client on a different variant`,
                true
              ));
              controller.close();
              return;
            }
            droneId = existingDrone.id;
            controller.enqueue(msg("Drone already registered — reusing it"));
          } else {
            // Adopt a matching orphan drone (registered at bring-up with no
            // client) rather than creating a duplicate serial.
            const { data: orphan } = await admin
              .from("drones")
              .select("id, variant_id")
              .is("client_id", null)
              .eq("serial", trimmedSerial)
              .maybeSingle();

            if (orphan && orphan.variant_id === variantId) {
              const { error: adoptError } = await admin
                .from("drones")
                .update({ client_id: clientId! })
                .eq("id", orphan.id);
              if (adoptError) {
                controller.enqueue(msg(`Failed to assign drone to client: ${adoptError.message}`, true));
                controller.close();
                return;
              }
              droneId = orphan.id;
              controller.enqueue(msg("Adopted existing unassigned drone"));
            } else {
              const { data: newDrone, error: droneError } = await admin
                .from("drones")
                .insert({
                  serial: trimmedSerial,
                  variant_id: variantId!,
                  client_id: clientId!,
                  created_by: user.id,
                })
                .select("id")
                .single();
              if (droneError || !newDrone) {
                const errMsg = droneError?.code === "23505"
                  ? `A drone with serial "${trimmedSerial}" already exists`
                  : (droneError?.message ?? "unknown error");
                controller.enqueue(msg(`Failed to register drone: ${errMsg}`, true));
                controller.close();
                return;
              }
              droneId = newDrone.id;
              controller.enqueue(msg("Drone registered"));
            }
          }

          // Reuse the drone's client_set on this variant if it already has one.
          const { data: existingCs } = await admin
            .from("client_sets")
            .select("id")
            .eq("drone_id", droneId)
            .eq("variant_id", variantId!)
            .maybeSingle();
          if (existingCs) clientSetId = existingCs.id;
        }

        // 3b. Create new client set under existing variant if needed
        if ((mode === "new-client-set" || mode === "new-drone") && !clientSetId) {
          // new-drone mode identifies the client by id, so resolve its name here.
          let resolvedClientName = clientName?.trim() ?? "";
          if (!resolvedClientName && clientId) {
            const { data: clientRow } = await admin
              .from("clients")
              .select("name")
              .eq("id", clientId)
              .maybeSingle();
            resolvedClientName = clientRow?.name ?? "";
          }
          if (!resolvedClientName) {
            controller.enqueue(msg("Could not resolve the client name", true));
            controller.close();
            return;
          }
          controller.enqueue(msg(`Creating client set "${resolvedClientName} · ${serial}"…`));
          const { data: newCs, error: csError } = await admin.from("client_sets").insert({
            client_name: resolvedClientName,
            serial: serial!.trim(),
            variant_id: variantId!,
            client_id: clientId,
            drone_id: droneId,
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

        // 4. Parse params and inject version markers.
        //    SCR_USER2 = version label (always — so flashed drones self-report).
        //    SCR_USER1 = 0 for Default param sets — the Default is a catalog
        //    reference, not tied to a physical drone serial.
        const { data: csRow } = await admin
          .from("client_sets")
          .select("is_default")
          .eq("id", clientSetId!)
          .maybeSingle();
        const isDefaultSet = csRow?.is_default === true;

        const fileText = Buffer.from(fileBuffer).toString("utf-8");
        const parsedParams = parseParamFile(fileText);

        const scrUser2Idx = parsedParams.findIndex((p) => p.name === "SCR_USER2");
        if (scrUser2Idx >= 0) {
          parsedParams[scrUser2Idx] = { ...parsedParams[scrUser2Idx], value: versionLabel };
        } else {
          parsedParams.push({ name: "SCR_USER2", value: versionLabel });
        }

        if (isDefaultSet) {
          const scrUser1Idx = parsedParams.findIndex((p) => p.name === "SCR_USER1");
          if (scrUser1Idx >= 0) {
            parsedParams[scrUser1Idx] = { ...parsedParams[scrUser1Idx], value: "0" };
          } else {
            parsedParams.push({ name: "SCR_USER1", value: "0" });
          }
        }
        const updatedFileText = writeParamFile(parsedParams);
        const updatedBuffer = Buffer.from(updatedFileText, "utf-8");

        // 5. Upload (updated) file to storage
        const storagePath = `${clientSetId}/${versionLabel}.param`;
        controller.enqueue(msg(`Uploading to storage (${storagePath})…`));
        const { error: uploadError } = await admin.storage
          .from("param-files")
          .upload(storagePath, updatedBuffer, { contentType: "text/plain", upsert: true });

        if (uploadError) {
          controller.enqueue(msg(`Storage upload failed: ${uploadError.message}`, true));
          controller.close();
          return;
        }
        controller.enqueue(msg("File stored successfully"));

        // 6. Mark previous versions of this client set as not latest
        controller.enqueue(msg("Updating version history…"));
        await admin.from("param_versions").update({ is_latest: false }).eq("client_set_id", clientSetId!);

        // 7. Insert new version record
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

        // 8. Store param values — deduplicate by name first (last occurrence wins)
        //    so .param files with duplicate entries don't create duplicate DB rows.
        const paramMap = new Map(parsedParams.map(({ name, value }) => [name, value]));
        // Always enforce SCR_ENABLE=1 — required for SCR_USER1/2 to persist
        paramMap.set("SCR_ENABLE", "1");
        const paramValues = Array.from(paramMap.entries()).map(([name, value]) => ({
          param_version_id: pv.id,
          name,
          value,
        }));

        controller.enqueue(msg(`Indexing ${paramValues.length} parameters…`));
        if (paramValues.length > 0) {
          for (let i = 0; i < paramValues.length; i += 500) {
            await admin.from("param_values").insert(paramValues.slice(i, i + 500));
          }
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
