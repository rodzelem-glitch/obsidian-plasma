import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';

// Make sure admin is initialized
try {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
} catch { /* ignore */ }

// The Data.gov / SAM.gov API Key
// Configured via Secret Manager: SAM_GOV_API_KEY
const getSamApiKey = () => process.env.SAM_GOV_API_KEY || "";

/**
 * Fetch contract opportunities from SAM.gov based on NAICS codes or keywords.
 */
export const fetchFederalContracts = functions.runWith({ secrets: ["SAM_GOV_API_KEY"] }).https.onCall(async (data, context) => {
    // Require authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
    }

    const { naicsCode, state, keyword, limit = 20 } = data;

    try {
        // SAM.gov API v2 endpoint for searching contract opportunities
        const url = 'https://api.sam.gov/prod/opportunities/v2/search';
        
        // SAM.gov requires postedFrom and postedTo if 'limit' is provided
        // We will default to searching the last 90 days
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(toDate.getDate() - 90);
        
        const formatDate = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

        // Build query parameters
        const params: any = {
            api_key: getSamApiKey(),
            limit,
            postedFrom: formatDate(fromDate),
            postedTo: formatDate(toDate)
        };

        if (data.noticeId) {
            params.noticeid = data.noticeId;
            // When querying by exact noticeid, we shouldn't restrict by dates
            delete params.postedFrom;
            delete params.postedTo;
        } else {
            if (naicsCode) params.ncode = naicsCode;
            if (state) params.state = state;
            if (keyword) params.title = keyword;
        }

        // Perform the request
        const response = await axios.get(url, { params });

        // The API returns the opportunities in a specific structure
        const opportunitiesData = response.data.opportunitiesData || [];

        // If we are fetching a specific notice, try to fetch its actual description text
        if (data.noticeId && opportunitiesData.length > 0) {
            const opp = opportunitiesData[0];
            if (opp.description && opp.description.startsWith('http')) {
                try {
                    const descUrl = new URL(opp.description);
                    descUrl.searchParams.append('api_key', getSamApiKey());
                    const descResponse = await axios.get(descUrl.toString());
                    if (descResponse.data) {
                        if (typeof descResponse.data === 'string') {
                            opp.description = descResponse.data;
                        } else if (descResponse.data.description) {
                            opp.description = descResponse.data.description;
                        } else if (descResponse.data.desc) {
                            opp.description = descResponse.data.desc;
                        } else {
                            // Extract just the text values if it's a deeply nested object
                            try {
                                const textValues: string[] = [];
                                JSON.stringify(descResponse.data, (key, value) => {
                                    if (typeof value === 'string' && value.length > 20 && !value.startsWith('http')) {
                                        textValues.push(value);
                                    }
                                    return value;
                                });
                                if (textValues.length > 0) opp.description = textValues.join('\n\n');
                            } catch (e) {
                                // Ignore json stringify errors
                            }
                        }
                    }
                } catch (descError: any) {
                    console.warn(`Failed to fetch description text for notice ${data.noticeId}:`, descError.message);
                }
            }
        }

        return {
            success: true,
            totalRecords: response.data.totalRecords,
            opportunities: opportunitiesData
        };
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            // SAM.gov returns 404 when there is NO DATA FOUND for the specific filters.
            // We should intercept this and return an empty array gracefully.
            return {
                success: true,
                totalRecords: 0,
                opportunities: []
            };
        }

        console.error("SAM.gov API Error:", error.response?.data || error.message);
        throw new functions.https.HttpsError(
            'internal', 
            `Failed to fetch from SAM.gov: ${error.response?.data?.error?.message || error.message}`
        );
    }
});
