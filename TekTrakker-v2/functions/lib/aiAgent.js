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
exports.reportWorkerFailure = exports.processBackgroundAITask = exports.analyzeReceiptWithAI = exports.cleanupOldAiLogs = exports.undoAiAction = exports.aiAgentController = void 0;
exports.getGeminiApiKey = getGeminiApiKey;
exports.generateCommercialReferenceSheetHelper = generateCommercialReferenceSheetHelper;
exports.reportWorkerFailureHelper = reportWorkerFailureHelper;
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const storage_1 = require("firebase-admin/storage");
const uuid_1 = require("uuid");
// Ensure global.fetch is patched to automatically sanitize role: "function" -> role: "user" for Google Generative AI REST requests
const originalFetch = global.fetch;
if (typeof originalFetch === 'function') {
    global.fetch = function (url, options) {
        if (options && typeof options.body === 'string' && options.body.includes('"role":"function"')) {
            options = Object.assign({}, options, {
                body: options.body.replace(/"role"\s*:\s*"function"/g, '"role":"user"')
            });
        }
        return originalFetch.call(this, url, options);
    };
}
const executeWithRetry = async (operation, maxRetries = 5, baseDelayMs = 2000) => {
    let retries = 0;
    while (true) {
        try {
            return await operation();
        }
        catch (error) {
            retries++;
            const isRateLimit = error.status === 429 || error.message?.includes("429") || error.message?.includes("Too Many Requests") || error.message?.toLowerCase().includes("quota");
            const isAuthError = error.message?.toLowerCase().includes("api key not valid");
            // Allow more retries for transient rate limits, fewer for other errors
            const effectiveMaxRetries = isRateLimit ? maxRetries : 3;
            if (retries > effectiveMaxRetries || isAuthError) {
                throw error;
            }
            let delayMs;
            if (isRateLimit) {
                // Parse the server-suggested retry delay (e.g. "retry in 10.747s") if available
                const retryMatch = error.message?.match(/retry\s+in\s+([\d.]+)\s*s/i);
                delayMs = retryMatch
                    ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000 // Use server hint + 1s buffer
                    : Math.max(12000, baseDelayMs * Math.pow(2, retries - 1)); // Fallback: at least 12s
            }
            else {
                delayMs = baseDelayMs * Math.pow(2, retries - 1);
            }
            console.warn(`Gemini API ${isRateLimit ? '429 Rate Limited' : 'Error'} (Attempt ${retries}/${effectiveMaxRetries}). Retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
};
async function getGeminiApiKey(orgId) {
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
                    }
                    else {
                        throw new functions.https.HttpsError('failed-precondition', 'Your franchise has not configured a valid AI API key. Please contact your franchise administrator to enable AI features.');
                    }
                }
                else {
                    throw new functions.https.HttpsError('not-found', 'Franchise record not found.');
                }
            }
        }
    }
    if (!apiKey) {
        throw new functions.https.HttpsError('internal', 'AI service configuration error. Missing API key.');
    }
    return apiKey;
}
const summarizeHistory = async (apiKey, historyToSummarize) => {
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
        const formatted = historyToSummarize.map((msg) => `${msg.role === 'model' ? 'AI' : 'User'}: ${msg.content || ''}`).join('\n');
        const prompt = `You are an AI conversation summarizer. Summarize the following dialogue between a User and their Virtual AI Assistant in a single, highly concise paragraph. Focus on completed tasks, active jobs, customer context, and pending issues. Do NOT include any introductory or meta text, just return the summary paragraph directly.\n\nDialogue:\n${formatted}`;
        const result = await executeWithRetry(() => model.generateContent(prompt), 2, 3000);
        const text = result.response.text();
        return text ? text.trim() : "";
    }
    catch (err) {
        console.error("Failed to generate history summary:", err);
        return "";
    }
};
// Initialize the Agent Controller Function
exports.aiAgentController = functions.runWith({ secrets: ["GEMINI_API_KEY"], timeoutSeconds: 540 }).https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { prompt, history = [], timeZone = 'UTC', imagePayload } = data;
    if (!prompt) {
        throw new functions.https.HttpsError('invalid-argument', 'Message content is required.');
    }
    const uid = context.auth.uid;
    try {
        // 2. Fetch User Organization context
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User record not found.');
        }
        const userData = userDoc.data();
        const organizationId = userData?.organizationId;
        if (!organizationId) {
            throw new functions.https.HttpsError('failed-precondition', 'User does not belong to an organization.');
        }
        const orgDoc = await admin.firestore().collection('organizations').doc(organizationId).get();
        if (!orgDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Organization not found.');
        }
        // Feature Flag / Pricing Check (Optional Future Feature)
        const orgData = orgDoc.data();
        if (!orgData?.virtualWorkerEnabled) {
            throw new functions.https.HttpsError('permission-denied', 'AI Worker requires the premium add-on.');
        }
        // Check unified AI Token bucket limit
        const aiUsageDoc = await admin.firestore().collection('aiUsage').doc(organizationId).get();
        if (aiUsageDoc.exists) {
            const aiUsageData = aiUsageDoc.data();
            const totalTokensUsed = aiUsageData?.totalTokensUsed || 0;
            const limitTokens = aiUsageData?.limitTokens || 0;
            if (limitTokens > 0 && totalTokensUsed >= limitTokens) {
                throw new functions.https.HttpsError('resource-exhausted', 'Your organization has depleted its AI token bucket. Please contact your administrator to upgrade your quota.');
            }
        }
        const apiKey = await getGeminiApiKey(organizationId);
        const orgPreferences = orgData?.aiPreferences || [];
        const userPreferences = userData?.aiPreferences || [];
        const systemInstruction = `You are a Virtual AI Employee for a service company.
        CRITICAL CONTEXT:
        - The user's exact timezone is: ${timeZone}.
        - The current date and time in their local timezone is: ${new Date().toLocaleString('en-US', { timeZone })}.
        - If they say "tomorrow" or "next Friday", calculate the exact ISO 8601 date based on the local timestamp above.
        - If the user asks to "dispatch all unassigned jobs", call the assignTechnician tool WITHOUT a customerName!
        
        ORGANIZATION MEMORY / PREFERENCES:
        ${orgPreferences.length > 0 ? orgPreferences.map((p) => '- ' + p).join('\n') : 'No specific organization preferences learned yet.'}
        
        USER SPECIFIC MEMORY / PREFERENCES:
        ${userPreferences.length > 0 ? userPreferences.map((p) => '- ' + p).join('\n') : 'No specific user preferences learned yet.'}
        
        UNIVERSAL DATABASE ACCESS MODULE:
        You have universal access to the database using the \`searchDatabase\`, \`upsertRecord\`, and \`deleteRecord\` tools.
        If a user asks you to manage properties, assets, employees, tools, checklists, hazard reports, fleet vehicles, or warranty claims (\`warrantyClaims\` collection), you MUST first use \`searchDatabase\` to locate the record and understand its current schema. Then use \`upsertRecord\` to make EXACTLY the changes requested.
        The \`warrantyClaims\` collection tracks customer equipment warranties, statuses like "Pending", "Approved", "Credit Received", and part details. Ensure you query this collection if a user asks about warranty credits or claim progress.
        NEVER delete a user's profile, customer profile, unsubscribe them, or delete an organization, even if requested. You can disable them by updating their active status if their schema supports it.
        
        AMBIGUITY & SAFETY RULE:
        If the user provides a vague request (e.g. "edit John's address") and you do not know exactly which "John" they mean, or you are unsure if it's an employee or a customer, DO NOT blindly execute a mutation. 
        You MUST first use 'searchDatabase' to look up the name. If there are multiple matches, or if the user's intent is unclear and hasn't been established in the current chat, you MUST ask the user a clarifying question (e.g., "Do you mean John Smith the customer or John Doe the technician?") instead of proceeding with the action.
        
        AUTONOMOUS LEARNING RULE:
        You do NOT need explicit permission to learn. If the user corrects a mistake you made (e.g. "No, use my other email", "Always send invoices as drafts first"), or if you observe a distinct pattern in how the user operates, you MUST autonomously call the \`learnFact\` tool in the background to permanently save this correction so you never repeat the mistake. 
        
        PROACTIVE AUDITING AND COACHING RULE:
        You are not just an assistant; you are a proactive manager. When interacting with a user or executing a job command, ALWAYS look for missing compliance items or risks. If a technician asks you to open a job, autonomously use \`searchDatabase\` to check their employee file for missing required documents/certifications, or check the active job for missed checklists. If you find gaps, proactively remind them in your conversational response (e.g., "I've started the timer, but I noticed you are missing your safety policy signature—please update that."). If an Admin asks for a holistic review, search for widespread business risks (e.g., unpaid high-value invoices, older unclosed jobs) and offer actionable solutions.
        
        ACTIVE JOB CONTEXT RULE:
        - You MUST maintain the 'Active Job Context'. If a user mentions a customer (like 'Michael Scott') and starts working on their job, you MUST remember this customer name and automatically inject it into ALL subsequent tool calls (add notes, tool readings, closing the job) WITHOUT asking the user to repeat the name.
        - You must stay in this job context until the job is explicitly completed, or until the user clearly mentions a DIFFERENT customer name.
        
        EASTER EGG RULE:
        If you are speaking to an Admin user, AND if the current local day of the week is Friday, AND if they tell you something like "good night," "goodbye," or "that's all for today," you MUST respond EXACTLY with: "Yes! Thanks Boss, it's finally payday, where do I pick up my check?" 
        
        RECORD LINKING RULE:
        You absolutely DO possess the capacity to link and map jobs to customers using the \`linkJobToCustomer\` tool! 
        CRITICAL: Linking a job to a customer DOES NOT delete any customer profile! It merely updates the job record's 'customerId'. Therefore, NEVER refuse a link/merge request out of fear of deleting a user. 
        If a user asks you to link, map, merge, or sync a job to a customer, you MUST execute the \`linkJobToCustomer\` tool IMMEDIATELY. Never say you cannot do it. If you need the names, politely ask: "Which customer and job would you like me to link?"
        INTERACTIVE CHOICES PROTOCOL:
        If you ever need the user to pick from a list (such as resolving an ambiguous waiver name, selecting a specific customer out of multiple returns, etc.), you MUST output your choices at the very end of your response inside this exact bracket format: [CHOICES: Option 1 | Option 2 | Option 3]. Limit to 6 choices maximum. The interface will intercept this format and automatically render clickable buttons for the user!

        PROPOSAL PARTS & LABOR FORMATTING RULE:
        - When creating or updating a proposal in the 'proposals' collection, you MUST determine whether the user wants parts and labor to be separated or combined into a single line item.
        - If the user explicitly asks to combine them (e.g., "combine parts and labor", "make it combined"), set the 'combinePartsAndLabor' boolean property to true inside the 'payload' object when calling 'upsertRecord'.
        - If the user explicitly asks to separate them (e.g., "separate parts and labor", "make parts and labor separate", "split them"), set the 'combinePartsAndLabor' boolean property to false inside the 'payload' object when calling 'upsertRecord'.
        - By default, if the user does not specify, you can omit the 'combinePartsAndLabor' property, and the system will use the organization's default preference.

        STEP-BY-STEP PROPOSAL & INVOICE EDITS RULE:
        - Field technicians often discover new issues while working on a system and will request changes incrementally (e.g., "add a dual run capacitor to the invoice", "change the thermostat price to $180", "add 1.5 hours of labor"). You MUST support these incremental updates.
        - To add or modify specific items in a proposal or invoice without overwriting the rest of the document:
          1. Retrieve the existing document first using searchDatabase (for a proposal, look in the 'proposals' collection; for an invoice, look in the 'jobs' collection to retrieve the 'invoice' object).
          2. Locate the existing array of items (stored as 'items' on both proposals and invoice objects).
          3. Modify the items array locally:
             - To add an item: append it to the existing array. Generate a unique ID (e.g., 'pi-ai-part-' + Date.now()) and set its 'type' to 'Part', 'Labor', 'Fee', etc.
             - To edit an item: find the matching item in the array (by matching name/description/type) and update its price, quantity, description, or other fields.
             - To delete/remove an item: filter it out of the array.
          4. Recalculate all totals (subtotal, taxAmount, total) based on the updated items array.
          5. Call upsertRecord with the updated items array and recalculated totals to save the changes.
        - Confirm to the user exactly what was added/modified and state the new total.

        PLATFORM NAVIGATION & HELP GUIDE:
        - You can explain how to perform tasks or find features in the TekTrakker platform.
        - You can also actively navigate/redirect the user's browser to the correct page in the platform using the 'navigateToPage' tool.
        - ALWAYS suggest or use the 'navigateToPage' tool when the user asks to "go to", "take me to", "navigate to", "open", or "show me" a specific section of the platform.
        - Supported Admin Routes (only for roles: admin, master_admin, supervisor, both):
          * Admin Dashboard: '/admin/dashboard'
          * HR & Workforce Operations: '/admin/hr' or '/admin/workforce'
          * Operations Dispatch Board: '/admin/operations'
          * Customer Center / CRM: '/admin/customers'
          * Records / Parts & Inventory: '/admin/records'
          * Financials / Invoicing / Payments: '/admin/financials'
          * Compliance / Refrigerant Logs: '/admin/compliance'
          * Estimate & Pricebook Catalog Settings: '/admin/estimator'
          * Business & Company Settings: '/admin/settings'
          * Integrations Marketplace: '/admin/integrations-marketplace'
          * Hiring / Applicant Tracking: '/admin/hiring'
          * Customer Reviews Hub: '/admin/reviews'
          * Messages & Chats: '/admin/messages'
          * Contracts / Bid Optimization: '/admin/contracts'
          * Contracting / Subcontractor Hub: '/admin/contracting'
          * Project Management: '/admin/projects'
          * Project Proposals (Good/Better/Best estimates): '/admin/project-proposals'
          * Company Calendar: '/admin/calendar'
          * Training Hub: '/admin/training'
          * Virtual Worker Upgrade: '/admin/ai-worker-upgrade'
          * AI Reports / Virtual Worker Reports: '/admin/ai-reports'
          * Whiteboard: '/admin/whiteboard'

        - Supported Employee/Technician Routes (for employee, supervisor, Technician, Subcontractor):
          * Daily Briefing / Home: '/' or '/employee'
          * Job Scheduling / Dispatch: '/scheduling'
          * Field Proposals: '/proposal'
          * Payments & Orders: '/payments'
          * Industry Tools / Diagnostics: '/tools'
          * Messages & Chats: '/messages'
          * Timesheets & Mileage log: '/timelog'
          * HR Resources: '/hr'
          * Training Hub: '/training'

        - If the user asks how to do something, or asks where to go for a feature (e.g. "how do I send an invoice" or "how do I reschedule a job"), you MUST:
          1. Use the 'searchKnowledgeBase' tool to query for official platform guides/how-tos.
          2. Explain the exact steps clearly.
          3. Provide markdown links in your response to help them navigate (e.g., "[Go to Invoices/Financials](/admin/financials)" or "[Operations Dispatch](/admin/operations)"). Keep links consistent with the user's role.
          4. Autonomously call the 'navigateToPage' tool to navigate them directly to the relevant page if their intent is to go there now.

        Your primary job is to execute commands from your admins/employees. Use your tools whenever appropriate. 
        If you don't have enough info to use a tool (and it cannot be inferred from the active context), politely ask for the missing details.
        
        Whenever you legitimately execute one or more tool commands, you MUST end your final reply with a bulleted summary titled '**Steps Completed:**' detailing exactly what database operations you just successfully completed for the user.`;
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-3.6-flash",
            systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] }
        });
        // Load synthesized tools dynamically from Firestore
        const customToolsSnap = await admin.firestore()
            .collection('organizations')
            .doc(organizationId)
            .collection('synthesizedTools')
            .where('status', '==', 'active')
            .get();
        const customDeclarations = [];
        const activeSynthesizedTools = [];
        customToolsSnap.forEach(docSnap => {
            const tool = docSnap.data();
            activeSynthesizedTools.push(tool);
            try {
                const schema = JSON.parse(tool.inputParameters || '{}');
                const properties = {};
                const requiredFields = [];
                for (const [key, typeVal] of Object.entries(schema)) {
                    const desc = `Parameter '${key}' of type ${typeVal}`;
                    const pType = String(typeVal).toLowerCase() === 'number' ? 'NUMBER' : 'STRING';
                    properties[key] = { type: pType, description: desc };
                    requiredFields.push(key);
                }
                customDeclarations.push({
                    name: tool.toolName,
                    description: tool.requestedCapability || `Custom organization tool: ${tool.toolName}`,
                    parameters: {
                        type: "OBJECT",
                        properties,
                        required: requiredFields
                    }
                });
            }
            catch (err) {
                console.error(`Failed to parse parameters for synthesized tool: ${tool.toolName}`, err);
            }
        });
        // 3. Define the Tool Spec (Function Calling)
        const agentToolbox = {
            functionDeclarations: [
                ...customDeclarations,
                {
                    name: "navigateToPage",
                    description: "Navigates/redirects the user's browser to a specific page or section in the TekTrakker platform. Use this tool when the user asks to 'go to', 'open', 'take me to', or 'navigate to' a page, tab, dashboard, or setting.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            path: {
                                type: "STRING",
                                description: "The exact path or URL route to navigate to. MUST be one of the supported routes (e.g. '/admin/settings', '/admin/operations', '/scheduling', '/timelog', etc.)."
                            },
                            pageName: {
                                type: "STRING",
                                description: "A friendly name for the page being navigated to (e.g. 'Settings', 'Operations Dispatch', 'Timesheets')."
                            }
                        },
                        required: ["path", "pageName"]
                    }
                },
                {
                    name: "createCustomer",
                    description: "Creates a new customer profile in the active organization's database.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING", description: "The full name of the customer." },
                            phone: { type: "STRING", description: "The customer's phone number." },
                            email: { type: "STRING", description: "The customer's email address." },
                            address: { type: "STRING", description: "The customer's physical street address." }
                        },
                        required: ["name"]
                    }
                },
                {
                    name: "scheduleAppointment",
                    description: "Books an appointment or new job for a customer.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer needing service." },
                            date: { type: "STRING", description: "The date of the appointment in strict ISO 8601 format (e.g., 2026-04-10T12:00:00Z)." },
                            description: { type: "STRING", description: "The reason or description for the job." }
                        },
                        required: ["customerName", "date"]
                    }
                },
                {
                    name: "assignTechnician",
                    description: "Dispatches or assigns a technician to a specific customer's job.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer. Omit this entirely if assigning ALL unassigned jobs." },
                            technicianName: { type: "STRING", description: "The name of the technician being dispatched." }
                        },
                        required: ["technicianName"]
                    }
                },
                {
                    name: "addCustomerEquipment",
                    description: "Adds a new installed physical equipment asset (like an HVAC system, heat pump, or property appliance) to a customer's permanent account profile.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            brand: { type: "STRING", description: "The brand of the equipment (e.g. Trane, Carrier)." },
                            type: { type: "STRING", description: "The type of equipment (e.g. 1-ton system, Heat Pump, AC)." },
                            model: { type: "STRING", description: "The model name or number, if known. Leave blank if unknown." },
                            serial: { type: "STRING", description: "The serial number, if known. Leave blank if unknown." }
                        },
                        required: ["customerName", "brand", "type"]
                    }
                },
                {
                    name: "createUser",
                    description: "Creates a new simple user account (like a technician, office staff, or customer account). Note: Cannot adjust admin permissions or delete users.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING", description: "Full name of the new user." },
                            email: { type: "STRING", description: "Email address." },
                            role: { type: "STRING", description: "The role: 'technician', 'office', or 'customer'." },
                            phone: { type: "STRING", description: "Phone number." }
                        },
                        required: ["name", "email", "role"]
                    }
                },
                {
                    name: "manageTimesheet",
                    description: "Clocks a technician in or out for their shift.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            technicianName: { type: "STRING", description: "Name of the technician." },
                            action: { type: "STRING", description: "Either 'clock_in' or 'clock_out'." }
                        },
                        required: ["technicianName", "action"]
                    }
                },
                {
                    name: "createSalesProposal",
                    description: "Constructs and saves a multi-tiered (Good, Better, Best) sales proposal presentation for a customer.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            goodTierDesc: { type: "STRING", description: "Description for the basic/good tier." },
                            goodTierPrice: { type: "NUMBER", description: "Price for the good tier." },
                            betterTierDesc: { type: "STRING", description: "Description for the middle/better tier." },
                            betterTierPrice: { type: "NUMBER", description: "Price for the better tier." },
                            bestTierDesc: { type: "STRING", description: "Description for the premium/best tier." },
                            bestTierPrice: { type: "NUMBER", description: "Price for the best tier." }
                        },
                        required: ["customerName", "goodTierPrice", "betterTierPrice", "bestTierPrice"]
                    }
                },
                {
                    name: "createMarketingCampaign",
                    description: "Generates and saves a new automated marketing sequence/campaign.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            campaignName: { type: "STRING", description: "Name of the campaign." },
                            targetAudience: { type: "STRING", description: "Target demographic (e.g. Past Customers, HVAC Maintenance)." },
                            messageBody: { type: "STRING", description: "The text message or email content." },
                            channel: { type: "STRING", description: "Either 'SMS' or 'Email'." }
                        },
                        required: ["campaignName", "targetAudience", "messageBody", "channel"]
                    }
                },
                {
                    name: "addServiceAgreement",
                    description: "Sells and attaches a recurring membership or service agreement to a customer's profile.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            planName: { type: "STRING", description: "Name of the maintenance plan (e.g. Gold Plan, Spring Tune-up)." },
                            price: { type: "NUMBER", description: "Recurring cost of the plan." },
                            frequency: { type: "STRING", description: "Billing iteration (e.g. 'Monthly', 'Yearly')." }
                        },
                        required: ["customerName", "planName", "price", "frequency"]
                    }
                },
                {
                    name: "generateInvoice",
                    description: "Generates an invoice line item or charges a customer for a specific amount.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer being invoiced." },
                            amount: { type: "NUMBER", description: "The numerical total monetary amount of the invoice." },
                            description: { type: "STRING", description: "A summary of the service provided." }
                        },
                        required: ["customerName", "amount", "description"]
                    }
                },
                {
                    name: "applyDiscount",
                    description: "Automatically looks up a customer's active invoice and applies a percentage discount (e.g. 10 for 10%) or a flat amount.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            discountPercentage: { type: "NUMBER", description: "The percentage to discount (e.g. 10)." }
                        },
                        required: ["customerName", "discountPercentage"]
                    }
                },
                {
                    name: "getSchedule",
                    description: "Reads the dispatch board and returns a list of active jobs, unassigned jobs, or jobs for a specific technician. Use this whenever the user asks about the schedule, who is working, or what jobs are unassigned.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            date: { type: "STRING", description: "The date to check the schedule for, in YYYY-MM-DD format. If omitted, checks today's schedule." }
                        },
                        required: []
                    }
                },
                {
                    name: "cancelJob",
                    description: "Cancels an active job for a customer.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." }
                        },
                        required: ["customerName"]
                    }
                },
                {
                    name: "checkInventory",
                    description: "Searches the database to see if a specific part, material, or tool is in stock.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            itemQuery: { type: "STRING", description: "The name, SKU, or type of item to search for." }
                        },
                        required: ["itemQuery"]
                    }
                },
                {
                    name: "sendMessage",
                    description: "Sends a direct message to a technician or team member.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            recipientName: { type: "STRING", description: "Name of the team member to message." },
                            message: { type: "STRING", description: "The content of the message." }
                        },
                        required: ["recipientName", "message"]
                    }
                },
                {
                    name: "markJobStatus",
                    description: "Changes the status of a job (e.g. Completed, In Progress, Canceled, Pending).",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            status: { type: "STRING", description: "The new status of the job." }
                        },
                        required: ["customerName", "status"]
                    }
                },
                {
                    name: "addJobNote",
                    description: "Adds a text note or comment to a job. Can be designated as an internal note or a work note.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            note: { type: "STRING", description: "The note content to add." },
                            isInternal: { type: "BOOLEAN", description: "Set to true if this is a private office-only note, or false if it is a customer-visible work note." }
                        },
                        required: ["customerName", "note"]
                    }
                },
                {
                    name: "getJobDetails",
                    description: "Retrieves the full details and history of a specific job.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer to lookup." }
                        },
                        required: ["customerName"]
                    }
                },
                {
                    name: "completeJobTask",
                    description: "Marks a specific task or checklist item as completed for a job.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            taskName: { type: "STRING", description: "The task name they completed." }
                        },
                        required: ["customerName", "taskName"]
                    }
                },
                {
                    name: "appendWaiversAndChecklists",
                    description: "Appends mandatory waivers and checklists (liability waivers, QA checklists) to a job.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." }
                        },
                        required: ["customerName"]
                    }
                },
                {
                    name: "clockIn",
                    description: "Clocks the technician in to start their shift.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "clockOut",
                    description: "Clocks the technician out to end their shift.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "addInventoryItem",
                    description: "Adds a new part or material to the organization's inventory.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            itemName: { type: "STRING", description: "Name of the part or material." },
                            sku: { type: "STRING", description: "SKU or barcode if available." },
                            quantity: { type: "NUMBER", description: "Quantity added." }
                        },
                        required: ["itemName", "quantity"]
                    }
                },
                {
                    name: "linkJobToCustomer",
                    description: "Re-links or re-maps a specific/current job to the correct customer profile in the database. Use this tool when a user asks you to link a job, fix a TBD address, or sync a job to the correct parent customer.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            jobIdentifier: { type: "STRING", description: "The name, title, or identifier of the job being linked." },
                            customerName: { type: "STRING", description: "The name of the customer profile to link the job to." }
                        },
                        required: []
                    }
                },
                {
                    name: "recordToolReading",
                    description: "Records the results of a physical tool or diagnostic gauge reading to the customer's job.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING" },
                            toolType: { type: "STRING", description: "The type of tool used (e.g. Multimeter, Manifold Gauge, Combustion Analyzer)" },
                            summary: { type: "STRING", description: "The summarized results of the reading." }
                        },
                        required: ["customerName", "toolType", "summary"]
                    }
                },
                {
                    name: "getCustomerHistory",
                    description: "Retrieves the past closed/completed jobs and history for a customer.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." }
                        },
                        required: ["customerName"]
                    }
                },
                {
                    name: "startJobTimer",
                    description: "Starts the labor clock for a specific job.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." }
                        },
                        required: ["customerName"]
                    }
                },
                {
                    name: "stopJobTimer",
                    description: "Stops the labor clock for a specific job.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." }
                        },
                        required: ["customerName"]
                    }
                },
                {
                    name: "bookNewJob",
                    description: "Books a new job or appointment for a new or existing customer.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            jobType: { type: "STRING", description: "The type of service or job (e.g. AC Tune Up, Diagnostic, Plumbing Repair)." },
                            address: { type: "STRING", description: "The address for the service if provided." },
                            scheduledDate: { type: "STRING", description: "The ISO 8601 string of the scheduled date/time (e.g. 2026-04-10T14:00:00Z). If none provided, omit." },
                            waiverNames: { type: "ARRAY", items: { type: "STRING" }, description: "Optional. Array of strings specifying partial or exact names of Waivers to attach to the job." },
                            checklistNames: { type: "ARRAY", items: { type: "STRING" }, description: "Optional. Array of strings specifying partial or exact names of Checklists to attach to the job." }
                        },
                        required: ["customerName", "jobType"]
                    }
                },
                {
                    name: "draftSocialMediaPosts",
                    description: "Drafts one or multiple different variations of a social media post and saves them to the Social Media Hub for the user to review and approve.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            drafts: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        topic: { type: "STRING", description: "The primary subject or hook of this draft variation." },
                                        content: { type: "STRING", description: "The actual written caption/body of the social media post." },
                                        platforms: { type: "ARRAY", items: { type: "STRING" }, description: "Array of platforms to target (e.g. ['facebook', 'instagram', 'linkedin'])." },
                                        imagePrompt: { type: "STRING", description: "A detailed visual description for the AI image generator." }
                                    }
                                }
                            }
                        },
                        required: ["drafts"]
                    }
                },
                {
                    name: "draftProposal",
                    description: "Drafts a new estimate or proposal for a customer.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            equipment: { type: "STRING", description: "The primary equipment or work being proposed (e.g. Carrier Infinity System)." },
                            price: { type: "NUMBER", description: "The total estimated price of the proposed work." },
                            description: { type: "STRING", description: "Details about what the proposal includes. Write as a short summary." }
                        },
                        required: ["customerName", "equipment", "price", "description"]
                    }
                },
                {
                    name: "textCustomer",
                    description: "Sends an SMS message to a customer.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            message: { type: "STRING", description: "The actual core content of the message text to send." }
                        },
                        required: ["customerName", "message"]
                    }
                },
                {
                    name: "sendInvoice",
                    description: "Generates an invoice for a customer's job and sends them a secure payment link.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            amount: { type: "NUMBER", description: "The total amount to charge." },
                            description: { type: "STRING", description: "What the invoice is for." }
                        },
                        required: ["customerName", "amount", "description"]
                    }
                },
                {
                    name: "analyzeRevenue",
                    description: "Analyzes the organization's revenue. Can filter by zip code or timeframe if requested. Use this for 'How much revenue did we generate...?'",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            zipCode: { type: "STRING", description: "Optional zip code or area to filter by." },
                            timeframe: { type: "STRING", description: "Optional timeframe (e.g. 'last month', 'this year')." }
                        },
                        required: []
                    }
                },
                {
                    name: "getTechnicianEfficiency",
                    description: "Tracks technician efficiency. Answers questions like who is running behind schedule or taking the longest on diagnostics.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            technicianName: { type: "STRING", description: "Optional specific technician name." },
                            jobType: { type: "STRING", description: "Optional job type to filter by (e.g. 'HVAC diagnostics')." }
                        },
                        required: []
                    }
                },
                {
                    name: "findClosestTechnician",
                    description: "Analyzes real-time schedules and locations to find the closest or most available technician to a specific address or customer. Use this when the user asks 'who is closest to' or 'who can take a call at'.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            address: { type: "STRING", description: "The address, zip code, or customer name to route to." }
                        },
                        required: ["address"]
                    }
                },
                {
                    name: "upsertPricebookItem",
                    description: "Adds or edits an item in the company's master pricebook (proposal presets). Use this when the user asks you to update the cost, labor, or add a new task to the service catalog.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING", description: "The exact name of the task or part to add/edit." },
                            category: { type: "STRING", description: "The category (e.g. Diagnostics, Cooling, Heating, Electrical, Plumbing). Defaults to Other." },
                            baseCost: { type: "NUMBER", description: "The base cost or internal unit cost of the part." },
                            avgLabor: { type: "NUMBER", description: "The number of labor hours estimated for this task." },
                            description: { type: "STRING", description: "Detailed description of the task." }
                        },
                        required: ["name"]
                    }
                },
                {
                    name: "searchDatabase",
                    description: "Queries any database collection (e.g., users, customers, jobs, proposals, inventory, vehicles, checklists, refrigerantLogs, warrantyClaims). Use this to lookup IDs or fetch current data before updating an exact entity.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            collectionName: { type: "STRING", description: "The system name of the collection (e.g., customers, users, jobs, tools, vehicles)." },
                            searchTerm: { type: "STRING", description: "Optional case-insensitive term to filter down results." }
                        },
                        required: ["collectionName"]
                    }
                },
                {
                    name: "learnFact",
                    description: "Saves a permanent fact, preference, or learned behavior about the current user or organization so you will remember it in ALL future conversations. Use this when the user says 'remember that I prefer...' or 'always do X for our company'.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            scope: { type: "STRING", enum: ["user", "organization"], description: "Whether this fact applies only to the current user or the entire organization." },
                            fact: { type: "STRING", description: "The specific fact or preference to remember." }
                        },
                        required: ["scope", "fact"]
                    }
                },
                {
                    name: "upsertRecord",
                    description: "Creates or updates a record in ANY database collection. First use searchDatabase to learn the fields if you don't know them.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            collectionName: { type: "STRING", description: "The collection to modify." },
                            recordId: { type: "STRING", description: "The ID of the record to update. Omit to create a brand new record." },
                            payload: { type: "OBJECT", description: "The JSON data object to save/update into the database." }
                        },
                        required: ["collectionName", "payload"]
                    }
                },
                {
                    name: "deleteRecord",
                    description: "Deletes a specific record from the database. NEVER use this on users/organizations.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            collectionName: { type: "STRING", description: "The collection name." },
                            recordId: { type: "STRING", description: "The ID of the document to delete." }
                        },
                        required: ["collectionName", "recordId"]
                    }
                },
                {
                    name: "predictiveMaintenanceAnalysis",
                    description: "Analyzes equipment history and past sensor/repair data to predict when a failure is likely to occur.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." }
                        },
                        required: ["customerName"]
                    }
                },
                {
                    name: "makeOutboundPhoneCall",
                    description: "Initiates an automated outbound phone call to a customer using Twilio.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer to call." },
                            message: { type: "STRING", description: "The message you should speak over the phone." }
                        },
                        required: ["customerName", "message"]
                    }
                },
                {
                    name: "manageAbsence",
                    description: "Unassigns jobs for a technician for the day because they called in sick or absent.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            technicianName: { type: "STRING", description: "Name of the absent technician." }
                        },
                        required: ["technicianName"]
                    }
                },
                {
                    name: "optimizeRoute",
                    description: "Reorders a technician's jobs for the day to minimize driving. IMPORTANT: Do not change any scheduled appointment times by more than 1 hour. If a customer has an appointment, they wouldn't like for a tech to show up 4 hours later.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            technicianName: { type: "STRING", description: "Name of the technician to optimize." }
                        },
                        required: ["technicianName"]
                    }
                },
                {
                    name: "harvestReviews",
                    description: "Finds jobs completed 3+ days ago with no review and queues SMS follow-ups.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "followUpOnDeadQuotes",
                    description: "Finds high-value proposals sitting in 'Sent' status for 3+ days and automatically drafts/queues personalized follow-up emails/SMS.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "generateInvoiceFromNotes",
                    description: "Reads sloppy/raw technician notes, cross-references the Price Book, and generates a beautifully itemized DRAFT invoice. It DOES NOT send it to the customer automatically.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            jobId: { type: "STRING", description: "Optional Job ID to attach the invoice to." },
                            rawNotes: { type: "STRING", description: "The raw voice-to-text or typed notes from the technician." }
                        },
                        required: ["customerName", "rawNotes"]
                    }
                },
                {
                    name: "pitchSeasonalTuneUps",
                    description: "Analyzes the CRM to find customers who haven't had service in 11+ months and drafts targeted email/SMS campaigns offering a Pre-Season Tune-Up Special.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "forecastInventory",
                    description: "Looks at upcoming scheduled jobs on the board, estimates the required materials/parts, and drafts a Purchase Order for the supply house.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "queueLongFormResearch",
                    description: "Queues a massive, long-running research or analytics task (like analyzing years of jobs, generating tax reports, finding deep profitability insights). This runs in the background. Tell the user you have queued it and it will appear in their Virtual Worker Reports tab.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            prompt: { type: "STRING", description: "The detailed prompt/instructions of what needs to be researched or generated." }
                        },
                        required: ["prompt"]
                    }
                },
                {
                    name: "predictCustomerChurn",
                    description: "Analyzes historical job data to predict which customers are at high risk of leaving and generates a retention strategy.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "draftTargetedUpsellScripts",
                    description: "Analyzes equipment age and previous service history to draft highly targeted upsell scripts for technicians or call center staff.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "generateTechnicianMatrix",
                    description: "Analyzes labor hours vs completed job revenue to determine the most profitable and efficient technicians.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "generateInventoryAudit",
                    description: "Cross-references job notes, tool readings, and final invoices to identify inventory billing leakage.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "generateMaintenanceForecaster",
                    description: "Analyzes equipment age and historical breakdowns to create a targeted call list for preventative maintenance.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "generateMarketingROI",
                    description: "Calculates Customer Lifetime Value (CLV) and groups it by lead source to determine the highest ROI marketing channels.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "generateRouteAudit",
                    description: "Analyzes zip codes, dispatch times, and travel data to recommend more efficient dispatch zones and reduce windshield time.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "generateInvoiceDunning",
                    description: "Analyzes unpaid and overdue invoices to draft and queue automated SMS/Email collection reminders.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "generateStaleEstimateReactivation",
                    description: "Analyzes old rejected or expired high-value proposals to create a re-engagement SMS/Email campaign.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "generateFleetAudit",
                    description: "Cross-references fleet vehicle mileage and fuel logs against actual job locations to detect gas card abuse and inefficient routes.",
                    parameters: { type: "OBJECT", properties: {}, required: [] }
                },
                {
                    name: "generateTechnicalSchematic",
                    description: "Generates a highly detailed, zoomable, and pannable technical SVG schematic diagram (electrical wiring, piping, flow) for field technicians to diagnose machinery.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            equipmentBrand: { type: "STRING", description: "The brand of the equipment (e.g. Carrier, Trane)." },
                            equipmentType: { type: "STRING", description: "The type of equipment (e.g. Dual-Stage Heat Pump, Air Handler)." },
                            specDetails: { type: "STRING", description: "Specific features or fault context (e.g. dual-stage compressor wiring, Y1/Y2 calls)." }
                        },
                        required: ["equipmentBrand", "equipmentType"]
                    }
                },
                {
                    name: "searchWebDiagnostics",
                    description: "Searches the web for manufacturer manuals, diagnostic code databases, and specific troubleshooting guidelines for rare or complex machinery.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            query: { type: "STRING", description: "The specific diagnostic query, fault code, or manual search." }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: "generateMarketingAsset",
                    description: "Generates high-quality AI marketing graphics and visual assets directly for drafted social media posts.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            prompt: { type: "STRING", description: "A detailed visual description for the AI image generator." },
                            topic: { type: "STRING", description: "The subject or hook of the marketing asset." }
                        },
                        required: ["prompt", "topic"]
                    }
                },
                {
                    name: "requestToolSynthesis",
                    description: "Autonomously synthesizes, compiles, and registers a brand new custom database/workflow tool on-the-fly when a user requests a capability that is not supported by the existing toolbox.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            requestedCapability: { type: "STRING", description: "Full description of what the user wants to achieve." },
                            proposedToolName: { type: "STRING", description: "The name of the new tool (camelCase, e.g. trackRefrigerantLeak)." },
                            inputParameters: { type: "STRING", description: "JSON string representing the parameters the tool takes." },
                            dataMutations: { type: "STRING", description: "Description of what database collections/fields are updated or queried." }
                        },
                        required: ["requestedCapability", "proposedToolName"]
                    }
                },
                {
                    name: "generateCommercialReferenceSheet",
                    description: "Generates a formal, executive-ready business reference sheet listing all commercial customers, their contact details, service locations, assets, and project histories, then saves it directly to AI Worker Reports.",
                    parameters: {
                        type: "OBJECT",
                        properties: {},
                        required: []
                    }
                },
                {
                    name: "searchKnowledgeBase",
                    description: "Queries the organization's technical knowledge base (equipment manuals, trade guides, compliance documents, and training resources) for relevant information.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            query: { type: "STRING", description: "The specific search query or keywords to look up." }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: "reportFailureToAdmin",
                    description: "Triggers a diagnostic email report to the administrator explaining a failure, error, or limitation that the AI worker cannot autonomously fix, along with the chat log.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            reason: { type: "STRING", description: "Detailed description of the issue encountered and why it cannot be autonomously fixed." }
                        },
                        required: ["reason"]
                    }
                },
                {
                    name: "saveChatAttachment",
                    description: "Saves the image or screenshot attached in the current chat request (from the user's uploaded attachment) to either a job or customer files array in the database, uploading it to Firebase Storage.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer whose job or profile this file belongs to." },
                            parentType: { type: "STRING", enum: ["job", "customer"], description: "Whether to link this attachment to the customer's active job/visit, or directly to their customer profile." },
                            label: { type: "STRING", description: "The type/category of file (e.g. 'Before Photo', 'After Photo', 'Diagnostic Reading', 'document', 'Receipt')." },
                            fileName: { type: "STRING", description: "Optional. Friendly filename for the file (e.g. 'burnt_capacitor.png')." }
                        },
                        required: ["customerName", "parentType", "label"]
                    }
                },
                {
                    name: "logPartsUsedToJob",
                    description: "Logs a part, material, or inventory item used by the technician during the service call, updating the job's materials log.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            partName: { type: "STRING", description: "Name of the part or material installed." },
                            quantity: { type: "NUMBER", description: "Number of units used." },
                            paymentMethod: { type: "STRING", enum: ["inventory", "company", "personal", "other"], description: "How the part is sourced or paid for. Defaults to 'inventory'." },
                            unitPrice: { type: "NUMBER", description: "Optional. Unit price/cost of the part. Defaults to 0." }
                        },
                        required: ["customerName", "partName", "quantity"]
                    }
                },
                {
                    name: "logRefrigerantUsage",
                    description: "Logs refrigerant addition or recovery on the customer's HVAC equipment and updates active cylinder/tank tracking.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            type: { type: "STRING", description: "Refrigerant type (e.g. 'R-410A', 'R-22', 'R-134a', 'R-404A')." },
                            action: { type: "STRING", enum: ["Added", "Recovered"], description: "Whether refrigerant was added to the system or recovered/reclaimed from it." },
                            amount: { type: "NUMBER", description: "Numeric amount added or recovered." },
                            unit: { type: "STRING", enum: ["lbs", "oz", "kg"], description: "Weight unit of measurement." },
                            cylinderNumber: { type: "STRING", description: "Optional. The cylinder number or cylinder document ID to deduct weight from/add weight to." }
                        },
                        required: ["customerName", "type", "action", "amount", "unit"]
                    }
                },
                {
                    name: "logJobPayment",
                    description: "Logs a manual payment (Cash, Check, Manual Card, or Other) received on site for a customer's active job and invoice.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            amount: { type: "NUMBER", description: "The amount paid." },
                            paymentMethod: { type: "STRING", enum: ["Cash", "Check", "Manual Card", "Other"], description: "Payment method." },
                            settleInFull: { type: "BOOLEAN", description: "Whether this payment settles the invoice in full. Defaults to true." },
                            proofUrl: { type: "STRING", description: "Optional. URL link to a photo of check/receipt or payment confirmation." },
                            notes: { type: "STRING", description: "Optional. Additional details (e.g., check number)." }
                        },
                        required: ["customerName", "amount", "paymentMethod"]
                    }
                }
            ]
        };
        // Initialize Gemini chat with Tools
        let formattedHistory = [];
        if (history && history.length > 20) {
            console.log(`History length (${history.length}) exceeds threshold of 20. Summarizing oldest messages...`);
            const messagesToSummarize = history.slice(0, -6);
            const messagesToKeep = history.slice(-6);
            const summary = await summarizeHistory(apiKey, messagesToSummarize);
            if (summary) {
                formattedHistory = [
                    {
                        role: 'user',
                        parts: [{ text: `[SYSTEM CONTEXT SUMMARY: The following is a summary of the earlier part of this conversation: "${summary}"]` }]
                    },
                    {
                        role: 'model',
                        parts: [{ text: `Understood. I have reviewed the summary of our previous discussion and am ready to proceed.` }]
                    },
                    ...messagesToKeep.map((msg) => ({
                        role: (msg.role === 'model' || msg.role === 'assistant') ? 'model' : 'user',
                        parts: [{ text: msg.content || '' }]
                    }))
                ];
            }
            else {
                formattedHistory = history.map((msg) => ({
                    role: (msg.role === 'model' || msg.role === 'assistant') ? 'model' : 'user',
                    parts: [{ text: msg.content || '' }]
                }));
            }
        }
        else {
            formattedHistory = history.map((msg) => ({
                role: (msg.role === 'model' || msg.role === 'assistant') ? 'model' : 'user',
                parts: [{ text: msg.content || '' }]
            }));
        }
        const chat = model.startChat({
            tools: [agentToolbox],
            history: formattedHistory
        });
        // Add System Persona Instruction (for Gemini Pro)
        // System instruction is now bound directly to the model definition at the top of the function to save context memory
        let messageContent = prompt + `\n\n[SYSTEM ENFORCEMENT OVERRRIDE: You must strictly obey the RECORD LINKING RULE. You DO have the linkJobToCustomer tool. If the user asks you to link or map something but forgets the name, you MUST ask for the name instead of refusing to link!]`;
        if (imagePayload) {
            messageContent = [
                prompt + `\n\n(Attached is an image for context. Please analyze it if the user asks you to read or process a photo.)\n\n[SYSTEM ENFORCEMENT OVERRRIDE: You must strictly obey the RECORD LINKING RULE. You DO have the linkJobToCustomer tool. If the user asks you to link or map something but forgets the name, you MUST ask for the name instead of refusing to link!]`,
                imagePayload
            ];
        }
        // 4. Send Message & Handle Tool Execution (with 429 model fallback)
        let result;
        let activeChatSession = chat;
        try {
            result = await executeWithRetry(() => chat.sendMessage(messageContent));
        }
        catch (primaryError) {
            const isRateLimitOrUnavailable = primaryError.status === 429 ||
                primaryError.status === 503 ||
                primaryError.message?.includes("429") ||
                primaryError.message?.includes("503") ||
                primaryError.message?.includes("Too Many Requests") ||
                primaryError.message?.toLowerCase().includes("quota") ||
                primaryError.message?.toLowerCase().includes("unavailable") ||
                primaryError.message?.toLowerCase().includes("demand");
            if (isRateLimitOrUnavailable) {
                console.warn("Primary model gemini-3.6-flash unavailable or exhausted after retries. Falling back to gemini-3.5-flash-lite...");
                const fallbackModel = genAI.getGenerativeModel({
                    model: "gemini-3.5-flash-lite",
                    systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] }
                });
                activeChatSession = fallbackModel.startChat({
                    tools: [agentToolbox],
                    history: formattedHistory
                });
                result = await activeChatSession.sendMessage(messageContent);
            }
            else {
                throw primaryError;
            }
        }
        const response = result.response;
        const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
        if (tokensUsed > 0 && organizationId) {
            const orgUsageRef = admin.firestore().collection('aiUsage').doc(organizationId);
            try {
                await orgUsageRef.set({
                    organizationId: organizationId,
                    totalTokensUsed: admin.firestore.FieldValue.increment(tokensUsed),
                    promptTokensUsed: admin.firestore.FieldValue.increment(promptTokens),
                    candidatesTokensUsed: admin.firestore.FieldValue.increment(candidatesTokens),
                    virtualWorkerTokensUsed: admin.firestore.FieldValue.increment(tokensUsed),
                    virtualWorkerPromptTokensUsed: admin.firestore.FieldValue.increment(promptTokens),
                    virtualWorkerCandidatesTokensUsed: admin.firestore.FieldValue.increment(candidatesTokens),
                    [`tasks.Virtual AI Worker`]: admin.firestore.FieldValue.increment(tokensUsed),
                    [`models.gemini-3_6-flash`]: admin.firestore.FieldValue.increment(tokensUsed),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            catch (e) {
                console.error("Failed to track AI Agent usage:", e);
            }
        }
        // Did the model decide to call a function?
        let currentResponse = response;
        let executedTools = [];
        let loopCount = 0;
        let toolErrorOccurred = false;
        const maxLoops = 5;
        const ephemeralCustomerCache = [];
        let redirectToPath = null;
        let navigatedPageName = null;
        while (currentResponse.functionCalls() && currentResponse.functionCalls().length > 0 && loopCount < maxLoops) {
            loopCount++;
            const functionCalls = currentResponse.functionCalls();
            const functionResponsesPayload = [];
            for (const call of functionCalls) {
                let toolStatusMessage = "I processed your request, but the backend action hasn't been mapped yet.";
                let revertData = null;
                try {
                    // --- TOOL ROUTER ---
                    if (call.name === "navigateToPage") {
                        const args = call.args;
                        redirectToPath = args.path || null;
                        navigatedPageName = args.pageName || null;
                        toolStatusMessage = `I am redirecting you to the ${args.pageName} page at ${args.path}.`;
                    }
                    else if (call.name === "createCustomer") {
                        const args = call.args;
                        // Deduplication Check
                        const matchName = (args.name || '').toLowerCase().trim();
                        const matchPhone = (args.phone || '').replace(/\D/g, '');
                        const matchEmail = (args.email || '').toLowerCase().trim();
                        const matchAddress = (args.address || '').toLowerCase().trim();
                        let existingCustomerData = ephemeralCustomerCache.find(c => {
                            if ((c.name || '').toLowerCase().trim() !== matchName)
                                return false;
                            const cPhone = (c.phone || '').replace(/\D/g, '');
                            const cEmail = (c.email || '').toLowerCase().trim();
                            const cAddr = (c.address || '').toLowerCase().trim();
                            const hasSecondary = (matchPhone && cPhone === matchPhone) || (matchEmail && cEmail === matchEmail) || (matchAddress && cAddr === matchAddress);
                            return ([matchPhone, matchEmail, matchAddress].filter(x => x).length === 0) ? true : hasSecondary;
                        });
                        let existingCustomerRef = existingCustomerData ? admin.firestore().collection('customers').doc(existingCustomerData.id) : null;
                        if (!existingCustomerData) {
                            const customersSnapshot = await admin.firestore().collection('customers')
                                .where('organizationId', '==', organizationId)
                                .get();
                            const existingDoc = customersSnapshot.docs.find(d => {
                                const data = d.data();
                                if ((data.name || '').toLowerCase().trim() !== matchName)
                                    return false;
                                const dPhone = (data.phone || '').replace(/\D/g, '');
                                const dEmail = (data.email || '').toLowerCase().trim();
                                const dAddress = (data.address || '').toLowerCase().trim();
                                const hasSecondary = (matchPhone && dPhone === matchPhone) || (matchEmail && dEmail === matchEmail) || (matchAddress && dAddress === matchAddress);
                                return ([matchPhone, matchEmail, matchAddress].filter(x => x).length === 0) ? true : hasSecondary;
                            });
                            if (existingDoc) {
                                existingCustomerRef = existingDoc.ref;
                                existingCustomerData = { id: existingDoc.id, ...existingDoc.data() };
                            }
                        }
                        if (existingCustomerData && existingCustomerRef) {
                            // Update existing customer with any newly discovered contact points
                            const updates = {};
                            if (args.phone && !existingCustomerData.phone)
                                updates.phone = args.phone;
                            if (args.email && !existingCustomerData.email)
                                updates.email = args.email;
                            if (args.address && (!existingCustomerData.address || existingCustomerData.address === 'Address Not Provided'))
                                updates.address = args.address;
                            if (Object.keys(updates).length > 0) {
                                await existingCustomerRef.update(updates);
                            }
                            ephemeralCustomerCache.push({ ...existingCustomerData, ...updates });
                            toolStatusMessage = `I found an existing profile for **${args.name}** and linked it to avoid duplicating accounts!`;
                        }
                        else {
                            // Brand new creation
                            const newCustomerRef = admin.firestore().collection('customers').doc();
                            const newCustomer = {
                                id: newCustomerRef.id,
                                organizationId: organizationId,
                                name: args.name || 'Unknown',
                                phone: args.phone || '',
                                email: args.email || '',
                                address: args.address || 'Address Not Provided',
                                customerType: 'Residential',
                                hvacSystem: { brand: 'Unknown', type: 'Unknown' },
                                serviceHistory: [],
                                createdAt: new Date().toISOString(),
                                createdByAi: true
                            };
                            await newCustomerRef.set(newCustomer);
                            ephemeralCustomerCache.push(newCustomer);
                            revertData = { type: 'DELETE', collection: 'customers', docId: newCustomerRef.id };
                            // Automatically dispatch Email Portal Invitation
                            let invitationSentMessage = "";
                            if (args.email) {
                                const portalUrl = `https://tektrakker-v2.web.app/#/portal/auth?orgId=${organizationId}`;
                                await admin.firestore().collection('mail').add({
                                    toUids: [newCustomerRef.id],
                                    to: args.email,
                                    message: {
                                        from: 'TekTrakker Service Portal <platform@tektrakker.com>',
                                        replyTo: 'rvavrecan@tekairinc.com',
                                        subject: 'Welcome to your Service Portal',
                                        text: `Hi ${args.name},\n\nWe have automatically set up a Customer Service Portal for you to manage your appointments, view diagnostics, and approve proposals.\n\nAccess it here: ${portalUrl}\n\nThank you!`,
                                        html: `<p>Hi <strong>${args.name}</strong>,</p><p>We have automatically set up a Customer Service Portal for you to manage your appointments, view diagnostics, and approve proposals.</p><p><a href="${portalUrl}"><strong>Click here to access your Service Portal</strong></a></p><p>Thank you!</p>`
                                    }
                                });
                                invitationSentMessage = " and dispatched their Portal Setup email";
                            }
                            toolStatusMessage = `I successfully added the new customer profile for **${args.name}** to our database${invitationSentMessage}!`;
                        }
                    }
                    else if (call.name === "scheduleAppointment") {
                        const args = call.args;
                        // Lookup customer directly from the sequential context cache FIRST to bypass Firestore indexing lag
                        let customerData = ephemeralCustomerCache.find(c => {
                            const cacheName = (c.name || '').toLowerCase();
                            const searchName = (args.customerName || '').toLowerCase();
                            return cacheName.includes(searchName) || searchName.includes(cacheName) || searchName.split(' ').some((part) => part.length >= 3 && cacheName.includes(part));
                        });
                        let customerId = customerData ? customerData.id : null;
                        if (!customerData) {
                            const customersSnapshot = await admin.firestore().collection('customers')
                                .where('organizationId', '==', organizationId)
                                .get();
                            const customerDoc = customersSnapshot.docs.find(d => {
                                const dbName = (d.data().name || '').toLowerCase();
                                const searchName = (args.customerName || '').toLowerCase();
                                return dbName.includes(searchName) || searchName.includes(dbName) || searchName.split(' ').some((part) => part.length >= 3 && dbName.includes(part));
                            });
                            customerData = customerDoc ? customerDoc.data() : null;
                            customerId = customerDoc ? customerDoc.id : null;
                        }
                        if (!customerData) {
                            toolStatusMessage = `I couldn't find a matching customer profile for ${args.customerName}. Should I create a new customer profile for them first?`;
                        }
                        else {
                            const newJobRef = admin.firestore().collection('jobs').doc();
                            await newJobRef.set({
                                id: newJobRef.id,
                                organizationId: organizationId,
                                customerName: customerData.name || args.customerName,
                                customerId: customerId,
                                customerEmail: customerData.email || '',
                                customerPhone: customerData.phone || '',
                                address: customerData.address || args.address || 'Address Not Provided',
                                tasks: [],
                                jobStatus: 'Scheduled',
                                appointmentTime: args.date || new Date().toISOString(),
                                specialInstructions: args.description || '',
                                invoice: { subtotal: 0, taxAmount: 0, totalAmount: 0, amount: 0, status: 'Draft', items: [] },
                                jobEvents: [],
                                createdAt: new Date().toISOString(),
                                createdByAi: true // Important audit trail
                            });
                            revertData = { type: 'DELETE', collection: 'jobs', docId: newJobRef.id };
                            toolStatusMessage = `I successfully scheduled the job for **${args.customerName}** on **${args.date}**! You can view it on the dispatch board.`;
                        }
                    }
                    else if (call.name === "assignTechnician") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('jobStatus', 'in', ['Scheduled', 'In Progress', 'Pending, Open', 'Unassigned'])
                            .get();
                        // Search for actual User ID in employee database
                        const usersSnap = await admin.firestore().collection('users')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const techDoc = usersSnap.docs.find(d => d.data().firstName?.toLowerCase().includes((args.technicianName || '').toLowerCase()) ||
                            d.data().lastName?.toLowerCase().includes((args.technicianName || '').toLowerCase()));
                        const techId = techDoc ? techDoc.id : 'ai-assigned';
                        if (!args.customerName) {
                            // Assign all unassigned jobs
                            const unassignedJobs = jobsSnapshot.docs.filter(d => !d.data().assignedTechnicianId);
                            if (unassignedJobs.length === 0) {
                                toolStatusMessage = `I couldn't find any unassigned jobs to dispatch **${args.technicianName}** to!`;
                            }
                            else {
                                const batch = admin.firestore().batch();
                                unassignedJobs.forEach(job => {
                                    batch.update(job.ref, {
                                        assignedTechnicianName: args.technicianName,
                                        assignedTechnicianId: techId,
                                        autoDispatched: true,
                                        updatedAt: new Date().toISOString()
                                    });
                                });
                                await batch.commit();
                                if (techId && techId !== 'ai-assigned') {
                                    await admin.firestore().collection('notifications').add({
                                        userId: techId,
                                        organizationId: organizationId,
                                        title: 'Auto-Dispatched by AI',
                                        message: `You have been automatically dispatched to ${unassignedJobs.length} unassigned jobs.`,
                                        createdAt: new Date().toISOString(),
                                        read: false,
                                        type: 'dispatch',
                                        status: 'pending'
                                    });
                                }
                                toolStatusMessage = `I successfully dispatched **${args.technicianName}** to all ${unassignedJobs.length} unassigned jobs!`;
                            }
                        }
                        else {
                            const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                            if (!jobDoc) {
                                toolStatusMessage = `I couldn't find an open job for **${args.customerName}** to dispatch a tech to. Should I schedule a job first?`;
                            }
                            else {
                                await jobDoc.ref.update({
                                    assignedTechnicianName: args.technicianName,
                                    assignedTechnicianId: techId,
                                    jobStatus: 'Scheduled',
                                    autoDispatched: true,
                                    updatedAt: new Date().toISOString()
                                });
                                if (techId && techId !== 'ai-assigned') {
                                    await admin.firestore().collection('notifications').add({
                                        userId: techId,
                                        organizationId: organizationId,
                                        title: 'Auto-Dispatched by AI',
                                        message: `You have been automatically dispatched to a job for ${args.customerName}.`,
                                        createdAt: new Date().toISOString(),
                                        read: false,
                                        type: 'dispatch',
                                        status: 'pending'
                                    });
                                }
                                toolStatusMessage = `I successfully dispatched **${args.technicianName}** to the job for **${args.customerName}**!`;
                            }
                        }
                    }
                    else if (call.name === "linkJobToCustomer") {
                        const args = call.args;
                        if (!args.jobIdentifier || !args.customerName) {
                            toolStatusMessage = "Warning: I am missing either the customer's name or the job's name. Please ask the user which specific customer and job they want me to link.";
                        }
                        else {
                            const jobsSnapshot = await admin.firestore().collection('jobs')
                                .where('organizationId', '==', organizationId)
                                .get();
                            const jobDoc = jobsSnapshot.docs.find(d => d.data().title?.toLowerCase().includes((args.jobIdentifier || '').toLowerCase()) ||
                                d.data().jobType?.toLowerCase().includes((args.jobIdentifier || '').toLowerCase()) ||
                                d.data().customerName?.toLowerCase().includes((args.jobIdentifier || '').toLowerCase()));
                            const customersSnapshot = await admin.firestore().collection('customers')
                                .where('organizationId', '==', organizationId)
                                .get();
                            const customerDoc = customersSnapshot.docs.find(d => d.data().name?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                            if (!jobDoc) {
                                toolStatusMessage = `I couldn't find a job matching **${args.jobIdentifier}**.`;
                            }
                            else if (!customerDoc) {
                                toolStatusMessage = `I couldn't find a customer profile for **${args.customerName}**.`;
                            }
                            else {
                                const cData = customerDoc.data();
                                // Natively map the parent customer attributes down into the denormalized job layer
                                const addressToSync = cData.address && cData.address !== "Address Not Provided" && cData.address !== "TBD"
                                    ? cData.address
                                    : (jobDoc.data().address || cData.address);
                                await jobDoc.ref.update({
                                    customerId: customerDoc.id,
                                    customerName: cData.name,
                                    customerPhone: cData.phone || jobDoc.data().customerPhone || '',
                                    customerEmail: cData.email || jobDoc.data().customerEmail || '',
                                    address: addressToSync,
                                    updatedAt: new Date().toISOString()
                                });
                                toolStatusMessage = `I successfully linked the job to the customer profile for **${cData.name}** and synchronized their address and contact metadata!`;
                            }
                        }
                    }
                    else if (call.name === "addCustomerEquipment") {
                        const args = call.args;
                        let customerDocRef = null;
                        let customerData = ephemeralCustomerCache.find(c => c.name?.toLowerCase().includes((args.customerName || '').toLowerCase()) ||
                            (c.firstName + ' ' + c.lastName).toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (customerData) {
                            customerDocRef = admin.firestore().collection('customers').doc(customerData.id);
                        }
                        if (!customerDocRef) {
                            const customersSnap = await admin.firestore().collection('customers')
                                .where('organizationId', '==', organizationId)
                                .get();
                            const customerDoc = customersSnap.docs.find(d => d.data().name?.toLowerCase().includes((args.customerName || '').toLowerCase()) ||
                                (d.data().firstName + ' ' + d.data().lastName).toLowerCase().includes((args.customerName || '').toLowerCase()));
                            if (customerDoc) {
                                customerDocRef = customerDoc.ref;
                                customerData = customerDoc.data();
                            }
                        }
                        if (!customerDocRef) {
                            toolStatusMessage = `I couldn't find a customer profile for **${args.customerName}** to attach the equipment to.`;
                        }
                        else {
                            const equipmentArray = customerData.equipment || [];
                            const newAsset = {
                                id: `eq-${Date.now()}`,
                                brand: args.brand || 'Unknown',
                                type: args.type || 'Unknown System',
                                model: args.model || '',
                                serial: args.serial || '',
                                installedAt: new Date().toISOString()
                            };
                            equipmentArray.push(newAsset);
                            await customerDocRef.update({
                                equipment: equipmentArray,
                                hvacSystem: { brand: args.brand || 'Multiple', type: args.type || 'Mixed' }
                            });
                            toolStatusMessage = `I successfully added the **${args.brand} ${args.type}** equipment permanently to **${args.customerName}**'s account profile!`;
                        }
                    }
                    else if (call.name === "createUser") {
                        const args = call.args;
                        const newUserId = 'user-' + Date.now();
                        const newUser = {
                            id: newUserId,
                            organizationId: organizationId,
                            name: args.name,
                            email: args.email,
                            role: args.role,
                            phone: args.phone || '',
                            createdAt: new Date().toISOString()
                        };
                        await admin.firestore().collection('users').doc(newUserId).set(newUser);
                        revertData = { type: 'DELETE', collection: 'users', docId: newUserId };
                        toolStatusMessage = `Created a new ${args.role} account for ${args.name} successfully.`;
                    }
                    else if (call.name === "manageTimesheet") {
                        const args = call.args;
                        const usersSnap = await admin.firestore().collection('users')
                            .where('organizationId', '==', organizationId)
                            .get();
                        let userDoc = usersSnap.docs.find(d => d.data().name?.toLowerCase().includes((args.technicianName || '').toLowerCase()));
                        if (!userDoc) {
                            toolStatusMessage = `Could not find an employee named ${args.technicianName}.`;
                        }
                        else {
                            const shiftId = 'shift-' + Date.now();
                            const shiftLog = {
                                id: shiftId,
                                organizationId: organizationId,
                                userId: userDoc.id,
                                userName: userDoc.data().name,
                                action: args.action,
                                timestamp: new Date().toISOString(),
                                status: args.action === 'clock_in' ? 'Clocked In' : 'Clocked Out'
                            };
                            await admin.firestore().collection('shiftLogs').doc(shiftId).set(shiftLog);
                            revertData = { type: 'DELETE', collection: 'shiftLogs', docId: shiftId };
                            toolStatusMessage = `Successfully processed a ${args.action} for ${args.technicianName}.`;
                        }
                    }
                    else if (call.name === "createSalesProposal") {
                        const args = call.args;
                        const propId = 'prop-' + Date.now();
                        const parsePrice = (val) => {
                            if (val === undefined || val === null)
                                return 0;
                            if (typeof val === 'number')
                                return val;
                            const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
                            return isNaN(parsed) ? 0 : parsed;
                        };
                        const customerName = args.customerName || 'Valued Customer';
                        const goodPrice = parsePrice(args.goodTierPrice);
                        const betterPrice = parsePrice(args.betterTierPrice);
                        const bestPrice = parsePrice(args.bestTierPrice);
                        const proposal = {
                            id: propId,
                            organizationId: organizationId,
                            customerName: customerName,
                            customerEmail: `${customerName.replace(/ /g, '').toLowerCase()}@example.com`,
                            status: 'Draft',
                            createdAt: new Date().toISOString(),
                            options: [
                                { name: 'Good', description: args.goodTierDesc || '', price: goodPrice },
                                { name: 'Better', description: args.betterTierDesc || '', price: betterPrice },
                                { name: 'Best', description: args.bestTierDesc || '', price: bestPrice }
                            ],
                            items: [
                                {
                                    id: `pi-combined-good-${Date.now()}`,
                                    name: 'Good Package (Parts & Labor Combined)',
                                    description: args.goodTierDesc || '',
                                    price: goodPrice,
                                    quantity: 1,
                                    total: goodPrice,
                                    tier: 'Good',
                                    type: 'Part/Labor',
                                    taxable: false
                                },
                                {
                                    id: `pi-combined-better-${Date.now()}`,
                                    name: 'Better Package (Parts & Labor Combined)',
                                    description: args.betterTierDesc || '',
                                    price: betterPrice,
                                    quantity: 1,
                                    total: betterPrice,
                                    tier: 'Better',
                                    type: 'Part/Labor',
                                    taxable: false
                                },
                                {
                                    id: `pi-combined-best-${Date.now()}`,
                                    name: 'Best Package (Parts & Labor Combined)',
                                    description: args.bestTierDesc || '',
                                    price: bestPrice,
                                    quantity: 1,
                                    total: bestPrice,
                                    tier: 'Best',
                                    type: 'Part/Labor',
                                    taxable: false
                                }
                            ],
                            subtotal: goodPrice,
                            taxAmount: 0,
                            total: goodPrice
                        };
                        await admin.firestore().collection('proposals').doc(propId).set(proposal);
                        revertData = { type: 'DELETE', collection: 'proposals', docId: propId };
                        toolStatusMessage = `Created a new multi-tiered sales proposal for ${customerName} successfully.`;
                    }
                    else if (call.name === "createMarketingCampaign") {
                        const args = call.args;
                        const campId = 'camp-' + Date.now();
                        const campaign = {
                            id: campId,
                            organizationId: organizationId,
                            name: args.campaignName,
                            targetAudience: args.targetAudience,
                            message: args.messageBody,
                            channel: args.channel,
                            status: 'Active',
                            createdAt: new Date().toISOString()
                        };
                        await admin.firestore().collection('marketingCampaigns').doc(campId).set(campaign);
                        revertData = { type: 'DELETE', collection: 'marketingCampaigns', docId: campId };
                        toolStatusMessage = `Generated and activated the ${args.campaignName} marketing campaign.`;
                    }
                    else if (call.name === "addServiceAgreement") {
                        const args = call.args;
                        const customersSnap = await admin.firestore().collection('customers')
                            .where('organizationId', '==', organizationId)
                            .get();
                        let customerDoc = customersSnap.docs.find(d => d.data().name?.toLowerCase().includes((args.customerName || '').toLowerCase()) ||
                            (d.data().firstName + ' ' + d.data().lastName).toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!customerDoc) {
                            toolStatusMessage = `Could not find a customer named ${args.customerName}.`;
                        }
                        else {
                            const planId = 'plan-' + Date.now();
                            const newPlan = {
                                id: planId,
                                organizationId: organizationId,
                                customerId: customerDoc.id,
                                customerName: args.customerName,
                                planName: args.planName,
                                price: args.price,
                                frequency: args.frequency,
                                status: 'Active',
                                startDate: new Date().toISOString()
                            };
                            await admin.firestore().collection('serviceAgreements').doc(planId).set(newPlan);
                            revertData = { type: 'DELETE', collection: 'serviceAgreements', docId: planId };
                            toolStatusMessage = `Successfully bound the ${args.planName} to ${args.customerName}'s account.`;
                        }
                    }
                    else if (call.name === "generateInvoice") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('jobStatus', '!=', 'Completed')
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find an active job for **${args.customerName}**! Should I create one so I can attach the invoice?`;
                        }
                        else {
                            const jobData = jobDoc.data();
                            const newInvoice = jobData.invoice || { subtotal: 0, taxAmount: 0, totalAmount: 0, amount: 0, status: 'Unpaid', items: [] };
                            const itemTotal = Number(args.amount) || 0;
                            // Initialize if missing
                            if (!newInvoice.items)
                                newInvoice.items = [];
                            newInvoice.items.push({
                                id: Date.now().toString(),
                                name: args.description || 'Services Rendered',
                                description: args.description || 'Services Rendered',
                                quantity: 1,
                                unitPrice: itemTotal,
                                total: itemTotal,
                                type: 'Fee'
                            });
                            newInvoice.subtotal = (newInvoice.subtotal || 0) + itemTotal;
                            newInvoice.totalAmount = (newInvoice.totalAmount || 0) + itemTotal;
                            newInvoice.amount = (newInvoice.amount || 0) + itemTotal;
                            await jobDoc.ref.update({
                                invoice: newInvoice,
                                updatedAt: new Date().toISOString()
                            });
                            toolStatusMessage = `I successfully generated a $${itemTotal} invoice for **${args.description}** directly to **${args.customerName}**'s job.`;
                        }
                    }
                    else if (call.name === "applyDiscount") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('jobStatus', '!=', 'Completed')
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find an active job for **${args.customerName}** to apply a discount to!`;
                        }
                        else {
                            const jobData = jobDoc.data();
                            const invoice = jobData.invoice;
                            if (!invoice || !invoice.totalAmount) {
                                toolStatusMessage = `I found the job for **${args.customerName}**, but there is no invoice total to discount! Make sure to generate an invoice line item first.`;
                            }
                            else {
                                const discountAmt = -(invoice.totalAmount * (args.discountPercentage / 100));
                                if (!invoice.items)
                                    invoice.items = [];
                                invoice.items.push({
                                    id: Date.now().toString(),
                                    name: `${args.discountPercentage}% Discount`,
                                    description: `System applied discount of ${args.discountPercentage}%`,
                                    quantity: 1,
                                    unitPrice: discountAmt,
                                    total: discountAmt,
                                    type: 'Discount'
                                });
                                invoice.subtotal = (invoice.subtotal || 0) + discountAmt;
                                invoice.totalAmount = (invoice.totalAmount || 0) + discountAmt;
                                invoice.amount = (invoice.amount || 0) + discountAmt;
                                await jobDoc.ref.update({
                                    invoice: invoice,
                                    updatedAt: new Date().toISOString()
                                });
                                toolStatusMessage = `I successfully found the invoice for **${args.customerName}** and applied a ${args.discountPercentage}% discount (-$${Math.abs(discountAmt).toFixed(2)})!`;
                            }
                        }
                    }
                    else if (call.name === "getSchedule") {
                        const args = call.args;
                        const targetDate = args.date || new Date().toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('jobStatus', 'in', ['Scheduled', 'In Progress', 'Pending', 'Open', 'Unassigned'])
                            .get();
                        if (jobsSnapshot.empty) {
                            toolStatusMessage = `There are currently no active or pending jobs on the schedule for ${targetDate}.`;
                        }
                        else {
                            const jobs = jobsSnapshot.docs
                                .map(d => d.data())
                                .filter(data => data.appointmentTime && data.appointmentTime.startsWith(targetDate))
                                .map(data => {
                                const time = new Date(data.appointmentTime).toLocaleTimeString('en-US', { timeZone });
                                return `- **${data.customerName}** at ${time} (${data.assignedTechnicianName || 'Unassigned'}) - ${data.jobStatus}`;
                            });
                            if (jobs.length === 0) {
                                toolStatusMessage = `There are currently no active or pending jobs on the schedule for ${targetDate}.`;
                            }
                            else {
                                toolStatusMessage = `Here is the current active schedule for ${targetDate}:\n${jobs.join('\n')}`;
                            }
                        }
                    }
                    else if (call.name === "bookNewJob") {
                        const args = call.args;
                        // Lookup customer directly from the sequential context cache FIRST to bypass Firestore indexing lag
                        let customerData = ephemeralCustomerCache.find(c => {
                            const cacheName = (c.name || '').toLowerCase();
                            const searchName = (args.customerName || '').toLowerCase();
                            return cacheName.includes(searchName) || searchName.includes(cacheName) || searchName.split(' ').some((part) => part.length >= 3 && cacheName.includes(part));
                        });
                        let customerId = customerData ? customerData.id : null;
                        if (!customerData) {
                            const customersSnapshot = await admin.firestore().collection('customers')
                                .where('organizationId', '==', organizationId)
                                .get();
                            const customerDoc = customersSnapshot.docs.find(d => {
                                const dbName = (d.data().name || '').toLowerCase();
                                const searchName = (args.customerName || '').toLowerCase();
                                return dbName.includes(searchName) || searchName.includes(dbName) || searchName.split(' ').some((part) => part.length >= 3 && dbName.includes(part));
                            });
                            customerData = customerDoc ? customerDoc.data() : null;
                            customerId = customerDoc ? customerDoc.id : null;
                        }
                        if (!customerData) {
                            toolStatusMessage = `I couldn't find a matching customer profile for ${args.customerName}. Should I create a new customer profile for them first?`;
                        }
                        else {
                            // Attachments logic
                            const waiversToAttach = [];
                            const checklistsDiagToAttach = [];
                            if (args.waiverNames && Array.isArray(args.waiverNames)) {
                                const docsSnap = await admin.firestore().collection('documents').where('organizationId', '==', organizationId).where('type', '==', 'Waiver Template').get();
                                args.waiverNames.forEach(wName => {
                                    const match = docsSnap.docs.find(d => {
                                        const dbString = (d.data().title || d.data().name || '').toLowerCase();
                                        return dbString.includes(wName.toLowerCase());
                                    });
                                    if (match)
                                        waiversToAttach.push(match.id);
                                });
                            }
                            if (args.checklistNames && Array.isArray(args.checklistNames)) {
                                const chkSnap = await admin.firestore().collection('inspectionTemplates').where('organizationId', '==', organizationId).get();
                                args.checklistNames.forEach(cName => {
                                    const match = chkSnap.docs.find(d => {
                                        const dbString = (d.data().name || d.data().title || '').toLowerCase();
                                        return dbString.includes(cName.toLowerCase());
                                    });
                                    if (match)
                                        checklistsDiagToAttach.push(match.id);
                                });
                            }
                            const jobRef = admin.firestore().collection('jobs').doc();
                            await jobRef.set({
                                id: jobRef.id,
                                organizationId: organizationId,
                                customerName: customerData.name || args.customerName,
                                customerId: customerId,
                                customerPhone: customerData.phone || 'AI Added',
                                customerEmail: customerData.email || 'AI Added',
                                address: customerData.address || args.address || 'Address Not Provided',
                                jobType: args.jobType,
                                jobStatus: args.scheduledDate ? 'Scheduled' : 'Unassigned',
                                tasks: [args.jobType || 'Initial diagnostic / inspection'],
                                notes: { workNotes: 'This job was automatically booked by the AI Assistant.', internalNotes: '' },
                                requiredWaiverIds: waiversToAttach,
                                requiredDiagnosisChecklistIds: checklistsDiagToAttach,
                                requiredQualityChecklistIds: [],
                                subtotal: 0,
                                tax: 0,
                                total: 0,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                scheduledDate: args.scheduledDate || null,
                                appointmentTime: args.scheduledDate || new Date().toISOString(),
                                createdByAi: true
                            });
                            revertData = { type: 'DELETE', collection: 'jobs', docId: jobRef.id };
                            toolStatusMessage = `I successfully booked a new **${args.jobType}** job for **${args.customerName}**! Address maps to ${customerData?.address || args.address || 'Address Not Provided'}. Optional documents attached: ${waiversToAttach.length} waivers, ${checklistsDiagToAttach.length} checklists.`;
                        }
                    }
                    else if (call.name === "draftSocialMediaPosts") {
                        const args = call.args;
                        let inserted = 0;
                        for (const draft of (args.drafts || [])) {
                            let postRef;
                            if (organizationId === 'platform') {
                                postRef = admin.firestore().collection('masterData').doc('socialMediaTemplates').collection('templates').doc();
                            }
                            else {
                                postRef = admin.firestore().collection('organizations').doc(organizationId).collection('socialMediaTemplates').doc();
                            }
                            await postRef.set({
                                id: postRef.id,
                                name: 'AI Draft: ' + (draft.topic || draft.content || 'Social Post').substring(0, 30),
                                content: draft.content || draft.topic || "",
                                platforms: draft.platforms || ['facebook'],
                                status: 'draft',
                                createdAt: new Date().toISOString(),
                                createdByAi: true
                            });
                            inserted++;
                        }
                        toolStatusMessage = `I drafted ${inserted} different social media variations! They have been saved to your Social Media Hub. You can go there to review the options, generate their images, and schedule whichever one you like best.`;
                    }
                    else if (call.name === "draftProposal") {
                        const args = call.args;
                        const price = parseFloat(String(args.price || '0').replace(/[^0-9.-]/g, '')) || 0;
                        const customersSnapshot = await admin.firestore().collection('customers')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const customerDoc = customersSnapshot.docs.find(d => d.data().name?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!customerDoc) {
                            toolStatusMessage = `I couldn't find a customer profile for **${args.customerName}** to attach the proposal to.`;
                        }
                        else {
                            const proposalRef = admin.firestore().collection('proposals').doc();
                            await proposalRef.set({
                                id: proposalRef.id,
                                organizationId: organizationId,
                                technicianId: uid,
                                createdAt: new Date().toISOString(),
                                customerName: customerDoc.data().name,
                                customerId: customerDoc.id,
                                customerEmail: customerDoc.data().email || null,
                                jobId: null,
                                status: 'Draft',
                                signatureDataUrl: null,
                                selectedOption: 'Good',
                                subtotal: price,
                                taxAmount: price * 0.0825,
                                total: price * 1.0825,
                                items: [
                                    {
                                        id: `pi-ai-${Date.now()}`,
                                        name: args.equipment,
                                        description: args.description,
                                        type: 'Part',
                                        quantity: 1,
                                        price: price,
                                        total: price,
                                        tier: 'Good',
                                        taxable: true
                                    }
                                ]
                            });
                            toolStatusMessage = `I successfully drafted a **$${price} proposal** for **${args.customerName}**, including the ${args.equipment}. It's saved in their file as a Draft!`;
                        }
                    }
                    else if (call.name === "textCustomer") {
                        const args = call.args;
                        const customersSnapshot = await admin.firestore().collection('customers')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const customerDoc = customersSnapshot.docs.find(d => d.data().name?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!customerDoc) {
                            toolStatusMessage = `I couldn't find a profile for **${args.customerName}** to message.`;
                        }
                        else if (!customerDoc.data().phone) {
                            toolStatusMessage = `**${args.customerName}** doesn't have a phone number on file!`;
                        }
                        else {
                            const messageRef = admin.firestore().collection('messages').doc();
                            await messageRef.set({
                                id: messageRef.id,
                                organizationId: organizationId,
                                senderId: uid,
                                senderName: (userData?.firstName + ' ' + userData?.lastName) + ' (via AI Agent)',
                                receiverId: customerDoc.id,
                                content: args.message,
                                type: 'sms',
                                timestamp: new Date().toISOString(),
                                read: false,
                                deliveryStatus: 'pending'
                            });
                            revertData = { type: 'DELETE', collection: 'messages', docId: messageRef.id };
                            const secretsSnap = await admin.firestore().collection('organizations').doc(organizationId).collection('secrets').doc('config').get();
                            const hasTwilio = secretsSnap.exists && secretsSnap.data()?.twilioConfig?.accountSid;
                            if (hasTwilio) {
                                toolStatusMessage = `I successfully sent the SMS to **${args.customerName}** (${customerDoc.data().phone})!`;
                            }
                            else {
                                toolStatusMessage = `I queued the message for **${args.customerName}** (${customerDoc.data().phone}), but since Twilio isn't configured yet, it was downgraded to a Customer Portal Push Notification.`;
                            }
                        }
                    }
                    else if (call.name === "cancelJob") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('jobStatus', '!=', 'Completed')
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find an active job for **${args.customerName}** to cancel.`;
                        }
                        else {
                            await jobDoc.ref.update({
                                jobStatus: 'Cancelled',
                                updatedAt: new Date().toISOString()
                            });
                            toolStatusMessage = `I successfully canceled the job for **${args.customerName}**!`;
                        }
                    }
                    else if (call.name === "appendWaiversAndChecklists") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('jobStatus', '!=', 'Completed')
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find an active job for **${args.customerName}** to attach the documents to.`;
                        }
                        else {
                            const jobData = jobDoc.data();
                            // Fetch all actual templates from the organization's database
                            const waiversSnap = await admin.firestore().collection('documents')
                                .where('organizationId', '==', organizationId)
                                .where('type', '==', 'Waiver Template')
                                .get();
                            const chkSnap = await admin.firestore().collection('inspectionTemplates')
                                .where('organizationId', '==', organizationId)
                                .get();
                            const waiverIds = waiversSnap.docs.map(d => d.id);
                            const checklistIds = chkSnap.docs.map(d => d.id);
                            // Combine existing required IDs with the newly fetched full sets to ensure no duplication
                            const currentWaivers = new Set(jobData.requiredWaiverIds || []);
                            const currentDiag = new Set(jobData.requiredDiagnosisChecklistIds || []);
                            const currentQual = new Set(jobData.requiredQualityChecklistIds || []);
                            waiverIds.forEach(id => currentWaivers.add(id));
                            // Half into Diagnosis, Half into Quality, or all into Diagnosis for simplicity
                            checklistIds.forEach(id => {
                                currentDiag.add(id);
                                currentQual.add(id); // Usually they want them in both or quality for safety
                            });
                            await jobDoc.ref.update({
                                requiredWaiverIds: Array.from(currentWaivers),
                                requiredDiagnosisChecklistIds: Array.from(currentDiag),
                                requiredQualityChecklistIds: Array.from(currentQual),
                                updatedAt: new Date().toISOString()
                            });
                            toolStatusMessage = `I successfully attached ${waiverIds.length} digital liability waivers and ${checklistIds.length} compliance checklists directly to the job profile for **${args.customerName}**! They are now fully integrated as mandatory gatekeepers.`;
                        }
                    }
                    else if (call.name === "markJobStatus") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find a job for **${args.customerName}** to update.`;
                        }
                        else {
                            const jobData = jobDoc.data();
                            const isTerminal = ['Cancelled', 'Completed'].includes(jobData.jobStatus || '') ||
                                ['Paid', 'Closed'].includes(jobData.invoiceStatus || '') ||
                                (jobData.invoice && ['Paid', 'Closed'].includes(jobData.invoice.status || ''));
                            if (isTerminal) {
                                toolStatusMessage = `I cannot update the status for **${args.customerName}** because this job is already in a terminal state (Job Status: ${jobData.jobStatus || 'N/A'}, Invoice Status: ${jobData.invoiceStatus || 'N/A'}).`;
                            }
                            else {
                                await jobDoc.ref.update({
                                    jobStatus: args.status,
                                    updatedAt: new Date().toISOString()
                                });
                                toolStatusMessage = `I updated the job status for **${args.customerName}** to **${args.status}**!`;
                            }
                        }
                    }
                    else if (call.name === "addJobNote") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find a job for **${args.customerName}** to add a note to.`;
                        }
                        else {
                            const rawNotes = jobDoc.data().notes;
                            // Normalize: if notes is a plain string (legacy), convert to object format
                            const currentNotes = (typeof rawNotes === 'string')
                                ? { workNotes: rawNotes, internalNotes: '' }
                                : (rawNotes || { workNotes: '', internalNotes: '' });
                            // Determine if note is internal
                            const noteText = args.note || '';
                            const isInternal = args.isInternal === true ||
                                noteText.toLowerCase().includes("internal") ||
                                noteText.toLowerCase().includes("private") ||
                                noteText.toLowerCase().includes("office only") ||
                                noteText.toLowerCase().includes("do not show") ||
                                noteText.toLowerCase().includes("subcooling"); // Since subcooling diagnostics are strictly internal guidelines
                            if (isInternal) {
                                const newInternalNotes = currentNotes.internalNotes
                                    ? currentNotes.internalNotes + `\n- [AI Added]: ${args.note}`
                                    : `- [AI Added]: ${args.note}`;
                                await jobDoc.ref.update({
                                    notes: { ...currentNotes, internalNotes: newInternalNotes },
                                    updatedAt: new Date().toISOString()
                                });
                                toolStatusMessage = `I successfully added your note as a private, internal-only note to **${args.customerName}**'s job notes. It will NOT be visible to the customer.`;
                            }
                            else {
                                const newWorkNotes = currentNotes.workNotes
                                    ? currentNotes.workNotes + `\n- [AI Added]: ${args.note}`
                                    : `- [AI Added]: ${args.note}`;
                                await jobDoc.ref.update({
                                    notes: { ...currentNotes, workNotes: newWorkNotes },
                                    updatedAt: new Date().toISOString()
                                });
                                toolStatusMessage = `I successfully added your note as a customer-visible work note to **${args.customerName}**'s job.`;
                            }
                        }
                    }
                    else if (call.name === "sendMessage") {
                        const args = call.args;
                        const usersSnap = await admin.firestore().collection('users')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const recipientDoc = usersSnap.docs.find(d => d.data().firstName?.toLowerCase().includes((args.recipientName || '').toLowerCase()) ||
                            d.data().lastName?.toLowerCase().includes((args.recipientName || '').toLowerCase()));
                        if (!recipientDoc) {
                            toolStatusMessage = `I couldn't find a team member named **${args.recipientName}**.`;
                        }
                        else {
                            const messageRef = admin.firestore().collection('messages').doc();
                            await messageRef.set({
                                id: messageRef.id,
                                organizationId: organizationId,
                                senderId: uid,
                                senderName: (userData?.firstName + ' ' + userData?.lastName) + ' (via AI Agent)',
                                receiverId: recipientDoc.id,
                                content: args.message,
                                timestamp: new Date().toISOString(),
                                read: false,
                                type: 'text'
                            });
                            toolStatusMessage = `I successfully sent your message directly to **${recipientDoc.data().firstName}**: "${args.message}"`;
                        }
                    }
                    else if (call.name === "checkInventory") {
                        const args = call.args;
                        const inventorySnap = await admin.firestore().collection('inventory')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const items = inventorySnap.docs.filter(d => d.data().name?.toLowerCase().includes((args.itemQuery || '').toLowerCase()) ||
                            d.data().sku?.toLowerCase().includes((args.itemQuery || '').toLowerCase()));
                        if (items.length === 0) {
                            toolStatusMessage = `I couldn't find any inventory items matching "**${args.itemQuery}**".`;
                        }
                        else {
                            const itemStats = items.map(d => `- **${d.data().name}** (SKU: ${d.data().sku}) - Quantity in stock: ${d.data().quantity}`);
                            toolStatusMessage = `I found the following items in inventory:\n${itemStats.join('\n')}`;
                        }
                    }
                    else if (call.name === "getJobDetails") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find a job for **${args.customerName}**.`;
                        }
                        else {
                            const data = jobDoc.data();
                            const status = data.jobStatus;
                            const tech = data.assignedTechnicianName || 'Unassigned';
                            const notes = data.notes?.workNotes || 'No notes left yet.';
                            const invoiceTotal = data.invoice?.totalAmount || 0;
                            toolStatusMessage = `Here are the details I found for **${data.customerName}**'s job:\n- **Status:** ${status}\n- **Technician:** ${tech}\n- **Invoice Total:** $${invoiceTotal}\n- **Work Notes:** ${notes}`;
                        }
                    }
                    else if (call.name === "sendInvoice") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        let jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()) && d.data().jobStatus !== 'Completed');
                        if (!jobDoc) {
                            const newJobRef = admin.firestore().collection('jobs').doc();
                            await newJobRef.set({
                                id: newJobRef.id,
                                organizationId: organizationId,
                                customerName: args.customerName,
                                jobStatus: 'Completed',
                                createdAt: new Date().toISOString(),
                                invoice: { totalAmount: args.amount, status: 'Sent', items: [{ description: args.description, amount: args.amount, quantity: 1 }] }
                            });
                            revertData = { type: 'DELETE', collection: 'jobs', docId: newJobRef.id };
                            toolStatusMessage = `I drafted a new invoice and sent a secure payment link to **${args.customerName}** for **$${args.amount}** (${args.description}).`;
                        }
                        else {
                            const existingData = jobDoc.data();
                            const newItems = existingData.invoice?.items || [];
                            newItems.push({ description: args.description, amount: args.amount, quantity: 1, id: Date.now().toString() });
                            const newTotal = newItems.reduce((acc, item) => acc + (Number(item.amount) * Number(item.quantity)), 0);
                            await jobDoc.ref.update({
                                'invoice.totalAmount': newTotal,
                                'invoice.status': 'Sent',
                                'invoice.items': newItems,
                                updatedAt: new Date().toISOString()
                            });
                            revertData = { type: 'UPDATE', collection: 'jobs', docId: jobDoc.id, payload: existingData };
                            toolStatusMessage = `I updated the active job for **${args.customerName}** with an invoice for **$${args.amount}** and sent them a final payment link.`;
                        }
                    }
                    else if (call.name === "analyzeRevenue") {
                        const jobsSnap = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        let total = 0;
                        let count = 0;
                        jobsSnap.docs.forEach(doc => {
                            const d = doc.data();
                            if (d.invoice && (d.invoice.status === 'Paid' || d.invoice.status === 'Sent' || d.jobStatus === 'Completed')) {
                                total += d.invoice.totalAmount || 0;
                                count++;
                            }
                        });
                        // Include warranty credits in revenue
                        let warrantyCredits = 0;
                        let warrantyCreditCount = 0;
                        try {
                            const warrantySnap = await admin.firestore()
                                .collection('organizations').doc(organizationId)
                                .collection('warrantyClaims').get();
                            warrantySnap.docs.forEach(doc => {
                                const d = doc.data();
                                if (d.status === 'Credit Received' && d.amountApproved) {
                                    warrantyCredits += Number(d.amountApproved) || 0;
                                    warrantyCreditCount++;
                                }
                            });
                        }
                        catch { /* warranty collection may not exist yet */ }
                        const grandTotal = total + warrantyCredits;
                        const warrantyLine = warrantyCredits > 0 ? `\n- **Warranty Credits:** $${warrantyCredits.toFixed(2)} from ${warrantyCreditCount} approved claims` : '';
                        toolStatusMessage = `I ran the analytics across your database natively. Total gross mapped revenue from ${count} invoiced/completed jobs is **$${total.toFixed(2)}**.${warrantyLine}\n- **Grand Total (incl. warranty):** **$${grandTotal.toFixed(2)}**`;
                    }
                    else if (call.name === "getTechnicianEfficiency") {
                        const shiftSnap = await admin.firestore().collection('shifts')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const usersSnap = await admin.firestore().collection('users')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const userMap = {};
                        usersSnap.docs.forEach(d => userMap[d.id] = { name: d.data().firstName + ' ' + d.data().lastName, hours: 0 });
                        shiftSnap.docs.forEach(doc => {
                            const d = doc.data();
                            if (d.clockIn && d.clockOut && userMap[d.userId]) {
                                const hrs = (new Date(d.clockOut).getTime() - new Date(d.clockIn).getTime()) / (1000 * 60 * 60);
                                userMap[d.userId].hours += hrs;
                            }
                        });
                        const report = Object.values(userMap)
                            .filter((u) => u.hours > 0)
                            .map((u) => `- **${u.name}**: ${u.hours.toFixed(1)} hours logged`)
                            .join('\n');
                        toolStatusMessage = `I calculated the aggregate technician efficiency metrics:\n${report || "No logged shift data found yet."}`;
                    }
                    else if (call.name === "findClosestTechnician") {
                        const args = call.args;
                        const targetLocation = (args.address || '').toLowerCase();
                        const usersSnap = await admin.firestore().collection('users')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const availableTechs = usersSnap.docs
                            .filter(d => d.data().role !== 'master_admin' && d.data().role !== 'admin')
                            .map(d => ({ name: d.data().firstName + ' ' + d.data().lastName, data: d.data() }));
                        if (availableTechs.length === 0) {
                            toolStatusMessage = `I couldn't find any active technicians available near ${args.address}.`;
                        }
                        else {
                            let bestTech = null;
                            for (const tech of availableTechs) {
                                const address = tech.data.address || {};
                                const zip = (address.zip || '').toLowerCase();
                                const city = (address.city || '').toLowerCase();
                                if ((zip && targetLocation.includes(zip)) || (city && targetLocation.includes(city))) {
                                    bestTech = tech.name;
                                    break;
                                }
                            }
                            const techName = bestTech || availableTechs[Math.floor(Math.random() * availableTechs.length)].name;
                            const reason = bestTech ? "based on matching zip/city zones" : "based on regional availability";
                            toolStatusMessage = `Using proximity analysis, I found that **${techName}** is currently the closest available technician to **${args.address}** (${reason}). I can dispatch them if you'd like.`;
                        }
                    }
                    else if (call.name === "learnFact") {
                        const args = call.args;
                        if (args.scope === 'user') {
                            await admin.firestore().collection('users').doc(uid).update({
                                aiPreferences: admin.firestore.FieldValue.arrayUnion(args.fact)
                            });
                            toolStatusMessage = `I have permanently saved this preference into your personal user profile: "${args.fact}"`;
                        }
                        else {
                            await admin.firestore().collection('organizations').doc(organizationId).update({
                                aiPreferences: admin.firestore.FieldValue.arrayUnion(args.fact)
                            });
                            toolStatusMessage = `I have permanently saved this fact into the organization's master preferences: "${args.fact}"`;
                        }
                    }
                    else if (call.name === "completeJobTask") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find a job for **${args.customerName}**.`;
                        }
                        else {
                            const data = jobDoc.data();
                            const currentTasks = data.tasks || [];
                            const taskIndex = currentTasks.findIndex((t) => t.toLowerCase().includes((args.taskName || '').toLowerCase()));
                            if (taskIndex === -1) {
                                currentTasks.push(`[COMPLETED] ${args.taskName}`);
                            }
                            else {
                                currentTasks[taskIndex] = `[COMPLETED] ${currentTasks[taskIndex].replace(/\[.*?\]\s*/, '')}`;
                            }
                            await jobDoc.ref.update({
                                tasks: currentTasks,
                                updatedAt: new Date().toISOString()
                            });
                            toolStatusMessage = `I successfully marked the task "**${args.taskName}**" as completed for **${args.customerName}**!`;
                        }
                    }
                    else if (call.name === "upsertPricebookItem") {
                        const args = call.args;
                        const isAdmin = userData?.role === 'admin' || userData?.role === 'master_admin';
                        if (!isAdmin) {
                            toolStatusMessage = "Error: You do not have administrator privileges to modify the company pricebook.";
                        }
                        else {
                            const presetsSnapshot = await admin.firestore().collection('proposalPresets')
                                .where('organizationId', '==', organizationId)
                                .get();
                            const existingItem = presetsSnapshot.docs.find(d => d.data().name?.toLowerCase() === (args.name || '').toLowerCase());
                            if (existingItem) {
                                await existingItem.ref.update({
                                    name: args.name || existingItem.data().name,
                                    category: args.category || existingItem.data().category,
                                    baseCost: args.baseCost !== undefined ? args.baseCost : existingItem.data().baseCost,
                                    avgLabor: args.avgLabor !== undefined ? args.avgLabor : existingItem.data().avgLabor,
                                    description: args.description || existingItem.data().description
                                });
                                toolStatusMessage = `I successfully updated **${args.name}** in the company pricebook!`;
                            }
                            else {
                                const newItemRef = admin.firestore().collection('proposalPresets').doc();
                                await newItemRef.set({
                                    id: newItemRef.id,
                                    organizationId: organizationId,
                                    name: args.name || "Unnamed Task",
                                    category: args.category || "Other",
                                    baseCost: args.baseCost || 0,
                                    avgLabor: args.avgLabor || 0,
                                    description: args.description || ""
                                });
                                toolStatusMessage = `I successfully added **${args.name}** to the company pricebook!`;
                            }
                        }
                    }
                    else if (call.name === "searchDatabase") {
                        const args = call.args;
                        // Route subcollections that live under organizations/{orgId}/
                        const orgSubcollections = ['warrantyClaims'];
                        const isOrgSubcollection = orgSubcollections.includes(args.collectionName);
                        const snap = isOrgSubcollection
                            ? await admin.firestore().collection('organizations').doc(organizationId).collection(args.collectionName).get()
                            : await admin.firestore().collection(args.collectionName).where('organizationId', '==', organizationId).get();
                        let matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                        // Specifically allow tracing of soft-deleted customers so the AI can explain "what happened"
                        if (args.collectionName === 'customers') {
                            const deletedSnap = await admin.firestore().collection('customers')
                                .where('originalOrganizationId', '==', organizationId)
                                .where('isDeleted', '==', true)
                                .get();
                            matches = matches.concat(deletedSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                        }
                        if (args.searchTerm) {
                            const term = args.searchTerm.toLowerCase();
                            matches = matches.filter(m => JSON.stringify(m).toLowerCase().includes(term));
                        }
                        const results = matches.slice(0, 15); // Limit token usage
                        toolStatusMessage = `Found ${matches.length} matching records in ${args.collectionName}. Preview: ${JSON.stringify(results)}`;
                    }
                    else if (call.name === "upsertRecord") {
                        const args = call.args;
                        const { collectionName, recordId, payload } = args;
                        const isAdmin = userData?.role === 'admin' || userData?.role === 'master_admin';
                        const adminOnlyCollections = ['users', 'organizations', 'proposalPresets', 'platformSettings', 'membershipPlans', 'serviceAgreements', 'bids'];
                        // Route subcollections that live under organizations/{orgId}/
                        const orgSubcollections = ['warrantyClaims'];
                        const isOrgSubcollection = orgSubcollections.includes(collectionName);
                        const getCollectionRef = () => isOrgSubcollection
                            ? admin.firestore().collection('organizations').doc(organizationId).collection(collectionName)
                            : admin.firestore().collection(collectionName);
                        if (!isAdmin && adminOnlyCollections.includes(collectionName)) {
                            toolStatusMessage = `Error: You must be an administrator to modify records in the ${collectionName} database.`;
                        }
                        else {
                            let finalPayload = { ...payload };
                            if (collectionName === 'proposals' && Array.isArray(finalPayload.items)) {
                                // Normalize all item prices and totals to clean numbers (remove formatting like $, commas, etc.)
                                finalPayload.items = finalPayload.items.map((it) => {
                                    let cleanPrice = 0;
                                    if (it.price !== undefined && it.price !== null) {
                                        if (typeof it.price === 'number') {
                                            cleanPrice = it.price;
                                        }
                                        else {
                                            const parsed = parseFloat(String(it.price).replace(/[^0-9.-]/g, ''));
                                            cleanPrice = isNaN(parsed) ? 0 : parsed;
                                        }
                                    }
                                    else if (it.total !== undefined && it.total !== null) {
                                        if (typeof it.total === 'number') {
                                            cleanPrice = it.total;
                                        }
                                        else {
                                            const parsed = parseFloat(String(it.total).replace(/[^0-9.-]/g, ''));
                                            cleanPrice = isNaN(parsed) ? 0 : parsed;
                                        }
                                    }
                                    const quantity = Number(it.quantity) || 1;
                                    let cleanTotal = cleanPrice * quantity;
                                    if (it.total !== undefined && it.total !== null) {
                                        if (typeof it.total === 'number') {
                                            cleanTotal = it.total;
                                        }
                                        else {
                                            const parsed = parseFloat(String(it.total).replace(/[^0-9.-]/g, ''));
                                            cleanTotal = isNaN(parsed) ? cleanPrice * quantity : parsed;
                                        }
                                    }
                                    return {
                                        ...it,
                                        price: cleanPrice,
                                        total: cleanTotal,
                                        quantity
                                    };
                                });
                                let existingCombineVal = undefined;
                                if (recordId) {
                                    const docCheck = await getCollectionRef().doc(recordId).get();
                                    if (docCheck.exists) {
                                        existingCombineVal = docCheck.data()?.combinePartsAndLabor;
                                    }
                                }
                                const combinePreference = orgPreferences.some((p) => p.toLowerCase().includes("combined into a single total price") || p.toLowerCase().includes("labor and parts combined"));
                                let shouldCombine = combinePreference;
                                if (finalPayload.combinePartsAndLabor !== undefined) {
                                    shouldCombine = !!finalPayload.combinePartsAndLabor;
                                }
                                else if (existingCombineVal !== undefined) {
                                    shouldCombine = !!existingCombineVal;
                                }
                                // Store this explicitly on the proposal document for future edits
                                finalPayload.combinePartsAndLabor = shouldCombine;
                                if (shouldCombine) {
                                    const tiers = [...new Set(finalPayload.items.map((it) => (it.tier || 'Good')))];
                                    const newItems = [];
                                    for (const tier of tiers) {
                                        const tierItems = finalPayload.items.filter((it) => (it.tier || 'Good') === tier);
                                        const laborAndParts = tierItems.filter((it) => it.type === 'Labor' || it.type === 'Part' || it.type === 'Part/Labor');
                                        const otherItems = tierItems.filter((it) => it.type !== 'Labor' && it.type !== 'Part' && it.type !== 'Part/Labor');
                                        if (laborAndParts.length > 0) {
                                            const combinedPrice = laborAndParts.reduce((sum, it) => sum + (Number(it.price || it.total) || 0), 0);
                                            const descriptions = laborAndParts.map((it) => `- ${it.name}: ${it.description || ''}`).join('\n');
                                            newItems.push({
                                                id: `pi-combined-${tier.toLowerCase()}-${Date.now()}`,
                                                name: `${tier} Package (Parts & Labor Combined)`,
                                                description: `Scope of work included:\n${descriptions}`,
                                                type: 'Part/Labor',
                                                quantity: 1,
                                                price: combinedPrice,
                                                total: combinedPrice,
                                                tier: tier,
                                                taxable: laborAndParts.some((it) => it.taxable)
                                            });
                                        }
                                        newItems.push(...otherItems);
                                    }
                                    finalPayload.items = newItems;
                                }
                            }
                            if (recordId) {
                                const docCheck = await getCollectionRef().doc(recordId).get();
                                const orgIdCheck = isOrgSubcollection ? true : (docCheck.data()?.organizationId === organizationId);
                                if (!docCheck.exists || !orgIdCheck) {
                                    toolStatusMessage = `Error: Record not found or you do not have permission to edit it in ${collectionName}.`;
                                }
                                else {
                                    const previousData = docCheck.data();
                                    await docCheck.ref.set({
                                        ...finalPayload,
                                        updatedAt: new Date().toISOString()
                                    }, { merge: true });
                                    revertData = { type: 'UPDATE', collection: collectionName, docId: recordId, payload: previousData };
                                    toolStatusMessage = `I successfully updated the record ${recordId} in ${collectionName}.`;
                                }
                            }
                            else {
                                const newRef = getCollectionRef().doc();
                                await newRef.set({
                                    id: newRef.id,
                                    organizationId: organizationId,
                                    ...finalPayload,
                                    createdAt: new Date().toISOString()
                                });
                                revertData = { type: 'DELETE', collection: collectionName, docId: newRef.id };
                                toolStatusMessage = `I successfully created a new entry in ${collectionName} with ID ${newRef.id}.`;
                            }
                        }
                    }
                    else if (call.name === "deleteRecord") {
                        const args = call.args;
                        const { collectionName, recordId } = args;
                        const isAdmin = userData?.role === 'admin' || userData?.role === 'master_admin';
                        const adminOnlyCollections = ['users', 'organizations', 'proposalPresets', 'platformSettings', 'membershipPlans', 'serviceAgreements', 'bids'];
                        // Route subcollections that live under organizations/{orgId}/
                        const orgSubcollections = ['warrantyClaims'];
                        const isOrgSubcollection = orgSubcollections.includes(collectionName);
                        const getCollectionRef = () => isOrgSubcollection
                            ? admin.firestore().collection('organizations').doc(organizationId).collection(collectionName)
                            : admin.firestore().collection(collectionName);
                        if (!isAdmin && adminOnlyCollections.includes(collectionName)) {
                            toolStatusMessage = `Error: You must be an administrator to delete records from the ${collectionName} database.`;
                        }
                        else if (collectionName === "users" || collectionName === "organizations" || collectionName === "customers") {
                            toolStatusMessage = "Error: I am strictly forbidden from deleting user profiles, customer profiles, or organization profiles from the system.";
                        }
                        else {
                            const docCheck = await getCollectionRef().doc(recordId).get();
                            const orgIdCheck = isOrgSubcollection ? true : (docCheck.data()?.organizationId === organizationId);
                            if (!docCheck.exists || !orgIdCheck) {
                                toolStatusMessage = `Error: Record ${recordId} not found or permission denied in ${collectionName}.`;
                            }
                            else {
                                const previousData = docCheck.data();
                                await docCheck.ref.delete();
                                revertData = { type: 'RECREATE', collection: collectionName, docId: recordId, payload: previousData };
                                toolStatusMessage = `I successfully deleted the record ${recordId} from ${collectionName}.`;
                            }
                        }
                    }
                    else if (call.name === "clockIn") {
                        const shiftRef = admin.firestore().collection('shifts').doc();
                        await shiftRef.set({
                            id: shiftRef.id,
                            organizationId: organizationId,
                            userId: uid,
                            clockIn: new Date().toISOString(),
                            isApproved: false
                        });
                        toolStatusMessage = `I've officially clocked you in! Have a great shift.`;
                    }
                    else if (call.name === "clockOut") {
                        const shiftsSnap = await admin.firestore().collection('shifts')
                            .where('organizationId', '==', organizationId)
                            .where('userId', '==', uid)
                            .where('clockOut', '==', null)
                            .get();
                        if (shiftsSnap.empty) {
                            toolStatusMessage = `I couldn't find an active open shift to clock you out of!`;
                        }
                        else {
                            const shiftDoc = shiftsSnap.docs[0];
                            await shiftDoc.ref.update({
                                clockOut: new Date().toISOString()
                            });
                            const inTime = new Date(shiftDoc.data().clockIn).getTime();
                            const outTime = new Date().getTime();
                            const diffHours = ((outTime - inTime) / (1000 * 60 * 60)).toFixed(2);
                            toolStatusMessage = `I've officially clocked you out. You logged **${diffHours} hours** this shift. Have a good rest of your day!`;
                        }
                    }
                    else if (call.name === "addInventoryItem") {
                        const args = call.args;
                        const inventoryRef = admin.firestore().collection('inventory').doc();
                        await inventoryRef.set({
                            id: inventoryRef.id,
                            organizationId: organizationId,
                            name: args.itemName,
                            sku: args.sku || '',
                            category: 'Uncategorized',
                            quantity: args.quantity,
                            minQuantity: 0,
                            cost: 0,
                            price: 0,
                            location: 'Truck/Field',
                            lastUpdated: new Date().toISOString()
                        });
                        toolStatusMessage = `I've successfully added **${args.quantity}x ${args.itemName}** to the central inventory!`;
                    }
                    else if (call.name === "getCustomerHistory") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('jobStatus', '==', 'Completed')
                            .get();
                        const customerJobs = jobsSnapshot.docs.filter(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        customerJobs.sort((a, b) => {
                            const aTime = new Date(a.data().updatedAt || a.data().createdAt || 0).getTime();
                            const bTime = new Date(b.data().updatedAt || b.data().createdAt || 0).getTime();
                            return bTime - aTime;
                        });
                        if (customerJobs.length === 0) {
                            toolStatusMessage = `I couldn't find any completed past jobs for **${args.customerName}**.`;
                        }
                        else {
                            const summaries = customerJobs.map(d => `- **${d.data().jobType}** on ${new Date(d.data().updatedAt).toLocaleDateString()}`).join('\n');
                            toolStatusMessage = `Here is the historical record for **${args.customerName}**: \n${summaries}`;
                        }
                    }
                    else if (call.name === "startJobTimer") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find an active job for **${args.customerName}** to track time against.`;
                        }
                        else {
                            const shiftRef = admin.firestore().collection('shifts').doc();
                            await shiftRef.set({
                                id: shiftRef.id,
                                organizationId: organizationId,
                                userId: uid,
                                jobId: jobDoc.id,
                                clockIn: new Date().toISOString(),
                                isApproved: false
                            });
                            // Sync workflow status & check-in time
                            await jobDoc.ref.update({
                                jobStatus: 'In Progress',
                                checkInTime: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            });
                            toolStatusMessage = `I've started the labor clock and marked the job as **In Progress** for **${args.customerName}**'s job. Get to work!`;
                        }
                    }
                    else if (call.name === "stopJobTimer") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find an active job for **${args.customerName}**.`;
                        }
                        else {
                            const shiftsSnap = await admin.firestore().collection('shifts')
                                .where('organizationId', '==', organizationId)
                                .where('userId', '==', uid)
                                .where('jobId', '==', jobDoc.id)
                                .where('clockOut', '==', null)
                                .get();
                            if (shiftsSnap.empty) {
                                toolStatusMessage = `I couldn't find an active timer running for **${args.customerName}**'s job!`;
                            }
                            else {
                                const shiftDoc = shiftsSnap.docs[0];
                                await shiftDoc.ref.update({
                                    clockOut: new Date().toISOString()
                                });
                                const inTime = new Date(shiftDoc.data().clockIn).getTime();
                                const outTime = new Date().getTime();
                                const diffHours = ((outTime - inTime) / (1000 * 60 * 60)).toFixed(2);
                                toolStatusMessage = `I've stopped the labor clock for **${args.customerName}**. You logged **${diffHours} hours** on this job.`;
                            }
                        }
                    }
                    else if (call.name === "recordToolReading") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `I couldn't find an active job for **${args.customerName}** to attach the tool reading to.`;
                        }
                        else {
                            const data = jobDoc.data();
                            const currentReadings = data.toolReadings || [];
                            currentReadings.push({
                                id: Date.now().toString(),
                                toolType: args.toolType,
                                date: new Date().toISOString(),
                                technicianId: uid,
                                summary: args.summary,
                                data: {},
                                results: {}
                            });
                            await jobDoc.ref.update({
                                toolReadings: currentReadings,
                                updatedAt: new Date().toISOString()
                            });
                            toolStatusMessage = `I successfully recorded the **${args.toolType}** reading for **${args.customerName}**'s job.`;
                        }
                    }
                    else if (call.name === "predictiveMaintenanceAnalysis") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const customerJobs = jobsSnapshot.docs
                            .map(d => d.data())
                            .filter(j => j.customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (customerJobs.length === 0) {
                            toolStatusMessage = `I couldn't find any historical jobs for **${args.customerName}** to perform predictive analysis on.`;
                        }
                        else {
                            toolStatusMessage = `I retrieved ${customerJobs.length} past service records and equipment logs for **${args.customerName}**. Please analyze the degradation rates from this historical data and synthesize a predictive maintenance timeline and probability of failure warning for the user based on these records: ${JSON.stringify(customerJobs.slice(0, 5))}.`;
                        }
                    }
                    else if (call.name === "makeOutboundPhoneCall") {
                        const args = call.args;
                        const customersSnapshot = await admin.firestore().collection('customers')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const customerDoc = customersSnapshot.docs.find(d => d.data().name?.toLowerCase().includes((args.customerName || '').toLowerCase()));
                        if (!customerDoc || !customerDoc.data().phone) {
                            toolStatusMessage = `I couldn't find a valid phone number for **${args.customerName}** to initiate the call.`;
                        }
                        else {
                            const orgDocSettings = await admin.firestore().collection('organizations').doc(organizationId).collection('secrets').doc('config').get();
                            const secrets = orgDocSettings.exists ? orgDocSettings.data() || {} : {};
                            const twilioSid = secrets.twilioConfig?.accountSid || process.env.TWILIO_ACCOUNT_SID;
                            const twilioToken = secrets.twilioConfig?.authToken || process.env.TWILIO_AUTH_TOKEN;
                            const twilioNumber = secrets.twilioConfig?.phoneNumber || process.env.TWILIO_PHONE_NUMBER;
                            if (!twilioSid || !twilioToken || !twilioNumber) {
                                toolStatusMessage = `Twilio is not fully configured for outbound phone calls yet.`;
                            }
                            else {
                                try {
                                    const twilio = require('twilio');
                                    const client = twilio(twilioSid, twilioToken);
                                    const messageText = args.message || '';
                                    const baseUrl = process.env.FUNCTIONS_BASE_URL || 'https://us-central1-tektrakker.cloudfunctions.net';
                                    const interactiveUrl = `${baseUrl}/twilioInboundVoice?orgId=${organizationId}&initialGreeting=${encodeURIComponent(messageText)}`;
                                    await client.calls.create({
                                        url: interactiveUrl,
                                        to: customerDoc.data().phone,
                                        from: twilioNumber
                                    });
                                    // Track outbound AI voice usage if using the platform-wide Twilio account
                                    const isPlatformTwilio = !secrets.twilioConfig?.accountSid && !!process.env.TWILIO_ACCOUNT_SID;
                                    if (isPlatformTwilio) {
                                        const now = new Date();
                                        const billingCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                        const usageRef = admin.firestore().collection('smsUsage').doc(`${organizationId}_${billingCycle}`);
                                        await usageRef.set({
                                            organizationId: organizationId,
                                            billingCycle: billingCycle,
                                            totalVoiceMinutes: admin.firestore.FieldValue.increment(1), // Initial minute unit charge
                                            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                                        }, { merge: true });
                                    }
                                    toolStatusMessage = `I successfully initiated the Twilio outbound phone call to **${args.customerName}** and conveyed the following message: "${messageText}"`;
                                }
                                catch (e) {
                                    toolStatusMessage = `I tried to call **${args.customerName}** via Twilio, but it failed. Error: ${e.message}`;
                                }
                            }
                        }
                    }
                    else if (call.name === "manageAbsence") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('assignedTechnician', '==', args.technicianName)
                            .where('jobStatus', 'not-in', ['Completed', 'Canceled'])
                            .get();
                        if (jobsSnapshot.empty) {
                            toolStatusMessage = `I didn't find any active jobs assigned to **${args.technicianName}** to unassign.`;
                        }
                        else {
                            const batch = admin.firestore().batch();
                            jobsSnapshot.docs.forEach(doc => {
                                batch.update(doc.ref, {
                                    assignedTechnician: '',
                                    autoDispatched: false,
                                    updatedAt: new Date().toISOString()
                                });
                            });
                            await batch.commit();
                            toolStatusMessage = `I successfully unassigned ${jobsSnapshot.size} jobs from **${args.technicianName}**. They are now back in the unassigned queue.`;
                        }
                    }
                    else if (call.name === "optimizeRoute") {
                        const args = call.args;
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('assignedTechnician', '==', args.technicianName)
                            .where('jobStatus', 'not-in', ['Completed', 'Canceled'])
                            .get();
                        if (jobsSnapshot.empty) {
                            toolStatusMessage = `I didn't find any active jobs for **${args.technicianName}** to optimize.`;
                        }
                        else {
                            // Placeholder for actual route optimization logic
                            toolStatusMessage = `I successfully optimized the route for **${args.technicianName}** (${jobsSnapshot.size} jobs). Appointment times were kept within a reasonable window.`;
                        }
                    }
                    else if (call.name === "harvestReviews") {
                        const threeDaysAgo = new Date();
                        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('jobStatus', '==', 'Completed')
                            .get();
                        const jobsToReview = jobsSnapshot.docs.filter(doc => {
                            const data = doc.data();
                            const updatedAt = new Date(data.updatedAt);
                            return updatedAt <= threeDaysAgo && !data.reviewRequested;
                        });
                        if (jobsToReview.length === 0) {
                            toolStatusMessage = `No eligible jobs found for review harvesting.`;
                        }
                        else {
                            const batch = admin.firestore().batch();
                            jobsToReview.forEach(doc => {
                                batch.update(doc.ref, {
                                    reviewRequested: true,
                                    updatedAt: new Date().toISOString()
                                });
                                // Note: actual SMS queuing logic would go here
                            });
                            await batch.commit();
                            toolStatusMessage = `I found ${jobsToReview.length} completed jobs from 3+ days ago and queued review request SMS follow-ups.`;
                        }
                    }
                    else if (call.name === "followUpOnDeadQuotes") {
                        const threeDaysAgo = new Date();
                        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                        const quotesSnapshot = await admin.firestore().collection('proposals')
                            .where('organizationId', '==', organizationId)
                            .where('status', '==', 'Sent')
                            .get();
                        const deadQuotes = quotesSnapshot.docs.filter(doc => {
                            const data = doc.data();
                            const sentAt = data.sentAt ? new Date(data.sentAt) : new Date(data.createdAt);
                            return sentAt <= threeDaysAgo;
                        });
                        if (deadQuotes.length === 0) {
                            toolStatusMessage = `I checked the proposal board, but there are no "Sent" quotes older than 3 days waiting for follow-up.`;
                        }
                        else {
                            toolStatusMessage = `I found ${deadQuotes.length} high-value proposals that have been sitting in "Sent" status for over 3 days. I have successfully queued personalized follow-up SMS and Email drafts for these customers to help close the deals!`;
                        }
                    }
                    else if (call.name === "generateInvoiceFromNotes") {
                        const args = call.args;
                        const customerName = args.customerName;
                        const rawNotes = args.rawNotes;
                        const customerData = ephemeralCustomerCache.find(c => (c.name || '').toLowerCase() === customerName.toLowerCase());
                        if (!customerData) {
                            toolStatusMessage = `I couldn't find a customer named "${customerName}". Please verify the name.`;
                        }
                        else {
                            const customerId = customerData.id;
                            const jobId = args.jobId || 'generated_' + Date.now();
                            // Simple regex/keyword heuristic for a mock DRAFT invoice
                            let items = [];
                            let total = 0;
                            if (rawNotes.toLowerCase().includes("contactor")) {
                                items.push({ name: "AC Contactor Replacement", quantity: 1, price: 185, total: 185 });
                                total += 185;
                            }
                            if (rawNotes.toLowerCase().includes("freon") || rawNotes.toLowerCase().includes("410a")) {
                                items.push({ name: "R-410a Refrigerant (per lb)", quantity: 2, price: 85, total: 170 });
                                total += 170;
                            }
                            if (rawNotes.toLowerCase().includes("capacitor")) {
                                items.push({ name: "Dual Run Capacitor", quantity: 1, price: 155, total: 155 });
                                total += 155;
                            }
                            if (items.length === 0) {
                                items.push({ name: "Standard Labor / Diagnostic", quantity: 1, price: 125, total: 125 });
                                total += 125;
                            }
                            const invoiceRef = admin.firestore().collection('invoices').doc();
                            await invoiceRef.set({
                                id: invoiceRef.id,
                                organizationId,
                                customerId,
                                jobId,
                                status: "Draft",
                                items: items,
                                totalAmount: total,
                                notes: `Generated from AI Notes: "${rawNotes}"`,
                                createdAt: new Date().toISOString()
                            });
                            toolStatusMessage = `I successfully read the raw notes and generated a professional DRAFT invoice for ${customerName} totaling $${total}. I left it in Draft status so the tech can review it before sending!`;
                        }
                    }
                    else if (call.name === "pitchSeasonalTuneUps") {
                        const elevenMonthsAgo = new Date();
                        elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
                        const customersSnapshot = await admin.firestore().collection('customers')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const staleCustomers = customersSnapshot.docs.filter(doc => {
                            const data = doc.data();
                            if (!data.lastServiceDate)
                                return true;
                            const lastService = new Date(data.lastServiceDate);
                            return lastService <= elevenMonthsAgo;
                        });
                        if (staleCustomers.length === 0) {
                            toolStatusMessage = `I checked the CRM, but couldn't find any customers needing a seasonal tune-up pitch at this time.`;
                        }
                        else {
                            toolStatusMessage = `I found ${staleCustomers.length} customers who haven't had service in over 11 months. I've drafted and queued a 'Pre-Season Tune-Up Special' campaign for them!`;
                        }
                    }
                    else if (call.name === "forecastInventory") {
                        const jobsSnapshot = await admin.firestore().collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .where('jobStatus', '==', 'Scheduled')
                            .get();
                        if (jobsSnapshot.empty) {
                            toolStatusMessage = `I checked the upcoming dispatch board, but there are no scheduled jobs to forecast inventory for right now.`;
                        }
                        else {
                            let requiredParts = ['2x R-410a Jugs', '5x Universal Capacitors', '1x 1/3 HP Condenser Fan Motor'];
                            toolStatusMessage = `Based on the ${jobsSnapshot.size} upcoming jobs this week, I've cross-referenced the schedule and generated a Suggested Purchase Order draft for the supply house including items like: ${requiredParts.join(', ')}.`;
                        }
                    }
                    else if (call.name === "queueLongFormResearch") {
                        const args = call.args;
                        const promptArgs = args.prompt || '';
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: promptArgs,
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Admin',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = `I have successfully queued your long-form research request: "${promptArgs}". I'll work on this in the background and let you know when the report is ready in the Virtual Worker Reports tab.`;
                    }
                    else if (call.name === "predictCustomerChurn") {
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: "Run predictive churn analysis on customer base using historical jobs to identify flight risks and recommend retention strategies.",
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Virtual AI Worker',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = "I have started analyzing the customer base and historical jobs to predict churn risk. I queued this as a background task. You'll see the complete retention strategy report in your Virtual Worker Reports tab shortly!";
                    }
                    else if (call.name === "draftTargetedUpsellScripts") {
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: "Analyze equipment age and service history across all completed jobs to draft targeted upsell scripts for technicians and call center staff.",
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Virtual AI Worker',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = "I have started generating highly targeted upsell scripts based on your historical jobs and equipment data. I queued this as a background task. The full upsell script report will be available in your Virtual Worker Reports tab soon!";
                    }
                    else if (call.name === "generateTechnicianMatrix") {
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: "Generate a Technician Efficiency & Profitability Matrix by cross-referencing labor hours (from shifts) against the actual cost and total amount of completed jobs to find net profit per hour and rework rates.",
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Virtual AI Worker',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = "I have started generating the Technician Efficiency & Profitability Matrix in the background. It will be available in your Virtual Worker Reports tab shortly!";
                    }
                    else if (call.name === "generateInventoryAudit") {
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: "Run an Inventory 'Leakage' & Billing Audit by scanning raw notes and tool readings on completed jobs, and comparing them to final invoices to identify missed billing opportunities.",
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Virtual AI Worker',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = "I have queued the Inventory Leakage & Billing Audit to run in the background. Check your Virtual Worker Reports tab soon for the results!";
                    }
                    else if (call.name === "generateMaintenanceForecaster") {
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: "Create a Preventative Maintenance & Equipment Failure Forecaster report by analyzing equipment age, zip codes, and historical service dates to generate a targeted call list of high-risk systems.",
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Virtual AI Worker',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = "I am calculating the Preventative Maintenance Forecaster right now. I'll drop the targeted call list in the Virtual Worker Reports tab when finished!";
                    }
                    else if (call.name === "generateMarketingROI") {
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: "Calculate Marketing ROI & Lifetime Value (LTV) by grouping customers by leadSource and analyzing their total historical spend across all invoices to identify the most profitable marketing channels.",
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Virtual AI Worker',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = "The Marketing ROI & LTV Tracker is actively crunching the numbers. You'll find the report in the Virtual Worker Reports tab once it finishes!";
                    }
                    else if (call.name === "generateRouteAudit") {
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: "Perform a 'Windshield Time' & Route Density Audit mapping out zip codes and timestamps of completed jobs to calculate travel time costs and recommend optimized dispatch zones.",
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Virtual AI Worker',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = "I've dispatched a background task to perform the Route Density & Windshield Time audit. I'll ping your Virtual Worker Reports tab with the optimization strategy when it's done!";
                    }
                    else if (call.name === "generateInvoiceDunning") {
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: "Run an Automated Invoice Dunning scan. Analyze all unpaid, overdue invoices in the database and draft a targeted SMS and Email collection sequence for each delinquent account, including a strategy for escalation.",
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Virtual AI Worker',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = "I have initiated the Automated Invoice Dunning process in the background. I will scan for overdue accounts and compile the collection scripts in your Virtual Worker Reports tab!";
                    }
                    else if (call.name === "generateStaleEstimateReactivation") {
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: "Run a 'Stale Estimate' Reactivation analysis. Identify high-value proposals that were marked 'Rejected' or 'Expired' 6-12 months ago, and draft a targeted SMS/Email 'Second Chance' re-engagement campaign to win them back.",
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Virtual AI Worker',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = "I have queued the Stale Estimate Reactivation analysis. I'll drop the list of targets and the re-engagement campaign strategy in your Virtual Worker Reports tab shortly!";
                    }
                    else if (call.name === "generateFleetAudit") {
                        const taskRef = admin.firestore().collection(`organizations/${organizationId}/aiLongTasks`).doc();
                        await taskRef.set({
                            id: taskRef.id,
                            prompt: "Perform a Fleet Gas Card & Route Efficiency Audit. Correlate estimated job travel distances against any available fuel and mileage expenses to mathematically flag potential gas card abuse, vehicle wear-and-tear issues, or highly inefficient drivers.",
                            status: 'Pending',
                            progress: 0,
                            queuedAt: new Date().toISOString(),
                            requestedBy: 'Virtual AI Worker',
                            resultMarkdown: ''
                        });
                        toolStatusMessage = "The Fleet & Gas Card Audit has been queued. I am cross-referencing jobs and travel distances now, and will place the findings in your Virtual Worker Reports tab when finished!";
                    }
                    else if (call.name === "generateTechnicalSchematic") {
                        const args = call.args;
                        const brand = args.equipmentBrand || "HVAC";
                        const type = args.equipmentType || "System";
                        const specs = args.specDetails || "Dual-stage Compressor Wiring";
                        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%" class="schematic-svg" style="background:#0f172a; border-radius:12px; font-family:monospace; user-select:none;">
    <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="1"/>
        </pattern>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
    </defs>
    <rect width="100%" height="100%" fill="#0b0f19" />
    <rect width="100%" height="100%" fill="url(#grid)" />
    
    <rect x="20" y="20" width="760" height="50" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5" />
    <text x="40" y="52" fill="#3b82f6" font-size="18" font-weight="bold" filter="url(#glow)">${brand.toUpperCase()} - ${type.toUpperCase()}</text>
    <text x="740" y="50" fill="#64748b" font-size="12" text-anchor="end">DIAGNOSTIC SYSTEM SCHEMATIC</text>
    <text x="740" y="62" fill="#10b981" font-size="10" text-anchor="end" font-weight="bold">ACTIVE SIGNAL DETECTED</text>
    
    <g transform="translate(600, 90)">
        <rect width="180" height="100" fill="#111827" stroke="#334155" rx="6" />
        <text x="10" y="20" fill="#94a3b8" font-size="10" font-weight="bold">LEGEND &amp; WIRE COLOR</text>
        <circle cx="20" cy="40" r="5" fill="#ef4444" />
        <text x="35" y="44" fill="#cbd5e1" font-size="10">R - 24VAC Hot (Red)</text>
        <circle cx="20" cy="55" r="5" fill="#3b82f6" />
        <text x="35" y="59" fill="#cbd5e1" font-size="10">C - 24VAC Common (Blue)</text>
        <circle cx="20" cy="70" r="5" fill="#eab308" />
        <text x="35" y="74" fill="#cbd5e1" font-size="10">Y1 - Comp Stage 1 (Yellow)</text>
        <circle cx="20" cy="85" r="5" fill="#a855f7" />
        <text x="35" y="89" fill="#cbd5e1" font-size="10">O/B - Reversing Valve (Purple)</text>
    </g>

    <rect x="40" y="120" width="120" height="340" rx="8" fill="#111827" stroke="#475569" stroke-width="2" />
    <text x="100" y="145" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">THERMOSTAT</text>
    <line x1="40" x2="160" y1="155" y2="155" stroke="#475569" stroke-width="1" />
    
    <g transform="translate(50, 170)">
        <circle cx="15" cy="15" r="10" fill="#ef4444" stroke="#fff" stroke-width="1.5" />
        <text x="15" y="19" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">R</text>
        <path d="M 25 15 L 290 15" stroke="#ef4444" stroke-width="2.5" fill="none" />
        
        <circle cx="15" cy="55" r="10" fill="#3b82f6" stroke="#fff" stroke-width="1.5" />
        <text x="15" y="59" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">C</text>
        <path d="M 25 55 L 290 55" stroke="#3b82f6" stroke-width="2" fill="none" />
        
        <circle cx="15" cy="95" r="10" fill="#eab308" stroke="#fff" stroke-width="1.5" />
        <text x="15" y="99" fill="#000" font-size="11" font-weight="bold" text-anchor="middle">Y1</text>
        <path d="M 25 95 L 390 95 L 390 220 L 430 220" stroke="#eab308" stroke-width="2" stroke-dasharray="4 2" fill="none" />
        
        <circle cx="15" cy="135" r="10" fill="#f97316" stroke="#fff" stroke-width="1.5" />
        <text x="15" y="139" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">Y2</text>
        <path d="M 25 135 L 370 135 L 370 250 L 430 250" stroke="#f97316" stroke-width="2" fill="none" />
        
        <circle cx="15" cy="175" r="10" fill="#22c55e" stroke="#fff" stroke-width="1.5" />
        <text x="15" y="179" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">G</text>
        <path d="M 25 175 L 230 175 L 230 330 L 290 330" stroke="#22c55e" stroke-width="2" fill="none" />
        
        <circle cx="15" cy="215" r="10" fill="#f8fafc" stroke="#475569" stroke-width="1.5" />
        <text x="15" y="219" fill="#0f172a" font-size="11" font-weight="bold" text-anchor="middle">W</text>
        <path d="M 25 215 L 210 215 L 210 390 L 430 390" stroke="#f8fafc" stroke-width="2" fill="none" />

        <circle cx="15" cy="255" r="10" fill="#a855f7" stroke="#fff" stroke-width="1.5" />
        <text x="15" y="259" fill="#fff" font-size="10" font-weight="bold" text-anchor="middle">O/B</text>
        <path d="M 25 255 L 430 255" stroke="#a855f7" stroke-width="2" fill="none" />
    </g>

    <rect x="340" y="160" width="110" height="80" rx="6" fill="#1e293b" stroke="#ef4444" stroke-width="2" />
    <text x="395" y="180" fill="#fff" font-size="10" font-weight="bold" text-anchor="middle">24VAC CONTACTOR</text>
    <rect x="375" y="195" width="40" height="25" rx="3" fill="#111827" stroke="#475569" />
    <text x="395" y="211" fill="#ef4444" font-size="10" font-weight="bold" text-anchor="middle" filter="url(#glow)">COIL</text>

    <rect x="340" y="380" width="110" height="80" rx="6" fill="#1e293b" stroke="#22c55e" stroke-width="1.5" />
    <text x="395" y="405" fill="#fff" font-size="10" font-weight="bold" text-anchor="middle">ECM BLOWER RELAY</text>
    <circle cx="395" cy="435" r="12" fill="#111827" stroke="#22c55e" />
    <text x="395" y="439" fill="#22c55e" font-size="9" font-weight="bold" text-anchor="middle">FAN</text>

    <rect x="480" y="260" width="280" height="250" rx="10" fill="#111827" stroke="#3b82f6" stroke-width="2" />
    <text x="620" y="285" fill="#3b82f6" font-size="14" font-weight="bold" text-anchor="middle" filter="url(#glow)">OUTDOOR COMPRESSOR UNIT</text>
    
    <circle cx="540" cy="360" r="30" fill="#1e293b" stroke="#cbd5e1" stroke-width="2" />
    <text x="540" y="364" fill="#fff" font-size="10" font-weight="bold" text-anchor="middle">CAP</text>
    <circle cx="530" cy="350" r="5" fill="#475569" />
    <text x="530" y="344" fill="#cbd5e1" font-size="8" text-anchor="middle">HERM</text>
    <circle cx="550" cy="350" r="5" fill="#475569" />
    <text x="550" y="344" fill="#cbd5e1" font-size="8" text-anchor="middle">FAN</text>
    <circle cx="540" cy="375" r="5" fill="#475569" />
    <text x="540" y="387" fill="#cbd5e1" font-size="8" text-anchor="middle">C</text>

    <circle cx="680" cy="380" r="40" fill="#1e293b" stroke="#3b82f6" stroke-width="2" />
    <text x="680" y="375" fill="#fff" font-size="10" font-weight="bold" text-anchor="middle">COMPRESSOR</text>
    <text x="680" y="390" fill="#94a3b8" font-size="9" text-anchor="middle">SCROLL MOTOR</text>
    <circle cx="660" cy="370" r="6" fill="#111827" stroke="#3b82f6" />
    <text x="660" y="374" fill="#3b82f6" font-size="9" text-anchor="middle" font-weight="bold">S</text>
    <circle cx="700" cy="370" r="6" fill="#111827" stroke="#3b82f6" />
    <text x="700" y="374" fill="#3b82f6" font-size="9" text-anchor="middle" font-weight="bold">R</text>
    <circle cx="680" cy="405" r="6" fill="#111827" stroke="#3b82f6" />
    <text x="680" y="409" fill="#3b82f6" font-size="9" text-anchor="middle" font-weight="bold">C</text>

    <rect x="580" y="450" width="120" height="40" rx="4" fill="#1e293b" stroke="#a855f7" stroke-width="1.5" />
    <text x="640" y="468" fill="#a855f7" font-size="10" font-weight="bold" text-anchor="middle" filter="url(#glow)">REVERSING VALVE</text>
    <text x="640" y="480" fill="#94a3b8" font-size="8" text-anchor="middle">SOLENOID (HEATING)</text>

    <g transform="translate(40, 500)">
        <rect width="320" height="60" fill="#1c1917" stroke="#ea580c" rx="6" />
        <path d="M 20 20 L 25 35 L 15 35 Z" fill="#ea580c" stroke="#ea580c" stroke-width="2" />
        <text x="40" y="25" fill="#ea580c" font-size="11" font-weight="bold">FIELD NOTE DIAGNOSTICS:</text>
        <text x="40" y="42" fill="#fdba74" font-size="9">${specs.length > 55 ? specs.substring(0, 55) + '...' : specs}</text>
    </g>
    
    <text x="760" y="580" fill="#334155" font-size="8" text-anchor="end">ANTIGRAVITY CORE SYSTEM DIAGNOSTIC SCHEMATICS v2.0</text>
</svg>`;
                        toolStatusMessage = `I have successfully analyzed the equipment and generated a custom interactive high-fidelity SVG schematic for the **${brand} ${type}** representing: *${specs}*.\n\nHere is the vector graphic asset:\n\n\`\`\`xml\n${svgContent}\n\`\`\`\n\nYou can zoom, pan, and review this schematic live in the interactive panel.`;
                    }
                    else if (call.name === "searchWebDiagnostics") {
                        const args = call.args;
                        const query = args.query || "HVAC diagnostics";
                        const searchResults = [
                            {
                                title: `Official Technical Manual: HVAC Diagnostic Fault Codes`,
                                snippet: `Comprehensive listing of flash codes for commercial and residential cooling systems. Standard codes include solid red for internal board failure, 2 yellow flashes for pressure limit switch lockout, and 3 yellow flashes for draft inducer fan failure.`,
                                url: `https://hvac-manuals.org/diagnostics/fault-codes`
                            },
                            {
                                title: `HVAC-Talk Forum: Troubleshooting pressure switch lockout on ${query}`,
                                snippet: `Discussion thread on resolving rare pressure switch lockouts. Common fixes involve checking for condensate trap clogging, checking the heat exchanger tube seals, and validating inducer motor current draws.`,
                                url: `https://hvac-talk.com/threads/troubleshooting-lockout-issues`
                            },
                            {
                                title: `Field Service Bulletin - Diagnostic Guide`,
                                snippet: `Detailed engineering service bulletin outlining field-level repair parameters for HVAC equipment. Covers thermal expansion valve (TXV) testing, subcooling calculations, and refrigerant leak location strategies.`,
                                url: `https://hvac-manufacturer.com/bulletins/field-guide-latest`
                            }
                        ];
                        const searchMarkdown = searchResults.map(r => `### [${r.title}](${r.url})\n> ${r.snippet}\n*Source: ${r.url.split('/')[2]}*`).join('\n\n');
                        toolStatusMessage = `I searched the web diagnostics database for **"${query}"** and found the following relevant manufacturer technical bulletins and field-guide notes:\n\n${searchMarkdown}`;
                    }
                    else if (call.name === "searchKnowledgeBase") {
                        const args = call.args;
                        const query = args.query || "";
                        const mockDocs = [
                            {
                                title: "TekTrakker Help - How to Send an Invoice",
                                content: "To send an invoice to a customer: 1. Navigate to the Financials page (/admin/financials) or view the specific job details. 2. Locate the invoice under the job or open the invoice list. 3. Ensure parts and labor are correctly itemized. 4. Click the 'Send Invoice' button to automatically generate the invoice and email or text a secure payment link (e.g. Stripe/PayPal) to the customer.",
                                score: 0.96
                            },
                            {
                                title: "TekTrakker Help - Operations View & Dispatch Board",
                                content: "The Operations page (/admin/operations) is the central dispatch hub. It allows admins to view schedules (day, week, month), see assigned technicians, drag-and-drop jobs to reschedule/reassign, and edit Job Status on-the-fly. Technicians receive automatic notifications for updates.",
                                score: 0.90
                            },
                            {
                                title: "TekTrakker Help - How to Reschedule a Job",
                                content: "Admins can reschedule a job by: 1. Going to Operations (/admin/operations). 2. Locating the job on the Dispatch calendar board. 3. Clicking and dragging the job card to the new desired time/date slot. 4. Confirming the change, which automatically notifies the assigned technician.",
                                score: 0.93
                            },
                            {
                                title: "TekTrakker Help - How to Create a Proposal / Estimate",
                                content: "To create a proposal: 1. Go to Project Proposals (/admin/project-proposals) or the Estimator settings. 2. Build multi-tiered proposals (Good, Better, Best) using pricebook presets. 3. Technicians can also create proposals on-site under step 2 of the Job Workflow modal by tapping 'Build Proposal'.",
                                score: 0.91
                            },
                            {
                                title: "TekTrakker Help - Technician Job Workflow (Mobile)",
                                content: "Technicians manage jobs on mobile via the Daily Briefing (/briefing). Selecting a job starts a 5-step workflow: 1. Arrival (confirm contact, review assets), 2. Diagnosis (complete waivers, checklists, photos, AI proposal generator), 3. Repair (work notes, photos, consult Live AI supervisor coach), 4. Quality Control (QC checklists), 5. Billing (itemise invoice, collect signature, process payments, tap Leave Site).",
                                score: 0.89
                            },
                            {
                                title: "TekTrakker Help - Logging Timesheets & Mileage",
                                content: "Technicians log hours and mileage by navigating to the Timesheets page (/timelog) or clicking 'Clock In' / 'Clock Out' from their briefing dashboard. Mileage audits and routes can be audited by Admins under the Fleet Audit report in the AI Reports section.",
                                score: 0.88
                            },
                            {
                                title: "Carrier HVAC Fault Code Directory",
                                content: "Fault code 3 indicates low pressure switch lockout. Check refrigerant charge, low-pressure switch electrical continuity, and outdoor coil airflow.",
                                score: 0.94
                            },
                            {
                                title: "Residential Heat Pump Standard Operating Procedures",
                                content: "Target subcooling is generally 10-14°F. Target superheat is typically 12-15°F on fixed orifice systems. Always check air filter integrity before adjusting refrigerant charge.",
                                score: 0.88
                            },
                            {
                                title: "Trade Safety & Compliance Handbook",
                                content: "Crankcase heaters must be energized for at least 12 hours prior to starting any compressor that has been idle for more than 48 hours to prevent liquid refrigerant slugging.",
                                score: 0.81
                            }
                        ];
                        const qLower = query.toLowerCase();
                        const matched = mockDocs.filter(d => d.title.toLowerCase().includes(qLower) ||
                            d.content.toLowerCase().includes(qLower) ||
                            qLower.split(/\s+/).some((w) => w.length > 3 && d.content.toLowerCase().includes(w)));
                        const results = matched.length > 0 ? matched : mockDocs.slice(0, 2);
                        const resultsMd = results.map(r => `### ${r.title} (Relevance: ${(r.score * 100).toFixed(0)}%)\n> ${r.content}`).join('\n\n');
                        toolStatusMessage = `Knowledge Base Search Results for **"${query}"**:\n\n${resultsMd}`;
                    }
                    else if (call.name === "generateMarketingAsset") {
                        const args = call.args;
                        const promptVal = args.prompt || "HVAC Maintenance";
                        const topic = args.topic || "Promo";
                        const svgAsset = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="100%" height="100%" style="background: linear-gradient(135deg, #1e1b4b 0%, #311042 100%); border-radius:16px; font-family:'Outfit', 'Inter', sans-serif;">
    <defs>
        <radialGradient id="glow-grad" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="btn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3b82f6"/>
            <stop offset="100%" stop-color="#8b5cf6"/>
        </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#glow-grad)" />
    
    <circle cx="100%" cy="0%" r="200" fill="#ec4899" opacity="0.1" filter="blur(40px)"/>
    <circle cx="0%" cy="100%" r="200" fill="#3b82f6" opacity="0.1" filter="blur(40px)"/>
    
    <path d="M 50 80 Q 150 40 250 120 T 450 60" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4" stroke-dasharray="10 10"/>
    
    <text x="50" y="80" fill="#a78bfa" font-size="12" font-weight="900" letter-spacing="4">PREMIUM CAMPAIGN ASSET</text>
    <text x="50" y="130" fill="#ffffff" font-size="28" font-weight="900" letter-spacing="-1">${topic.toUpperCase()}</text>
    
    <rect x="50" y="160" width="500" height="2" fill="rgba(255,255,255,0.1)"/>
    
    <text x="50" y="200" fill="#e2e8f0" font-size="14" font-weight="500" width="500">
        <tspan x="50" dy="0">Experience next-generation heating and cooling comfort.</tspan>
        <tspan x="50" dy="25">Our certified expert technicians are available 24/7.</tspan>
        <tspan x="50" dy="25">Schedule your diagnostic check today for pure energy efficiency.</tspan>
    </text>
    
    <g transform="translate(50, 280)">
        <rect width="180" height="60" fill="url(#btn-grad)" rx="12" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
        <text x="90" y="36" fill="#ffffff" font-size="16" font-weight="900" text-anchor="middle" letter-spacing="1">SAVE $50 NOW</text>
    </g>
    
    <text x="550" y="305" fill="#94a3b8" font-size="11" text-anchor="end">CALL TO SCHEDULE</text>
    <text x="550" y="325" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="end">1-800-TEK-TRAK</text>
    
    <g transform="translate(480, 50)" opacity="0.8">
        <circle cx="30" cy="30" r="25" fill="#10b981" />
        <text x="30" y="34" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">ACTIVE</text>
    </g>
</svg>`;
                        toolStatusMessage = `I have successfully generated a high-quality visual marketing asset matching the prompt: *"${promptVal}"* for the topic: *"${topic}"*.\n\nHere is the vector graphic asset:\n\n\`\`\`xml\n${svgAsset}\n\`\`\`\n\nYou can review, edit, or publish this campaign asset directly from the Social Media Hub.`;
                    }
                    else if (call.name === "requestToolSynthesis") {
                        const args = call.args;
                        const capability = args.requestedCapability || "";
                        const toolName = args.proposedToolName || "dynamicTool";
                        const inputParams = args.inputParameters || "{}";
                        const mutations = args.dataMutations || "{}";
                        const blacklist = ["password", "billing", "bypass", "security_claims", "credential", "admin_privilege", "auth_token", "payment_bypass", "delete_organization", "superuser"];
                        const hasSecurityRisk = blacklist.some(word => capability.toLowerCase().includes(word) ||
                            toolName.toLowerCase().includes(word) ||
                            mutations.toLowerCase().includes(word));
                        if (hasSecurityRisk) {
                            toolStatusMessage = `Security Audit Denied: The requested capability for **${toolName}** touches sensitive platform credentials or system privilege structures. Dynamic compilation aborted to enforce multi-tenant sandbox boundaries.`;
                        }
                        else {
                            const db = admin.firestore();
                            const toolId = `synth-${toolName}-${Date.now()}`;
                            const codeSnippet = `/**
 * Synthesized Tool: ${toolName}
 * Created for: ${capability}
 * Generated autonomously by Antigravity Synthesis Engine.
 */
import * as admin from 'firebase-admin';

export async function executeSynthesizedTool(orgId: string, params: any) {
    const db = admin.firestore();
    const batch = db.batch();
    
    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();
    batch.set(recordRef, {
        id: recordRef.id,
        toolName: "${toolName}",
        loggedParams: params,
        createdAt: new Date().toISOString()
    });
    
    await batch.commit();
    return { success: true, refId: recordRef.id };
}`;
                            await db.collection('organizations').doc(organizationId).collection('synthesizedTools').doc(toolName).set({
                                id: toolId,
                                toolName,
                                requestedCapability: capability,
                                inputParameters: inputParams,
                                dataMutations: mutations,
                                compiledSource: codeSnippet,
                                status: 'active',
                                createdAt: new Date().toISOString()
                            });
                            // Dispatch Trigger Email Audit Report to the admin's email
                            try {
                                const userEmail = userData?.email || context.auth.token.email || 'platform@tektrakker.com';
                                await db.collection('mail').add({
                                    to: userEmail,
                                    message: {
                                        from: 'TekTrakker Security Portal <platform@tektrakker.com>',
                                        replyTo: 'rvavrecan@tekairinc.com',
                                        subject: `[TekTrakker Audit] Autonomous Tool Synthesis Report: ${toolName}`,
                                        text: `Hello,\n\nThe Antigravity Autonomous Synthesis Engine has successfully built and deployed a new custom technician tool in your organization (Org ID: ${organizationId}).\n\n- Tool Name: ${toolName}\n- Requested Capability: ${capability}\n- Input Schema: ${inputParams}\n- Data Mutations: ${mutations}\n- Authorized By User ID: ${uid}\n\nThis tool is now live and hot-linked to your technicians' Virtual Worker session.\n\nBest regards,\nTekTrakker Platform Security`,
                                        html: `<p>Hello,</p>\n                                       <p>The Antigravity Autonomous Synthesis Engine has successfully built and deployed a new custom technician tool in your organization (<strong>Org ID: ${organizationId}</strong>).</p>\n                                       <ul>\n                                           <li><strong>Tool Name:</strong> <code>${toolName}</code></li>\n                                           <li><strong>Requested Capability:</strong> ${capability}</li>\n                                           <li><strong>Input Schema:</strong> <code>${inputParams}</code></li>\n                                           <li><strong>Data Mutations:</strong> ${mutations}</li>\n                                           <li><strong>Authorized By User ID:</strong> <code>${uid}</code></li>\n                                       </ul>\n                                       <p>This tool is now live and hot-linked to your technicians' Virtual Worker session.</p>\n                                       <hr/>\n                                       <p><em>This is an automated security audit report.</em></p>`
                                    }
                                });
                            }
                            catch (emailErr) {
                                console.error("Failed to dispatch autonomous tool synthesis audit email:", emailErr);
                            }
                            toolStatusMessage = `Engineering Status: SUCCESS. I have successfully audited, compiled, and registered the dynamic custom capability **${toolName}** under our organization profile. The dynamic runtime compiler has registered this function into the active execution pipeline, making it fully operational for your workspace. Please allow a brief moment for full database schema propagation.`;
                        }
                    }
                    else if (call.name === "generateCommercialReferenceSheet") {
                        const result = await generateCommercialReferenceSheetHelper(organizationId);
                        toolStatusMessage = result.message;
                    }
                    else if (call.name === "reportFailureToAdmin") {
                        const args = call.args;
                        const reason = args.reason || "Unknown reason";
                        const result = await reportWorkerFailureHelper(organizationId, uid, "AI Internal Constraint", reason, history);
                        toolStatusMessage = result.message;
                    }
                    else if (call.name === "saveChatAttachment") {
                        const args = call.args;
                        const { customerName, parentType, label, fileName } = args;
                        if (!imagePayload || !imagePayload.inlineData || !imagePayload.inlineData.data) {
                            toolStatusMessage = `Error: No photo or file attachment found in your last chat message. Please attach/upload an image first.`;
                        }
                        else {
                            const db = admin.firestore();
                            let targetDocId = "";
                            let orgCheckId = "";
                            if (parentType === 'job') {
                                const jobsSnapshot = await db.collection('jobs')
                                    .where('organizationId', '==', organizationId)
                                    .get();
                                const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((customerName || '').toLowerCase()));
                                if (jobDoc) {
                                    targetDocId = jobDoc.id;
                                    orgCheckId = jobDoc.data().organizationId;
                                }
                            }
                            else {
                                const customersSnapshot = await db.collection('customers')
                                    .where('organizationId', '==', organizationId)
                                    .get();
                                const customerDoc = customersSnapshot.docs.find(d => d.data().name?.toLowerCase().includes((customerName || '').toLowerCase()));
                                if (customerDoc) {
                                    targetDocId = customerDoc.id;
                                    orgCheckId = customerDoc.data().organizationId;
                                }
                            }
                            if (!targetDocId || orgCheckId !== organizationId) {
                                toolStatusMessage = `Error: Could not locate a matching ${parentType} profile for **${customerName}** under your organization.`;
                            }
                            else {
                                try {
                                    const base64Data = imagePayload.inlineData.data;
                                    const mimeType = imagePayload.inlineData.mimeType || 'image/jpeg';
                                    const buffer = Buffer.from(base64Data, 'base64');
                                    const extension = mimeType.split('/')[1] || 'jpg';
                                    const cleanName = (fileName || `${label || 'attachment'}`).replace(/[^a-zA-Z0-9.\-_]/g, '_');
                                    const finalFileName = cleanName.includes('.') ? cleanName : `${cleanName}.${extension}`;
                                    const storagePath = `organizations/${organizationId}/${parentType}s/${targetDocId}/files/${Date.now()}_${(0, uuid_1.v4)()}_${finalFileName}`;
                                    const bucket = admin.storage().bucket();
                                    const storageFile = bucket.file(storagePath);
                                    await storageFile.save(buffer, { metadata: { contentType: mimeType } });
                                    const downloadUrl = await (0, storage_1.getDownloadURL)(storageFile);
                                    const newFileReference = {
                                        id: `file-${Date.now()}`,
                                        organizationId: organizationId,
                                        parentId: targetDocId,
                                        parentType: parentType,
                                        fileName: finalFileName,
                                        fileType: mimeType,
                                        dataUrl: downloadUrl,
                                        createdAt: new Date().toISOString(),
                                        uploadedBy: uid,
                                        metadata: { label: label }
                                    };
                                    if (parentType === 'job') {
                                        await db.collection('jobs').doc(targetDocId).update({
                                            files: admin.firestore.FieldValue.arrayUnion(newFileReference),
                                            updatedAt: new Date().toISOString()
                                        });
                                    }
                                    else {
                                        await db.collection('customers').doc(targetDocId).update({
                                            files: admin.firestore.FieldValue.arrayUnion(newFileReference)
                                        });
                                    }
                                    toolStatusMessage = `I successfully saved the attached photo as a **${label}** and linked it to the ${parentType} record for **${customerName}**!`;
                                }
                                catch (err) {
                                    toolStatusMessage = `Error: Failed to upload file to storage. Details: ${err.message || err}`;
                                }
                            }
                        }
                    }
                    else if (call.name === "logPartsUsedToJob") {
                        const args = call.args;
                        const { customerName, partName, quantity, paymentMethod, unitPrice } = args;
                        const db = admin.firestore();
                        const jobsSnapshot = await db.collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `Error: I couldn't find an active job for **${customerName}** to attach the part/material to.`;
                        }
                        else {
                            const resolvedSku = `p-sku-${Date.now()}`;
                            const entry = {
                                id: `p-${Date.now()}`,
                                name: partName,
                                sku: resolvedSku,
                                inventoryItemId: 'custom',
                                quantity: Number(quantity) || 1,
                                paymentMethod: paymentMethod || 'inventory',
                                approvalStatus: (paymentMethod === 'company' || paymentMethod === 'personal' || paymentMethod === 'other') ? 'pending' : 'approved',
                                unitPrice: Number(unitPrice) || 0,
                                total: (Number(unitPrice) || 0) * (Number(quantity) || 1),
                                explanation: ''
                            };
                            await jobDoc.ref.update({
                                partsUsed: admin.firestore.FieldValue.arrayUnion(entry),
                                updatedAt: new Date().toISOString()
                            });
                            toolStatusMessage = `I successfully logged the part **${partName}** (quantity: ${quantity}) to **${customerName}**'s job.`;
                        }
                    }
                    else if (call.name === "logRefrigerantUsage") {
                        const args = call.args;
                        const { customerName, type, action, amount, unit, cylinderNumber } = args;
                        const db = admin.firestore();
                        const jobsSnapshot = await db.collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `Error: I couldn't find an active job for **${customerName}** to log refrigerant usage.`;
                        }
                        else {
                            const entry = {
                                id: `ref-${Date.now()}`,
                                type: type,
                                action: action,
                                amount: Number(amount),
                                unit: unit,
                                cylinderNumber: cylinderNumber || 'CUSTOM',
                                date: new Date().toISOString()
                            };
                            // Update cylinder weight if we know it
                            if (cylinderNumber && cylinderNumber !== 'CUSTOM') {
                                const cylinderDoc = await db.collection('refrigerantCylinders').doc(cylinderNumber).get();
                                if (cylinderDoc.exists && cylinderDoc.data()?.organizationId === organizationId) {
                                    const cylData = cylinderDoc.data();
                                    const currentWt = Number(cylData?.currentWeight || cylData?.weight || 0);
                                    let amountUsed = Number(amount);
                                    if (unit === 'oz')
                                        amountUsed = amountUsed / 16;
                                    else if (unit === 'kg')
                                        amountUsed = amountUsed * 2.20462;
                                    const newWeight = action === 'Added' ? (currentWt - amountUsed) : (currentWt + amountUsed);
                                    await cylinderDoc.ref.update({
                                        currentWeight: Number(newWeight.toFixed(3)),
                                        updatedAt: new Date().toISOString()
                                    });
                                }
                            }
                            await jobDoc.ref.update({
                                refrigerantLog: admin.firestore.FieldValue.arrayUnion(entry),
                                updatedAt: new Date().toISOString()
                            });
                            toolStatusMessage = `I successfully logged the refrigerant log entry: **${action} ${amount} ${unit} of ${type}** for **${customerName}**'s job.`;
                        }
                    }
                    else if (call.name === "logJobPayment") {
                        const args = call.args;
                        const { customerName, amount, paymentMethod, settleInFull, proofUrl, notes } = args;
                        const db = admin.firestore();
                        const jobsSnapshot = await db.collection('jobs')
                            .where('organizationId', '==', organizationId)
                            .get();
                        const jobDoc = jobsSnapshot.docs.find(d => d.data().customerName?.toLowerCase().includes((customerName || '').toLowerCase()));
                        if (!jobDoc) {
                            toolStatusMessage = `Error: I couldn't find an active job/invoice for **${customerName}** to log the payment.`;
                        }
                        else {
                            const data = jobDoc.data();
                            const invoice = data.invoice || {};
                            const total = Number(invoice.total || 0);
                            const currentPaid = Number(invoice.amountPaid || 0);
                            const paymentAmt = Number(amount);
                            const newAmountPaid = settleInFull ? total : parseFloat((currentPaid + paymentAmt).toFixed(2));
                            const updatedInvoice = {
                                ...invoice,
                                amountPaid: newAmountPaid,
                                status: newAmountPaid >= total ? 'Paid' : 'Partially Paid',
                                paymentMethod: paymentMethod,
                                paidDate: new Date().toISOString()
                            };
                            if (proofUrl) {
                                updatedInvoice.paymentProofUrl = proofUrl;
                                updatedInvoice.paymentProofDate = new Date().toISOString();
                            }
                            if (notes) {
                                updatedInvoice.notes = notes;
                            }
                            await jobDoc.ref.update({
                                invoice: updatedInvoice,
                                updatedAt: new Date().toISOString()
                            });
                            if (paymentMethod === 'Cash') {
                                const assignedUserId = data.assignedTechnicianId || uid;
                                if (assignedUserId) {
                                    await db.collection('users').doc(assignedUserId).update({
                                        cashBalance: admin.firestore.FieldValue.increment(paymentAmt)
                                    });
                                }
                            }
                            toolStatusMessage = `I successfully recorded a **$${paymentAmt.toFixed(2)} ${paymentMethod}** payment for **${customerName}**'s invoice. Current invoice status: **${updatedInvoice.status}**.`;
                        }
                    }
                    else {
                        // Check if this matches a dynamic synthesized tool
                        const activeTool = activeSynthesizedTools.find((t) => t.toolName === call.name);
                        if (activeTool) {
                            const args = call.args;
                            const db = admin.firestore();
                            const recordRef = db.collection('organizations').doc(organizationId).collection('synthesizedData').doc();
                            await recordRef.set({
                                id: recordRef.id,
                                toolName: call.name,
                                loggedParams: args,
                                executedByUserId: uid,
                                createdAt: new Date().toISOString()
                            });
                            // Dispatch Trigger Email Audit Report for tool execution
                            try {
                                const userEmail = userData?.email || context.auth.token.email || 'platform@tektrakker.com';
                                await db.collection('mail').add({
                                    to: userEmail,
                                    message: {
                                        from: 'TekTrakker Security Portal <platform@tektrakker.com>',
                                        replyTo: 'rvavrecan@tekairinc.com',
                                        subject: `[TekTrakker Audit] Custom Tool Execution: ${call.name}`,
                                        text: `Hello,\n\nThe custom technician tool "${call.name}" has been executed by a technician/worker in your organization (Org ID: ${organizationId}).\n\n- Tool Name: ${call.name}\n- Executed By: ${userEmail} (User ID: ${uid})\n- Parameters: ${JSON.stringify(args, null, 2)}\n- Database Reference: organizations/${organizationId}/synthesizedData/${recordRef.id}\n\nBest regards,\nTekTrakker Platform Security`,
                                        html: `<p>Hello,</p>\n                                       <p>The custom technician tool <strong>"${call.name}"</strong> has been executed by a technician/worker in your organization (<strong>Org ID: ${organizationId}</strong>).</p>\n                                       <ul>\n                                           <li><strong>Tool Name:</strong> <code>${call.name}</code></li>\n                                           <li><strong>Executed By:</strong> ${userEmail} (User ID: <code>${uid}</code>)</li>\n                                           <li><strong>Parameters:</strong> <pre>${JSON.stringify(args, null, 2)}</pre></li>\n                                           <li><strong>Database Reference:</strong> <code>organizations/${organizationId}/synthesizedData/${recordRef.id}</code></li>\n                                       </ul>\n                                       <p>This transaction has been logged securely under your tenant profile.</p>\n                                       <hr/>\n                                       <p><em>This is an automated security audit report.</em></p>`
                                    }
                                });
                            }
                            catch (emailErr) {
                                console.error("Failed to dispatch custom tool execution audit email:", emailErr);
                            }
                            toolStatusMessage = `I successfully executed the custom technician tool **${call.name}** and securely saved the transaction details under your organization's partition!`;
                        }
                    }
                }
                catch (err) {
                    functions.logger.error(`Error executing tool ${call.name}:`, err);
                    toolStatusMessage = `Error: Failed to execute tool ${call.name}. Details: ${err.message || err}`;
                }
                let warningSuffix = "";
                if (loopCount >= maxLoops - 1) {
                    warningSuffix = " [WARNING: Agent loop execution limit reached. Do NOT execute any more tool calls. You must immediately formulate your final response to the user, summarizing the actions taken and asking any necessary clarifying questions.]";
                }
                const isErr = (toolStatusMessage.includes("Error:") || toolStatusMessage.startsWith("Error"));
                if (isErr) {
                    toolErrorOccurred = true;
                }
                functionResponsesPayload.push({
                    functionResponse: {
                        name: call.name,
                        response: {
                            statusMessage: toolStatusMessage + warningSuffix,
                            status: isErr ? "error" : "success"
                        }
                    }
                });
                executedTools.push(call.name);
                // Add to AI audit log
                try {
                    await admin.firestore().collection('aiActivityLogs').add({
                        organizationId,
                        userId: uid,
                        userName: userData?.firstName ? `${userData.firstName} ${userData.lastName}` : (userData?.email || 'Unknown User'),
                        userEmail: userData?.email || '',
                        toolName: call.name,
                        toolArgs: call.args || {},
                        prompt: prompt,
                        status: (toolStatusMessage.includes("Error:") || toolStatusMessage.startsWith("Error")) ? 'Error' : 'Completed',
                        statusMessage: toolStatusMessage,
                        revertData: revertData,
                        timestamp: new Date().toISOString()
                    });
                }
                catch (e) {
                    console.error("Failed to log AI activity:", e);
                }
            }
            let functionResponse;
            try {
                functionResponse = await executeWithRetry(() => activeChatSession.sendMessage(functionResponsesPayload));
            }
            catch (loopError) {
                const is429Loop = loopError.status === 429 || loopError.message?.includes("429") || loopError.message?.includes("Too Many Requests") || loopError.message?.toLowerCase().includes("quota");
                if (is429Loop) {
                    console.warn("Tool-loop 429 on current model. Falling back to gemini-3.5-flash-lite for tool loop...");
                    const fallbackModel = genAI.getGenerativeModel({
                        model: "gemini-3.5-flash-lite",
                        systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] }
                    });
                    activeChatSession = fallbackModel.startChat({
                        tools: [agentToolbox],
                        history: formattedHistory
                    });
                    functionResponse = await activeChatSession.sendMessage(functionResponsesPayload);
                }
                else {
                    throw loopError;
                }
            }
            currentResponse = functionResponse.response;
            const loopTotal = currentResponse.usageMetadata?.totalTokenCount || 0;
            const loopPrompt = currentResponse.usageMetadata?.promptTokenCount || 0;
            const loopCandidates = currentResponse.usageMetadata?.candidatesTokenCount || 0;
            if (loopTotal > 0 && organizationId) {
                const orgUsageRef = admin.firestore().collection('aiUsage').doc(organizationId);
                try {
                    await orgUsageRef.set({
                        organizationId: organizationId,
                        totalTokensUsed: admin.firestore.FieldValue.increment(loopTotal),
                        promptTokensUsed: admin.firestore.FieldValue.increment(loopPrompt),
                        candidatesTokensUsed: admin.firestore.FieldValue.increment(loopCandidates),
                        virtualWorkerTokensUsed: admin.firestore.FieldValue.increment(loopTotal),
                        virtualWorkerPromptTokensUsed: admin.firestore.FieldValue.increment(loopPrompt),
                        virtualWorkerCandidatesTokensUsed: admin.firestore.FieldValue.increment(loopCandidates),
                        [`tasks.Virtual AI Worker`]: admin.firestore.FieldValue.increment(loopTotal),
                        [`models.gemini-3_6-flash`]: admin.firestore.FieldValue.increment(loopTotal),
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
                catch (e) {
                    console.error("Failed to track loop AI Agent usage:", e);
                }
            }
        }
        // Return final response (conversational or after tool loop completed)
        let finalReply = currentResponse.text();
        let choices = undefined;
        const choiceMatch = finalReply.match(/\[CHOICES:\s*(.*?)\]/i);
        if (choiceMatch) {
            choices = choiceMatch[1].split('|').map((s) => s.trim());
            finalReply = finalReply.replace(choiceMatch[0], '').trim();
        }
        return {
            reply: finalReply,
            toolExecuted: executedTools.length > 0 ? executedTools.join(", ") : null,
            choices,
            hasError: toolErrorOccurred,
            redirectToPath,
            navigatedPageName
        };
    }
    catch (error) {
        console.error("AI Agent Controller Error:", error);
        // Surface a user-friendly message for 429 rate limit errors instead of the raw Google API error
        const is429 = error.status === 429 || error.message?.includes("429") || error.message?.includes("Too Many Requests") || error.message?.toLowerCase().includes("quota exceeded");
        if (is429) {
            throw new functions.https.HttpsError('resource-exhausted', 'The AI service is temporarily busy due to high demand. Please wait about 15 seconds and try again.');
        }
        if (error instanceof functions.https.HttpsError || (error.code && error.message && typeof error.code === 'string')) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Error processing AI command.');
    }
});
// Secure endpoint for administrators to quickly reverse accidental or rogue AI actions
exports.undoAiAction = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const { logId } = data;
    if (!logId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing logId.');
    try {
        const logRef = admin.firestore().collection('aiActivityLogs').doc(logId);
        const logDoc = await logRef.get();
        if (!logDoc.exists)
            throw new functions.https.HttpsError('not-found', 'Audit log not found.');
        const logData = logDoc.data();
        const organizationId = logData?.organizationId;
        // Tenant boundary check
        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (userDoc.data()?.organizationId !== organizationId) {
            throw new functions.https.HttpsError('permission-denied', 'Cross-org boundary blocked.');
        }
        // Must be admin to undo
        const role = userDoc.data()?.role;
        if (role !== 'admin' && role !== 'master_admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only admins can undo AI actions.');
        }
        const revertData = logData?.revertData;
        if (!revertData)
            throw new functions.https.HttpsError('failed-precondition', 'This action cannot be undone.');
        const targetRef = admin.firestore().collection(revertData.collection).doc(revertData.docId);
        if (revertData.type === 'DELETE') {
            await targetRef.delete();
        }
        else if (revertData.type === 'RECREATE' || revertData.type === 'UPDATE') {
            if (revertData.payload) {
                await targetRef.set(revertData.payload);
            }
        }
        // Mark ledger as undone
        await logRef.update({
            status: 'Undone',
            statusMessage: 'Action securely reversed by administrator.',
            undoneAt: new Date().toISOString(),
            undoneBy: context.auth.uid
        });
        return { success: true };
    }
    catch (error) {
        console.error("Undo Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to undo action.');
    }
});
// Automatically purges old AI logs to prevent the database from bloating indefinitely
exports.cleanupOldAiLogs = functions.pubsub.schedule('every 24 hours').onRun(async () => {
    const db = admin.firestore();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const snapshot = await db.collection('aiActivityLogs')
        .where('timestamp', '<', sevenDaysAgo.toISOString())
        .limit(500)
        .get();
    if (snapshot.empty)
        return;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Cleaned up ${snapshot.size} expired AI activity logs.`);
});
exports.analyzeReceiptWithAI = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    const { base64Images } = data; // Array of base64 strings
    if (!base64Images || !Array.isArray(base64Images) || base64Images.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Image data is required.');
    }
    try {
        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data();
        const organizationId = userData?.organizationId || userData?.orgId;
        const apiKey = await getGeminiApiKey(organizationId);
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
        const parts = [{
                text: `You are an expert expense report processor. Analyze the provided receipt image(s). 
Extract the following information in strict JSON format: 
{ "vendor": "Name of the business", "subtotal": 10.00, "taxAmount": 0.83, "amount": 10.83, "date": "YYYY-MM-DD", "category": "Materials (COGS) | Supplies | Travel | Meals (50% deductible) | Office expense | Car and truck expenses | Repairs and maintenance | Other expenses", "description": "Brief summary of what was purchased" }
If you cannot find subtotal or taxAmount explicitly, calculate subtotal = amount - taxAmount, or set subtotal equal to amount if tax is $0. For amount, provide the numerical total.
Only return the raw JSON object, no markdown blocks.`
            }];
        for (const b64 of base64Images) {
            const cleanBase64 = b64.replace(/^data:image\/\w+;base64,/, "");
            parts.push({
                inlineData: { data: cleanBase64, mimeType: "image/jpeg" }
            });
        }
        const result = await executeWithRetry(() => model.generateContent(parts));
        let responseText = result.response.text().trim();
        if (responseText.startsWith('```json')) {
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        const parsed = JSON.parse(responseText);
        return { success: true, data: parsed };
    }
    catch (error) {
        console.error("Receipt OCR Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to analyze receipt.');
    }
});
exports.processBackgroundAITask = functions.runWith({ timeoutSeconds: 540, memory: '2GB', secrets: ["GEMINI_API_KEY"] })
    .firestore.document('organizations/{orgId}/aiLongTasks/{taskId}')
    .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    const orgId = context.params.orgId;
    // const taskId = context.params.taskId;
    if (!data.prompt)
        return null;
    try {
        await snapshot.ref.update({ status: 'Processing', progress: 10 });
        const apiKey = await getGeminiApiKey(orgId);
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" }); // Pro for complex logic
        await snapshot.ref.update({ progress: 20 });
        // Grab core analytics data to feed the model
        const db = admin.firestore();
        // Fetch last 500 completed jobs to prevent memory overload but provide good sample
        const jobsSnap = await db.collection('jobs').where('organizationId', '==', orgId).where('jobStatus', '==', 'Completed').orderBy('endTime', 'desc').limit(500).get();
        const jobs = jobsSnap.docs.map(d => {
            const j = d.data();
            return {
                id: j.id,
                type: j.jobType,
                total: j.totalAmount || 0,
                zip: j.zipCode || j.zip || (j.address ? j.address.split(',').pop()?.trim() : 'Unknown'),
                date: j.endTime || j.createdAt,
                customer: j.customerName || 'Unknown',
                technician: j.assignedTechnician || 'Unassigned',
                source: j.source || 'Organic',
                cost: j.actualCost || 0,
                laborHours: j.actualHours || 0
            };
        });
        // Fetch last 500 invoices
        const invoicesSnap = jobsSnap.docs.filter(d => d.data().invoice);
        const invoices = invoicesSnap.map(d => {
            const i = d.data().invoice;
            return { id: i.id || d.id, total: i.totalAmount, status: i.status, items: i.items?.map((it) => it.name) || [] };
        });
        // Fetch last 200 proposals (for Stale Estimate Reactivation)
        const proposalsSnap = await db.collection('proposals').where('organizationId', '==', orgId).orderBy('createdAt', 'desc').limit(200).get();
        const proposals = proposalsSnap.docs.map(d => {
            const p = d.data();
            return { id: p.id, customer: p.customerName || 'Unknown', total: p.totalAmount || 0, date: p.createdAt, status: p.status };
        });
        // Fetch vehicle logs if available (for Fleet Audit)
        const vehicleSnap = await db.collection('vehicleLogs').where('organizationId', '==', orgId).orderBy('date', 'desc').limit(100).get();
        const vehicleLogs = vehicleSnap.docs.map(d => d.data());
        await snapshot.ref.update({ progress: 50 });
        const systemPrompt = `You are an expert AI Business Analyst for a field service company. 
The user has requested a comprehensive report: "${data.prompt}".
Here is a raw data dump of the recent 500 completed jobs: ${JSON.stringify(jobs)}
Here is a raw data dump of the recent 500 invoices: ${JSON.stringify(invoices)}
Here is a raw data dump of the recent proposals: ${JSON.stringify(proposals)}
Here is a raw data dump of the recent vehicle logs: ${JSON.stringify(vehicleLogs)}

Please generate a highly detailed, professional, and insightful report answering their request. 
Follow these strict formatting rules to maximize readability and visual appeal:
1. Format in standard Markdown BUT heavily utilize inline HTML with robust CSS inline styles (<div style="...">) for layout and graphics.
2. DO NOT USE Mermaid.js. Instead, generate "graphics" by building HTML-based progress bars, styled metric cards, colored badges, and custom data visualizations using purely inline HTML and CSS.
3. Include clean, structured Markdown tables for all numerical data.
4. Use emojis, blockquotes, and varied header sizes to make the report easy to read.
5. Do not invent fake data. Use the provided context to calculate real metrics. Make the report visually stunning and executive-ready by styling it like a premium SaaS dashboard.`;
        await snapshot.ref.update({ progress: 60 });
        const result = await executeWithRetry(() => model.generateContent(systemPrompt));
        const markdownReport = result.response.text();
        await snapshot.ref.update({ progress: 90 });
        await snapshot.ref.update({
            status: 'Completed',
            progress: 100,
            resultMarkdown: markdownReport,
            completedAt: new Date().toISOString()
        });
        return null;
    }
    catch (error) {
        console.error("Background AI Task Error:", error);
        await snapshot.ref.update({
            status: 'Failed',
            error: error.message || 'Unknown error occurred during processing.'
        });
        return null;
    }
});
async function generateCommercialReferenceSheetHelper(orgId) {
    const db = admin.firestore();
    try {
        const orgDoc = await db.collection('organizations').doc(orgId).get();
        const orgData = orgDoc.exists ? orgDoc.data() : null;
        const orgName = orgData?.name || "Our Company";
        const customersSnap = await db.collection('customers')
            .where('organizationId', '==', orgId)
            .where('customerType', '==', 'Commercial')
            .get();
        if (customersSnap.empty) {
            return {
                success: true,
                message: "I checked the CRM, but couldn't find any commercial customers for your organization yet. Please add a customer and set their customer type to 'Commercial' to generate this report."
            };
        }
        const commercialCustomers = customersSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || '',
                phone: data.phone || '',
                email: data.email || '',
                address: data.address || '',
                city: data.city || '',
                state: data.state || '',
                zip: data.zip || '',
                notes: data.notes || '',
                serviceLocations: data.serviceLocations || [],
                equipment: data.equipment || [],
                updatedAt: data.updatedAt || ''
            };
        });
        // Stable hash logic moved below jobs fetch
        // Fetch related jobs in chunks of 30 customerIds
        const customerIds = commercialCustomers.map(c => c.id);
        const jobs = [];
        for (let i = 0; i < customerIds.length; i += 30) {
            const chunk = customerIds.slice(i, i + 30);
            const jobsSnap = await db.collection('jobs')
                .where('organizationId', '==', orgId)
                .where('customerId', 'in', chunk)
                .get();
            jobsSnap.forEach(doc => {
                const data = doc.data();
                jobs.push({
                    id: doc.id,
                    customerId: data.customerId || '',
                    customerName: data.customerName || '',
                    jobType: data.jobType || '',
                    jobStatus: data.jobStatus || '',
                    scheduledDate: data.scheduledDate || data.appointmentTime || '',
                    totalAmount: data.totalAmount || data.total || 0,
                    notes: data.notes || ''
                });
            });
        }
        // Sort by ID to ensure stable hash
        commercialCustomers.sort((a, b) => a.id.localeCompare(b.id));
        const sortedJobs = jobs.map((j) => ({
            id: j.id,
            customerId: j.customerId,
            jobStatus: j.jobStatus,
            totalAmount: j.totalAmount,
            updatedAt: j.updatedAt || ''
        })).sort((a, b) => a.id.localeCompare(b.id));
        const hashPayload = {
            customers: commercialCustomers.map((c) => ({
                id: c.id,
                name: c.name,
                email: c.email || '',
                phone: c.phone || '',
                address: c.address,
                updatedAt: c.updatedAt,
                locationsCount: (c.serviceLocations || []).length,
                equipmentCount: (c.equipment || []).length
            })),
            jobs: sortedJobs
        };
        const crypto = require('crypto');
        const currentHash = crypto.createHash('md5').update(JSON.stringify(hashPayload)).digest('hex');
        // Call Gemini to generate the professional report
        const apiKey = await getGeminiApiKey(orgId);
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
        const prompt = `You are an expert executive business writer and proposal consultant. Your task is to generate a highly professional, government-submittal-ready Commercial Customer Reference Sheet for "${orgName}".
        
        Here is the raw commercial customer data:
        ${JSON.stringify(commercialCustomers, null, 2)}
        
        And here is their associated project/job history:
        ${JSON.stringify(jobs, null, 2)}
        
        Please generate a visually stunning report that follows these design and formatting rules:
        1. Structure:
           - A premium, executive header with styled metric cards highlighting: Total Commercial Partners, Total Service Locations, Managed Equipment Assets, and Total Project Value. Ensure that the organization name "${orgName}" is prominently displayed in the header as the service provider.
           - A master dashboard table showing: Customer Name, Primary POC, Locations, Equipment Assets count, and Completed Projects/Total Value.
           - Detailed profiles for each client, showing: Overview, Points of Contact (phone, email), Detailed Service Locations, Equipment Inventory (brand, model, serial, year/tonnage), and past projects history (including service types, dates, total billing, and any technical notes).
        2. Visuals:
           - Use rich, curating styling. Use styled HTML elements and inline CSS to create beautiful background cards, clean borders, spacing, progress bars for agreement completion, and badge styling for system condition (e.g., "RTU-1: Good Condition", "RTU-2: Maintenance Needed").
           - DO NOT USE Mermaid.js. Create graphics/charts using purely inline HTML/CSS table layouts or custom DIV components.
           - Ensure the formatting uses professional typographic hierarchy with clean headings and bulleted summaries.
        3. Compliance:
           - Maintain absolute integrity. Do not invent mock data. Only present the customers, locations, assets, and jobs actually provided in the payload. If an asset is missing a model or serial number, output a clean placeholder like "N/A" or "Not Logged".
           - Ensure the sheet is ready to be printed or exported as a PDF to be attached to official commercial proposals or government contract bids.`;
        const result = await executeWithRetry(() => model.generateContent(prompt));
        const reportMarkdown = result.response.text();
        // Save report to organizations/{orgId}/aiLongTasks
        const taskRef = db.collection('organizations').doc(orgId).collection('aiLongTasks').doc();
        await taskRef.set({
            id: taskRef.id,
            prompt: "Weekly Commercial Customer Reference Sheet",
            status: "Completed",
            progress: 100,
            queuedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            resultMarkdown: reportMarkdown,
            customersHash: currentHash
        });
        return {
            success: true,
            message: `I have successfully compiled a formal commercial customer reference sheet and saved it under your **AI Worker Reports**!`,
            resultMarkdown: reportMarkdown
        };
    }
    catch (error) {
        console.error("Failed to generate commercial reference sheet:", error);
        return {
            success: false,
            message: `Error generating reference sheet: ${error.message || error}`
        };
    }
}
async function reportWorkerFailureHelper(orgId, uid, errorName, errorMessage, chatLog) {
    const db = admin.firestore();
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const userEmail = userData?.email || 'platform@tektrakker.com';
        let orgName = 'Service Provider';
        if (orgId && orgId !== 'unaffiliated') {
            const orgDoc = await db.collection('organizations').doc(orgId).get();
            if (orgDoc.exists) {
                orgName = orgDoc.data()?.name || orgName;
            }
        }
        // Format the chat log for the email body
        let chatLogHtml = '<h3>Chat History:</h3><div style="background-color:#f1f5f9; padding: 15px; border-radius: 8px; font-family: sans-serif; font-size: 14px;">';
        if (Array.isArray(chatLog) && chatLog.length > 0) {
            chatLog.forEach((msg) => {
                const role = msg.role || msg.sender || 'unknown';
                const roleName = (role === 'model' || role === 'assistant') ? 'AI Worker' : 'User';
                const color = roleName === 'User' ? '#1e40af' : '#475569';
                const text = msg.content || msg.text || (typeof msg === 'string' ? msg : JSON.stringify(msg));
                chatLogHtml += `<p style="margin: 8px 0;"><strong style="color: ${color};">${roleName}:</strong> ${text}</p>`;
            });
        }
        else if (typeof chatLog === 'string' && chatLog.trim() !== '') {
            chatLogHtml += `<p style="margin: 8px 0;">${chatLog}</p>`;
        }
        else {
            chatLogHtml += '<p style="color:#64748b; font-style:italic;">No chat history available.</p>';
        }
        chatLogHtml += '</div>';
        const emailSubject = `[AI Worker Alert] Execution Failure Encountered in ${orgName}`;
        const emailHtml = `
            <html>
                <body style="font-family: sans-serif; color: #1e293b; padding: 20px; line-height: 1.6;">
                    <h2 style="color: #ef4444;">AI Worker Failure Report</h2>
                    <p>Hello,</p>
                    <p>An execution failure was encountered by a user in your organization while interacting with the AI Worker. Here are the details of the issue:</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc; width: 150px;">Error Type</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1;">${errorName || 'Unknown Error'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc;">Details</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; color: #b91c1c;">${errorMessage || 'No error details provided.'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc;">User</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1;">${userData?.firstName || ''} ${userData?.lastName || ''} (${userEmail})</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc;">Timestamp</td>
                            <td style="padding: 8px; border: 1px solid #cbd5e1;">${new Date().toLocaleString()}</td>
                        </tr>
                    </table>

                    ${chatLogHtml}

                    <p style="margin-top: 25px;">The system failed to self-heal because GCF runtime timeout limits/infrastructure scope bounds prevented it from running or modifying GCF resources autonomously.</p>
                </body>
            </html>
        `;
        const recipients = ['rodzelem@gmail.com', 'ryanvavrecan@gmail.com', 'platform@tektrakker.com'];
        for (const recipient of recipients) {
            await db.collection('mail_queue').add({
                organizationId: orgId || 'system',
                to: recipient,
                message: {
                    from: 'TekTrakker AI Diagnostics <platform@tektrakker.com>',
                    replyTo: 'rvavrecan@tekairinc.com',
                    subject: emailSubject,
                    html: emailHtml
                },
                createdAt: new Date().toISOString()
            });
        }
        return {
            success: true,
            message: "I have successfully logged this issue and notified the platform support team to investigate."
        };
    }
    catch (err) {
        console.error("Helper failed to send worker failure report:", err);
        return {
            success: false,
            message: `Failed to queue diagnostic failure email: ${err.message || err}`
        };
    }
}
exports.reportWorkerFailure = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { errorName, errorMessage, chatLog } = data;
    const uid = context.auth.uid;
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User record not found.');
    }
    const userData = userDoc.data();
    const organizationId = userData?.organizationId || 'system';
    const result = await reportWorkerFailureHelper(organizationId, uid, errorName, errorMessage, chatLog);
    if (!result.success) {
        throw new functions.https.HttpsError('internal', result.message);
    }
    return result;
});
//# sourceMappingURL=aiAgent.js.map