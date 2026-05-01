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
exports.analyzeRFPWithAI = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const aiAgent_1 = require("./aiAgent");
const executeWithRetry = async (operation, maxRetries = 3, baseDelayMs = 1500) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await operation();
        }
        catch (error) {
            attempt++;
            if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota") || error?.message?.includes("overloaded")) {
                if (attempt >= maxRetries)
                    throw error;
                const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            else {
                throw error;
            }
        }
    }
};
exports.analyzeRFPWithAI = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const { files } = data; // Array of { data: base64, mimeType: string }
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'File data is required.');
    }
    try {
        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data();
        const organizationId = userData?.organizationId || userData?.orgId;
        const apiKey = await (0, aiAgent_1.getGeminiApiKey)(organizationId);
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
        const parts = [{
                text: `You are an expert construction estimator. Analyze the provided RFP document(s). 
Extract the following information in strict JSON format: 
{ "title": "A short, descriptive title of the project", "description": "A comprehensive summary of the scope of work and deliverables", "trade": "The primary trade category (HVAC, Plumbing, Electrical, General Contracting, Roofing, Landscaping, or Other)", "location": "The city/state or zip code", "budgetRange": "The stated or implied budget range if available, otherwise empty string", "dueDate": "The deadline for proposal submission in YYYY-MM-DD format, or empty string" }
If you cannot find a value, use reasonable defaults or empty strings.
Only return the raw JSON object, no markdown blocks.`
            }];
        for (const file of files) {
            const cleanBase64 = file.data.replace(/^data:.*?;base64,/, "");
            parts.push({
                inlineData: { data: cleanBase64, mimeType: file.mimeType || "application/pdf" }
            });
        }
        const result = await executeWithRetry(() => model.generateContent(parts));
        let responseText = result.response.text().trim();
        if (responseText.startsWith('```json')) {
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        else if (responseText.startsWith('```')) {
            responseText = responseText.replace(/```/g, '').trim();
        }
        const parsed = JSON.parse(responseText);
        return { success: true, data: parsed };
    }
    catch (error) {
        console.error("RFP OCR Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to analyze RFP.');
    }
});
//# sourceMappingURL=rfpAgent.js.map