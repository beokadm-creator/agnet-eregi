import fs from "node:fs";
import path from "node:path";

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function section(text, title) {
  const re = new RegExp(`^##\\s+${title.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*$`, "m");
  const start = text.search(re);
  if (start < 0) return "";
  const rest = text.slice(start);
  const next = rest.slice(1).search(/^##\s+/m);
  if (next < 0) return rest.trim();
  return rest.slice(0, next + 1).trim();
}

function parseMeta(lines) {
  const meta = {};
  for (const line of lines) {
    const m = line.match(/^\-\s+([^:]+):\s*(.*)$/);
    if (!m) continue;
    meta[m[1].trim()] = m[2].trim();
  }
  return meta;
}

function buildCard(filePath) {
  const text = readText(filePath);
  const lines = text.split("\n").slice(0, 30);
  const meta = parseMeta(lines);
  const titleLine = (text.split("\n")[0] || "").replace(/^#\s*/, "").trim();
  const scenarioKey = meta.scenarioKey || meta["scenarioKey"] || "";
  const displayName = meta["등기종류(표준명)"] || "";
  const category = meta["카테고리"] || "";
  const version = meta["버전"] || "";
  const status = meta["상태"] || "";
  return {
    scenarioKey,
    title: titleLine,
    displayName,
    category,
    version,
    status,
    summary: section(text, "0. 한줄 요약"),
    scope: section(text, "1. 범위"),
    deliverables: section(text, "2. 결과물(필수 산출물)"),
    process: section(text, "3. 프로세스(실무 단계)"),
    requiredInfo: section(text, "4. 반드시 수집해야 하는 정보(정규화 필드)"),
    questions: section(text, "5. 질문 설계(퍼널로 옮길 질문 목록)") || section(text, "5. 질문 설계(퍼널)"),
    previewRules: section(text, "6. 가격/ETA/서류 산정 규칙(Preview Rules)") || section(text, "6. Preview Rules(가격/ETA/서류)"),
    partnerMatch: section(text, "7. 파트너 매칭 포인트(PartnerMatch)") || section(text, "7. PartnerMatch"),
    references: section(text, "8. 근거(법령/규정/실무)") || section(text, "8. 근거"),
    openQuestions: section(text, "9. 추가 확인 질문(불확실/추정 포인트)") || section(text, "9. 추가 확인 질문"),
  };
}

function main() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const srcDir = path.join(repoRoot, "registry-scenarios");
  const outPath = path.join(process.cwd(), "functions", "src", "lib", "registry_scenario_cards.generated.json");

  const files = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith(".md") && f !== "index.md")
    .map((f) => path.join(srcDir, f));

  const cards = files.map(buildCard).filter((c) => c.scenarioKey);
  cards.sort((a, b) => a.scenarioKey.localeCompare(b.scenarioKey));

  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), cards }, null, 2) + "\n", "utf8");
  process.stdout.write(`Wrote ${cards.length} cards to ${outPath}\n`);
}

main();

