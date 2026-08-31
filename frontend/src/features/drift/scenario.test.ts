import { describe, expect, it } from "vitest";
import { drift } from "../../mocks/fixtures";
import { adjustSnapshots, BASELINE, interpolate } from "./scenario";
describe("drift scenarios", () => {
  it("keeps baseline deterministic", () =>
    expect(adjustSnapshots(drift, BASELINE)).toEqual(drift));
  it("interpolates time and centroid", () => {
    const x = interpolate(drift[0]!, drift[1]!, 0.5);
    expect(x.centroid.lat).toBeCloseTo(
      (drift[0]!.centroid.lat + drift[1]!.centroid.lat) / 2,
    );
    expect(Date.parse(x.at)).toBe(
      (Date.parse(drift[0]!.at) + Date.parse(drift[1]!.at)) / 2,
    );
  });
});
