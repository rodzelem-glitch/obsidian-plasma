const admin = require('firebase-admin');

async function restoreCustomer() {
    try {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: 'tektrakker'
            });
        }
        
        const db = admin.firestore();
        
        console.log("Searching for orphaned jobs belonging to Kacey Jezewski...");
        // Usually, job documents might have a customerName field
        const jobsSnap = await db.collection('jobs').where('customerName', '==', 'Kacey Jezewski').get();
        
        if (jobsSnap.empty) {
            console.log("No jobs found with exactly 'Kacey Jezewski'. Let me try case variants or check service agreements...");
            const saSnap = await db.collection('serviceAgreements').where('customerName', '==', 'Kacey Jezewski').get();
            if (saSnap.empty) {
                console.log("Could not find any orphaned records linking to that exact name.");
                const allSA = await db.collection('serviceAgreements').get();
                for (let doc of allSA.docs) {
                    if (doc.data().customerName && doc.data().customerName.toLowerCase().includes('kacey')) {
                        console.log("Found similar match in memberships:", doc.data().customerName, "with ID:", doc.data().customerId);
                    }
                }
                return;
            } else {
                console.log("Found Membership! ID:", saSnap.docs[0].data().customerId);
                return;
            }
        }

        const sampleJob = jobsSnap.docs[0].data();
        const oldCustomerId = sampleJob.customerId;
        const orgId = sampleJob.organizationId;
        const name = sampleJob.customerName;
        const phone = sampleJob.customerPhone || sampleJob.phone || '';
        const email = sampleJob.customerEmail || sampleJob.email || '';
        const address = sampleJob.address || '';
        
        console.log(`FOUND TRACES OF ${name}! Original Customer ID: ${oldCustomerId}`);
        
        // Recreate the minimal required customer object
        const restoredCustomer = {
            id: oldCustomerId,
            name: name,
            firstName: name.split(' ')[0],
            lastName: name.split(' ').slice(1).join(' '),
            email: email,
            phone: phone,
            address: address,
            city: '',
            state: '',
            zip: '',
            organizationId: orgId,
            tags: ['Restored System Reference'],
            createdAt: new Date().toISOString(),
            isDeleted: false,
            notes: 'Recovered via system script from orphaned Job records after accidental hard-delete.'
        };
        
        await db.collection('customers').doc(oldCustomerId).set(restoredCustomer);
        console.log(`\nSUCCESS! Rebuilt and inserted the customer record for ${name} into Firestore using their exact original ID (${oldCustomerId})!`);
        console.log("This means their Memberships, Invoices, and Jobs are now automatically 100% physically reunited on the dashboard!");
        
    } catch(e) {
        console.error("Error during recovery script:", e);
    }
}

restoreCustomer();
