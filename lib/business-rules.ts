import { RESIDENTIAL_OUTCOMES, STREET_E_OUTCOMES, UNRECORDED, type ResidentialOutcome, type StreetEOutcome } from "./types";

export function buildUnitLabel(floor: string, stack: string) {
  return `#${floor}-${stack}`;
}

export function generateValidIntersections<T extends { floor: string; stack: string }>(
  masterRows: T[],
  selectedFloors: string[],
  selectedStacks: string[]
) {
  const floorSet = new Set(selectedFloors);
  const stackSet = new Set(selectedStacks);
  return masterRows.filter((row) => floorSet.has(row.floor) && stackSet.has(row.stack));
}

export function isResidentialOutcome(value: unknown): value is ResidentialOutcome {
  return RESIDENTIAL_OUTCOMES.includes(value as ResidentialOutcome);
}

export function isStreetEOutcome(value: unknown): value is StreetEOutcome {
  return STREET_E_OUTCOMES.includes(value as StreetEOutcome);
}

export function isCompletedResidentialOutcome(value: unknown): value is ResidentialOutcome {
  return value !== UNRECORDED && isResidentialOutcome(value);
}

export function sanitizeFreeText(value: string, maxLength: number) {
  return value.replace(/\p{C}/gu, "").trim().slice(0, maxLength);
}

export function nextEncounterNumber(existingCount: number) {
  return existingCount + 1;
}
