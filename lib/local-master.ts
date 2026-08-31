import masterData from "./master-data.json";
import type { ResidentialUnit } from "./types";

type LocalMasterRow = {
  id: string;
  neighbourhood: string;
  block: string;
  floor: string;
  stack: string;
  unitLabel: string;
  doNotRevisit: boolean;
};

const rows = masterData.rows as LocalMasterRow[];

export function hasSupabaseServerEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return Boolean(
    url &&
      serviceKey &&
      !url.includes("your-project.supabase.co") &&
      !serviceKey.includes("server-only-service-role-key")
  );
}

export function getLocalBlocks(neighbourhood: "Haig Road" | "Dakota") {
  return unique(rows.filter((row) => row.neighbourhood === neighbourhood).map((row) => row.block));
}

export function getLocalOptions(neighbourhood: "Haig Road" | "Dakota", block: string) {
  const blockRows = rows.filter((row) => row.neighbourhood === neighbourhood && row.block === block);
  return {
    floors: unique(blockRows.map((row) => row.floor)),
    stacks: unique(blockRows.map((row) => row.stack))
  };
}

export function getLocalUnits(
  neighbourhood: "Haig Road" | "Dakota",
  block: string,
  floors: string[],
  stacks: string[]
): ResidentialUnit[] {
  const floorSet = new Set(floors);
  const stackSet = new Set(stacks);

  return rows
    .filter((row) => row.neighbourhood === neighbourhood && row.block === block && floorSet.has(row.floor) && stackSet.has(row.stack))
    .map((row) => ({
      id: row.id,
      neighbourhood: row.neighbourhood,
      block: row.block,
      floor: row.floor,
      stack: row.stack,
      unitLabel: row.unitLabel,
      doNotRevisit: row.doNotRevisit
    }));
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort(naturalSort);
}

function naturalSort(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}
