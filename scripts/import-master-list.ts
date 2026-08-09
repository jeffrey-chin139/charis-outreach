import { createClient } from "@supabase/supabase-js";
import readXlsxFile from "read-excel-file/node";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type MasterRow = {
  neighbourhood: string;
  block: string;
  floor: string;
  stack: string;
  active: boolean;
  source_batch_id: string;
};

loadLocalEnv();

const workbookPath = resolve(process.env.MASTER_LIST_PATH ?? "../neighbourhood master list.xlsx");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  if (!existsSync(workbookPath)) {
    throw new Error(`Master list not found: ${workbookPath}`);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing.");
  }

  const sheetRows = await readXlsxFile(workbookPath);
  const firstSheetName = "Sheet1";
  const sourceBatchId = randomUUID();
  const seen = new Set<string>();
  const duplicates: Array<{ rowNumber: number; key: string }> = [];
  const rows: MasterRow[] = [];
  const headers = new Map<string, number>();

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
    rows.push({ neighbourhood, block, floor, stack, active: true, source_batch_id: sourceBatchId });
  });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const chunkSize = 250;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase
      .from("residential_master")
      .upsert(chunk, { onConflict: "neighbourhood,block,floor,stack" });

    if (error) {
      throw error;
    }
  }

  writeFileSync(
    "master-import-report.json",
    JSON.stringify(
      {
        workbookPath,
        sheet: firstSheetName,
        sourceBatchId,
        importedRows: rows.length,
        duplicateRowsSkipped: duplicates
      },
      null,
      2
    )
  );

  console.log(`Imported ${rows.length} unique master rows.`);
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
