import { cleanUndefinedFields } from './utils';
﻿import { db } from './firebase';

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
