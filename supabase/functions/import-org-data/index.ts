import { z } from "zod";

const payloadSchema = z.object({
  companyId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        employee_id: z.string().min(1),
        name: z.string().min(1),
        department: z.string().min(1),
        position_type: z.enum(["salaried", "indirect", "direct"]),
        position_name: z.string().min(1),
        manager_employee_id: z.string().optional(),
      }),
    )
    .min(1),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = payloadSchema.parse(await req.json());
    const summary = {
      companyId: payload.companyId,
      importedRows: payload.rows.length,
      issues: [] as string[],
      status: "accepted",
    };
    return Response.json(summary, { status: 202 });
  } catch (error) {
    return Response.json(
      {
        status: "rejected",
        message: error instanceof Error ? error.message : "Invalid payload",
      },
      { status: 400 },
    );
  }
});
