import { listGeneratedFunnelScenarios } from "../../lib/registry_funnel_scenarios";

describe("registry_funnel_scenarios", () => {
  it("loads generated core scenarios from markdown-derived JSON", () => {
    const scenarios = listGeneratedFunnelScenarios();
    const keys = scenarios.map((scenario) => scenario.scenarioKey);

    expect(keys).toEqual(
      expect.arrayContaining([
        "corp_establishment",
        "head_office_relocation",
        "officer_change",
        "trade_name_change",
        "capital_increase",
        "dissolution",
      ])
    );
    expect(scenarios.length).toBeGreaterThanOrEqual(6);
  });
});
