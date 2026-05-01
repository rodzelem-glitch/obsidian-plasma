import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey } from "./aiAgent";

const executeWithRetry = async (operation: () => Promise<any>, maxRetries = 3, baseDelayMs = 1500) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await operation();
        } catch (error: any) {
            attempt++;
            if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota") || error?.message?.includes("overloaded")) {
                if (attempt >= maxRetries) throw error;
                const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
};

export const analyzeRFPWithAI = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    const { files } = data; // Array of { data: base64, mimeType: string }
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'File data is required.');
    }

    try {
        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data();
        const organizationId = userData?.organizationId || userData?.orgId;
        const apiKey = await getGeminiApiKey(organizationId);
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

        const parts: any[] = [{
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
        } else if (responseText.startsWith('```')) {
            responseText = responseText.replace(/```/g, '').trim();
        }

        const parsed = JSON.parse(responseText);
        return { success: true, data: parsed };
    } catch (error: any) {
        console.error("RFP OCR Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to analyze RFP.');
    }
});
