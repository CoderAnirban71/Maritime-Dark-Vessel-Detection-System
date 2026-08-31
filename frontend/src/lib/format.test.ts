import { describe, expect, it } from "vitest";
import { formatCoord, formatDuration } from "./format";
describe("domain formatters", () => {
  it("formats coordinate hemispheres", () =>
    expect(formatCoord(-18.2, "N", "S")).toBe("18.200° S"));
  it("uses minutes below one hour", () =>
    expect(formatDuration(0.5)).toBe("30 min"));
});
