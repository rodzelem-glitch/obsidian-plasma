import { cleanUndefinedFields } from './utils';
import { db } from './firebase';

/**
 * Generates an atomic sequential Job number (e.g. Job-1000, Job-999009)
 * governed by organization settings (jobPrefix, jobStartNumber, nextJobNum).
 */
export async function getNextJobNumber(orgId: string): Promise<string> {
  if (!orgId) {
    return `Job-${Date.now()}`;
  }
  
  const orgRef = db.collection('organizations').doc(orgId);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(orgRef);
      if (!doc.exists) {
        return `Job-${Date.now()}`;
      }
      
      const data = doc.data() || {};
      const prefix = data.jobPrefix !== undefined ? data.jobPrefix : 'Job-';
      const startNum = data.jobStartNumber !== undefined ? Number(data.jobStartNumber) : 1000;
      
      let nextNum = data.nextJobNum !== undefined ? Number(data.nextJobNum) : startNum;
      if (isNaN(nextNum)) {
        nextNum = startNum;
      }
      
      transaction.update(orgRef, {
        nextJobNum: nextNum + 1
      });
      
      return `${prefix}${nextNum}`;
    });
  } catch (error) {
    console.error('Error reserving atomic job number in transaction, falling back to timestamp:', error);
    return `Job-${Date.now()}`;
  }
}

/**
 * Extracts numeric or clean slug ID by stripping common job prefixes.
 * Examples: 'Job-999009' -> '999009', 'job-1785351474552' -> '1785351474552'.
 */
export function extractJobSlug(jobIdOrNumber: string | null | undefined): string {
  if (!jobIdOrNumber) return `${Date.now()}`;
  const raw = String(jobIdOrNumber).trim();
  const cleaned = raw.replace(/^(job-inv-|job-sched-|job-comp-|job-canc-|job-maint-|job-adhoc-pm-|demo-job-|job-|Job-|JOB-)/i, '');
  return cleaned || raw;
}

/**
 * Generates a letter suffix starting from the second document of the same type.
 * index 0 -> "" (1st document)
 * index 1 -> "A" (2nd document)
 * index 2 -> "B" (3rd document)
 * index 3 -> "C" (4th document)
 */
export function getLetterSuffix(index: number): string {
  if (index <= 0) return '';
  let result = '';
  let n = index - 1;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Resolves the next available, collision-free document number with letter suffixes.
 * Checks against existing active document IDs in memory or provided collection.
 * Example:
 * If 'INV-1082' is already used, returns 'INV-1082A'.
 * If 'INV-1082A' is also used, returns 'INV-1082B', etc.
 */
export function resolveNextAvailableDocumentNumber(
  prefix: string,
  baseSlug: string,
  existingIds: string[] | Set<string>
): string {
  const cleanBase = baseSlug.replace(/^[A-Za-z]+-/, '').trim();
  const existingSet = existingIds instanceof Set 
    ? existingIds 
    : new Set((existingIds || []).map(id => String(id).trim().toUpperCase()));
  
  // Try base without suffix first (index 0)
  const baseCandidate = `${prefix}-${cleanBase}`.toUpperCase();
  if (!existingSet.has(baseCandidate)) {
    return `${prefix}-${cleanBase}`;
  }

  // Iterate suffixes A, B, C, ... (index 1 to 1000)
  let index = 1;
  while (index < 1000) {
    const suffix = getLetterSuffix(index);
    const candidate = `${prefix}-${cleanBase}${suffix}`.toUpperCase();
    if (!existingSet.has(candidate)) {
      return `${prefix}-${cleanBase}${suffix}`;
    }
    index++;
  }
  return `${prefix}-${cleanBase}-${Date.now()}`;
}

/**
 * Resolves the job-aligned Invoice number (e.g. INV-999009, INV-999009A).
 * If existingInvoices or jobs are provided, automatically increments to the next available letter suffix without collision.
 */
export function resolveJobInvoiceNumber(job: any, index = 0, existingInvoicesOrJobs?: any[]): string {
  const slug = extractJobSlug(typeof job === 'string' ? job : (job?.jobNumber || job?.id));
  
  if (Array.isArray(existingInvoicesOrJobs) && existingInvoicesOrJobs.length > 0) {
    const existingIds = new Set<string>();
    existingInvoicesOrJobs.forEach((item: any) => {
      const invId = item?.invoice?.id || item?.invoiceNumber || (typeof item?.id === 'string' && item.id.startsWith('INV-') ? item.id : null);
      if (invId) existingIds.add(String(invId).trim().toUpperCase());
    });
    return resolveNextAvailableDocumentNumber('INV', slug, existingIds);
  }

  const suffix = getLetterSuffix(index);
  return `INV-${slug}${suffix}`;
}

/**
 * Resolves the job-aligned Proposal number (e.g. PROP-999009, PROP-999009A).
 * If existingProposals is provided, automatically increments to the next available letter suffix without collision.
 */
export function resolveJobProposalNumber(job: any, index = 0, existingProposals?: any[]): string {
  const slug = extractJobSlug(typeof job === 'string' ? job : (job?.jobNumber || job?.id));

  if (Array.isArray(existingProposals) && existingProposals.length > 0) {
    const existingIds = new Set<string>();
    existingProposals.forEach((item: any) => {
      const propId = item?.proposalNumber || item?.id;
      if (propId) existingIds.add(String(propId).trim().toUpperCase());
    });
    return resolveNextAvailableDocumentNumber('PROP', slug, existingIds);
  }

  const suffix = getLetterSuffix(index);
  return `PROP-${slug}${suffix}`;
}

/**
 * Resolves the Work Order number.
 * If client-provided external WO# / PO# exists, it is preserved verbatim.
 * Otherwise generates a subcontractor WO number (e.g. WO-999009, WO-999009A).
 */
export function resolveJobWorkOrderNumber(job: any, index = 0): string {
  if (job && typeof job === 'object') {
    if (job.workOrderNumber) return job.workOrderNumber;
    if (job.poNumber) return job.poNumber;
  }
  const slug = extractJobSlug(typeof job === 'string' ? job : (job?.jobNumber || job?.id));
  const suffix = getLetterSuffix(index);
  return `WO-${slug}${suffix}`;
}

/**
 * Deterministically resolves the exact document ID and reference number for any document.
 * Preserves stored IDs for legacy/existing documents to ensure zero accounting disruption.
 */
export function resolveDocumentDisplayId(type: string, data: any): { id: string; referenceNumber?: string | null } {
  if (!data) return { id: 'DRAFT', referenceNumber: null };
  const docType = String(type || '').toLowerCase();
  
  if (docType === 'invoice') {
    const inv = data?.invoice || data;
    const explicitId = inv?.id || (typeof data?.id === 'string' && /^inv-/i.test(data.id) ? data.id : null);
    const refNum = inv?.referenceNumber || (data as any)?.invoiceReferenceNumber || null;
    
    if (explicitId) {
      const raw = String(explicitId).trim();
      if (/^inv-/i.test(raw)) {
        return { id: `INV-${raw.replace(/^inv-/i, '')}`, referenceNumber: refNum };
      }
      if (!raw.toLowerCase().startsWith('job-')) {
        return { id: `INV-${raw}`, referenceNumber: refNum };
      }
    }
    const jobSlug = extractJobSlug(data?.jobNumber || data?.id || inv?.jobId);
    return { id: `INV-${jobSlug}`, referenceNumber: refNum };
  }
  
  if (docType === 'proposal') {
    const prop = data?.proposal || data;
    const explicitId = prop?.proposalNumber || prop?.id;
    const refNum = prop?.referenceNumber || null;
    
    if (explicitId) {
      const raw = String(explicitId).trim();
      if (/^prop-/i.test(raw)) {
        return { id: `PROP-${raw.replace(/^prop-/i, '')}`, referenceNumber: refNum };
      }
      if (!raw.toLowerCase().startsWith('job-')) {
        return { id: `PROP-${raw}`, referenceNumber: refNum };
      }
    }
    const jobSlug = extractJobSlug(prop?.jobId || data?.id);
    return { id: `PROP-${jobSlug}`, referenceNumber: refNum };
  }
  
  if (docType === 'workorder' || docType === 'work order' || docType === 'subcontractorworkorder') {
    const explicitWo = data?.workOrderNumber || data?.poNumber || (data?.subcontractorWorkOrder as any)?.ivrPin;
    const refNum = data?.referenceNumber || null;
    if (explicitWo) return { id: explicitWo, referenceNumber: refNum };
    const jobSlug = extractJobSlug(data?.jobNumber || data?.id);
    return { id: `WO-${jobSlug}`, referenceNumber: refNum };
  }
  
  return { id: data?.id || data?.title || 'DOCUMENT', referenceNumber: data?.referenceNumber || null };
}

export async function getNextInvoiceNumber(orgId: string): Promise<string> {
  if (!orgId) {
    return `INV-${Date.now()}`;
  }
  
  const orgRef = db.collection('organizations').doc(orgId);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(orgRef);
      if (!doc.exists) {
        return `INV-${Date.now()}`;
      }
      
      const data = doc.data() || {};
      const prefix = data.invoicePrefix !== undefined ? data.invoicePrefix : 'INV-';
      const startNum = data.invoiceStartNumber !== undefined ? Number(data.invoiceStartNumber) : 1000;
      
      let nextNum = data.nextInvoiceNum !== undefined ? Number(data.nextInvoiceNum) : startNum;
      
      if (isNaN(nextNum)) {
        nextNum = startNum;
      }
      
      transaction.update(orgRef, {
        nextInvoiceNum: nextNum + 1
      });
      
      return `${prefix}${nextNum}`;
    });
  } catch (error) {
    console.error('Error reserving atomic invoice number in transaction, falling back to timestamp:', error);
    return `INV-${Date.now()}`;
  }
}

export async function getNextInvoiceNumbers(orgId: string, count: number): Promise<string[]> {
  if (!orgId || count <= 0) {
    return Array.from({ length: Math.max(0, count) }, (_, i) => `INV-${Date.now()}-${i}`);
  }
  
  const orgRef = db.collection('organizations').doc(orgId);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(orgRef);
      if (!doc.exists) {
        return Array.from({ length: count }, (_, i) => `INV-${Date.now()}-${i}`);
      }
      
      const data = doc.data() || {};
      const prefix = data.invoicePrefix !== undefined ? data.invoicePrefix : 'INV-';
      const startNum = data.invoiceStartNumber !== undefined ? Number(data.invoiceStartNumber) : 1000;
      
      let nextNum = data.nextInvoiceNum !== undefined ? Number(data.nextInvoiceNum) : startNum;
      
      if (isNaN(nextNum)) {
        nextNum = startNum;
      }
      
      const results: string[] = [];
      for (let i = 0; i < count; i++) {
        results.push(`${prefix}${nextNum + i}`);
      }
      
      transaction.update(orgRef, {
        nextInvoiceNum: nextNum + count
      });
      
      return results;
    });
  } catch (error) {
    console.error('Error reserving batch atomic invoice numbers in transaction, falling back to timestamps:', error);
    return Array.from({ length: count }, (_, i) => `INV-${Date.now()}-${i}`);
  }
}

export async function getNextProposalNumber(orgId: string): Promise<string> {
  if (!orgId) {
    return `PROP-${Date.now()}`;
  }
  
  const orgRef = db.collection('organizations').doc(orgId);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(orgRef);
      if (!doc.exists) {
        return `PROP-${Date.now()}`;
      }
      
      const data = doc.data() || {};
      const prefix = data.proposalPrefix !== undefined ? data.proposalPrefix : 'PROP-';
      const startNum = data.proposalStartNumber !== undefined ? Number(data.proposalStartNumber) : 1000;
      
      let nextNum = data.nextProposalNum !== undefined ? Number(data.nextProposalNum) : startNum;
      
      if (isNaN(nextNum)) {
        nextNum = startNum;
      }
      
      transaction.update(orgRef, {
        nextProposalNum: nextNum + 1
      });
      
      return `${prefix}${nextNum}`;
    });
  } catch (error) {
    console.error('Error reserving atomic proposal number in transaction, falling back to timestamp:', error);
    return `PROP-${Date.now()}`;
  }
}
