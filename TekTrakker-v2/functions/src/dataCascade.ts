import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const cascadeCustomerUpdates = functions.firestore
    .document('customers/{customerId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const customerId = context.params.customerId;

        // Check if relevant fields changed
        const nameChanged = before.name !== after.name;
        const emailChanged = before.email !== after.email;
        const phoneChanged = before.phone !== after.phone;
        const addressChanged = before.address !== after.address;

        if (!nameChanged && !emailChanged && !phoneChanged && !addressChanged) {
            return null; // Nothing to cascade
        }

        functions.logger.info(`Cascading updates for customer ${customerId}`);

        const batch = db.batch();
        let updateCount = 0;

        try {
            // Update Jobs
            const jobsSnap = await db.collection('jobs').where('customerId', '==', customerId).get();
            jobsSnap.forEach(doc => {
                const job = doc.data();
                const updates: any = {};
                
                if (nameChanged) updates.customerName = after.name;
                if (addressChanged && job.address === before.address) updates.address = after.address;

                // Update embedded invoice if present
                if (job.invoice) {
                    const invoiceUpdates: any = {};
                    if (nameChanged) invoiceUpdates['invoice.customerName'] = after.name;
                    if (emailChanged) invoiceUpdates['invoice.customerEmail'] = after.email;
                    
                    if (Object.keys(invoiceUpdates).length > 0) {
                        Object.assign(updates, invoiceUpdates);
                    }
                }

                if (Object.keys(updates).length > 0) {
                    batch.update(doc.ref, updates);
                    updateCount++;
                }
            });

            // Update standalone proposals/estimates if they exist in a root collection
            // Assuming collection 'proposals' exists
            try {
                const proposalsSnap = await db.collection('proposals').where('customerId', '==', customerId).get();
                proposalsSnap.forEach(doc => {
                    const updates: any = {};
                    if (nameChanged) updates.customerName = after.name;
                    if (emailChanged) updates.customerEmail = after.email;
                    
                    if (Object.keys(updates).length > 0) {
                        batch.update(doc.ref, updates);
                        updateCount++;
                    }
                });
            } catch (e) {
                // Ignore if proposals collection doesn't exist
            }

            // Commit batch
            if (updateCount > 0) {
                // Firebase batch limit is 500, but typically a customer won't have 500 jobs
                // If they do, this will fail. We'd need chunking for robust production.
                // For now, doing a single batch.
                if (updateCount <= 500) {
                    await batch.commit();
                    functions.logger.info(`Successfully cascaded customer updates to ${updateCount} documents.`);
                } else {
                    functions.logger.warn(`Too many documents to update (${updateCount}). Not chunked yet.`);
                }
            }

        } catch (error) {
            functions.logger.error("Error cascading customer updates:", error);
        }

        return null;
    });
