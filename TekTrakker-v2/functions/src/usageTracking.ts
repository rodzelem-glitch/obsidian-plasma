/* eslint-disable no-undef, @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// --- AI USAGE TRACKING ---

export async function trackAiUsage(
    orgId: string, 
    taskName: string, 
    modelName: string, 
    tokenCount: number,
    promptTokenCount?: number,
    candidatesTokenCount?: number
) {
    if (!orgId || orgId === 'unauthenticated' || tokenCount <= 0) return;

    try {
        if (admin.apps.length === 0) {
    try { admin.initializeApp(); } catch { /* ignore */ }
}
const db = admin.firestore();
        const orgUsageRef = db.collection('aiUsage').doc(orgId);
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const sanitizedModelName = modelName.replace(/\./g, '_');

        const updateData: any = {
            organizationId: orgId,
            totalTokensUsed: admin.firestore.FieldValue.increment(tokenCount),
            [`tasks.${taskName}`]: admin.firestore.FieldValue.increment(tokenCount),
            [`models.${sanitizedModelName}`]: admin.firestore.FieldValue.increment(tokenCount),
            [`monthlyUsage.${monthKey}.totalTokensUsed`]: admin.firestore.FieldValue.increment(tokenCount),
            [`monthlyUsage.${monthKey}.tasks.${taskName}`]: admin.firestore.FieldValue.increment(tokenCount),
            [`monthlyUsage.${monthKey}.models.${sanitizedModelName}`]: admin.firestore.FieldValue.increment(tokenCount),
            [`monthlyUsage.${monthKey}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };

        if (promptTokenCount) {
            updateData.promptTokensUsed = admin.firestore.FieldValue.increment(promptTokenCount);
            updateData[`monthlyUsage.${monthKey}.promptTokensUsed`] = admin.firestore.FieldValue.increment(promptTokenCount);
        }
        if (candidatesTokenCount) {
            updateData.candidatesTokensUsed = admin.firestore.FieldValue.increment(candidatesTokenCount);
            updateData[`monthlyUsage.${monthKey}.candidatesTokensUsed`] = admin.firestore.FieldValue.increment(candidatesTokenCount);
        }

        await orgUsageRef.set(updateData, { merge: true });
    } catch (e) {
        functions.logger.error("Failed to track AI usage:", e);
    }
}

// --- SMS USAGE TRACKING ---

export async function trackSmsUsage(orgId: string, direction: 'inbound' | 'outbound') {
    if (!orgId || orgId === 'unauthenticated') return;
    try {
        const db = admin.firestore();
        const now = new Date();
        const billingCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const usageRef = db.collection('smsUsage').doc(`${orgId}_${billingCycle}`);
        
        const updateData: any = {
            organizationId: orgId,
            billingCycle: billingCycle,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (direction === 'outbound') {
            updateData.totalSmsSent = admin.firestore.FieldValue.increment(1);
        } else {
            updateData.totalSmsReceived = admin.firestore.FieldValue.increment(1);
        }
        
        await usageRef.set(updateData, { merge: true });
        
        functions.logger.info(`Tracked ${direction} SMS usage for organization ${orgId} in cycle ${billingCycle}`);
    } catch (e) {
        functions.logger.error("Failed to track SMS usage:", e);
    }
}

// --- EMAIL USAGE TRACKING ---

export async function trackEmailUsage(orgId: string) {
    if (!orgId || orgId === 'unauthenticated' || orgId === 'platform') return;
    try {
        const db = admin.firestore();
        const now = new Date();
        const billingCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const usageRef = db.collection('emailUsage').doc(`${orgId}_${billingCycle}`);
        await usageRef.set({
            organizationId: orgId,
            billingCycle: billingCycle,
            totalEmailsSent: admin.firestore.FieldValue.increment(1),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        functions.logger.info(`Tracked outbound Email usage for organization ${orgId} in cycle ${billingCycle}`);
    } catch (e) {
        functions.logger.error("Failed to track Email usage:", e);
    }
}

// --- TELEPHONY USAGE TRACKING ---

export async function trackTelephonyUsage(
    orgId: string,
    type: 'voice' | 'ai_voice' | 'sms_sent' | 'sms_received' | 'line_fee',
    units: number, // minutes (for voice/ai_voice) or 1 (for SMS / line fee)
    metadata?: Record<string, any>
) {
    if (!orgId || orgId === 'unauthenticated' || units <= 0) return;

    try {
        const db = admin.firestore();
        const now = new Date();
        const cycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const docId = `${orgId}_${cycle}`;
        const usageRef = db.collection('smsUsage').doc(docId);

        // Fetch platform settings or custom rates if available
        let voiceRate = 0.035; // default $0.035 / min
        let aiVoiceRate = 0.07; // default $0.07 / min for AI Voice Assistant
        let smsRate = 0.02;    // default $0.02 / message
        let lineFee = 15.00;   // default $15 / line / month

        try {
            const settingsDoc = await db.collection('platformSettings').doc('global').get();
            if (settingsDoc.exists) {
                const s = settingsDoc.data();
                if (s?.voiceRate !== undefined) voiceRate = Number(s.voiceRate);
                if (s?.aiVoiceAssistantRatePerMinute !== undefined) aiVoiceRate = Number(s.aiVoiceAssistantRatePerMinute);
                if (s?.smsRate !== undefined) smsRate = Number(s.smsRate);
                if (s?.phoneLineFee !== undefined) lineFee = Number(s.phoneLineFee);
            }
        } catch { /* use defaults */ }

        if (metadata?.customRate !== undefined && Number(metadata.customRate) >= 0) {
            if (type === 'ai_voice') aiVoiceRate = Number(metadata.customRate);
            else if (type === 'voice') voiceRate = Number(metadata.customRate);
            else if (type === 'sms_sent' || type === 'sms_received') smsRate = Number(metadata.customRate);
        }

        const updateData: any = {
            organizationId: orgId,
            billingCycle: cycle,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };

        let calculatedCost = 0;
        if (type === 'ai_voice') {
            calculatedCost = units * aiVoiceRate;
            updateData.totalAiVoiceMinutes = admin.firestore.FieldValue.increment(units);
            updateData.totalAiVoiceCost = admin.firestore.FieldValue.increment(calculatedCost);
            updateData.totalVoiceMinutes = admin.firestore.FieldValue.increment(units);
            updateData.totalCost = admin.firestore.FieldValue.increment(calculatedCost);
        } else if (type === 'voice') {
            calculatedCost = units * voiceRate;
            updateData.totalVoiceMinutes = admin.firestore.FieldValue.increment(units);
            updateData.totalVoiceCost = admin.firestore.FieldValue.increment(calculatedCost);
            updateData.totalCost = admin.firestore.FieldValue.increment(calculatedCost);
        } else if (type === 'sms_sent') {
            calculatedCost = units * smsRate;
            updateData.totalSmsSent = admin.firestore.FieldValue.increment(units);
            updateData.totalSmsCost = admin.firestore.FieldValue.increment(calculatedCost);
            updateData.totalCost = admin.firestore.FieldValue.increment(calculatedCost);
        } else if (type === 'sms_received') {
            calculatedCost = units * smsRate;
            updateData.totalSmsReceived = admin.firestore.FieldValue.increment(units);
            updateData.totalSmsCost = admin.firestore.FieldValue.increment(calculatedCost);
            updateData.totalCost = admin.firestore.FieldValue.increment(calculatedCost);
        } else if (type === 'line_fee') {
            calculatedCost = lineFee * units;
            updateData.totalLineFees = admin.firestore.FieldValue.increment(calculatedCost);
            updateData.totalCost = admin.firestore.FieldValue.increment(calculatedCost);
        }

        await usageRef.set(updateData, { merge: true });

        // Record line item in transactions subcollection for transparent billing ledger
        await usageRef.collection('transactions').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type,
            units,
            cost: calculatedCost,
            metadata: metadata || {}
        }).catch(() => {});

    } catch (e) {
        functions.logger.error("Failed to track telephony usage:", e);
    }
}
