const fs = require('fs');
let c = fs.readFileSync('src/index.ts', 'utf8');
c = c.replace(/site: `projects\/\$\{projectId\}\/sites\/\$\{siteId\}`/g, 'site: `tektrakker`');
fs.writeFileSync('src/index.ts', c);
