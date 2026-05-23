/* eslint-disable no-undef, @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';

const kortSecretKey = defineSecret('KORT_SECRET_KEY');
const kortAccountId = defineSecret('KORT_ACCOUNT_ID');
const kortWebhookSecret = defineSecret('KORT_WEBHOOK_SECRET');

export const createKortPaymentIntent = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
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
        
        const cleanMetadata: any = {};
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

        const payload: any = {
            amount: amountCents,
            currency: currency || 'usd',
            payment_method_types: data.paymentMethodType ? [data.paymentMethodType] : ['card', 'ach_debit'],
            metadata: cleanMetadata
        };

        if (data.platformFeeAmount !== undefined && data.platformFeeAmount > 0) {
            payload.platform_fee_amount = Math.round(data.platformFeeAmount * 100);
        }

        const response = await fetch('https://sandbox-api.tilled.com/v1/payment-intents', {
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
        const responseData = await response.json() as any;

        // Return the client_secret so the frontend can confirm the payment
        return { 
            success: true, 
            client_secret: responseData.client_secret,
            id: responseData.id
        };

    } catch (error: unknown) {
        functions.logger.error("Kort Payment Intent Error:", error);
        throw new functions.https.HttpsError('internal', (error as Error).message || 'Payment processing failed.');
    }
});

export const generateKortOnboardingLink = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
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
        let targetRedirectUrl = `https://tektrakker.sandbox-paymentsonline.io/onboarding/?account_id=${newAccountId}`;

        if (!newAccountId) {
            // Step 1: Create a connected account (merchant) under your platform
            const createMerchantRes = await fetch('https://sandbox-api.tilled.com/v1/accounts/connected', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'tilled-api-key': secretKey,
                    'tilled-account': partnerAccountId
                },
                body: JSON.stringify({
                    name: merchantName,
                    email: merchantEmail
                })
            });

            if (!createMerchantRes.ok) {
                const errData = await createMerchantRes.json();
                throw new Error(`Failed to create merchant account: ${JSON.stringify(errData)}`);
            }
            
            const accountData = await createMerchantRes.json() as any;
            newAccountId = accountData.id;
            
            // Immediate partial save
            await db.collection('organizations').doc(organizationId).update({ kortAccountId: newAccountId });
        }

        if (!tilledUserId) {
            // Ensure unique email for user to prevent 403 "This email already exists" across Sandbox testing
            const uniqueUserEmail = `${merchantEmail.split('@')[0]}+${organizationId.substring(0,6)}@${merchantEmail.split('@')[1] || 'tektrakker.com'}`;

            // Step 2: Create a user attached to this new merchant account
            const randomPassword = Math.random().toString(36).slice(-8) + 'A1!'; // meets complexity reqs
            const createUserRes = await fetch('https://sandbox-api.tilled.com/v1/users', {
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

            if (!createUserRes.ok) {
                const errData = await createUserRes.json();
                throw new Error(`Failed to create merchant user: ${JSON.stringify(errData)}`);
            }

            const userData = await createUserRes.json() as any;
            tilledUserId = userData.id;

            // Save the user ID now that it's created
            await db.collection('organizations').doc(organizationId).update({ tilledUserId: tilledUserId });
        }

        // Fetch account to get exact onboarding url
        const getAccRes = await fetch(`https://sandbox-api.tilled.com/v1/accounts/connected/${newAccountId}`, {
            headers: {
                'tilled-api-key': secretKey,
                'tilled-account': partnerAccountId
            }
        });
        if (getAccRes.ok) {
            const acc = await getAccRes.json() as any;
            if (acc.capabilities && acc.capabilities.length > 0 && acc.capabilities[0].onboarding_application_url) {
                targetRedirectUrl = acc.capabilities[0].onboarding_application_url;
            }
        }

        // Step 3: Generate an Auth Link for the user, targeting the onboarding page
        const fallbackRedirect = `/onboarding/?account_id=${newAccountId}`;
        const finalRedirectUrl = targetRedirectUrl && targetRedirectUrl !== `https://tektrakker.sandbox-paymentsonline.io/onboarding/?account_id=undefined` 
            ? targetRedirectUrl 
            : fallbackRedirect;

        // Ensure we don't prepend the domain if Tilled already prepends it
        const cleanRedirectUrl = finalRedirectUrl.startsWith('http') ? new URL(finalRedirectUrl).pathname + new URL(finalRedirectUrl).search : finalRedirectUrl;

        const appRes = await fetch('https://sandbox-api.tilled.com/v1/auth-links', {
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
            throw new Error(`Failed to generate auth link: ${JSON.stringify(errData)}`);
        }

        const appData = await appRes.json() as any;

        return { 
            success: true, 
            accountId: newAccountId,
            onboardingUrl: appData.url
        };

    } catch (error: unknown) {
        functions.logger.error("Kort Onboarding Link Error:", error);
        throw new functions.https.HttpsError('internal', (error as Error).message || 'Failed to generate onboarding link.');
    }
});

// Retrieves or creates a Tilled Customer on the Platform Account for Subscriptions/Vaulting
const getOrCreateKortCustomerHelper = async (organizationId: string, db: admin.firestore.Firestore, secretKey: string, partnerAccountId: string) => {
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
    const createCustomerRes = await fetch('https://sandbox-api.tilled.com/v1/customers', {
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

    const customerData = await createCustomerRes.json() as any;
    const customerId = customerData.id;

    await orgRef.update({ platformCustomerId: customerId });
    return customerId;
};

export const attachKortPaymentMethod = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
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
        const orgMerchantId = orgData.kortAccountId || 'acct_zDruOrRgOZVtafF9TPC2J';

        const customerId = await getOrCreateKortCustomerHelper(organizationId, db, secretKey, partnerAccountId);

        let resolvedPaymentMethodId = paymentMethodId;

        // If ACH details are provided, create the payment method server-side first
        if (paymentMethodType === 'ach_debit' && achDetails) {
            if (!achDetails.accountNumber || !achDetails.routingNumber) {
                throw new Error('Missing bank account or routing number for ACH payment method creation.');
            }

            const pmResponse = await fetch('https://sandbox-api.tilled.com/v1/payment-methods', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'tilled-api-key': secretKey,
                    'tilled-account': orgMerchantId
                },
                body: JSON.stringify({
                    type: 'ach_debit',
                    billing_details: {
                        name: billingDetails?.name || 'Customer',
                        address: {
                            street: billingDetails?.street || '',
                            city: billingDetails?.city || '',
                            state: billingDetails?.state || '',
                            zip: billingDetails?.zip || '',
                            country: billingDetails?.country || 'US'
                        }
                    },
                    ach_debit: {
                        account_type: achDetails.accountType || 'checking',
                        account_number: achDetails.accountNumber,
                        routing_number: achDetails.routingNumber
                    }
                })
            });

            if (!pmResponse.ok) {
                const errData = await pmResponse.json();
                throw new Error(`Failed to create ACH payment method on server: ${JSON.stringify(errData)}`);
            }

            const pmData = await pmResponse.json() as any;
            resolvedPaymentMethodId = pmData.id;
        }

        if (!resolvedPaymentMethodId) {
            throw new Error('Failed to resolve paymentMethodId.');
        }

        const response = await fetch(`https://sandbox-api.tilled.com/v1/payment-methods/${resolvedPaymentMethodId}/attach`, {
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

    } catch (error: any) {
        functions.logger.error("Kort Attachment Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Attachment failed.');
    }
});

export const tilledWebhook = functions.runWith({ secrets: [kortSecretKey, kortWebhookSecret] }).https.onRequest(async (req, res) => {
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
        } else if (eventType === 'payment_intent.succeeded') {
            const metadata = eventData.metadata || {};
            const jobId = metadata.jobId;
            if (jobId && jobId !== 'unknown') {
                await db.collection('jobs').doc(jobId).update({
                    'invoice.status': 'Paid',
                    'invoice.paidDate': new Date().toISOString(),
                    'invoice.paymentIntentId': eventData.id
                });
                functions.logger.info(`Job ${jobId} marked as Paid via webhook with intent ${eventData.id}.`);
            }
            res.status(200).send('Payment succeeded processed');
        } else if (eventType === 'payment_intent.payment_failed' || eventType === 'charge.failed') {
            let metadata = eventData.metadata || {};
            let jobId = metadata.jobId;

            if (!jobId && eventData.payment_intent_id) {
                const secretKey = kortSecretKey.value();
                if (secretKey) {
                    try {
                        const piRes = await fetch(`https://sandbox-api.tilled.com/v1/payment-intents/${eventData.payment_intent_id}`, {
                            headers: {
                                'tilled-api-key': secretKey,
                                'tilled-account': accountId
                            }
                        });
                        if (piRes.ok) {
                            const piData = await piRes.json() as any;
                            if (piData.metadata && piData.metadata.jobId) {
                                jobId = piData.metadata.jobId;
                            }
                        }
                    } catch (e) {
                        functions.logger.error("Failed to fetch payment intent for failed charge metadata", e);
                    }
                }
            }

            if (jobId && jobId !== 'unknown') {
                await db.collection('jobs').doc(jobId).update({
                    'invoice.status': 'Failed',
                    'invoice.failedDate': new Date().toISOString()
                });
                functions.logger.warn(`Job ${jobId} marked as Failed via webhook with intent ${eventData.id}.`);
            } else {
                functions.logger.warn(`Payment failed for account ${accountId}, intent ${eventData.id}`);
            }
            res.status(200).send('Payment failed processed');
        } else if (eventType === 'charge.refunded') {
            let metadata = eventData.metadata || {};
            let jobId = metadata.jobId;

            // If metadata is missing from the charge, fetch it from the payment intent
            if (!jobId && eventData.payment_intent_id) {
                const secretKey = kortSecretKey.value();
                if (secretKey) {
                    try {
                        const piRes = await fetch(`https://sandbox-api.tilled.com/v1/payment-intents/${eventData.payment_intent_id}`, {
                            headers: {
                                'tilled-api-key': secretKey,
                                'tilled-account': accountId
                            }
                        });
                        if (piRes.ok) {
                            const piData = await piRes.json() as any;
                            if (piData.metadata && piData.metadata.jobId) {
                                jobId = piData.metadata.jobId;
                            }
                        }
                    } catch (e) {
                        functions.logger.error("Failed to fetch payment intent for refund metadata", e);
                    }
                }
            }

            if (jobId && jobId !== 'unknown') {
                await db.collection('jobs').doc(jobId).update({
                    'invoice.status': 'Refunded',
                    'invoice.refundedDate': new Date().toISOString()
                });
                functions.logger.info(`Job ${jobId} marked as Refunded via webhook.`);
            } else {
                functions.logger.warn(`Could not determine jobId for refunded charge ${eventData.id}`);
            }
            res.status(200).send('Refund processed');
        } else if (eventType.startsWith('charge.dispute.')) {
            let metadata = eventData.metadata || {};
            let jobId = metadata.jobId;

            // If metadata is missing from the dispute, fetch it from the charge's payment intent
            if (!jobId && eventData.charge_id) {
                const secretKey = kortSecretKey.value();
                if (secretKey) {
                    try {
                        const chargeRes = await fetch(`https://sandbox-api.tilled.com/v1/charges/${eventData.charge_id}`, {
                            headers: {
                                'tilled-api-key': secretKey,
                                'tilled-account': accountId
                            }
                        });
                        if (chargeRes.ok) {
                            const chargeData = await chargeRes.json() as any;
                            if (chargeData.payment_intent_id) {
                                const piRes = await fetch(`https://sandbox-api.tilled.com/v1/payment-intents/${chargeData.payment_intent_id}`, {
                                    headers: {
                                        'tilled-api-key': secretKey,
                                        'tilled-account': accountId
                                    }
                                });
                                if (piRes.ok) {
                                    const piData = await piRes.json() as any;
                                    if (piData.metadata && piData.metadata.jobId) {
                                        jobId = piData.metadata.jobId;
                                    }
                                }
                            }
                        }
                    } catch (e) {
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

            if (jobId && jobId !== 'unknown') {
                if (eventType === 'charge.dispute.created') {
                    await db.collection('jobs').doc(jobId).update({
                        'invoice.status': 'Disputed',
                        'invoice.disputedDate': new Date().toISOString()
                    });
                    functions.logger.info(`Job ${jobId} marked as Disputed via webhook.`);
                }
            } else {
                functions.logger.warn(`Could not determine jobId for disputed charge ${eventData.id}`);
            }
            res.status(200).send('Dispute processed');
        } else if (eventType.startsWith('payout.')) {
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
        } else {
            // Unhandled event type, still return 200 so Tilled doesn't retry endlessly
            functions.logger.info(`Unhandled webhook event type: ${eventType}`);
            res.status(200).send(`Unhandled event type: ${eventType}`);
        }
    } catch (error: unknown) {
        functions.logger.error("Error processing Tilled webhook:", error);
        res.status(500).send("Internal Server Error processing webhook");
    }
});

export const refundKortPayment = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
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
        if (!orgDoc.exists) throw new Error("Organization not found.");
        const orgData = orgDoc.data() || {};
        const accountId = orgData.kortAccountId;

        if (!accountId) throw new Error("Organization does not have a Kort account.");

        const refundBody: any = { payment_intent_id: paymentIntentId };
        if (amount) {
            refundBody.amount = Math.round(amount * 100);
        }

        const response = await fetch('https://sandbox-api.tilled.com/v1/refunds', {
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

        const responseData = await response.json() as any;
        return { success: true, refundId: responseData.id };

    } catch (error: unknown) {
        functions.logger.error("Kort Refund Error:", error);
        throw new functions.https.HttpsError('internal', (error as Error).message || 'Refund failed.');
    }
});

export const submitDisputeEvidence = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
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
        if (!orgDoc.exists) throw new Error("Organization not found.");
        const orgData = orgDoc.data() || {};
        const accountId = orgData.kortAccountId;

        if (!accountId) throw new Error("Organization does not have a Kort account.");

        // NOTE: The exact Tilled endpoint might vary. We will attempt to update the dispute 
        // with evidence text, and then submit it if required.
        const response = await fetch(`https://sandbox-api.tilled.com/v1/disputes/${disputeId}`, {
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

    } catch (error: unknown) {
        functions.logger.error("Kort Dispute Evidence Error:", error);
        throw new functions.https.HttpsError('internal', (error as Error).message || 'Evidence submission failed.');
    }
});

export const processAutomatedBilling = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).pubsub.schedule('0 0 * * *').timeZone('America/New_York').onRun(async (context) => {
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
        const settingsDocs = await db.collection('platformSettings').limit(1).get();
        const platformSettings = settingsDocs.docs[0]?.data();
        const monthlyFee = platformSettings?.subscriptionFee || 7.00; // default 7$
        const aiWorkerFee = platformSettings?.virtualWorkerFee || 10.00; // default 10$

        // Find orgs that are due for billing and have a vaulted payment method
        const orgsSnap = await db.collection('organizations')
            .where('platformVaultedPaymentMethodId', '!=', null)
            .get();

        const dueOrgs = orgsSnap.docs.filter(doc => {
            const data = doc.data();
            if (data.subscriptionStatus === 'canceled' || data.subscriptionStatus === 'suspended') return false;
            
            // Check if nextBillingDate is today or in the past
            if (!data.nextBillingDate) return true; // Bill immediately if no date set
            const nextBilling = new Date(data.nextBillingDate);
            return nextBilling <= today;
        });

        functions.logger.info(`Found ${dueOrgs.length} organizations due for billing today.`);

        for (const doc of dueOrgs) {
            const orgData = doc.data();
            
            // Calculate amount
            let totalAmount = monthlyFee;
            if (orgData.virtualWorkerEnabled) {
                totalAmount += aiWorkerFee;
            }
            
            const totalAmountCents = Math.round(totalAmount * 100);
            
            const payload: any = {
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
                const orgMerchantId = orgData.kortAccountId || 'acct_zDruOrRgOZVtafF9TPC2J';
                const response = await fetch('https://sandbox-api.tilled.com/v1/payment-intents', {
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
                    const piData = await response.json() as any;
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
                    } else {
                        throw new Error(`Intent status: ${piData.status}`);
                    }
                } else {
                    const errData = await response.json();
                    throw new Error(JSON.stringify(errData));
                }
            } catch (err: any) {
                // Dunning logic
                functions.logger.error(`Failed to bill ${doc.id}: ${err.message}`);
                const failedAttempts = (orgData.failedPaymentAttempts || 0) + 1;
                
                const updates: any = {
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
    } catch (e) {
        functions.logger.error('Fatal error in processAutomatedBilling', e);
    }
});

export const confirmKortACHPayment = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
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
            if (orgDoc.exists) accountId = orgDoc.data()?.kortAccountId;
        }
        if (!accountId) throw new functions.https.HttpsError('failed-precondition', 'No connected Kort account.');

        const headers = {
            'Content-Type': 'application/json',
            'tilled-api-key': secretKey,
            'tilled-account': accountId,
        };

        // 1. Create the ACH payment method server-side
        const pmResponse = await fetch('https://sandbox-api.tilled.com/v1/payment-methods', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                type: 'ach_debit',
                billing_details: {
                    name: billingDetails.name || 'Customer',
                    address: {
                        street: billingDetails.street || '',
                        city: billingDetails.city || '',
                        state: billingDetails.state || '',
                        zip: billingDetails.zip || '',
                        country: billingDetails.country || 'US'
                    }
                },
                ach_debit: {
                    account_type: achDetails.accountType || 'checking',
                    account_number: achDetails.accountNumber,
                    routing_number: achDetails.routingNumber
                }
            })
        });

        if (!pmResponse.ok) {
            const errData = await pmResponse.json();
            throw new Error(`Failed to create ACH payment method: ${JSON.stringify(errData)}`);
        }

        const pmData = await pmResponse.json() as any;
        const paymentMethodId = pmData.id;

        // 2. Confirm the payment intent with this payment method
        const paymentIntentId = clientSecret.split('_secret_')[0];
        const confirmResponse = await fetch(`https://sandbox-api.tilled.com/v1/payment-intents/${paymentIntentId}/confirm`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                payment_method: paymentMethodId
            })
        });

        if (!confirmResponse.ok) {
            const errData = await confirmResponse.json();
            throw new Error(`Failed to confirm payment intent: ${JSON.stringify(errData)}`);
        }

        const confirmData = await confirmResponse.json() as any;
        return {
            success: true,
            id: paymentIntentId,
            status: confirmData.status
        };

    } catch (error: any) {
        functions.logger.error("Kort ACH Confirmation Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'ACH confirmation failed.');
    }
});

export const testKortSubscriptionPayment = functions.runWith({ secrets: [kortSecretKey, kortAccountId] }).https.onCall(async (data, _context) => {
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
        const settingsDocs = await db.collection('platformSettings').limit(1).get();
        const platformSettings = settingsDocs.docs[0]?.data();
        const monthlyFee = platformSettings?.subscriptionFee !== undefined ? platformSettings.subscriptionFee : 7.00;
        const aiWorkerFee = platformSettings?.virtualWorkerFee !== undefined ? platformSettings.virtualWorkerFee : 10.00;

        // Calculate amount
        let totalAmount = monthlyFee;
        if (virtualWorkerEnabled) {
            totalAmount += aiWorkerFee;
        }

        const totalAmountCents = Math.round(totalAmount * 100);

        const payload: any = {
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

        const orgMerchantId = orgData.kortAccountId || 'acct_zDruOrRgOZVtafF9TPC2J';
        const response = await fetch('https://sandbox-api.tilled.com/v1/payment-intents', {
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

        const piData = await response.json() as any;

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
        } else {
            throw new Error(`Payment intent ended with status: ${piData.status}`);
        }

    } catch (error: any) {
        functions.logger.error("Kort Subscription Test Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Subscription payment simulation failed.');
    }
});
