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
  visitType?: string;
  notes: string;
  // Raw extracted info for prompt creation if unmatched
  extractedCustomerName?: string;
  extractedAddress?: string;
  extractedCity?: string;
  extractedState?: string;
  extractedZip?: string;
  extractedPhone?: string;
  extractedEmail?: string;
  extractedPropertyName?: string;
  newLocationDetected?: boolean;
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

// Extract text from PDF file preserving exact line positioning and structural layout
export const extractTextFromPdf = async (file: File): Promise<string> => {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = (textContent.items || []) as any[];
    
    if (items.length === 0) continue;

    // Sort items vertically top-to-bottom (Y descending), then horizontally left-to-right (X ascending)
    items.sort((a, b) => {
      const yA = a.transform ? a.transform[5] : 0;
      const yB = b.transform ? b.transform[5] : 0;
      if (Math.abs(yA - yB) > 4) {
        return yB - yA;
      }
      const xA = a.transform ? a.transform[4] : 0;
      const xB = b.transform ? b.transform[4] : 0;
      return xA - xB;
    });

    let pageLines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of items) {
      const y = item.transform ? item.transform[5] : 0;
      if (lastY !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim()) pageLines.push(currentLine.trim());
        currentLine = '';
      }
      currentLine += (currentLine ? ' ' : '') + (item.str || '');
      lastY = y;
    }
    if (currentLine.trim()) pageLines.push(currentLine.trim());

    fullText += pageLines.join('\n') + '\n';
  }
  
  return fullText;
};

// Words to ignore when matching customer names to prevent false positive matches
const GENERIC_STOP_WORDS = new Set([
  'inc', 'corp', 'corporation', 'llc', 'co', 'company', 'group', 'services', 
  'service', 'hvac', 'solutions', 'properties', 'management', 'systems', 'air', 
  'electric', 'home', 'the', 'and', 'city', 'national', 'first', 'metro', 
  'prime', 'universal', 'global', 'tech', 'repair', 'heating', 'cooling'
]);

// Helper to escape regex special characters
const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Section-aware and scoring-based customer matching algorithm
export const matchCustomerFromText = (text: string, customers: Customer[]): { customer: Customer | null; propertyId: string } => {
  if (!customers || customers.length === 0) {
    return { customer: null, propertyId: '' };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const lowerText = text.toLowerCase();

  // Extract explicit sections if available (Customer / Client / Bill To / Service Location)
  let customerHeaderBlock = '';
  let serviceAddressBlock = '';

  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    if (/^(?:bill\s*to|customer|client|account\s*name|customer\s*name|billed\s*to)\b/i.test(lineLower)) {
      customerHeaderBlock += ' ' + lines.slice(i, Math.min(lines.length, i + 4)).join(' ');
    }
    if (/^(?:service\s*location|service\s*address|site|ship\s*to|property|location)\b/i.test(lineLower)) {
      serviceAddressBlock += ' ' + lines.slice(i, Math.min(lines.length, i + 4)).join(' ');
    }
  }

  const lowerCustomerBlock = customerHeaderBlock.toLowerCase();
  let bestCustomer: Customer | null = null;
  let highestScore = 0;

  for (const customer of customers) {
    let score = 0;
    const rawName = customer.name.trim();
    const nameLower = rawName.toLowerCase();

    // 1. Check exact full customer name in customer header block (+100)
    if (lowerCustomerBlock && lowerCustomerBlock.includes(nameLower)) {
      score += 100;
    } 
    // 2. Exact full customer name in main text with word boundaries (+60)
    else if (new RegExp(`\\b${escapeRegExp(nameLower)}\\b`, 'i').test(lowerText)) {
      score += 60;
    }

    // 3. Significant non-generic name words matching
    const nameTokens = nameLower.split(/\s+/).filter(w => w.length > 2 && !GENERIC_STOP_WORDS.has(w));
    if (nameTokens.length > 0) {
      let matchedTokens = 0;
      for (const token of nameTokens) {
        const tokenRegex = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
        if (lowerCustomerBlock && tokenRegex.test(lowerCustomerBlock)) {
          matchedTokens += 1.5;
        } else if (tokenRegex.test(lowerText)) {
          matchedTokens += 1;
        }
      }
      const tokenMatchRatio = matchedTokens / nameTokens.length;
      if (tokenMatchRatio >= 1) {
        score += 40;
      } else if (tokenMatchRatio >= 0.5 && nameTokens.length > 1) {
        score += 20;
      }
    }

    // 4. Customer Phone Match (+80)
    if (customer.phone) {
      const cleanPhone = customer.phone.replace(/\D/g, '');
      if (cleanPhone.length >= 7 && text.replace(/\D/g, '').includes(cleanPhone)) {
        score += 80;
      }
    }

    // 5. Customer Email Match (+90) and Contact Emails (+85 / +120 for Incoming Work Order contacts)
    if (customer.email && customer.email.length > 4 && lowerText.includes(customer.email.toLowerCase())) {
      score += 90;
    }
    if (customer.contacts && customer.contacts.length > 0) {
      for (const cnt of customer.contacts) {
        if (cnt.email && cnt.email.length > 4 && lowerText.includes(cnt.email.toLowerCase())) {
          if (cnt.isIncomingWorkOrderContact || (cnt.contactRoles || []).includes('incoming_workorders')) {
            score += 120;
          } else {
            score += 85;
          }
        }
      }
    }

    // 6. Street Address Match (+70)
    if (customer.address && customer.address.length > 6) {
      const streetPart = customer.address.split(',')[0].trim().toLowerCase();
      if (streetPart.length > 6 && lowerText.includes(streetPart)) {
        score += 70;
      }
    }

    // Check service location addresses
    if (customer.serviceLocations) {
      for (const loc of customer.serviceLocations) {
        if (loc.address && loc.address.length > 6) {
          const streetPart = loc.address.split(',')[0].trim().toLowerCase();
          if (streetPart.length > 6 && lowerText.includes(streetPart)) {
            score += 70;
            break;
          }
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestCustomer = customer;
    }
  }

  // Minimum confidence threshold of 45 points required to match a customer
  if (!bestCustomer || highestScore < 45) {
    return { customer: null, propertyId: '' };
  }

  // Determine property ID for the matched customer
  let matchedPropertyId = '';

  if (bestCustomer.serviceLocations && bestCustomer.serviceLocations.length > 0) {
    for (const loc of bestCustomer.serviceLocations) {
      if (loc.address) {
        const streetPart = loc.address.split(',')[0].trim().toLowerCase();
        if (streetPart.length > 5 && lowerText.includes(streetPart)) {
          matchedPropertyId = loc.id;
          break;
        }
      }
      if (loc.propertyName || loc.name) {
        const propName = (loc.propertyName || loc.name || '').toLowerCase();
        if (propName.length > 3 && lowerText.includes(propName)) {
          matchedPropertyId = loc.id;
          break;
        }
      }
    }

    // If only 1 service location exists and address wasn't conflicting, default to it
    if (!matchedPropertyId && bestCustomer.serviceLocations.length === 1) {
      matchedPropertyId = bestCustomer.serviceLocations[0].id;
    }
  } else if (bestCustomer.customerType !== 'Property Management') {
    matchedPropertyId = 'default';
  }

  return { customer: bestCustomer, propertyId: matchedPropertyId };
};

// Reserved system keywords that must not be mistaken for PO numbers
const RESERVED_WORDS = new Set([
  'number', 'order', 'date', 'description', 'service', 'time', 'page', 'total', 
  'customer', 'location', 'address', 'invoice', 'status', 'repair', 'priority', 
  'notes', 'urgent', 'high', 'normal', 'phone', 'email', 'hvac', 'technician'
]);

// Parse extracted text to extract booking metadata with rule-based heuristics
export const parseWorkOrderText = (text: string, customers: Customer[]): ParsedWorkOrder => {
  const lowerText = text.toLowerCase();
  
  const result: ParsedWorkOrder = {
    poNumber: '',
    customerName: '',
    matchedCustomer: null,
    matchedPropertyId: '',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '09:00',
    priority: 'Normal',
    jobType: 'Repair',
    visitType: 'Diagnostic & Repair',
    notes: ''
  };

  // 1. Match Customer & Property
  const { customer, propertyId } = matchCustomerFromText(text, customers);
  if (customer) {
    result.matchedCustomer = customer;
    result.customerName = customer.name;
    result.matchedPropertyId = propertyId;
  }

  // Raw extraction for unmatched customer creation or new location detection
  const customerNameMatch = /(?:customer\s*name|client\s*name|bill\s*to|billed\s*to|customer|client)\s*[:\-]\s*([^\n,]+)/i.exec(text);
  if (customerNameMatch && customerNameMatch[1]) {
    result.extractedCustomerName = customerNameMatch[1].trim();
  }

  // Section-aware address extraction (handles both colon-separated and multiline block formats)
  const addressMatch = /(?:service\s*location|service\s*address|site\s*address|ship\s*to|site\s*location)\s*[:\-]?\s*(?:\n|\r\n)?([^\n]+(?:\n[^\n]+)?)/i.exec(text);
  if (addressMatch && addressMatch[1]) {
    const rawAddrLines = addressMatch[1].split(/\n|\r\n/).map(l => l.trim()).filter(l => l && !/^(technician|vendor|contractor|subcontractor)\b/i.test(l));
    if (rawAddrLines.length > 0) {
      result.extractedAddress = rawAddrLines.join(', ');
    }
  }

  const phoneMatch = /(?:phone|tel|cell|mobile)\s*[:\-]?\s*([0-9\-\(\)\s\.]{10,15})/i.exec(text);
  if (phoneMatch && phoneMatch[1]) {
    result.extractedPhone = phoneMatch[1].trim();
  }

  const emailMatch = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i.exec(text);
  if (emailMatch && emailMatch[0]) {
    result.extractedEmail = emailMatch[0].trim();
  }

  // Check if a new location was detected for a matched customer
  if (result.matchedCustomer && result.extractedAddress && !result.matchedPropertyId) {
    const locAddressPart = result.extractedAddress.split(',')[0].trim().toLowerCase();
    const existing = (result.matchedCustomer.serviceLocations || []).some(loc => 
      loc.address && loc.address.toLowerCase().includes(locAddressPart)
    );
    if (!existing) {
      result.newLocationDetected = true;
    }
  }

  // 2. Parse PO / WO Number with strict labeled regexes
  const poRegexes = [
    /(?:purchase\s*order\s*#|purchase\s*order\s*num(?:ber)?|p\.?o\.?\s*#|p\.?o\.?\s*num(?:ber)?|work\s*order\s*#|work\s*order\s*num(?:ber)?|w\.?o\.?\s*#|w\.?o\.?\s*num(?:ber)?|tracking\s*#|req(?:uisition)?\s*#|order\s*#)\s*[:#-]?\s*([a-zA-Z0-9_\-]+)/i,
    /\b(?:po|wo|req)\s*[:#-]\s*([a-zA-Z0-9_\-]+)/i
  ];

  for (const regex of poRegexes) {
    const match = regex.exec(text);
    if (match && match[1]) {
      const val = match[1].trim();
      if (val.length >= 3 && !RESERVED_WORDS.has(val.toLowerCase())) {
        result.poNumber = val;
        break;
      }
    }
  }

  // 3. Parse Priority
  if (
    lowerText.includes('emergency') || 
    lowerText.includes('urgent') || 
    lowerText.includes('critical') || 
    lowerText.includes('high priority') || 
    lowerText.includes('stat') ||
    lowerText.includes('same day')
  ) {
    result.priority = 'High';
  }

  // 4. Parse Service Date
  const dateRegexes = [
    /(?:scheduled\s*date|service\s*date|appointment\s*date|date\s*of\s*service|requested\s*date|order\s*date|date)\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i,
    /\b(20\d{2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,2})\b/i,
    /\b([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][20]\d{2})\b/i
  ];

  for (const regex of dateRegexes) {
    const match = regex.exec(text);
    if (match && match[1]) {
      const rawDate = match[1].replace(/\./g, '/').replace(/-/g, '/');
      const parts = rawDate.split('/');
      let d: Date | null = null;
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          let year = parseInt(parts[2]);
          if (year < 100) year += 2000;
          d = new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]));
        }
      }
      if (d && !isNaN(d.getTime())) {
        result.date = d.toISOString().split('T')[0];
        break;
      }
    }
  }

  // 5. Parse Time Slot
  const timeRegex = /(?:time\s*slot|scheduled\s*at|arrival\s*window|time|window|at)\s*[:\-]?\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i;
  const timeMatch = timeRegex.exec(text);
  if (timeMatch && timeMatch[1]) {
    const rawTime = timeMatch[1].trim().toLowerCase();
    const match = rawTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] || '00';
      const ampm = match[3];
      
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      const hh = hours.toString().padStart(2, '0');
      result.timeSlot = `${hh}:${minutes}`;
    }
  }

  // 6. Parse Job Type & Visit Type
  if (lowerText.includes('maintenance') || lowerText.includes('tune-up') || lowerText.includes('preventative') || lowerText.includes('pm service')) {
    result.jobType = 'Maintenance';
    result.visitType = 'Maintenance';
  } else if (lowerText.includes('install') || lowerText.includes('replacement') || lowerText.includes('changeout')) {
    result.jobType = 'Installation';
    result.visitType = 'Repair';
  } else if (lowerText.includes('estimate') || lowerText.includes('proposal') || lowerText.includes('quote')) {
    result.jobType = 'Estimate';
    result.visitType = 'Diagnostic Only';
  } else if (lowerText.includes('inspection') || lowerText.includes('diagnostic only') || lowerText.includes('assessment')) {
    result.jobType = 'Repair';
    result.visitType = 'Diagnostic Only';
  } else {
    result.jobType = 'Repair';
    result.visitType = 'Diagnostic & Repair';
  }

  // 7. Parse Clean Notes / Scope of Work
  const notesRegexes = [
    /(?:scope\s*of\s*work|problem\s*description|issue\s*description|special\s*instructions|instructions|reason\s*for\s*call|work\s*requested|details|notes)\s*:\s*([\s\S]+?)(?=\n\s*(?:customer|billing|billed|service\s*location|po\s*#|wo\s*#|date|priority|location|technician|total|terms|$))/i,
    /(?:description)\s*:\s*([\s\S]+?)(?=\n\s*(?:customer|billing|billed|service\s*location|po\s*#|wo\s*#|date|priority|location|technician|total|terms|$))/i
  ];

  let extractedNotes = '';
  for (const regex of notesRegexes) {
    const match = regex.exec(text);
    if (match && match[1]) {
      extractedNotes = match[1].trim();
      break;
    }
  }

  if (extractedNotes) {
    result.notes = extractedNotes.replace(/\s+/g, ' ').slice(0, 1000);
  } else {
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => {
        if (l.length < 15) return false;
        const low = l.toLowerCase();
        if (low.includes('http') || low.includes('phone:') || low.includes('email:') || low.includes('invoice') || low.includes('bill to:')) return false;
        if (/^(?:po\s*#|wo\s*#|date:|time:|priority:)/i.test(l)) return false;
        return true;
      });

    if (lines.length > 0) {
      result.notes = lines.slice(0, 3).join('\n').slice(0, 800);
    }
  }

  return result;
};
