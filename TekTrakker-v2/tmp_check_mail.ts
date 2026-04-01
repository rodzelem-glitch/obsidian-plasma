
import * as admin from 'firebase-admin';

// Re-use the running terminal's context or provide credentials if possible
// Since I see a running terminal with admin.initializeApp, I'll try to run a similar script.

async function checkMail() {
    try {
        const db = admin.firestore();
        console.log("Fetching last 5 mail documents...");
        const snapshot = await db.collection('mail').orderBy('createdAt', 'desc').limit(5).get();
        
        if (snapshot.empty) {
            console.log("No mail documents found.");
            return;
        }

        snapshot.forEach(doc => {
            console.log("-------------------");
            console.log("ID:", doc.id);
            console.log("To:", doc.data().to);
            console.log("Subject:", doc.data().message?.subject);
            console.log("From:", doc.data().message?.from);
            console.log("Delivery State:", doc.data().delivery || "N/A (Pending Extension)");
            if (doc.data().delivery?.error) {
                console.log("ERROR:", doc.data().delivery.error);
            }
        });
    } catch (e) {
        console.error("FAILED to check mail:", e);
    }
}

checkMail();
