const fs = require('fs');
let code = fs.readFileSync('functions/src/aiAgent.ts', 'utf8');

code = code.replace(
    /const invoices = invSnap\.docs\.map\(d => {/g,
    "const invoices = invoicesSnap.map(d => {"
);
code = code.replace(
    /const i = d\.data\(\);/g,
    "const i = d.data().invoice;"
);

fs.writeFileSync('functions/src/aiAgent.ts', code);
console.log('Fixed invSnap issue');
