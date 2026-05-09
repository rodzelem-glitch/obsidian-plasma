const fs = require('fs');
let code = fs.readFileSync('functions/src/aiAgent.ts', 'utf8');

// Fix the jobs query
code = code.replace(
    /const jobsSnap = await db\.collection\('jobs'\)\.where\('organizationId', '==', orgId\)\.where\('jobStatus', '==', 'Completed'\)\.orderBy\('completedAt', 'desc'\)\.limit\(500\)\.get\(\);/g,
    "const jobsSnap = await db.collection('jobs').where('organizationId', '==', orgId).where('jobStatus', '==', 'Completed').orderBy('endTime', 'desc').limit(500).get();"
);

// Fix the invoices loop
const badInvoicesLoop = `const invoices = invSnap.docs.map(d => {
            const i = d.data();
            return { id: i.id, total: i.totalAmount, status: i.status, items: i.items?.map((it:any) => it.name) || [] };
        });`;

const goodInvoicesLoop = `const invoices = invoicesSnap.map(d => {
            const i = d.data().invoice;
            return { id: i.id || d.id, total: i.totalAmount, status: i.status, items: i.items?.map((it:any) => it.name) || [] };
        });`;

code = code.replace(badInvoicesLoop, goodInvoicesLoop);

// Also fix the job variables where missing (e.g. j.completedAt to j.endTime)
code = code.replace(/date: j\.completedAt,/g, "date: j.endTime || j.createdAt,");

fs.writeFileSync('functions/src/aiAgent.ts', code);
console.log('Fixed');
