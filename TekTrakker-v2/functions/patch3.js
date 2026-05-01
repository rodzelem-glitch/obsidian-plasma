const fs = require('fs');
let c = fs.readFileSync('src/index.ts', 'utf8');
c = c.replace(/const createUrl = `https:\/\/firebasehosting.googleapis.com\/v1beta1\/projects\/\$\{projectId\}\/sites\/\$\{siteId\}\/domains`;/g, 'const createUrl = `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/customDomains?customDomainId=${cleanDomain}`;');
c = c.replace(/body: JSON.stringify\(\{[\s\S]*?domainName: cleanDomain[\s\S]*?\}\)/g, 'body: JSON.stringify({})');
fs.writeFileSync('src/index.ts', c);
