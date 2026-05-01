import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

/**
 * RevenueCat Webhook Handler
 * This function receives events from RevenueCat and updates the organization's subscription status.
 * It specifically handles the 'Virtual Worker' add-on ($199/mo).
 */
export const revenueCatWebhook = functions.https.onRequest(async (req, res) => {
    // 1. Security: Verify the Authorization header
    const authHeader = req.headers.authorization;
    
    try {
        const secretsDoc = await admin.firestore().collection('platformSettings').doc('secrets').get();
        const secrets = secretsDoc.data();
        const webhookSecret = secrets?.revenueCatWebhookSecret;

        if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
            functions.logger.error("Unauthorized RevenueCat webhook attempt");
            res.status(401).send("Unauthorized");
            return;
        }

        const body = req.body;
        const event = body.event;
        if (!event) {
            res.status(400).send("Bad Request: Missing event data");
            return;
        }

        const appUserId = event.app_user_id;
        const productId = event.product_id;
        const type = event.type;

        functions.logger.info(`RevenueCat Event: ${type} for User: ${appUserId}, Product: ${productId}`);

        // 2. Identify the Organization
        let orgId: string | null = null;

        // Try to see if appUserId is already an orgId (prefix check or direct match)
        if (appUserId.startsWith('org_')) {
            orgId = appUserId;
        } else {
            // Assume appUserId is a Firebase UID
            const userDoc = await admin.firestore().collection('users').doc(appUserId).get();
            if (userDoc.exists) {
                orgId = userDoc.data()?.organizationId || null;
            }
        }

        if (!orgId || orgId === 'unaffiliated') {
            functions.logger.warn(`Could not resolve organization for app_user_id: ${appUserId}`);
            res.status(200).send("Event received but no organization found to update.");
            return;
        }

        // 3. Handle Virtual Worker Subscription Logic
        const VIRTUAL_WORKER_PRODUCT_ID = 'tek_virtual_worker_199';
        
        const db = admin.firestore();
        const orgRef = db.collection('organizations').doc(orgId);

        switch (type) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'PRODUCT_CHANGE':
            case 'UNCANCEL':
                if (productId === VIRTUAL_WORKER_PRODUCT_ID) {
                    await orgRef.update({ 
                        virtualWorkerEnabled: true,
                        revenuecatId: appUserId // Link for future reference
                    });
                    functions.logger.info(`Enabled Virtual Worker for Organization: ${orgId}`);
                }
                break;

            case 'CANCELLATION':
            case 'EXPIRATION':
            case 'BILLING_ISSUE':
                if (productId === VIRTUAL_WORKER_PRODUCT_ID) {
                    await orgRef.update({ 
                        virtualWorkerEnabled: false 
                    });
                    functions.logger.info(`Disabled Virtual Worker for Organization: ${orgId} due to ${type}`);
                }
                break;

            case 'TEST':
                functions.logger.info("RevenueCat TEST event received successfully.");
                break;

            default:
                functions.logger.info(`Unhandled RevenueCat event type: ${type}`);
        }

        res.status(200).send("Webhook processed successfully");

    } catch (error) {
        functions.logger.error("Error processing RevenueCat webhook", error);
        res.status(500).send("Internal Server Error");
    }
});
