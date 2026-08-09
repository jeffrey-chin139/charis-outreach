import { NextResponse } from "next/server";
import { hasSupabaseServerEnv } from "@/lib/local-master";
import { createServiceClient } from "@/lib/supabase/server";
import { streetEEncounterSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const parsed = streetEEncounterSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Street E encounter." }, { status: 400 });
  }

  const input = parsed.data;

  if (!hasSupabaseServerEnv()) {
    return NextResponse.json(
      { error: "Supabase is not configured yet. Street E saving needs .env.local values." },
      { status: 503 }
    );
  }

  const supabase = createServiceClient();
  const sessionId = input.sessionId ?? (await createStreetESession(supabase, input.volunteerName));

  if (input.existingEncounterId) {
    const { data, error } = await supabase
      .from("street_e_encounters")
      .update({ outcome: input.outcome, location: input.location, remarks: input.remarks })
      .eq("id", input.existingEncounterId)
      .select("id, encounter_timestamp, updated_at")
      .single();

    if (error) return NextResponse.json({ error: "Could not update encounter." }, { status: 500 });
    return NextResponse.json({ sessionId, encounterId: data.id, encounterTimestamp: data.encounter_timestamp, updatedAt: data.updated_at });
  }

  const { data, error } = await supabase
    .from("street_e_encounters")
    .insert({
      session_id: sessionId,
      encounter_number: input.encounterNumber,
      outcome: input.outcome,
      location: input.location,
      remarks: input.remarks
    })
    .select("id, encounter_timestamp, updated_at")
    .single();

  if (error) return NextResponse.json({ error: "Could not save encounter." }, { status: 500 });
  return NextResponse.json({ sessionId, encounterId: data.id, encounterTimestamp: data.encounter_timestamp, updatedAt: data.updated_at });
}

async function createStreetESession(supabase: ReturnType<typeof createServiceClient>, volunteerName: string) {
  const { data, error } = await supabase
    .from("outreach_sessions")
    .insert({ volunteer_name: volunteerName, outreach_type: "Street E" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}
