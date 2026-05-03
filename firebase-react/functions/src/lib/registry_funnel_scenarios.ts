import raw from "./registry_funnel_scenarios.generated.json";
import { FunnelScenarioDefinition, normalizeScenario } from "./funnel_scenarios";

export function listGeneratedFunnelScenarios(): FunnelScenarioDefinition[] {
  const scenarios = (raw as any)?.scenarios as any[] | undefined;
  if (!Array.isArray(scenarios)) return [];
  const out: FunnelScenarioDefinition[] = [];
  for (const s of scenarios) {
    try {
      out.push(normalizeScenario(s));
    } catch {
      continue;
    }
  }
  return out;
}
