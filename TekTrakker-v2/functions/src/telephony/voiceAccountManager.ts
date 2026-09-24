/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { trackTelephonyUsage } from '../usageTracking';

if (admin.apps.length === 0) {
    try { admin.initializeApp(); } catch { /* ignore */ }
}
const db = admin.firestore();

export interface VerifiedAccountSummary {
    customerFirstName: string;
    hasOpenBalance: boolean;
    totalOpenBalance: number;
    unpaidInvoices: Array<{
        id: string;
        jobId?: string;
        amount: number;
        serviceDate?: string;
        description: string;
        dueDate?: string;
    }>;
    lastPayment?: {
        amount: number;
        date: string;
    };
    upcomingAppointments: Array<{
        id: string;
        scheduledDate: string;
        technicianName: string;
        jobType: string;
    }>;
    membershipPlan?: {
        name: string;
        status: string;
    };
}

export interface VerificationResult {
    verified: boolean;
    matchedField?: 'zip' | 'account' | 'address';
    reason?: string;
}

/**
 * Normalizes phone numbers to standard 10-digit and E.164 formats for lookup
 */
export function getLookupPhoneVariants(rawPhone: string): string[] {
    if (!rawPhone) return [];
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const variants = new Set<string>();

    variants.add(rawPhone.trim());
    variants.add(cleanDigits);

    if (cleanDigits.length === 10) {
        variants.add(`+1${cleanDigits}`);
        variants.add(`1${cleanDigits}`);
    } else if (cleanDigits.length === 11 && cleanDigits.startsWith('1')) {
        variants.add(cleanDigits.substring(1));
        variants.add(`+${cleanDigits}`);
    }

    return Array.from(variants);
}

/**
 * Normalizes spoken speech input, converting spoken number words to numeric digits
 */
export function normalizeSpokenNumbers(text: string): string {
    if (!text) return '';
    const wordToDigit: Record<string, string> = {
        'zero': '0', 'oh': '0',
        'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
    };

    let normalized = text.toLowerCase();
    for (const [word, digit] of Object.entries(wordToDigit)) {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        normalized = normalized.replace(regex, digit);
    }
    return normalized;
}

/**
 * Look up a customer in the specific organization's customer roster by phone
 * Strict multi-tenant isolation: queries only within organizationId == orgId
 */
export async function lookupCallerCustomer(orgId: string, fromPhone: string): Promise<{ customerId: string; customerData: any } | null> {
    if (!orgId || !fromPhone || orgId === 'platform' || orgId === 'master') {
        return null;
    }

    try {
        const phoneVariants = getLookupPhoneVariants(fromPhone);
        if (phoneVariants.length === 0) return null;

        // Query customers partitioned by organizationId
        const snapshots = await Promise.all([
            db.collection('customers')
                .where('organizationId', '==', orgId)
                .where('phone', 'in', phoneVariants.slice(0, 10))
                .limit(10)
                .get(),
            // Also check alternate phone field if used
            db.collection('customers')
                .where('organizationId', '==', orgId)
                .where('mobilePhone', 'in', phoneVariants.slice(0, 10))
                .limit(10)
                .get()
        ]);

        const foundDocs = [...snapshots[0].docs, ...snapshots[1].docs];
        // Filter out internal partner organization records (e.g., owner/staff links)
        const validDocs = foundDocs.filter(doc => {
            const data = doc.data();
            if (doc.id.startsWith('cust_partner_') || data?.linkedOrgId || (typeof data?.notes === 'string' && data.notes.includes('Linked Partner Organization'))) {
                return false;
            }
            return true;
        });

        if (validDocs.length > 0) {
            const doc = validDocs[0];
            return {
                customerId: doc.id,
                customerData: doc.data()
            };
        }

        // Secondary fallback: inspect recent jobs by customerPhone for this organization
        const jobsSnap = await db.collection('jobs')
            .where('organizationId', '==', orgId)
            .where('customerPhone', 'in', phoneVariants.slice(0, 10))
            .limit(5)
            .get();

        if (!jobsSnap.empty) {
            for (const jobDoc of jobsSnap.docs) {
                const jobData = jobDoc.data();
                if (jobData.customerId) {
                    const custDoc = await db.collection('customers').doc(jobData.customerId).get();
                    if (custDoc.exists && custDoc.data()?.organizationId === orgId) {
                        const data = custDoc.data();
                        if (!custDoc.id.startsWith('cust_partner_') && !data?.linkedOrgId && !(typeof data?.notes === 'string' && data.notes.includes('Linked Partner Organization'))) {
                            return {
                                customerId: custDoc.id,
                                customerData: data
                            };
                        }
                    }
                }
            }
        }

        return null;
    } catch (err) {
        functions.logger.warn(`Failed to lookup caller customer for org ${orgId}:`, err);
        return null;
    }
}

/**
 * Looks up a customer profile using spoken speech details (e.g., when the caller dials from
 * a number that does NOT match their account on file).
 * Extracts candidate 10-digit phone numbers, account numbers, or street addresses.
 */
export async function lookupCustomerBySpokenDetails(orgId: string, spokenSpeech: string): Promise<{ customerId: string; customerData: any } | null> {
    if (!orgId || !spokenSpeech || orgId === 'platform' || orgId === 'master') {
        return null;
    }

    try {
        const normalized = normalizeSpokenNumbers(spokenSpeech);
        const digitsOnly = normalized.replace(/\D/g, '');

        // 1. Check for 10-digit phone number in spoken input (e.g. "2817691567" or "12817691567")
        const phoneMatch = digitsOnly.match(/\b(?:\+?1)?([2-9]\d{9})\b/) || digitsOnly.match(/([2-9]\d{9})/);
        if (phoneMatch) {
            const extractedPhone = phoneMatch[1];
            const found = await lookupCallerCustomer(orgId, extractedPhone);
            if (found) return found;
        }

        // 2. Check for Account Number if present in speech (e.g. "ACC-1088", "1088", or "account 1088")
        let rawAcct: string | null = null;
        const accountMatch = normalized.match(/(?:account|acct|acc)(?:\s*(?:number|num|#))?\s*[:#-]?\s*([a-z0-9-]+)/i);
        if (accountMatch) {
            rawAcct = accountMatch[1].trim();
        } else {
            // Also check for standalone 4-8 digit number if caller just says the account number
            const directNumberMatch = normalized.match(/\b([0-9]{4,8})\b/);
            if (directNumberMatch) {
                rawAcct = directNumberMatch[1];
            }
        }

        if (rawAcct) {
            const acctSnap = await db.collection('customers')
                .where('organizationId', '==', orgId)
                .where('accountNumber', 'in', [rawAcct, rawAcct.toUpperCase(), `ACC-${rawAcct}`])
                .limit(5)
                .get();
            const validAcctDocs = acctSnap.docs.filter(d => !d.id.startsWith('cust_partner_') && !d.data()?.linkedOrgId);
            if (validAcctDocs.length > 0) {
                return { customerId: validAcctDocs[0].id, customerData: validAcctDocs[0].data() };
            }
        }

        // 3. Check for leading street number + street name match (e.g. "1420 Mockingbird")
        const addressPattern = normalized.match(/(\d{1,6})\s+([a-z]{3,20})/i);
        if (addressPattern) {
            const houseNum = addressPattern[1];
            const streetFragment = addressPattern[2].toLowerCase();
            
            // Query customers in org and check address
            const custsSnap = await db.collection('customers')
                .where('organizationId', '==', orgId)
                .limit(50)
                .get();
            
            for (const doc of custsSnap.docs) {
                if (doc.id.startsWith('cust_partner_') || doc.data()?.linkedOrgId) continue;
                const addr = (doc.data()?.address || '').toLowerCase();
                if (addr.includes(houseNum) && addr.includes(streetFragment)) {
                    return { customerId: doc.id, customerData: doc.data() };
                }
            }
        }

        return null;
    } catch (err) {
        functions.logger.warn(`Failed to lookup customer by spoken details in org ${orgId}:`, err);
        return null;
    }
}

/**
 * Deterministically verifies the caller's spoken input against the customer profile
 * Supported factors (zero PII disclosure):
 * 1. 5-digit billing zip code
 * 2. Last 4 digits of account number
 * 3. Leading house/street number from address
 */
export function verifyCallerIdentity(customerData: any, spokenSpeech: string): VerificationResult {
    if (!customerData || !spokenSpeech) {
        return { verified: false, reason: 'Missing customer data or spoken input' };
    }

    const normalizedSpeech = normalizeSpokenNumbers(spokenSpeech);
    const rawSpeechDigits = normalizedSpeech.replace(/\D/g, '');

    // 1. Verify 5-digit billing zip code
    const customerZip = (customerData.zip || customerData.postalCode || '').toString().trim().replace(/\D/g, '').substring(0, 5);
    if (customerZip && customerZip.length === 5) {
        // Check if customerZip appears in raw digits or as a 5-digit token
        if (rawSpeechDigits.includes(customerZip) || new RegExp(`\\b${customerZip}\\b`).test(normalizedSpeech)) {
            return { verified: true, matchedField: 'zip' };
        }
    }

    // 2. Verify last 4 digits of account number
    const customerAccount = (customerData.accountNumber || '').toString().trim().replace(/\D/g, '');
    if (customerAccount.length >= 4) {
        const last4Account = customerAccount.slice(-4);
        if (rawSpeechDigits.includes(last4Account) || new RegExp(`\\b${last4Account}\\b`).test(normalizedSpeech)) {
            return { verified: true, matchedField: 'account' };
        }
    }

    // 3. Verify house/street number from physical address (e.g. "1420" from "1420 Main St")
    const addressStr = (customerData.address || '').toString().trim();
    const leadingNumberMatch = addressStr.match(/^(\d{1,6})\b/);
    if (leadingNumberMatch) {
        const houseNumber = leadingNumberMatch[1];
        if (houseNumber.length >= 2) {
            if (rawSpeechDigits.includes(houseNumber) || new RegExp(`\\b${houseNumber}\\b`).test(normalizedSpeech)) {
                return { verified: true, matchedField: 'address' };
            }
        }
    }

    return { verified: false, reason: 'Input did not match zip, account number, or house number' };
}

/**
 * Queries and compiles an authenticated, sanitized account summary for the caller
 * Strips all confidential PII, payment tokens, SSNs, and sensitive internal notes
 */
export async function getCallerAccountSummary(orgId: string, customerId: string): Promise<VerifiedAccountSummary> {
    const summary: VerifiedAccountSummary = {
        customerFirstName: 'there',
        hasOpenBalance: false,
        totalOpenBalance: 0,
        unpaidInvoices: [],
        upcomingAppointments: []
    };

    try {
        const [customerDoc, jobsSnapshot, invoicesSnapshot] = await Promise.all([
            db.collection('customers').doc(customerId).get(),
            db.collection('jobs')
                .where('organizationId', '==', orgId)
                .where('customerId', '==', customerId)
                .limit(20)
                .get(),
            db.collection('invoices')
                .where('organizationId', '==', orgId)
                .where('customerId', '==', customerId)
                .limit(20)
                .get()
        ]);

        if (customerDoc.exists) {
            const cData = customerDoc.data() || {};
            const fullName = (cData.name || '').trim();
            const first = cData.firstName || (fullName ? fullName.split(' ')[0] : '');
            if (first) {
                summary.customerFirstName = first;
            }

            if (cData.membershipPlan || cData.agreementName) {
                summary.membershipPlan = {
                    name: cData.membershipPlan || cData.agreementName,
                    status: cData.membershipStatus || 'Active'
                };
            }
        }

        const now = new Date();
        const unpaidMap = new Map<string, any>();

        // Process Root Invoices
        invoicesSnapshot.docs.forEach(doc => {
            const inv = doc.data();
            const status = (inv.status || '').toLowerCase();
            const total = Number(inv.totalAmount || inv.amount || 0);

            if (status === 'unpaid' || status === 'pending' || status === 'overdue') {
                unpaidMap.set(doc.id, {
                    id: doc.id,
                    jobId: inv.jobId || doc.id,
                    amount: total,
                    serviceDate: inv.serviceDate || inv.date || '',
                    description: inv.description || inv.serviceSummary || 'Service Visit',
                    dueDate: inv.dueDate || ''
                });
            } else if (status === 'paid' && inv.paidDate) {
                if (!summary.lastPayment || new Date(inv.paidDate) > new Date(summary.lastPayment.date)) {
                    summary.lastPayment = {
                        amount: total,
                        date: inv.paidDate
                    };
                }
            }
        });

        // Process Job-embedded Invoices & Upcoming Appointments
        jobsSnapshot.docs.forEach(doc => {
            const job = doc.data();
            const jobStatus = job.jobStatus || job.status || '';

            // Check for upcoming appointments
            const scheduledDateStr = job.scheduledDate || job.scheduledTime || job.date;
            if (scheduledDateStr) {
                const jobDate = new Date(scheduledDateStr);
                const isUpcomingStatus = ['scheduled', 'in progress', 'dispatched', 'en route'].includes(jobStatus.toLowerCase());
                if (isUpcomingStatus && (jobDate >= new Date(now.getTime() - 4 * 3600000))) {
                    summary.upcomingAppointments.push({
                        id: doc.id,
                        scheduledDate: scheduledDateStr,
                        technicianName: job.technicianName || job.assignedTech || 'our service technician',
                        jobType: job.jobType || job.serviceType || 'Service Appointment'
                    });
                }
            }

            // Check embedded invoice in job
            if (job.invoice) {
                const invStatus = (job.invoice.status || '').toLowerCase();
                const invAmount = Number(job.invoice.totalAmount || job.invoice.amount || 0);
                if ((invStatus === 'unpaid' || invStatus === 'pending') && invAmount > 0) {
                    if (!unpaidMap.has(doc.id)) {
                        unpaidMap.set(doc.id, {
                            id: doc.id,
                            jobId: doc.id,
                            amount: invAmount,
                            serviceDate: job.scheduledDate || job.date || '',
                            description: job.jobType || job.description || 'Service Visit',
                            dueDate: job.invoice.dueDate || ''
                        });
                    }
                }
            }
        });

        const unpaidList = Array.from(unpaidMap.values());
        summary.unpaidInvoices = unpaidList;
        summary.totalOpenBalance = unpaidList.reduce((acc, curr) => acc + curr.amount, 0);
        summary.hasOpenBalance = summary.totalOpenBalance > 0;

        // Sort upcoming appointments chronologically
        summary.upcomingAppointments.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

    } catch (e) {
        functions.logger.error(`Error aggregating account summary for customer ${customerId}:`, e);
    }

    return summary;
}

/**
 * Dispatches an instant payment link via Twilio SMS to the caller's mobile number
 */
export async function dispatchPayByTextSms(
    orgId: string, 
    customerId: string, 
    toPhone: string, 
    invoiceOrJobId?: string,
    amount?: number
): Promise<{ success: boolean; paymentLink: string; message: string }> {
    try {
        if (!orgId || !toPhone) {
            return { success: false, paymentLink: '', message: 'Missing organization or caller phone number' };
        }

        // Fetch Organization Details & Twilio Secrets
        const [orgDoc, secretsDoc] = await Promise.all([
            db.collection('organizations').doc(orgId).get(),
            db.collection('organizations').doc(orgId).collection('secrets').doc('config').get()
        ]);

        const orgName = orgDoc.data()?.name || 'TekAir Inc';
        const twilioConfig = secretsDoc.data()?.twilioConfig;

        const targetId = invoiceOrJobId || customerId;
        const paymentLink = `https://tektrakker.web.app/#/invoice/${encodeURIComponent(targetId)}`;

        const formattedAmount = amount && amount > 0 ? ` of $${amount.toFixed(2)}` : '';
        const smsBody = `Hi! Here is your secure payment link${formattedAmount} for ${orgName}: ${paymentLink}\n\nTap to pay securely online via Card or Bank Transfer. Thank you for your business!`;

        let twilioClient: any = null;
        let fromNumber = process.env.TWILIO_PHONE_NUMBER || '+18339602099';

        if (twilioConfig?.accountSid && twilioConfig?.authToken && twilioConfig?.phoneNumber) {
            twilioClient = require('twilio')(twilioConfig.accountSid, twilioConfig.authToken);
            fromNumber = twilioConfig.phoneNumber;
        } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        }

        if (!twilioClient) {
            return { success: false, paymentLink, message: 'Twilio telephony client is not configured' };
        }

        await twilioClient.messages.create({
            from: fromNumber,
            to: toPhone,
            body: smsBody
        });

        // Track telephony usage
        await trackTelephonyUsage(orgId, 'sms_sent', 1, {
            type: 'ai_voice_pay_by_text',
            customerId,
            to: toPhone
        });

        // Save communication log under customer profile
        try {
            await db.collection('customers').doc(customerId).collection('communications').add({
                type: 'sms',
                direction: 'outbound',
                to: toPhone,
                from: fromNumber,
                content: smsBody,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                automated: true,
                source: 'AI Voice Pay-by-Text'
            });
        } catch { /* ignore non-blocking comm log error */ }

        return {
            success: true,
            paymentLink,
            message: 'Payment link sent successfully via SMS'
        };
    } catch (smsErr) {
        functions.logger.error(`Failed to dispatch pay-by-text SMS to ${toPhone}:`, smsErr);
        return { success: false, paymentLink: '', message: 'Failed to send SMS due to telephony gateway error' };
    }
}

/**
 * Speech Egress PII Scrubber
 * Hardcoded guardrail that ensures no credit card sequences, SSNs, or sensitive emails
 * can ever be vocalized over the phone by the text-to-speech engine.
 */
export function scrubPIISpeech(text: string): string {
    if (!text) return '';

    let sanitized = text;

    // 1. Redact 13-19 digit numeric sequences (credit card numbers)
    sanitized = sanitized.replace(/\b(?:\d[ -]?){13,19}\b/g, '[card number on file]');

    // 2. Redact Social Security Numbers (9 digits or XXX-XX-XXXX)
    sanitized = sanitized.replace(/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, '[identification number]');

    // 3. Replace full email addresses with friendly spoken alternative
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 'your email address on file');

    // 4. Clean up formatting asterisks or markdown symbols that could confuse TTS
    sanitized = sanitized.replace(/[*_~`#]/g, '');

    return sanitized;
}
