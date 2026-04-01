
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

async function checkCustomers() {
    try {
        const db = admin.firestore();
        console.log("Fetching customers to check casing (JS)...");
        const snapshot = await db.collection('customers').limit(20).get();
        
        if (snapshot.empty) {
            console.log("No customers found.");
            process.exit(0);
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log("ID:", doc.id);
            console.log("Email:", data.email);
            console.log("UserId:", data.userId || "NOT LINKED");
            console.log("OrgId:", data.organizationId);
            console.log("-------------------");
        });
        process.exit(0);
    } catch (e) {
        console.error("FAILED to check customers:", e);
        process.exit(1);
    }
}

checkCustomers();
