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
exports.publishToLinkedIn = void 0;
const functions = __importStar(require("firebase-functions/v1"));
exports.publishToLinkedIn = functions.https.onCall(async (data, context) => {
    if (!context?.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const { content, accessToken } = data;
    if (!accessToken)
        throw new functions.https.HttpsError("failed-precondition", "Missing LinkedIn Access Token. Connect your account first.");
    if (!content)
        throw new functions.https.HttpsError("invalid-argument", "Missing content.");
    try {
        // Step 1: Get the authenticated user's URN
        const meResponse = await fetch('https://api.linkedin.com/v2/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        const meData = await meResponse.json();
        if (!meResponse.ok) {
            functions.logger.error("LinkedIn API Error (me):", meData);
            throw new Error(meData.message || "Failed to fetch LinkedIn profile. Token might be expired.");
        }
        const personUrn = `urn:li:person:${meData.id}`;
        // Step 2: Publish a text/simple post
        const shareResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            },
            body: JSON.stringify({
                author: personUrn,
                lifecycleState: "PUBLISHED",
                specificContent: {
                    "com.linkedin.ugc.ShareContent": {
                        shareCommentary: {
                            text: content
                        },
                        shareMediaCategory: "NONE"
                    }
                },
                visibility: {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            })
        });
        const shareData = await shareResponse.json();
        if (!shareResponse.ok) {
            functions.logger.error("LinkedIn API Error (ugcPosts):", shareData);
            throw new Error(shareData.message || "Failed to publish post to LinkedIn.");
        }
        return { success: true, postId: shareData.id };
    }
    catch (e) {
        functions.logger.error("Failed to post to LinkedIn:", e.message);
        throw new functions.https.HttpsError("internal", e.message || "Failed to post to LinkedIn.");
    }
});
//# sourceMappingURL=linkedin.js.map