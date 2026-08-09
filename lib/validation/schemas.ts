import { z } from "zod";
import { OUTREACH_TYPES, RESIDENTIAL_OUTCOMES, STREET_E_OUTCOMES } from "@/lib/types";

const shortText = z.string().trim().min(1).max(120);
const optionalShortText = z.string().max(120).optional().transform((value) => value?.trim() ?? "");
const optionalRemarks = z.string().max(1000).optional().transform((value) => value?.trim() ?? "");

export const startSessionSchema = z.object({
  volunteerName: shortText,
  outreachType: z.enum(OUTREACH_TYPES),
  residentialBlock: z.string().trim().max(30).optional()
});

export const residentialOptionsSchema = z.object({
  neighbourhood: z.enum(["Haig Road", "Dakota"]),
  block: z.string().trim().max(30).optional()
});

export const residentialUnitsSchema = z.object({
  volunteerName: shortText,
  neighbourhood: z.enum(["Haig Road", "Dakota"]),
  block: shortText,
  floors: z.array(shortText).min(1).max(50),
  stacks: z.array(shortText).min(1).max(150)
});

export const residentialVisitSchema = z.object({
  sessionId: z.string().uuid().optional(),
  volunteerName: shortText,
  neighbourhood: z.enum(["Haig Road", "Dakota"]),
  block: shortText,
  masterId: z.string().uuid(),
  outcome: z.enum(RESIDENTIAL_OUTCOMES),
  remarks: optionalRemarks,
  existingVisitId: z.string().uuid().optional()
});

export const streetEEncounterSchema = z.object({
  sessionId: z.string().uuid().optional(),
  volunteerName: shortText,
  encounterNumber: z.number().int().positive().max(500),
  outcome: z.enum(STREET_E_OUTCOMES),
  location: optionalShortText,
  remarks: optionalRemarks,
  existingEncounterId: z.string().uuid().optional()
});

export const adminFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  outreachType: z.string().optional(),
  neighbourhood: z.string().optional(),
  block: z.string().optional(),
  floor: z.string().optional(),
  stack: z.string().optional(),
  unit: z.string().optional(),
  outcome: z.string().optional(),
  volunteerName: z.string().optional()
});
