import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Initialize db connection
let db: admin.firestore.Firestore;
try {
    db = admin.firestore();
} catch (e) {
    db = admin.firestore();
}

/**
 * Scheduled Sentinel that runs every 24 hours to scan Firestore data,
 * enforce basic schema rules, repair missing metadata (self-healing),
 * and record alerts for orphaned documents.
 */
export const runDatabaseIntegritySentinel = async () => {
        const timestamp = new Date().toISOString();
        functions.logger.info(`[IntegritySentinel] Database audit started at ${timestamp}`);

        const summary = {
            organizationsChecked: 0,
            organizationsHealed: 0,
            customersChecked: 0,
            customersHealed: 0,
            jobsChecked: 0,
            jobsHealed: 0,
            invoicesChecked: 0,
            invoicesHealed: 0,
            orphansFound: 0,
            errors: [] as string[]
        };

        try {
            // Helper to handle batched writes
            let batch = db.batch();
            let batchCount = 0;
            const commitBatchIfNeeded = async (force = false) => {
                if (batchCount >= 400 || (force && batchCount > 0)) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                }
            };

            // 1. Fetch valid org IDs to check orphans
            const orgsSnap = await db.collection('organizations').get();
            const validOrgIds = new Set<string>();
            
            for (const doc of orgsSnap.docs) {
                summary.organizationsChecked++;
                const orgId = doc.id;
                validOrgIds.add(orgId);
                const orgData = doc.data();

                // Self-healing rules for Organizations
                const updates: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
                if (!orgData.subscriptionStatus) {
                    updates.subscriptionStatus = 'trial';
                }
                if (!orgData.name) {
                    updates.name = 'Unnamed Organization';
                }
                if (!orgData.createdAt) {
                    updates.createdAt = timestamp;
                }

                if (Object.keys(updates).length > 0) {
                    batch.update(doc.ref, updates);
                    batchCount++;
                    summary.organizationsHealed++;
                    await commitBatchIfNeeded();
                }
            }

            // 2. Audit Customers
            const customersSnap = await db.collection('customers').get();
            const validCustomerIds = new Set<string>();

            for (const doc of customersSnap.docs) {
                summary.customersChecked++;
                const customerId = doc.id;
                validCustomerIds.add(customerId);
                const customerData = doc.data();

                const updates: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
                
                // Self-healing missing fields
                if (!customerData.name) {
                    updates.name = 'Unnamed Customer';
                }
                if (!customerData.status) {
                    updates.status = 'active';
                }
                if (!customerData.createdAt) {
                    updates.createdAt = timestamp;
                }
                if (!customerData.updatedAt) {
                    updates.updatedAt = timestamp;
                }

                // Check for orphaned customer
                const orgId = customerData.organizationId;
                if (!orgId || orgId === 'unaffiliated' || !validOrgIds.has(orgId)) {
                    summary.orphansFound++;
                    functions.logger.warn(`[IntegritySentinel] Customer ${customerId} has invalid or orphaned organizationId: ${orgId}`);
                    updates.integrityIssues = admin.firestore.FieldValue.arrayUnion(`Orphaned organizationId: ${orgId}`);
                }

                if (Object.keys(updates).length > 0) {
                    batch.update(doc.ref, updates);
                    batchCount++;
                    summary.customersHealed++;
                    await commitBatchIfNeeded();
                }
            }

            // 3. Audit Jobs
            const jobsSnap = await db.collection('jobs').get();
            const validJobIds = new Set<string>();

            for (const doc of jobsSnap.docs) {
                summary.jobsChecked++;
                const jobId = doc.id;
                validJobIds.add(jobId);
                const jobData = doc.data();

                const updates: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
                
                // Self-healing missing fields
                if (!jobData.jobStatus && !jobData.status) {
                    updates.jobStatus = 'Unassigned';
                } else if (!jobData.jobStatus && jobData.status) {
                    updates.jobStatus = jobData.status; // align fields
                }
                if (!jobData.createdAt) {
                    updates.createdAt = timestamp;
                }
                if (!jobData.updatedAt) {
                    updates.updatedAt = timestamp;
                }

                // Check for orphaned organizationId
                const orgId = jobData.organizationId;
                if (!orgId || !validOrgIds.has(orgId)) {
                    summary.orphansFound++;
                    functions.logger.warn(`[IntegritySentinel] Job ${jobId} has invalid or orphaned organizationId: ${orgId}`);
                    updates.integrityIssues = admin.firestore.FieldValue.arrayUnion(`Orphaned organizationId: ${orgId}`);
                }

                // Check for orphaned customerId
                const customerId = jobData.customerId;
                if (!customerId || !validCustomerIds.has(customerId)) {
                    summary.orphansFound++;
                    functions.logger.warn(`[IntegritySentinel] Job ${jobId} has invalid or orphaned customerId: ${customerId}`);
                    updates.integrityIssues = admin.firestore.FieldValue.arrayUnion(`Orphaned customerId: ${customerId}`);
                }

                if (Object.keys(updates).length > 0) {
                    batch.update(doc.ref, updates);
                    batchCount++;
                    summary.jobsHealed++;
                    await commitBatchIfNeeded();
                }
            }

            // 4. Audit Invoices
            const invoicesSnap = await db.collection('invoices').get();

            for (const doc of invoicesSnap.docs) {
                summary.invoicesChecked++;
                const invoiceId = doc.id;
                const invoiceData = doc.data();

                const updates: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

                // Self-healing missing fields
                if (!invoiceData.status) {
                    updates.status = 'Draft';
                }
                if (!invoiceData.createdAt) {
                    updates.createdAt = timestamp;
                }

                // Check for orphaned organizationId
                const orgId = invoiceData.organizationId;
                if (!orgId || !validOrgIds.has(orgId)) {
                    summary.orphansFound++;
                    functions.logger.warn(`[IntegritySentinel] Invoice ${invoiceId} has invalid or orphaned organizationId: ${orgId}`);
                    updates.integrityIssues = admin.firestore.FieldValue.arrayUnion(`Orphaned organizationId: ${orgId}`);
                }

                // Check for orphaned customerId
                const customerId = invoiceData.customerId;
                if (customerId && !validCustomerIds.has(customerId)) {
                    summary.orphansFound++;
                    functions.logger.warn(`[IntegritySentinel] Invoice ${invoiceId} has orphaned customerId: ${customerId}`);
                    updates.integrityIssues = admin.firestore.FieldValue.arrayUnion(`Orphaned customerId: ${customerId}`);
                }

                // Check for orphaned jobId
                const jobId = invoiceData.jobId;
                if (jobId && !jobId.startsWith('generated_') && !validJobIds.has(jobId)) {
                    summary.orphansFound++;
                    functions.logger.warn(`[IntegritySentinel] Invoice ${invoiceId} has orphaned jobId: ${jobId}`);
                    updates.integrityIssues = admin.firestore.FieldValue.arrayUnion(`Orphaned jobId: ${jobId}`);
                }

                if (Object.keys(updates).length > 0) {
                    batch.update(doc.ref, updates);
                    batchCount++;
                    summary.invoicesHealed++;
                    await commitBatchIfNeeded();
                }
            }

            // Force commit any remaining operations
            await commitBatchIfNeeded(true);

            // Log final report to Firestore
            const alertDoc = {
                type: summary.orphansFound > 0 ? 'warning' : 'success',
                message: `Database Integrity Sentinel run completed. Checked ${summary.organizationsChecked} orgs, ${summary.customersChecked} customers, ${summary.jobsChecked} jobs, ${summary.invoicesChecked} invoices. Healed ${summary.organizationsHealed + summary.customersHealed + summary.jobsHealed + summary.invoicesHealed} fields. Orphans found: ${summary.orphansFound}.`,
                timestamp: timestamp,
                summary: summary
            };

            await db.collection('telemetryAlerts').add(alertDoc);
            await db.collection('integrityAlerts').add(alertDoc);

            functions.logger.info(`[IntegritySentinel] Completed audit successfully. Details:`, summary);

        } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            functions.logger.error(`[IntegritySentinel] Sentinel run failed:`, e);
            summary.errors.push(e.message || String(e));

            // Log failure alert
            await db.collection('telemetryAlerts').add({
                type: 'error',
                message: `Database Integrity Sentinel run failed: ${e.message || String(e)}`,
                timestamp: timestamp,
                summary: summary
            });
        }
};

export const databaseIntegritySentinel = functions.pubsub.schedule('0 3 * * *')
    .timeZone('America/New_York')
    .onRun(runDatabaseIntegritySentinel);

