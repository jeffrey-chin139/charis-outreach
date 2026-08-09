export const OUTREACH_TYPES = ["Haig Road", "Dakota", "Street E"] as const;
export const RESIDENTIAL_OUTCOMES = [
  "Very positive",
  "Generally positive",
  "Not interested",
  "Not in / no answer",
  "Do not revisit",
  "Vacant / inaccessible"
] as const;
export const STREET_E_OUTCOMES = ["Very positive", "Generally positive"] as const;
export const UNRECORDED = "Unrecorded";

export type OutreachType = (typeof OUTREACH_TYPES)[number];
export type ResidentialOutcome = (typeof RESIDENTIAL_OUTCOMES)[number];
export type StreetEOutcome = (typeof STREET_E_OUTCOMES)[number];

export type ResidentialUnit = {
  id: string;
  neighbourhood: string;
  block: string;
  floor: string;
  stack: string;
  unitLabel: string;
  doNotRevisit: boolean;
};

export type GeneratedUnitState = ResidentialUnit & {
  outcome: ResidentialOutcome | typeof UNRECORDED;
  remarks: string;
  visitId?: string;
  savedState?: "idle" | "saving" | "saved" | "draft" | "error";
};
