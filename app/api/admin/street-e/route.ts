import { NextRequest, NextResponse } from "next/server";
import { endOfLocalDate, startOfLocalDate } from "@/lib/date-filters";
import { requireAdmin } from "@/lib/supabase/admin";
import { adminFiltersSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const filters = adminFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  let query = supabase
    .from("street_e_encounters")
    .select("id, encounter_timestamp, encounter_number, outcome, location, remarks, outreach_sessions(volunteer_name)")
    .order("encounter_timestamp", { ascending: false })
    .limit(500);

  if (filters.dateFrom) query = query.gte("encounter_timestamp", startOfLocalDate(filters.dateFrom));
  if (filters.dateTo) query = query.lte("encounter_timestamp", endOfLocalDate(filters.dateTo));
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.q) query = query.ilike("remarks", `%${filters.q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load Street E encounters." }, { status: 500 });

  const rows = ((data ?? []) as Array<Record<string, any>>).map((row) => ({
    id: row.id,
    encounter_timestamp: row.encounter_timestamp,
    volunteer_name: Array.isArray(row.outreach_sessions) ? row.outreach_sessions[0]?.volunteer_name : row.outreach_sessions?.volunteer_name,
    encounter_number: row.encounter_number,
    outcome: row.outcome,
    location: row.location,
    remarks: row.remarks
  })).filter((row) => !filters.volunteerName || String(row.volunteer_name).toLowerCase().includes(filters.volunteerName.toLowerCase()));

  return NextResponse.json({ rows, summary: summarize(rows) });
}

export async function PATCH(request: Request) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing encounter id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.outcome === "string") patch.outcome = body.outcome;
  if (typeof body.location === "string") patch.location = body.location.slice(0, 120);
  if (typeof body.remarks === "string") patch.remarks = body.remarks.slice(0, 1000);

  const { error } = await supabase.from("street_e_encounters").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not update encounter." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function summarize(rows: Array<{ outcome: unknown }>) {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(String(row.outcome), (counts.get(String(row.outcome)) ?? 0) + 1));
  return Array.from(counts, ([outcome, count]) => ({ outcome, count }));
}
