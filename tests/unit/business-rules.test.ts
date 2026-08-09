import { describe, expect, it } from "vitest";
import { generateValidIntersections, isCompletedResidentialOutcome, isResidentialOutcome, isStreetEOutcome } from "@/lib/business-rules";
import { UNRECORDED } from "@/lib/types";

const masterRows = [
  { floor: "08", stack: "101" },
  { floor: "08", stack: "105" },
  { floor: "09", stack: "101" },
  { floor: "10", stack: "109" }
];

describe("residential unit generation", () => {
  it("returns only valid selected floor and stack intersections", () => {
    expect(generateValidIntersections(masterRows, ["08", "09"], ["101", "103"])).toEqual([
      { floor: "08", stack: "101" },
      { floor: "09", stack: "101" }
    ]);
  });

  it("does not mathematically invent missing combinations", () => {
    expect(generateValidIntersections(masterRows, ["08"], ["103"])).toEqual([]);
  });
});

describe("outcome rules", () => {
  it("does not treat Unrecorded as a completed residential outcome", () => {
    expect(isResidentialOutcome(UNRECORDED)).toBe(false);
    expect(isCompletedResidentialOutcome(UNRECORDED)).toBe(false);
  });

  it("keeps Street E outcomes separate from residential-only outcomes", () => {
    expect(isStreetEOutcome("Very positive")).toBe(true);
    expect(isStreetEOutcome("Do not revisit")).toBe(false);
  });
});
