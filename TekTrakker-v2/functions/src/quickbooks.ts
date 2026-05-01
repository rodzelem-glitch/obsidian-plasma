
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { defineString } from "firebase-functions/params";
import OAuthClient from "intuit-oauth";

// Define the secrets as parameters
const quickbooksClientId = defineString("QUICKBOOKS_CLIENT_ID");
const quickbooksClientSecret = defineString("QUICKBOOKS_CLIENT_SECRET");

// Helper to get initialized client
const getOAuthClient = () => {
  return new OAuthClient({
    clientId: quickbooksClientId.value(),
    clientSecret: quickbooksClientSecret.value(),
    environment: "production", 
    redirectUri: `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/callbackQuickBooks`,
  });
};

export const connectQuickBooks = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }
  if (!data.orgId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with an 'orgId'."
    );
  }

  const orgId = data.orgId;
  const state = `orgId:${orgId}`;

  try {
    const oauthClient = getOAuthClient();
    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state,
    });
    return { authUri };
  } catch (error: any) {
    functions.logger.error("Error creating QuickBooks auth URI:", error);
    throw new functions.https.HttpsError(
      "internal",
      `Could not create QuickBooks auth URI: ${error.message}`
    );
  }
});

export const callbackQuickBooks = functions.https.onRequest(async (req, res) => {
  try {
    const oauthClient = getOAuthClient();
    const parseRedirect = req.url;
    
    // Create token from the callback URL
    const authResponse = await oauthClient.createToken(parseRedirect);
    const token = authResponse.getJson();

    const state = req.query.state as string;
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
  } catch (error: any) {
    functions.logger.error("Error during QuickBooks callback:", error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// New function to get the connection status
export const getQuickBooksConnectionStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }
  if (!data.orgId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with an 'orgId'."
    );
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
  } catch (error) {
    functions.logger.error("Error getting QuickBooks connection status:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Could not retrieve QuickBooks connection status."
    );
  }
});
