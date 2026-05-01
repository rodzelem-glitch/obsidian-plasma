import { storage, db, firebase } from './firebase';

/**
 * Uploads a file (File object or Data URL string) to Firebase Storage and returns the public download URL.
 * Also logs the storage consumption automatically.
 * 
 * @param path The full path in the bucket where the file should be saved (e.g. 'organizations/orgId/...')
 * @param fileData The file to be uploaded. Can be a DOM File object or a Base64 Data URL string.
 * @returns The persistent HTTPS download URL
 */
export const uploadFileToStorage = async (path: string, fileData: File | string): Promise<string> => {
    try {
        let byteSize = 0;
        if (typeof fileData === 'string') {
            byteSize = Math.round(fileData.length * 0.75); // base64 decoded size approximation
        } else {
            byteSize = fileData.size;
        }

        const pathParts = path.split('/');
        const orgId = pathParts[0] === 'organizations' ? pathParts[1] : null;

        if (orgId) {
            const orgUsageDoc = await db.collection('storageUsage').doc(orgId).get();
            if (orgUsageDoc.exists) {
                const data = orgUsageDoc.data();
                if (data?.limitBytes && data.totalBytesUsed !== undefined) {
                    if (data.totalBytesUsed + byteSize > data.limitBytes) {
                        throw new Error(`Storage quota exceeded. Please contact your administrator. Limit: ${(data.limitBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);
                    }
                }
            }
        }

        const storageRef = storage.ref().child(path);
        let snapshot;
        
        if (typeof fileData === 'string') {
            snapshot = await storageRef.putString(fileData, 'data_url');
        } else {
            snapshot = await storageRef.put(fileData);
        }

        const downloadURL = await snapshot.ref.getDownloadURL();
        
        // Asynchronously log the bytes used for the organization
        try {
            const pathParts = path.split('/');
            const orgId = pathParts[0] === 'organizations' ? pathParts[1] : null;
            
            if (orgId) {
                const orgUsageRef = db.collection('storageUsage').doc(orgId);
                
                // Using transaction ensures we don't overwrite limits
                await db.runTransaction(async (t) => {
                    const doc = await t.get(orgUsageRef);
                    if (doc.exists) {
                        t.update(orgUsageRef, { 
                            totalBytesUsed: firebase.firestore.FieldValue.increment(byteSize),
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    } else {
                        t.set(orgUsageRef, { 
                            totalBytesUsed: byteSize, 
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                            limitBytes: null
                        });
                    }
                });
            }
        } catch (dbError) {
            console.error("Non-fatal: Failed to log storage metrics", dbError);
        }

        return downloadURL;
    } catch (error) {
        console.error("Error uploading file to storage:", error);
        throw error;
    }
};
