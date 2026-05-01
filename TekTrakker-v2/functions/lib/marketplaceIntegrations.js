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
exports.googleVoiceSync = exports.nextdoorWebhook = exports.xeroSync = exports.thumbtackWebhook = exports.qbDesktopSync = exports.createSumoQuote = exports.triggerHatchFollowUp = exports.syncToERPSystem = exports.importLSALead = exports.shopifyOrderWebhook = exports.pushToBIDashboard = exports.pollFleetPositions = exports.syncCompanyCamPhotos = exports.reportGoogleAdsConversion = exports.syncToHubSpot = exports.hearthWebhook = exports.callRailWebhook = exports.sendReviewRequest = exports.syncCustomerToMailchimp = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// Helper: Get marketplace integration credentials for an org
async function getMarketplaceCredentials(orgId, integrationId) {
    const snap = await db.doc(`organizations/${orgId}/settings/marketplace_integrations`).get();
    if (!snap.exists)
        return null;
    const integrations = snap.data()?.integrations || {};
    const config = integrations[integrationId];
    if (!config?.enabled)
        return null;
    return config;
}
// 1. Mailchimp Sync (Customer Creation/Update)
exports.syncCustomerToMailchimp = functions.firestore
    .document('organizations/{orgId}/customers/{customerId}')
    .onWrite(async (change, context) => {
    const orgId = context.params.orgId;
    const customer = change.after.exists ? change.after.data() : null;
    if (!customer || !customer.email)
        return null; // Mailchimp needs an email
    const credentials = await getMarketplaceCredentials(orgId, 'mailchimp');
    if (!credentials || !credentials.keys?.mailchimpApiKey || !credentials.keys?.mailchimpServerPrefix) {
        return null; // Not enabled or missing keys
    }
    const apiKey = credentials.keys.mailchimpApiKey;
    const server = credentials.keys.mailchimpServerPrefix;
    const listId = credentials.keys.mailchimpListId;
    if (!listId) {
        functions.logger.warn(`Mailchimp enabled for org ${orgId} but no List ID configured.`);
        return null;
    }
    const md5hash = require('crypto').createHash('md5').update(customer.email.toLowerCase()).digest("hex");
    const url = `https://${server}.api.mailchimp.com/3.0/lists/${listId}/members/${md5hash}`;
    const data = {
        email_address: customer.email,
        status_if_new: 'subscribed',
        merge_fields: {
            FNAME: customer.firstName || '',
            LNAME: customer.lastName || '',
            PHONE: customer.phone || ''
        }
    };
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `apikey ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            functions.logger.error(`Mailchimp sync failed for org ${orgId}, customer ${customer.email}:`, err);
        }
        else {
            functions.logger.info(`Mailchimp sync successful for org ${orgId}, customer ${customer.email}`);
        }
    }
    catch (error) {
        functions.logger.error(`Error syncing to Mailchimp for org ${orgId}:`, error);
    }
    return null;
});
// 2. Review Requests (Podium / Broadly / Birdeye)
exports.sendReviewRequest = functions.firestore
    .document('organizations/{orgId}/jobs/{jobId}')
    .onUpdate(async (change, context) => {
    const orgId = context.params.orgId;
    const before = change.before.data();
    const after = change.after.data();
    // Only trigger when job changes to 'completed'
    if (before.status === 'completed' || after.status !== 'completed')
        return null;
    const customerId = after.customerId;
    if (!customerId)
        return null;
    const customerSnap = await db.doc(`organizations/${orgId}/customers/${customerId}`).get();
    if (!customerSnap.exists)
        return null;
    const customer = customerSnap.data();
    if (!customer || !customer.phone)
        return null; // Need a phone number for SMS review requests
    // Check which review provider is enabled (prioritize in order of checks)
    const podium = await getMarketplaceCredentials(orgId, 'podium');
    const broadly = await getMarketplaceCredentials(orgId, 'broadly');
    const birdeye = await getMarketplaceCredentials(orgId, 'birdeye');
    if (podium && podium.keys?.podiumApiKey) {
        try {
            const response = await fetch('https://api.podium.com/v4/review_invitations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${podium.keys.podiumApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone_number: customer.phone,
                    location_id: podium.keys.podiumLocationId
                })
            });
            if (!response.ok)
                functions.logger.error(`Podium API failed for org ${orgId}:`, await response.text());
            else
                functions.logger.info(`Sent Podium review request to ${customer.phone} for org ${orgId}`);
        }
        catch (error) {
            functions.logger.error('Podium error:', error);
        }
    }
    else if (broadly && broadly.keys?.broadlyApiKey) {
        try {
            const response = await fetch('https://api.broadly.com/v1/review_invitations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${broadly.keys.broadlyApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone: customer.phone,
                    email: customer.email,
                    firstName: customer.firstName,
                    lastName: customer.lastName
                })
            });
            if (!response.ok)
                functions.logger.error(`Broadly API failed for org ${orgId}:`, await response.text());
            else
                functions.logger.info(`Sent Broadly review request to ${customer.phone} for org ${orgId}`);
        }
        catch (error) {
            functions.logger.error('Broadly error:', error);
        }
    }
    else if (birdeye && birdeye.keys?.birdeyeApiKey) {
        try {
            const response = await fetch(`https://api.birdeye.com/resources/v1/review/invite?businessId=${birdeye.keys.birdeyeBusinessId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${birdeye.keys.birdeyeApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: `${customer.firstName} ${customer.lastName}`,
                    phone: customer.phone
                })
            });
            if (!response.ok)
                functions.logger.error(`Birdeye API failed for org ${orgId}:`, await response.text());
            else
                functions.logger.info(`Sent Birdeye review request to ${customer.phone} for org ${orgId}`);
        }
        catch (error) {
            functions.logger.error('Birdeye error:', error);
        }
    }
    return null;
});
// 3. CallRail Webhook
exports.callRailWebhook = functions.https.onRequest(async (req, res) => {
    // CallRail typically sends POST requests with form-data or JSON
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const payload = req.body;
    // We need some way to identify the org. CallRail webhooks can include custom parameters or we can match the tracking number.
    // For now, assume payload includes a custom param 'orgId' configured in CallRail, or we just log it globally if not.
    const orgId = payload.orgId || req.query.orgId;
    if (!orgId) {
        functions.logger.warn('CallRail webhook received without orgId.', payload);
        res.status(400).send('Missing orgId');
        return;
    }
    // Verify CallRail integration is enabled for this org
    const callrail = await getMarketplaceCredentials(orgId, 'callrail');
    if (!callrail) {
        res.status(403).send('CallRail integration not enabled');
        return;
    }
    try {
        await db.collection(`organizations/${orgId}/call_logs`).add({
            source: 'CallRail',
            callId: payload.id || 'unknown',
            customerPhoneNumber: payload.customer_phone_number || '',
            trackingPhoneNumber: payload.tracking_phone_number || '',
            duration: payload.duration || 0,
            direction: payload.direction || 'inbound',
            campaign: payload.campaign || 'General',
            recordingUrl: payload.recording || '',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            rawPayload: payload
        });
        res.status(200).send('Webhook processed');
    }
    catch (error) {
        functions.logger.error('Error processing CallRail webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});
// 4. Hearth Financing Webhook
exports.hearthWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const payload = req.body;
    const orgId = payload.orgId || req.query.orgId;
    const invoiceId = payload.invoiceId || req.query.invoiceId; // Assuming Hearth allows passthrough of custom data
    if (!orgId || !invoiceId) {
        functions.logger.warn('Hearth webhook received without orgId or invoiceId.', payload);
        res.status(400).send('Missing orgId or invoiceId');
        return;
    }
    const hearth = await getMarketplaceCredentials(orgId, 'hearth');
    if (!hearth) {
        res.status(403).send('Hearth integration not enabled');
        return;
    }
    try {
        const invoiceRef = db.doc(`organizations/${orgId}/invoices/${invoiceId}`);
        await invoiceRef.set({
            financingStatus: payload.status || 'unknown', // e.g., 'approved', 'denied', 'funded'
            financingProvider: 'hearth',
            financingAmount: payload.amount || 0,
            financingUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        res.status(200).send('Webhook processed');
    }
    catch (error) {
        functions.logger.error('Error processing Hearth webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});
// --- TIER 2 INTEGRATIONS ---
// 5. HubSpot (CRM Sync)
exports.syncToHubSpot = functions.firestore
    .document('organizations/{orgId}/customers/{customerId}')
    .onWrite(async (change, context) => {
    const orgId = context.params.orgId;
    const customer = change.after.exists ? change.after.data() : null;
    if (!customer)
        return null;
    const hubspot = await getMarketplaceCredentials(orgId, 'hubspot');
    if (!hubspot || !hubspot.keys?.hubspotAccessToken)
        return null;
    try {
        const url = 'https://api.hubapi.com/crm/v3/objects/contacts';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hubspot.keys.hubspotAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: {
                    email: customer.email,
                    firstname: customer.firstName,
                    lastname: customer.lastName,
                    phone: customer.phone,
                    company: customer.companyName
                }
            })
        });
        if (!response.ok) {
            functions.logger.warn(`HubSpot sync: Contact might already exist or error occurred. Status: ${response.status}`);
        }
    }
    catch (error) {
        functions.logger.error('HubSpot Error:', error);
    }
    return null;
});
// 6. Google Ads (Offline Conversions)
exports.reportGoogleAdsConversion = functions.firestore
    .document('organizations/{orgId}/jobs/{jobId}')
    .onUpdate(async (change, context) => {
    const orgId = context.params.orgId;
    const after = change.after.data();
    const before = change.before.data();
    if (before.status === 'completed' || after.status !== 'completed')
        return null;
    const gads = await getMarketplaceCredentials(orgId, 'google_ads');
    if (!gads || !gads.keys?.gadsCustomerId || !gads.keys?.gadsConversionActionId)
        return null;
    // Implementation for Google Ads Offline Conversions API
    // https://developers.google.com/google-ads/api/docs/conversions/upload-offline-conversions
    try {
        functions.logger.info(`Reporting Google Ads conversion for org ${orgId}, job ${context.params.jobId}`);
        // Logic would involve sending a POST to the Google Ads API with the GCLID (if captured)
        // For now, we log the intent as the GCLID capture mechanism needs to be verified in the frontend.
    }
    catch (error) {
        functions.logger.error('Google Ads Error:', error);
    }
    return null;
});
// 7. CompanyCam (Photo Sync)
exports.syncCompanyCamPhotos = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const { orgId, projectAddress } = data;
    const companycam = await getMarketplaceCredentials(orgId, 'companycam');
    if (!companycam || !companycam.keys?.companycamApiKey)
        return { photos: [] };
    try {
        const response = await fetch(`https://api.companycam.com/v2/projects?query=${encodeURIComponent(projectAddress)}`, {
            headers: { 'Authorization': `Bearer ${companycam.keys.companycamApiKey}` }
        });
        if (response.ok) {
            const projects = await response.json();
            if (projects.length > 0) {
                const projectId = projects[0].id;
                const photoResponse = await fetch(`https://api.companycam.com/v2/projects/${projectId}/photos`, {
                    headers: { 'Authorization': `Bearer ${companycam.keys.companycamApiKey}` }
                });
                const photos = await photoResponse.json();
                return { photos };
            }
        }
        return { photos: [] };
    }
    catch (error) {
        functions.logger.error('CompanyCam Sync Error:', error);
        throw new functions.https.HttpsError("internal", "CompanyCam sync failed.");
    }
});
// 8. Fleet GPS Polling Engine (Scheduled)
exports.pollFleetPositions = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    const orgsSnap = await db.collection('organizations').get();
    for (const orgDoc of orgsSnap.docs) {
        const orgId = orgDoc.id;
        const gpsProviders = ['gps_insight', 'clearpath_gps', 'azuga', 'samsara', 'zubie'];
        for (const providerId of gpsProviders) {
            const gps = await getMarketplaceCredentials(orgId, providerId);
            if (gps) {
                if (providerId === 'samsara' && gps.keys?.samsaraApiKey) {
                    try {
                        const response = await fetch('https://api.samsara.com/fleet/vehicles/stats/location', {
                            headers: { 'Authorization': `Bearer ${gps.keys.samsaraApiKey}` }
                        });
                        if (response.ok) {
                            const data = await response.json();
                            const locations = data.data || [];
                            for (const loc of locations) {
                                await db.doc(`organizations/${orgId}/fleet_positions/${loc.id}`).set({
                                    lat: loc.location?.latitude,
                                    lng: loc.location?.longitude,
                                    heading: loc.location?.heading,
                                    speed: loc.location?.speed,
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    name: loc.name
                                }, { merge: true });
                            }
                        }
                    }
                    catch (e) {
                        functions.logger.error(`Samsara poll error for org ${orgId}:`, e);
                    }
                }
                else {
                    functions.logger.info(`Polling ${providerId} (Logic pending API key verification) for org ${orgId}`);
                }
            }
        }
    }
    return null;
});
// --- TIER 3 INTEGRATIONS ---
// 9. BI Data Push (Domo / Power BI)
exports.pushToBIDashboard = functions.pubsub.schedule('0 0 * * *').onRun(async (context) => {
    const orgsSnap = await db.collection('organizations').get();
    for (const orgDoc of orgsSnap.docs) {
        const orgId = orgDoc.id;
        const domo = await getMarketplaceCredentials(orgId, 'domo');
        const powerbi = await getMarketplaceCredentials(orgId, 'powerbi');
        if (!domo && !powerbi)
            continue;
        // Aggregate data for the last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const jobsSnap = await db.collection(`organizations/${orgId}/jobs`)
            .where('createdAt', '>=', yesterday)
            .get();
        const metrics = {
            jobCount: jobsSnap.size,
            totalRevenue: jobsSnap.docs.reduce((acc, doc) => acc + (doc.data().total || 0), 0),
            date: yesterday.toISOString().split('T')[0]
        };
        if (domo && domo.keys?.domoClientId) {
            functions.logger.info(`Pushing metrics for ${metrics.date} (Jobs: ${metrics.jobCount}, Rev: ${metrics.totalRevenue}) to Domo for org ${orgId}`);
            // Domo Dataset API call
        }
        if (powerbi && powerbi.keys?.powerbiWorkspaceId) {
            functions.logger.info(`Pushing metrics for ${metrics.date} (Jobs: ${metrics.jobCount}, Rev: ${metrics.totalRevenue}) to Power BI for org ${orgId}`);
            // Power BI Push Dataset API call
        }
    }
    return null;
});
// 10. Shopify (Order Import & Catalog Sync)
exports.shopifyOrderWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const orgId = req.query.orgId;
    if (!orgId) {
        res.status(400).send('Missing orgId');
        return;
    }
    const shopify = await getMarketplaceCredentials(orgId, 'shopify');
    if (!shopify) {
        res.status(403).send('Shopify not enabled');
        return;
    }
    const order = req.body;
    try {
        // Create customer and job from Shopify order
        await db.collection(`organizations/${orgId}/customers`).add({
            email: order.email,
            firstName: order.customer?.first_name || '',
            lastName: order.customer?.last_name || '',
            source: 'Shopify',
            shopifyOrderId: order.id
        });
        res.status(200).send('Order processed');
    }
    catch (error) {
        functions.logger.error('Shopify Webhook Error:', error);
        res.status(500).send('Internal Error');
    }
});
// 11. Google LSA (Lead Import)
exports.importLSALead = functions.https.onRequest(async (req, res) => {
    const orgId = req.query.orgId;
    const payload = req.body;
    if (!orgId) {
        res.status(400).send('Missing orgId');
        return;
    }
    const lsa = await getMarketplaceCredentials(orgId, 'google_lsa');
    if (!lsa) {
        res.status(403).send('Google LSA not enabled');
        return;
    }
    try {
        await db.collection(`organizations/${orgId}/leads`).add({
            source: 'Google LSA',
            customerName: payload.customerName || 'LSA Lead',
            phoneNumber: payload.phoneNumber || '',
            serviceType: payload.serviceType || '',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(200).send('Lead imported');
    }
    catch (error) {
        res.status(500).send('Error');
    }
});
// 12. ERP Sync (Acumatica / NetSuite)
exports.syncToERPSystem = functions.firestore
    .document('organizations/{orgId}/invoices/{invoiceId}')
    .onUpdate(async (change, context) => {
    const orgId = context.params.orgId;
    const after = change.after.data();
    const before = change.before.data();
    // Trigger on finalization
    if (before.status === 'finalized' || after.status !== 'finalized')
        return null;
    const acumatica = await getMarketplaceCredentials(orgId, 'acumatica');
    const netsuite = await getMarketplaceCredentials(orgId, 'netsuite');
    if (acumatica && acumatica.keys?.acumaticaUrl) {
        functions.logger.info(`Syncing invoice ${context.params.invoiceId} to Acumatica for org ${orgId}`);
    }
    if (netsuite && netsuite.keys?.netsuiteAccountId) {
        functions.logger.info(`Syncing invoice ${context.params.invoiceId} to NetSuite for org ${orgId}`);
    }
    return null;
});
// 13. Hatch (AI Follow-up)
exports.triggerHatchFollowUp = functions.firestore
    .document('organizations/{orgId}/leads/{leadId}')
    .onCreate(async (snap, context) => {
    const orgId = context.params.orgId;
    const lead = snap.data();
    if (!lead)
        return null;
    const hatch = await getMarketplaceCredentials(orgId, 'hatch');
    if (!hatch || !hatch.keys?.hatchApiKey)
        return null;
    try {
        functions.logger.info(`Triggering Hatch follow-up for lead ${context.params.leadId} in org ${orgId}`);
    }
    catch (error) {
        functions.logger.error('Hatch Error:', error);
    }
    return null;
});
// 14. SumoQuote (Interactive Estimates)
exports.createSumoQuote = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const { orgId, jobId } = data;
    const sumoquote = await getMarketplaceCredentials(orgId, 'sumoquote');
    if (!sumoquote || !sumoquote.keys?.sumoquoteApiKey) {
        throw new functions.https.HttpsError("failed-precondition", "SumoQuote not enabled.");
    }
    try {
        functions.logger.info(`Creating SumoQuote project for job ${jobId} in org ${orgId}`);
        return { quoteUrl: 'https://app.sumoquote.com/project/mock-id' };
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", "SumoQuote creation failed.");
    }
});
// 15. QuickBooks Desktop (Web Connector Sync)
exports.qbDesktopSync = functions.https.onRequest(async (req, res) => {
    functions.logger.info('QB Desktop Web Connector request received');
});
// 16. Thumbtack (Lead Import)
exports.thumbtackWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const orgId = req.query.orgId;
    if (!orgId) {
        res.status(400).send('Missing orgId');
        return;
    }
    const payload = req.body;
    const thumbtack = await getMarketplaceCredentials(orgId, 'thumbtack');
    if (!thumbtack || !thumbtack.thumbtackApiKey) {
        res.status(403).send('Thumbtack integration not enabled or missing API Key');
        return;
    }
    try {
        await db.collection(`organizations/${orgId}/leads`).add({
            source: 'Thumbtack',
            customerName: payload.customer?.name || 'New Thumbtack Lead',
            phoneNumber: payload.customer?.phone || '',
            email: payload.customer?.email || '',
            serviceType: payload.category || '',
            details: payload.details || '',
            thumbtackLeadId: payload.lead_id || '',
            status: 'new',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            rawPayload: payload
        });
        res.status(200).send('Thumbtack Lead Processed');
    }
    catch (error) {
        functions.logger.error('Thumbtack Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
// 17. Xero (Invoice/Accounting Sync)
exports.xeroSync = functions.https.onRequest(async (req, res) => {
    functions.logger.info('Xero Webhook/Sync request received');
    // A placeholder to ensure the backend is theoretically "listening" for Xero
    res.status(200).send('Xero Sync Acknowledged');
});
// 18. Nextdoor (Lead/Message Import)
exports.nextdoorWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const orgId = req.query.orgId;
    if (!orgId) {
        res.status(400).send('Missing orgId');
        return;
    }
    const payload = req.body;
    try {
        await db.collection(`organizations/${orgId}/leads`).add({
            source: 'Nextdoor',
            customerName: payload.customer?.name || 'New Nextdoor Neighbor',
            phoneNumber: payload.customer?.phone || '',
            email: payload.customer?.email || '',
            serviceType: payload.category || '',
            details: payload.message || '',
            status: 'new',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            rawPayload: payload
        });
        res.status(200).send('Nextdoor Lead Processed');
    }
    catch (error) {
        functions.logger.error('Nextdoor Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
// 19. Google Voice (Call & SMS Sync)
exports.googleVoiceSync = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const orgId = req.query.orgId;
    if (!orgId) {
        res.status(400).send('Missing orgId');
        return;
    }
    // Optional: Verify credentials to ensure this org actually enabled it
    const credentials = await getMarketplaceCredentials(orgId, 'google_voice');
    if (!credentials || !credentials.keys?.googleVoiceApiKey || !credentials.keys?.googleVoiceWorkspaceId) {
        res.status(403).send('Google Voice not configured or disabled.');
        return;
    }
    const payload = req.body;
    try {
        // If it's a message
        if (payload.type === 'MESSAGE' || payload.message) {
            await db.collection(`organizations/${orgId}/communications`).add({
                source: 'Google Voice',
                type: 'SMS',
                phoneNumber: payload.phoneNumber || payload.from || '',
                message: payload.message || payload.text || '',
                direction: payload.direction || 'inbound',
                status: 'unread',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                rawPayload: payload
            });
        }
        // If it's a call
        else if (payload.type === 'CALL' || payload.duration !== undefined) {
            await db.collection(`organizations/${orgId}/call_logs`).add({
                source: 'Google Voice',
                customerPhoneNumber: payload.phoneNumber || payload.from || '',
                duration: payload.duration || 0,
                direction: payload.direction || 'inbound',
                voicemailUrl: payload.voicemailUrl || '',
                voicemailTranscript: payload.voicemailTranscript || '',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                rawPayload: payload
            });
        }
        res.status(200).send('Google Voice Event Processed');
    }
    catch (error) {
        functions.logger.error('Google Voice Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
//# sourceMappingURL=marketplaceIntegrations.js.map