const fs = require('fs');
let content = fs.readFileSync('firebase-react/functions/src/routes/v1/reports.ts', 'utf8');

content = content.replace(/"\/v1\/ops\/reports\/pilot-gate\//g, '"/v1/ops/reports/:gateKey/');
content = content.replace(/"pilot_gate_evidence"/g, '`${gateKey.replace(/-/g, "_")}_evidence`');
content = content.replace(/"ops_github_project_config"\)\.doc\("pilot-gate"\)/g, '"ops_github_project_config").doc(gateKey)');
content = content.replace(/dedupeKey = `pilot-gate:\$\{targetDateStr\}/g, 'dedupeKey = `${gateKey}:${targetDateStr}');
content = content.replace(/\.collection\("ops_daily_logs"\)\.doc\(targetDateStr\)/g, '.collection("ops_daily_logs").doc(gateKey === "pilot-gate" ? targetDateStr : `${gateKey}:${targetDateStr}`)');

const routeRegex = /(app\.(get|post|patch)\(".*?\/v1\/ops\/reports\/:gateKey\/.*?",\s*async\s*\(req,\s*res\)\s*=>\s*\{\s*try\s*\{)/g;

content = content.replace(routeRegex, `$1
      const gateKey = req.params.gateKey;
      if (!/^[a-z0-9-]+$/.test(gateKey)) {
        return fail(res, 400, "INVALID_ARGUMENT", "유효하지 않은 gateKey입니다.");
      }
`);

content = content.replace(/const startStr = formatKstYmd\(d\);([\s\S]*?)const snap = await adminApp\.firestore\(\)\s*\.collection\("ops_daily_logs"\)\s*\.where\(adminApp\.firestore\.FieldPath\.documentId\(\), ">=", startStr\)\s*\.where\(adminApp\.firestore\.FieldPath\.documentId\(\), "<=", endStr\)/, 
`const startStr = formatKstYmd(d);
      const startDocId = gateKey === "pilot-gate" ? startStr : \`\${gateKey}:\${startStr}\`;
      const endDocId = gateKey === "pilot-gate" ? endStr : \`\${gateKey}:\${endStr}\`;$1const snap = await adminApp.firestore()
        .collection("ops_daily_logs")
        .where(adminApp.firestore.FieldPath.documentId(), ">=", startDocId)
        .where(adminApp.firestore.FieldPath.documentId(), "<=", endDocId)`);

content = content.replace(/date: doc\.id,/g, `date: gateKey === "pilot-gate" ? doc.id : doc.id.split(":")[1],`);

fs.writeFileSync('firebase-react/functions/src/routes/v1/reports.ts', content);
console.log("Refactoring reports.ts complete");
