/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeWithRetry, getGeminiApiKey, MINIMAL_THINKING_CONFIG, isUserAdmin } from './config';

// Secure endpoint for administrators to quickly reverse accidental or rogue AI actions
export const undoAiAction = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    
    const { logId } = data;
    if (!logId) throw new functions.https.HttpsError('invalid-argument', 'Missing logId.');

    try {
        const logRef = admin.firestore().collection('aiActivityLogs').doc(logId);
        const logDoc = await logRef.get();
        if (!logDoc.exists) throw new functions.https.HttpsError('not-found', 'Audit log not found.');
        
        const logData = logDoc.data();
        const organizationId = logData?.organizationId;
        
        // Tenant boundary check
        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (userDoc.data()?.organizationId !== organizationId) {
            throw new functions.https.HttpsError('permission-denied', 'Cross-org boundary blocked.');
        }

        // Must be admin to undo
        if (!isUserAdmin(userDoc.data())) {
            throw new functions.https.HttpsError('permission-denied', 'Only admins can undo AI actions.');
        }

        const revertData = logData?.revertData;
        const batchRevertData = logData?.batchRevertData;
        if (!revertData && (!batchRevertData || !Array.isArray(batchRevertData) || batchRevertData.length === 0)) {
            throw new functions.https.HttpsError('failed-precondition', 'This action cannot be undone.');
        }

        const batch = admin.firestore().batch();
        let opsCount = 0;

        if (revertData) {
            const targetRef = admin.firestore().collection(revertData.collection).doc(revertData.docId);
            if (revertData.type === 'DELETE') {
                batch.delete(targetRef);
                opsCount++;
            } else if (revertData.type === 'RECREATE' || revertData.type === 'UPDATE') {
                if (revertData.payload) {
                    batch.set(targetRef, revertData.payload);
                    opsCount++;
                }
            }
        }

        if (Array.isArray(batchRevertData)) {
            for (const item of batchRevertData) {
                if (!item.collection || !item.docId) continue;
                const targetRef = admin.firestore().collection(item.collection).doc(item.docId);
                if (item.type === 'DELETE') {
                    batch.delete(targetRef);
                    opsCount++;
                } else if (item.type === 'RECREATE' || item.type === 'UPDATE') {
                    if (item.payload) {
                        batch.set(targetRef, item.payload);
                        opsCount++;
                    }
                }
            }
        }

        if (opsCount > 0) {
            await batch.commit();
        }

        // Mark ledger as undone
        await logRef.update({
            status: 'Undone',
            statusMessage: 'Action securely reversed by administrator.',
            undoneAt: new Date().toISOString(),
            undoneBy: context.auth.uid
        });

        return { success: true };

    } catch (error: any) {
        console.error("Undo Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to undo action.');
    }
});

// Automatically purges old AI logs to prevent the database from bloating indefinitely
export const cleanupOldAiLogs = functions.pubsub.schedule('every 24 hours').onRun(async () => {
    const db = admin.firestore();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const snapshot = await db.collection('aiActivityLogs')
        .where('timestamp', '<', sevenDaysAgo.toISOString())
        .limit(500)
        .get();
        
    if (snapshot.empty) return;
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    console.log(`Cleaned up ${snapshot.size} expired AI activity logs.`);
});

export const analyzeReceiptWithAI = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    const { base64Images } = data; // Array of base64 strings
    if (!base64Images || !Array.isArray(base64Images) || base64Images.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Image data is required.');
    }

    try {
        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data();
        const organizationId = userData?.organizationId || userData?.orgId;
        const apiKey = await getGeminiApiKey(organizationId);
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-3.8-flash",
            generationConfig: MINIMAL_THINKING_CONFIG
        });

        const parts: any[] = [{
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
    } catch (error: any) {
        console.error("Receipt OCR Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to analyze receipt.');
    }
});

export const processBackgroundAITask = functions.runWith({ timeoutSeconds: 540, memory: '2GB', secrets: ["GEMINI_API_KEY"] })
.firestore.document('organizations/{orgId}/aiLongTasks/{taskId}')
.onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    const orgId = context.params.orgId;
    
    if (!data.prompt) return null;

    try {
        await snapshot.ref.update({ status: 'Processing', progress: 10 });
        
        const apiKey = await getGeminiApiKey(orgId);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

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
            return { id: i.id || d.id, total: i.totalAmount, status: i.status, items: i.items?.map((it:any) => it.name) || [] };
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

    } catch (error: any) {
        console.error("Background AI Task Error:", error);
        await snapshot.ref.update({
            status: 'Failed',
            error: error.message || 'Unknown error occurred during processing.'
        });
        return null;
    }
});

export async function generateCommercialReferenceSheetHelper(orgId: string): Promise<{ success: boolean; message: string; resultMarkdown?: string }> {
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

        // Fetch related jobs in chunks of 30 customerIds
        const customerIds = commercialCustomers.map(c => c.id);
        const jobs: any[] = [];
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
        const sortedJobs = jobs.map((j: any) => ({
            id: j.id,
            customerId: j.customerId,
            jobStatus: j.jobStatus,
            totalAmount: j.totalAmount,
            updatedAt: j.updatedAt || ''
        })).sort((a: any, b: any) => a.id.localeCompare(b.id));

        const hashPayload = {
            customers: commercialCustomers.map((c: any) => ({
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
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-3.8-flash",
            generationConfig: MINIMAL_THINKING_CONFIG
        });

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
            prompt: "Commercial Customer Reference Sheet",
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
    } catch (error: any) {
        console.error("Failed to generate commercial reference sheet:", error);
        return {
            success: false,
            message: `Error generating reference sheet: ${error.message || error}`
        };
    }
}

export async function reportWorkerFailureHelper(
    orgId: string, 
    uid: string, 
    errorName: string, 
    errorMessage: string, 
    chatLog: any
): Promise<{ success: boolean; message: string }> {
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
            chatLog.forEach((msg: any) => {
                const role = msg.role || msg.sender || 'unknown';
                const roleName = (role === 'model' || role === 'assistant') ? 'AI Worker' : 'User';
                const color = roleName === 'User' ? '#1e40af' : '#475569';
                const text = msg.content || msg.text || (typeof msg === 'string' ? msg : JSON.stringify(msg));
                chatLogHtml += `<p style="margin: 8px 0;"><strong style="color: ${color};">${roleName}:</strong> ${text}</p>`;
            });
        } else if (typeof chatLog === 'string' && chatLog.trim() !== '') {
            chatLogHtml += `<p style="margin: 8px 0;">${chatLog}</p>`;
        } else {
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
    } catch (err: any) {
        console.error("Helper failed to send worker failure report:", err);
        return {
            success: false,
            message: `Failed to queue diagnostic failure email: ${err.message || err}`
        };
    }
}

export const reportWorkerFailure = functions.https.onCall(async (data, context) => {
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
