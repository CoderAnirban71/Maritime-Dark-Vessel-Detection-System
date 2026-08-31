import type { CaseRecord } from "../types/domain";
const KEY = "samudra-netra:cases:v1";
export const caseRepository = {
  load(fallback: CaseRecord[]) {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as CaseRecord[]) : fallback;
    } catch {
      return fallback;
    }
  },
  save(all: CaseRecord[]) {
    localStorage.setItem(KEY, JSON.stringify(all));
  },
  reset() {
    localStorage.removeItem(KEY);
  },
};
