import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
const serviceAccount = JSON.parse(await readFile(new URL('../serviceAccountKey.json', import.meta.url)));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkSecrets() {
    const orgId = 'org-1765817997819';
    try {
        const doc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
        if (doc.exists) {
            console.log("SECRETS DOCUMENT EXISTS:");
            const data = doc.data();
            console.log("Keys found:", Object.keys(data));
            console.log("squareToken exists?", !!data.squareToken);
            console.log("squareLocId exists?", !!data.squareLocId);
            console.log("measureQuickApiKey exists?", !!data.measureQuickApiKey);
            console.log("smtpConfig exists?", !!data.smtpConfig);
        } else {
            console.log("SECRETS DOCUMENT DOES NOT EXIST FOR ORG:", orgId);
        }
    } catch (e) {
        console.error("Error reading secrets:", e);
    }
}

checkSecrets().then(() => process.exit(0));
