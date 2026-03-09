import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  snapshotId: z.string().uuid(),
  companyId: z.string().uuid(),
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

    const { error } = await supabase
      .from("org_snapshots")
      .update({ status: "published" })
      .eq("id", payload.snapshotId)
      .eq("company_id", payload.companyId);

    if (error) {
      return Response.json({ status: "error", message: error.message }, { status: 400 });
    }

    return Response.json({ status: "published", snapshotId: payload.snapshotId });
  } catch (error) {
    return Response.json(
      { status: "error", message: error instanceof Error ? error.message : "Invalid payload" },
      { status: 400 },
    );
  }
});
