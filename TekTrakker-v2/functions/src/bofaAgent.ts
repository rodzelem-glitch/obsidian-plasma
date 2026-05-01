import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const getBofaSecrets = async (db: admin.firestore.Firestore) => {
    const platformDoc = await db.collection('platformSettings').doc('global').get();
    const config = platformDoc.data();
    if (!config?.bofaCashProApiKey || !config?.bofaMerchantGatewayId) {
        throw new HttpsError('failed-precondition', 'Bank of America CashPro API keys are missing in Platform settings.');
    }
    return config;
};

// Initiate ACH (Accounts Payable / Outbound)
export const initiateCashProACH = onCall({ cors: true }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be signed in.');

    const { amount, recipientName, routingNumber, accountNumber, memo } = request.data;
    if (!amount || !recipientName || !routingNumber || !accountNumber) {
        throw new HttpsError('invalid-argument', 'Missing routing information for ACH.');
    }

    const db = admin.firestore();
    const config = await getBofaSecrets(db);

    // Mock implementation for CashPro API request
    console.log(`Mock: Initiating CashPro ACH payout to ${recipientName} for ${amount} using Gateway ${config.bofaMerchantGatewayId}`);
    
    // Simulating API call latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Record the transaction for audit
    await db.collection('auditLogs').add({
        action: 'Bank of America CashPro ACH Transfer Sent',
        recipientName,
        amount,
        memo: memo || '',
        status: 'Initiated',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, transactionId: `BOFA-ACH-${Date.now()}` };
});

// Process Transaction (Accounts Receivable / Inbound)
export const processCashProTransaction = onCall({ cors: true }, async (request) => {
    // Note: We don't require auth here because customer checkout may be unauthenticated

    const { amount, customerName, invoiceId, paymentMethodToken } = request.data;
    if (!amount || !customerName || !invoiceId || !paymentMethodToken) {
        throw new HttpsError('invalid-argument', 'Missing payment token or invoice data.');
    }

    const db = admin.firestore();
    const config = await getBofaSecrets(db);

    // Mock implementation for CashPro Payment API
    console.log(`Mock: Processing CashPro Payment from ${customerName} for ${amount} (Invoice: ${invoiceId}) via Gateway ${config.bofaMerchantGatewayId}`);

    // Simulating CashPro Transaction capture
    await new Promise(resolve => setTimeout(resolve, 1500));

    await db.collection('auditLogs').add({
        action: 'Bank of America CashPro Transaction Captured',
        customerName,
        invoiceId,
        amount,
        status: 'Completed',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, transactionId: `BOFA-TX-${Date.now()}` };
});
