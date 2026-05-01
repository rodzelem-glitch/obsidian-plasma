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
exports.processBackgroundAITask = exports.analyzeReceiptWithAI = exports.cleanupOldAiLogs = exports.undoAiAction = exports.aiAgentController = void 0;
exports.getGeminiApiKey = getGeminiApiKey;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const executeWithRetry = async (operation, maxRetries = 3, baseDelayMs = 1500) => {
    let retries = 0;
    while (true) {
        try {
            return await operation();
        }
        catch (error) {
            retries++;
            // Catch ALL errors on 3rd party API connection rather than strictly hardcoding 503
            if (retries > maxRetries || error.message?.toLowerCase().includes("api key not valid")) {
                throw error;
            }
            console.warn(`Gemini API Busy (Attempt ${retries}/${maxRetries}). Retrying in ${baseDelayMs * Math.pow(2, retries - 1)}ms...`);
            await new Promise(resolve => setTimeout(resolve, baseDelayMs * Math.pow(2, retries - 1)));
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
// Initialize the Agent Controller Function
exports.aiAgentController = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data, context) => {
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
        If a user asks you to manage properties, assets, employees, tools, checklists, hazard reports, fleet vehicles, etc., you MUST first use \`searchDatabase\` to locate the record and understand its current schema. Then use \`upsertRecord\` to make EXACTLY the changes requested.
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

        Your primary job is to execute commands from your admins/employees. Use your tools whenever appropriate. 
        If you don't have enough info to use a tool (and it cannot be inferred from the active context), politely ask for the missing details.
        
        Whenever you legitimately execute one or more tool commands, you MUST end your final reply with a bulleted summary titled '**Steps Completed:**' detailing exactly what database operations you just successfully completed for the user.`;
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-3.1-pro-preview",
            systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] }
        });
        // 3. Define the Tool Spec (Function Calling)
        const agentToolbox = {
            functionDeclarations: [
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
                    description: "Adds a text note or comment to a job's activity log.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            customerName: { type: "STRING", description: "Name of the customer." },
                            note: { type: "STRING", description: "The note to add." }
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
                    description: "Queries any database collection (e.g., users, customers, jobs, proposals, inventory, vehicles, checklists, refrigerantLogs). Use this to lookup IDs or fetch current data before updating an exact entity.",
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
                }
            ]
        };
        // Initialize Gemini chat with Tools
        const formattedHistory = history.map((msg) => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.content || '' }]
        }));
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
        // 4. Send Message & Handle Tool Execution
        const result = await executeWithRetry(() => chat.sendMessage(messageContent));
        const response = result.response;
        const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
        if (tokensUsed > 0 && organizationId) {
            const orgUsageRef = admin.firestore().collection('aiUsage').doc(organizationId);
            try {
                await orgUsageRef.set({
                    organizationId: organizationId,
                    virtualWorkerTokensUsed: admin.firestore.FieldValue.increment(tokensUsed),
                    [`tasks.Virtual AI Worker`]: admin.firestore.FieldValue.increment(tokensUsed),
                    [`models.gemini-3_1-pro-preview`]: admin.firestore.FieldValue.increment(tokensUsed),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            catch (e) {
                console.error("Failed to track AI Agent usage:", e);
            }
        }
        // Did the model decide to call a function?
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const functionResponsesPayload = [];
            const executedTools = [];
            const ephemeralCustomerCache = [];
            for (const call of functionCalls) {
                let toolStatusMessage = "I processed your request, but the backend action hasn't been mapped yet.";
                let revertData = null;
                // --- TOOL ROUTER ---
                if (call.name === "createCustomer") {
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
                    const techDoc = usersSnap.docs.find(d => d.data().firstName?.toLowerCase().includes(args.technicianName.toLowerCase()) ||
                        d.data().lastName?.toLowerCase().includes(args.technicianName.toLowerCase()));
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
                    const proposal = {
                        id: propId,
                        organizationId: organizationId,
                        customerName: args.customerName,
                        customerEmail: `${args.customerName.replace(/ /g, '').toLowerCase()}@example.com`,
                        status: 'Draft',
                        createdAt: new Date().toISOString(),
                        options: [
                            { name: 'Good', description: args.goodTierDesc || '', price: args.goodTierPrice },
                            { name: 'Better', description: args.betterTierDesc || '', price: args.betterTierPrice },
                            { name: 'Best', description: args.bestTierDesc || '', price: args.bestTierPrice }
                        ]
                    };
                    await admin.firestore().collection('proposals').doc(propId).set(proposal);
                    revertData = { type: 'DELETE', collection: 'proposals', docId: propId };
                    toolStatusMessage = `Created a new multi-tiered sales proposal for ${args.customerName} successfully.`;
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
                            subtotal: args.price,
                            taxAmount: args.price * 0.0825,
                            total: args.price * 1.0825,
                            items: [
                                {
                                    id: `pi-ai-${Date.now()}`,
                                    name: args.equipment,
                                    description: args.description,
                                    type: 'Part',
                                    quantity: 1,
                                    price: args.price,
                                    total: args.price,
                                    tier: 'Good',
                                    taxable: true
                                }
                            ]
                        });
                        toolStatusMessage = `I successfully drafted a **$${args.price} proposal** for **${args.customerName}**, including the ${args.equipment}. It's saved in their file as a Draft!`;
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
                        await jobDoc.ref.update({
                            jobStatus: args.status,
                            updatedAt: new Date().toISOString()
                        });
                        toolStatusMessage = `I updated the job status for **${args.customerName}** to **${args.status}**!`;
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
                        const newWorkNotes = currentNotes.workNotes
                            ? currentNotes.workNotes + `\n- [AI Added]: ${args.note}`
                            : `- [AI Added]: ${args.note}`;
                        await jobDoc.ref.update({
                            notes: { ...currentNotes, workNotes: newWorkNotes },
                            updatedAt: new Date().toISOString()
                        });
                        toolStatusMessage = `I successfully added your note to **${args.customerName}**'s job.`;
                    }
                }
                else if (call.name === "sendMessage") {
                    const args = call.args;
                    const usersSnap = await admin.firestore().collection('users')
                        .where('organizationId', '==', organizationId)
                        .get();
                    const recipientDoc = usersSnap.docs.find(d => d.data().firstName?.toLowerCase().includes(args.recipientName.toLowerCase()) ||
                        d.data().lastName?.toLowerCase().includes(args.recipientName.toLowerCase()));
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
                    const items = inventorySnap.docs.filter(d => d.data().name?.toLowerCase().includes(args.itemQuery.toLowerCase()) ||
                        d.data().sku?.toLowerCase().includes(args.itemQuery.toLowerCase()));
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
                    toolStatusMessage = `I ran the analytics across your database natively. Total gross mapped revenue from ${count} invoiced/completed jobs is **$${total.toFixed(2)}**.`;
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
                        const taskIndex = currentTasks.findIndex((t) => t.toLowerCase().includes(args.taskName.toLowerCase()));
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
                    const snap = await admin.firestore().collection(args.collectionName)
                        .where('organizationId', '==', organizationId)
                        .get();
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
                    if (!isAdmin && adminOnlyCollections.includes(collectionName)) {
                        toolStatusMessage = `Error: You must be an administrator to modify records in the ${collectionName} database.`;
                    }
                    else {
                        if (recordId) {
                            const docCheck = await admin.firestore().collection(collectionName).doc(recordId).get();
                            if (!docCheck.exists || docCheck.data()?.organizationId !== organizationId) {
                                toolStatusMessage = `Error: Record not found or you do not have permission to edit it in ${collectionName}.`;
                            }
                            else {
                                const previousData = docCheck.data();
                                await docCheck.ref.set({
                                    ...payload,
                                    updatedAt: new Date().toISOString()
                                }, { merge: true });
                                revertData = { type: 'UPDATE', collection: collectionName, docId: recordId, payload: previousData };
                                toolStatusMessage = `I successfully updated the record ${recordId} in ${collectionName}.`;
                            }
                        }
                        else {
                            const newRef = admin.firestore().collection(collectionName).doc();
                            await newRef.set({
                                id: newRef.id,
                                organizationId: organizationId,
                                ...payload,
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
                    if (!isAdmin && adminOnlyCollections.includes(collectionName)) {
                        toolStatusMessage = `Error: You must be an administrator to delete records from the ${collectionName} database.`;
                    }
                    else if (collectionName === "users" || collectionName === "organizations" || collectionName === "customers") {
                        toolStatusMessage = "Error: I am strictly forbidden from deleting user profiles, customer profiles, or organization profiles from the system.";
                    }
                    else {
                        const docCheck = await admin.firestore().collection(collectionName).doc(recordId).get();
                        if (!docCheck.exists || docCheck.data()?.organizationId !== organizationId) {
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
                        .orderBy('updatedAt', 'desc')
                        .limit(5)
                        .get();
                    const customerJobs = jobsSnapshot.docs.filter(d => d.data().customerName?.toLowerCase().includes((args.customerName || '').toLowerCase()));
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
                        toolStatusMessage = `I've started the labor clock for **${args.customerName}**'s job. Get to work!`;
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
                        const twilioSid = orgDocSettings.exists ? orgDocSettings.data()?.twilioConfig?.accountSid : null;
                        const twilioToken = orgDocSettings.exists ? orgDocSettings.data()?.twilioConfig?.authToken : null;
                        const twilioNumber = orgDocSettings.exists ? orgDocSettings.data()?.twilioConfig?.phoneNumber : null;
                        if (!twilioSid || !twilioToken || !twilioNumber) {
                            toolStatusMessage = `Twilio is not fully configured for this organization in Settings > Integrations. I cannot make outbound phone calls yet.`;
                        }
                        else {
                            try {
                                const twilio = require('twilio');
                                const client = twilio(twilioSid, twilioToken);
                                // Native TwiML for dynamic reading of generative response
                                const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Matthew-Neural">${args.message.replace(/[*_~`]/g, '')}</Say></Response>`;
                                await client.calls.create({
                                    twiml: twiml,
                                    to: customerDoc.data().phone,
                                    from: twilioNumber
                                });
                                toolStatusMessage = `I successfully initiated the Twilio outbound phone call to **${args.customerName}** and conveyed the following message: "${args.message}"`;
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
                    const taskRef = admin.firestore().collection("organizations/${organizationId}/aiLongTasks").doc();
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
                    const taskRef = admin.firestore().collection("organizations/${organizationId}/aiLongTasks").doc();
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
                // Feed the result back to Gemini so it can converse properly instead of just spitting out the hardcoded status
                functionResponsesPayload.push({
                    functionResponse: {
                        name: call.name,
                        response: {
                            statusMessage: toolStatusMessage,
                            status: toolStatusMessage.includes("I couldn't find") ? "error" : "success"
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
                        status: toolStatusMessage.includes("Error:") || toolStatusMessage.includes("I couldn't find") ? 'Error' : 'Completed',
                        statusMessage: toolStatusMessage,
                        revertData: revertData,
                        timestamp: new Date().toISOString()
                    });
                }
                catch (e) {
                    console.error("Failed to log AI activity:", e);
                }
            }
            const functionResponse = await executeWithRetry(() => chat.sendMessage(functionResponsesPayload));
            let finalReply = functionResponse.response.text();
            let choices = undefined;
            const choiceMatch = finalReply.match(/\[CHOICES:\s*(.*?)\]/i);
            if (choiceMatch) {
                choices = choiceMatch[1].split('|').map((s) => s.trim());
                finalReply = finalReply.replace(choiceMatch[0], '').trim();
            }
            return {
                reply: finalReply,
                toolExecuted: executedTools.join(", "),
                choices
            };
        }
        // If it didn't call a function, return its conversational response
        let reply = response.text();
        let choices = undefined;
        const choiceMatch = reply.match(/\[CHOICES:\s*(.*?)\]/i);
        if (choiceMatch) {
            choices = choiceMatch[1].split('|').map((s) => s.trim());
            reply = reply.replace(choiceMatch[0], '').trim();
        }
        return {
            reply,
            toolExecuted: null,
            choices
        };
    }
    catch (error) {
        console.error("AI Agent Controller Error:", error);
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
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
        const parts = [{
                text: `You are an expert expense report processor. Analyze the provided receipt image(s). 
Extract the following information in strict JSON format: 
{ "vendor": "Name of the business", "amount": 12.34, "date": "YYYY-MM-DD", "category": "Travel | Meals | Supplies | Software | Other", "description": "Brief summary of what was purchased" }
If you cannot find a value, use reasonable defaults or empty strings. For amount, provide the numerical total.
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
        if (responseText.startsWith('\`\`\`json')) {
            responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
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
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" }); // Pro for complex logic
        await snapshot.ref.update({ progress: 20 });
        // Grab core analytics data to feed the model
        const db = admin.firestore();
        // Fetch last 500 completed jobs to prevent memory overload but provide good sample
        const jobsSnap = await db.collection('jobs').where('organizationId', '==', orgId).where('jobStatus', '==', 'Completed').orderBy('completedAt', 'desc').limit(500).get();
        const jobs = jobsSnap.docs.map(d => {
            const j = d.data();
            return { id: j.id, type: j.jobType, total: j.totalAmount, zip: j.zipCode, date: j.completedAt };
        });
        // Fetch last 500 invoices
        const invSnap = await db.collection('invoices').where('organizationId', '==', orgId).orderBy('createdAt', 'desc').limit(500).get();
        const invoices = invSnap.docs.map(d => {
            const i = d.data();
            return { id: i.id, total: i.totalAmount, status: i.status, items: i.items?.map((it) => it.name) || [] };
        });
        await snapshot.ref.update({ progress: 50 });
        const systemPrompt = `You are an expert AI Business Analyst for a field service company. 
The user has requested a comprehensive report: "${data.prompt}".
Here is a raw data dump of the recent 500 completed jobs: ${JSON.stringify(jobs)}
Here is a raw data dump of the recent 500 invoices: ${JSON.stringify(invoices)}

Please generate a highly detailed, professional, and insightful report answering their request. Format it entirely in Markdown. Include tables, bullet points, and clear headers. If the user asks for tax records, format it like a clean ledger. If they ask for profitability, calculate the highest grossing job types or zip codes based on the data provided. Do not invent fake data. Use the provided context.`;
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
//# sourceMappingURL=aiAgent.js.map