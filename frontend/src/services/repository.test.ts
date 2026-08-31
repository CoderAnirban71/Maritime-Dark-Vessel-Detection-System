import { beforeEach, describe, expect, it } from "vitest";
import { cases } from "../mocks/fixtures";
import { caseRepository } from "./repository";
describe("case repository", () => {
  beforeEach(() => localStorage.clear());
  it("uses fallback then persists versioned data", () => {
    expect(caseRepository.load(cases)).toEqual(cases);
    caseRepository.save([cases[0]!]);
    expect(caseRepository.load([])).toHaveLength(1);
  });
});
