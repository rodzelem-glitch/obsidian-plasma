import * as functions from 'firebase-functions/v1';

export const publishToGoogleBusiness = functions.https.onCall(async (data: any, context: any) => {
    if (!context?.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");

    const { content, accessToken, organizationName } = data;
    if (!content) throw new functions.https.HttpsError("invalid-argument", "Missing content.");
    if (!accessToken) throw new functions.https.HttpsError("failed-precondition", "Missing Google Access Token. Connect your account first.");

    try {
        // Step 1: Get the Account Name
        const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const accountsData = await accountsRes.json() as any;
        
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
        const locationsData = await locationsRes.json() as any;
        
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
            const matchedLocation = locationsData.locations.find((loc: any) => 
                (loc.locationName && loc.locationName.toLowerCase().includes(orgNameLower)) || 
                (loc.title && loc.title.toLowerCase().includes(orgNameLower))
            );
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

        const postData = await createPostRes.json() as any;
        
        if (!createPostRes.ok) {
            functions.logger.error("Google Business API Error:", postData);
            throw new Error(postData.error?.message || "Failed to publish post. Have you enabled the 'Google My Business API' in Google Cloud?");
        }

        return { success: true, postName: postData.name };

    } catch (e: any) {
        functions.logger.error("Failed to post to Google Business:", e.message);
        throw new functions.https.HttpsError("internal", e.message || "Failed to post to Google Business Profile.");
    }
});
