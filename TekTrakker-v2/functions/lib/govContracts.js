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
exports.fetchFederalContracts = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
// Make sure admin is initialized
try {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
}
catch { /* ignore */ }
// The Data.gov / SAM.gov API Key
// Configured via Secret Manager: SAM_GOV_API_KEY
// eslint-disable-next-line no-undef
const getSamApiKey = () => process.env.SAM_GOV_API_KEY || "";
/**
 * Fetch contract opportunities from SAM.gov based on NAICS codes or keywords.
 */
exports.fetchFederalContracts = functions.https.onCall(async (data, context) => {
    // Require authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
    }
    const { naicsCode, state, keyword, limit = 20 } = data;
    try {
        // SAM.gov API v2 endpoint for searching contract opportunities
        const url = 'https://api.sam.gov/prod/opportunities/v2/search';
        // SAM.gov requires postedFrom and postedTo if 'limit' is provided
        // Use dates provided from frontend, fallback to last 90 days if not provided
        let postedFrom = data.postedFrom;
        let postedTo = data.postedTo;
        if (!postedFrom || !postedTo) {
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(toDate.getDate() - 90);
            const formatDate = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
            postedFrom = postedFrom || formatDate(fromDate);
            postedTo = postedTo || formatDate(toDate);
        }
        // Build query parameters
        const params = {
            api_key: getSamApiKey(),
            limit,
            postedFrom,
            postedTo,
            ptype: 'p,o,k,s'
        };
        if (data.noticeId) {
            params.noticeid = data.noticeId;
            // When querying by exact noticeid, we shouldn't restrict by dates
            delete params.postedFrom;
            delete params.postedTo;
        }
        else {
            if (naicsCode)
                params.ncode = naicsCode;
            if (state)
                params.state = state;
            if (data.city)
                params.city = data.city;
            if (data.zip)
                params.zip = data.zip;
            if (keyword)
                params.title = keyword;
        }
        // Perform the request
        console.log("Sending request to SAM.gov with params:", JSON.stringify({
            ...params,
            api_key: params.api_key ? 'HIDDEN' : 'MISSING'
        }));
        const response = await axios_1.default.get(url, { params });
        // The API returns the opportunities in a specific structure
        const opportunitiesData = response.data.opportunitiesData || [];
        // If we are fetching a specific notice, try to fetch its actual description text
        if (data.noticeId && opportunitiesData.length > 0) {
            const opp = opportunitiesData[0];
            if (opp.description && opp.description.startsWith('http')) {
                try {
                    const descUrl = new URL(opp.description);
                    descUrl.searchParams.append('api_key', getSamApiKey());
                    const descResponse = await axios_1.default.get(descUrl.toString());
                    if (descResponse.data) {
                        if (typeof descResponse.data === 'string') {
                            opp.description = descResponse.data;
                        }
                        else if (descResponse.data.description) {
                            opp.description = descResponse.data.description;
                        }
                        else if (descResponse.data.desc) {
                            opp.description = descResponse.data.desc;
                        }
                        else {
                            // Extract just the text values if it's a deeply nested object
                            try {
                                const textValues = [];
                                JSON.stringify(descResponse.data, (key, value) => {
                                    if (typeof value === 'string' && value.length > 20 && !value.startsWith('http')) {
                                        textValues.push(value);
                                    }
                                    return value;
                                });
                                if (textValues.length > 0)
                                    opp.description = textValues.join('\n\n');
                            }
                            catch {
                                // Ignore json stringify errors
                            }
                        }
                    }
                }
                catch (descError) {
                    console.warn(`Failed to fetch description text for notice ${data.noticeId}:`, descError.message);
                }
            }
        }
        return {
            success: true,
            totalRecords: response.data.totalRecords,
            opportunities: opportunitiesData
        };
    }
    catch (error) {
        const e = error;
        console.error("SAM.gov API Error:", e.response?.data || e.message);
        // Handle SAM.gov WSO2 Gateway 101500 "Error in Sender" or standard 5xx outages gracefully
        const isGatewayError = e.response?.data?.code === '101500';
        const isServerError = e.response && e.response.status && e.response.status >= 500;
        if (isGatewayError || isServerError) {
            console.warn("SAM.gov API is currently unavailable or returning gateway errors. Returning empty results gracefully.");
            return {
                success: false,
                error: "SAM.gov service is temporarily unavailable or experiencing high traffic. Please try again later.",
                totalRecords: 0,
                opportunities: []
            };
        }
        throw new functions.https.HttpsError('internal', `Failed to fetch from SAM.gov: ${e.response?.data?.error?.message || e.response?.data?.message || e.message}`);
    }
});
//# sourceMappingURL=govContracts.js.map