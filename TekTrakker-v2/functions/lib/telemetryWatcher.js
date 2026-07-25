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
exports.telemetryWatcher = exports.telemetryWatcherHandler = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Helper to retrieve Gemini API key from environment variables or database secrets.
 */
async function retrieveGeminiApiKey(eventData) {
    // 1. Try env variable
    let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (apiKey)
        return apiKey;
    const db = admin.firestore();
    const orgId = eventData?.organizationId || eventData?.orgId;
    // 2. Try database secrets under the specific organization
    if (orgId && orgId !== 'unauthenticated') {
        try {
            const secretsDoc = await db.collection('organizations').doc(orgId).collection('secrets').doc('config').get();
            if (secretsDoc.exists) {
                const data = secretsDoc.data();
                if (data) {
                    if (data.geminiApiKey)
                        return data.geminiApiKey;
                    if (data.aiApiKeys?.gemini)
                        return data.aiApiKeys.gemini;
                }
            }
            const orgDoc = await db.collection('organizations').doc(orgId).get();
            if (orgDoc.exists) {
                const orgData = orgDoc.data();
                if (orgData) {
                    if (orgData.aiApiKeys?.gemini)
                        return orgData.aiApiKeys.gemini;
                    if (orgData.franchiseId) {
                        const franchiseDoc = await db.collection('franchises').doc(orgData.franchiseId).get();
                        if (franchiseDoc.exists) {
                            const franchiseData = franchiseDoc.data();
                            if (franchiseData && franchiseData.aiApiKeys?.gemini) {
                                return franchiseData.aiApiKeys.gemini;
                            }
                        }
                    }
                }
            }
        }
        catch (e) {
            console.error('[TelemetryWatcher] Error fetching org secrets:', e);
        }
    }
    // 3. Fallback: Search all organizations' secrets/config if orgId is not provided
    try {
        const orgsSnap = await db.collection('organizations').limit(10).get();
        for (const orgDoc of orgsSnap.docs) {
            const secretsDoc = await orgDoc.ref.collection('secrets').doc('config').get();
            if (secretsDoc.exists) {
                const data = secretsDoc.data();
                if (data) {
                    if (data.geminiApiKey)
                        return data.geminiApiKey;
                    if (data.aiApiKeys?.gemini)
                        return data.aiApiKeys.gemini;
                }
            }
            const orgData = orgDoc.data();
            if (orgData && orgData.aiApiKeys?.gemini) {
                return orgData.aiApiKeys.gemini;
            }
        }
    }
    catch (e) {
        console.error('[TelemetryWatcher] Error scanning database secrets:', e);
    }
    throw new Error('Gemini API key not found in process.env or database secrets.');
}
/**
 * Helper to locate the affected file in the local workspace relative to different directory structures.
 */
function findFileContent(affectedFile) {
    if (!affectedFile)
        return null;
    // Resolve multiple relative lookup paths
    const searchPaths = [
        path.resolve(process.cwd(), '..', affectedFile),
        path.resolve(process.cwd(), affectedFile),
        path.resolve(process.cwd(), '..', affectedFile.replace(/^TekTrakker-v2\//, '')),
        path.resolve(__dirname, '..', '..', affectedFile),
        path.resolve(__dirname, '..', affectedFile),
        path.resolve(__dirname, '..', '..', '..', affectedFile),
    ];
    for (const p of searchPaths) {
        try {
            if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                return fs.readFileSync(p, 'utf8');
            }
        }
        catch (e) {
            // Ignore search paths that throw exceptions
        }
    }
    return null;
}
/**
 * Underlying handler extracted for easy testability.
 */
const telemetryWatcherHandler = async (snap, context) => {
    const eventData = snap.data();
    if (!eventData)
        return null;
    const { type, severity, errorMessage, affectedFile } = eventData;
    // We only process high severity warnings/errors (Firestore rules denials, build crashes)
    if (severity !== 'CRITICAL' && severity !== 'ERROR') {
        console.log(`[TelemetryWatcher] Low severity log skipped: ${severity}`);
        return null;
    }
    console.log(`[TelemetryWatcher] CRITICAL SYSTEM EVENT DETECTED: [${type}] ${errorMessage}`);
    const db = admin.firestore();
    const telemetryRef = snap.ref;
    // Step 1: Update status to 'Analyzing'
    await telemetryRef.update({
        status: 'Analyzing',
        analyzedAt: new Date().toISOString(),
        notes: 'Antigravity Self-Healing agent dispatched. Commencing diagnostic analysis.'
    });
    try {
        console.log(`[TelemetryWatcher] Formulating diagnostic patch for ${affectedFile || 'system core'}...`);
        // Step 2: Retrieve Gemini API key and call Gemini to formulate patch
        const apiKey = await retrieveGeminiApiKey(eventData);
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
        const fileContent = findFileContent(affectedFile);
        let prompt = `You are an autonomic self-healing AI coding assistant.
You received a telemetry warning/error in the system.
Affected File: ${affectedFile || 'Unknown'}
Error Message: ${errorMessage}
`;
        if (fileContent) {
            prompt += `\nHere is the current content of the affected file:\n\`\`\`\n${fileContent}\n\`\`\`\n`;
        }
        else {
            prompt += `\n(The content of the affected file was not directly accessible, please generate the diff based on the filename and the error message.)\n`;
        }
        prompt += `
Generate a diagnostic code patch to resolve this error. The patch MUST be in unified diff format (git diff).
Only return the unified diff patch inside a code block or as raw text. Do not include extra conversational explanations outside the diff, but make sure the diff itself is syntactically valid and clearly shows the changes needed to fix the issue.
`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        let suggestedPatch = responseText;
        if (suggestedPatch.includes('```diff')) {
            suggestedPatch = suggestedPatch.split('```diff')[1].split('```')[0].trim();
        }
        else if (suggestedPatch.includes('```')) {
            suggestedPatch = suggestedPatch.split('```')[1].split('```')[0].trim();
        }
        // Step 3: Write back to telemetryLogs/{logId} document
        await telemetryRef.update({
            status: 'Analyzed',
            suggestedPatch: suggestedPatch,
            analyzedAt: new Date().toISOString(),
            notes: 'Self-healing diagnostic analysis completed by Gemini AI.'
        });
        // Step 4: Notify Master Admin dashboard terminal logs
        await db.collection('telemetryAlerts').add({
            type: 'success',
            message: `Self-healing diagnosis successfully completed for ${affectedFile || 'Rules violation'}.`,
            timestamp: new Date().toISOString(),
            rawError: errorMessage
        });
        console.log('[TelemetryWatcher] Self-healing workflow successfully completed!');
        return { success: true };
    }
    catch (error) {
        console.error('[TelemetryWatcher] Self-healing failed:', error);
        await telemetryRef.update({
            status: 'Failed',
            errorDetails: error.message || String(error),
            notes: 'Self-healing analysis failed. Platform owner alerted.'
        });
        await db.collection('telemetryAlerts').add({
            type: 'error',
            message: `Self-healing failed: ${error.message || String(error)}`,
            timestamp: new Date().toISOString()
        });
        return { success: false, error: error.message };
    }
};
exports.telemetryWatcherHandler = telemetryWatcherHandler;
/**
 * Telemetry Watcher - Autonomic Self-Healing Background Agent
 * Listens for firestore rules denials, runtime crashes, or API warnings,
 * and generates self-healing patches using Gemini AI.
 */
exports.telemetryWatcher = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).firestore
    .document('telemetryLogs/{logId}')
    .onCreate(exports.telemetryWatcherHandler);
//# sourceMappingURL=telemetryWatcher.js.map