import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const getSquareClient = async (organizationId: string): Promise<any> => {
    try {
        const db = admin.firestore();
        const secretDoc = await db.collection('organizations').doc(organizationId).collection('secrets').doc('config').get();
        if (!secretDoc.exists) return null;
        
        const secrets = secretDoc.data();
        const token = secrets?.squareToken || process.env.SQUARE_ACCESS_TOKEN;
        
        if (!token) {
            functions.logger.warn(`No Square access token found for Organization ${organizationId}`);
            return null;
        }

        const { Client, Environment } = require('square');

        // Initialize Native Square Client
        // We default to Production bounds since this is live, but fall back to Sandbox if the token is prefixed with 'sandbox'
        const environment = token.startsWith('EAAAEL') ? Environment.Sandbox : Environment.Production;

        return new Client({
            environment,
            accessToken: token,
        });

    } catch (error) {
        functions.logger.error("Failed to initialize Square SDK:", error);
        return null;
    }
};

/**
 * Iterates across all organizational shift logs within the timeframe and aggregates them
 * to construct a unified Push to the Square Team Management API.
 */
export const syncOrganizationShiftsToSquare = async (organizationId: string) => {
    try {
        const db = admin.firestore();
        const client = await getSquareClient(organizationId);
        if (!client) throw new Error("Missing Square API Tokens.");

        const secretDoc = await db.collection('organizations').doc(organizationId).collection('secrets').doc('config').get();
        const sqLocationId = secretDoc.data()?.squareLocId;

        if (!sqLocationId) throw new Error("Missing Square Location ID.");

        // Query Unsynced Shift Logs from the previous 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const shiftsSnap = await db.collection('organizations')
            .doc(organizationId)
            .collection('shiftLogs')
            .where('clockIn', '>=', sevenDaysAgo.toISOString())
            .get();

        if (shiftsSnap.empty) {
            return { processed: 0, status: 'No new shifts to sync' };
        }

        const shifts = shiftsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        let syncedCount = 0;

        for (const shift of shifts) {
            if (shift.squareSyncStatus === 'synced' || !shift.clockOut || !shift.userId) continue;

            const startAt = new Date(shift.clockIn).toISOString();
            const endAt = new Date(shift.clockOut).toISOString();
            
            // Generate idempotency key based on literal FireStore ID 
            const idempotencyKey = `shift_sync_${shift.id}`;

            let teamMemberId = shift.userId;
            try {
                const userDoc = await db.collection('users').doc(shift.userId).get();
                if (userDoc.exists) {
                    teamMemberId = userDoc.data()?.squareTeamMemberId || shift.userId;
                }
            } catch(e) { /* Fallback to implicit */ }

            try {
                await client.laborApi.createShift({
                    shift: {
                        startAt,
                        endAt,
                        locationId: sqLocationId,
                        teamMemberId: teamMemberId as string,
                        status: 'CLOSED'
                    },
                    idempotencyKey
                });

                // Flag physical doc
                await db.collection('organizations').doc(organizationId).collection('shiftLogs').doc(shift.id).update({
                    squareSyncStatus: 'synced',
                    squareSyncTime: new Date().toISOString()
                });
                syncedCount++;

            } catch (err: any) {
                functions.logger.error(`Square Shift Error for ${shift.id}:`, err);
                await db.collection('organizations').doc(organizationId).collection('shiftLogs').doc(shift.id).update({
                    squareSyncStatus: 'failed',
                    squareSyncError: err.message || 'API Rejection'
                });
            }
        }

        return { processed: syncedCount, status: 'success' };
    } catch (error: any) {
        functions.logger.error(`Square Org-Level Sync Failed: ${organizationId}`, error);
        throw error;
    }
};
