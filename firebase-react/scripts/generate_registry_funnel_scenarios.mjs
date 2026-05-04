import fs from "node:fs";
import path from "node:path";

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function findJsonBlocks(text) {
  const blocks = [];
  const re = /```json\s*\n([\s\S]*?)\n```/g;
  let m;
  while ((m = re.exec(text))) {
    blocks.push(m[1]);
  }
  return blocks;
}

function tryParseJson(s) {
  try {
    return JSON.parse(String(s || "").trim());
  } catch {
    return null;
  }
}

function isFunnelScenario(v) {
  return (
    v &&
    typeof v === "object" &&
    v.schemaVersion === 1 &&
    typeof v.scenarioKey === "string" &&
    typeof v.title === "string" &&
    Array.isArray(v.questions) &&
    v.questions.length > 0 &&
    v.previewBase &&
    typeof v.previewBase.minPrice === "number"
  );
}

function main() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const srcDir = path.join(repoRoot, "registry-scenarios");
  const outPath = path.join(process.cwd(), "functions", "src", "lib", "registry_funnel_scenarios.generated.json");

  const mdFiles = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith(".md") && f !== "index.md")
    .map((f) => path.join(srcDir, f));

  const scenarios = [];

  for (const f of mdFiles) {
    const text = readText(f);
    const blocks = findJsonBlocks(text);
    for (const b of blocks) {
      const parsed = tryParseJson(b);
      if (isFunnelScenario(parsed)) scenarios.push(parsed);
    }
  }

  scenarios.sort((a, b) => String(a.scenarioKey).localeCompare(String(b.scenarioKey)));
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), scenarios }, null, 2) + "\n", "utf8");
  process.stdout.write(`Wrote ${scenarios.length} scenarios to ${outPath}\n`);
}

main();
