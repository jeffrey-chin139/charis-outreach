import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { adminFiltersSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const filters = adminFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));

  let query = supabase
    .from("residential_unit_status")
    .select("id, do_not_revisit_active, reason, activated_at, cleared_at, residential_master(id, neighbourhood, block, floor, stack, unit_label)")
    .order("updated_at", { ascending: false })
    .limit(500);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load unit statuses." }, { status: 500 });

  const rows = ((data ?? []) as Array<Record<string, any>>).map((row) => {
    const master = Array.isArray(row.residential_master) ? row.residential_master[0] : row.residential_master;
    return {
      id: row.id,
      do_not_revisit_active: row.do_not_revisit_active,
      reason: row.reason,
      neighbourhood: master?.neighbourhood,
      block: master?.block,
      floor: master?.floor,
      stack: master?.stack,
      unit: master?.unit_label,
      activated_at: row.activated_at,
      cleared_at: row.cleared_at
    };
  }).filter((row) => {
    if (filters.block && row.block !== filters.block) return false;
    if (filters.unit && !String(row.unit).includes(filters.unit)) return false;
    if (filters.q && !JSON.stringify(row).toLowerCase().includes(filters.q.toLowerCase())) return false;
    return true;
  });

  return NextResponse.json({ rows, summary: [{ label: "Active", count: rows.filter((row) => row.do_not_revisit_active).length }] });
}

export async function PATCH(request: Request) {
  const { supabase, isAdmin, user } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing status id." }, { status: 400 });

  const activeChanged = typeof body.do_not_revisit_active === "boolean";
  const patch: Record<string, unknown> = {};
  if (activeChanged) {
    patch.do_not_revisit_active = body.do_not_revisit_active;
    if (body.do_not_revisit_active) {
      patch.activated_by = user?.id;
      patch.activated_at = new Date().toISOString();
      patch.cleared_by = null;
      patch.cleared_at = null;
    } else {
      patch.cleared_by = user?.id;
      patch.cleared_at = new Date().toISOString();
    }
  }
  if (typeof body.reason === "string") patch.reason = body.reason.slice(0, 1000);

  const { error } = await supabase.from("residential_unit_status").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not update status." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
