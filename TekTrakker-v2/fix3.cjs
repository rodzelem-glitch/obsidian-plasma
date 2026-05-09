const fs = require('fs');
let code = fs.readFileSync('functions/src/aiAgent.ts', 'utf8');

code = code.replace("invSnap.docs.map", "invoicesSnap.map");
code = code.replace("const i = d.data();", "const i = d.data().invoice;");
code = code.replace("id: i.id, total", "id: i.id || d.id, total");
code = code.replace("date: j.completedAt", "date: j.endTime || j.createdAt");

fs.writeFileSync('functions/src/aiAgent.ts', code);
console.log("Fixed issues natively");
