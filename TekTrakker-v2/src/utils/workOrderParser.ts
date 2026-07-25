import type { Customer } from '../types';

export interface ParsedWorkOrder {
  poNumber: string;
  customerName: string;
  matchedCustomer: Customer | null;
  matchedPropertyId: string;
  date: string;
  timeSlot: string;
  priority: 'High' | 'Normal';
  jobType: string;
  notes: string;
}

// Dynamically load PDF.js from CDN
const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      // Configure worker from CDN as well to avoid origin issues
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = (err) => {
      console.error("Failed to load PDF.js from CDN:", err);
      reject(err);
    };
    document.head.appendChild(script);
  });
};

// Extract text from PDF file
export const extractTextFromPdf = async (file: File): Promise<string> => {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
};

// Parse extracted text to extract booking metadata
export const parseWorkOrderText = (text: string, customers: Customer[]): ParsedWorkOrder => {
  const lowerText = text.toLowerCase();
  
  // Initialize result
  const result: ParsedWorkOrder = {
    poNumber: '',
    customerName: '',
    matchedCustomer: null,
    matchedPropertyId: '',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '09:00',
    priority: 'Normal',
    jobType: 'Repair',
    notes: ''
  };

  // 1. Parse PO / WO Number
  // Match patterns like "PO Number: 12345", "WO# 12345", "PO# 05527", etc.
  const poRegexes = [
    /(?:po\s*number|po\s*#|purchase\s*order\s*#|purchase\s*order|work\s*order\s*#|work\s*order|wo\s*#|wo\s*number|wo)\s*[:#-]?\s*([a-zA-Z0-9_\-]+)/gi,
    /\b(wo|po)\s*[:#-]?\s*([a-zA-Z0-9_\-]+)\b/gi,
    /\b[0-9]{5,7}\b/g // Alphanumeric standalone 5-7 digit codes (like 05527)
  ];

  for (const regex of poRegexes) {
    const match = regex.exec(text);
    if (match) {
      // The group or the match itself
      const val = match[1] || match[0];
      if (val && val.length >= 3 && !['hvac', 'date', 'time', 'page'].includes(val.toLowerCase())) {
        result.poNumber = val.trim();
        break;
      }
    }
  }

  // 2. Parse Priority
  if (
    lowerText.includes('emergency') || 
    lowerText.includes('urgent') || 
    lowerText.includes('critical') || 
    lowerText.includes('high priority') || 
    lowerText.includes('stat')
  ) {
    result.priority = 'High';
  }

  // 3. Match Customer from Database
  // Check if any customer name appears in the work order
  let bestCustomer: Customer | null = null;
  let bestScore = 0;
  
  for (const customer of customers) {
    const name = customer.name.toLowerCase();
    // Clean up name for checking (e.g. remove "inc", "corp", "services" to prevent false negatives)
    const cleanName = name.replace(/\b(inc|corp|services|llc|co|company|group)\b/g, '').trim();
    if (cleanName.length > 3 && lowerText.includes(cleanName)) {
      const score = cleanName.length;
      if (score > bestScore) {
        bestScore = score;
        bestCustomer = customer;
      }
    }
  }

  // If no customer matched by name, check by primary address or service location addresses
  if (!bestCustomer) {
    for (const customer of customers) {
      // Check customer primary address
      if (customer.address) {
        const cleanAddr = customer.address.toLowerCase().split(',')[0].trim(); // Get street part
        if (cleanAddr.length > 5 && lowerText.includes(cleanAddr)) {
          bestCustomer = customer;
          break;
        }
      }
      // Check service location addresses
      if (customer.serviceLocations) {
        for (const loc of customer.serviceLocations) {
          if (loc.address) {
            const cleanAddr = loc.address.toLowerCase().split(',')[0].trim();
            if (cleanAddr.length > 5 && lowerText.includes(cleanAddr)) {
              bestCustomer = customer;
              break;
            }
          }
        }
      }
      if (bestCustomer) break;
    }
  }

  if (bestCustomer) {
    result.matchedCustomer = bestCustomer;
    result.customerName = bestCustomer.name;
    
    // 4. Match Service Location / Property Target
    let matchedLocId = '';
    if (bestCustomer.serviceLocations && bestCustomer.serviceLocations.length > 0) {
      for (const loc of bestCustomer.serviceLocations) {
        if (loc.address) {
          const streetPart = loc.address.toLowerCase().split(',')[0].trim();
          // Extract house number if possible
          const houseNo = streetPart.match(/^\d+/);
          if (houseNo && lowerText.includes(streetPart)) {
            matchedLocId = loc.id;
            break;
          }
        }
        // Match by property name (e.g. "Humana #03855")
        if (loc.propertyName || loc.name) {
          const propName = (loc.propertyName || loc.name || '').toLowerCase();
          if (propName.length > 4 && lowerText.includes(propName)) {
            matchedLocId = loc.id;
            break;
          }
        }
      }
      
      // Fallback: If no location matched but they only have one service location, select that one!
      if (!matchedLocId && bestCustomer.serviceLocations.length === 1) {
        matchedLocId = bestCustomer.serviceLocations[0].id;
      }
      
      result.matchedPropertyId = matchedLocId;
    } else if (bestCustomer.customerType !== 'Property Management') {
      result.matchedPropertyId = 'default';
    }
  }

  // 5. Parse Date
  // Check typical date formats
  const dateRegexes = [
    /(?:scheduled|service|appointment|date)\s*(?:of\s*service)?\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{4})/i,
    /([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{4})/i,
    /([0-9]{4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,2})/i
  ];

  for (const regex of dateRegexes) {
    const match = regex.exec(text);
    if (match && match[1]) {
      const dateStr = match[1].replace(/\-/g, '/');
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        result.date = d.toISOString().split('T')[0];
        break;
      }
    }
  }

  // 6. Parse Time Slot
  const timeRegex = /(?:time|scheduled|at)\s*[:\-]?\s*([0-9]{1,2}:[0-9]{2}\s*(?:am|pm)?)/i;
  const timeMatch = timeRegex.exec(text);
  if (timeMatch && timeMatch[1]) {
    const rawTime = timeMatch[1].trim().toLowerCase();
    // Convert to 24 hour HH:MM
    const match = rawTime.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2];
      const ampm = match[3];
      
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      const hh = hours.toString().padStart(2, '0');
      result.timeSlot = `${hh}:${minutes}`;
    }
  }

  // 7. Parse Job Type / Tasks
  if (lowerText.includes('maintenance') || lowerText.includes('tune-up') || lowerText.includes('inspection')) {
    result.jobType = 'Maintenance';
  } else if (lowerText.includes('install') || lowerText.includes('replacement')) {
    result.jobType = 'Installation';
  } else if (lowerText.includes('estimate') || lowerText.includes('proposal') || lowerText.includes('quote')) {
    result.jobType = 'Estimate';
  } else {
    result.jobType = 'Repair'; // Default fallback
  }

  // 8. Parse Notes / Scope of Work
  // Match section headers to extract the description block
  const notesHeaders = [
    /(?:description|scope\s*of\s*work|special\s*instructions|instructions|problem\s*description|details|notes)\s*:\s*([\s\S]+?)(?=\n\s*(?:customer|billing|address|service|po\b|wo\b|date|time|priority|location|$))/i
  ];

  let foundNotes = '';
  for (const regex of notesHeaders) {
    const match = regex.exec(text);
    if (match && match[1]) {
      foundNotes = match[1].trim();
      break;
    }
  }

  // Clean notes from excess whitespace or duplicate headers
  if (foundNotes) {
    // Truncate if extremely long
    result.notes = foundNotes.slice(0, 1500);
  } else {
    // Fallback: use first few lines or non-empty segments
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 20 && !l.toLowerCase().includes('http') && !l.toLowerCase().includes('click'));
    if (lines.length > 0) {
      result.notes = lines.slice(0, 3).join('\n');
    }
  }

  return result;
};
