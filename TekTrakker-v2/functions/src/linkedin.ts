import * as functions from 'firebase-functions/v1';

export const publishToLinkedIn = functions.https.onCall(async (data: any, context: any) => {
    if (!context?.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");

    const { content, accessToken } = data;
    
    if (!accessToken) throw new functions.https.HttpsError("failed-precondition", "Missing LinkedIn Access Token. Connect your account first.");
    if (!content) throw new functions.https.HttpsError("invalid-argument", "Missing content.");

    try {
        // Step 1: Get the authenticated user's URN
        const meResponse = await fetch('https://api.linkedin.com/v2/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const meData = await meResponse.json() as any;

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

        const shareData = await shareResponse.json() as any;

        if (!shareResponse.ok) {
            functions.logger.error("LinkedIn API Error (ugcPosts):", shareData);
            throw new Error(shareData.message || "Failed to publish post to LinkedIn.");
        }

        return { success: true, postId: shareData.id };

    } catch (e: any) {
        functions.logger.error("Failed to post to LinkedIn:", e.message);
        throw new functions.https.HttpsError("internal", e.message || "Failed to post to LinkedIn.");
    }
});
