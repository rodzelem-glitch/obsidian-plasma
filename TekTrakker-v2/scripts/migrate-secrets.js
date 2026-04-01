const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function run() {
    try {
        console.log("Starting Migration: Moving Org Secrets to /secrets/config...");
        const orgsSnap = await db.collection('organizations').get();
        let migratedCount = 0;

        for (const doc of orgsSnap.docs) {
            const data = doc.data();
            const secretsData = {};
            let needsMigration = false;

            if (data.smtpConfig) {
                secretsData.smtpConfig = data.smtpConfig;
                needsMigration = true;
            }
            if (data.twilioConfig) {
                secretsData.twilioConfig = data.twilioConfig;
                needsMigration = true;
            }
            if (data.measureQuickApiKey) {
                secretsData.measureQuickApiKey = data.measureQuickApiKey;
                needsMigration = true;
            }

            if (needsMigration) {
                // 1. Write to secrets/config
                await doc.ref.collection('secrets').doc('config').set(secretsData, { merge: true });
                
                // 2. Remove from public document
                await doc.ref.update({
                    smtpConfig: admin.firestore.FieldValue.delete(),
                    twilioConfig: admin.firestore.FieldValue.delete(),
                    measureQuickApiKey: admin.firestore.FieldValue.delete()
                });

                console.log(`Migrated secrets for Organization: ${doc.id}`);
                migratedCount++;
            }
        }
        
        console.log(`Migration Complete. Successfully secured ${migratedCount} organizations.`);
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

run();
