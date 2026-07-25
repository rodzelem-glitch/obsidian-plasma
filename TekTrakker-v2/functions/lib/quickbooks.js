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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processQuickBooksSyncQueue = exports.getQuickBooksConnectionStatus = exports.callbackQuickBooks = exports.connectQuickBooks = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const intuit_oauth_1 = __importDefault(require("intuit-oauth"));
// Define the secrets as parameters
const quickbooksClientId = (0, params_1.defineString)("QUICKBOOKS_CLIENT_ID");
const quickbooksClientSecret = (0, params_1.defineString)("QUICKBOOKS_CLIENT_SECRET");
// Helper to get initialized client
const getOAuthClient = () => {
    return new intuit_oauth_1.default({
        clientId: quickbooksClientId.value(),
        clientSecret: quickbooksClientSecret.value(),
        environment: "production",
        redirectUri: `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/callbackQuickBooks`,
    });
};
exports.connectQuickBooks = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    if (!data.orgId) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with an 'orgId'.");
    }
    const orgId = data.orgId;
    const state = `orgId:${orgId}`;
    try {
        const oauthClient = getOAuthClient();
        const authUri = oauthClient.authorizeUri({
            scope: [intuit_oauth_1.default.scopes.Accounting],
            state,
        });
        return { authUri };
    }
    catch (error) {
        functions.logger.error("Error creating QuickBooks auth URI:", error);
        throw new functions.https.HttpsError("internal", `Could not create QuickBooks auth URI: ${error.message}`);
    }
});
exports.callbackQuickBooks = functions.https.onRequest(async (req, res) => {
    try {
        const oauthClient = getOAuthClient();
        const parseRedirect = req.url;
        // Create token from the callback URL
        const authResponse = await oauthClient.createToken(parseRedirect);
        const token = authResponse.getJson();
        const state = req.query.state;
        if (!state || !state.startsWith("orgId:")) {
            functions.logger.error("Invalid state parameter:", state);
            res.status(400).send("Invalid state parameter.");
            return;
        }
        const orgId = state.split(":")[1];
        const realmId = req.query.realmId;
        if (typeof realmId !== 'string') {
            functions.logger.error("Invalid realmId parameter:", realmId);
            res.status(400).send("Invalid realmId parameter.");
            return;
        }
        const db = admin.firestore();
        // Store tokens in Firestore under the organization document
        await db.collection("organizations").doc(orgId).update({
            "integrations.quickbooks.accessToken": token.access_token,
            "integrations.quickbooks.refreshToken": token.refresh_token,
            "integrations.quickbooks.realmId": realmId,
            "integrations.quickbooks.connected": true,
            "integrations.quickbooks.lastUpdated": admin.firestore.FieldValue.serverTimestamp(),
            "integrations.quickbooks.tokenExpiresAt": admin.firestore.Timestamp.fromMillis(Date.now() + (token.expires_in * 1000)),
            "integrations.quickbooks.refreshTokenExpiresAt": admin.firestore.Timestamp.fromMillis(Date.now() + (token.x_refresh_token_expires_in * 1000))
        });
        res.status(200).send("QuickBooks connected successfully! You can close this window.");
    }
    catch (error) {
        functions.logger.error("Error during QuickBooks callback:", error);
        res.status(500).send(`Authentication failed: ${error.message}`);
    }
});
// New function to get the connection status
exports.getQuickBooksConnectionStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    if (!data.orgId) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with an 'orgId'.");
    }
    const orgId = data.orgId;
    try {
        const db = admin.firestore();
        const orgDoc = await db.collection("organizations").doc(orgId).get();
        if (!orgDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Organization not found.");
        }
        const integrations = orgDoc.data()?.integrations;
        const isConnected = integrations?.quickbooks?.connected === true;
        return { isConnected };
    }
    catch (error) {
        functions.logger.error("Error getting QuickBooks connection status:", error);
        throw new functions.https.HttpsError("internal", "Could not retrieve QuickBooks connection status.");
    }
});
/**
 * Helper to refresh QuickBooks tokens if close to expiration
 */
const refreshClientToken = async (oauthClient, orgId) => {
    const db = admin.firestore();
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    if (!orgDoc.exists) {
        throw new Error(`Organization ${orgId} not found`);
    }
    const integrations = orgDoc.data()?.integrations;
    const qb = integrations?.quickbooks;
    if (!qb || !qb.connected) {
        throw new Error(`QuickBooks integration is not connected for organization ${orgId}`);
    }
    // Calculate remaining seconds
    const tokenExpiresAtMs = qb.tokenExpiresAt ? (typeof qb.tokenExpiresAt.toMillis === "function" ? qb.tokenExpiresAt.toMillis() : new Date(qb.tokenExpiresAt).getTime()) : 0;
    const refreshTokenExpiresAtMs = qb.refreshTokenExpiresAt ? (typeof qb.refreshTokenExpiresAt.toMillis === "function" ? qb.refreshTokenExpiresAt.toMillis() : new Date(qb.refreshTokenExpiresAt).getTime()) : 0;
    oauthClient.setToken({
        access_token: qb.accessToken,
        refresh_token: qb.refreshToken,
        x_refresh_token_expires_in: Math.max(0, Math.round((refreshTokenExpiresAtMs - Date.now()) / 1000)),
        expires_in: Math.max(0, Math.round((tokenExpiresAtMs - Date.now()) / 1000)),
    });
    // Check if token expires within 5 minutes
    if (tokenExpiresAtMs - Date.now() < 5 * 60 * 1000) {
        functions.logger.log(`Refreshing QuickBooks access token for org: ${orgId}`);
        const authResponse = await oauthClient.refresh();
        const token = authResponse.getJson();
        // Save refreshed token to Firestore
        await db.collection("organizations").doc(orgId).update({
            "integrations.quickbooks.accessToken": token.access_token,
            "integrations.quickbooks.refreshToken": token.refresh_token,
            "integrations.quickbooks.lastUpdated": admin.firestore.FieldValue.serverTimestamp(),
            "integrations.quickbooks.tokenExpiresAt": admin.firestore.Timestamp.fromMillis(Date.now() + (token.expires_in * 1000)),
        });
    }
    return {
        realmId: qb.realmId,
        accessToken: oauthClient.token.access_token,
    };
};
/**
 * Helper to execute query on QuickBooks Online
 */
const executeQuery = async (oauthClient, realmId, query) => {
    const isProd = oauthClient.environment === "production";
    const baseUrl = isProd ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com";
    const response = await oauthClient.makeApiCall({
        url: `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
        method: "GET",
        headers: {
            "Accept": "application/json",
        },
    });
    return JSON.parse(response.body);
};
/**
 * Helper to POST resource to QuickBooks Online
 */
const createResource = async (oauthClient, realmId, resourceName, payload) => {
    const isProd = oauthClient.environment === "production";
    const baseUrl = isProd ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com";
    const response = await oauthClient.makeApiCall({
        url: `${baseUrl}/v3/company/${realmId}/${resourceName.toLowerCase()}?minorversion=65`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(payload),
    });
    return JSON.parse(response.body);
};
/**
 * Firestore Queue trigger to process QuickBooks Sync Tasks idempotently
 */
exports.processQuickBooksSyncQueue = functions.firestore
    .document("quickbooks_sync_queue/{taskId}")
    .onCreate(async (snapshot, context) => {
    const taskData = snapshot.data();
    if (!taskData)
        return;
    const { orgId, type, payload } = taskData;
    const taskId = context.params.taskId;
    if (!orgId || !type || !payload) {
        functions.logger.error("Missing required task data fields:", taskId);
        await snapshot.ref.update({
            status: "failed",
            error: "Missing required task fields (orgId, type, payload)",
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return;
    }
    try {
        const oauthClient = getOAuthClient();
        const { realmId } = await refreshClientToken(oauthClient, orgId);
        if (type === "invoice") {
            const docNumber = payload.DocNumber;
            if (!docNumber) {
                throw new Error("Invoice payload is missing DocNumber");
            }
            // 1. Check if invoice already exists in QB
            const query = `select * from Invoice where DocNumber = '${docNumber}'`;
            const queryResult = await executeQuery(oauthClient, realmId, query);
            const existingInvoice = queryResult.QueryResponse?.Invoice?.[0];
            if (existingInvoice) {
                functions.logger.log(`Invoice with DocNumber ${docNumber} already exists in QuickBooks. Skipping creation.`, existingInvoice.Id);
                await snapshot.ref.update({
                    status: "skipped",
                    result: { id: existingInvoice.Id, qbInvoice: existingInvoice },
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return;
            }
            // 2. Create invoice in QB
            functions.logger.log(`Creating invoice in QuickBooks for DocNumber: ${docNumber}`);
            const qbResponse = await createResource(oauthClient, realmId, "Invoice", payload);
            const qbInvoice = qbResponse.Invoice;
            if (!qbInvoice) {
                throw new Error(JSON.stringify(qbResponse));
            }
            await snapshot.ref.update({
                status: "completed",
                result: { id: qbInvoice.Id, qbInvoice },
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        else if (type === "payment") {
            const paymentRefNum = payload.PaymentRefNum;
            if (!paymentRefNum) {
                throw new Error("Payment payload is missing PaymentRefNum");
            }
            // 1. Check if payment already exists in QB
            const query = `select * from Payment where PaymentRefNum = '${paymentRefNum}'`;
            const queryResult = await executeQuery(oauthClient, realmId, query);
            const existingPayment = queryResult.QueryResponse?.Payment?.[0];
            if (existingPayment) {
                functions.logger.log(`Payment with PaymentRefNum ${paymentRefNum} already exists in QuickBooks. Skipping creation.`, existingPayment.Id);
                await snapshot.ref.update({
                    status: "skipped",
                    result: { id: existingPayment.Id, qbPayment: existingPayment },
                    processedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return;
            }
            // 2. Create payment in QB
            functions.logger.log(`Creating payment in QuickBooks for PaymentRefNum: ${paymentRefNum}`);
            const qbResponse = await createResource(oauthClient, realmId, "Payment", payload);
            const qbPayment = qbResponse.Payment;
            if (!qbPayment) {
                throw new Error(JSON.stringify(qbResponse));
            }
            await snapshot.ref.update({
                status: "completed",
                result: { id: qbPayment.Id, qbPayment },
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        else {
            throw new Error(`Unsupported sync task type: ${type}`);
        }
    }
    catch (error) {
        functions.logger.error(`Error processing QuickBooks sync task ${taskId}:`, error);
        await snapshot.ref.update({
            status: "failed",
            error: error.message || String(error),
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
});
//# sourceMappingURL=quickbooks.js.map