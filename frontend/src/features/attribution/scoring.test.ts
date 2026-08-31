import { describe, expect, it } from "vitest";
import { vessels } from "../../mocks/fixtures";
import { calculateCandidate } from "./scoring";
describe("candidate scoring", () => {
  it("is normalized and deterministic", () => {
    const a = calculateCandidate(vessels[0]!, 0, "I");
    const b = calculateCandidate(vessels[0]!, 0, "I");
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
  });
  it("penalizes weaker candidates", () =>
    expect(calculateCandidate(vessels[0]!, 0, "I").score).toBeGreaterThan(
      calculateCandidate(vessels[5]!, 5, "I").score,
    ));
});
