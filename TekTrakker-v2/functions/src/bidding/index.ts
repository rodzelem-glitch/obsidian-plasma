import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from 'axios';
import { getGeminiApiKey, trackAiUsage } from "../aiAgent";

if (admin.apps.length === 0) {
    try { admin.initializeApp(); } catch { /* ignore */ }
}
const db = admin.firestore();
const GEMINI_FLASH_MODEL = "gemini-3.8-flash";
const GEMINI_PRO_MODEL = "gemini-3.8-flash";

export const analyzeRFP = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';

    const { files } = data;
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "No files provided.");
    }

    const apiKey = await getGeminiApiKey(orgId);

    let orgContext: any /* eslint-disable-line @typescript-eslint/no-explicit-any */ = null;
    if (orgId && orgId !== 'unauthenticated') {
        try {
            const orgDoc = await db.collection('organizations').doc(orgId).get();
            if (orgDoc.exists) {
                orgContext = orgDoc.data();
            }
        } catch (e) {
            functions.logger.warn("Failed to fetch org context for analyzeRFP", e);
        }
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });

        const analyses = await Promise.all(files.map(async (file: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
            let { fileData, mimeType, fileName } = file;
            
            // If the fileData is actually a URL (like a SAM.gov resource link), download it first
            if (fileData && (fileData.startsWith('http://') || fileData.startsWith('https://'))) {
                try {
                    const response = await axios.get(fileData, { 
                        responseType: 'arraybuffer',
                        timeout: 60000 
                    });
                    
                    const contentType = String(response.headers['content-type'] || '').toLowerCase();
                    const contentDisposition = String(response.headers['content-disposition'] || '');
                    let headerFileName = fileName || '';
                    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
                    if (match && match[1].includes('.')) {
                        headerFileName = match[1];
                    }
                    
                    const nameToCheck = (headerFileName + " " + (fileName || '')).toLowerCase();

                    const buf = Buffer.from(response.data);
                    const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04;
                    const isDocLegacy = buf.length > 8 && buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0;

                    let isXlsx = contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('csv') || nameToCheck.includes('.xlsx') || nameToCheck.includes('.xls') || nameToCheck.includes('.csv');
                    let isDocx = contentType.includes('wordprocessing') || contentType.includes('msword') || nameToCheck.includes('.docx') || nameToCheck.includes('.doc');
                    
                    // If we have no clue but it's a zip file, it could be an office doc.
                    if (!isXlsx && !isDocx && (contentType.includes('octet-stream') || !contentType)) {
                        if (isZip) {
                            try {
                                const XLSX = await import('xlsx');
                                const workbook = XLSX.read(buf, { type: 'buffer' });
                                if (workbook.SheetNames.length > 0) isXlsx = true;
                            } catch {
                                isDocx = true; // Guess docx if xlsx parsing fails on a zip archive
                            }
                        } else if (isDocLegacy) {
                            isDocx = true; 
                        }
                    }

                    if (isXlsx) {
                        const XLSX = await import('xlsx');
                        const workbook = XLSX.read(buf, { type: 'buffer' });
                        let extractedText = "";
                        for (const sheetName of workbook.SheetNames) {
                            extractedText += `--- Sheet: ${sheetName} ---\n`;
                            extractedText += XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
                            extractedText += `\n\n`;
                        }
                        fileData = Buffer.from(extractedText).toString('base64');
                        mimeType = 'text/plain';
                    } else if (isDocx) {
                        const mammoth = await import('mammoth');
                        const result = await mammoth.extractRawText({ buffer: buf });
                        fileData = Buffer.from(result.value).toString('base64');
                        mimeType = 'text/plain';
                    } else {
                        fileData = buf.toString('base64');
                        // Automatically default to PDF if no mimeType or generic octet-stream
                        if (!mimeType || mimeType.includes('octet-stream')) {
                            mimeType = 'application/pdf';
                        }
                    }
                } catch (dlErr: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                    console.error("Failed to download or parse file from URL:", dlErr);
                    throw new Error(`Failed to process attached document ${fileName || ''}`, { cause: dlErr });
                }
            }

            const prompt = `Analyze this government RFP or solicitation document. Extract the following information in JSON format: 
            {
              "requirements": ["list", "of", "general", "requirements"],
              "deliverables": ["(Submittal) Must provide safety plan with bid", "(Contract) Monthly progress reports", "list", "of", "all", "deliverables, categorized by (Submittal) vs (Contract)"],
              "summary": "comprehensive overall summary of the scope of work",
              "solicitationNumber": "string",
              "agency": "string",
              "dueDate": "ISO date if found",
              "importantDates": [{"name": "Site Visit", "date": "YYYY-MM-DD"}, {"name": "Questions Due", "date": "YYYY-MM-DD"}],
              "questions": [{"id": "q1", "text": "Question text based on document that requires user input", "answer": ""}],
              "lineItems": [{"id": "item1", "description": "Item description", "qty": 1, "unit": "EA"}]
            }
            
            ### COMPANY CONTEXT
            The organization creating this bid has the following profile data:
            Company Name: ${orgContext?.name || 'Unknown'}
            CAGE Code: ${orgContext?.cageCode || 'Unknown'}
            UEI Number: ${orgContext?.ueid || 'Unknown'}
            Website: ${orgContext?.website || 'Unknown'}
            Primary NAICS: ${orgContext?.primaryNaics || 'Unknown'}
            Address: ${orgContext?.address ? `${orgContext.address.street}, ${orgContext.address.city}, ${orgContext.address.state} ${orgContext.address.zip}` : 'Unknown'}

            Crucial Instructions:
            1. For 'deliverables', explicitly prepend each item with either '(Submittal)' if it must be included in the bid response package, or '(Contract)' if it is required after winning the award during execution.
            2. Identify key areas where the estimator needs to provide input and add them to the 'questions' array.
            3. CRITICAL: DO NOT add questions to the 'questions' array for information that is already provided in the COMPANY CONTEXT above (like CAGE Code, UEI, Website, Address, Company Name, etc.). We already have this data and will automatically populate it.
            4. Identify all required services, products, or materials that need pricing and add them to the 'lineItems' array. STRICT RULE: ONLY extract line items if the document contains an explicit "Schedule of Supplies/Services", "Pricing Schedule", "CLINs" (Contract Line Item Numbers), or if the document is clearly a pricing spreadsheet/form. DO NOT extract general equipment lists, narrative tasks, or sub-components as line items unless they are formatted specifically for pricing in a schedule.
            5. For 'importantDates', thoroughly scan the entire document and aggressively extract ALL dates related to the project. This includes but is not limited to: Pre-Bid Meetings, Site Visits, RFIs/Questions Due Dates, Bid Deadlines, Expected Award Dates, Notice to Proceed, and Project Start/End dates. Format dates as YYYY-MM-DD.
            6. Ensure output is STRICTLY valid JSON. Do not include markdown code block tags (\`\`\`json).`;

            try {
                const result = await model.generateContent([
                    { inlineData: { data: fileData, mimeType } },
                    { text: prompt }
                ]);

                const response = await result.response;
                const tokens = response.usageMetadata?.totalTokenCount || 0;
                const promptTokens = response.usageMetadata?.promptTokenCount || 0;
                const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
                await trackAiUsage(orgId, 'Analyze RFP', GEMINI_PRO_MODEL, tokens, promptTokens, candidatesTokens);
                let text = response.text();

                text = text.replace(/```json/g, '').replace(/```/g, '').trim();

                try {
                    return JSON.parse(text);
                } catch (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                    console.error("Failed to parse AI response as JSON. Raw text:", text);
                    throw new Error("Failed to parse AI response as JSON for one of the files.", { cause: e });
                }
            } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                console.warn(`File analysis skipped or failed for ${mimeType}:`, err.message);
                
                if (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("overloaded"))) {
                    console.warn("Pro model overloaded. Falling back to Flash model...");
                    try {
                        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
                        const fallbackResult = await fallbackModel.generateContent([
                            { inlineData: { data: fileData, mimeType } },
                            { text: prompt }
                        ]);
                        const fallbackResponse = await fallbackResult.response;
                        const tokens = fallbackResponse.usageMetadata?.totalTokenCount || 0;
                        const promptTokens = fallbackResponse.usageMetadata?.promptTokenCount || 0;
                        const candidatesTokens = fallbackResponse.usageMetadata?.candidatesTokenCount || 0;
                        await trackAiUsage(orgId, 'Analyze RFP', GEMINI_FLASH_MODEL, tokens, promptTokens, candidatesTokens);
                        let fallbackText = fallbackResponse.text();
                        fallbackText = fallbackText.replace(/```json/g, '').replace(/```/g, '').trim();
                        return JSON.parse(fallbackText);
                    } catch (fallbackErr: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
                        console.error("Fallback to Flash model also failed:", fallbackErr.message);
                        throw new Error(`AI Service is currently overloaded (503 High Demand). Please try again later. Details: ${fallbackErr.message}`, { cause: fallbackErr });
                    }
                }

                if (err.message && err.message.includes("Unsupported MIME type")) {
                    return {
                        requirements: ["Notice: The system cannot directly read this file type (e.g. Excel/Word)."],
                        deliverables: ["Please convert files to PDF before uploading, or enter data manually."],
                        summary: `Unsupported file type (${mimeType}). Please upload a PDF.`,
                        solicitationNumber: "N/A",
                        agency: "N/A",
                        dueDate: null,
                        questions: [],
                        lineItems: []
                    };
                }
                throw err;
            }
        }));

        return { analyses };

    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("RFP Analysis Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to analyze RFP.");
    }
});

export const searchHistoricalBidData = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId || 'unauthenticated';

    const { bid } = data;
    if (!bid) throw new functions.https.HttpsError("invalid-argument", "No bid data provided.");

    const apiKey = await getGeminiApiKey(orgId);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });

        const prompt = `Search for historical data and market research for this government solicitation: ${JSON.stringify(bid)}. 
        Simulate a search and provide a detailed report on similar past contracts, typical winning prices, and potential competitors. 
        Format the output as a clean HTML document.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        const tokens = response.usageMetadata?.totalTokenCount || 0;
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
        await trackAiUsage(orgId, 'Historical Bid Search', GEMINI_PRO_MODEL, tokens, promptTokens, candidatesTokens);

        return { content: response.text() };
    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Historical Search Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to search historical data.");
    }
});

export const generateBidDocument = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in to generate bid documents.");
    }

    const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId;

    if (!orgId) {
        throw new functions.https.HttpsError("unauthenticated", "User is not part of an organization.");
    }

    functions.logger.info(`Bid generation for Org ${orgId} initiated.`);

    const apiKey = await getGeminiApiKey(orgId);

    const { bid, orgContext, prompt, isGlobalEdit, docIndex } = data;
    if (!bid || !prompt) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with a 'bid' and 'prompt'.");
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_PRO_MODEL });

        let fullPrompt = "";

        if (isGlobalEdit) {
            fullPrompt = `You are a professional proposal writer editing a bid package.
            Apply this instruction: "${prompt}" to the following document(s).
            Respond STRICTLY with a JSON array of objects representing the updated documents.
            Format: [{"title": "Document Title", "content": "<html content>"}]
            
            Current Documents to edit:
            ${JSON.stringify(bid.generatedDocs)}
            `;
        } else if (docIndex !== undefined) {
            const specificDocContent = bid.generatedDocs?.[docIndex]?.content || '';
            fullPrompt = `You are a professional proposal writer.
             Apply this instruction: "${prompt}" to the following specific document.
             Respond STRICTLY with the raw HTML content for the new document. Do not wrap in JSON.
             
             Current Document:
             ${specificDocContent}`;
        } else {
            // Build an explicit pricing table so the AI uses EXACT prices
            const lineItems = bid.lineItems || [];
            let pricingTable = 'CLIN | Description | Unit | Qty | Unit Price | Total Price\n';
            pricingTable += '--- | --- | --- | --- | --- | ---\n';
            let grandTotal = 0;
            lineItems.forEach((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, idx: number) => {
                const qty = item.qty || 0;
                const unitPrice = item.unitPrice || 0;
                const totalPrice = item.totalPrice || (qty * unitPrice);
                grandTotal += totalPrice;
                pricingTable += `${idx + 1} | ${item.description || 'Item'} | ${item.unit || 'EA'} | ${qty} | $${unitPrice.toFixed(2)} | $${totalPrice.toFixed(2)}\n`;
            });

            if (bid.additionalFeePercent && bid.additionalFeeName) {
                const feeAmount = bid.additionalFeeAmount || (grandTotal * bid.additionalFeePercent / 100);
                pricingTable += `FEE | ${bid.additionalFeeName} (${bid.additionalFeePercent}%) | | | | $${feeAmount.toFixed(2)}\n`;
                grandTotal += feeAmount;
            }

            pricingTable += `GRAND TOTAL | | | | | $${grandTotal.toFixed(2)}\n`;

            // Build Q&A context explicitly
            const questionsContext = (bid.questions || [])
                .filter((q: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => q.answer && q.answer.trim())
                .map((q: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => `Q: ${q.question || q.text || 'Unknown'}\nA: ${q.answer}`)
                .join('\n\n');

            // CSS stylesheet that MUST be embedded in every document
            const cssStylesheet = `<style>
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#1e293b;line-height:1.7;max-width:900px;margin:0 auto;padding:24px}
.doc-header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:20px;margin-bottom:30px}
.doc-header h1{font-size:22px;color:#1e40af;margin:0 0 6px 0;font-weight:800;text-transform:uppercase;letter-spacing:1px}
.doc-header p{margin:2px 0;font-size:13px;color:#475569}
.doc-header .credentials{font-size:12px;color:#64748b;margin-top:8px}
h2{color:#1e40af;font-size:18px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-top:32px;margin-bottom:16px;font-weight:700}
h3{color:#334155;font-size:15px;margin-top:20px;margin-bottom:10px;font-weight:600}
p{margin:8px 0;font-size:14px}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
th{background:#1e40af;color:white;padding:10px 12px;text-align:left;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px}
td{padding:8px 12px;border-bottom:1px solid #e2e8f0}
tr:nth-child(even){background:#f8fafc}
tr:last-child td{border-bottom:2px solid #1e40af;font-weight:700}
.total-row{background:#eff6ff!important;font-weight:800;font-size:15px}
.total-row td{border-top:2px solid #1e40af;border-bottom:2px solid #1e40af}
ul,ol{padding-left:24px;margin:8px 0}
li{margin:4px 0;font-size:14px}
.signature-block{margin-top:48px;border-top:1px solid #e2e8f0;padding-top:20px}
.signature-line{border-top:1px solid #1e293b;width:300px;margin-top:40px;padding-top:4px;font-size:13px}
</style>`;

            fullPrompt = `You are an expert government contracting proposal manager producing a PERFECT, complete, ready-to-submit proposal package.

### COMPANY INFORMATION (use these EXACT values — never invent or substitute):
- Company Name: ${orgContext?.name || 'NOT PROVIDED'}
- Phone: ${orgContext?.phone || 'NOT PROVIDED'}
- Email: ${orgContext?.email || 'NOT PROVIDED'}
- Address: ${orgContext?.address ? `${orgContext.address.street}, ${orgContext.address.city}, ${orgContext.address.state} ${orgContext.address.zip}` : 'NOT PROVIDED'}
- UEI Number: ${orgContext?.ueid || 'NOT PROVIDED'}
- CAGE Code: ${orgContext?.cageCode || 'NOT PROVIDED'}
- Primary NAICS: ${orgContext?.primaryNaics || 'NOT PROVIDED'}
- License Number: ${orgContext?.licenseNumber || 'NOT PROVIDED'}

### BID METADATA:
- Title: ${bid.title || 'Untitled Bid'}
- Solicitation #: ${bid.solicitationNumber || 'N/A'}
- Agency: ${bid.agency || 'N/A'}
- Due Date: ${bid.dueDate || 'N/A'}
- Summary: ${bid.summary || 'N/A'}

### REQUIREMENTS:
${(bid.requirements || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') || 'None extracted.'}

### DELIVERABLES:
${(bid.deliverables || []).map((d: string, i: number) => `${i + 1}. ${d}`).join('\n') || 'None extracted.'}

### QUESTIONS & ANSWERS (integrate these into the narrative):
${questionsContext || 'No Q&A provided.'}

### PRICING SCHEDULE — USE THESE EXACT DOLLAR AMOUNTS (DO NOT CHANGE ANY PRICES):
${pricingTable}

CRITICAL PRICING RULE: The Pricing Schedule document MUST use the EXACT unit prices, quantities, and totals shown above. The grand total MUST be exactly $${grandTotal.toFixed(2)}. Do NOT round, estimate, or change any dollar amount.

### DOCUMENT FORMATTING REQUIREMENTS:
Every document in the package MUST begin with this exact CSS stylesheet and header structure:

${cssStylesheet}

<div class="doc-header">
  <h1>[Company Name]</h1>
  <p>[Address] | [Email] | [Phone]</p>
  <p class="credentials">UEI: [UEI] | CAGE: [CAGE] | NAICS: [NAICS]</p>
</div>

### DOCUMENTS TO GENERATE:
Generate the following documents as separate items in the JSON array:
1. **Cover Letter** — Professional cover letter from the company to the Agency. Include a signature block.
2. **Executive Summary & Technical Approach** — Compelling narrative using the Q&A answers. Demonstrate understanding of the scope.
3. **Pricing Schedule** — Professional table using the EXACT pricing data above. Include CLIN numbers, descriptions, unit, qty, unit price, total, and grand total row.
4. **Past Performance & Qualifications** — Company capabilities, relevant experience, and qualifications.
5. **Compliance Matrix** — Table mapping each requirement/deliverable to the company's response approach.
${(bid.deliverables || []).some((d: string) => d.includes('(Submittal)')) ? '6. **Required Submittal Documents** — Draft responses for all (Submittal) deliverables.' : ''}

### OUTPUT FORMAT:
Return ONLY a JSON array. No markdown code fences. No explanation text before or after.
Each element: {"title": "Document Title", "content": "<full HTML with embedded CSS>"}

Example of correct output start:
[{"title":"Cover Letter","content":"<style>...</style><div class=\\"doc-header\\">...`;
        }

        let text = "";
        let tokens = 0;
        let promptTokens = 0;
        let candidatesTokens = 0;
        let usedModel = GEMINI_PRO_MODEL;

        try {
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            tokens = response.usageMetadata?.totalTokenCount || 0;
            promptTokens = response.usageMetadata?.promptTokenCount || 0;
            candidatesTokens = response.usageMetadata?.candidatesTokenCount || 0;
            text = response.text();
        } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
            if (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("overloaded"))) {
                functions.logger.warn("Pro model overloaded in document generation. Falling back to Flash model...");
                const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
                const fallbackResult = await fallbackModel.generateContent(fullPrompt);
                const fallbackResponse = await fallbackResult.response;
                tokens = fallbackResponse.usageMetadata?.totalTokenCount || 0;
                promptTokens = fallbackResponse.usageMetadata?.promptTokenCount || 0;
                candidatesTokens = fallbackResponse.usageMetadata?.candidatesTokenCount || 0;
                text = fallbackResponse.text();
                usedModel = GEMINI_FLASH_MODEL;
            } else {
                throw err;
            }
        }

        await trackAiUsage(orgId, 'Generate Bid Document', usedModel, tokens, promptTokens, candidatesTokens);

        if (isGlobalEdit || docIndex === undefined) {
            // Robust JSON extraction: strip code fences, then try to find the JSON array
            text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            
            // Try direct parse first
            let docs;
            try {
                docs = JSON.parse(text);
            } catch {
                // Fallback: find the outermost JSON array in the response
                const arrayMatch = text.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                    try {
                        docs = JSON.parse(arrayMatch[0]);
                    } catch {
                        functions.logger.error("Failed to parse document generation response (both attempts)", text.substring(0, 500));
                        throw new functions.https.HttpsError("internal", "The AI failed to format the documents correctly. Please try again.");
                    }
                } else {
                    functions.logger.error("No JSON array found in response", text.substring(0, 500));
                    throw new functions.https.HttpsError("internal", "The AI failed to format the documents correctly. Please try again.");
                }
            }
            return { docs };
        } else {
            return { docs: [{ title: bid.generatedDocs[docIndex].title, content: text.replace(/```html/g, '').replace(/```/g, '').trim() }] };
        }

    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Error generating bid document:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate document.");
    }
});

export const suggestBidPricing = functions.runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");

    const { bid } = data;
    if (!bid || !bid.lineItems || bid.lineItems.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Missing bid or line items.");
    }

    try {
        const orgId = context.auth.token.organizationId || (await db.collection('users').doc(context.auth.uid).get()).data()?.organizationId;
        
        if (!orgId) {
            throw new functions.https.HttpsError("unauthenticated", "User is not part of an organization.");
        }

        const apiKey = await getGeminiApiKey(orgId);
        const genAI = new GoogleGenerativeAI(apiKey);
        // Using flash model for faster, consistent parsing
        const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

        // 1. Gather historical context if available.
        // Similar to the historical research report, we find recent awarded bids to ensure accurate pricing.
        let recentBidsSnap = await db.collection('bids')
            .where('organizationId', '==', bid.organizationId || orgId)
            .where('status', '==', 'Won')
            .limit(20)
            .get();

        if (recentBidsSnap.empty) {
            recentBidsSnap = await db.collection('bids')
                .where('organizationId', '==', bid.organizationId || orgId)
                .where('status', '==', 'Submitted')
                .limit(20)
                .get();
        }

        let historicalContext = '';
        if (!recentBidsSnap.empty) {
            historicalContext = recentBidsSnap.docs.map(doc => {
                const b = doc.data();
                return `Bid: ${b.title || 'Untitled'} (Status: ${b.status})\nAgency: ${b.agency || 'Unknown'}\nTotal Value: $${b.totalValue || 'Unknown'}\nItems: ${b.lineItems?.map((li: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => `${li.description} - qty ${li.qty} @ $${li.unitPrice}`).join(', ') || 'None'}`;
            }).join('\n\n');
        }

        // 2. Prepare the prompt
        const prompt = `
You are an expert pricing strategist and bid estimator.
Your task is to analyze the provided Bid Line Items and suggest an optimized "Recommended Unit Price" for each item.
Your goal is to maximize profitability while remaining highly competitive to win the bid.

### Bid Context
Title: ${bid.title}
Agency/Customer: ${bid.agency}
Due Date: ${bid.dueDate}
Summary: ${bid.summary}

### Historical Pricing Context (Past Bids from this Organization)
${historicalContext ? historicalContext : "No historical data available."}

### Current Line Items to Price
${JSON.stringify(bid.lineItems.map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => ({
    id: item.id,
    description: item.description,
    unit: item.unit,
    qty: item.qty,
    currentUnitPrice: item.unitPrice
})), null, 2)}

Instructions:
1. Review each line item's description, unit, and quantity.
2. CRITICALLY IMPORTANT: Look closely at the Historical Pricing Context for past awarded or submitted bids. If a line item is identical or similar to one that was awarded in the past, heavily weight your recommendation towards that past successful price. Do not invent a completely different price if you have historical data for a similar item.
3. Suggest a realistic, competitive, and profitable unit price for each item.
4. If a currentUnitPrice is already provided (>0), use it as a baseline but optimize it based on historical data and standard market rates.
5. Return ONLY a valid JSON array of objects. Do not include markdown formatting (like \`\`\`json).

Output Format:
[
  {
    "id": "item-id",
    "aiRecommendedPrice": 125.50
  }
]
`;

        let response;
        try {
            response = await model.generateContent([
                { text: "You are an expert pricing estimator that outputs pure JSON arrays." },
                { text: prompt }
            ]);
        } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
            if (error.message?.includes("429") || error.status === 429) {
                functions.logger.warn(`429 Too Many Requests on gemini-3.8-flash, falling back to gemini-3.7-flash`);
                const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.7-flash" });
                response = await fallbackModel.generateContent([
                    { text: "You are an expert pricing estimator that outputs pure JSON arrays." },
                    { text: prompt }
                ]);
            } else {
                throw error;
            }
        }

        let text = response.response.text().trim();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Track live AI token consumption
        const genResponse = await response.response;
        const tokens = genResponse.usageMetadata?.totalTokenCount || 0;
        const promptTokens = genResponse.usageMetadata?.promptTokenCount || 0;
        const candidatesTokens = genResponse.usageMetadata?.candidatesTokenCount || 0;
        if (tokens > 0 && orgId) {
            await trackAiUsage(orgId, 'Interactive Smart Proposals', 'gemini-3.8-flash', tokens, promptTokens, candidatesTokens);
        }

        let recommendations;
        try {
            recommendations = JSON.parse(text);
        } catch (e) {
            functions.logger.error("Failed to parse AI pricing recommendations:", text);
            throw new Error("AI returned invalid JSON.", { cause: e });
        }

        // 3. Map recommendations back to the original line items
        const updatedLineItems = bid.lineItems.map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
            const rec = recommendations.find((r: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => r.id === item.id);
            if (rec && typeof rec.aiRecommendedPrice === 'number') {
                return { ...item, aiRecommendedPrice: rec.aiRecommendedPrice };
            }
            return item;
        });

        return { updatedLineItems };

    } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
        functions.logger.error("Error generating AI pricing:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to generate AI pricing.");
    }
});

// --- PARTNER HANDSHAKE ---

export const manageHandshake = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    const { action, targetOrgId, requestingOrgId, subcontractorId } = data;

    if (action === 'request') {
        if (!targetOrgId) throw new functions.https.HttpsError('invalid-argument', 'Target Org ID required.');
        if (!requestingOrgId) throw new functions.https.HttpsError('invalid-argument', 'Requesting Org ID required.');

        const requesterDoc = await db.collection('organizations').doc(requestingOrgId).get();
        const requesterName = requesterDoc.data()?.name || 'Unknown Org';

        await db.collection('organizations').doc(targetOrgId).update({
            partnerRequests: admin.firestore.FieldValue.arrayUnion({
                fromOrgId: requestingOrgId,
                fromOrgName: requesterName,
                subcontractorId: subcontractorId, // The ID of the sub doc in the requester's DB
                status: 'pending',
                timestamp: Date.now()
            })
        });

        return { success: true };
    }

    if (action === 'approve') {
        const batch = db.batch();

        // 1. Fetch Organization Data
        const targetOrgRef = db.collection('organizations').doc(targetOrgId);
        const requestOrgRef = db.collection('organizations').doc(requestingOrgId);


        const [targetOrgDoc, requestOrgDoc] = await Promise.all([targetOrgRef.get(), requestOrgRef.get()]);
        const targetOrgData = targetOrgDoc.data();
        const requestOrgData = requestOrgDoc.data();

        if (!targetOrgData || !requestOrgData) throw new functions.https.HttpsError('not-found', 'Organization not found.');

        const request = targetOrgData.partnerRequests?.find((r: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => r.fromOrgId === requestingOrgId);
        if (!request) throw new functions.https.HttpsError('not-found', 'Request not found.');

        // 2. Remove Request & Link Organizations
        batch.update(targetOrgRef, {
            partnerRequests: admin.firestore.FieldValue.arrayRemove(request),
            linkedPartners: admin.firestore.FieldValue.arrayUnion(requestingOrgId)
        });
        batch.update(requestOrgRef, {
            linkedPartners: admin.firestore.FieldValue.arrayUnion(targetOrgId)
        });

        // 3. Update Requester's Subcontractor Doc (Status: Linked)
        if (request.subcontractorId) {
            const subRef = db.collection('subcontractors').doc(request.subcontractorId);
            // Also autofill details from the target org (Approver) into this sub doc
            batch.update(subRef, {
                handshakeStatus: 'Linked',
                companyName: targetOrgData.name,
                email: targetOrgData.email,
                phone: targetOrgData.phone,
                trade: targetOrgData.industry || 'General',
                linkedOrgId: targetOrgId
            });
        }

        // 4. Create Reciprocal Subcontractor Doc for Approver (Target)
        const newSubId = `sub_${targetOrgId}_${requestingOrgId}`;
        const newSubRef = db.collection('subcontractor').doc(newSubId);
        batch.set(newSubRef, {
            id: newSubId,
            organizationId: targetOrgId,
            companyName: requestOrgData.name,
            contactName: 'Partner Admin', // Default
            trade: requestOrgData.industry || 'General',
            email: requestOrgData.email,
            phone: requestOrgData.phone,
            status: 'Active',
            handshakeStatus: 'Linked',
            linkedOrgId: requestingOrgId,
            createdAt: new Date().toISOString()
        }, { merge: true });

        // 5. Create Customer Records for B2B Invoicing
        // Customer for Requester (representing Approver)
        const custReqId = `cust_partner_${targetOrgId}`;
        const custReqRef = db.collection('customers').doc(custReqId);
        batch.set(custReqRef, {
            id: custReqId,
            organizationId: requestingOrgId,
            name: targetOrgData.name,
            email: targetOrgData.email,
            phone: targetOrgData.phone,
            address: targetOrgData.address ? `${targetOrgData.address.street}, ${targetOrgData.address.city}, ${targetOrgData.address.state} ${targetOrgData.address.zip}` : '',
            type: 'Commercial',
            status: 'Active',
            linkedOrgId: targetOrgId,
            notes: 'Linked Partner Organization'
        }, { merge: true });

        // Customer for Approver (representing Requester)
        const custAppId = `cust_partner_${requestingOrgId}`;
        const custAppRef = db.collection('customers').doc(custAppId);
        batch.set(custAppRef, {
            id: custAppId,
            organizationId: targetOrgId,
            name: requestOrgData.name,
            email: requestOrgData.email,
            phone: requestOrgData.phone,
            address: requestOrgData.address ? `${requestOrgData.address.street}, ${requestOrgData.address.city}, ${requestOrgData.address.state} ${targetOrgData.address.zip}` : '',
            type: 'Commercial',
            status: 'Active',
            linkedOrgId: requestingOrgId,
            notes: 'Linked Partner Organization'
        }, { merge: true });

        await batch.commit();
        return { success: true };
    }

    if (action === 'reject') {
        const myOrgRef = db.collection('organizations').doc(targetOrgId);
        const myOrgDoc = await myOrgRef.get();
        const myOrgData = myOrgDoc.data();

        const request = myOrgData?.partnerRequests?.find((r: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => r.fromOrgId === requestingOrgId);
        if (request) {
            await myOrgRef.update({
                partnerRequests: admin.firestore.FieldValue.arrayRemove(request)
            });

            if (request.subcontractorId) {
                try {
                    await db.collection('subcontractors').doc(request.subcontractorId).update({
                        handshakeStatus: 'None'
                    });
                } catch (e) {
                    functions.logger.warn(`Could not update requester subcontractor doc ${request.subcontractorId}`, e);
                }
            }
        }
        return { success: true };
    }

    if (action === 'cancel') {
        const targetOrgRef = db.collection('organizations').doc(targetOrgId);
        const targetOrgDoc = await targetOrgRef.get();
        const targetOrgData = targetOrgDoc.data();

        const request = targetOrgData?.partnerRequests?.find((r: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => r.fromOrgId === requestingOrgId);
        if (request) {
            await targetOrgRef.update({
                partnerRequests: admin.firestore.FieldValue.arrayRemove(request)
            });
        }

        if (subcontractorId) {
            await db.collection('subcontractors').doc(subcontractorId).update({
                handshakeStatus: 'None'
            });
        }

        return { success: true };
    }

    if (action === 'unlink') {
        const batch = db.batch();
        const targetOrgRef = db.collection('organizations').doc(targetOrgId);
        const requestingOrgRef = db.collection('organizations').doc(requestingOrgId);

        batch.update(targetOrgRef, { linkedPartners: admin.firestore.FieldValue.arrayRemove(requestingOrgId) });
        batch.update(requestingOrgRef, { linkedPartners: admin.firestore.FieldValue.arrayRemove(targetOrgId) });

        if (subcontractorId) {
            batch.update(db.collection('subcontractors').doc(subcontractorId), { handshakeStatus: 'None' });
        }

        await batch.commit();
        return { success: true };
    }

    throw new functions.https.HttpsError('invalid-argument', 'Invalid action.');
});