
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

async function migrateEmails() {
    const db = admin.firestore();
    console.log("Starting email case normalization migration...");

    try {
        // 1. Normalize CUSTOMERS
        const customerSnap = await db.collection('customers').get();
        console.log(`Found ${customerSnap.size} customers. Processing...`);
        
        let custCount = 0;
        const batchSize = 400;
        let batch = db.batch();

        for (const doc of customerSnap.docs) {
            const data = doc.data();
            if (data.email && data.email !== data.email.toLowerCase()) {
                batch.update(doc.ref, { 
                    email: data.email.toLowerCase().trim() 
                });
                custCount++;
            }
            
            if (custCount > 0 && custCount % batchSize === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        await batch.commit();
        console.log(`Successfully normalized ${custCount} customer emails.`);

        // 2. Normalize USERS
        const userSnap = await db.collection('users').get();
        console.log(`Found ${userSnap.size} users. Processing...`);
        
        let userCount = 0;
        batch = db.batch();

        for (const doc of userSnap.docs) {
            const data = doc.data();
            if (data.email && data.email !== data.email.toLowerCase()) {
                batch.update(doc.ref, { 
                    email: data.email.toLowerCase().trim() 
                });
                userCount++;
            }
            
            if (userCount > 0 && userCount % batchSize === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        await batch.commit();
        console.log(`Successfully normalized ${userCount} user emails.`);

        console.log("Migration COMPLETE.");
        process.exit(0);
    } catch (e) {
        console.error("Migration FAILED:", e);
        process.exit(1);
    }
}

migrateEmails();
