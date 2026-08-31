import { NextRequest, NextResponse } from "next/server";
import { getLocalBlocks, getLocalOptions, hasSupabaseServerEnv } from "@/lib/local-master";
import { createServiceClient } from "@/lib/supabase/server";
import { residentialOptionsSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = residentialOptionsSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid residential option request." }, { status: 400 });
  }

  const { neighbourhood, block } = parsed.data;

  if (!hasSupabaseServerEnv()) {
    if (!block) return NextResponse.json({ blocks: getLocalBlocks(neighbourhood) });
    return NextResponse.json(getLocalOptions(neighbourhood, block));
  }

  const supabase = createServiceClient();

  if (!block) {
    const { data, error } = await supabase
      .from("residential_master")
      .select("block")
      .eq("neighbourhood", neighbourhood)
      .eq("active", true)
      .order("block");

    if (error) return NextResponse.json({ error: "Could not load blocks." }, { status: 500 });
    return NextResponse.json({ blocks: unique(data.map((row) => row.block)) });
  }

  const { data, error } = await supabase
    .from("residential_master")
    .select("floor, stack")
    .eq("neighbourhood", neighbourhood)
    .eq("block", block)
    .eq("active", true)
    .order("floor")
    .order("stack");

  if (error) return NextResponse.json({ error: "Could not load floor and stack options." }, { status: 500 });

  return NextResponse.json({
    floors: unique(data.map((row) => row.floor)),
    stacks: unique(data.map((row) => row.stack))
  });
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort(naturalSort);
}

function naturalSort(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}
