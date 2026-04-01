const admin = require('firebase-admin');

// Initialize Firebase Admin (relies on default credentials in environment)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function run() {
    try {
        // Find any existing job
        const jobsSnap = await db.collection('jobs').limit(1).get();
        if (jobsSnap.empty) {
            console.log("No jobs found to attach diagnostics to.");
            return;
        }

        const job = jobsSnap.docs[0];
        console.log(`Using Job ID: ${job.id}`);

        const reportId = `mq_test_${Date.now()}`;
        const mockReport = {
            id: reportId,
            jobId: job.id,
            organizationId: job.data().organizationId,
            source: 'measureQuick',
            healthScore: 85,
            systemType: 'Split Heat Pump',
            pdfReportUrl: 'https://example.com/sample-report.pdf',
            measurements: {
                outdoorTemp: 92.5,
                indoorTemp: 74.1,
                suctionPressure: 120,
                liquidPressure: 340,
                superheat: 15.2,
                subcooling: 10.4
            },
            diagnostics: [
                "System is operating within normal parameters.",
                "Slightly elevated liquid pressure, monitor condenser coil cleanliness."
            ],
            createdAt: new Date().toISOString()
        };

        await db.collection('jobs').doc(job.id).collection('diagnostics').doc(reportId).set(mockReport);
        console.log(`Successfully attached mock diagnostic report ${reportId} to Job ${job.id}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
