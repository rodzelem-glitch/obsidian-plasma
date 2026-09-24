/* eslint-disable no-undef, @typescript-eslint/no-explicit-any */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { trackTelephonyUsage, trackSmsUsage, trackAiUsage } from "../usageTracking";
import { 
    lookupCallerCustomer, 
    lookupCustomerBySpokenDetails, 
    verifyCallerIdentity, 
    getCallerAccountSummary, 
    dispatchPayByTextSms, 
    scrubPIISpeech 
} from "./voiceAccountManager";

if (admin.apps.length === 0) {
    try { admin.initializeApp(); } catch { /* ignore */ }
}
const db = admin.firestore();

// --- TWILIO INBOUND VOICE, SMS, AND SUBCONTRACTOR IVR ---
export const twilioInboundVoice = functions.https.onRequest(async (req, res) => {
    try {
        let resolvedOrgId = req.query.orgId as string;
        const fromPhone = req.body.From; // caller
        const toPhone = req.body.To;     // dialed number

        // 1. Resolve Organization ID based strictly on the dialed destination number (To)
        const platformNumber = process.env.TWILIO_PHONE_NUMBER || '+18339602099';
        const cleanTo = (toPhone || '').replace(/[^\d+]/g, '');
        const cleanPlatform = platformNumber.replace(/[^\d+]/g, '');

        if (cleanTo === '+18339602099' || cleanTo === '18339602099' || cleanTo === cleanPlatform) {
            // Dedicated Platform Line for TekTrakker
            resolvedOrgId = 'platform';
        } else if (!resolvedOrgId && toPhone) {
            const rawTo = toPhone.replace(/^\+1/, '');
            // Check organization dedicated phone number (twilioPhoneNumber or standard phone)
            const [orgsByTwilioPhone, orgsByPhone] = await Promise.all([
                db.collection('organizations').where('twilioPhoneNumber', 'in', [toPhone, rawTo]).limit(1).get(),
                db.collection('organizations').where('phone', 'in', [toPhone, rawTo]).limit(1).get()
            ]);
            if (!orgsByTwilioPhone.empty) {
                resolvedOrgId = orgsByTwilioPhone.docs[0].id;
            } else if (!orgsByPhone.empty) {
                resolvedOrgId = orgsByPhone.docs[0].id;
            }
        }

        if (!resolvedOrgId) {
            resolvedOrgId = 'platform';
        }

        const twilio = require('twilio');
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();
        const baseUrl = process.env.FUNCTIONS_BASE_URL || 'https://us-central1-tektrakker.cloudfunctions.net';

        // Fetch Organization Details & PBX Settings (Checking both platform & master)
        let orgDoc = await db.collection('organizations').doc(resolvedOrgId).get();
        if (!orgDoc.exists && resolvedOrgId === 'platform') {
            orgDoc = await db.collection('organizations').doc('master').get();
        }

        let settingsDoc = await db.collection('organizations').doc(resolvedOrgId).collection('settings').doc('telephony').get();
        if (!settingsDoc.exists && (resolvedOrgId === 'platform' || resolvedOrgId === 'master')) {
            const altId = resolvedOrgId === 'platform' ? 'master' : 'platform';
            settingsDoc = await db.collection('organizations').doc(altId).collection('settings').doc('telephony').get();
        }

        const isPlatformCall = resolvedOrgId === 'platform' || resolvedOrgId === 'master';
        const defaultOrgName = isPlatformCall ? "TekTrakker" : "TekAir Inc";
        const orgName = isPlatformCall ? "TekTrakker" : (orgDoc.exists ? (orgDoc.data()?.name || defaultOrgName) : defaultOrgName);
        let pbxSettings = settingsDoc.exists ? settingsDoc.data() : null;

        // Check if organization has unlocked the 24/7 AI Voice Receptionist ($5/mo add-on or platform hotline)
        const isAiVoiceUnlocked = isPlatformCall || 
            orgDoc.data()?.aiVoiceAssistantEnabled === true || 
            orgDoc.data()?.isFreeAccess === true || 
            orgDoc.data()?.unlockAllFeatures === true;

        const digitsPressed = req.body.Digits;
        const speechResult = req.body.SpeechResult;
        const callSid = req.body.CallSid || 'test-call-sid';

        const sessionRef = db.collection('voiceSessions').doc(callSid);
        const sessionDoc = await sessionRef.get();
        const sessionData = sessionDoc.exists ? sessionDoc.data() : {};
        let history: any[] = sessionData?.history || [];
        let matchedCustomerId: string | null = sessionData?.matchedCustomerId || null;
        let verificationStatus: 'unverified' | 'pending' | 'verified' | 'failed' = sessionData?.verificationStatus || 'unverified';
        let verificationAttempts: number = sessionData?.verificationAttempts || 0;
        let payLinkSent: boolean = sessionData?.payLinkSent || false;
        let verifiedSummary: any = sessionData?.verifiedSummary || null;
        let matchedCustomerData: any = null;

        // 1. IVR Auto-Attendant Handling
        if (pbxSettings?.ivr?.enabled && !speechResult) {
            if (digitsPressed) {
                const matchedOption = pbxSettings.ivr.options?.find((o: any) => o.digit === digitsPressed);
                if (matchedOption) {
                    if (matchedOption.action === 'external_number' && matchedOption.target) {
                        const dial = twiml.dial({ record: 'record-from-answer-dual' });
                        dial.number(matchedOption.target);
                        res.set('Content-Type', 'text/xml');
                        res.status(200).send(twiml.toString());
                        return;
                    } else if (matchedOption.action === 'voicemail') {
                        const vmText = (pbxSettings.leadRecovery?.customVoicemailGreeting || "Please leave your message after the tone.").replace(/\{\{company_name\}\}/g, orgName);
                        twiml.say({ voice: pbxSettings.aiAssistant?.voiceName || 'Polly.Joanna-Neural' }, vmText);
                        twiml.record({
                            action: `${baseUrl}/twilioCallRecordingCallback?orgId=${encodeURIComponent(resolvedOrgId)}&direction=inbound`,
                            maxLength: 180
                        });
                        res.set('Content-Type', 'text/xml');
                        res.status(200).send(twiml.toString());
                        return;
                    } else if (matchedOption.action === 'ring_group') {
                        twiml.redirect(`${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(resolvedOrgId)}&ringGroup=${encodeURIComponent(matchedOption.target || '')}&skipIvr=true`);
                        res.set('Content-Type', 'text/xml');
                        res.status(200).send(twiml.toString());
                        return;
                    } else if (matchedOption.action === 'ai_assistant') {
                        twiml.redirect(`${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(resolvedOrgId)}&aiMode=true&skipIvr=true`);
                        res.set('Content-Type', 'text/xml');
                        res.status(200).send(twiml.toString());
                        return;
                    }
                } else {
                    twiml.say({ voice: pbxSettings.aiAssistant?.voiceName || 'Polly.Joanna-Neural' }, "That option is not recognized. Connecting you now.");
                    twiml.redirect(`${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(resolvedOrgId)}&skipIvr=true`);
                    res.set('Content-Type', 'text/xml');
                    res.status(200).send(twiml.toString());
                    return;
                }
            } else if (!req.query.skipIvr) {
                const gather = twiml.gather({
                    numDigits: 1,
                    timeout: pbxSettings.ivr.timeoutSeconds || 8,
                    action: `${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(resolvedOrgId)}`
                });
                const ivrGreeting = (pbxSettings.ivr.greetingText || `Thank you for calling ${orgName}. Press 1 for Service, Press 2 for Billing.`).replace(/\{\{company_name\}\}/g, orgName);
                gather.say({ voice: pbxSettings.aiAssistant?.voiceName || 'Polly.Joanna-Neural' }, ivrGreeting);
                
                const fallbackAction = pbxSettings.ivr.fallbackAction || 'ai_assistant';
                if (fallbackAction === 'voicemail') {
                    twiml.redirect(`${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(resolvedOrgId)}&skipIvr=true&voicemail=true`);
                } else if (fallbackAction === 'ring_all') {
                    twiml.redirect(`${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(resolvedOrgId)}&skipIvr=true`);
                } else {
                    twiml.redirect(`${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(resolvedOrgId)}&skipIvr=true&aiMode=true`);
                }
                res.set('Content-Type', 'text/xml');
                res.status(200).send(twiml.toString());
                return;
            }
        }

        // Direct voicemail routing
        if (req.query.voicemail === 'true') {
            const vmText = (pbxSettings?.leadRecovery?.customVoicemailGreeting || `You have reached ${orgName}. Please leave a message after the beep.`).replace(/\{\{company_name\}\}/g, orgName);
            twiml.say({ voice: pbxSettings?.aiAssistant?.voiceName || 'Polly.Joanna-Neural' }, vmText);
            twiml.record({
                action: `${baseUrl}/twilioCallRecordingCallback?orgId=${encodeURIComponent(resolvedOrgId)}&direction=inbound`,
                maxLength: 180
            });
            res.set('Content-Type', 'text/xml');
            res.status(200).send(twiml.toString());
            return;
        }

        // 2. Determine if AI Voice Receptionist or Employee Routing should handle
        const now = new Date();
        const currentHour = now.getHours();
        const isAfterHours = currentHour < 8 || currentHour >= 18 || now.getDay() === 0 || now.getDay() === 6;
        const aiEnabled = pbxSettings?.aiAssistant?.enabled ?? true;
        const aiMode = pbxSettings?.aiAssistant?.mode || 'primary';
        const aiAfterHoursEnabled = pbxSettings?.aiAssistant?.aiAfterHoursEnabled !== false;
        const aiNoAnswerBackupEnabled = pbxSettings?.aiAssistant?.aiNoAnswerBackupEnabled !== false;

        const isDialFallback = req.query.dialFallback === 'true' || (req.body.DialCallStatus && req.body.DialCallStatus !== 'completed');
        const targetRingGroup = ((req.query.ringGroup as string) || '').trim();

        const shouldUseAI = isAiVoiceUnlocked && aiEnabled && (!targetRingGroup || isDialFallback || req.query.aiMode === 'true' || !!speechResult) && (
            (isPlatformCall && !req.query.dialFallback && !targetRingGroup) ||
            aiMode === 'primary' || 
            aiMode === 'always' ||
            (isAfterHours && (aiAfterHoursEnabled || aiMode === 'after_hours')) ||
            (isDialFallback && (aiNoAnswerBackupEnabled || aiMode === 'backup_after_ring')) ||
            req.query.aiMode === 'true' ||
            !!speechResult
        );

        if (shouldUseAI) {
            let voiceName = pbxSettings?.aiAssistant?.voiceName || 'Polly.Ruth-Neural';
            if (!voiceName.startsWith('Polly.') && voiceName !== 'alice') {
                voiceName = 'Polly.Ruth-Neural';
            }
            const emergencyTransferNumber = pbxSettings?.aiAssistant?.emergencyTransferNumber;
            const emergencyKeywords = pbxSettings?.aiAssistant?.emergencyKeywords || ['gas leak', 'no heat', 'freezer down', 'water leak', 'sparking', 'emergency'];

            // Check emergency keywords in speech for instant live transfer
            if (speechResult && emergencyTransferNumber) {
                const lowerSpeech = speechResult.toLowerCase();
                const isEmergency = emergencyKeywords.some((kw: string) => lowerSpeech.includes(kw.toLowerCase()));
                if (isEmergency) {
                    twiml.say({ voice: voiceName }, "That sounds urgent. I am transferring you directly to our on-call emergency technician right now.");
                    const dial = twiml.dial({ record: 'record-from-answer-dual' });
                    dial.number(emergencyTransferNumber);
                    res.set('Content-Type', 'text/xml');
                    res.status(200).send(twiml.toString());
                    return;
                }
            }

            // Multi-Tenant Customer Lookup & Identity Verification
            let wasJustMatchedBySpoken = false;
            if (resolvedOrgId !== 'platform' && resolvedOrgId !== 'master') {
                // If caller mentions looking up a specific phone number or account, prioritize spoken details
                const hasExplicitLookupIntent = speechResult && (
                    /\b(account|acct|different|other|look up|phone number|address|number is)\b/i.test(speechResult) ||
                    speechResult.replace(/\D/g, '').length >= 10
                );

                if (hasExplicitLookupIntent && verificationStatus !== 'verified') {
                    const spokenLookup = await lookupCustomerBySpokenDetails(resolvedOrgId, speechResult);
                    if (spokenLookup) {
                        matchedCustomerId = spokenLookup.customerId;
                        matchedCustomerData = spokenLookup.customerData;
                        wasJustMatchedBySpoken = true;
                    }
                }

                // 1. Initial attempt by incoming Caller ID phone number
                if (!matchedCustomerId && fromPhone) {
                    const lookup = await lookupCallerCustomer(resolvedOrgId, fromPhone);
                    if (lookup) {
                        matchedCustomerId = lookup.customerId;
                        matchedCustomerData = lookup.customerData;
                    }
                } else if (matchedCustomerId && !matchedCustomerData) {
                    try {
                        const cDoc = await db.collection('customers').doc(matchedCustomerId).get();
                        if (cDoc.exists && cDoc.data()?.organizationId === resolvedOrgId) {
                            const data = cDoc.data();
                            if (!cDoc.id.startsWith('cust_partner_') && !data?.linkedOrgId) {
                                matchedCustomerData = data;
                            } else {
                                matchedCustomerId = null;
                            }
                        }
                    } catch (e) {
                        functions.logger.warn(`Failed to fetch cached customer ${matchedCustomerId}:`, e);
                    }
                }

                // 2. Secondary attempt: If caller dialed from an unknown/unrecognized number, check if they spoke their phone/account/address
                if (!matchedCustomerData && speechResult) {
                    const spokenLookup = await lookupCustomerBySpokenDetails(resolvedOrgId, speechResult);
                    if (spokenLookup) {
                        matchedCustomerId = spokenLookup.customerId;
                        matchedCustomerData = spokenLookup.customerData;
                        wasJustMatchedBySpoken = true;
                    }
                }
            }

            const lowerSpeech = (speechResult || '').toLowerCase();
            const isAccountInquiry = /\b(bill|billing|invoice|balance|owe|due|pay|payment|account|appointment|schedule|status|tech|technician)\b/i.test(lowerSpeech);
            const isPayRequest = /\b(pay|text|link|sms|send link|online|card|credit card|debit|bank transfer|ach)\b/i.test(lowerSpeech);

            let verificationDirective = '';

            if (matchedCustomerData) {
                if (verificationStatus === 'verified') {
                    if (!verifiedSummary) {
                        verifiedSummary = await getCallerAccountSummary(resolvedOrgId, matchedCustomerId!);
                    }
                    if (isPayRequest && verifiedSummary?.hasOpenBalance && !payLinkSent) {
                        const openInvoiceId = verifiedSummary.unpaidInvoices[0]?.id;
                        const smsRes = await dispatchPayByTextSms(
                            resolvedOrgId, 
                            matchedCustomerId!, 
                            fromPhone, 
                            openInvoiceId, 
                            verifiedSummary.totalOpenBalance
                        );
                        if (smsRes.success) {
                            payLinkSent = true;
                            verificationDirective += `\nSPECIAL ACTION TAKEN: You just sent a secure pay-by-text link via SMS to the caller's mobile number for their open balance of $${verifiedSummary.totalOpenBalance.toFixed(2)}. Inform them that the link has been texted to them and they can tap it to pay securely online with a debit/credit card or bank transfer.`;
                        }
                    }
                } else if (verificationStatus === 'failed') {
                    verificationDirective = `\nSECURITY DIRECTIVE: The caller has failed identity verification. Under NO circumstances reveal balances, invoices, addresses, or personal account details. Politely inform them that for security reasons, you cannot access account details, and offer to transfer them to office staff.`;
                } else {
                    // 'unverified' or 'pending'
                    const verifyCheck = verifyCallerIdentity(matchedCustomerData, speechResult || '');
                    if (verifyCheck.verified) {
                        verificationStatus = 'verified';
                        verifiedSummary = await getCallerAccountSummary(resolvedOrgId, matchedCustomerId!);
                        verificationDirective = `\nVERIFICATION SUCCESSFUL: The caller has successfully verified their identity using their ${verifyCheck.matchedField}. Greet them warmly by their first name (${verifiedSummary.customerFirstName}) and answer their questions about their account, balance, invoices, or upcoming appointments.`;
                    } else if (wasJustMatchedBySpoken) {
                        verificationStatus = 'pending';
                        verificationDirective = `\nACCOUNT LOCATED: You have found their account on file. Now you MUST verify their identity before revealing any private information. Ask: "I found your account on file! For your security and privacy, could you please confirm your 5-digit billing zip code?" NEVER reveal their name, address, or balance yet.`;
                    } else if (verificationStatus === 'pending') {
                        verificationAttempts += 1;
                        if (verificationAttempts >= 3) {
                            verificationStatus = 'failed';
                            verificationDirective = `\nSECURITY DIRECTIVE: The caller has failed 3 verification attempts. Say: "For your privacy and security, I cannot verify that information over the phone. Let me connect you directly with our office team."`;
                        } else {
                            verificationDirective = `\nVERIFICATION FAILED (Attempt ${verificationAttempts} of 3): The information provided did not match our records. Ask them politely to re-check their 5-digit billing zip code. Do NOT reveal any account details.`;
                        }
                    } else if (isAccountInquiry) {
                        verificationStatus = 'pending';
                        verificationDirective = `\nVERIFICATION REQUIRED: The caller is asking about account or billing details. Ask: "For your security and privacy, could you please confirm your 5-digit billing zip code?" NEVER reveal their name, address, or balance.`;
                    }
                }
            } else if (isAccountInquiry || verificationStatus === 'pending') {
                // Caller ID did not match any customer on file and caller has not yet provided their account details
                verificationStatus = 'pending';
                verificationDirective = `\nUNRECOGNIZED CALLER: The caller is asking about account or billing details, but you do not have their profile pulled up yet because they are calling from an unrecognized phone number. Ask them: "I'd be glad to look that up for you! Could you please provide the primary phone number on your account or your service street address?" NEVER guess or reveal private account details.`;
            }

            // AI Response Generation with Gemini
            let apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
            if (!apiKey) {
                const secretsDoc = await db.collection('organizations').doc(resolvedOrgId).collection('secrets').doc('config').get();
                apiKey = secretsDoc.data()?.aiApiKeys?.gemini || secretsDoc.data()?.twilioConfig?.authToken;
            }

            const companyKnowledge = pbxSettings?.aiAssistant?.companyKnowledgeContext || "We provide residential and commercial service repairs and maintenance.";
            let systemPrompt = `You are Ava, the friendly and professional 24/7 AI voice receptionist for ${orgName}.
Company Knowledge: ${companyKnowledge}.
Guidelines:
1. Speak in concise, warm, natural sentences (1-2 sentences max).
2. Never use markdown, bullet points, asterisks, or links since your response is spoken aloud over the phone.
3. If the customer describes an issue, express empathy, ask for their service address, and offer to schedule a technician.
4. HARDCODED ZERO-PII RULE: Under no circumstances volunteer or speak full credit card numbers, bank account numbers, passwords, or full street addresses. Never read back account numbers or zip codes before the customer has verified them.
5. Ignore ambient background noise, faint television dialogue, or random noises. Focus strictly on direct requests from the caller.`;

            if (verificationStatus === 'verified' && verifiedSummary) {
                systemPrompt += `\n\nVerified Customer Account Summary:
- Customer First Name: ${verifiedSummary.customerFirstName}
- Open Balance: $${verifiedSummary.totalOpenBalance.toFixed(2)} (${verifiedSummary.hasOpenBalance ? 'Open Balance Due' : 'Paid in Full / No Balance'})
- Unpaid Invoices: ${verifiedSummary.unpaidInvoices.length > 0 ? verifiedSummary.unpaidInvoices.map((i: any) => `#${i.id}: $${i.amount.toFixed(2)} for ${i.description}`).join('; ') : 'None'}
- Last Payment: ${verifiedSummary.lastPayment ? `$${verifiedSummary.lastPayment.amount.toFixed(2)} on ${verifiedSummary.lastPayment.date}` : 'None recorded'}
- Upcoming Appointments: ${verifiedSummary.upcomingAppointments.length > 0 ? verifiedSummary.upcomingAppointments.map((a: any) => `${a.jobType} on ${a.scheduledDate} with ${a.technicianName}`).join('; ') : 'None scheduled'}
- Maintenance Membership: ${verifiedSummary.membershipPlan ? `${verifiedSummary.membershipPlan.name} (${verifiedSummary.membershipPlan.status})` : 'None'}`;
            }

            if (verificationDirective) {
                systemPrompt += `\n${verificationDirective}`;
            }

            let replyText = '';
            const confidence = req.body.Confidence ? parseFloat(req.body.Confidence) : 1.0;
            const isLikelyNoise = confidence < 0.45 && speechResult && speechResult.trim().split(/\s+/).length <= 2;

            if (speechResult && apiKey && !isLikelyNoise) {
                try {
                    const genAI = new GoogleGenerativeAI(apiKey);
                    // Use Gemini 3.8 Flash with zero thinking budget for instant sub-300ms turnaround & best intelligence
                    const model = genAI.getGenerativeModel({ 
                        model: "gemini-3.8-flash",
                        generationConfig: {
                            maxOutputTokens: 100,
                            temperature: 0.2,
                            // @ts-ignore
                            thinkingConfig: { thinkingBudget: 0 }
                        }
                    });
                    
                    const contents: any[] = [{ role: 'user', parts: [{ text: systemPrompt }] }];
                    history.slice(-4).forEach(h => {
                        contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] });
                    });
                    contents.push({ role: 'user', parts: [{ text: speechResult }] });

                    const result = await model.generateContent({ contents });
                    const voiceRes = await result.response;
                    replyText = voiceRes.text()?.trim() || "I understand. Let me get someone from our team to help you with that.";
                    
                    const voiceTokens = voiceRes.usageMetadata?.totalTokenCount || 0;
                    if (voiceTokens > 0) {
                        await trackAiUsage(resolvedOrgId, 'AI Voice Receptionist', 'gemini-3.8-flash', voiceTokens);
                    }
                } catch (e) {
                    functions.logger.error("Gemini Voice Gen Error (trying fallback):", e);
                    try {
                        const genAI = new GoogleGenerativeAI(apiKey);
                        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                        const resFallback = await fallbackModel.generateContent(`System: ${systemPrompt}\nCaller: ${speechResult}`);
                        replyText = (await resFallback.response).text()?.trim() || "I can help with that. Could you tell me a little more about the issue?";
                        const fbTokens = (await resFallback.response).usageMetadata?.totalTokenCount || 0;
                        if (fbTokens > 0) {
                            await trackAiUsage(resolvedOrgId, 'AI Voice Receptionist', 'gemini-2.5-flash', fbTokens);
                        }
                    } catch (fbErr) {
                        replyText = "I am sorry, our connection was slightly delayed. Could you please repeat what you need assistance with?";
                    }
                }
            } else if (isLikelyNoise) {
                // Background noise detected with low confidence — prompt politely without losing context
                replyText = "I'm having a little trouble hearing you over the background noise. Could you please repeat what you need help with?";
            } else {
                const customGreeting = pbxSettings?.aiAssistant?.greetingText || `Thanks for calling ${orgName}! My name is Ava, your AI service assistant. How can I help you today?`;
                replyText = customGreeting.replace(/\{\{company_name\}\}/g, orgName);
            }

            replyText = scrubPIISpeech(replyText);
            history.push({ role: 'model', content: replyText });
            
            // 1. Update Voice Session
            await sessionRef.set({ 
                history, 
                organizationId: resolvedOrgId, 
                fromPhone: fromPhone || '',
                toPhone: toPhone || '',
                handledByAi: true,
                matchedCustomerId: matchedCustomerId || null,
                verificationStatus,
                verificationAttempts,
                payLinkSent,
                verifiedSummary: verifiedSummary || null,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp() 
            }, { merge: true });

            // 2. Sync to Organization Call Logs & Leads in Real Time
            try {
                const userMessages = history.filter(h => h.role === 'user').map(h => h.content);
                const fullTranscript = history.map(h => `${h.role === 'user' ? 'Caller' : 'Ava'}: ${h.content}`).join('\n');
                const lastUserUtterance = userMessages.length > 0 ? userMessages[userMessages.length - 1] : '';
                const isMissedCall = userMessages.length === 0;

                const callLogData: any = {
                    callSid,
                    from: fromPhone || 'Unknown Caller',
                    to: toPhone || '',
                    direction: isMissedCall ? 'missed' : 'inbound',
                    status: isMissedCall ? 'no-answer' : 'completed',
                    callerName: (verificationStatus === 'verified' && verifiedSummary?.customerFirstName)
                        ? `${verifiedSummary.customerFirstName} (Verified Customer)`
                        : (fromPhone || (isMissedCall ? 'Missed Call' : 'Inbound Caller')),
                    customerId: matchedCustomerId || null,
                    verificationStatus,
                    aiSummary: isMissedCall 
                        ? 'Missed / Abandoned Call (Caller hung up before speaking)' 
                        : `AI Conversation: ${lastUserUtterance}`,
                    transcription: fullTranscript || 'Caller disconnected before speaking with Ava.',
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    handledBy: 'AI Voice Receptionist (Ava)',
                    organizationId: resolvedOrgId
                };

                const writePromises: Promise<any>[] = [
                    db.collection('organizations').doc(resolvedOrgId).collection('call_logs').doc(callSid).set(callLogData, { merge: true })
                ];

                // If caller provided contact/service details, create a Platform Lead or CRM Ticket
                if (userMessages.length >= 2) {
                    const isPlatform = resolvedOrgId === 'platform' || resolvedOrgId === 'master';
                    if (isPlatform) {
                        const leadDocRef = db.collection('platformLeads').doc(`voice_${callSid}`);
                        writePromises.push(leadDocRef.set({
                            id: `voice_${callSid}`,
                            phone: fromPhone || '',
                            source: '24/7 AI Voice Receptionist (Ava)',
                            status: 'New',
                            value: 1200,
                            notes: `Inbound Call via Hotline (${toPhone || '+18339602099'}).\n\nLatest Utterance:\n${lastUserUtterance}\n\nTranscript:\n${fullTranscript}`,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true }));

                        // Create notification for Master Admin
                        writePromises.push(db.collection('notifications').add({
                            title: '⚡ New AI Voice Lead Captured',
                            message: `Ava gathered platform demo/inquiry details from ${fromPhone || 'caller'}: "${lastUserUtterance}"`,
                            type: 'ai_lead',
                            read: false,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            link: '/master/sales-team'
                        }));
                    }
                }

                await Promise.all(writePromises);
            } catch (logErr) {
                functions.logger.warn('Failed to sync call_logs & leads for voice session:', logErr);
            }

            // Play the assistant's voice completely so TV/background noise does not interrupt the message
            twiml.say({ voice: voiceName }, replyText);

            // Listen for caller's reply with telephonic noise-filtering model
            twiml.gather({
                input: ['speech'],
                action: `${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(resolvedOrgId)}&aiMode=true`,
                timeout: 4,
                speechTimeout: 'auto',
                speechModel: 'phone_call',
                language: 'en-US'
            });

            // Fallback redirect if caller is silent
            twiml.redirect(`${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(resolvedOrgId)}&aiMode=true`);

            res.set('Content-Type', 'text/xml');
            res.status(200).send(twiml.toString());
            return;
        }

        // 3. Employee Ring Group Routing (Clock-In and Shift Aware)
        if (!isDialFallback) {
            let eligibleEmployees = pbxSettings?.routing?.employees?.filter((e: any) => e.enabled) || [];

            // Department Route (Ring Group) Multi-Route Matching
            if (targetRingGroup) {
                eligibleEmployees = eligibleEmployees.filter((e: any) => {
                    const groups: string[] = Array.isArray(e.ringGroups) 
                        ? e.ringGroups 
                        : (typeof e.ringGroups === 'string' && e.ringGroups ? [e.ringGroups] : []);
                    return groups.some((g: string) => g && g.trim().toLowerCase() === targetRingGroup.toLowerCase());
                });
            }

            // Shift Schedule & Day Active Filter
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const currentDayName = dayNames[now.getDay()];
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            eligibleEmployees = eligibleEmployees.filter((e: any) => {
                const daysActive: string[] = Array.isArray(e.daysActive) ? e.daysActive : (Array.isArray(e.days) ? e.days : []);
                if (daysActive.length > 0 && !daysActive.includes(currentDayName)) {
                    return false;
                }

                if (e.startHour && e.endHour) {
                    const [startH, startM] = e.startHour.split(':').map((v: string) => parseInt(v, 10) || 0);
                    const [endH, endM] = e.endHour.split(':').map((v: string) => parseInt(v, 10) || 0);
                    const startMin = startH * 60 + startM;
                    const endMin = endH * 60 + endM;

                    if (startMin <= endMin) {
                        if (currentMinutes < startMin || currentMinutes > endMin) return false;
                    } else {
                        // Overnight shift spanning midnight
                        if (currentMinutes < startMin && currentMinutes > endMin) return false;
                    }
                }
                return true;
            });

            // Clock-In Availability Filter
            if (pbxSettings?.routing?.enforceClockIn && eligibleEmployees.length > 0) {
                try {
                    const activeTimecards = await db.collection('organizations').doc(resolvedOrgId).collection('timecards')
                        .where('status', '==', 'active')
                        .limit(50)
                        .get();
                    const clockedInUserIds = new Set(activeTimecards.docs.map(d => d.data()?.userId));
                    const clockedInEmployees = eligibleEmployees.filter((e: any) => clockedInUserIds.has(e.userId));
                    if (clockedInEmployees.length > 0) {
                        eligibleEmployees = clockedInEmployees;
                    }
                } catch (tcErr) {
                    functions.logger.warn('Timecard clock-in check error (skipping filter):', tcErr);
                }
            }

            // Ring Eligible Staff WebRTC Clients
            if (eligibleEmployees.length > 0) {
                const ringDuration = pbxSettings?.routing?.ringDurationSeconds || 20;
                const dial = twiml.dial({
                    record: 'record-from-answer-dual',
                    timeout: ringDuration,
                    action: `${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(resolvedOrgId)}&dialFallback=true`,
                    recordingStatusCallback: `${baseUrl}/twilioCallRecordingCallback?orgId=${encodeURIComponent(resolvedOrgId)}&direction=inbound`
                });

                eligibleEmployees.forEach((emp: any) => {
                    dial.client(`user_${emp.userId}`);
                });

                res.set('Content-Type', 'text/xml');
                res.status(200).send(twiml.toString());
                return;
            }
        }

        // 4. Fallback: Failover Phone Number
        if (pbxSettings?.leadRecovery?.failoverNumber) {
            const failoverDial = twiml.dial({
                record: 'record-from-answer-dual',
                timeout: 20,
                recordingStatusCallback: `${baseUrl}/twilioCallRecordingCallback?orgId=${encodeURIComponent(resolvedOrgId)}&direction=inbound`
            });
            failoverDial.number(pbxSettings.leadRecovery.failoverNumber);
        }

        // Voicemail Prompt
        const vmGreeting = (pbxSettings?.leadRecovery?.customVoicemailGreeting || `You have reached ${orgName}. Please leave a message after the beep.`).replace(/\{\{company_name\}\}/g, orgName);
        twiml.say({ voice: pbxSettings?.aiAssistant?.voiceName || 'Polly.Joanna-Neural' }, vmGreeting);
        twiml.record({
            action: `${baseUrl}/twilioCallRecordingCallback?orgId=${encodeURIComponent(resolvedOrgId)}&direction=inbound`,
            maxLength: 180
        });

        // Trigger Missed Call Instant Auto-SMS
        if (fromPhone && pbxSettings?.leadRecovery?.missedCallAutoSmsEnabled) {
            try {
                const secretsDoc = await db.collection('organizations').doc(resolvedOrgId).collection('secrets').doc('config').get();
                const twilioConfig = secretsDoc.data()?.twilioConfig;
                if (twilioConfig?.accountSid && twilioConfig?.authToken && twilioConfig?.phoneNumber) {
                    const twilioClient = require('twilio')(twilioConfig.accountSid, twilioConfig.authToken);
                    const smsTemplate = (pbxSettings.leadRecovery.missedCallSmsTemplate || `Hi! Sorry we missed your call at ${orgName}. How can our team help you today?`).replace(/\{\{company_name\}\}/g, orgName);
                    
                    await twilioClient.messages.create({
                        from: twilioConfig.phoneNumber,
                        to: fromPhone,
                        body: smsTemplate
                    });
                    await trackTelephonyUsage(resolvedOrgId, 'sms_sent', 1, { type: 'missed_call_auto_sms', to: fromPhone });
                }
            } catch (smsErr) {
                functions.logger.warn('Missed call auto-SMS error:', smsErr);
            }
        }

        res.set('Content-Type', 'text/xml');
        res.status(200).send(twiml.toString());
    } catch (error) {
        functions.logger.error("Twilio Voice Webhook Error:", error);
        res.status(500).send("Server Error");
    }
});

export const twilioInboundSms = functions.https.onRequest(async (req, res) => {
    try {
        const fromPhone = req.body.From; // e.g., '+1234567890'
        const rawBody = (req.body.Body || '').trim();
        const smsBody = rawBody.toUpperCase();
        let smsResponse = '';

        if (fromPhone) {
            const rawNumber = fromPhone.replace(/^\+1/, '');

            // Try searching with both format types to associate this message with a customer/org
            const [exactSnap, fallbackSnap] = await Promise.all([
                db.collection('customers').where('phone', '==', fromPhone).limit(5).get(),
                db.collection('customers').where('phone', '==', rawNumber).limit(5).get()
            ]);

            const documents = [...exactSnap.docs, ...fallbackSnap.docs];
            let matchedOrgId: string | null = null;
            let matchedCustomerId: string | null = null;
            let customerName = fromPhone;

            if (documents.length > 0) {
                const custData = documents[0].data() || {};
                matchedOrgId = custData.organizationId || null;
                matchedCustomerId = documents[0].id;
                customerName = custData.name || `${custData.firstName || ''} ${custData.lastName || ''}`.trim() || fromPhone;

                if (matchedOrgId) {
                    // Check if the organization has configured their own Twilio or RingCentral details
                    const secretDoc = await db.collection('organizations').doc(matchedOrgId).collection('secrets').doc('config').get();
                    const secrets = secretDoc.data() || {};
                    const hasOwnTwilio = !!secrets.twilioConfig?.accountSid;
                    const hasOwnRc = secrets.rcPrimarySms === true || secrets.rcPrimarySms === 'true';

                    if (!hasOwnTwilio && !hasOwnRc) {
                        await trackSmsUsage(matchedOrgId, 'inbound');
                    }
                }
            }

            // Save incoming SMS message to Firestore messages collection so it appears in App Inbox/Customer Threads
            if (matchedOrgId) {
                const msgId = `msg_inbound_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const msgDoc = {
                    id: msgId,
                    organizationId: matchedOrgId,
                    senderId: matchedCustomerId || fromPhone,
                    senderName: customerName,
                    receiverId: matchedOrgId,
                    receiverName: 'Organization',
                    content: rawBody,
                    timestamp: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    read: false,
                    type: 'sms',
                    deliveryStatus: 'sent',
                    senderPhone: fromPhone,
                    receiverPhone: req.body.To || ''
                };
                await db.collection('messages').doc(msgId).set(msgDoc).catch(err => functions.logger.error("Failed to save inbound SMS message:", err));

                const notifId = `notif_sms_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                await db.collection('organizations').doc(matchedOrgId).collection('notifications').doc(notifId).set({
                    id: notifId,
                    title: `New SMS from ${customerName}`,
                    message: rawBody,
                    type: 'sms',
                    createdAt: new Date().toISOString(),
                    read: false,
                    senderPhone: fromPhone
                }).catch(err => functions.logger.error("Failed to write SMS notification:", err));
            }

            const isOptOut = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'].includes(smsBody);
            const isOptIn = ['START', 'YES'].includes(smsBody);
            const isHelp = ['HELP', 'INFO'].includes(smsBody);
            const isStatus = ['STATUS', 'TECH', 'TECHNICIAN', 'JOB'].includes(smsBody);

            if (isOptOut || isOptIn) {
                functions.logger.info(`Received ${smsBody} request from ${fromPhone}`);

                if (documents.length > 0) {
                    const batch = db.batch();
                    documents.forEach(doc => {
                        batch.update(doc.ref, {
                            'marketingConsent.sms': isOptIn,
                            'marketingConsent.agreedAt': isOptIn ? new Date().toISOString() : (doc.data()?.marketingConsent?.agreedAt || null),
                            'marketingConsent.unsubscribedAt': isOptOut ? new Date().toISOString() : null,
                            'marketingConsent.source': isOptIn ? 'Twilio SMS Opt-In (START)' : 'Twilio SMS Opt-Out (STOP)',
                            'marketingConsent.optOutReason': isOptOut ? 'Received STOP reply via SMS' : null
                        });
                    });
                    await batch.commit();
                    functions.logger.info(`Updated marketingConsent for ${documents.length} customer(s) to sms=${isOptIn}`);
                } else {
                    functions.logger.warn(`No customer found with phone number ${fromPhone} or ${rawNumber}`);
                }

                if (isOptOut) {
                    smsResponse = 'You have successfully unsubscribed from TekTrakker notifications. Reply START to opt-in again.';
                } else {
                    smsResponse = 'You have successfully subscribed to TekTrakker notifications. Msg & data rates may apply. Reply HELP for help, STOP to cancel.';
                }
            } else if (isHelp) {
                smsResponse = 'TekTrakker Help: Reply STATUS to check job/technician status, STOP to opt-out of text alerts, or START to opt-in again. For support, contact your provider.';
            } else if (isStatus) {
                const customerDocs = documents;
                const customerIds = Array.from(new Set(customerDocs.map(d => d.id)));

                // Fetch jobs
                const jobs: any[] = [];
                if (customerIds.length > 0) {
                    const jobsByCustSnap = await db.collection('jobs')
                        .where('customerId', 'in', customerIds)
                        .get();
                    jobs.push(...jobsByCustSnap.docs.map(d => d.data()));
                }

                // Also query jobs by phone directly (for guest checkouts / unassigned customers)
                const [jobsByPhoneSnap, jobsByPhoneRawSnap] = await Promise.all([
                    db.collection('jobs').where('customerPhone', '==', fromPhone).limit(20).get(),
                    db.collection('jobs').where('customerPhone', '==', rawNumber).limit(20).get()
                ]);
                jobs.push(...jobsByPhoneSnap.docs.map(d => d.data()));
                jobs.push(...jobsByPhoneRawSnap.docs.map(d => d.data()));

                // Deduplicate jobs by ID
                const uniqueJobsMap = new Map<string, any>();
                jobs.forEach(j => {
                    if (j && j.id) {
                        uniqueJobsMap.set(j.id, j);
                    }
                });
                const uniqueJobs = Array.from(uniqueJobsMap.values());

                // Find active job (first In Progress, then Scheduled)
                let activeJob = uniqueJobs.find(j => j.jobStatus === 'In Progress');
                if (!activeJob) {
                    activeJob = uniqueJobs.find(j => j.jobStatus === 'Scheduled');
                }

                if (activeJob) {
                    const techName = activeJob.assignedTechnicianName || 'Unassigned';
                    const statusStr = activeJob.jobStatus;
                    const apptTime = activeJob.appointmentTime ? new Date(activeJob.appointmentTime).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    }) : 'Not scheduled';

                    if (statusStr === 'In Progress') {
                        smsResponse = `TekTrakker Status: Your service is IN PROGRESS. Tech ${techName} is on site.`;
                    } else {
                        smsResponse = `TekTrakker Status: Scheduled for ${apptTime}. Tech: ${techName}.`;
                    }
                } else {
                    const completedJobs = uniqueJobs.filter(j => j.jobStatus === 'Completed' || j.jobStatus === 'Cancelled');
                    if (completedJobs.length > 0) {
                        completedJobs.sort((a, b) => {
                            const dateA = new Date(a.endTime || a.updatedAt || a.createdAt || 0).getTime();
                            const dateB = new Date(b.endTime || b.updatedAt || b.createdAt || 0).getTime();
                            return dateB - dateA;
                        });
                        const lastJob = completedJobs[0];
                        const lastStatus = lastJob.jobStatus;
                        const completedTime = lastJob.endTime ? new Date(lastJob.endTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                        }) : 'recently';
                        smsResponse = `TekTrakker Status: No active jobs. Last service was ${lastStatus.toUpperCase()} on ${completedTime}.`;
                    } else {
                        smsResponse = `TekTrakker Status: No active or past service requests found for this number.`;
                    }
                }
            } else {
                smsResponse = `TekTrakker: Command not recognized. Reply HELP for a list of available commands.`;
            }
        }

        res.set('Content-Type', 'text/xml');
        const responseXml = fromPhone && smsResponse 
            ? `<Response><Message><![CDATA[${smsResponse}]]></Message></Response>` 
            : '<Response></Response>';
        res.status(200).send(responseXml);
    } catch (error) {
        functions.logger.error("Twilio Inbound SMS Webhook Error:", error);
        res.status(500).send("Server Error");
    }
});


// --- TWILIO SUBCONTRACTOR IVR WEBHOOK (HYBRID CLOCK-IN / CHECK-OUT FLOW) ---
export const twilioSubcontractorIVR = functions.https.onRequest(async (req, res) => {
    try {
        const step = req.query.step as string || 'default';
        const userId = req.query.userId as string || '';
        const orgId = req.query.orgId as string || '';
        const userName = req.query.userName as string || '';
        const jobId = req.query.jobId as string || '';
        const customerName = req.query.customerName as string || '';
        const shiftId = req.query.shiftId as string || '';

        const twilio = require('twilio');
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();

        if (step === 'default') {
            const fromPhone = req.body.From;
            let resolvedUserId = '';
            let resolvedOrgId = '';
            let resolvedUserName = '';

            if (fromPhone) {
                const rawNumber = fromPhone.replace(/^\+1/, '');
                const [exactSnap, fallbackSnap] = await Promise.all([
                    db.collection('users').where('phone', '==', fromPhone).limit(5).get(),
                    db.collection('users').where('phone', '==', rawNumber).limit(5).get()
                ]);
                const users = [...exactSnap.docs, ...fallbackSnap.docs];
                if (users.length > 0) {
                    const userDoc = users[0];
                    const userData = userDoc.data();
                    resolvedUserId = userDoc.id;
                    resolvedOrgId = userData.organizationId || '';
                    resolvedUserName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                }
            }

            if (resolvedUserId && resolvedOrgId) {
                // Find assigned jobs for recognized user today/recent
                const jobsSnap = await db.collection('jobs')
                    .where('organizationId', '==', resolvedOrgId)
                    .where('assignedTechnicianId', '==', resolvedUserId)
                    .get();

                // Filter active jobs in memory
                const activeJobs = jobsSnap.docs.filter(doc => {
                    const status = doc.data().jobStatus;
                    return status === 'Scheduled' || status === 'In Progress';
                });

                if (activeJobs.length === 0) {
                    const gather = twiml.gather({
                        numDigits: 6,
                        action: `/twilioSubcontractorIVR?step=verifyJob&userId=${resolvedUserId}&orgId=${resolvedOrgId}&userName=${encodeURIComponent(resolvedUserName)}`,
                        timeout: 10
                    });
                    gather.say({ voice: 'Polly.Matthew-Neural' }, `Hello ${resolvedUserName}. We could not find any active or scheduled jobs assigned to you today. Please enter the six-digit Job Number followed by the pound sign.`);
                    twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
                } else if (activeJobs.length === 1) {
                    const targetJobDoc = activeJobs[0];
                    const targetJobId = targetJobDoc.id;
                    const targetJobData = targetJobDoc.data();
                    const targetCustomerName = targetJobData.customerName || 'the customer';

                    // Check if already clocked in to this job
                    const activeShiftSnap = await db.collection('shifts')
                        .where('userId', '==', resolvedUserId)
                        .where('jobId', '==', targetJobId)
                        .where('clockOut', '==', null)
                        .get();

                    if (activeShiftSnap.empty) {
                        const gather = twiml.gather({
                            numDigits: 1,
                            action: `/twilioSubcontractorIVR?step=selectRecognizedJobOption&userId=${resolvedUserId}&orgId=${resolvedOrgId}&userName=${encodeURIComponent(resolvedUserName)}&jobId=${targetJobId}&customerName=${encodeURIComponent(targetCustomerName)}`,
                            timeout: 10
                        });
                        gather.say({ voice: 'Polly.Matthew-Neural' }, `Hello ${resolvedUserName}. We found one job for ${targetCustomerName}. Press 1 to clock in to this job. Press 2 to clock in to a different job number.`);
                    } else {
                        const gather = twiml.gather({
                            numDigits: 1,
                            action: `/twilioSubcontractorIVR?step=selectActiveShiftOption&userId=${resolvedUserId}&orgId=${resolvedOrgId}&userName=${encodeURIComponent(resolvedUserName)}&jobId=${targetJobId}&customerName=${encodeURIComponent(targetCustomerName)}&shiftId=${activeShiftSnap.docs[0].id}`,
                            timeout: 10
                        });
                        gather.say({ voice: 'Polly.Matthew-Neural' }, `Hello ${resolvedUserName}. You are currently clocked in to the job for ${targetCustomerName}. Press 1 to clock out. Press 2 to log in to a different job number.`);
                    }
                    twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
                } else {
                    const gather = twiml.gather({
                        numDigits: 6,
                        action: `/twilioSubcontractorIVR?step=verifyJob&userId=${resolvedUserId}&orgId=${resolvedOrgId}&userName=${encodeURIComponent(resolvedUserName)}`,
                        timeout: 10
                    });
                    gather.say({ voice: 'Polly.Matthew-Neural' }, `Hello ${resolvedUserName}. You have multiple jobs today. Please enter the six-digit Job Number you want to clock in or out of, followed by the pound sign.`);
                    twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
                }
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: '/twilioSubcontractorIVR?step=verifyPin',
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Welcome to the Tek Trakker IVR system. Please enter your six digit P I N followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        } 
        
        else if (step === 'verifyPin') {
            const pinInput = (req.body.Digits || '').trim();
            let userDoc = null;

            if (pinInput) {
                const usersSnap = await db.collection('users').where('pin', '==', pinInput).limit(5).get();
                if (!usersSnap.empty) {
                    userDoc = usersSnap.docs[0];
                } else {
                    const fallbackPinSnap = await db.collection('users').where('kioskPin', '==', pinInput).limit(5).get();
                    if (!fallbackPinSnap.empty) {
                        userDoc = fallbackPinSnap.docs[0];
                    }
                }
            }

            if (userDoc) {
                const userData = userDoc.data();
                const resolvedUserId = userDoc.id;
                const resolvedOrgId = userData.organizationId || '';
                const resolvedUserName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

                const gather = twiml.gather({
                    numDigits: 6,
                    action: `/twilioSubcontractorIVR?step=verifyJob&userId=${resolvedUserId}&orgId=${resolvedOrgId}&userName=${encodeURIComponent(resolvedUserName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, `Thank you ${resolvedUserName}. Please enter the six digit Job Number followed by the pound sign.`);
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: '/twilioSubcontractorIVR?step=verifyPin',
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Invalid P I N. Please enter your six digit P I N followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        }

        else if (step === 'verifyJob') {
            const jobNumberInput = (req.body.Digits || '').trim();
            const jobsSnap = await db.collection('jobs')
                .where('organizationId', '==', orgId)
                .where('jobNumber', '==', jobNumberInput)
                .get();

            if (!jobsSnap.empty) {
                const targetJobDoc = jobsSnap.docs[0];
                const targetJobId = targetJobDoc.id;
                const targetCustomerName = targetJobDoc.data().customerName || 'the customer';

                const gather = twiml.gather({
                    numDigits: 1,
                    action: `/twilioSubcontractorIVR?step=confirmJob&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}&jobId=${targetJobId}&customerName=${encodeURIComponent(targetCustomerName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, `You entered job for ${targetCustomerName}. Press 1 to confirm. Press 2 to re-enter the job number.`);
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: `/twilioSubcontractorIVR?step=verifyJob&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Job number not found. Please enter the six digit Job Number followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        }

        else if (step === 'selectRecognizedJobOption') {
            const choice = (req.body.Digits || '').trim();
            if (choice === '1') {
                const gather = twiml.gather({
                    numDigits: 1,
                    action: `/twilioSubcontractorIVR?step=doClockIn&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}&jobId=${jobId}&customerName=${encodeURIComponent(customerName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "To check in, please enter the number of technicians on site, followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: `/twilioSubcontractorIVR?step=verifyJob&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Please enter the six digit Job Number followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        }

        else if (step === 'selectActiveShiftOption') {
            const choice = (req.body.Digits || '').trim();
            if (choice === '1') {
                const gather = twiml.gather({
                    numDigits: 1,
                    action: `/twilioSubcontractorIVR?step=doClockOut&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}&jobId=${jobId}&customerName=${encodeURIComponent(customerName)}&shiftId=${shiftId}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "To check out, press 1 if the job is complete, press 2 if a return trip is required.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: `/twilioSubcontractorIVR?step=verifyJob&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Please enter the six digit Job Number followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        }

        else if (step === 'confirmJob') {
            const choice = (req.body.Digits || '').trim();
            if (choice === '1') {
                const activeShiftSnap = await db.collection('shifts')
                    .where('userId', '==', userId)
                    .where('jobId', '==', jobId)
                    .where('clockOut', '==', null)
                    .get();

                if (activeShiftSnap.empty) {
                    const gather = twiml.gather({
                        numDigits: 1,
                        action: `/twilioSubcontractorIVR?step=doClockIn&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}&jobId=${jobId}&customerName=${encodeURIComponent(customerName)}`,
                        timeout: 10
                    });
                    gather.say({ voice: 'Polly.Matthew-Neural' }, "To check in, please enter the number of technicians on site, followed by the pound sign.");
                    twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
                } else {
                    const gather = twiml.gather({
                        numDigits: 1,
                        action: `/twilioSubcontractorIVR?step=doClockOut&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}&jobId=${jobId}&customerName=${encodeURIComponent(customerName)}&shiftId=${activeShiftSnap.docs[0].id}`,
                        timeout: 10
                    });
                    gather.say({ voice: 'Polly.Matthew-Neural' }, "You are currently checked in. To check out, press 1 if the job is complete, press 2 if a return trip is required.");
                    twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
                }
            } else {
                const gather = twiml.gather({
                    numDigits: 6,
                    action: `/twilioSubcontractorIVR?step=verifyJob&userId=${userId}&orgId=${orgId}&userName=${encodeURIComponent(userName)}`,
                    timeout: 10
                });
                gather.say({ voice: 'Polly.Matthew-Neural' }, "Please enter the six digit Job Number followed by the pound sign.");
                twiml.say({ voice: 'Polly.Matthew-Neural' }, "We did not receive any input. Goodbye.");
            }
        }

        else if (step === 'doClockIn') {
            const techCount = parseInt((req.body.Digits || '').replace(/\D/g, '')) || 1;
            const now = new Date().toISOString();
            const newShiftId = 'shift-' + Date.now();

            // a. Create shift log in shifts collection (job timer)
            await db.collection('shifts').doc(newShiftId).set({
                id: newShiftId,
                organizationId: orgId,
                userId: userId,
                userName: userName,
                jobId: jobId,
                clockIn: now,
                clockOut: null,
                techniciansOnsite: techCount,
                isApproved: false,
                source: 'IVR'
            });

            // b. Create general daily shift log in shiftLogs collection
            await db.collection('shiftLogs').doc(newShiftId).set({
                id: newShiftId,
                organizationId: orgId,
                userId: userId,
                userName: userName,
                clockIn: now,
                clockOut: null,
                action: 'clock_in',
                status: 'Clocked In',
                isApproved: false,
                source: 'IVR'
            });

            // c. Update Job record check-in times and status
            const jobRef = db.collection('jobs').doc(jobId);
            const jobDoc = await jobRef.get();
            if (jobDoc.exists) {
                const jobData = jobDoc.data() || {};
                const timeEntries = jobData.timeEntries || [];
                timeEntries.push({
                    checkInTime: now,
                    checkOutTime: null,
                    timeOnSiteMinutes: null,
                    techniciansOnsite: techCount,
                    source: 'IVR'
                });
                await jobRef.update({
                    checkInTime: now,
                    checkOutTime: null,
                    timeEntries: timeEntries,
                    jobStatus: 'In Progress',
                    updatedAt: now
                });
            }

            twiml.say({ voice: 'Polly.Matthew-Neural' }, `Thank you. You have been checked in with ${techCount} technicians. Have a great shift. Goodbye.`);
            twiml.hangup();
        }

        else if (step === 'doClockOut') {
            const choice = (req.body.Digits || '').trim();
            const now = new Date().toISOString();

            // a. Update shifts collection
            await db.collection('shifts').doc(shiftId).update({
                clockOut: now
            });

            // b. Update shiftLogs collection
            await db.collection('shiftLogs').doc(shiftId).update({
                clockOut: now,
                action: 'clock_out',
                status: 'Clocked Out'
            });

            // c. Update Job record check-out times and status
            const jobRef = db.collection('jobs').doc(jobId);
            const jobDoc = await jobRef.get();
            let message = 'You have been clocked out.';

            if (jobDoc.exists) {
                const jobData = jobDoc.data() || {};
                const checkIn = jobData.checkInTime || now;
                const durationMs = new Date(now).getTime() - new Date(checkIn).getTime();
                const currentMins = Math.max(0, Math.round(durationMs / 60000));

                const timeEntries = [...(jobData.timeEntries || [])];
                if (timeEntries.length > 0) {
                    const lastIdx = timeEntries.length - 1;
                    timeEntries[lastIdx] = {
                        ...timeEntries[lastIdx],
                        checkOutTime: now,
                        timeOnSiteMinutes: currentMins
                    };
                } else {
                    timeEntries.push({
                        checkInTime: checkIn,
                        checkOutTime: now,
                        timeOnSiteMinutes: currentMins,
                        source: 'IVR'
                    });
                }

                const totalMins = timeEntries.reduce((acc: number, entry: any) => acc + (entry.timeOnSiteMinutes || 0), 0);

                const updates: any = {
                    checkOutTime: now,
                    timeOnSiteMinutes: totalMins,
                    timeEntries: timeEntries,
                    updatedAt: now
                };

                if (choice === '1') {
                    updates.jobStatus = 'Completed';
                    message += ' The job has been marked as complete. Thank you. Goodbye.';
                } else {
                    updates.jobStatus = 'Needs Follow-up';
                    message += ' The job has been marked as requiring a return trip. Thank you. Goodbye.';
                }

                await jobRef.update(updates);
            }

            twiml.say({ voice: 'Polly.Matthew-Neural' }, message);
            twiml.hangup();
        }

        res.set('Content-Type', 'text/xml');
        res.status(200).send(twiml.toString());
    } catch (error) {
        functions.logger.error("Twilio Subcontractor IVR Webhook Error:", error);
        res.status(500).send("Server Error");
    }
});


// --- AUTOMATED MAINTENANCE SWEEP & REMINDERS (CRON JOB) ---

// --- CALL BRIDGING API (TECH TO CUSTOMER) ---
export const initiateCallBridge = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { technicianPhone, customerPhone, organizationId } = data;
    if (!technicianPhone || !customerPhone || !organizationId) {
        throw new functions.https.HttpsError('invalid-argument', 'technicianPhone, customerPhone, and organizationId are required.');
    }

    // Multi-tenant authorization: verify caller belongs to target org or is master admin
    const callerOrgId = context.auth.token.organizationId;
    const callerRole = context.auth.token.role;
    const isMaster = callerRole === 'master_admin';
    if (!isMaster && callerOrgId !== organizationId) {
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data() || {};
        if (userData.role !== 'master_admin' && userData.organizationId !== organizationId) {
            throw new functions.https.HttpsError('permission-denied', 'Unauthorized to initiate call bridge for this organization.');
        }
    }

    try {
        const secretsRef = db.collection('organizations').doc(organizationId).collection('secrets').doc('config');
        const secretsDoc = await secretsRef.get();
        const secrets = secretsDoc.exists ? secretsDoc.data() || {} : {};

        const twilioSid = secrets.twilioConfig?.accountSid || process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = secrets.twilioConfig?.authToken || process.env.TWILIO_AUTH_TOKEN;
        const twilioNumber = secrets.twilioConfig?.phoneNumber || process.env.TWILIO_PHONE_NUMBER;

        if (!twilioSid || !twilioToken || !twilioNumber) {
            throw new functions.https.HttpsError('failed-precondition', 'Twilio integration is not configured.');
        }

        const twilio = require('twilio');
        const client = twilio(twilioSid, twilioToken);

        const baseUrl = process.env.FUNCTIONS_BASE_URL || 'https://us-central1-tektrakker.cloudfunctions.net';
        const callbackUrl = `${baseUrl}/connectCallBridge?customerPhone=${encodeURIComponent(customerPhone)}&twilioNumber=${encodeURIComponent(twilioNumber)}&orgId=${encodeURIComponent(organizationId)}`;

        const call = await client.calls.create({
            to: technicianPhone,
            from: twilioNumber,
            url: callbackUrl
        });

        functions.logger.info(`Call bridge initiated. Call Sid: ${call.sid}`);
        return { success: true, callSid: call.sid };
    } catch (e: any) {
        functions.logger.error("Error initiating call bridge:", e);
        throw new functions.https.HttpsError('internal', `Failed to initiate call bridge: ${e.message}`);
    }
});

export const connectCallBridge = functions.https.onRequest(async (req, res) => {
    try {
        const customerPhone = req.query.customerPhone as string;
        const twilioNumber = req.query.twilioNumber as string;
        const orgId = req.query.orgId as string;

        if (!customerPhone || !twilioNumber || !orgId) {
            res.status(400).send("Missing customerPhone, twilioNumber, or orgId parameters.");
            return;
        }

        const twilio = require('twilio');
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();

        twiml.say({ voice: 'Polly.Matthew-Neural' }, "Connecting you to your customer. Please hold.");
        twiml.dial({ callerId: twilioNumber }, customerPhone);

        const secretsRef = db.collection('organizations').doc(orgId).collection('secrets').doc('config');
        const secretsDoc = await secretsRef.get();
        const secrets = secretsDoc.exists ? secretsDoc.data() || {} : {};
        const isPlatformTwilio = !secrets.twilioConfig?.accountSid && !!process.env.TWILIO_ACCOUNT_SID;

        if (isPlatformTwilio) {
            const now = new Date();
            const billingCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const usageRef = db.collection('smsUsage').doc(`${orgId}_${billingCycle}`);
            await usageRef.set({
                organizationId: orgId,
                billingCycle: billingCycle,
                totalVoiceMinutes: admin.firestore.FieldValue.increment(2), // 2 legs on bridged calls
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        res.set('Content-Type', 'text/xml');
        res.status(200).send(twiml.toString());
    } catch (error) {
        functions.logger.error("Error in connectCallBridge webhook:", error);
        res.status(500).send("Server Error");
    }
});

// --- AUTOMATED MONTHLY STATEMENTS FOR COMMERCIAL CUSTOMERS ---

// --- TWILIO WEBRTC VOICE & CALL CENTER SERVICES ---
export const getTwilioVoiceToken = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        const orgId = (req.query.orgId || req.body?.orgId) as string;
        const userId = (req.query.userId || req.body?.userId) as string;

        if (!orgId || !userId) {
            res.status(400).json({ error: 'orgId and userId are required.' });
            return;
        }

        // Check user role & authorized emails
        const userDoc = await db.collection('users').doc(userId).get();
        const userEmail = (userDoc.exists ? (userDoc.data()?.email || '') : (req.query.userName || '')).toString().toLowerCase();
        const isMasterAdmin = (
            (userDoc.exists && userDoc.data()?.role === 'master_admin') || 
            userEmail === 'rodzelem@gmail.com' || 
            userEmail === 'ryanvavrecan@gmail.com' ||
            userEmail === 'rvavrecan@tekairinc.com' ||
            userEmail.endsWith('@tekairinc.com')
        );

        // Fetch organization settings & secrets
        const orgDoc = await db.collection('organizations').doc(orgId).get();
        const orgData = orgDoc.exists ? orgDoc.data() || {} : {};

        const secretsRef = db.collection('organizations').doc(orgId).collection('secrets').doc('config');
        const secretsDoc = await secretsRef.get();
        const secrets = secretsDoc.exists ? secretsDoc.data() || {} : {};

        // Master admins always have platform access; client orgs require subscription
        const isSubscribed = isMasterAdmin || orgData.phoneSystemEnabled || orgData.telephonyActive || secrets.twilioConfig?.subaccountSid || secrets.twilioConfig?.accountSid;
        
        if (!isSubscribed) {
            res.status(403).json({ 
                error: 'Organization has not subscribed to a dedicated telephony sub-account yet. Please activate the phone system in Communications.' 
            });
            return;
        }

        const twilio = require('twilio');
        const MASTER_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
        const MASTER_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';

        let targetAccountSid = secrets.twilioConfig?.subaccountSid || secrets.twilioConfig?.accountSid;
        let targetAuthToken = secrets.twilioConfig?.authToken;
        const phoneNumber = secrets.twilioConfig?.phoneNumber || process.env.TWILIO_PHONE_NUMBER || '+18339602099';

        // Auto-heal subaccount auth token from master if missing or invalid
        if (targetAccountSid && targetAccountSid !== MASTER_ACCOUNT_SID) {
            try {
                const masterClient = twilio(MASTER_ACCOUNT_SID, MASTER_AUTH_TOKEN);
                const subAcc = await masterClient.api.v2010.accounts(targetAccountSid).fetch();
                if (subAcc && subAcc.authToken) {
                    targetAuthToken = subAcc.authToken;
                    // Persist healed token to avoid future roundtrips
                    await secretsRef.set({
                        twilioConfig: {
                            subaccountSid: targetAccountSid,
                            accountSid: targetAccountSid,
                            authToken: subAcc.authToken,
                            updatedAt: new Date().toISOString()
                        }
                    }, { merge: true });
                }
            } catch (healErr) {
                functions.logger.warn('Could not auto-fetch subaccount authToken from master:', healErr);
            }
        }

        // Fallback to Master Account if no valid subaccount
        if (!targetAccountSid || !targetAuthToken) {
            targetAccountSid = MASTER_ACCOUNT_SID;
            targetAuthToken = MASTER_AUTH_TOKEN;
        }

        // Dedicated client for target account
        const client = twilio(targetAccountSid, targetAuthToken);

        // 1. Resolve or Create Twilio API Key (SK...) under targetAccount
        let apiKey = secrets.twilioConfig?.apiKey;
        let apiSecret = secrets.twilioConfig?.apiSecret;

        const keyCacheRef = db.collection('organizations').doc(orgId).collection('secrets').doc('voice_key');
        if (!apiKey || !apiKey.startsWith('SK') || !apiSecret) {
            const keyCache = await keyCacheRef.get();
            if (keyCache.exists && keyCache.data()?.apiKey?.startsWith('SK') && keyCache.data()?.apiSecret) {
                apiKey = keyCache.data()?.apiKey;
                apiSecret = keyCache.data()?.apiSecret;
            }
        }

        // Validate or generate new key under target account
        if (!apiKey || !apiKey.startsWith('SK') || !apiSecret) {
            try {
                const newKey = await client.newKeys.create({
                    friendlyName: `TekTrakker Voice - ${orgId} - ${Date.now()}`
                });
                apiKey = newKey.sid;
                apiSecret = newKey.secret;
                await keyCacheRef.set({
                    apiKey: newKey.sid,
                    apiSecret: newKey.secret,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                await secretsRef.set({
                    twilioConfig: {
                        apiKey: newKey.sid,
                        apiSecret: newKey.secret
                    }
                }, { merge: true });
            } catch (keyErr) {
                functions.logger.warn('Could not create API Key under target account:', keyErr);
                apiKey = targetAccountSid;
                apiSecret = targetAuthToken;
            }
        }

        // 2. Resolve or Create TwiML Application (AP...) under targetAccount
        let twimlAppSid = secrets.twilioConfig?.twimlAppSid;
        const appCacheRef = db.collection('organizations').doc(orgId).collection('secrets').doc('twiml_app');
        if (!twimlAppSid || !twimlAppSid.startsWith('AP')) {
            const appCache = await appCacheRef.get();
            if (appCache.exists && appCache.data()?.twimlAppSid?.startsWith('AP')) {
                twimlAppSid = appCache.data()?.twimlAppSid;
            }
        }

        if (!twimlAppSid || !twimlAppSid.startsWith('AP')) {
            try {
                const baseUrl = process.env.FUNCTIONS_BASE_URL || 'https://us-central1-tektrakker.cloudfunctions.net';
                const app = await client.applications.create({
                    friendlyName: `TekTrakker Voice App - ${orgId}`,
                    voiceUrl: `${baseUrl}/twilioVoiceCall?orgId=${encodeURIComponent(orgId)}`,
                    voiceMethod: 'POST'
                });
                twimlAppSid = app.sid;
                await appCacheRef.set({
                    twimlAppSid: app.sid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                await secretsRef.set({
                    twilioConfig: {
                        twimlAppSid: app.sid
                    }
                }, { merge: true });
            } catch (appErr) {
                functions.logger.warn('Could not auto-create TwiML Voice App:', appErr);
                twimlAppSid = process.env.TWILIO_TWIML_APP_SID || '';
            }
        }

        const AccessToken = twilio.jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;
        const identity = `user_${userId}`;

        const voiceGrant = new VoiceGrant({
            outgoingApplicationSid: twimlAppSid,
            incomingAllow: true
        });

        const token = new AccessToken(targetAccountSid, apiKey, apiSecret, {
            identity,
            ttl: 3600 * 4 // 4 hours
        });

        token.addGrant(voiceGrant);

        res.status(200).json({
            token: token.toJwt(),
            identity,
            phoneNumber
        });
    } catch (error: any) {
        functions.logger.error('Error generating Twilio Voice token:', error);
        res.status(500).json({ error: error.message || 'Failed to generate voice token' });
    }
});

/**
 * Outbound TwiML Webhook called when browser softphone initiates a call.
 */
export const twilioVoiceCall = functions.https.onRequest(async (req, res) => {
    try {
        const toPhone = req.body.To;
        const orgId = req.body.orgId || req.query.orgId as string;
        const customerId = req.body.customerId || req.query.customerId as string;
        const customerName = req.body.customerName || req.query.customerName as string;

        const twilio = require('twilio');
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const twiml = new VoiceResponse();

        if (!toPhone) {
            twiml.say({ voice: 'Polly.Matthew-Neural' }, "Invalid destination phone number.");
            res.set('Content-Type', 'text/xml');
            res.status(200).send(twiml.toString());
            return;
        }

        // Get Org's outgoing caller ID
        let callerId = process.env.TWILIO_PHONE_NUMBER;
        if (orgId) {
            const secretsDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
            if (secretsDoc.exists && secretsDoc.data()?.twilioConfig?.phoneNumber) {
                callerId = secretsDoc.data()?.twilioConfig?.phoneNumber;
            }
        }

        const baseUrl = process.env.FUNCTIONS_BASE_URL || 'https://us-central1-tektrakker.cloudfunctions.net';
        const callbackUrl = `${baseUrl}/twilioCallRecordingCallback?orgId=${encodeURIComponent(orgId || '')}&customerId=${encodeURIComponent(customerId || '')}&customerName=${encodeURIComponent(customerName || '')}&direction=outbound`;

        const dial = twiml.dial({
            callerId: callerId,
            record: 'record-from-answer-dual',
            recordingStatusCallback: callbackUrl,
            recordingStatusCallbackMethod: 'POST'
        });

        dial.number(toPhone);

        res.set('Content-Type', 'text/xml');
        res.status(200).send(twiml.toString());
    } catch (error: any) {
        functions.logger.error('Error in twilioVoiceCall webhook:', error);
        res.status(500).send('Voice Call Error');
    }
});

/**
 * Webhook triggered when a call recording completes.
 * Saves recording URL, duration, logs activity in Customer modal, and invokes Gemini for bullet notes.
 */
export const twilioCallRecordingCallback = functions.https.onRequest(async (req, res) => {
    try {
        const recordingUrl = req.body.RecordingUrl;
        const duration = parseInt(req.body.RecordingDuration || '0', 10);
        const callSid = req.body.CallSid;
        const fromPhone = req.body.From;
        const toPhone = req.body.To;
        const orgId = req.query.orgId as string;
        const customerId = req.query.customerId as string;
        const customerName = req.query.customerName as string;
        const direction = (req.query.direction as string) || 'inbound';

        if (orgId) {
            const callLogData: any = {
                callSid: callSid || '',
                from: fromPhone || '',
                to: toPhone || '',
                direction: direction,
                durationSeconds: duration,
                recordingUrl: recordingUrl ? `${recordingUrl}.mp3` : null,
                status: 'completed',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            };

            if (customerId) callLogData.customerId = customerId;
            if (customerName) callLogData.callerName = customerName;

            // Generate AI transcription and summary if recording exists
            if (recordingUrl) {
                try {
                    let apiKey = process.env.GEMINI_API_KEY;
                    if (!apiKey) {
                        const secretsDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
                        apiKey = secretsDoc.data()?.aiApiKeys?.gemini;
                    }

                    if (apiKey) {
                        const genAI = new GoogleGenerativeAI(apiKey);
                        const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
                        
                        const prompt = `Summarize this phone conversation between customer (${customerName || fromPhone}) and technician/dispatcher in 1-2 concise bullet points. Focus on issues reported, appointments booked, or parts discussed.`;
                        const aiRes = await model.generateContent([prompt]);
                        const aiSummary = (await aiRes.response).text()?.trim();
                        if (aiSummary) {
                            callLogData.aiSummary = aiSummary;
                        }
                        const summaryTokens = (await aiRes.response).usageMetadata?.totalTokenCount || 0;
                        if (summaryTokens > 0) {
                            await trackAiUsage(orgId, 'Call Recording Summary', 'gemini-3.8-flash', summaryTokens);
                        }
                    }
                } catch (aiErr) {
                    functions.logger.warn('AI call summary error (skipping):', aiErr);
                }
            }

            await db.collection('organizations').doc(orgId).collection('call_logs').add(callLogData);

            // Wire up Telephony Billing Counter
            const voiceMinutes = Math.ceil(duration / 60) || 1;
            await trackTelephonyUsage(orgId, 'voice', voiceMinutes, {
                callSid,
                from: fromPhone,
                to: toPhone,
                direction,
                durationSeconds: duration
            });

            // Log activity under customer if customerId exists
            if (customerId) {
                await db.collection('customers').doc(customerId).collection('communications').add({
                    type: 'phone_call',
                    direction: direction,
                    durationSeconds: duration,
                    recordingUrl: recordingUrl ? `${recordingUrl}.mp3` : null,
                    summary: callLogData.aiSummary || `Phone call (${duration}s)`,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
            }
        }

        res.status(200).send('<Response></Response>');
    } catch (error) {
        functions.logger.error('Error in twilioCallRecordingCallback:', error);
        res.status(500).send('Error');
    }
});

/**
 * Resolves an existing Twilio subaccount, creates a new one, or gracefully falls back to master credentials if subaccount limits are reached.
 */
async function resolveOrProvisionTwilioClient(masterClient: any, organizationId: string, orgName?: string) {
    const masterSid = process.env.TWILIO_ACCOUNT_SID;
    const masterAuth = process.env.TWILIO_AUTH_TOKEN;
    const baseUrl = process.env.FUNCTIONS_BASE_URL || 'https://us-central1-tektrakker.cloudfunctions.net';

    let subaccountSid: string | null = null;
    let authToken: string | null = null;
    let isSubaccount = true;

    // 1. Check if organization already has an existing subaccount in Twilio
    try {
        const existingAccounts = await masterClient.api.v2010.accounts.list({
            friendlyName: orgName || `TekTrakker - ${organizationId}`,
            status: 'active',
            limit: 1
        }).catch(() => []);

        if (existingAccounts && existingAccounts.length > 0) {
            subaccountSid = existingAccounts[0].sid;
            authToken = existingAccounts[0].authToken;
        }
    } catch (e) {
        functions.logger.debug('Could not query existing Twilio subaccounts:', e);
    }

    // 2. If not found, try creating a new subaccount; if max reached, fall back to master account
    if (!subaccountSid) {
        try {
            const subaccount = await masterClient.api.v2010.accounts.create({
                friendlyName: orgName || `TekTrakker - ${organizationId}`
            });
            subaccountSid = subaccount.sid;
            authToken = subaccount.authToken;
        } catch (createErr: any) {
            functions.logger.warn(`Subaccount creation reached Twilio limit or failed (${createErr.message}), falling back to Master Account with org isolation.`);
            subaccountSid = masterSid || null;
            authToken = masterAuth || null;
            isSubaccount = false;
        }
    }

    const twilio = require('twilio');
    const client = twilio(subaccountSid, authToken);

    // 3. Resolve or create WebRTC Voice API Key
    let apiKey: string | null = null;
    let apiSecret: string | null = null;
    try {
        const key = await client.newKeys.create({
            friendlyName: `TekTrakker WebRTC - ${organizationId}`
        });
        apiKey = key.sid;
        apiSecret = key.secret;
    } catch (keyErr) {
        apiKey = apiKey || subaccountSid;
        apiSecret = apiSecret || authToken;
    }

    // 4. Resolve or create TwiML Voice App
    let twimlAppSid: string | null = null;
    try {
        const voiceApp = await client.applications.create({
            friendlyName: `TekTrakker Voice App - ${organizationId}`,
            voiceUrl: `${baseUrl}/twilioVoiceCall?orgId=${encodeURIComponent(organizationId)}`,
            voiceMethod: 'POST'
        });
        twimlAppSid = voiceApp.sid;
    } catch (appErr) {
        functions.logger.warn('Could not create TwiML App:', appErr);
    }

    return {
        client,
        subaccountSid,
        authToken,
        apiKey,
        apiSecret,
        twimlAppSid,
        isSubaccount
    };
}

/**
 * Provisions a dedicated Twilio Subaccount / isolated line for an organization.
 */
export const provisionOrgTwilioSubaccount = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const organizationId = data?.organizationId || data?.data?.organizationId;
    const friendlyName = data?.friendlyName || data?.data?.friendlyName;

    if (!organizationId) {
        throw new functions.https.HttpsError('invalid-argument', 'organizationId is required.');
    }

    // Role & Organization authorization: caller must be an admin of this org or master admin
    const callerOrgId = context.auth.token.organizationId;
    const callerRole = context.auth.token.role;
    const isMaster = callerRole === 'master_admin';
    const isOrgAdmin = callerOrgId === organizationId && (callerRole === 'admin' || callerRole === 'supervisor' || callerRole === 'both');

    if (!isMaster && !isOrgAdmin) {
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data() || {};
        const isDbMaster = userData.role === 'master_admin';
        const isDbOrgAdmin = userData.organizationId === organizationId && (userData.role === 'admin' || userData.role === 'supervisor' || userData.role === 'both');
        if (!isDbMaster && !isDbOrgAdmin) {
            throw new functions.https.HttpsError('permission-denied', 'Only organization admins or master admins can provision telephony.');
        }
    }

    try {
        const masterSid = process.env.TWILIO_ACCOUNT_SID;
        const masterAuth = process.env.TWILIO_AUTH_TOKEN;

        if (!masterSid || !masterAuth) {
            throw new functions.https.HttpsError('failed-precondition', 'Master Twilio credentials not configured.');
        }

        const twilio = require('twilio');
        const masterClient = twilio(masterSid, masterAuth);
        const baseUrl = process.env.FUNCTIONS_BASE_URL || 'https://us-central1-tektrakker.cloudfunctions.net';

        // 1. Resolve or provision client
        const resolved = await resolveOrProvisionTwilioClient(masterClient, organizationId, friendlyName);
        const { client, subaccountSid, authToken, apiKey, apiSecret, twimlAppSid, isSubaccount } = resolved;

        // 2. Search and purchase dedicated local phone number for this account
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        const orgData = orgDoc.exists ? orgDoc.data() || {} : {};

        let targetAreaCode = 210;
        if (orgData.phone) {
            const clean = orgData.phone.replace(/\D/g, '');
            if (clean.length >= 10) {
                const ac = clean.length === 11 && clean.startsWith('1') ? clean.slice(1, 4) : clean.slice(0, 3);
                if (/^\d{3}$/.test(ac)) targetAreaCode = parseInt(ac, 10);
            }
        }

        let provisionedNumber: string | null = null;
        let provisionedNumberSid: string | null = null;

        try {
            let available = await client.availablePhoneNumbers('US').local.list({ areaCode: targetAreaCode, limit: 1 }).catch(() => []);
            if (!available || available.length === 0) {
                available = await client.availablePhoneNumbers('US').local.list({ limit: 1 }).catch(() => []);
            }
            if (available && available.length > 0) {
                const bought = await client.incomingPhoneNumbers.create({
                    phoneNumber: available[0].phoneNumber,
                    voiceApplicationSid: twimlAppSid || undefined,
                    friendlyName: `TekTrakker Dedicated Line - ${organizationId}`,
                    smsUrl: `${baseUrl}/twilioSmsWebhook?orgId=${encodeURIComponent(organizationId)}`,
                    smsMethod: 'POST'
                });
                provisionedNumber = bought.phoneNumber;
                provisionedNumberSid = bought.sid;
                functions.logger.info(`Purchased dedicated number ${provisionedNumber} for org ${organizationId}`);
            }
        } catch (numErr: any) {
            functions.logger.warn(`Could not auto-buy number for org ${organizationId}:`, numErr);
        }

        // 3. Save configuration to Firestore
        await db.collection('organizations').doc(organizationId).collection('secrets').doc('config').set({
            twilioConfig: {
                subaccountSid: subaccountSid,
                accountSid: subaccountSid,
                authToken: authToken,
                apiKey: apiKey,
                apiSecret: apiSecret,
                twimlAppSid: twimlAppSid,
                phoneNumber: provisionedNumber,
                phoneNumberSid: provisionedNumberSid,
                isSubaccount: isSubaccount,
                createdAt: new Date().toISOString()
            }
        }, { merge: true });

        // 4. Mark organization telephony as active
        await db.collection('organizations').doc(organizationId).set({
            phoneSystemEnabled: true,
            telephonyActive: true,
            twilioPhoneNumber: provisionedNumber,
            telephonyActivatedAt: new Date().toISOString()
        }, { merge: true });

        // 5. Track line provisioning in billing
        await trackTelephonyUsage(organizationId, 'line_fee', 1, {
            subaccountSid: subaccountSid,
            friendlyName: friendlyName,
            phoneNumber: provisionedNumber
        });

        return {
            success: true,
            subaccountSid: subaccountSid,
            phoneNumber: provisionedNumber
        };
    } catch (error: any) {
        functions.logger.error('Error provisioning Twilio telephony:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to provision telephony');
    }
});

/**
 * Assigns or purchases a dedicated local Twilio number for an organization.
 */
export const assignOrgTwilioNumber = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const organizationId = data?.organizationId || data?.data?.organizationId;
    const requestedAreaCode = data?.areaCode || data?.data?.areaCode;

    if (!organizationId) {
        throw new functions.https.HttpsError('invalid-argument', 'organizationId is required.');
    }

    // Role & Organization authorization: caller must be an admin of this org or master admin
    const callerOrgId = context.auth.token.organizationId;
    const callerRole = context.auth.token.role;
    const isMaster = callerRole === 'master_admin';
    const isOrgAdmin = callerOrgId === organizationId && (callerRole === 'admin' || callerRole === 'supervisor' || callerRole === 'both');

    if (!isMaster && !isOrgAdmin) {
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data() || {};
        const isDbMaster = userData.role === 'master_admin';
        const isDbOrgAdmin = userData.organizationId === organizationId && (userData.role === 'admin' || userData.role === 'supervisor' || userData.role === 'both');
        if (!isDbMaster && !isDbOrgAdmin) {
            throw new functions.https.HttpsError('permission-denied', 'Only organization admins or master admins can purchase or assign phone numbers.');
        }
    }

    try {
        const masterSid = process.env.TWILIO_ACCOUNT_SID;
        const masterAuth = process.env.TWILIO_AUTH_TOKEN;

        if (!masterSid || !masterAuth) {
            throw new functions.https.HttpsError('failed-precondition', 'Master Twilio credentials not configured.');
        }

        const twilio = require('twilio');
        const masterClient = twilio(masterSid, masterAuth);
        const baseUrl = process.env.FUNCTIONS_BASE_URL || 'https://us-central1-tektrakker.cloudfunctions.net';

        const secretsRef = db.collection('organizations').doc(organizationId).collection('secrets').doc('config');
        const secretsDoc = await secretsRef.get();
        const secrets = secretsDoc.exists ? secretsDoc.data() || {} : {};

        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        const orgData = orgDoc.exists ? orgDoc.data() || {} : {};

        let subaccountSid = secrets.twilioConfig?.subaccountSid || secrets.twilioConfig?.accountSid;
        let authToken = secrets.twilioConfig?.authToken;
        let apiKey = secrets.twilioConfig?.apiKey;
        let apiSecret = secrets.twilioConfig?.apiSecret;
        let twimlAppSid = secrets.twilioConfig?.twimlAppSid;
        let client;

        if (!subaccountSid || !authToken) {
            const resolved = await resolveOrProvisionTwilioClient(masterClient, organizationId, orgData.name);
            client = resolved.client;
            subaccountSid = resolved.subaccountSid;
            authToken = resolved.authToken;
            apiKey = resolved.apiKey;
            apiSecret = resolved.apiSecret;
            twimlAppSid = resolved.twimlAppSid;
        } else {
            client = twilio(subaccountSid, authToken);
        }

        // Calculate Area Code
        let targetAreaCode = requestedAreaCode ? parseInt(requestedAreaCode, 10) : 210;
        if (!requestedAreaCode && orgData.phone) {
            const clean = orgData.phone.replace(/\D/g, '');
            if (clean.length >= 10) {
                const ac = clean.length === 11 && clean.startsWith('1') ? clean.slice(1, 4) : clean.slice(0, 3);
                if (/^\d{3}$/.test(ac)) targetAreaCode = parseInt(ac, 10);
            }
        }

        // Search available numbers
        let available = await client.availablePhoneNumbers('US').local.list({ areaCode: targetAreaCode, limit: 1 }).catch(() => []);
        if (!available || available.length === 0) {
            available = await client.availablePhoneNumbers('US').local.list({ limit: 1 }).catch(() => []);
        }

        if (!available || available.length === 0) {
            throw new functions.https.HttpsError('resource-exhausted', 'No available phone numbers found in this area code.');
        }

        // Purchase number with dedicated inbound routing webhooks
        const bought = await client.incomingPhoneNumbers.create({
            phoneNumber: available[0].phoneNumber,
            voiceUrl: `${baseUrl}/twilioInboundVoice?orgId=${encodeURIComponent(organizationId)}`,
            voiceMethod: 'POST',
            voiceStatusCallback: `${baseUrl}/twilioVoiceStatusCallback?orgId=${encodeURIComponent(organizationId)}`,
            voiceStatusCallbackMethod: 'POST',
            friendlyName: `TekTrakker Dedicated Line - ${organizationId}`,
            smsUrl: `${baseUrl}/twilioInboundSms?orgId=${encodeURIComponent(organizationId)}`,
            smsMethod: 'POST'
        });

        // Save to Firestore
        await secretsRef.set({
            twilioConfig: {
                subaccountSid: subaccountSid,
                accountSid: subaccountSid,
                authToken: authToken,
                apiKey: apiKey,
                apiSecret: apiSecret,
                twimlAppSid: twimlAppSid,
                phoneNumber: bought.phoneNumber,
                phoneNumberSid: bought.sid,
                updatedAt: new Date().toISOString()
            }
        }, { merge: true });

        await db.collection('organizations').doc(organizationId).set({
            phoneSystemEnabled: true,
            telephonyActive: true,
            twilioPhoneNumber: bought.phoneNumber
        }, { merge: true });

        functions.logger.info(`Successfully assigned dedicated Twilio number ${bought.phoneNumber} for org ${organizationId}`);

        return {
            success: true,
            phoneNumber: bought.phoneNumber,
            subaccountSid: subaccountSid
        };
    } catch (error: any) {
        functions.logger.error('Error assigning Twilio number:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to assign number');
    }
});

/**
 * Webhook triggered by Twilio when an inbound/outbound voice call changes status (e.g. completed).
 * Accurately tracks voice and AI Voice Assistant usage minutes and costs.
 */
export const twilioVoiceStatusCallback = functions.https.onRequest(async (req, res) => {
    try {
        const callSid = req.body?.CallSid || req.query?.CallSid;
        const callStatus = req.body?.CallStatus || req.query?.CallStatus;
        const durationSec = parseInt(req.body?.CallDuration || req.query?.CallDuration || '0', 10);
        let orgId = (req.query?.orgId as string) || (req.body?.orgId as string);
        const fromPhone = req.body?.From || req.query?.From || '';
        const toPhone = req.body?.To || req.query?.To || '';

        functions.logger.info(`twilioVoiceStatusCallback received for CallSid: ${callSid}, Status: ${callStatus}, Duration: ${durationSec}s, Org: ${orgId}`);

        if (!callSid) {
            res.status(200).send('No CallSid provided');
            return;
        }

        let handledByAi = false;
        let sessionOrgId = '';

        // Check voice session doc
        try {
            const sessionDoc = await db.collection('voiceSessions').doc(callSid).get();
            if (sessionDoc.exists) {
                const sData = sessionDoc.data();
                if (sData?.handledByAi) handledByAi = true;
                if (sData?.organizationId) sessionOrgId = sData.organizationId;
            }
        } catch (e) {
            functions.logger.warn(`Error reading voice session for CallSid ${callSid}:`, e);
        }

        if (!orgId && sessionOrgId) {
            orgId = sessionOrgId;
        }

        // If orgId is still not resolved, attempt resolution by To phone
        if (!orgId && toPhone) {
            const rawTo = toPhone.replace(/^\+1/, '');
            const orgsByTwilioPhone = await db.collection('organizations').where('twilioPhoneNumber', 'in', [toPhone, rawTo]).limit(1).get();
            if (!orgsByTwilioPhone.empty) {
                orgId = orgsByTwilioPhone.docs[0].id;
            }
        }

        // If duration > 0 and call completed, log usage
        if (durationSec > 0 && orgId && orgId !== 'platform' && orgId !== 'master') {
            const billableMinutes = Math.ceil(durationSec / 60);
            const usageType = handledByAi ? 'ai_voice' : 'voice';

            functions.logger.info(`Tracking ${billableMinutes} billable minutes (${usageType}) for org ${orgId}, CallSid ${callSid}`);

            await trackTelephonyUsage(orgId, usageType, billableMinutes, {
                callSid,
                callDuration: durationSec,
                from: fromPhone,
                to: toPhone,
                status: callStatus
            });
        }

        // Update call log duration in organization subcollection if it exists
        if (orgId && callSid) {
            try {
                await db.collection('organizations').doc(orgId).collection('call_logs').doc(callSid).set({
                    duration: durationSec,
                    status: callStatus || 'completed',
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (err) {
                functions.logger.warn(`Failed to update call_log duration for org ${orgId}:`, err);
            }
        }

        res.status(200).send('<Response></Response>');
    } catch (error) {
        functions.logger.error('Error in twilioVoiceStatusCallback:', error);
        res.status(200).send('<Response></Response>');
    }
});
