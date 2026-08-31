import { describe, expect, it } from "vitest";
import { demoServices, mockServices } from ".";
import type { CaseRecord } from "../types/domain";

describe("local case workflow", () => {
  it("keeps saved analysis cases available while API data mode is active", async () => {
    const record: CaseRecord = {
      id: "CASE-SAVE-TEST",
      incidentId: "INC-SAVE-TEST",
      status: "investigating",
      priority: "high",
      assignedAnalyst: "A. Rao",
      createdAt: "2026-08-30T00:00:00Z",
      updatedAt: "2026-08-30T00:01:00Z",
      evidenceCompleteness: 55,
      nextAction: "Review saved OceanTrace scenario",
      notes: ["Exact analyst annotation"],
      pinnedEvidence: [],
      savedScenarios: ["OceanTrace 24h"],
    };

    await mockServices.cases.save(record);
    const cases = await demoServices.cases.list();

    expect(cases.data.find((item) => item.id === record.id)).toEqual(record);
  });
});
