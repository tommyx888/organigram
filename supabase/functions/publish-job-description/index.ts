import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  jobDescriptionId: z.string().uuid(),
  companyId: z.string().uuid(),
  versionNo: z.number().int().positive(),
  effectiveFrom: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response("Missing Supabase environment variables.", { status: 500 });
  }

  try {
    const payload = schema.parse(await req.json());
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { error: jdError } = await supabase
      .from("job_descriptions")
      .update({ status: "effective" })
      .eq("id", payload.jobDescriptionId)
      .eq("company_id", payload.companyId);

    if (jdError) {
      return Response.json({ status: "error", message: jdError.message }, { status: 400 });
    }

    const { error: versionError } = await supabase
      .from("job_description_versions")
      .update({ effective_from: payload.effectiveFrom ?? new Date().toISOString().slice(0, 10) })
      .eq("job_description_id", payload.jobDescriptionId)
      .eq("version_no", payload.versionNo);

    if (versionError) {
      return Response.json({ status: "error", message: versionError.message }, { status: 400 });
    }

    return Response.json({
      status: "effective",
      jobDescriptionId: payload.jobDescriptionId,
      versionNo: payload.versionNo,
    });
  } catch (error) {
    return Response.json(
      { status: "error", message: error instanceof Error ? error.message : "Invalid payload" },
      { status: 400 },
    );
  }
});
