import {
  getKnownScenarioKeys,
  getPartnerProfileTemplates,
  getPreferredTagsForScenarioKey,
  normalizeScenarioKeys,
} from "../../lib/scenario_partner_match";

describe("scenario_partner_match", () => {
  it("normalizes scenario keys from flexible token formats", () => {
    expect(
      normalizeScenarioKeys([
        "capital reduction",
        "head-office relocation",
        "corp_establishment",
        "unknown_scenario",
      ])
    ).toEqual([
      "capital_reduction",
      "head_office_relocation",
      "corp_establishment",
    ]);
  });

  it("returns preferred tags for specialized scenarios", () => {
    expect(getPreferredTagsForScenarioKey("capital_reduction")).toEqual(["감자"]);
    expect(getPreferredTagsForScenarioKey("corp_establishment")).toEqual([]);
  });

  it("exposes known scenario keys and partner templates", () => {
    const knownKeys = getKnownScenarioKeys();
    const templates = getPartnerProfileTemplates();

    expect(knownKeys).toEqual(expect.arrayContaining(["capital_reduction", "corp_establishment"]));
    expect(templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateKey: "establishment-premium",
          profile: expect.objectContaining({
            scenarioKeysHandled: expect.arrayContaining(["corp_establishment", "foreign_company_registration"]),
          }),
        }),
      ])
    );
  });
});
