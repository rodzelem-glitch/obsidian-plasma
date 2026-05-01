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
exports.publishToGoogleBusiness = void 0;
const functions = __importStar(require("firebase-functions/v1"));
exports.publishToGoogleBusiness = functions.https.onCall(async (data, context) => {
    if (!context?.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const { content, accessToken, organizationName } = data;
    if (!content)
        throw new functions.https.HttpsError("invalid-argument", "Missing content.");
    if (!accessToken)
        throw new functions.https.HttpsError("failed-precondition", "Missing Google Access Token. Connect your account first.");
    try {
        // Step 1: Get the Account Name
        const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const accountsData = await accountsRes.json();
        if (!accountsRes.ok) {
            functions.logger.error("Google Business API Error:", accountsData);
            throw new Error(accountsData.error?.message || "Failed to fetch accounts. Have you enabled the 'My Business Account Management API' in Google Cloud?");
        }
        if (!accountsData || !accountsData.accounts || accountsData.accounts.length === 0) {
            throw new Error("No Google Business accounts found for this Google email. Ensure this email manages a Business Profile.");
        }
        // Take the primary/first account
        const accountName = accountsData.accounts[0].name; // e.g. "accounts/12345"
        // Step 2: Get Locations for the Account
        const locationsRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const locationsData = await locationsRes.json();
        if (!locationsRes.ok) {
            functions.logger.error("Google Business API Error:", locationsData);
            throw new Error(locationsData.error?.message || "Failed to fetch locations. Have you enabled the 'My Business Business Information API' in Google Cloud?");
        }
        if (!locationsData || !locationsData.locations || locationsData.locations.length === 0) {
            throw new Error("No Google Business locations found for this account.");
        }
        // Try to find the location that matches the organization name, otherwise fallback to the first active location.
        let targetLocation = locationsData.locations[0];
        if (organizationName) {
            const orgNameLower = organizationName.toLowerCase();
            const matchedLocation = locationsData.locations.find((loc) => (loc.locationName && loc.locationName.toLowerCase().includes(orgNameLower)) ||
                (loc.title && loc.title.toLowerCase().includes(orgNameLower)));
            if (matchedLocation) {
                targetLocation = matchedLocation;
            }
        }
        const locationName = targetLocation.name; // e.g. "locations/67890"
        // Step 3: Create the Local Post
        const createPostRes = await fetch(`https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/localPosts`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                languageCode: "en-US",
                summary: content,
                callToAction: {
                    actionType: "LEARN_MORE",
                    url: "https://tektrakker.com" // Provide a fallback URL
                }
            })
        });
        const postData = await createPostRes.json();
        if (!createPostRes.ok) {
            functions.logger.error("Google Business API Error:", postData);
            throw new Error(postData.error?.message || "Failed to publish post. Have you enabled the 'Google My Business API' in Google Cloud?");
        }
        return { success: true, postName: postData.name };
    }
    catch (e) {
        functions.logger.error("Failed to post to Google Business:", e.message);
        throw new functions.https.HttpsError("internal", e.message || "Failed to post to Google Business Profile.");
    }
});
//# sourceMappingURL=googleBusiness.js.map