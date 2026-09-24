import { cleanUndefinedFields } from './utils';
import { storage, db, firebase } from './firebase';
import { compressImageFile, compressDataUrl } from './imageCompression';

// In-memory cache for organization storage limits to avoid blocking Firestore round trips on every upload
const storageQuotaCache = new Map<string, { limitBytes: number; totalBytesUsed: number; timestamp: number }>();
const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Uploads a file (File object or Data URL string) to Firebase Storage and returns the public download URL.
 * Automatically applies client-side image compression to multi-megapixel photos to boost upload speed by 10x-20x.
 * 
 * @param path The full path in the bucket where the file should be saved (e.g. 'organizations/orgId/...')
 * @param fileData The file to be uploaded. Can be a DOM File object or a Base64 Data URL string.
 * @returns The persistent HTTPS download URL
 */
export const uploadFileToStorage = async (path: string, fileData: File | string): Promise<string> => {
    try {
        let processedData: File | string = fileData;
        let byteSize = 0;

        // Auto-compress high-res images on client before uploading to save mobile bandwidth
        if (fileData instanceof File && fileData.type.startsWith('image/')) {
            try {
                processedData = await compressImageFile(fileData);
                byteSize = (processedData as File).size;
            } catch (compErr) {
                console.warn("Client image compression fallback:", compErr);
                byteSize = fileData.size;
            }
        } else if (typeof fileData === 'string' && fileData.startsWith('data:image/')) {
            try {
                processedData = await compressDataUrl(fileData);
                byteSize = Math.round(processedData.length * 0.75);
            } catch (compErr) {
                console.warn("Client dataUrl compression fallback:", compErr);
                byteSize = Math.round(fileData.length * 0.75);
            }
        } else if (typeof fileData === 'string') {
            byteSize = Math.round(fileData.length * 0.75); // base64 decoded size approximation
        } else {
            byteSize = fileData.size;
        }

        const pathParts = path.split('/');
        const orgId = pathParts[0] === 'organizations' ? pathParts[1] : null;

        // Non-blocking cached storage quota check
        if (orgId) {
            try {
                const now = Date.now();
                let quotaData = storageQuotaCache.get(orgId);

                if (!quotaData || (now - quotaData.timestamp > QUOTA_CACHE_TTL_MS)) {
                    const orgUsageDoc = await db.collection('storageUsage').doc(orgId).get();
                    if (orgUsageDoc.exists) {
                        const data = orgUsageDoc.data();
                        quotaData = {
                            limitBytes: data?.limitBytes || 0,
                            totalBytesUsed: data?.totalBytesUsed || 0,
                            timestamp: now
                        };
                        storageQuotaCache.set(orgId, quotaData);
                    }
                }

                if (quotaData && quotaData.limitBytes > 0) {
                    if (quotaData.totalBytesUsed + byteSize > quotaData.limitBytes) {
                        throw new Error(`Storage quota exceeded. Please contact your administrator. Limit: ${(quotaData.limitBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);
                    }
                }
            } catch (err: unknown) {
                if (err instanceof Error && err.message.includes('Storage quota exceeded')) {
                    throw err;
                }
                console.warn("Non-fatal: Could not check storage quota", err);
            }
        }

        const storageRef = storage.ref().child(path);
        let snapshot;
        
        const uploadMetadata = typeof processedData !== 'string' && (processedData as File).type
            ? { contentType: (processedData as File).type }
            : undefined;

        // Resilient upload with 1-shot retry for cellular network stability on job sites
        try {
            if (typeof processedData === 'string') {
                snapshot = await storageRef.putString(processedData, 'data_url');
            } else {
                snapshot = await storageRef.put(processedData, uploadMetadata);
            }
        } catch (firstErr) {
            console.warn(`[storageService] Primary upload attempt failed for ${path}. Retrying in 1.2s...`, firstErr);
            await new Promise(r => setTimeout(r, 1200));
            if (typeof processedData === 'string') {
                snapshot = await storageRef.putString(processedData, 'data_url');
            } else {
                snapshot = await storageRef.put(processedData, uploadMetadata);
            }
        }

        const downloadURL = await snapshot.ref.getDownloadURL();
        
        // Asynchronously log the bytes used in the background (fire-and-forget, non-blocking)
        if (orgId) {
            const orgUsageRef = db.collection('storageUsage').doc(orgId);
            orgUsageRef.set({
                totalBytesUsed: firebase.firestore.FieldValue.increment(byteSize),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(dbError => {
                console.warn("Non-fatal: Failed to log storage metrics", dbError);
            });

            const cached = storageQuotaCache.get(orgId);
            if (cached) {
                cached.totalBytesUsed += byteSize;
            }
        }

        return downloadURL;
    } catch (error) {
        console.error("Error uploading file to storage:", error);
        throw error;
    }
};
