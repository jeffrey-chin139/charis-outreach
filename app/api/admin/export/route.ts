import { NextRequest, NextResponse } from "next/server";
import { endOfLocalDate, startOfLocalDate } from "@/lib/date-filters";
import { requireAdmin } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";
import { adminFiltersSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const view = request.nextUrl.searchParams.get("view") ?? "residential";
  const filters = adminFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const { data, error } =
    view === "street"
      ? await loadStreetRows(supabase, filters)
      : view === "residential"
        ? await loadResidentialRows(supabase, filters)
        : await supabase.from(view === "master" ? "residential_master" : "residential_unit_status").select("*").limit(5000);

  if (error) return NextResponse.json({ error: "Could not export records." }, { status: 500 });

  return new NextResponse(toCsv((data ?? []) as Array<Record<string, unknown>>), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="charis-${view}-export.csv"`
    }
  });
}

async function loadResidentialRows(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], filters: ReturnType<typeof adminFiltersSchema.parse>) {
  let query = supabase
    .from("residential_visits")
    .select("visit_timestamp, outcome, remarks, neighbourhood_snapshot, block_snapshot, floor_snapshot, stack_snapshot, unit_label_snapshot, outreach_sessions(volunteer_name)")
    .order("visit_timestamp", { ascending: false })
    .limit(5000);

  if (filters.dateFrom) query = query.gte("visit_timestamp", startOfLocalDate(filters.dateFrom));
  if (filters.dateTo) query = query.lte("visit_timestamp", endOfLocalDate(filters.dateTo));
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.block) query = query.eq("block_snapshot", filters.block);
  if (filters.unit) query = query.ilike("unit_label_snapshot", `%${filters.unit}%`);

  const { data, error } = await query;
  return {
    error,
    data: ((data ?? []) as Array<Record<string, any>>).map((row) => ({
      timestamp: formatCsvTimestamp(row.visit_timestamp),
      volunteer_name: Array.isArray(row.outreach_sessions) ? row.outreach_sessions[0]?.volunteer_name : row.outreach_sessions?.volunteer_name,
      neighbourhood: row.neighbourhood_snapshot,
      block: row.block_snapshot,
      unit: row.unit_label_snapshot,
      outcome: row.outcome,
      remarks: row.remarks
    }))
  };
}

async function loadStreetRows(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], filters: ReturnType<typeof adminFiltersSchema.parse>) {
  let query = supabase
    .from("street_e_encounters")
    .select("encounter_timestamp, encounter_number, outcome, location, remarks, outreach_sessions(volunteer_name)")
    .order("encounter_timestamp", { ascending: false })
    .limit(5000);

  if (filters.dateFrom) query = query.gte("encounter_timestamp", startOfLocalDate(filters.dateFrom));
  if (filters.dateTo) query = query.lte("encounter_timestamp", endOfLocalDate(filters.dateTo));
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.q) query = query.ilike("remarks", `%${filters.q}%`);

  const { data, error } = await query;
  return {
    error,
    data: ((data ?? []) as Array<Record<string, any>>).map((row) => ({
      timestamp: formatCsvTimestamp(row.encounter_timestamp),
      volunteer_name: Array.isArray(row.outreach_sessions) ? row.outreach_sessions[0]?.volunteer_name : row.outreach_sessions?.volunteer_name,
      location: row.location,
      outcome: row.outcome,
      remarks: row.remarks
    }))
  };
}

function formatCsvTimestamp(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}
