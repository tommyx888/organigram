import { NextRequest, NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  createServerSupabaseClientWithUser,
} from "@/lib/supabase/server";

const BUCKET = "employee-photos";

function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

async function resolveCompanyId(supabase: NonNullable<ReturnType<typeof createServerSupabaseClientWithUser>>) {
  const { data: roleRow } = await supabase
    .from("user_company_roles")
    .select("company_id")
    .limit(1)
    .maybeSingle();
  if (roleRow?.company_id) return roleRow.company_id;
  const { data: companyRows } = await supabase
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  return companyRows?.[0]?.id ?? null;
}

/** POST: nahratie fotky (body JSON: { employeeId, dataUrl }) */
export async function POST(request: NextRequest) {
  const token = getAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUser = createServerSupabaseClientWithUser(token);
  if (!supabaseUser) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const companyId = await resolveCompanyId(supabaseUser);
  if (!companyId) {
    return NextResponse.json(
      {
        error: "No company context",
        hint: "Ensure your user has a row in user_company_roles (e.g. run the admin grant SQL for your email).",
      },
      { status: 400 },
    );
  }

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  let body: { employeeId?: string; dataUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : null;
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : null;
  if (!employeeId || !dataUrl || !dataUrl.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Missing or invalid employeeId / dataUrl (expect data URL for image)" },
      { status: 400 },
    );
  }

  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid data URL format" }, { status: 400 });
  }
  const [, ext, base64] = match;
  const extension = ext === "jpeg" ? "jpg" : ext;
  const buffer = Buffer.from(base64, "base64");
  const path = `${companyId}/${employeeId}.${extension}`;

  // Storage upload cez service role – obchádza RLS (používateľ už overený vyššie).
  const supabaseAdmin = createServerSupabaseClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: `image/${ext}`, upsert: true });

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed", detail: uploadError.message },
      { status: 500 },
    );
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const photoUrl = urlData.publicUrl;

  const { error: upsertError } = await supabaseUser
    .from("employee_photo_urls")
    .upsert(
      { company_id: companyId, employee_id: employeeId, photo_url: photoUrl, updated_at: new Date().toISOString() },
      { onConflict: "company_id,employee_id" },
    );

  if (upsertError) {
    return NextResponse.json(
      { error: "Save photo URL failed", detail: upsertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ photoUrl });
}

/** DELETE: odstránenie fotky (query: employeeId=) */
export async function DELETE(request: NextRequest) {
  const token = getAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUser = createServerSupabaseClientWithUser(token);
  if (!supabaseUser) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const companyId = await resolveCompanyId(supabaseUser);
  if (!companyId) {
    return NextResponse.json(
      {
        error: "No company context",
        hint: "Ensure your user has a row in user_company_roles (e.g. run the admin grant SQL for your email).",
      },
      { status: 400 },
    );
  }

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const employeeId = request.nextUrl.searchParams.get("employeeId")?.trim();
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });
  }

  await supabaseUser
    .from("employee_photo_urls")
    .delete()
    .eq("company_id", companyId)
    .eq("employee_id", employeeId);

  const extensions = ["jpg", "jpeg", "png", "gif", "webp"];
  const paths = extensions.map((ext) => `${companyId}/${employeeId}.${ext}`);
  const supabaseAdmin = createServerSupabaseClient();
  if (supabaseAdmin) {
    await supabaseAdmin.storage.from(BUCKET).remove(paths);
  }

  return NextResponse.json({ ok: true });
}
