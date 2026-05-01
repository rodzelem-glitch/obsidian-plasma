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
exports.processCashProTransaction = exports.initiateCashProACH = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const getBofaSecrets = async (db) => {
    const platformDoc = await db.collection('platformSettings').doc('global').get();
    const config = platformDoc.data();
    if (!config?.bofaCashProApiKey || !config?.bofaMerchantGatewayId) {
        throw new https_1.HttpsError('failed-precondition', 'Bank of America CashPro API keys are missing in Platform settings.');
    }
    return config;
};
// Initiate ACH (Accounts Payable / Outbound)
exports.initiateCashProACH = (0, https_1.onCall)({ cors: true }, async (request) => {
    const auth = request.auth;
    if (!auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in.');
    const { amount, recipientName, routingNumber, accountNumber, memo } = request.data;
    if (!amount || !recipientName || !routingNumber || !accountNumber) {
        throw new https_1.HttpsError('invalid-argument', 'Missing routing information for ACH.');
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
exports.processCashProTransaction = (0, https_1.onCall)({ cors: true }, async (request) => {
    // Note: We don't require auth here because customer checkout may be unauthenticated
    const { amount, customerName, invoiceId, paymentMethodToken } = request.data;
    if (!amount || !customerName || !invoiceId || !paymentMethodToken) {
        throw new https_1.HttpsError('invalid-argument', 'Missing payment token or invoice data.');
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
//# sourceMappingURL=bofaAgent.js.map