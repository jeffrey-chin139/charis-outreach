import readXlsxFile from "read-excel-file/node";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildUnitLabel } from "../lib/business-rules";

type LocalMasterRow = {
  id: string;
  neighbourhood: string;
  block: string;
  floor: string;
  stack: string;
  unitLabel: string;
  doNotRevisit: boolean;
};

loadLocalEnv();

const workbookPath = resolve(process.env.MASTER_LIST_PATH ?? "../neighbourhood master list.xlsx");
const outputPath = resolve("lib/master-data.json");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  if (!existsSync(workbookPath)) {
    throw new Error(`Master list not found: ${workbookPath}`);
  }

  const sheetRows = await readXlsxFile(workbookPath);
  const headers = new Map<string, number>();
  const seen = new Set<string>();
  const duplicates: Array<{ rowNumber: number; key: string }> = [];
  const rows: LocalMasterRow[] = [];

  sheetRows[0].forEach((cell, index) => {
    headers.set(normalize(cell), index);
  });

  for (const requiredHeader of ["Neighbourhood", "Block", "Floor", "Stack"]) {
    if (!headers.has(requiredHeader)) {
      throw new Error(`Missing required header: ${requiredHeader}`);
    }
  }

  sheetRows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const neighbourhood = normalize(row[headers.get("Neighbourhood")!]);
    const block = normalize(row[headers.get("Block")!]);
    const floor = normalize(row[headers.get("Floor")!]).padStart(2, "0");
    const stack = normalize(row[headers.get("Stack")!]);

    if (!neighbourhood && !block && !floor && !stack) return;

    if (!neighbourhood || !block || !floor || !stack) {
      throw new Error(`Blank required field on worksheet row ${rowNumber}.`);
    }

    const key = [neighbourhood, block, floor, stack].join("|");
    if (seen.has(key)) {
      duplicates.push({ rowNumber, key });
      return;
    }

    seen.add(key);
    rows.push({
      id: `local-${rows.length + 1}`,
      neighbourhood,
      block,
      floor,
      stack,
      unitLabel: buildUnitLabel(floor, stack),
      doNotRevisit: false
    });
  });

  writeFileSync(outputPath, `${JSON.stringify({ rows }, null, 2)}\n`);

  console.log(`Synced ${rows.length} unique local master rows.`);
  console.log(`Skipped ${duplicates.length} duplicate rows.`);
}

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function loadLocalEnv() {
  const envPath = resolve(".env.local");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}
