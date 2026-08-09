import { NextResponse } from "next/server";
import { hasSupabaseServerEnv } from "@/lib/local-master";
import { createServiceClient } from "@/lib/supabase/server";
import { residentialVisitSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const parsed = residentialVisitSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid residential visit." }, { status: 400 });
  }

  const input = parsed.data;

  if (!hasSupabaseServerEnv()) {
    return NextResponse.json(
      { error: "Supabase is not configured yet. Unit selection works locally, but saving visits needs .env.local values." },
      { status: 503 }
    );
  }

  const supabase = createServiceClient();

  const { data: master, error: masterError } = await supabase
    .from("residential_master")
    .select("id, neighbourhood, block, floor, stack, unit_label, active")
    .eq("id", input.masterId)
    .eq("neighbourhood", input.neighbourhood)
    .eq("block", input.block)
    .eq("active", true)
    .maybeSingle();

  if (masterError || !master) {
    return NextResponse.json({ error: "Invalid residential unit." }, { status: 400 });
  }

  const sessionId = input.sessionId ?? (await createResidentialSession(supabase, input.volunteerName, input.neighbourhood, input.block));

  if (input.existingVisitId) {
    const { data, error } = await supabase
      .from("residential_visits")
      .update({ outcome: input.outcome, remarks: input.remarks })
      .eq("id", input.existingVisitId)
      .select("id, visit_timestamp, updated_at")
      .single();

    if (error) return NextResponse.json({ error: "Could not update visit." }, { status: 500 });
    await syncDoNotRevisit(supabase, input.outcome, master.id);
    return NextResponse.json({ sessionId, visitId: data.id, visitTimestamp: data.visit_timestamp, updatedAt: data.updated_at });
  }

  const { data, error } = await supabase
    .from("residential_visits")
    .insert({
      session_id: sessionId,
      residential_master_id: master.id,
      neighbourhood_snapshot: master.neighbourhood,
      block_snapshot: master.block,
      floor_snapshot: master.floor,
      stack_snapshot: master.stack,
      unit_label_snapshot: master.unit_label,
      outcome: input.outcome,
      remarks: input.remarks
    })
    .select("id, visit_timestamp, updated_at")
    .single();

  if (error) return NextResponse.json({ error: "Could not save visit." }, { status: 500 });
  await syncDoNotRevisit(supabase, input.outcome, master.id);

  return NextResponse.json({ sessionId, visitId: data.id, visitTimestamp: data.visit_timestamp, updatedAt: data.updated_at });
}

async function createResidentialSession(
  supabase: ReturnType<typeof createServiceClient>,
  volunteerName: string,
  neighbourhood: "Haig Road" | "Dakota",
  block: string
) {
  const { data, error } = await supabase
    .from("outreach_sessions")
    .insert({
      volunteer_name: volunteerName,
      outreach_type: neighbourhood,
      residential_neighbourhood: neighbourhood,
      residential_block: block
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function syncDoNotRevisit(
  supabase: ReturnType<typeof createServiceClient>,
  outcome: string,
  residentialMasterId: string
) {
  if (outcome !== "Do not revisit") return;

  await supabase.from("residential_unit_status").upsert(
    {
      residential_master_id: residentialMasterId,
      do_not_revisit_active: true,
      activated_at: new Date().toISOString(),
      cleared_at: null,
      cleared_by: null
    },
    { onConflict: "residential_master_id" }
  );
}
