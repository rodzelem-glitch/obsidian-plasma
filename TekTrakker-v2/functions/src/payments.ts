import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getSquareClient } from './squareUtils';

export const processSquarePayment = functions.https.onCall(async (data, context) => {
    const { sourceId, amount, currency, organizationId, jobId, customerEmail } = data;

    if (!organizationId || !sourceId || !amount) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required payment details.');
    }

    try {
        const client = await getSquareClient(organizationId);
        if (!client) {
            throw new functions.https.HttpsError('failed-precondition', 'Square is not configured for this organization.');
        }

        const idempotencyKey = `payment_${jobId || Date.now()}_${Math.round(amount * 100)}`;

        const response = await client.paymentsApi.createPayment({
            sourceId,
            idempotencyKey,
            amountMoney: {
                amount: BigInt(Math.round(amount * 100)), // Square SDK v44+ uses BigInt for amounts
                currency: currency || 'USD'
            },
            note: `Payment for Job/Invoice #${jobId}`,
            buyerEmailAddress: customerEmail
        });

        // Record in transaction log
        await admin.firestore().collection('organizations').doc(organizationId).collection('transactions').add({
            jobId,
            amount,
            currency: currency || 'USD',
            status: 'COMPLETED',
            provider: 'square',
            squarePaymentId: response.result.payment.id,
            timestamp: new Date().toISOString(),
            customerEmail
        });

        return { 
            success: true, 
            paymentId: response.result.payment.id,
            status: response.result.payment.status 
        };

    } catch (error: any) {
        functions.logger.error("Square Payment Error:", error);
        
        // Handle Square API errors
        if (error.errors) {
            const firstError = error.errors[0];
            throw new functions.https.HttpsError('internal', `Square Error: ${firstError.detail || firstError.category}`);
        }
        
        throw new functions.https.HttpsError('internal', error.message || 'Payment processing failed.');
    }
});
