import { NextRequest, NextResponse } from "next/server";
import { endOfLocalDate, startOfLocalDate } from "@/lib/date-filters";
import { requireAdmin } from "@/lib/supabase/admin";
import { adminFiltersSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const filters = adminFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  let query = supabase
    .from("residential_visits")
    .select("id, visit_timestamp, outcome, remarks, neighbourhood_snapshot, block_snapshot, floor_snapshot, stack_snapshot, unit_label_snapshot, outreach_sessions(volunteer_name)")
    .order("visit_timestamp", { ascending: false })
    .limit(500);

  if (filters.dateFrom) query = query.gte("visit_timestamp", startOfLocalDate(filters.dateFrom));
  if (filters.dateTo) query = query.lte("visit_timestamp", endOfLocalDate(filters.dateTo));
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.block) query = query.eq("block_snapshot", filters.block);
  if (filters.floor) query = query.eq("floor_snapshot", filters.floor);
  if (filters.stack) query = query.eq("stack_snapshot", filters.stack);
  if (filters.unit) query = query.ilike("unit_label_snapshot", `%${filters.unit}%`);
  if (filters.q) query = query.or(`remarks.ilike.%${filters.q}%,unit_label_snapshot.ilike.%${filters.q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load residential visits." }, { status: 500 });

  const rows = ((data ?? []) as Array<Record<string, any>>).map((row) => ({
    id: row.id,
    visit_timestamp: row.visit_timestamp,
    volunteer_name: Array.isArray(row.outreach_sessions) ? row.outreach_sessions[0]?.volunteer_name : row.outreach_sessions?.volunteer_name,
    outcome: row.outcome,
    unit: row.unit_label_snapshot,
    neighbourhood: row.neighbourhood_snapshot,
    block: row.block_snapshot,
    floor: row.floor_snapshot,
    stack: row.stack_snapshot,
    remarks: row.remarks
  })).filter((row) => !filters.volunteerName || String(row.volunteer_name).toLowerCase().includes(filters.volunteerName.toLowerCase()));

  return NextResponse.json({ rows, summary: summarize(rows) });
}

export async function PATCH(request: Request) {
  const { supabase, isAdmin, user } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing record id." }, { status: 400 });

  const patch: Record<string, unknown> = { edited_by: user?.id };
  if (typeof body.outcome === "string") patch.outcome = body.outcome;
  if (typeof body.remarks === "string") patch.remarks = body.remarks.slice(0, 1000);

  const { error } = await supabase.from("residential_visits").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not update visit." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function summarize(rows: Array<{ outcome: unknown }>) {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(String(row.outcome), (counts.get(String(row.outcome)) ?? 0) + 1));
  return Array.from(counts, ([outcome, count]) => ({ outcome, count }));
}
