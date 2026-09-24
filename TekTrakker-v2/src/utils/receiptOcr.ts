import Tesseract from 'tesseract.js';

export interface ParsedReceiptData {
  cost?: string;
  tax?: string;
  vendor?: string;
  category?: 'Fuel' | 'Maintenance' | 'Parts & Supplies' | 'Tolls & Parking' | 'Miscellaneous';
  rawText?: string;
}

/**
 * OCR Receipt Parser helper using Tesseract.js
 * Scans image/dataUrl and extracts total amount, sales tax, vendor name, and category suggestion.
 */
export async function parseReceiptImage(imageInput: File | string): Promise<ParsedReceiptData> {
  try {
    const result = await Tesseract.recognize(imageInput, 'eng', {
      logger: (m) => console.log('Receipt OCR Progress:', m.status, m.progress),
    });

    const text = result?.data?.text || '';
    if (!text.trim()) return {};

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Extract Total Amount ($)
    let extractedCost: string | undefined = undefined;

    // Regex patterns for Total
    const totalPatterns = [
      /(?:TOTAL|BALANCE DUE|AMOUNT DUE|NET TOTAL|TOTAL DUE|AMOUNT)\s*[:\$]?\s*(\d+[\.,]\d{2})/i,
      /\$\s*(\d+[\.,]\d{2})/,
      /(\d+[\.,]\d{2})\s*TOTAL/i,
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const val = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(val) && val > 0 && val < 10000) {
          extractedCost = val.toFixed(2);
          break;
        }
      }
    }

    // Fallback cost search: find largest dollar amount in lines
    if (!extractedCost) {
      const allPrices: number[] = [];
      const priceRegex = /\$?(\d{1,4}\.\d{2})/g;
      let match;
      while ((match = priceRegex.exec(text)) !== null) {
        const p = parseFloat(match[1]);
        if (!isNaN(p) && p > 0.5 && p < 5000) {
          allPrices.push(p);
        }
      }
      if (allPrices.length > 0) {
        const maxPrice = Math.max(...allPrices);
        extractedCost = maxPrice.toFixed(2);
      }
    }

    // 2. Extract Sales Tax ($)
    let extractedTax: string | undefined = undefined;
    const taxPatterns = [
      /(?:SALES TAX|STATE TAX|GOVT TAX|TAX 1|TAX AMOUNT|EST\. TAX|TAX)\s*[:\$]?\s*(\d+[\.,]\d{2})/i,
      /TAX\s+\$\s*(\d+[\.,]\d{2})/i,
    ];

    for (const pattern of taxPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const val = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(val) && val >= 0 && val < 500) {
          extractedTax = val.toFixed(2);
          break;
        }
      }
    }

    // 2. Extract Vendor Name (known vendors or first line)
    let vendor: string | undefined = undefined;
    const knownVendors = [
      { name: 'Shell', cat: 'Fuel' },
      { name: 'Chevron', cat: 'Fuel' },
      { name: 'Exxon', cat: 'Fuel' },
      { name: 'Mobil', cat: 'Fuel' },
      { name: 'BP', cat: 'Fuel' },
      { name: '7-Eleven', cat: 'Fuel' },
      { name: 'Circle K', cat: 'Fuel' },
      { name: 'Speedway', cat: 'Fuel' },
      { name: 'Bucees', cat: 'Fuel' },
      { name: 'Love\'s', cat: 'Fuel' },
      { name: 'Pilot', cat: 'Fuel' },
      { name: 'QuikTrip', cat: 'Fuel' },
      { name: 'Valero', cat: 'Fuel' },
      { name: 'Home Depot', cat: 'Parts & Supplies' },
      { name: 'Lowe\'s', cat: 'Parts & Supplies' },
      { name: 'Ace Hardware', cat: 'Parts & Supplies' },
      { name: 'Grainger', cat: 'Parts & Supplies' },
      { name: 'Ferguson', cat: 'Parts & Supplies' },
      { name: 'AutoZone', cat: 'Maintenance' },
      { name: 'O\'Reilly', cat: 'Maintenance' },
      { name: 'Advance Auto Parts', cat: 'Maintenance' },
      { name: 'Jiffy Lube', cat: 'Maintenance' },
    ];

    let category: 'Fuel' | 'Maintenance' | 'Parts & Supplies' | 'Tolls & Parking' | 'Miscellaneous' | undefined = undefined;

    for (const v of knownVendors) {
      if (new RegExp(`\\b${v.name}\\b`, 'i').test(text)) {
        vendor = v.name;
        category = v.cat as any;
        break;
      }
    }

    if (!vendor && lines.length > 0) {
      // Use header line as vendor fallback if not a generic label
      const headerLine = lines[0].replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
      if (headerLine.length > 2 && headerLine.length < 35 && !/receipt|invoice|welcome|thank/i.test(headerLine)) {
        vendor = headerLine;
      }
    }

    // 3. Category heuristics if category not matched yet
    if (!category) {
      if (/gallons|unleaded|diesel|pump|fuel|gas|octane/i.test(text)) {
        category = 'Fuel';
      } else if (/oil|filter|tire|brake|fluid|wiper|transmission|mechanic|service/i.test(text)) {
        category = 'Maintenance';
      } else if (/hardware|pipe|fitting|wire|valve|duct|refrigerant|lumber|tool/i.test(text)) {
        category = 'Parts & Supplies';
      } else if (/parking|toll|garage|expressway|turnpike/i.test(text)) {
        category = 'Tolls & Parking';
      }
    }

    return {
      cost: extractedCost,
      tax: extractedTax,
      vendor,
      category,
      rawText: text,
    };
  } catch (err) {
    console.error("Receipt OCR parsing failed:", err);
    return {};
  }
}
