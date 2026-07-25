import { getCurrentLocation, LocationData } from './geolocation';
import { generateSecurityHash } from '../components/ui/DigitalSignatureStamp';

export interface SignatureMetadata {
    signatureUrl: string;
    signedByName: string;
    signedAt: string;
    geolocation?: LocationData | null;
    securityHash: string;
    documentTitle?: string;
    documentId?: string;
}

export interface SignatureAuditSnapshot {
    version: number;
    archivedAt: string;
    archivedByName?: string;
    reason?: string;
    signatureUrl?: string | null;
    signatureMetadata?: SignatureMetadata | null;
    documentSnapshot: any;
}

/**
 * Creates an official signature package with captured GPS location, timestamp, and security hash.
 */
export const createSignaturePackage = async (
    signatureUrl: string,
    signedByName: string,
    documentTitle: string = 'Signed Document',
    documentId?: string
): Promise<SignatureMetadata> => {
    let location: LocationData | null = null;
    try {
        location = await getCurrentLocation();
    } catch (err) {
        console.warn("[createSignaturePackage] Failed to capture GPS location:", err);
    }

    const signedAt = new Date().toISOString();
    const seed = `${signedByName}_${signedAt}_${documentTitle}_${documentId || ''}`;
    const securityHash = generateSecurityHash(seed);

    return {
        signatureUrl,
        signedByName,
        signedAt,
        geolocation: location,
        securityHash,
        documentTitle,
        documentId
    };
};

/**
 * Checks if a document has an active signature. If it does, creates an archived snapshot
 * of the unedited signed document in `signatureHistory` and clears the active signature fields.
 */
export const handleDocumentEditWithSignatureCheck = <T extends Record<string, any>>(
    currentDoc: T,
    editorName: string = 'Staff',
    editReason: string = 'Document edited after signature'
): { updatedDoc: T; wasInvalidated: boolean; archivedVersion?: number } => {
    const hasSignature = !!(
        currentDoc.signatureUrl ||
        currentDoc.customerSignature ||
        currentDoc.invoiceSignature ||
        currentDoc.signatureMetadata
    );

    if (!hasSignature) {
        return { updatedDoc: currentDoc, wasInvalidated: false };
    }

    const currentHistory: SignatureAuditSnapshot[] = currentDoc.signatureHistory || [];
    const newVersionNumber = currentHistory.length + 1;

    // Snapshot of unedited document preserving the signature & metadata
    const docSnapshot = { ...currentDoc };

    const snapshot: SignatureAuditSnapshot = {
        version: newVersionNumber,
        archivedAt: new Date().toISOString(),
        archivedByName: editorName,
        reason: editReason,
        signatureUrl: currentDoc.signatureUrl || currentDoc.customerSignature || currentDoc.invoiceSignature || null,
        signatureMetadata: currentDoc.signatureMetadata || null,
        documentSnapshot: docSnapshot
    };

    const updatedHistory = [...currentHistory, snapshot];

    // Remove active signature from the modified active document
    const updatedDoc: T = {
        ...currentDoc,
        signatureUrl: null,
        customerSignature: null,
        invoiceSignature: null,
        signatureMetadata: null,
        invoiceSignedDate: null,
        signatureHistory: updatedHistory
    };

    return {
        updatedDoc,
        wasInvalidated: true,
        archivedVersion: newVersionNumber
    };
};
