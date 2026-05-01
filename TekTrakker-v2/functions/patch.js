const fs = require('fs');
let c = fs.readFileSync('src/index.ts', 'utf8');
c = c.replace(/const projectId = process\.env\.APP_PROJECT_ID \|\| process\.env\.GCP_PROJECT;\s*\/\/\s*Default site is usually the project ID\s*const siteId = process\.env\.APP_PROJECT_ID \|\| process\.env\.GCP_PROJECT;\s*/g, 'let fbConfig: any = {};\ntry { fbConfig = JSON.parse(process.env.FIREBASE_CONFIG || "{}"); } catch(e){}\nconst projectId = fbConfig.projectId || process.env.GCLOUD_PROJECT || "tektrakker";\nconst siteId = "tektrakker";\n        ');
fs.writeFileSync('src/index.ts', c);
