import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { adminFiltersSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const filters = adminFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));

  let query = supabase
    .from("residential_master")
    .select("id, neighbourhood, block, floor, stack, unit_label, active, created_at, updated_at")
    .order("neighbourhood")
    .order("block")
    .order("floor")
    .order("stack")
    .limit(1000);

  if (filters.block) query = query.eq("block", filters.block);
  if (filters.floor) query = query.eq("floor", filters.floor);
  if (filters.stack) query = query.eq("stack", filters.stack);
  if (filters.q) query = query.or(`neighbourhood.ilike.%${filters.q}%,block.ilike.%${filters.q}%,floor.ilike.%${filters.q}%,stack.ilike.%${filters.q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load master list." }, { status: 500 });
  return NextResponse.json({ rows: data ?? [], summary: [{ label: "Rows", count: data?.length ?? 0 }] });
}

export async function POST(request: Request) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const { error } = await supabase.from("residential_master").insert({
    neighbourhood: String(body?.neighbourhood ?? "").trim(),
    block: String(body?.block ?? "").trim(),
    floor: String(body?.floor ?? "").trim(),
    stack: String(body?.stack ?? "").trim(),
    active: body?.active ?? true
  });
  if (error) return NextResponse.json({ error: "Could not add master record." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing master id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  ["neighbourhood", "block", "floor", "stack"].forEach((field) => {
    if (typeof body[field] === "string") patch[field] = body[field].trim();
  });
  if (typeof body.active === "boolean") patch.active = body.active;

  const { error } = await supabase.from("residential_master").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not update master record." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
