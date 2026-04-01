
import * as admin from 'firebase-admin';

async function checkCustomers() {
    try {
        const db = admin.firestore();
        console.log("Fetching customers to check casing...");
        const snapshot = await db.collection('customers').limit(20).get();
        
        if (snapshot.empty) {
            console.log("No customers found.");
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log("ID:", doc.id);
            console.log("Email:", data.email);
            console.log("UserId:", data.userId || "NOT LINKED");
            console.log("OrgId:", data.organizationId);
            console.log("-------------------");
        });
    } catch (e) {
        console.error("FAILED to check customers:", e);
    }
}

checkCustomers();
