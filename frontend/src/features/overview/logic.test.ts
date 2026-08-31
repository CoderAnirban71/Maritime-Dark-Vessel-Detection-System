import { describe, expect, it } from "vitest";
import { incidents } from "../../mocks/fixtures";
import { filterIncidents, sortByUrgency } from "./logic";
describe("overview incident logic", () => {
  it("puts critical fresh incidents first", () =>
    expect(sortByUrgency(incidents)[0]?.severity).toBe("critical"));
  it("combines query and severity filters", () =>
    expect(
      filterIncidents(incidents, {
        query: "Mumbai",
        severity: "critical",
        status: "all",
        region: "all",
      }).map((x) => x.id),
    ).toEqual(["SN-260830-01"]));
});
