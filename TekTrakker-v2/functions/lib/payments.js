"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSquarePayment = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const squareUtils_1 = require("./squareUtils");
exports.processSquarePayment = functions.https.onCall(async (data, context) => {
    const { sourceId, amount, currency, organizationId, jobId, customerEmail } = data;
    if (!organizationId || !sourceId || !amount) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required payment details.');
    }
    try {
        const client = await (0, squareUtils_1.getSquareClient)(organizationId);
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
    }
    catch (error) {
        functions.logger.error("Square Payment Error:", error);
        // Handle Square API errors
        if (error.errors) {
            const firstError = error.errors[0];
            throw new functions.https.HttpsError('internal', `Square Error: ${firstError.detail || firstError.category}`);
        }
        throw new functions.https.HttpsError('internal', error.message || 'Payment processing failed.');
    }
});
//# sourceMappingURL=payments.js.map