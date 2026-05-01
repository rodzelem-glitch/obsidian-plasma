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
exports.getQuickBooksConnectionStatus = exports.callbackQuickBooks = exports.connectQuickBooks = void 0;
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
//# sourceMappingURL=quickbooks.js.map