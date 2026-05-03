import raw from "./registry_scenario_cards.generated.json";

export interface RegistryScenarioCard {
  scenarioKey: string;
  title: string;
  displayName: string;
  category: string;
  version: string;
  status: string;
  summary: string;
  scope: string;
  deliverables: string;
  process: string;
  requiredInfo: string;
  questions: string;
  previewRules: string;
  partnerMatch: string;
  references: string;
  openQuestions: string;
}

export function listRegistryScenarioCards(): RegistryScenarioCard[] {
  const cards = (raw as any)?.cards as RegistryScenarioCard[] | undefined;
  return Array.isArray(cards) ? cards : [];
}

export function getRegistryScenarioCard(scenarioKey: string): RegistryScenarioCard | null {
  const k = String(scenarioKey || "").trim();
  const cards = listRegistryScenarioCards();
  if (!k || !Array.isArray(cards)) return null;
  return cards.find((c) => c?.scenarioKey === k) || null;
}
