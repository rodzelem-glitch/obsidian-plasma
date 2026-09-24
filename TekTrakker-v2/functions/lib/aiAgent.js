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
exports.askVirtualWorker = exports.aiAgentController = exports.reportWorkerFailure = exports.reportWorkerFailureHelper = exports.generateCommercialReferenceSheetHelper = exports.processBackgroundAITask = exports.analyzeReceiptWithAI = exports.cleanupOldAiLogs = exports.undoAiAction = exports.trackAiUsage = exports.getGeminiApiKey = void 0;
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const config_1 = require("./ai/config");
const toolbox_1 = require("./ai/toolbox");
const toolRouter_1 = require("./ai/toolRouter");
// Re-export background tasks, helper functions, and tools for external callers and index.ts
var config_2 = require("./ai/config");
Object.defineProperty(exports, "getGeminiApiKey", { enumerable: true, get: function () { return config_2.getGeminiApiKey; } });
Object.defineProperty(exports, "trackAiUsage", { enumerable: true, get: function () { return config_2.trackAiUsage; } });
var backgroundTasks_1 = require("./ai/backgroundTasks");
Object.defineProperty(exports, "undoAiAction", { enumerable: true, get: function () { return backgroundTasks_1.undoAiAction; } });
Object.defineProperty(exports, "cleanupOldAiLogs", { enumerable: true, get: function () { return backgroundTasks_1.cleanupOldAiLogs; } });
Object.defineProperty(exports, "analyzeReceiptWithAI", { enumerable: true, get: function () { return backgroundTasks_1.analyzeReceiptWithAI; } });
Object.defineProperty(exports, "processBackgroundAITask", { enumerable: true, get: function () { return backgroundTasks_1.processBackgroundAITask; } });
Object.defineProperty(exports, "generateCommercialReferenceSheetHelper", { enumerable: true, get: function () { return backgroundTasks_1.generateCommercialReferenceSheetHelper; } });
Object.defineProperty(exports, "reportWorkerFailureHelper", { enumerable: true, get: function () { return backgroundTasks_1.reportWorkerFailureHelper; } });
Object.defineProperty(exports, "reportWorkerFailure", { enumerable: true, get: function () { return backgroundTasks_1.reportWorkerFailure; } });
// Initialize the Agent Controller Function
exports.aiAgentController = functions.runWith({ secrets: ["GEMINI_API_KEY"], timeoutSeconds: 540 }).https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { prompt, history = [], timeZone = 'UTC', imagePayload: rawImagePayload, imageBase64, imageMimeType, jobId, currentPath } = data;
    const imagePayload = rawImagePayload || (imageBase64 ? { inlineData: { data: imageBase64, mimeType: imageMimeType || 'image/jpeg' } } : null);
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
        // Role-Based Access Control (RBAC) Detection
        const isMasterAdmin = (0, config_1.isUserMasterAdmin)(userData);
        const isAdmin = (0, config_1.isUserAdmin)(userData);
        const isSupervisor = (0, config_1.isUserSupervisor)(userData, isAdmin);
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
        const apiKey = await (0, config_1.getGeminiApiKey)(organizationId);
        const orgPreferences = orgData?.aiPreferences || [];
        const userPreferences = userData?.aiPreferences || [];
        const systemInstruction = `You are a Virtual AI Employee for a service company.
        CRITICAL CONTEXT:
        - The user's exact timezone is: ${timeZone}.
        - The current date and time in their local timezone is: ${new Date().toLocaleString('en-US', { timeZone })}.
        - The caller's authenticated identity is: ${userData?.firstName || 'User'} ${userData?.lastName || ''} (Role: ${userData?.role || userData?.userType || 'employee'}).
        - Administrative clearance status: isAdmin=${isAdmin}, isSupervisor=${isSupervisor}, isMasterAdmin=${isMasterAdmin}.
        - Privilege Level: ${isMasterAdmin ? 'Master Admin (Platform Owner)' : (isAdmin ? 'Organization Admin (Full Admin Privileges for Admin / Superuser / Both)' : (isSupervisor ? 'Supervisor' : 'Standard Employee / Technician'))}.
        - NOTE: Callers with user type or role 'both' or 'superuser' possess full Organization Administrator clearance (${isAdmin ? 'GRANTED' : 'DENIED'}), but do NOT possess Master Admin privileges (which are reserved exclusively for platform founders Roderick and Ryan).
        ${jobId ? `- ACTIVE JOB CONTEXT: The user is currently viewing Job ID [${jobId}]. If they say "this job", "the current job", "complete job", or refer to the current customer/work order, target this Job ID.` : ''}
        ${currentPath ? `- CURRENT UI ROUTE: ${currentPath}.` : ''}
        - If they say "tomorrow" or "next Friday", calculate the exact ISO 8601 date based on the local timestamp above.
        - If the user asks to "dispatch all unassigned jobs", call the assignTechnician tool WITHOUT a customerName!
        
        ORGANIZATION MEMORY / PREFERENCES:
        ${orgPreferences.length > 0 ? orgPreferences.map((p) => '- ' + p).join('\n') : 'No specific organization preferences learned yet.'}
        
        USER SPECIFIC MEMORY / PREFERENCES:
        ${userPreferences.length > 0 ? userPreferences.map((p) => '- ' + p).join('\n') : 'No specific user preferences learned yet.'}
        
        ROLE LANE BOUNDARIES & SAFEGUARDS:
        - Callers with isAdmin=true (including Organization Admins, Superusers, and "Both" user types) possess full administrative clearance over this organization's records, pricebooks, dispatches, and financials.
        - Technicians and non-admin staff (isAdmin=false) are strictly forbidden from viewing sensitive employee PII (SSN, pay rates, payroll details, bank routing/account numbers) or deleting database records.
        - If a non-admin caller asks to view employee salaries, company financial profit/loss records, or delete master pricebook/customer records, you MUST politely refuse and explain that this operation requires administrator clearance.
        - Master Admin platform capabilities (cross-tenant data, platform metrics, setting roles) are strictly prohibited and reserved exclusively for platform founders.
        - Under no circumstances should you ever reveal raw passwords, SSNs, or direct deposit banking details.
        
        TWO-PHASE COMMIT CONFIRMATION PROTOCOL:
        - For high-impact or destructive actions (cancelling a job, mass-dispatching all unassigned jobs, unassigning all jobs from a technician, or deleting records):
          * If the caller has NOT explicitly provided affirmative confirmation in their immediate message (e.g., "Yes confirm", "Proceed", "Confirmed"), DO NOT execute the destructive mutation immediately.
          * Instead, formulate a clear preview describing the target record, consequences, and ask for confirmation with exact clickable choices at the end: [CHOICES: Confirm & Execute | Cancel].
          * When the caller explicitly confirms, execute the action.
        
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
        If you are speaking to an Admin user (isAdmin=true, including admin, superuser, or both), AND if the current local day of the week is Friday, AND if they tell you something like "good night," "goodbye," or "that's all for today," you MUST respond EXACTLY with: "Yes! Thanks Boss, it's finally payday, where do I pick up my check?" 
        
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
        - Supported Admin Routes (only for roles: admin, master_admin, supervisor, both, superuser):
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

        NEXT-GENERATION VIRTUAL WORKER SUPERPOWERS:
        1. PROACTIVE DAILY BRIEFINGS:
           - If a user asks "What's on the schedule?", "Give me my morning briefing", "What are today's emergencies?", or asks for a recap, call the 'generateDailyBriefing' tool immediately.
        2. AUTONOMOUS ROUTE OPTIMIZATION:
           - If a user asks to "optimize today's routes", "reorder stops to minimize driving", or "balance our schedule", call the 'optimizeDispatchRoutes' tool.
        3. OVERDUE INVOICE DUNNING & PAYMENT LINKS:
           - If an admin asks about "overdue invoices", "unpaid accounts", or "send payment reminders", call the 'chaseOverdueInvoices' tool. You will provide direct online payment links and courteous reminder drafts.
        4. PRE-CLOSE QUALITY CONTROL & COMPLIANCE GATEKEEPER:
           - Before closing a job, you check that before/after photos and customer signatures are on file. You can also explicitly run 'auditJobCompliance' whenever requested.
        5. DATA PLATE OCR & EQUIPMENT REGISTRATION:
           - When an attached photo shows an equipment nameplate/data plate, or if a user says "register this unit to [Customer]", extract the manufacturer, model, serial number, tonnage, and refrigerant type, then call the 'registerCustomerEquipment' tool.

        Your primary job is to execute commands from your admins/employees. Use your tools whenever appropriate. 
        If you don't have enough info to use a tool (and it cannot be inferred from the active context), politely ask for the missing details.
        
        Whenever you legitimately execute one or more tool commands, you MUST end your final reply with a bulleted summary titled '**Steps Completed:**' detailing exactly what database operations you just successfully completed for the user.`;
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
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
        const agentToolbox = (0, toolbox_1.getAgentToolbox)(customDeclarations);
        // Initialize Gemini chat with Tools
        let formattedHistory = [];
        if (history && history.length > 20) {
            console.log(`History length (${history.length}) exceeds threshold of 20. Summarizing oldest messages...`);
            const messagesToSummarize = history.slice(0, -6);
            const messagesToKeep = history.slice(-6);
            const summary = await (0, config_1.summarizeHistory)(apiKey, messagesToSummarize);
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
                    ...messagesToKeep.map(config_1.formatHistoryTurn)
                ];
            }
            else {
                formattedHistory = history.map(config_1.formatHistoryTurn);
            }
        }
        else {
            formattedHistory = history.map(config_1.formatHistoryTurn);
        }
        let messageContent = prompt + `\n\n[SYSTEM ENFORCEMENT OVERRRIDE: You must strictly obey the RECORD LINKING RULE. You DO have the linkJobToCustomer tool. If the user asks you to link or map something but forgets the name, you MUST ask for the name instead of refusing to link!]`;
        if (imagePayload) {
            messageContent = [
                prompt + `\n\n(Attached is an image for context. Please analyze it if the user asks you to read or process a photo.)\n\n[SYSTEM ENFORCEMENT OVERRRIDE: You must strictly obey the RECORD LINKING RULE. You DO have the linkJobToCustomer tool. If the user asks you to link or map something but forgets the name, you MUST ask for the name instead of refusing to link!]`,
                imagePayload
            ];
        }
        // 4. Send Message & Handle Tool Execution (with resilient multi-model fallback cascade)
        let result = null;
        let activeChatSession = null;
        let activeModelName = config_1.AGENT_MODELS_CASCADE[0];
        let lastError = null;
        for (const candidateModelName of config_1.AGENT_MODELS_CASCADE) {
            try {
                const candidateModel = genAI.getGenerativeModel({
                    model: candidateModelName,
                    systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
                    generationConfig: config_1.MINIMAL_THINKING_CONFIG
                });
                const session = candidateModel.startChat({
                    tools: [agentToolbox],
                    history: formattedHistory
                });
                result = await (0, config_1.executeWithRetry)(() => session.sendMessage(messageContent), 3, 1500);
                activeChatSession = session;
                activeModelName = candidateModelName;
                break;
            }
            catch (candidateErr) {
                lastError = candidateErr;
                const isTransient = candidateErr.status === 429 ||
                    candidateErr.status === 503 ||
                    candidateErr.message?.includes("429") ||
                    candidateErr.message?.includes("503") ||
                    candidateErr.message?.includes("Too Many Requests") ||
                    candidateErr.message?.includes("Service Unavailable") ||
                    candidateErr.message?.toLowerCase().includes("quota") ||
                    candidateErr.message?.toLowerCase().includes("unavailable") ||
                    candidateErr.message?.toLowerCase().includes("demand") ||
                    candidateErr.message?.toLowerCase().includes("overloaded");
                if (isTransient) {
                    console.warn(`Model ${candidateModelName} unavailable or rate-limited (${candidateErr.message}). Cascading to next model...`);
                    continue;
                }
                throw candidateErr;
            }
        }
        if (!result || !activeChatSession) {
            throw lastError || new Error("All AI models in cascade failed to respond.");
        }
        const response = result.response;
        const sanitizedModelKey = activeModelName.replace(/\./g, '_');
        const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
        if (tokensUsed > 0 && organizationId) {
            const orgUsageRef = admin.firestore().collection('aiUsage').doc(organizationId);
            const now = new Date();
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
                    [`models.${sanitizedModelKey}`]: admin.firestore.FieldValue.increment(tokensUsed),
                    [`monthlyUsage.${monthKey}.totalTokensUsed`]: admin.firestore.FieldValue.increment(tokensUsed),
                    [`monthlyUsage.${monthKey}.promptTokensUsed`]: admin.firestore.FieldValue.increment(promptTokens),
                    [`monthlyUsage.${monthKey}.candidatesTokensUsed`]: admin.firestore.FieldValue.increment(candidatesTokens),
                    [`monthlyUsage.${monthKey}.virtualWorkerTokensUsed`]: admin.firestore.FieldValue.increment(tokensUsed),
                    [`monthlyUsage.${monthKey}.virtualWorkerPromptTokensUsed`]: admin.firestore.FieldValue.increment(promptTokens),
                    [`monthlyUsage.${monthKey}.virtualWorkerCandidatesTokensUsed`]: admin.firestore.FieldValue.increment(candidatesTokens),
                    [`monthlyUsage.${monthKey}.tasks.Virtual AI Worker`]: admin.firestore.FieldValue.increment(tokensUsed),
                    [`monthlyUsage.${monthKey}.models.${sanitizedModelKey}`]: admin.firestore.FieldValue.increment(tokensUsed),
                    [`monthlyUsage.${monthKey}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp(),
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
                let batchRevertData = null;
                try {
                    const toolResult = await (0, toolRouter_1.executeToolCall)({
                        call,
                        context,
                        uid,
                        userData,
                        organizationId,
                        isAdmin,
                        isSupervisor,
                        prompt,
                        timeZone,
                        ephemeralCustomerCache,
                        activeSynthesizedTools,
                        imagePayload,
                        history,
                        orgPreferences
                    });
                    toolStatusMessage = toolResult.toolStatusMessage;
                    revertData = toolResult.revertData ?? null;
                    batchRevertData = toolResult.batchRevertData ?? null;
                    if (toolResult.redirectToPath) {
                        redirectToPath = toolResult.redirectToPath;
                    }
                    if (toolResult.navigatedPageName) {
                        navigatedPageName = toolResult.navigatedPageName;
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
                        batchRevertData: batchRevertData,
                        timestamp: new Date().toISOString()
                    });
                }
                catch (e) {
                    console.error("Failed to log AI activity:", e);
                }
            }
            let functionResponse = null;
            try {
                functionResponse = await (0, config_1.executeWithRetry)(() => activeChatSession.sendMessage(functionResponsesPayload), 3, 1500);
            }
            catch (loopError) {
                const isTransientLoop = loopError.status === 429 ||
                    loopError.status === 503 ||
                    loopError.message?.includes("429") ||
                    loopError.message?.includes("503") ||
                    loopError.message?.includes("Too Many Requests") ||
                    loopError.message?.includes("Service Unavailable") ||
                    loopError.message?.toLowerCase().includes("quota") ||
                    loopError.message?.toLowerCase().includes("unavailable") ||
                    loopError.message?.toLowerCase().includes("demand") ||
                    loopError.message?.toLowerCase().includes("overloaded");
                if (isTransientLoop) {
                    console.warn(`Tool-loop transient error on ${activeModelName}. Attempting fallback models...`);
                    let loopResolved = false;
                    const fallbackCandidates = config_1.AGENT_MODELS_CASCADE.filter(m => m !== activeModelName);
                    for (const fallbackName of fallbackCandidates) {
                        try {
                            const fallbackModel = genAI.getGenerativeModel({
                                model: fallbackName,
                                systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
                                generationConfig: config_1.MINIMAL_THINKING_CONFIG
                            });
                            const fallbackHistory = [
                                ...formattedHistory,
                                {
                                    role: 'user',
                                    parts: Array.isArray(messageContent) ? messageContent : [{ text: String(messageContent) }]
                                },
                                {
                                    role: 'model',
                                    parts: currentResponse.candidates?.[0]?.content?.parts || []
                                }
                            ];
                            const fallbackSession = fallbackModel.startChat({
                                tools: [agentToolbox],
                                history: fallbackHistory
                            });
                            functionResponse = await (0, config_1.executeWithRetry)(() => fallbackSession.sendMessage(functionResponsesPayload), 2, 1500);
                            activeChatSession = fallbackSession;
                            activeModelName = fallbackName;
                            loopResolved = true;
                            break;
                        }
                        catch (fallbackErr) {
                            console.warn(`Tool-loop fallback ${fallbackName} failed:`, fallbackErr.message);
                        }
                    }
                    if (!loopResolved) {
                        console.warn("All models exhausted during tool-loop response. Synthesizing successful completion response from executed tools.");
                        const stepSummary = executedTools.map(t => `- Executed tool: ${t}`).join('\n');
                        const syntheticText = `I have completed the requested actions for you.\n\n**Steps Completed:**\n${stepSummary}`;
                        currentResponse = {
                            text: () => syntheticText,
                            functionCalls: () => [],
                            usageMetadata: { totalTokenCount: 0, promptTokenCount: 0, candidatesTokenCount: 0 }
                        };
                        break;
                    }
                }
                else {
                    throw loopError;
                }
            }
            if (functionResponse) {
                currentResponse = functionResponse.response;
            }
            const loopTotal = currentResponse.usageMetadata?.totalTokenCount || 0;
            const loopPrompt = currentResponse.usageMetadata?.promptTokenCount || 0;
            const loopCandidates = currentResponse.usageMetadata?.candidatesTokenCount || 0;
            if (loopTotal > 0 && organizationId) {
                const orgUsageRef = admin.firestore().collection('aiUsage').doc(organizationId);
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const loopModelKey = activeModelName.replace(/\./g, '_');
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
                        [`models.${loopModelKey}`]: admin.firestore.FieldValue.increment(loopTotal),
                        [`monthlyUsage.${monthKey}.totalTokensUsed`]: admin.firestore.FieldValue.increment(loopTotal),
                        [`monthlyUsage.${monthKey}.promptTokensUsed`]: admin.firestore.FieldValue.increment(loopPrompt),
                        [`monthlyUsage.${monthKey}.candidatesTokensUsed`]: admin.firestore.FieldValue.increment(loopCandidates),
                        [`monthlyUsage.${monthKey}.virtualWorkerTokensUsed`]: admin.firestore.FieldValue.increment(loopTotal),
                        [`monthlyUsage.${monthKey}.virtualWorkerPromptTokensUsed`]: admin.firestore.FieldValue.increment(loopPrompt),
                        [`monthlyUsage.${monthKey}.virtualWorkerCandidatesTokensUsed`]: admin.firestore.FieldValue.increment(loopCandidates),
                        [`monthlyUsage.${monthKey}.tasks.Virtual AI Worker`]: admin.firestore.FieldValue.increment(loopTotal),
                        [`monthlyUsage.${monthKey}.models.${loopModelKey}`]: admin.firestore.FieldValue.increment(loopTotal),
                        [`monthlyUsage.${monthKey}.lastUpdated`]: admin.firestore.FieldValue.serverTimestamp(),
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
        // Surface a user-friendly message for 429 rate limit or 503 high demand errors instead of raw Google API error
        const isTransientOverload = error.status === 429 ||
            error.status === 503 ||
            error.message?.includes("429") ||
            error.message?.includes("503") ||
            error.message?.includes("Too Many Requests") ||
            error.message?.includes("Service Unavailable") ||
            error.message?.toLowerCase().includes("quota exceeded") ||
            error.message?.toLowerCase().includes("demand") ||
            error.message?.toLowerCase().includes("overloaded") ||
            error.message?.toLowerCase().includes("spikes in demand");
        if (isTransientOverload) {
            throw new functions.https.HttpsError('resource-exhausted', 'The AI service is temporarily experiencing high demand. Please wait a few seconds and send your message again.');
        }
        if (error instanceof functions.https.HttpsError || (error.code && error.message && typeof error.code === 'string')) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Error processing AI command.');
    }
});
// Dedicated backwards-compatible wrapper for legacy client components
exports.askVirtualWorker = functions.runWith({ secrets: ["GEMINI_API_KEY"], timeoutSeconds: 540 }).https.onCall(async (data, context) => {
    return exports.aiAgentController.run(data, context);
});
//# sourceMappingURL=aiAgent.js.map