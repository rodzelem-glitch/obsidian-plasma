import { getFunctions, httpsCallable } from 'firebase/functions';
import Tesseract from 'tesseract.js';
import type { Job, Customer } from '../types';
import { extractTextFromPdf, matchCustomerFromText } from './workOrderParser';

export interface ExtractedPaperReadings {
  highPressure?: string;
  lowPressure?: string;
  liquidTemp?: string;
  suctionTemp?: string;
  superheat?: string;
  subcooling?: string;
  ambientTemp?: string;
  supplyTemp?: string;
  returnTemp?: string;
  deltaT?: string;
  voltage?: string;
  amps?: string;
  refrigerantType?: string;
  refrigerantAdded?: string;
}

export interface ExtractedPaperPartItem {
  name: string;
  sku?: string;
  quantity: number;
  unitPrice?: number;
}

export interface ExtractedPaperFormData {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceAddress?: string;
  workOrderNo?: string;
  serviceDate?: string;
  visitType?: string;
  
  equipmentLocation?: string;
  brand?: string;
  model?: string;
  serial?: string;
  healthStatus?: 'Good' | 'Fair' | 'Poor' | 'Critical';
  
  readings?: ExtractedPaperReadings;
  diagnosisNotes?: string;
  workNotes?: string;
  partsUsed?: ExtractedPaperPartItem[];
  recommendations?: string;
  
  hasTechSignature?: boolean;
  hasCustomerSignature?: boolean;
  
  matchedJob: Job | null;
  matchedCustomer: Customer | null;
  matchConfidence: number;
  matchReason: string;
  rawText?: string;
}

// Convert File to Base64
const fileToBase64 = (file: File): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const res = reader.result as string;
      const match = res.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        resolve({ mimeType: match[1], base64Data: match[2] });
      } else {
        resolve({ mimeType: file.type || 'image/jpeg', base64Data: res.replace(/^data:[^;]+;base64,/, '') });
      }
    };
    reader.onerror = err => reject(err);
  });
};

/**
 * Fuzzy score and match extracted paper data against existing scheduled jobs
 */
export const findBestJobMatch = (
  extractedData: Partial<ExtractedPaperFormData>,
  existingJobs: Job[],
  customers: Customer[] = []
): { matchedJob: Job | null; matchedCustomer: Customer | null; confidence: number; reason: string } => {
  if (!existingJobs || existingJobs.length === 0) {
    // Attempt customer matching only
    const { customer } = matchCustomerFromText(
      `${extractedData.customerName || ''} ${extractedData.serviceAddress || ''} ${extractedData.customerPhone || ''}`,
      customers
    );
    return { matchedJob: null, matchedCustomer: customer, confidence: customer ? 50 : 0, reason: customer ? `Matched Customer: ${customer.name}` : 'No matching job found' };
  }

  let bestJob: Job | null = null;
  let highestScore = 0;
  let scoreReason = 'No match found';

  const extWO = (extractedData.workOrderNo || '').toLowerCase().trim();
  const extName = (extractedData.customerName || '').toLowerCase().trim();
  const extPhone = (extractedData.customerPhone || '').replace(/\D/g, '');
  const extAddress = (extractedData.serviceAddress || '').toLowerCase().trim();

  for (const job of existingJobs) {
    let score = 0;
    const reasons: string[] = [];

    // 1. Exact or partial WO / PO match (+100)
    const jobWO = (job.workOrderNumber || job.poNumber || job.id || '').toLowerCase().trim();
    if (extWO && jobWO && (jobWO.includes(extWO) || extWO.includes(jobWO))) {
      score += 100;
      reasons.push(`Exact WO/PO Match (${jobWO})`);
    }

    // 2. Customer Phone Match (+80)
    if (extPhone && extPhone.length >= 7) {
      const jobPhone = (job.customerPhone || '').replace(/\D/g, '');
      if (jobPhone && jobPhone.includes(extPhone)) {
        score += 80;
        reasons.push('Phone Number Match');
      }
    }

    // 3. Customer Name Match (+60)
    const jobName = (job.customerName || '').toLowerCase().trim();
    if (extName && jobName) {
      if (jobName.includes(extName) || extName.includes(jobName)) {
        score += 60;
        reasons.push(`Customer Name Match (${job.customerName})`);
      } else {
        // Word token matching
        const extTokens = extName.split(/\s+/).filter(w => w.length > 2);
        const matchedTokens = extTokens.filter(t => jobName.includes(t));
        if (matchedTokens.length > 0) {
          score += 30;
          reasons.push(`Partial Customer Name Match`);
        }
      }
    }

    // 4. Service Address Match (+50)
    const jobAddressStr = (typeof job.address === 'string' ? job.address : `${job.address?.street || ''} ${job.address?.city || ''}`).toLowerCase();
    if (extAddress && jobAddressStr) {
      const streetPart = extAddress.split(',')[0].trim();
      if (streetPart.length > 5 && jobAddressStr.includes(streetPart)) {
        score += 50;
        reasons.push('Street Address Match');
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestJob = job;
      scoreReason = reasons.join(', ');
    }
  }

  // Find matched customer record if bestJob exists
  let matchedCust: Customer | null = null;
  if (bestJob?.customerId && customers.length > 0) {
    matchedCust = customers.find(c => c.id === bestJob?.customerId) || null;
  }

  return {
    matchedJob: highestScore >= 35 ? bestJob : null,
    matchedCustomer: matchedCust,
    confidence: Math.min(100, highestScore),
    reason: highestScore >= 35 ? scoreReason : 'Unscheduled / New Job Candidate'
  };
};

/**
 * Main Paper Form OCR Processing Pipeline
 */
export const parsePaperTechForm = async (
  file: File,
  existingJobs: Job[] = [],
  customers: Customer[] = []
): Promise<ExtractedPaperFormData> => {
  let rawText = '';
  let extracted: Partial<ExtractedPaperFormData> = {};

  // Check if PDF
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    try {
      rawText = await extractTextFromPdf(file);
    } catch (e) {
      console.warn("PDF text extraction warning:", e);
    }
  }

  // Attempt Gemini Multimodal Vision AI first if online
  try {
    const { base64Data, mimeType } = await fileToBase64(file);
    const fns = getFunctions();
    const callGeminiAI = httpsCallable(fns, 'callGeminiAI', { timeout: 120000 });

    const prompt = `You are a field service paper work-order OCR scanner.
Analyze this scanned technician paper form and extract all handwritten or typed fields.

Return strictly JSON matching this structure:
{
  "customerName": "Customer full name or null",
  "customerPhone": "Customer phone number or null",
  "customerEmail": "Customer email or null",
  "serviceAddress": "Full site address or null",
  "workOrderNo": "Work order / PO number or null",
  "serviceDate": "Date of service YYYY-MM-DD or null",
  "visitType": "Diagnostic Only | Diagnostic & Repair | Repair | Maintenance | Service Call or null",
  
  "equipmentLocation": "Location/Area of unit or null",
  "brand": "Brand / Manufacturer name or null",
  "model": "Model number or null",
  "serial": "Serial number or null",
  "healthStatus": "Good | Fair | Poor | Critical or null",
  
  "readings": {
    "highPressure": "PSI string or null",
    "lowPressure": "PSI string or null",
    "liquidTemp": "Degrees F or null",
    "suctionTemp": "Degrees F or null",
    "superheat": "Degrees F or null",
    "subcooling": "Degrees F or null",
    "ambientTemp": "Degrees F or null",
    "supplyTemp": "Degrees F or null",
    "returnTemp": "Degrees F or null",
    "deltaT": "Degrees F or null",
    "voltage": "Volts or null",
    "amps": "Amps or null",
    "refrigerantType": "e.g. R-410A, R-22, R-454B or null",
    "refrigerantAdded": "e.g. 2 lbs 4 oz or null"
  },
  
  "diagnosisNotes": "Diagnosis & root cause text or null",
  "workNotes": "Work performed & repairs text or null",
  "partsUsed": [
    { "name": "Part name/desc", "sku": "SKU if written", "quantity": 1, "unitPrice": 0 }
  ],
  "recommendations": "Technician recommendations or null",
  "hasTechSignature": true/false,
  "hasCustomerSignature": true/false
}

Be accurate with numbers, pressures, temperatures, and handwritten text. Do not invent missing data.`;

    const response: any = await callGeminiAI({
      prompt,
      imageParts: [{ base64Data, mimeType }],
      image: { base64Data, mimeType },
      modelName: 'gemini-3.8-flash',
      config: {
        temperature: 0.0,
        response_mime_type: 'application/json'
      }
    });

    const respText = response.data?.text || response.data?.result || response.data || '{}';
    const cleanJsonStr = (typeof respText === 'string' ? respText : JSON.stringify(respText))
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    extracted = JSON.parse(cleanJsonStr);
  } catch (geminiError) {
    console.warn("Gemini Vision Paper Form OCR unavailable/failed, using Tesseract OCR fallback:", geminiError);

    // Fallback: Tesseract.js client OCR
    try {
      if (!rawText) {
        const tesseractResult = await Tesseract.recognize(file, 'eng', {
          logger: m => console.log(`[Tesseract OCR] ${m.status}: ${Math.round((m.progress || 0) * 100)}%`)
        });
        rawText = tesseractResult.data.text;
      }

      // Regex fallback extraction from raw text
      const nameMatch = /(?:customer|client|name)\s*[:\-]\s*([^\n,]+)/i.exec(rawText);
      const phoneMatch = /(?:phone|tel|cell)\s*[:\-]?\s*([0-9\-\(\)\s\.]{10,15})/i.exec(rawText);
      const addrMatch = /(?:address|site|location)\s*[:\-]\s*([^\n]+)/i.exec(rawText);
      const woMatch = /(?:wo|po|order|#)\s*[:#-]?\s*([a-zA-Z0-9_\-]+)/i.exec(rawText);

      extracted = {
        customerName: nameMatch?.[1]?.trim(),
        customerPhone: phoneMatch?.[1]?.trim(),
        serviceAddress: addrMatch?.[1]?.trim(),
        workOrderNo: woMatch?.[1]?.trim(),
        workNotes: rawText.slice(0, 1000)
      };
    } catch (tessErr) {
      console.error("Tesseract OCR fallback failed:", tessErr);
    }
  }

  // Perform fuzzy matching to associate with an existing job
  const { matchedJob, matchedCustomer, confidence, reason } = findBestJobMatch(extracted, existingJobs, customers);

  return {
    customerName: extracted.customerName || matchedJob?.customerName || '',
    customerPhone: extracted.customerPhone || matchedJob?.customerPhone || '',
    customerEmail: extracted.customerEmail || matchedJob?.customerEmail || '',
    serviceAddress: extracted.serviceAddress || (typeof matchedJob?.address === 'string' ? matchedJob.address : ''),
    workOrderNo: extracted.workOrderNo || matchedJob?.workOrderNumber || matchedJob?.poNumber || '',
    serviceDate: extracted.serviceDate || matchedJob?.appointmentTime?.split('T')[0] || new Date().toISOString().split('T')[0],
    visitType: extracted.visitType || matchedJob?.visitType || 'Diagnostic & Repair',

    equipmentLocation: extracted.equipmentLocation || '',
    brand: extracted.brand || matchedJob?.hvacBrand || '',
    model: extracted.model || '',
    serial: extracted.serial || '',
    healthStatus: extracted.healthStatus || 'Fair',

    readings: extracted.readings || {},
    diagnosisNotes: extracted.diagnosisNotes || matchedJob?.notes?.diagnosis || '',
    workNotes: extracted.workNotes || matchedJob?.notes?.workNotes || '',
    partsUsed: extracted.partsUsed || [],
    recommendations: extracted.recommendations || matchedJob?.techRecommendations || '',

    hasTechSignature: !!extracted.hasTechSignature,
    hasCustomerSignature: !!extracted.hasCustomerSignature,

    matchedJob,
    matchedCustomer,
    matchConfidence: confidence,
    matchReason: reason,
    rawText
  };
};
