const fs = require('fs');
const file = 'c:/Users/roder/.gemini/antigravity/playground/obsidian-plasma/TekTrakker-v2/src/pages/master/GlobalCustomers.tsx';
let txt = fs.readFileSync(file, 'utf8');

const r1 = `            const idMap = new Map();
            const phoneMap = new Map();
            const emailMap = new Map();

            existingCustomers.forEach((c: any) => {
                 if (c.id) idMap.set(c.id, c);
                 if (c.phone) phoneMap.set(c.phone, c);
                 if (c.email) emailMap.set(c.email, c);
            });

            const orphanedAppts: Appointment[] = [];

            appointments.forEach(a => {
                const cust = idMap.get(a.customerId) || phoneMap.get(a.customerPhone) || emailMap.get(a.customerEmail);
                if (cust) {
                    if (!cust._appts) cust._appts = [];
                    cust._appts.push(a);
                } else {
                    orphanedAppts.push(a);
                }
            });

            existingCustomers.forEach((c: any) => {
                if (c._appts && c._appts.length > 0) {
                    c._appts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    const latest = c._appts[0];
                    c.latestRequest = latest.tasks.join(', ');
                    c.requestDate = latest.appointmentTime;
                }
                delete c._appts;
            });`;

const r2 = `const existingIds = new Set(list.map(c => c.id));
            
            // Add appts if not in customer list
            snapAppt.forEach(doc => {
                const a = doc.data() as Appointment;
                if (!existingIds.has(a.customerId)) {
                    existingIds.add(a.customerId);`;

txt = txt.replace(/\/\/ Map existing customers to request data[\s\S]*?return !existingCustomers\.some\(c => c\.id === a\.customerId \|\| c\.phone === a\.customerPhone\);\n            }\);/, r1);

txt = txt.replace(/\/\/ Add appts if not in customer list[\s\S]*?if \(\!list\.find\(c => c\.id === a\.customerId\)\) \{/, r2);

fs.writeFileSync(file, txt);
console.log("GlobalCustomers.tsx loop optimization completed successfully.");
