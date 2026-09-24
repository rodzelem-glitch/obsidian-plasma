import { getFunctions, httpsCallable } from 'firebase/functions';

export interface DataPlateExtractedInfo {
  brand?: string;
  model?: string;
  serial?: string;
  type?: string;
  year?: string;
  tonnage?: string | number;
  refrigerantType?: string;
  electricityType?: string;
  seerRating?: string;
  volts?: string;
  amps?: string;
  phase?: string;
  refrigerantCharge?: string;
  btuCapacity?: string;
  compressorType?: string;
  blowerType?: string;
  heatType?: string;
  filterType?: string;
  systemGroupRole?: string;
}

// Convert File to Base64 Data URL
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Convert File, Data URL, or HTTP/Blob URL to clean Base64 data and MIME type
export const imageInputToBase64 = async (input: File | string): Promise<{ base64Data: string; mimeType: string }> => {
  if (typeof input !== 'string') {
    const dataUrl = await fileToBase64(input);
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+VP8-]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], base64Data: match[2] };
    }
    return { mimeType: input.type || 'image/jpeg', base64Data: dataUrl.replace(/^data:[^;]+;base64,/, '') };
  }

  // If input is a Data URL string:
  if (input.startsWith('data:')) {
    const match = input.match(/^data:(image\/[a-zA-Z0-9.+VP8-]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], base64Data: match[2] };
    }
  }

  // If input is an HTTP or Blob URL:
  if (input.startsWith('http') || input.startsWith('blob')) {
    try {
      const res = await fetch(input);
      const blob = await res.blob();
      const mimeType = blob.type || 'image/jpeg';
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+VP8-]+);base64,(.+)$/);
      if (match) {
        return { mimeType: match[1], base64Data: match[2] };
      }
      return { mimeType, base64Data: dataUrl.replace(/^data:[^;]+;base64,/, '') };
    } catch (e) {
      console.warn("Failed to fetch image URL directly, passing fallback:", e);
    }
  }

  // Fallback: Raw base64 string
  const cleanB64 = input.replace(/^data:[^;]+;base64,/, '');
  return { mimeType: 'image/jpeg', base64Data: cleanB64 };
};

/**
 * High-precision equipment data plate OCR scanner using Gemini 3.7 Flash Multimodal Vision AI.
 * Merges extracted fields with existing data WITHOUT replacing any manually entered values.
 */
export const scanDataPlatePhoto = async (
  fileOrBase64: File | string,
  existingData: Partial<DataPlateExtractedInfo> = {}
): Promise<DataPlateExtractedInfo> => {
  try {
    const { base64Data, mimeType } = await imageInputToBase64(fileOrBase64);

    const fns = getFunctions();
    const callGeminiAI = httpsCallable(fns, 'callGeminiAI', { timeout: 120000 });

    const prompt = `You are an elite master field-service HVAC, Refrigeration, & Electrical data plate OCR system.
Analyze this equipment rating plate / nameplate sticker with extreme character precision.

Perform a meticulous 2-pass verification on the text:
Pass 1: Read all fields.
Pass 2: Double check model/serial characters against common confusion pairs (0 vs O, 1 vs I/l, 8 vs B, 5 vs S, 2 vs Z, 6 vs G).

Return strictly valid JSON with no markdown wrapper, matching this schema:
{
  "brand": "Manufacturer name (e.g. Trane, Carrier, Lennox, York, Rheem, Goodman, Square D, Siemens) or null",
  "model": "Exact Model Number (M/N, MOD, MODEL NO) or null",
  "serial": "Exact Serial Number (S/N, SER, SERIAL NO) or null",
  "type": "Equipment Type (e.g. Air Handler, Condenser, Package Unit, Furnace, Heat Pump, Compressor, Chiller, Boiler, Water Heater, Generator, Mini Split) or null",
  "year": "Manufactured Year (4-digit year decoded or stated) or null",
  "tonnage": "Cooling Capacity in TONS as a decimal (e.g. 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 7.5, 10.0). Note: If capacity is given in MBH or 1,000s BTU/hr (e.g. 018=1.5 Tons, 024=2.0 Tons, 030=2.5 Tons, 036=3.0 Tons, 042=3.5 Tons, 048=4.0 Tons, 060=5.0 Tons), convert it to TONS by dividing MBH by 12. Never report raw MBH (like 36 or 48) as tonnage! Or null if unstated.",
  "refrigerantType": "Refrigerant type (R-410A, R-22, R-454B, R-134a, R-404A) or null",
  "refrigerantCharge": "Factory Refrigerant Charge (e.g. 5 lbs 8 oz, 104 oz) or null",
  "btuCapacity": "BTU Rating (e.g. 36000 BTU/h) or null",
  "heatType": "Heating Type (Gas, Electric, Heat Pump, Hydronic, N/A) or null",
  "electricityType": "Voltage / Electrical Rating (e.g. 208-230V / 1Ph / 60Hz, 460V / 3Ph) or null",
  "seerRating": "SEER / SEER2 Rating if stated or null",
  "volts": "Voltage (e.g. 208-230V) or null",
  "amps": "FLA / MCA / Max Fuse Amps or null",
  "phase": "Phase (e.g. 1Ph, 3Ph) or null",
  "filterType": "Standard Filter size if cabinet stated (e.g. 20x25x1) or null",
  "compressorType": "Compressor Type (e.g. Scroll, Reciprocating, Inverter) or null",
  "blowerType": "Blower / Drive Type (e.g. ECM, PSC, Direct Drive) or null",
  "systemGroupRole": "Suggested system role (e.g. Condensing Unit, Evaporator, Compressor, Controller) or null"
}

Strict Rules:
1. MODEL & SERIAL ACCURACY: Read each alphanumeric character carefully. Do not confuse '0' (zero) with 'O', or '1' with 'I' or 'l'.
2. TONNAGE ACCURACY: 1 Ton = 12,000 BTU/hr (12 MBH). 36 MBH = 3.0 Tons. 48 MBH = 4.0 Tons. 24 MBH = 2.0 Tons. 60 MBH = 5.0 Tons. 18 MBH = 1.5 Tons. Always return TONS as a decimal (e.g. 3.0, 4.0). Do not invent tonnage if unreadable.
3. EQUIPMENT TYPE CLASSIFICATION: Classify unit type accurately based on model nomenclature or data plate headers (e.g., Air Handler, Condenser, Package Unit, Furnace, Heat Pump, Compressor, Chiller, Boiler, Water Heater).
4. No Hallucinations: If a field is not present or illegible, set it to null.`;

    const result: any = await callGeminiAI({
      prompt,
      imageParts: [{ base64Data, mimeType }],
      image: { base64Data, mimeType },
      modelName: 'gemini-3.8-flash',
      config: { 
        temperature: 0.0,
        topP: 0.1,
        response_mime_type: 'application/json' 
      }
    });

    const rawText = result.data?.text || result.data?.result || result.data || '{}';
    const cleanJsonStr = (typeof rawText === 'string' ? rawText : JSON.stringify(rawText))
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let extracted: DataPlateExtractedInfo = {};
    try {
      const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        extracted = JSON.parse(cleanJsonStr);
      }
    } catch (e) {
      console.warn("Failed to parse Gemini OCR JSON output:", e);
    }

    // Tonnage MBH-to-Tons Normalization Sanity Check:
    if (extracted.tonnage !== undefined && extracted.tonnage !== null) {
      let numTon = typeof extracted.tonnage === 'number' ? extracted.tonnage : parseFloat(String(extracted.tonnage));
      if (!isNaN(numTon)) {
        // If AI reported MBH (e.g. 18, 24, 30, 36, 42, 48, 60, 72, 90, 120) instead of Tons:
        if (numTon >= 12 && numTon <= 600 && numTon % 6 === 0) {
          numTon = numTon / 12;
        }
        // Round to 1 decimal place (e.g. 3.5)
        extracted.tonnage = Math.round(numTon * 10) / 10;
      }
    }

    // Merge strategy: Preserve ALL existing non-empty manual entries!
    const finalResult: DataPlateExtractedInfo = { ...extracted };

    const keys: (keyof DataPlateExtractedInfo)[] = [
      'brand', 'model', 'serial', 'type', 'year', 'tonnage', 
      'refrigerantType', 'electricityType', 'seerRating', 'volts', 'amps', 'phase',
      'refrigerantCharge', 'btuCapacity', 'compressorType', 'blowerType', 'heatType', 'filterType', 'systemGroupRole'
    ];

    for (const key of keys) {
      const existingVal = existingData[key];
      if (existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== '') {
        // User manually entered this field -> DO NOT OVERWRITE!
        finalResult[key] = existingVal as any;
      } else if (extracted[key] !== undefined && extracted[key] !== null) {
        finalResult[key] = String(extracted[key]).trim() as any;
      }
    }

    return finalResult;
  } catch (err) {
    console.error("Gemini Vision Data Plate OCR failed:", err);
    // If error occurs, return existing manual data untouched
    return existingData;
  }
};
