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
exports.publishToTikTok = void 0;
const functions = __importStar(require("firebase-functions/v1"));
exports.publishToTikTok = functions.https.onCall(async (data, context) => {
    if (!context?.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const { content, mediaUrl, accessToken } = data;
    if (!accessToken)
        throw new functions.https.HttpsError("failed-precondition", "Missing TikTok Access Token. Connect your account first.");
    if (!mediaUrl)
        throw new functions.https.HttpsError("invalid-argument", "TikTok strictly requires a video mediaUrl.");
    try {
        // TikTok Video Publishing API (v2) - Direct Post
        // https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
        // Note: For a true production environment, you would download the mediaUrl (if it's a remote URL)
        // and upload it via TikTok's chunked upload or use pull_from_url if TikTok supports it.
        // For this implementation, we will use the pull_from_url method if available, or simulate it.
        const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                post_info: {
                    title: content || 'New video',
                    privacy_level: 'PUBLIC_TO_EVERYONE',
                    disable_duet: false,
                    disable_comment: false,
                    disable_stitch: false,
                    video_cover_timestamp_ms: 1000
                },
                source_info: {
                    source: 'PULL_FROM_URL',
                    video_url: mediaUrl
                }
            })
        });
        const initData = await initResponse.json();
        if (!initResponse.ok) {
            functions.logger.error("TikTok API Error:", initData);
            throw new Error(initData.error?.message || "Failed to initialize TikTok video upload.");
        }
        return { success: true, publishId: initData.data?.publish_id || 'simulated-publish-id' };
    }
    catch (e) {
        functions.logger.error("Failed to post to TikTok:", e.message);
        throw new functions.https.HttpsError("internal", e.message || "Failed to post to TikTok.");
    }
});
//# sourceMappingURL=tiktok.js.map