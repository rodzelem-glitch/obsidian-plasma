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
exports.getMsalAccessToken = exports.msalOAuthCallback = exports.msalLogin = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
// Initialize admin if not already done in index.ts
if (!admin.apps.length) {
    admin.initializeApp();
}
// Ensure you set this secret in Firebase: 
// firebase functions:secrets:set MSAL_CLIENT_SECRET
const CLIENT_ID = '35863990-62d3-482c-afd0-3708087c018e';
const REDIRECT_URI = 'https://us-central1-tektrakker.cloudfunctions.net/msalOAuthCallback';
exports.msalLogin = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    // Generate auth URL
    // We pass the user's UID as state so the callback knows who logged in
    const state = context.auth.uid;
    const authUrl = `https://login.microsoftonline.com/1af8f245-ea30-4fdc-a06b-020a99f26817/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_mode=query&scope=offline_access%20user.read%20mail.readwrite%20mail.send&state=${state}`;
    return { url: authUrl };
});
exports.msalOAuthCallback = functions.runWith({ secrets: ["MSAL_CLIENT_SECRET"] }).https.onRequest(async (req, res) => {
    const code = req.query.code;
    const state = req.query.state; // This is the user ID
    if (!code || !state) {
        res.status(400).send('Missing code or state');
        return;
    }
    const clientSecret = process.env.MSAL_CLIENT_SECRET;
    if (!clientSecret) {
        res.status(500).send('Server misconfiguration: missing client secret. Run firebase functions:secrets:set MSAL_CLIENT_SECRET');
        return;
    }
    try {
        const tokenRes = await fetch('https://login.microsoftonline.com/1af8f245-ea30-4fdc-a06b-020a99f26817/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: clientSecret,
                code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            console.error('Token Error:', tokenData);
            res.status(400).send(`Authentication failed: ${tokenData.error_description}`);
            return;
        }
        // Save tokens to Firestore
        await admin.firestore().collection('office365_tokens').doc(state).set({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + (tokenData.expires_in * 1000),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // Redirect back to the frontend
        res.redirect('https://app.tektrakker.com/admin/master-inbox');
    }
    catch (e) {
        console.error(e);
        res.status(500).send('Internal server error');
    }
});
exports.getMsalAccessToken = functions.runWith({ secrets: ["MSAL_CLIENT_SECRET"] }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    const uid = context.auth.uid;
    const tokenDoc = await admin.firestore().collection('office365_tokens').doc(uid).get();
    if (!tokenDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'No connected account');
    }
    const tokenData = tokenDoc.data();
    // Check if token is expired (adding 5 min buffer)
    if (Date.now() >= tokenData.expiresAt - 300000) {
        // Refresh token
        const clientSecret = process.env.MSAL_CLIENT_SECRET;
        const res = await fetch('https://login.microsoftonline.com/1af8f245-ea30-4fdc-a06b-020a99f26817/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: clientSecret || '',
                refresh_token: tokenData.refreshToken,
                grant_type: 'refresh_token'
            })
        });
        const refreshData = await res.json();
        if (refreshData.error) {
            throw new functions.https.HttpsError('internal', 'Failed to refresh token: ' + refreshData.error_description);
        }
        const updates = {
            accessToken: refreshData.access_token,
            expiresAt: Date.now() + (refreshData.expires_in * 1000),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (refreshData.refresh_token) {
            updates['refreshToken'] = refreshData.refresh_token;
        }
        await admin.firestore().collection('office365_tokens').doc(uid).update(updates);
        return { accessToken: refreshData.access_token };
    }
    return { accessToken: tokenData.accessToken };
});
//# sourceMappingURL=microsoftAuth.js.map