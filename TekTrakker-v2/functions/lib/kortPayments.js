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
exports.testCustomerMembershipBilling = exports.processCustomerMembershipBilling = exports.reconcileKortPayments = exports.testKortSubscriptionPayment = exports.confirmKortACHPayment = exports.processAutomatedBilling = exports.submitDisputeEvidence = exports.refundKortPayment = exports.tilledWebhook = exports.attachKortPaymentMethod = exports.generateKortOnboardingLink = exports.createKortPaymentIntent = void 0;
/* eslint-disable no-undef, @typescript-eslint/no-explicit-any */
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const kortSecretKey = (0, params_1.defineSecret)('KORT_SECRET_KEY');
const kortAccountId = (0, params_1.defineSecret)('KORT_ACCOUNT_ID');
const kortWebhookSecret = (0, params_1.defineSecret)('KORT_WEBHOOK_SECRET');
const getTilledApiUrl = () => {
    const secretKey = kortSecretKey.value();
    if (secretKey && secretKey.startsWith('sk_o5oQ')) {
        return 'https://api.tilled.com';
    }
    return 'https://sandbox-api.tilled.com';
};
const getPlatformMerchantId = () => {
    const secretKey = kortSecretKey.value();
    if (secretKey && secretKey.startsWith('sk_o5oQ')) {
        return 'acct_k5kvc1P0G1Rf4HNizIH8I';
    }
    return 'acct_zDruOrRgOZVtafF9TPC2J';
};
const normalizeCountryCode = (country) => {
    if (typeof country !== 'string')
        return 'US';
    const trimmed = country.trim().toUpperCase();
    if (!trimmed)
        return 'US';
    if (trimmed === 'USA' || trimmed === 'UNITED STATES' || trimmed === 'UNITED STATES OF AMERICA' || trimmed === 'U.S.A.' || trimmed === 'U.S.') {
        return 'US';
    }
    if (trimmed === 'CANADA') {
        return 'CA';
    }
    if (trimmed.length === 2) {
        return trimmed;
    }
    return 'US';
};
exports.createKortPaymentIntent = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
    const { amount, currency, organizationId, metadata } = data;
    if (!amount) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required payment details (amount).');
    }
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value();
    if (!secretKey || !partnerAccountId) {
        throw new functions.https.HttpsError('failed-precondition', 'Kort Payments is not fully configured on the server.');
    }
    try {
        const db = admin.firestore();
        let accountId = data.accountId; // In case the frontend passed it directly
        if (!accountId && organizationId) {
            const orgDoc = await db.collection('organizations').doc(organizationId).get();
            if (orgDoc.exists) {
                accountId = orgDoc.data()?.kortAccountId;
            }
        }
        if (!accountId) {
            throw new functions.https.HttpsError('failed-precondition', 'Organization does not have a connected Kort account.');
        }
        const amountCents = Math.round(amount * 100);
        const cleanMetadata = {};
        cleanMetadata.organizationId = String(organizationId || 'unknown');
        cleanMetadata.jobId = String(data.jobId || 'unknown');
        if (metadata && typeof metadata === 'object') {
            for (const key of Object.keys(metadata)) {
                if (metadata[key] !== undefined && metadata[key] !== null) {
                    let valStr = String(metadata[key]);
                    valStr = valStr.replace(/[<>]/g, '');
                    cleanMetadata[key] = valStr;
                }
            }
        }
        const payload = {
            amount: amountCents,
            currency: currency || 'usd',
            payment_method_types: data.paymentMethodType ? [data.paymentMethodType] : ['card', 'ach_debit'],
            metadata: cleanMetadata
        };
        if (data.platformFeeAmount !== undefined && data.platformFeeAmount > 0) {
            payload.platform_fee_amount = Math.round(data.platformFeeAmount * 100);
        }
        const response = await fetch(`${getTilledApiUrl()}/v1/payment-intents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tilled-api-key': secretKey,
                'tilled-account': accountId,
                'Idempotency-Key': data.idempotencyKey || `create-intent-${organizationId}-${Math.random().toString(36).substring(7)}-${Date.now()}`
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Kort API Error: ${JSON.stringify(errData)}`);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responseData = await response.json();
        // Return the client_secret so the frontend can confirm the payment
        return {
            success: true,
            client_secret: responseData.client_secret,
            id: responseData.id
        };
    }
    catch (error) {
        functions.logger.error("Kort Payment Intent Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Payment processing failed.');
    }
});
exports.generateKortOnboardingLink = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
    const { organizationId, email } = data;
    if (!organizationId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing organization ID.');
    }
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value(); // Your partner account
    if (!secretKey || !partnerAccountId) {
        throw new functions.https.HttpsError('failed-precondition', 'Kort Payments API is not configured on the server.');
    }
    try {
        const db = admin.firestore();
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        const orgData = orgDoc.data() || {};
        const merchantEmail = email || orgData.email || 'partner@tektrakker.com';
        const merchantName = orgData.name || 'TekTrakker Merchant';
        let newAccountId = orgData.kortAccountId;
        let tilledUserId = orgData.tilledUserId;
        const isProd = secretKey && secretKey.startsWith('sk_o5oQ');
        if (!newAccountId) {
            // Step 1: Create a connected account (merchant) under your platform
            const createMerchantRes = await fetch(`${getTilledApiUrl()}/v1/accounts/connected`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'tilled-api-key': secretKey,
                    'tilled-account': partnerAccountId
                },
                body: JSON.stringify({
                    name: merchantName,
                    email: merchantEmail,
                    product_code_ids: isProd ? ["pc_BnBsxNGDLFDVJ0T1yaF0S"] : ["pc_ilm9LRx4kc7KMJ5HZZuHn", "pc_C2gdfg7NVUmFEfPuszbsd"]
                })
            });
            if (!createMerchantRes.ok) {
                const errData = await createMerchantRes.json();
                throw new Error(`Failed to create merchant account: ${JSON.stringify(errData)}`);
            }
            const accountData = await createMerchantRes.json();
            newAccountId = accountData.id;
            // Immediate partial save
            // Force a new user creation for the new account by clearing the old user ID!
            tilledUserId = null;
            await db.collection('organizations').doc(organizationId).update({
                kortAccountId: newAccountId,
                tilledUserId: null
            });
        }
        if (!tilledUserId) {
            // Step 2: Create a user attached to this new merchant account
            // Try using the actual email address first to prevent "weird email" logins.
            // Only fall back to a +orgId suffix if Tilled returns an email-already-exists error.
            const randomPassword = Math.random().toString(36).slice(-8) + 'A1!'; // meets complexity reqs
            let createUserRes = await fetch(`${getTilledApiUrl()}/v1/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'tilled-api-key': secretKey,
                    'tilled-account': newAccountId
                },
                body: JSON.stringify({
                    email: merchantEmail,
                    name: merchantName,
                    password: randomPassword,
                    role: 'merchant_owner'
                })
            });
            if (!createUserRes.ok) {
                const cloneRes = createUserRes.clone();
                const errData = await cloneRes.json();
                const errMessage = errData.message || '';
                if (errMessage.includes('already exists') || createUserRes.status === 409 || createUserRes.status === 403 || createUserRes.status === 400) {
                    functions.logger.info(`Email ${merchantEmail} already exists in Tilled. Falling back to unique suffix email...`);
                    const uniqueUserEmail = `${merchantEmail.split('@')[0]}+${organizationId.substring(0, 6)}@${merchantEmail.split('@')[1] || 'tektrakker.com'}`;
                    createUserRes = await fetch(`${getTilledApiUrl()}/v1/users`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'tilled-api-key': secretKey,
                            'tilled-account': newAccountId
                        },
                        body: JSON.stringify({
                            email: uniqueUserEmail,
                            name: merchantName,
                            password: randomPassword,
                            role: 'merchant_owner'
                        })
                    });
                }
            }
            if (!createUserRes.ok) {
                const errData = await createUserRes.json();
                throw new Error(`Failed to create merchant user: ${JSON.stringify(errData)}`);
            }
            const userData = await createUserRes.json();
            tilledUserId = userData.id;
            // Save the user ID now that it's created
            await db.collection('organizations').doc(organizationId).update({ tilledUserId: tilledUserId });
        }
        // The actual onboarding form is located at `/onboarding/application`.
        // Passing query parameters (such as `?account_id=...`) to Tilled's `redirect_url` in the auth-link payload
        // causes Tilled to URL-encode the `?` and `=` as `%3F` and `%3D` in the final redirect path, triggering a 404 error.
        // Since the user session is fully authenticated by the auth-link token, the account ID is already known
        // by the secure portal, and query parameters are completely redundant. We redirect cleanly to `/onboarding/application`.
        const cleanRedirectUrl = '/onboarding/application';
        let appRes = await fetch(`${getTilledApiUrl()}/v1/auth-links`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tilled-api-key': secretKey,
                'tilled-account': newAccountId
            },
            body: JSON.stringify({
                user_id: tilledUserId,
                expiration: '30d',
                redirect_url: cleanRedirectUrl
            })
        });
        if (!appRes.ok) {
            const errData = await appRes.json();
            const errMessage = errData.message || '';
            const isUserError = errMessage.includes('user does not exist') ||
                errMessage.includes('not found') ||
                errMessage.includes('invalid') ||
                appRes.status === 400 ||
                appRes.status === 404;
            if (isUserError) {
                functions.logger.warn(`Stale or invalid user ID ${tilledUserId} detected for account ${newAccountId}. Re-creating user...`);
                // Re-create user
                const randomPassword = Math.random().toString(36).slice(-8) + 'A1!';
                let createUserRes = await fetch(`${getTilledApiUrl()}/v1/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'tilled-api-key': secretKey,
                        'tilled-account': newAccountId
                    },
                    body: JSON.stringify({
                        email: merchantEmail,
                        name: merchantName,
                        password: randomPassword,
                        role: 'merchant_owner'
                    })
                });
                if (!createUserRes.ok) {
                    const cloneRes = createUserRes.clone();
                    const errData = await cloneRes.json();
                    const errMessage = errData.message || '';
                    if (errMessage.includes('already exists') || createUserRes.status === 409 || createUserRes.status === 403 || createUserRes.status === 400) {
                        const uniqueUserEmail = `${merchantEmail.split('@')[0]}+${organizationId.substring(0, 6)}@${merchantEmail.split('@')[1] || 'tektrakker.com'}`;
                        createUserRes = await fetch(`${getTilledApiUrl()}/v1/users`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'tilled-api-key': secretKey,
                                'tilled-account': newAccountId
                            },
                            body: JSON.stringify({
                                email: uniqueUserEmail,
                                name: merchantName,
                                password: randomPassword,
                                role: 'merchant_owner'
                            })
                        });
                    }
                }
                if (createUserRes.ok) {
                    const userData = await createUserRes.json();
                    if (userData && userData.id) {
                        tilledUserId = userData.id;
                        await db.collection('organizations').doc(organizationId).update({ tilledUserId: tilledUserId });
                        // Retry generating the auth link
                        appRes = await fetch(`${getTilledApiUrl()}/v1/auth-links`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'tilled-api-key': secretKey,
                                'tilled-account': newAccountId
                            },
                            body: JSON.stringify({
                                user_id: tilledUserId,
                                expiration: '30d',
                                redirect_url: cleanRedirectUrl
                            })
                        });
                    }
                }
            }
            if (!appRes.ok) {
                const finalErrData = appRes.bodyUsed ? errData : await appRes.json();
                throw new Error(`Failed to generate auth link: ${JSON.stringify(finalErrData)}`);
            }
        }
        const appData = await appRes.json();
        return {
            success: true,
            accountId: newAccountId,
            onboardingUrl: appData.url
        };
    }
    catch (error) {
        functions.logger.error("Kort Onboarding Link Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to generate onboarding link.');
    }
});
// Retrieves or creates a Tilled Customer on the Platform Account for Subscriptions/Vaulting
const getOrCreateKortCustomerHelper = async (organizationId, db, secretKey, partnerAccountId) => {
    const orgRef = db.collection('organizations').doc(organizationId);
    const orgDoc = await orgRef.get();
    if (!orgDoc.exists) {
        throw new Error("Organization not found.");
    }
    const orgData = orgDoc.data() || {};
    if (orgData.platformCustomerId) {
        return orgData.platformCustomerId;
    }
    // Create Customer in Tilled on the Platform Account
    const createCustomerRes = await fetch(`${getTilledApiUrl()}/v1/customers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'tilled-api-key': secretKey,
            'tilled-account': partnerAccountId
        },
        body: JSON.stringify({
            email: orgData.email || 'unknown@example.com',
            name: orgData.name || 'Unknown Organization',
            metadata: {
                organizationId: organizationId
            }
        })
    });
    if (!createCustomerRes.ok) {
        const errData = await createCustomerRes.json();
        throw new Error(`Failed to create Tilled customer: ${JSON.stringify(errData)}`);
    }
    const customerData = await createCustomerRes.json();
    const customerId = customerData.id;
    await orgRef.update({ platformCustomerId: customerId });
    return customerId;
};
exports.attachKortPaymentMethod = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
    const { organizationId, paymentMethodId, paymentMethodType, achDetails, billingDetails } = data;
    if (!organizationId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing organizationId.');
    }
    if (!paymentMethodId && paymentMethodType !== 'ach_debit') {
        throw new functions.https.HttpsError('invalid-argument', 'Missing paymentMethodId.');
    }
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value();
    if (!secretKey || !partnerAccountId) {
        throw new functions.https.HttpsError('failed-precondition', 'Kort Payments is not fully configured on the server.');
    }
    try {
        const db = admin.firestore();
        const orgRef = db.collection('organizations').doc(organizationId);
        const orgDoc = await orgRef.get();
        const orgData = orgDoc.data() || {};
        const orgMerchantId = orgData.kortAccountId || getPlatformMerchantId();
        const customerId = await getOrCreateKortCustomerHelper(organizationId, db, secretKey, partnerAccountId);
        let resolvedPaymentMethodId = paymentMethodId;
        // If ACH details are provided, create the payment method server-side first
        if (paymentMethodType === 'ach_debit' && achDetails) {
            if (!achDetails.accountNumber || !achDetails.routingNumber) {
                throw new Error('Missing bank account or routing number for ACH payment method creation.');
            }
            const pmResponse = await fetch(`${getTilledApiUrl()}/v1/payment-methods`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'tilled-api-key': secretKey,
                    'tilled-account': orgMerchantId
                },
                body: JSON.stringify({
                    type: 'ach_debit',
                    billing_details: {
                        name: String(billingDetails?.name || 'Customer').trim(),
                        address: {
                            street: String(billingDetails?.street || '').trim(),
                            city: String(billingDetails?.city || '').trim(),
                            state: String(billingDetails?.state || '').trim(),
                            zip: String(billingDetails?.zip || '').trim(),
                            country: normalizeCountryCode(billingDetails?.country)
                        }
                    },
                    ach_debit: {
                        account_type: achDetails.accountType || 'checking',
                        account_number: String(achDetails.accountNumber).replace(/\D/g, ''),
                        routing_number: String(achDetails.routingNumber).replace(/\D/g, ''),
                        account_holder_name: String(billingDetails?.name || 'Customer').trim().substring(0, 22)
                    }
                })
            });
            if (!pmResponse.ok) {
                const errData = await pmResponse.json();
                throw new Error(`Failed to create ACH payment method on server: ${JSON.stringify(errData)}`);
            }
            const pmData = await pmResponse.json();
            resolvedPaymentMethodId = pmData.id;
        }
        if (!resolvedPaymentMethodId) {
            throw new Error('Failed to resolve paymentMethodId.');
        }
        const response = await fetch(`${getTilledApiUrl()}/v1/payment-methods/${resolvedPaymentMethodId}/attach`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'tilled-api-key': secretKey,
                'tilled-account': partnerAccountId
            },
            body: JSON.stringify({ customer_id: customerId })
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Kort Attachment API Error: ${JSON.stringify(errData)}`);
        }
        await db.collection('organizations').doc(organizationId).update({
            platformVaultedPaymentMethodId: resolvedPaymentMethodId,
            platformVaultedPaymentType: paymentMethodType || 'card'
        });
        return {
            success: true,
            paymentMethodId: resolvedPaymentMethodId
        };
    }
    catch (error) {
        functions.logger.error("Kort Attachment Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Attachment failed.');
    }
});
async function resolveJobIdFromFallback(db, eventData, allowedInvoiceStatuses = ['Unpaid', 'Partially Paid']) {
    try {
        // Retrieve amount in dollars
        const amount = eventData.amount ? eventData.amount / 100 : 0;
        if (amount <= 0)
            return null;
        // Try to get billing name or customer name
        let billingName = '';
        if (eventData.billing_details && eventData.billing_details.name) {
            billingName = eventData.billing_details.name.trim().toLowerCase();
        }
        else if (eventData.payment_method && eventData.payment_method.billing_details && eventData.payment_method.billing_details.name) {
            billingName = eventData.payment_method.billing_details.name.trim().toLowerCase();
        }
        else if (eventData.customer && eventData.customer.first_name) {
            billingName = `${eventData.customer.first_name} ${eventData.customer.last_name || ''}`.trim().toLowerCase();
        }
        if (!billingName)
            return null;
        functions.logger.info(`Attempting fallback job lookup for name "${billingName}" and amount $${amount}`);
        const jobsSnapshot = await db.collection('jobs')
            .where('deleted', '!=', true)
            .get();
        let bestMatchJobId = null;
        let matchCount = 0;
        jobsSnapshot.forEach((doc) => {
            const job = doc.data();
            if (job.invoice && allowedInvoiceStatuses.includes(job.invoice.status)) {
                const jobAmount = job.invoice.totalAmount || job.invoice.amount || 0;
                if (Math.abs(jobAmount - amount) < 0.02) {
                    const jobCustomerName = (job.customerName || '').trim().toLowerCase();
                    const nameWords = billingName.split(/\s+/).filter((w) => w.length > 2);
                    const jobWords = jobCustomerName.split(/\s+/).filter((w) => w.length > 2);
                    const hasSharedWord = nameWords.some((w) => jobWords.includes(w));
                    const isSubstring = jobCustomerName.includes(billingName) || billingName.includes(jobCustomerName);
                    if (jobCustomerName && (hasSharedWord || isSubstring)) {
                        bestMatchJobId = doc.id;
                        matchCount++;
                    }
                }
            }
        });
        if (matchCount === 1) {
            functions.logger.info(`Fallback lookup matched unique job: ${bestMatchJobId}`);
            return bestMatchJobId;
        }
        else if (matchCount > 1) {
            functions.logger.warn(`Fallback lookup found multiple matching jobs. Skipping automatic resolution.`);
        }
        else {
            functions.logger.info(`Fallback lookup found no matching jobs.`);
        }
    }
    catch (err) {
        functions.logger.error("Error during fallback job lookup", err);
    }
    return null;
}
exports.tilledWebhook = functions.runWith({ secrets: [kortSecretKey, kortWebhookSecret] }).https.onRequest(async (req, res) => {
    try {
        const payload = req.body;
        functions.logger.info("Received Tilled webhook payload:", JSON.stringify(payload));
        if (!payload || !payload.type || !payload.account_id) {
            res.status(400).send('Invalid payload structure');
            return;
        }
        const eventType = payload.type;
        const accountId = payload.account_id;
        const eventData = payload.data || {};
        const eventId = payload.id;
        const db = admin.firestore();
        // Idempotency check
        if (eventId) {
            const eventRef = db.collection('tilledWebhookEvents').doc(eventId);
            const eventSnap = await eventRef.get();
            if (eventSnap.exists) {
                functions.logger.info(`Webhook event ${eventId} already processed. Skipping.`);
                res.status(200).send('Already processed');
                return;
            }
            await eventRef.set({ processedAt: new Date().toISOString(), type: eventType });
        }
        if (eventType === 'account.updated' || eventType === 'merchant.updated') {
            // Find the organization with this Kort Account ID
            const orgsSnapshot = await db.collection('organizations').where('kortAccountId', '==', accountId).limit(1).get();
            if (orgsSnapshot.empty) {
                functions.logger.warn(`No organization found with kortAccountId: ${accountId}`);
                res.status(404).send('Organization not found for this account_id');
                return;
            }
            const orgRef = orgsSnapshot.docs[0].ref;
            const newStatus = eventData.status || 'active'; // Default to active if status is missing but event is received
            // Log what we're updating
            functions.logger.info(`Updating organization ${orgRef.id} status to ${newStatus}`);
            await orgRef.update({
                kortAccountStatus: newStatus
            });
            res.status(200).send('Webhook processed successfully');
        }
        else if (eventType === 'payment_intent.succeeded') {
            const metadata = eventData.metadata || {};
            let jobId = metadata.jobId;
            if (!jobId || jobId === 'unknown') {
                jobId = await resolveJobIdFromFallback(db, eventData, ['Unpaid', 'Partially Paid']) || undefined;
            }
            if (jobId && jobId !== 'unknown') {
                const amountDollars = eventData.amount ? eventData.amount / 100 : 0;
                const updatePayload = {
                    'invoice.status': 'Paid',
                    'invoice.paidDate': new Date().toISOString(),
                    'invoice.paymentIntentId': eventData.id
                };
                if (amountDollars > 0) {
                    updatePayload['invoice.amountPaid'] = amountDollars;
                }
                await db.collection('jobs').doc(jobId).update(updatePayload);
                functions.logger.info(`Job ${jobId} marked as Paid via webhook with intent ${eventData.id}.`);
                // Queue receipt email automatically
                try {
                    const jobDoc = await db.collection('jobs').doc(jobId).get();
                    if (jobDoc.exists) {
                        const jobData = jobDoc.data() || {};
                        let customerEmail = jobData.customerEmail;
                        if (!customerEmail && jobData.customerId) {
                            const custDoc = await db.collection('customers').doc(jobData.customerId).get();
                            if (custDoc.exists) {
                                customerEmail = custDoc.data()?.email;
                            }
                        }
                        if (customerEmail) {
                            const orgDoc = await db.collection('organizations').doc(jobData.organizationId).get();
                            const orgName = orgDoc.exists ? orgDoc.data()?.name : 'Service Provider';
                            const orgEmail = orgDoc.exists ? orgDoc.data()?.email : 'noreply@tektrakker.com';
                            const invoiceId = jobData.invoice?.id || jobId;
                            const totalAmount = jobData.invoice?.totalAmount || amountDollars;
                            await db.collection('mail_queue').add({
                                to: customerEmail,
                                replyTo: orgEmail,
                                message: {
                                    subject: `Payment Receipt: Invoice #${invoiceId}`,
                                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:8px;"><h2 style="color:#059669;">Payment Receipt</h2><p>Hi ${jobData.customerName || 'Customer'},</p><p>Thank you for your payment of <strong>$${totalAmount?.toFixed(2)}</strong> to <strong>${orgName}</strong>.</p><div style="margin:20px 0;"><p style="margin:5px 0;"><strong>Invoice:</strong> #${invoiceId}</p><p style="margin:5px 0;"><strong>Amount Paid:</strong> $${totalAmount?.toFixed(2)}</p><p style="margin:5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><p style="margin:5px 0;"><strong>Status:</strong> PAID</p></div><p style="font-size:12px;color:#666;">This email serves as your official receipt. Please retain it for your records.</p></div>`,
                                    text: `Payment Receipt for Invoice #${invoiceId}. Amount: $${totalAmount?.toFixed(2)}. Status: PAID.`
                                },
                                organizationId: jobData.organizationId,
                                type: 'Receipt',
                                createdAt: new Date().toISOString()
                            });
                            functions.logger.info(`Queued automatic payment receipt for job ${jobId} to ${customerEmail}`);
                        }
                        else {
                            functions.logger.warn(`Could not send auto receipt for job ${jobId}: customer email is missing`);
                        }
                    }
                }
                catch (emailErr) {
                    functions.logger.error("Error queueing automatic payment receipt email:", emailErr);
                }
            }
            res.status(200).send('Payment succeeded processed');
        }
        else if (eventType === 'payment_intent.payment_failed' || eventType === 'charge.failed') {
            let metadata = eventData.metadata || {};
            let jobId = metadata.jobId;
            if (!jobId && eventData.payment_intent_id) {
                const secretKey = kortSecretKey.value();
                if (secretKey) {
                    try {
                        const piRes = await fetch(`${getTilledApiUrl()}/v1/payment-intents/${eventData.payment_intent_id}`, {
                            headers: {
                                'tilled-api-key': secretKey,
                                'tilled-account': accountId
                            }
                        });
                        if (piRes.ok) {
                            const piData = await piRes.json();
                            if (piData.metadata && piData.metadata.jobId) {
                                jobId = piData.metadata.jobId;
                            }
                        }
                    }
                    catch (e) {
                        functions.logger.error("Failed to fetch payment intent for failed charge metadata", e);
                    }
                }
            }
            if (!jobId || jobId === 'unknown') {
                jobId = await resolveJobIdFromFallback(db, eventData, ['Unpaid', 'Partially Paid', 'Failed']) || undefined;
            }
            if (jobId && jobId !== 'unknown') {
                const failureReason = eventData.last_payment_error?.message ||
                    eventData.failure_message ||
                    eventData.outcome?.seller_message ||
                    'Payment method declined or invalid.';
                try {
                    const jobDoc = await db.collection('jobs').doc(jobId).get();
                    const jobData = jobDoc.exists ? (jobDoc.data() || {}) : {};
                    const rawItems = jobData.invoice?.items || [];
                    const isPaymentFee = (item) => {
                        if (!item)
                            return false;
                        const nameStr = (item.name || item.description || '').toLowerCase().trim();
                        return nameStr.includes('processing fee') || nameStr.includes('bank transfer fee');
                    };
                    const cleanItems = rawItems.filter((item) => !isPaymentFee(item));
                    const cleanTotal = Math.round(cleanItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0) * 100) / 100;
                    const resetTotal = cleanTotal > 0 ? cleanTotal : (jobData.invoice?.totalAmount || 0);
                    await db.collection('jobs').doc(jobId).update({
                        'invoice.status': 'Failed',
                        'invoice.amountPaid': 0,
                        'invoice.items': cleanItems,
                        'invoice.totalAmount': resetTotal,
                        'invoice.amount': resetTotal,
                        'invoice.failedDate': new Date().toISOString(),
                        'invoice.lastFailureReason': failureReason
                    });
                }
                catch (updateErr) {
                    await db.collection('jobs').doc(jobId).update({
                        'invoice.status': 'Failed',
                        'invoice.amountPaid': 0,
                        'invoice.failedDate': new Date().toISOString(),
                        'invoice.lastFailureReason': failureReason
                    });
                }
                functions.logger.warn(`Job ${jobId} marked as Failed via webhook with intent ${eventData.id}. Reason: ${failureReason}`);
                // Queue automated payment failure email to customer
                try {
                    const jobDoc = await db.collection('jobs').doc(jobId).get();
                    if (jobDoc.exists) {
                        const jobData = jobDoc.data() || {};
                        let customerEmail = jobData.customerEmail;
                        if (!customerEmail && jobData.customerId) {
                            const custDoc = await db.collection('customers').doc(jobData.customerId).get();
                            if (custDoc.exists) {
                                customerEmail = custDoc.data()?.email;
                            }
                        }
                        if (customerEmail) {
                            const orgDoc = await db.collection('organizations').doc(jobData.organizationId).get();
                            const orgName = orgDoc.exists ? orgDoc.data()?.name : 'Service Provider';
                            const orgEmail = orgDoc.exists ? (orgDoc.data()?.email || 'noreply@tektrakker.com') : 'noreply@tektrakker.com';
                            const invoiceId = jobData.invoice?.id || jobId;
                            const totalAmount = jobData.invoice?.totalAmount || jobData.invoice?.amount || (eventData.amount ? eventData.amount / 100 : 0);
                            const paymentLink = `https://tektrakker.web.app/#/invoice/${jobId}`;
                            await db.collection('mail_queue').add({
                                to: customerEmail,
                                replyTo: orgEmail,
                                message: {
                                    subject: `Action Required: Payment Failed for Invoice #${invoiceId}`,
                                    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:8px;"><h2 style="color:#dc2626;margin-top:0;">Payment Method Failed</h2><p>Hi ${jobData.customerName || 'Customer'},</p><p>We were unable to process your payment for <strong>Invoice #${invoiceId}</strong> to <strong>${orgName}</strong>. Your payment method has failed.</p><div style="margin:20px 0;padding:15px;background-color:#fef2f2;border:1px solid #fecaca;border-radius:6px;"><p style="margin:5px 0;"><strong>Invoice:</strong> #${invoiceId}</p><p style="margin:5px 0;"><strong>Amount Due:</strong> $${totalAmount?.toFixed(2)}</p><p style="margin:5px 0;"><strong>Status:</strong> PAYMENT FAILED</p><p style="margin:5px 0;color:#991b1b;"><strong>Reason:</strong> ${failureReason}</p></div><div style="margin:20px 0;"><a href="${paymentLink}" style="background-color:#dc2626;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Update Payment Method &amp; Pay</a></div><p style="font-size:12px;color:#666;">Please click the button above or contact ${orgName} to update your payment method and complete this payment.</p></div>`,
                                    text: `Payment method failed for Invoice #${invoiceId} to ${orgName}. Amount Due: $${totalAmount?.toFixed(2)}. Reason: ${failureReason}. Pay online: ${paymentLink}`
                                },
                                organizationId: jobData.organizationId,
                                type: 'PaymentFailed',
                                createdAt: new Date().toISOString()
                            });
                            functions.logger.info(`Queued automatic payment failure email for job ${jobId} to ${customerEmail}`);
                        }
                        else {
                            functions.logger.warn(`Could not send auto failure email for job ${jobId}: customer email is missing`);
                        }
                    }
                }
                catch (emailErr) {
                    functions.logger.error("Error queueing automatic payment failure email:", emailErr);
                }
            }
            else {
                functions.logger.warn(`Payment failed for account ${accountId}, intent ${eventData.id}`);
            }
            res.status(200).send('Payment failed processed');
        }
        else if (eventType === 'charge.refunded') {
            let metadata = eventData.metadata || {};
            let jobId = metadata.jobId;
            // If metadata is missing from the charge, fetch it from the payment intent
            if (!jobId && eventData.payment_intent_id) {
                const secretKey = kortSecretKey.value();
                if (secretKey) {
                    try {
                        const piRes = await fetch(`${getTilledApiUrl()}/v1/payment-intents/${eventData.payment_intent_id}`, {
                            headers: {
                                'tilled-api-key': secretKey,
                                'tilled-account': accountId
                            }
                        });
                        if (piRes.ok) {
                            const piData = await piRes.json();
                            if (piData.metadata && piData.metadata.jobId) {
                                jobId = piData.metadata.jobId;
                            }
                        }
                    }
                    catch (e) {
                        functions.logger.error("Failed to fetch payment intent for refund metadata", e);
                    }
                }
            }
            if (!jobId || jobId === 'unknown') {
                jobId = await resolveJobIdFromFallback(db, eventData, ['Paid', 'Unpaid', 'Partially Paid']) || undefined;
            }
            if (jobId && jobId !== 'unknown') {
                await db.collection('jobs').doc(jobId).update({
                    'invoice.status': 'Refunded',
                    'invoice.refundedDate': new Date().toISOString()
                });
                functions.logger.info(`Job ${jobId} marked as Refunded via webhook.`);
            }
            else {
                functions.logger.warn(`Could not determine jobId for refunded charge ${eventData.id}`);
            }
            res.status(200).send('Refund processed');
        }
        else if (eventType.startsWith('charge.dispute.')) {
            let metadata = eventData.metadata || {};
            let jobId = metadata.jobId;
            // If metadata is missing from the dispute, fetch it from the charge's payment intent
            if (!jobId && eventData.charge_id) {
                const secretKey = kortSecretKey.value();
                if (secretKey) {
                    try {
                        const chargeRes = await fetch(`${getTilledApiUrl()}/v1/charges/${eventData.charge_id}`, {
                            headers: {
                                'tilled-api-key': secretKey,
                                'tilled-account': accountId
                            }
                        });
                        if (chargeRes.ok) {
                            const chargeData = await chargeRes.json();
                            if (chargeData.payment_intent_id) {
                                const piRes = await fetch(`${getTilledApiUrl()}/v1/payment-intents/${chargeData.payment_intent_id}`, {
                                    headers: {
                                        'tilled-api-key': secretKey,
                                        'tilled-account': accountId
                                    }
                                });
                                if (piRes.ok) {
                                    const piData = await piRes.json();
                                    if (piData.metadata && piData.metadata.jobId) {
                                        jobId = piData.metadata.jobId;
                                    }
                                }
                            }
                        }
                    }
                    catch (e) {
                        functions.logger.error("Failed to fetch payment intent for dispute metadata", e);
                    }
                }
            }
            // Save dispute to organization subcollection
            const orgsSnapshot = await db.collection('organizations').where('kortAccountId', '==', accountId).limit(1).get();
            if (!orgsSnapshot.empty) {
                const orgId = orgsSnapshot.docs[0].id;
                const disputeRef = db.collection('organizations').doc(orgId).collection('disputes').doc(eventData.id);
                await disputeRef.set({
                    id: eventData.id,
                    chargeId: eventData.charge_id,
                    amount: eventData.amount,
                    currency: eventData.currency,
                    status: eventData.status || 'needs_response',
                    reason: eventData.reason || 'fraudulent',
                    created: eventData.created_at || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    jobId: jobId || 'unknown'
                }, { merge: true });
                functions.logger.info(`Dispute ${eventData.id} for org ${orgId} saved.`);
            }
            if (!jobId || jobId === 'unknown') {
                jobId = await resolveJobIdFromFallback(db, eventData, ['Paid', 'Unpaid', 'Partially Paid', 'Refunded']) || undefined;
            }
            if (jobId && jobId !== 'unknown') {
                if (eventType === 'charge.dispute.created') {
                    await db.collection('jobs').doc(jobId).update({
                        'invoice.status': 'Disputed',
                        'invoice.disputedDate': new Date().toISOString()
                    });
                    functions.logger.info(`Job ${jobId} marked as Disputed via webhook.`);
                }
            }
            else {
                functions.logger.warn(`Could not determine jobId for disputed charge ${eventData.id}`);
            }
            res.status(200).send('Dispute processed');
        }
        else if (eventType.startsWith('payout.')) {
            // Find the organization with this Kort Account ID
            const orgsSnapshot = await db.collection('organizations').where('kortAccountId', '==', accountId).limit(1).get();
            if (orgsSnapshot.empty) {
                functions.logger.warn(`No organization found for payout webhook with accountId: ${accountId}`);
                res.status(404).send('Organization not found');
                return;
            }
            const orgId = orgsSnapshot.docs[0].id;
            const payoutRef = db.collection('organizations').doc(orgId).collection('payouts').doc(eventData.id);
            await payoutRef.set({
                id: eventData.id,
                amount: eventData.amount,
                currency: eventData.currency,
                status: eventData.status,
                arrivalDate: eventData.arrival_date,
                created: eventData.created_at || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                type: eventType,
                statementDescriptor: eventData.statement_descriptor || 'Tilled Payout'
            }, { merge: true });
            functions.logger.info(`Payout ${eventData.id} for org ${orgId} updated to ${eventData.status}`);
            res.status(200).send('Payout processed');
        }
        else {
            // Unhandled event type, still return 200 so Tilled doesn't retry endlessly
            functions.logger.info(`Unhandled webhook event type: ${eventType}`);
            res.status(200).send(`Unhandled event type: ${eventType}`);
        }
    }
    catch (error) {
        functions.logger.error("Error processing Tilled webhook:", error);
        res.status(500).send("Internal Server Error processing webhook");
    }
});
exports.refundKortPayment = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
    const { paymentIntentId, amount, organizationId } = data;
    if (!paymentIntentId || !organizationId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing paymentIntentId or organizationId.');
    }
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value();
    if (!secretKey || !partnerAccountId) {
        throw new functions.https.HttpsError('failed-precondition', 'Kort Payments API is not configured.');
    }
    try {
        const db = admin.firestore();
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        if (!orgDoc.exists)
            throw new Error("Organization not found.");
        const orgData = orgDoc.data() || {};
        const accountId = orgData.kortAccountId;
        if (!accountId)
            throw new Error("Organization does not have a Kort account.");
        const refundBody = { payment_intent_id: paymentIntentId };
        if (amount) {
            refundBody.amount = Math.round(amount * 100);
        }
        const response = await fetch(`${getTilledApiUrl()}/v1/refunds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tilled-api-key': secretKey,
                'tilled-account': accountId,
                'Idempotency-Key': data.idempotencyKey || `refund-${paymentIntentId}-${Math.random().toString(36).substring(7)}-${Date.now()}`
            },
            body: JSON.stringify(refundBody)
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Refund API Error: ${JSON.stringify(errData)}`);
        }
        const responseData = await response.json();
        return { success: true, refundId: responseData.id };
    }
    catch (error) {
        functions.logger.error("Kort Refund Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Refund failed.');
    }
});
exports.submitDisputeEvidence = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
    const { disputeId, organizationId, evidenceText } = data;
    if (!disputeId || !organizationId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing disputeId or organizationId.');
    }
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value();
    if (!secretKey || !partnerAccountId) {
        throw new functions.https.HttpsError('failed-precondition', 'Kort Payments API is not configured.');
    }
    try {
        const db = admin.firestore();
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        if (!orgDoc.exists)
            throw new Error("Organization not found.");
        const orgData = orgDoc.data() || {};
        const accountId = orgData.kortAccountId;
        if (!accountId)
            throw new Error("Organization does not have a Kort account.");
        // NOTE: The exact Tilled endpoint might vary. We will attempt to update the dispute 
        // with evidence text, and then submit it if required.
        const response = await fetch(`${getTilledApiUrl()}/v1/disputes/${disputeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'tilled-api-key': secretKey,
                'tilled-account': accountId
            },
            body: JSON.stringify({
                evidence: {
                    uncategorized_text: evidenceText || "Evidence submitted by merchant."
                }
            })
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Evidence API Error: ${JSON.stringify(errData)}`);
        }
        const disputeRef = db.collection('organizations').doc(organizationId).collection('disputes').doc(disputeId);
        await disputeRef.update({
            evidenceSubmitted: true,
            evidenceText: evidenceText,
            status: 'under_review', // Optimistic update
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    }
    catch (error) {
        functions.logger.error("Kort Dispute Evidence Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Evidence submission failed.');
    }
});
exports.processAutomatedBilling = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).pubsub.schedule('0 0 * * *').timeZone('America/New_York').onRun(async (context) => {
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value();
    if (!secretKey || !partnerAccountId) {
        functions.logger.error('Kort API keys missing. Cannot run automated billing.');
        return;
    }
    const db = admin.firestore();
    const today = new Date();
    try {
        // Fetch platform settings to determine prices
        const settingsDoc = await db.collection('platformSettings').doc('global').get();
        const platformSettings = settingsDoc.exists ? settingsDoc.data() : undefined;
        const monthlyFee = platformSettings?.subscriptionFee || 7.00; // default 7$
        const aiWorkerFee = platformSettings?.virtualWorkerFee || 49.99; // default 49.99$
        // Find orgs that are due for billing and have a vaulted payment method
        const orgsSnap = await db.collection('organizations')
            .where('platformVaultedPaymentMethodId', '!=', null)
            .get();
        const dueOrgs = orgsSnap.docs.filter(doc => {
            const data = doc.data();
            if (data.subscriptionStatus === 'canceled' || data.subscriptionStatus === 'suspended')
                return false;
            // Check if nextBillingDate is today or in the past
            if (!data.nextBillingDate)
                return true; // Bill immediately if no date set
            const nextBilling = new Date(data.nextBillingDate);
            return nextBilling <= today;
        });
        functions.logger.info(`Found ${dueOrgs.length} organizations due for billing today.`);
        for (const doc of dueOrgs) {
            const orgData = doc.data();
            // Calculate amount
            let totalAmount = monthlyFee;
            if (orgData.plan && ['starter', 'growth', 'enterprise'].includes(orgData.plan) && orgData.subscriptionStatus === 'active') {
                totalAmount = 0;
            }
            if (orgData.virtualWorkerEnabled && orgData.virtualWorkerBillingType !== 'lifetime') {
                totalAmount += aiWorkerFee;
            }
            const userFee = platformSettings?.excessUserFee !== undefined ? platformSettings.excessUserFee : 25;
            const divFee = platformSettings?.divisionFee !== undefined ? platformSettings.divisionFee : 79;
            if (orgData.isFreeAccess) {
                const nextMonth = new Date(today);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                await db.collection('organizations').doc(doc.id).update({
                    nextBillingDate: nextMonth.toISOString(),
                    subscriptionStatus: 'active',
                    failedPaymentAttempts: 0,
                    lastBillingError: admin.firestore.FieldValue.delete()
                });
                await db.collection('platformInvoices').add({
                    organizationId: doc.id,
                    amount: 0,
                    date: today.toISOString(),
                    status: 'paid',
                    paymentIntentId: 'free_access_bypass',
                    description: 'TekTrakker Monthly Subscription (Free Access)'
                });
                functions.logger.info(`Processed free access renewal for ${doc.id}`);
                continue;
            }
            totalAmount += (orgData.additionalUserSlots || 0) * userFee;
            totalAmount += (orgData.additionalDivisionsSlots || 0) * divFee;
            const totalAmountCents = Math.round(totalAmount * 100);
            const payload = {
                amount: totalAmountCents,
                currency: 'usd',
                payment_method_id: orgData.platformVaultedPaymentMethodId,
                customer_id: orgData.platformCustomerId,
                payment_method_types: orgData.platformVaultedPaymentType ? [orgData.platformVaultedPaymentType] : ['card'],
                confirm: true,
                off_session: true,
                metadata: {
                    organizationId: doc.id,
                    type: 'subscription'
                }
            };
            try {
                const orgMerchantId = orgData.kortAccountId || getPlatformMerchantId();
                const response = await fetch(`${getTilledApiUrl()}/v1/payment-intents`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'tilled-api-key': secretKey,
                        'tilled-account': orgMerchantId,
                        'Idempotency-Key': `billing-${doc.id}-${today.toISOString().split('T')[0]}`
                    },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    const piData = await response.json();
                    if (piData.status === 'succeeded' || piData.status === 'processing') {
                        // Success!
                        const nextMonth = new Date(today);
                        nextMonth.setMonth(nextMonth.getMonth() + 1);
                        await db.collection('organizations').doc(doc.id).update({
                            nextBillingDate: nextMonth.toISOString(),
                            subscriptionStatus: 'active',
                            failedPaymentAttempts: 0,
                            lastBillingError: admin.firestore.FieldValue.delete()
                        });
                        await db.collection('platformInvoices').add({
                            organizationId: doc.id,
                            amount: totalAmount,
                            date: today.toISOString(),
                            status: 'paid',
                            paymentIntentId: piData.id,
                            description: 'TekTrakker Monthly Subscription'
                        });
                        functions.logger.info(`Successfully billed ${doc.id} for $${totalAmount}`);
                    }
                    else {
                        throw new Error(`Intent status: ${piData.status}`);
                    }
                }
                else {
                    const errData = await response.json();
                    throw new Error(JSON.stringify(errData));
                }
            }
            catch (err) {
                // Dunning logic
                functions.logger.error(`Failed to bill ${doc.id}: ${err.message}`);
                const failedAttempts = (orgData.failedPaymentAttempts || 0) + 1;
                const updates = {
                    failedPaymentAttempts: failedAttempts,
                    lastBillingError: err.message,
                    subscriptionStatus: failedAttempts >= 3 ? 'suspended' : 'past_due'
                };
                // If not suspended, retry tomorrow (nextBillingDate stays in past)
                await db.collection('organizations').doc(doc.id).update(updates);
                await db.collection('platformInvoices').add({
                    organizationId: doc.id,
                    amount: totalAmount,
                    date: today.toISOString(),
                    status: 'failed',
                    description: 'TekTrakker Monthly Subscription',
                    error: err.message
                });
            }
        }
    }
    catch (e) {
        functions.logger.error('Fatal error in processAutomatedBilling', e);
    }
});
exports.confirmKortACHPayment = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
    const { clientSecret, organizationId, billingDetails, achDetails } = data;
    if (!clientSecret || !billingDetails || !achDetails) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required ACH payment details.');
    }
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value();
    if (!secretKey || !partnerAccountId) {
        throw new functions.https.HttpsError('failed-precondition', 'Kort Payments is not configured.');
    }
    try {
        const db = admin.firestore();
        let accountId = data.accountId;
        if (!accountId && organizationId) {
            const orgDoc = await db.collection('organizations').doc(organizationId).get();
            if (orgDoc.exists)
                accountId = orgDoc.data()?.kortAccountId;
        }
        if (!accountId)
            throw new functions.https.HttpsError('failed-precondition', 'No connected Kort account.');
        const headers = {
            'Content-Type': 'application/json',
            'tilled-api-key': secretKey,
            'tilled-account': accountId,
        };
        // 1. Create the ACH payment method server-side
        const pmResponse = await fetch(`${getTilledApiUrl()}/v1/payment-methods`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                type: 'ach_debit',
                billing_details: {
                    name: String(billingDetails.name || 'Customer').trim(),
                    address: {
                        street: String(billingDetails.street || '').trim(),
                        city: String(billingDetails.city || '').trim(),
                        state: String(billingDetails.state || '').trim(),
                        zip: String(billingDetails.zip || '').trim(),
                        country: normalizeCountryCode(billingDetails.country)
                    }
                },
                ach_debit: {
                    account_type: achDetails.accountType || 'checking',
                    account_number: String(achDetails.accountNumber).replace(/\D/g, ''),
                    routing_number: String(achDetails.routingNumber).replace(/\D/g, ''),
                    account_holder_name: String(billingDetails.name || 'Customer').trim().substring(0, 22)
                }
            })
        });
        if (!pmResponse.ok) {
            const errData = await pmResponse.json();
            throw new Error(`Failed to create ACH payment method: ${JSON.stringify(errData)}`);
        }
        const pmData = await pmResponse.json();
        const paymentMethodId = pmData.id;
        // 2. Confirm the payment intent with this payment method
        const paymentIntentId = clientSecret.split('_secret_')[0];
        const confirmResponse = await fetch(`${getTilledApiUrl()}/v1/payment-intents/${paymentIntentId}/confirm`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                payment_method_id: paymentMethodId
            })
        });
        if (!confirmResponse.ok) {
            const errData = await confirmResponse.json();
            throw new Error(`Failed to confirm payment intent: ${JSON.stringify(errData)}`);
        }
        const confirmData = await confirmResponse.json();
        const status = confirmData.status;
        if (status !== 'succeeded' && status !== 'processing') {
            const errorMsg = confirmData.last_payment_error?.message || `Payment failed with status: ${status}`;
            throw new Error(`Payment failed: ${errorMsg}`);
        }
        return {
            success: true,
            id: paymentIntentId,
            status: status
        };
    }
    catch (error) {
        functions.logger.error("Kort ACH Confirmation Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'ACH confirmation failed.');
    }
});
exports.testKortSubscriptionPayment = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
    const { organizationId } = data;
    if (!organizationId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing organizationId.');
    }
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value();
    if (!secretKey || !partnerAccountId) {
        throw new functions.https.HttpsError('failed-precondition', 'Kort Payments is not fully configured on the server.');
    }
    try {
        const db = admin.firestore();
        const orgRef = db.collection('organizations').doc(organizationId);
        const orgDoc = await orgRef.get();
        if (!orgDoc.exists) {
            throw new Error('Organization not found.');
        }
        const orgData = orgDoc.data() || {};
        const { platformCustomerId, platformVaultedPaymentMethodId, platformVaultedPaymentType, virtualWorkerEnabled } = orgData;
        if (!platformCustomerId || !platformVaultedPaymentMethodId) {
            throw new Error('No vaulted payment method found for this organization.');
        }
        // Fetch platform settings to determine prices
        const settingsDoc = await db.collection('platformSettings').doc('global').get();
        const platformSettings = settingsDoc.exists ? settingsDoc.data() : undefined;
        const monthlyFee = platformSettings?.subscriptionFee !== undefined ? platformSettings.subscriptionFee : 7.00;
        const aiWorkerFee = platformSettings?.virtualWorkerFee !== undefined ? platformSettings.virtualWorkerFee : 49.99;
        // Calculate amount
        let totalAmount = monthlyFee;
        if (orgData.plan && ['starter', 'growth', 'enterprise'].includes(orgData.plan) && orgData.subscriptionStatus === 'active') {
            totalAmount = 0;
        }
        if (virtualWorkerEnabled && orgData.virtualWorkerBillingType !== 'lifetime') {
            totalAmount += aiWorkerFee;
        }
        const userFee = platformSettings?.excessUserFee !== undefined ? platformSettings.excessUserFee : 25;
        const divFee = platformSettings?.divisionFee !== undefined ? platformSettings.divisionFee : 79;
        if (orgData.isFreeAccess) {
            const today = new Date();
            const nextMonth = new Date(today);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            await orgRef.update({
                nextBillingDate: nextMonth.toISOString(),
                subscriptionStatus: 'active',
                failedPaymentAttempts: 0,
                lastBillingError: admin.firestore.FieldValue.delete()
            });
            await db.collection('platformInvoices').add({
                organizationId: organizationId,
                amount: 0,
                date: today.toISOString(),
                status: 'paid',
                paymentIntentId: 'free_access_bypass',
                description: 'TekTrakker Monthly Subscription (Free Access Simulator)'
            });
            return {
                success: true,
                message: `Processed free access subscription simulation successfully`
            };
        }
        totalAmount += (orgData.additionalUserSlots || 0) * userFee;
        totalAmount += (orgData.additionalDivisionsSlots || 0) * divFee;
        const totalAmountCents = Math.round(totalAmount * 100);
        const payload = {
            amount: totalAmountCents,
            currency: 'usd',
            payment_method_id: platformVaultedPaymentMethodId,
            customer_id: platformCustomerId,
            payment_method_types: platformVaultedPaymentType ? [platformVaultedPaymentType] : ['card'],
            confirm: true,
            off_session: true,
            metadata: {
                organizationId: organizationId,
                type: 'subscription_simulator'
            }
        };
        const orgMerchantId = orgData.kortAccountId || getPlatformMerchantId();
        const response = await fetch(`${getTilledApiUrl()}/v1/payment-intents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tilled-api-key': secretKey,
                'tilled-account': orgMerchantId
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(JSON.stringify(errData));
        }
        const piData = await response.json();
        if (piData.status === 'succeeded' || piData.status === 'processing') {
            const today = new Date();
            const nextMonth = new Date(today);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            await orgRef.update({
                nextBillingDate: nextMonth.toISOString(),
                subscriptionStatus: 'active',
                failedPaymentAttempts: 0,
                lastBillingError: admin.firestore.FieldValue.delete()
            });
            await db.collection('platformInvoices').add({
                organizationId: organizationId,
                amount: totalAmount,
                date: today.toISOString(),
                status: 'paid',
                paymentIntentId: piData.id,
                description: 'TekTrakker Monthly Subscription (Simulator)'
            });
            return {
                success: true,
                message: `Successfully charged off-session $${totalAmount.toFixed(2)}`
            };
        }
        else {
            throw new Error(`Payment intent ended with status: ${piData.status}`);
        }
    }
    catch (error) {
        functions.logger.error("Kort Subscription Test Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Subscription payment simulation failed.');
    }
});
exports.reconcileKortPayments = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, context) => {
    // 1. Ensure request is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { organizationId } = data;
    if (!organizationId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing organizationId.');
    }
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value();
    if (!secretKey || !partnerAccountId) {
        throw new functions.https.HttpsError('failed-precondition', 'Kort Payments is not fully configured on the server.');
    }
    try {
        const db = admin.firestore();
        // 2. Resolve the organization's kortAccountId
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        if (!orgDoc.exists) {
            throw new Error('Organization not found.');
        }
        const orgData = orgDoc.data() || {};
        const accountId = orgData.kortAccountId;
        if (!accountId) {
            throw new Error('Organization does not have a connected Kort account.');
        }
        // 3. Fetch successful payment intents in the last 15 days
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        const createdMinEpoch = Math.floor(fifteenDaysAgo.getTime() / 1000);
        // Fetch payment-intents from Tilled API
        const tilledApiUrl = getTilledApiUrl();
        const response = await fetch(`${tilledApiUrl}/v1/payment-intents?limit=100&created[gte]=${createdMinEpoch}`, {
            method: 'GET',
            headers: {
                'tilled-api-key': secretKey,
                'tilled-account': accountId
            }
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Kort API Fetch Error: ${JSON.stringify(errData)}`);
        }
        const piListResponse = await response.json();
        const intents = piListResponse.data || [];
        const succeededIntents = intents.filter((pi) => pi.status === 'succeeded');
        if (succeededIntents.length === 0) {
            return {
                success: true,
                message: 'No successful transactions found to reconcile in the last 15 days.',
                reconciledCount: 0,
                reconciledList: []
            };
        }
        // 4. Fetch all Unpaid jobs/invoices for this organization
        const unpaidJobsSnapshot = await db.collection('jobs')
            .where('organizationId', '==', organizationId)
            .where('invoice.status', 'in', ['Unpaid', 'Pending', 'Partially Paid'])
            .get();
        const unpaidJobs = unpaidJobsSnapshot.docs.map(doc => ({
            id: doc.id,
            ref: doc.ref,
            data: doc.data()
        }));
        if (unpaidJobs.length === 0) {
            return {
                success: true,
                message: 'No unpaid invoices found in database to reconcile.',
                reconciledCount: 0,
                reconciledList: []
            };
        }
        const reconciledList = [];
        // 5. Run matching loop
        for (const pi of succeededIntents) {
            const piId = pi.id;
            const piAmountDollars = pi.amount / 100;
            const metadata = pi.metadata || {};
            const jobId = metadata.jobId;
            let matchedJob = null;
            // Direct ID match
            if (jobId && jobId !== 'unknown') {
                matchedJob = unpaidJobs.find(job => job.id === jobId);
            }
            // Fuzzy Match Fallback (if no metadata, e.g. manual dashboard entries)
            if (!matchedJob) {
                // Find unpaid jobs with EXACT amount match
                const amountMatches = unpaidJobs.filter(job => {
                    const invAmt = Number(job.data.invoice?.totalAmount) || Number(job.data.invoice?.amount) || 0;
                    return Math.abs(invAmt - piAmountDollars) < 0.01;
                });
                if (amountMatches.length === 1) {
                    // Unique amount match
                    matchedJob = amountMatches[0];
                }
                else if (amountMatches.length > 1) {
                    // Multiple jobs with exact same amount. Try matching customer name or cardholder name
                    const cardholderName = (pi.last_payment_error?.payment_method?.card?.name ||
                        pi.charges?.data?.[0]?.billing_details?.name ||
                        '').toLowerCase();
                    if (cardholderName) {
                        const nameMatches = amountMatches.filter(job => {
                            const custName = (job.data.customerName || '').toLowerCase();
                            return custName.includes(cardholderName) || cardholderName.includes(custName);
                        });
                        if (nameMatches.length === 1) {
                            matchedJob = nameMatches[0];
                        }
                    }
                }
            }
            if (matchedJob) {
                // Check if this payment intent was already recorded to avoid duplicate syncs
                const alreadyPaid = matchedJob.data.invoice?.paymentIntentId === piId && matchedJob.data.invoice?.status === 'Paid';
                if (!alreadyPaid) {
                    const paidDate = pi.charges?.data?.[0]?.created
                        ? new Date(pi.charges.data[0].created * 1000).toISOString()
                        : new Date().toISOString();
                    await matchedJob.ref.update({
                        'invoice.status': 'Paid',
                        'invoice.paidDate': paidDate,
                        'invoice.paymentIntentId': piId,
                        'invoice.paymentMethod': 'Credit Card'
                    });
                    reconciledList.push({
                        invoiceId: matchedJob.data.invoice?.id || matchedJob.id,
                        customerName: matchedJob.data.customerName,
                        amount: piAmountDollars,
                        paymentIntentId: piId
                    });
                    // Remove this job from our unpaid local list so we don't double match it
                    const index = unpaidJobs.indexOf(matchedJob);
                    if (index > -1) {
                        unpaidJobs.splice(index, 1);
                    }
                }
            }
        }
        return {
            success: true,
            reconciledCount: reconciledList.length,
            reconciledList: reconciledList,
            message: reconciledList.length > 0
                ? `Successfully reconciled ${reconciledList.length} invoice(s).`
                : 'Transactions were checked, but no new matching records required syncing.'
        };
    }
    catch (error) {
        functions.logger.error("Kort Reconciliation Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Payment reconciliation failed.');
    }
});
// --- AUTOMATED CUSTOMER MEMBERSHIP BILLING (CRON JOB) ---
exports.processCustomerMembershipBilling = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).pubsub.schedule('0 1 * * *').timeZone('America/New_York').onRun(async (context) => {
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value();
    if (!secretKey || !partnerAccountId) {
        functions.logger.error('Kort API keys missing. Cannot run customer membership billing.');
        return;
    }
    const db = admin.firestore();
    const today = new Date();
    // Zero out hours/minutes for date comparison
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    try {
        // Find all active monthly service agreements
        const agreementsSnap = await db.collection('serviceAgreements')
            .where('status', '==', 'Active')
            .where('billingCycle', '==', 'Monthly')
            .get();
        functions.logger.info(`Found ${agreementsSnap.size} active monthly service agreements.`);
        for (const doc of agreementsSnap.docs) {
            const agreement = doc.data();
            const agreementId = doc.id;
            // Check next billing date
            let nextBillingDate;
            if (agreement.nextBillingDate) {
                nextBillingDate = new Date(agreement.nextBillingDate);
            }
            else {
                // Initialize next billing date based on startDate
                const startDate = new Date(agreement.startDate || agreement.createdAt || today);
                nextBillingDate = new Date(startDate);
                // Advance nextBillingDate month-by-month until it is >= today
                while (nextBillingDate < todayZero) {
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                }
                // Save the initialized nextBillingDate back to the agreement
                await db.collection('serviceAgreements').doc(agreementId).update({
                    nextBillingDate: nextBillingDate.toISOString()
                });
            }
            // Zero out time for exact day check
            const nextBillingZero = new Date(nextBillingDate.getFullYear(), nextBillingDate.getMonth(), nextBillingDate.getDate());
            // If nextBillingDate is today or in the past, bill the customer!
            if (nextBillingZero <= todayZero) {
                functions.logger.info(`Billing agreement ${agreementId} for customer ${agreement.customerId} (${agreement.customerName})`);
                const price = agreement.price || 29.00;
                const orgId = agreement.organizationId;
                // Get organization data for merchant ID
                const orgDoc = await db.collection('organizations').doc(orgId).get();
                const orgData = orgDoc.exists ? orgDoc.data() : {};
                const orgMerchantId = orgData?.kortAccountId || getPlatformMerchantId();
                // Get customer data to see if they have vaulted card
                const customerId = agreement.customerId;
                const customerDoc = await db.collection('customers').doc(customerId).get();
                const customerData = customerDoc.exists ? customerDoc.data() : {};
                // Generate new Job and Invoice record
                const newJobId = `job-membership-${agreementId}-${Date.now()}`;
                const invoiceId = `INV-sa-${agreementId}-${Date.now()}`;
                const newJob = {
                    id: newJobId,
                    organizationId: orgId,
                    customerId: customerId,
                    customerName: agreement.customerName,
                    address: customerData?.address || "Address Not Provided",
                    tasks: ["Gold Plan Monthly Membership"],
                    jobStatus: "Complete",
                    appointmentTime: today.toISOString(),
                    source: "ManualBilling",
                    createdAt: today.toISOString(),
                    invoice: {
                        id: invoiceId,
                        status: "Unpaid",
                        items: [
                            {
                                id: `item-membership-${Date.now()}`,
                                name: `${agreement.planName || 'Gold Plan'} Membership Fee`,
                                description: `Monthly membership fee for ${agreement.planName || 'Gold Plan'} - billing cycle resuming via Kort.`,
                                quantity: 1,
                                unitPrice: price,
                                total: price,
                                type: "Service",
                                taxable: false
                            }
                        ],
                        amount: price,
                        totalAmount: price,
                        subtotal: price,
                        taxAmount: 0,
                        taxRate: 0,
                        billToName: agreement.customerName,
                        billToAddress: customerData?.address || "Address Not Provided",
                        paidDate: null
                    }
                };
                let paymentIntentId = "";
                // Attempt auto-billing if card details are vaulted
                const vaultedPaymentMethodId = customerData?.vaultedPaymentMethodId;
                const kortCustomerId = customerData?.kortCustomerId;
                if (vaultedPaymentMethodId && kortCustomerId && orgMerchantId) {
                    try {
                        const amountCents = Math.round(price * 100);
                        const payload = {
                            amount: amountCents,
                            currency: 'usd',
                            payment_method_id: vaultedPaymentMethodId,
                            customer_id: kortCustomerId,
                            payment_method_types: customerData?.vaultedPaymentType ? [customerData.vaultedPaymentType] : ['card'],
                            confirm: true,
                            off_session: true,
                            metadata: {
                                customerId: customerId,
                                serviceAgreementId: agreementId,
                                type: 'membership_recurrent',
                                jobId: newJobId
                            }
                        };
                        const response = await fetch(`${getTilledApiUrl()}/v1/payment-intents`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'tilled-api-key': secretKey,
                                'tilled-account': orgMerchantId
                            },
                            body: JSON.stringify(payload)
                        });
                        if (response.ok) {
                            const piData = await response.json();
                            if (piData.status === 'succeeded' || piData.status === 'processing') {
                                paymentIntentId = piData.id;
                                newJob.invoice.status = 'Paid';
                                newJob.invoice.paidDate = today.toISOString();
                                newJob.invoice.paymentIntentId = paymentIntentId;
                                newJob.invoice.paymentMethod = 'Credit Card';
                                functions.logger.info(`Successfully auto-billed $${price} off-session for ${agreement.customerName}`);
                            }
                            else {
                                functions.logger.warn(`Off-session payment intent status: ${piData.status}`);
                            }
                        }
                        else {
                            const errData = await response.json();
                            functions.logger.error(`Off-session payment error payload: ${JSON.stringify(errData)}`);
                        }
                    }
                    catch (payErr) {
                        functions.logger.error(`Failed to process off-session charge for customer ${customerId}:`, payErr);
                    }
                }
                else {
                    functions.logger.info(`No vaulted credentials found for customer ${customerId}. Created invoice INV-sa-${agreementId} for manual payment.`);
                }
                // Save Job/Invoice document to Firestore
                await db.collection('jobs').doc(newJobId).set(newJob);
                // Advance nextBillingDate by 1 month
                const nextMonth = new Date(nextBillingDate);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                await db.collection('serviceAgreements').doc(agreementId).update({
                    nextBillingDate: nextMonth.toISOString()
                });
            }
        }
    }
    catch (err) {
        functions.logger.error("Automated Customer Membership Billing Sweep Error:", err);
    }
});
// --- HTTPS SIMULATION FOR CUSTOMER MEMBERSHIP BILLING ---
exports.testCustomerMembershipBilling = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
    const secretKey = kortSecretKey.value();
    const partnerAccountId = kortAccountId.value();
    if (!secretKey || !partnerAccountId) {
        throw new functions.https.HttpsError('failed-precondition', 'Kort Payments is not fully configured.');
    }
    const { serviceAgreementId } = data;
    const db = admin.firestore();
    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diagnosticLogs = [];
    try {
        let docsToBill = [];
        if (serviceAgreementId) {
            const doc = await db.collection('serviceAgreements').doc(serviceAgreementId).get();
            if (!doc.exists) {
                throw new Error("Service agreement not found.");
            }
            docsToBill.push(doc);
        }
        else {
            const snap = await db.collection('serviceAgreements')
                .where('status', '==', 'Active')
                .where('billingCycle', '==', 'Monthly')
                .get();
            docsToBill = snap.docs;
        }
        diagnosticLogs.push(`Found ${docsToBill.length} agreements to check.`);
        for (const doc of docsToBill) {
            const agreement = doc.data();
            const agreementId = doc.id;
            // Check next billing date
            let nextBillingDate;
            if (agreement.nextBillingDate) {
                nextBillingDate = new Date(agreement.nextBillingDate);
                diagnosticLogs.push(`Agreement ${agreementId} has nextBillingDate: ${agreement.nextBillingDate}`);
            }
            else {
                const startDate = new Date(agreement.startDate || agreement.createdAt || today);
                nextBillingDate = new Date(startDate);
                while (nextBillingDate < todayZero) {
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                }
                await db.collection('serviceAgreements').doc(agreementId).update({
                    nextBillingDate: nextBillingDate.toISOString()
                });
                diagnosticLogs.push(`Agreement ${agreementId} nextBillingDate initialized to: ${nextBillingDate.toISOString()}`);
            }
            const nextBillingZero = new Date(nextBillingDate.getFullYear(), nextBillingDate.getMonth(), nextBillingDate.getDate());
            if (nextBillingZero <= todayZero) {
                diagnosticLogs.push(`Billing agreement ${agreementId} (price: $${agreement.price})`);
                const price = agreement.price || 29.00;
                const orgId = agreement.organizationId;
                const orgDoc = await db.collection('organizations').doc(orgId).get();
                const orgData = orgDoc.exists ? orgDoc.data() : {};
                const orgMerchantId = orgData?.kortAccountId || getPlatformMerchantId();
                const customerId = agreement.customerId;
                const customerDoc = await db.collection('customers').doc(customerId).get();
                const customerData = customerDoc.exists ? customerDoc.data() : {};
                const newJobId = `job-membership-${agreementId}-${Date.now()}`;
                const invoiceId = `INV-sa-${agreementId}-${Date.now()}`;
                const newJob = {
                    id: newJobId,
                    organizationId: orgId,
                    customerId: customerId,
                    customerName: agreement.customerName,
                    address: customerData?.address || "Address Not Provided",
                    tasks: ["Gold Plan Monthly Membership"],
                    jobStatus: "Complete",
                    appointmentTime: today.toISOString(),
                    source: "ManualBilling",
                    createdAt: today.toISOString(),
                    invoice: {
                        id: invoiceId,
                        status: "Unpaid",
                        items: [
                            {
                                id: `item-membership-${Date.now()}`,
                                name: `${agreement.planName || 'Gold Plan'} Membership Fee`,
                                description: `Monthly membership fee for ${agreement.planName || 'Gold Plan'} - billing cycle resuming via Kort.`,
                                quantity: 1,
                                unitPrice: price,
                                total: price,
                                type: "Service",
                                taxable: false
                            }
                        ],
                        amount: price,
                        totalAmount: price,
                        subtotal: price,
                        taxAmount: 0,
                        taxRate: 0,
                        billToName: agreement.customerName,
                        billToAddress: customerData?.address || "Address Not Provided",
                        paidDate: null
                    }
                };
                let paymentIntentId = "";
                const vaultedPaymentMethodId = customerData?.vaultedPaymentMethodId;
                const kortCustomerId = customerData?.kortCustomerId;
                if (vaultedPaymentMethodId && kortCustomerId && orgMerchantId) {
                    diagnosticLogs.push(`Customer ${customerId} has vaulted card. Attempting off-session payment...`);
                    try {
                        const amountCents = Math.round(price * 100);
                        const payload = {
                            amount: amountCents,
                            currency: 'usd',
                            payment_method_id: vaultedPaymentMethodId,
                            customer_id: kortCustomerId,
                            payment_method_types: customerData?.vaultedPaymentType ? [customerData.vaultedPaymentType] : ['card'],
                            confirm: true,
                            off_session: true,
                            metadata: {
                                customerId: customerId,
                                serviceAgreementId: agreementId,
                                type: 'membership_recurrent',
                                jobId: newJobId
                            }
                        };
                        const response = await fetch(`${getTilledApiUrl()}/v1/payment-intents`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'tilled-api-key': secretKey,
                                'tilled-account': orgMerchantId
                            },
                            body: JSON.stringify(payload)
                        });
                        if (response.ok) {
                            const piData = await response.json();
                            if (piData.status === 'succeeded' || piData.status === 'processing') {
                                paymentIntentId = piData.id;
                                newJob.invoice.status = 'Paid';
                                newJob.invoice.paidDate = today.toISOString();
                                newJob.invoice.paymentIntentId = paymentIntentId;
                                newJob.invoice.paymentMethod = 'Credit Card';
                                diagnosticLogs.push(`Successfully auto-billed $${price} for ${agreement.customerName}`);
                            }
                            else {
                                diagnosticLogs.push(`Off-session payment intent status returned: ${piData.status}`);
                            }
                        }
                        else {
                            const errData = await response.json();
                            diagnosticLogs.push(`Off-session payment API error: ${JSON.stringify(errData)}`);
                        }
                    }
                    catch (payErr) {
                        diagnosticLogs.push(`Failed to process off-session charge: ${payErr.message}`);
                    }
                }
                else {
                    diagnosticLogs.push(`No vaulted credentials for customer ${customerId}. Created INV-sa-${agreementId} for manual payment.`);
                }
                await db.collection('jobs').doc(newJobId).set(newJob);
                const nextMonth = new Date(nextBillingDate);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                await db.collection('serviceAgreements').doc(agreementId).update({
                    nextBillingDate: nextMonth.toISOString()
                });
                diagnosticLogs.push(`Agreement ${agreementId} nextBillingDate advanced to: ${nextMonth.toISOString()}`);
            }
            else {
                diagnosticLogs.push(`Agreement ${agreementId} is not due yet (next billing is: ${nextBillingDate.toISOString()})`);
            }
        }
        return {
            success: true,
            logs: diagnosticLogs
        };
    }
    catch (error) {
        return {
            success: false,
            error: error.message,
            logs: diagnosticLogs
        };
    }
});
//# sourceMappingURL=kortPayments.js.map