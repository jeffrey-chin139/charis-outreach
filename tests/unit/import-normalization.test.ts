import { describe, expect, it } from "vitest";
import { buildUnitLabel } from "@/lib/business-rules";

describe("display unit label", () => {
  it("uses the preserved floor and stack strings", () => {
    expect(buildUnitLabel("02", "20")).toBe("#02-20");
    expect(buildUnitLabel("18", "88")).toBe("#18-88");
  });
});
