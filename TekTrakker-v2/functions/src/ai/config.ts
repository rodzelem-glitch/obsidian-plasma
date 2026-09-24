/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Ensure global.fetch is patched to automatically sanitize role: "function" -> role: "user" for Google Generative AI REST requests
const originalFetch = global.fetch;
if (typeof originalFetch === 'function') {
    global.fetch = function(url: any, options: any) {
        if (options && typeof options.body === 'string' && options.body.includes('"role":"function"')) {
            options = Object.assign({}, options, {
                body: options.body.replace(/"role"\s*:\s*"function"/g, '"role":"user"')
            });
        }
        return originalFetch.call(this, url, options);
    };
}

export const AGENT_MODELS_CASCADE = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash"
] as const;

export const executeWithRetry = async (operation: () => Promise<any>, maxRetries = 5, baseDelayMs = 2000) => {
    let retries = 0;
    while (true) {
        try {
            return await operation();
        } catch (error: any) {
            retries++;
            const isRateLimit = error.status === 429 || error.message?.includes("429") || error.message?.includes("Too Many Requests") || error.message?.toLowerCase().includes("quota");
            const isDemandSpikeOrUnavailable = error.status === 503 || error.message?.includes("503") || error.message?.includes("Service Unavailable") || error.message?.toLowerCase().includes("demand") || error.message?.toLowerCase().includes("overloaded") || error.message?.toLowerCase().includes("unavailable");
            const isAuthError = error.message?.toLowerCase().includes("api key not valid");
            const isTransient = isRateLimit || isDemandSpikeOrUnavailable;
            // Allow more retries for transient rate limits and 503 capacity spikes
            const effectiveMaxRetries = isTransient ? maxRetries : 2;

            if (retries > effectiveMaxRetries || isAuthError) {
                throw error;
            }

            let delayMs: number;
            if (isRateLimit) {
                // Parse the server-suggested retry delay (e.g. "retry in 10.747s") if available
                const retryMatch = error.message?.match(/retry\s+in\s+([\d.]+)\s*s/i);
                delayMs = retryMatch
                    ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000   // Use server hint + 1s buffer
                    : Math.max(12000, baseDelayMs * Math.pow(2, retries - 1)); // Fallback: at least 12s
            } else if (isDemandSpikeOrUnavailable) {
                // Exponential backoff with small random jitter for 503 demand spikes (e.g. 1.5s, 3s, 6s)
                const jitter = Math.floor(Math.random() * 500);
                delayMs = Math.min(10000, Math.floor(baseDelayMs * Math.pow(1.8, retries - 1)) + jitter);
            } else {
                delayMs = baseDelayMs * Math.pow(2, retries - 1);
            }

            console.warn(`Gemini API ${isRateLimit ? '429 Rate Limited' : isDemandSpikeOrUnavailable ? '503 High Demand / Unavailable' : 'Error'} (Attempt ${retries}/${effectiveMaxRetries}). Retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
};

export async function getGeminiApiKey(orgId: string): Promise<string> {
    let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (orgId && orgId !== 'unauthenticated') {
        const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get();
        if (orgDoc.exists) {
            const orgData = orgDoc.data();
            if (orgData?.franchiseId) {
                const franchiseDoc = await admin.firestore().collection('franchises').doc(orgData.franchiseId).get();
                if (franchiseDoc.exists) {
                    const franchiseData = franchiseDoc.data();
                    if (franchiseData?.aiApiKeys?.gemini) {
                        apiKey = franchiseData.aiApiKeys.gemini;
                    } else {
                        throw new functions.https.HttpsError('failed-precondition', 'Your franchise has not configured a valid AI API key. Please contact your franchise administrator to enable AI features.');
                    }
                } else {
                    throw new functions.https.HttpsError('not-found', 'Franchise record not found.');
                }
            }
        }
    }

    if (!apiKey) {
        throw new functions.https.HttpsError('internal', 'AI service configuration error. Missing API key.');
    }

    return apiKey as string;
}

export const MINIMAL_THINKING_CONFIG: any = {
    thinkingConfig: {
        thinkingBudget: 0
    }
};

export const formatHistoryTurn = (msg: any) => {
    const role = (msg.role === 'model' || msg.role === 'assistant') ? 'model' : 'user';
    if (Array.isArray(msg.parts) && msg.parts.length > 0) {
        return { role, parts: msg.parts };
    }
    const parts: any[] = [];
    if (msg.thought || msg.thoughtSignature) {
        parts.push({ thought: true, thoughtSignature: msg.thoughtSignature || msg.thought });
    }
    parts.push({ text: msg.content || '' });
    return { role, parts };
};

export const summarizeHistory = async (apiKey: string, historyToSummarize: any[]): Promise<string> => {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-3.8-flash",
            generationConfig: MINIMAL_THINKING_CONFIG
        });
        
        const formatted = historyToSummarize.map((msg: any) => 
            `${msg.role === 'model' ? 'AI' : 'User'}: ${msg.content || ''}`
        ).join('\n');
        
        const prompt = `You are an AI conversation summarizer. Summarize the following dialogue between a User and their Virtual AI Assistant in a single, highly concise paragraph. Focus on completed tasks, active jobs, customer context, and pending issues. Do NOT include any introductory or meta text, just return the summary paragraph directly.\n\nDialogue:\n${formatted}`;
        
        const result = await executeWithRetry(() => model.generateContent(prompt), 2, 3000);
        const text = result.response.text();
        return text ? text.trim() : "";
    } catch (err) {
        console.error("Failed to generate history summary:", err);
        return "";
    }
};

// Sanitizes document data according to caller role to prevent PII and sensitive payroll/identity leakage
export const sanitizeDocData = (collectionName: string, docData: any, isAdminUser: boolean, isSupervisorUser: boolean): any => {
    if (!docData || typeof docData !== 'object') return docData;
    const sanitized = { ...docData };

    // Strip raw passwords across all collections
    delete sanitized.password;

    if (collectionName === 'users') {
        if (!isAdminUser && !isSupervisorUser) {
            // General technicians and field employees: allow only public workplace profile attributes
            const publicKeys = ['id', 'name', 'firstName', 'lastName', 'role', 'title', 'phone', 'email', 'status', 'department', 'hasCompanyVehicle'];
            const filtered: Record<string, any> = {};
            for (const key of publicKeys) {
                if (sanitized[key] !== undefined) filtered[key] = sanitized[key];
            }
            return filtered;
        } else if (!isAdminUser) {
            // Supervisors: mask private identity and financial data
            delete sanitized.ssn;
            delete sanitized.directDeposit;
            delete sanitized.payRate;
            delete sanitized.billableRate;
            delete sanitized.taxId;
            delete sanitized.dob;
            delete sanitized.driversLicense;
        }
    }

    return sanitized;
};

// Unified AI Token and Cost Tracking Helper
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
        console.error("Failed to track AI usage:", e);
    }
}

/**
 * Determines whether a user record possesses organization administrator permissions.
 * Treats 'both' and 'superuser' user types as having full standard Admin permissions identical to 'admin'.
 * Master Admins (Roderick & Ryan) also satisfy admin clearance within any organization context.
 */
export const isUserAdmin = (userData: any): boolean => {
    if (!userData) return false;
    const role = String(userData.role || '').toLowerCase().trim();
    const userType = String(userData.userType || userData.user_type || userData.type || '').toLowerCase().trim();

    const adminMatches = (val: string) => {
        if (!val) return false;
        return val === 'admin' ||
            val === 'master_admin' ||
            val === 'franchise_admin' ||
            val === 'administrator' ||
            val === 'both' ||
            val === 'superuser' ||
            val === 'super_user' ||
            val.startsWith('both') ||
            val.includes('superuser');
    };

    return adminMatches(role) || adminMatches(userType);
};

/**
 * Strictly determines whether a user record is a Master Admin (platform owner).
 * Master Admin is reserved EXCLUSIVELY for platform owners (Roderick and Ryan).
 * User types 'both' and 'superuser' are standard organization admins and NEVER Master Admins.
 */
export const isUserMasterAdmin = (userData: any): boolean => {
    if (!userData) return false;
    const role = String(userData.role || '').toLowerCase().trim();
    const userType = String(userData.userType || userData.user_type || userData.type || '').toLowerCase().trim();
    return role === 'master_admin' || userType === 'master_admin';
};

/**
 * Determines whether a user record possesses supervisor permissions.
 * Admins, superusers, and 'both' implicitly possess supervisor privileges.
 */
export const isUserSupervisor = (userData: any, isAdminUser?: boolean): boolean => {
    if (isAdminUser !== undefined ? isAdminUser : isUserAdmin(userData)) return true;
    if (!userData) return false;
    const role = String(userData.role || '').toLowerCase().trim();
    const userType = String(userData.userType || userData.user_type || userData.type || '').toLowerCase().trim();
    const supervisorMatches = (val: string) => val === 'supervisor' || val === 'manager';
    return supervisorMatches(role) || supervisorMatches(userType);
};

