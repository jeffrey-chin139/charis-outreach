import { NextResponse } from "next/server";
import { getLocalUnits, hasSupabaseServerEnv } from "@/lib/local-master";
import { createServiceClient } from "@/lib/supabase/server";
import { residentialUnitsSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const parsed = residentialUnitsSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid unit generation request." }, { status: 400 });
  }

  const { neighbourhood, block, floors, stacks } = parsed.data;

  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ units: getLocalUnits(neighbourhood, block, floors, stacks), localOnly: true });
  }

  const supabase = createServiceClient();

  const { data: masterRows, error } = await supabase
    .from("residential_master")
    .select("id, neighbourhood, block, floor, stack, unit_label, residential_unit_status(do_not_revisit_active)")
    .eq("neighbourhood", neighbourhood)
    .eq("block", block)
    .eq("active", true)
    .in("floor", floors)
    .in("stack", stacks)
    .order("floor")
    .order("stack");

  if (error) return NextResponse.json({ error: "Could not generate units." }, { status: 500 });

  return NextResponse.json({
    units: ((masterRows ?? []) as Array<Record<string, any>>).map((row) => ({
      id: row.id,
      neighbourhood: row.neighbourhood,
      block: row.block,
      floor: row.floor,
      stack: row.stack,
      unitLabel: row.unit_label,
      doNotRevisit: Array.isArray(row.residential_unit_status)
        ? row.residential_unit_status.some((status) => status.do_not_revisit_active)
        : Boolean(row.residential_unit_status?.do_not_revisit_active)
    }))
  });
}
