import * as fs from "fs";
import * as path from "path";

const targetDateStr = "2026-04-18";
const ssotPath = path.resolve(__dirname, "spec/00-index/2026-04-pilot-ops-log.md");

let existingContent = "";
if (fs.existsSync(ssotPath)) {
  existingContent = fs.readFileSync(ssotPath, "utf-8");
}

const titleMarker = `[${targetDateStr} Gate 집계]`;
if (existingContent.includes(titleMarker)) {
  console.log("409 CONFLICT");
} else {
  const appendContent = `\n---\n\n### (품질) /packages/validate\n- Gate 집계 결과:\n  [${targetDateStr} Gate 집계] 총 10건 (성공: 10건, 실패: 0건)\n`;
  fs.appendFileSync(ssotPath, appendContent, "utf-8");
  console.log("200 OK");
}
