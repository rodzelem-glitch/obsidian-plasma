import { storage, db } from './firebase';
import { showToast } from './toast';

export interface PendingUploadItem {
    id: string; // File ID in the parent collection/document
    jobId?: string; // For backwards compatibility
    parentCollection?: string; // 'jobs' | 'projects' | 'assets' | 'equipment' | 'expenses' (default: 'jobs')
    parentId?: string; // Target document ID (defaults to jobId)
    orgId: string;
    storagePath: string;
    dataUrl: string; // Base64 data string
    fileName: string;
    fileType: string;
    timestamp: number;
    retryCount: number;
    updateField?: string; // e.g. 'files' (default), 'photos', 'receiptUrl', 'imageUrl'
    expenseId?: string; // Optional linked expense document ID to sync receiptUrl
}

const QUEUE_STORAGE_KEY = 'tektrakker_offline_pending_uploads_v1';
const MAX_RETRIES = 5;

class OfflineSyncManager {
    private isSyncing = false;
    private listeners: Array<(count: number) => void> = [];

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                console.log('[OfflineSyncManager] Device came online. Triggering pending uploads synchronization...');
                this.syncPendingUploads();
            });

            // Initial check on startup/import after slight delay to allow auth & socket to establish
            setTimeout(() => {
                if (typeof navigator !== 'undefined' && navigator.onLine) {
                    this.syncPendingUploads();
                }
            }, 4000);
        }
    }

    /**
     * Retrieves all pending upload items currently stored in local persistence.
     */
    public getPendingUploads(): PendingUploadItem[] {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.warn('[OfflineSyncManager] Could not parse pending uploads from storage:', e);
            return [];
        }
    }

    /**
     * Returns total count of pending offline uploads.
     */
    public getPendingCount(): number {
        return this.getPendingUploads().length;
    }

    /**
     * Subscribes a listener to queue size changes (e.g. for badge UI).
     */
    public subscribe(callback: (count: number) => void): () => void {
        this.listeners.push(callback);
        callback(this.getPendingCount());
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners(): void {
        const count = this.getPendingCount();
        this.listeners.forEach(fn => {
            try { fn(count); } catch (err) { console.warn(err); }
        });
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tektrakker:pending_uploads_changed', { detail: { count } }));
        }
    }

    /**
     * Registers a file that could not be uploaded immediately due to lack of network connectivity.
     */
    public async registerPendingUpload(item: Omit<PendingUploadItem, 'retryCount'>): Promise<void> {
        if (typeof window === 'undefined') return;

        const currentQueue = this.getPendingUploads();
        // Prevent duplicate registration
        const existingIdx = currentQueue.findIndex(q => q.id === item.id);
        const fullItem: PendingUploadItem = {
            ...item,
            retryCount: existingIdx >= 0 ? currentQueue[existingIdx].retryCount : 0
        };

        if (existingIdx >= 0) {
            currentQueue[existingIdx] = fullItem;
        } else {
            currentQueue.push(fullItem);
        }

        try {
            localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(currentQueue));
            this.notifyListeners();
            console.log(`[OfflineSyncManager] Enqueued offline upload "${item.fileName}" for Job ${item.jobId}. Total pending: ${currentQueue.length}`);
        } catch (e) {
            console.error('[OfflineSyncManager] Failed to persist offline queue item:', e);
        }

        // If online right now, attempt immediate sync
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            this.syncPendingUploads();
        }
    }

    /**
     * Iterates through pending offline uploads, uploads binary to Firebase Storage,
     * updates Firestore document with permanent URL, and purges the queue item.
     */
    public async syncPendingUploads(): Promise<void> {
        if (this.isSyncing) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            console.log('[OfflineSyncManager] Sync deferred: device is offline.');
            return;
        }

        const queue = this.getPendingUploads();
        if (queue.length === 0) return;

        this.isSyncing = true;
        console.log(`[OfflineSyncManager] Starting sync of ${queue.length} pending offline uploads...`);

        let successCount = 0;
        const remainingQueue: PendingUploadItem[] = [];

        for (const item of queue) {
            try {
                const storageRef = storage.ref().child(item.storagePath);
                
                // Upload Base64 Data URL to Firebase Storage
                let snapshot;
                if (item.dataUrl.startsWith('data:')) {
                    snapshot = await storageRef.putString(item.dataUrl, 'data_url');
                } else {
                    snapshot = await storageRef.putString(item.dataUrl);
                }

                const downloadUrl = await snapshot.ref.getDownloadURL();
                console.log(`[OfflineSyncManager] Uploaded "${item.fileName}" to Storage. Public URL: ${downloadUrl}`);

                // Reconcile parent document in Firestore
                const targetCollection = item.parentCollection || 'jobs';
                const targetDocId = item.parentId || item.jobId;

                if (targetDocId) {
                    try {
                        const targetRef = db.collection(targetCollection).doc(targetDocId);
                        const targetDoc = await targetRef.get();
                        if (targetDoc.exists) {
                            const docData = targetDoc.data() || {};
                            const fieldName = item.updateField || (Array.isArray(docData.photos) && !Array.isArray(docData.files) ? 'photos' : 'files');

                            if (fieldName === 'receiptUrl' || fieldName === 'imageUrl') {
                                await targetRef.update({
                                    [fieldName]: downloadUrl,
                                    updatedAt: new Date().toISOString()
                                });
                                console.log(`[OfflineSyncManager] Updated ${fieldName} on ${targetCollection}/${targetDocId}`);
                            } else {
                                const list = Array.isArray(docData[fieldName]) ? [...docData[fieldName]] : [];
                                let updated = false;
                                const updatedList = list.map((f: any) => {
                                    if (f.id === item.id || f.dataUrl === item.dataUrl || f.url === item.dataUrl) {
                                        updated = true;
                                        return {
                                            ...f,
                                            url: downloadUrl,
                                            dataUrl: downloadUrl,
                                            pendingUpload: false,
                                            metadata: {
                                                ...(f.metadata || {}),
                                                pendingUpload: false,
                                                syncedAt: new Date().toISOString()
                                            }
                                        };
                                    }
                                    return f;
                                });

                                if (updated) {
                                    await targetRef.update({
                                        [fieldName]: updatedList,
                                        updatedAt: new Date().toISOString()
                                    });
                                    console.log(`[OfflineSyncManager] Successfully reconciled file ${item.id} in ${targetCollection}/${targetDocId}`);
                                }
                            }
                        }
                    } catch (recErr) {
                        console.warn(`[OfflineSyncManager] Could not update parent document ${targetCollection}/${targetDocId}:`, recErr);
                    }
                }

                // If an associated expense record was registered, reconcile receiptUrl as well
                if (item.expenseId) {
                    try {
                        await db.collection('expenses').doc(item.expenseId).update({
                            receiptUrl: downloadUrl,
                            updatedAt: new Date().toISOString()
                        });
                        console.log(`[OfflineSyncManager] Successfully updated expense ${item.expenseId} receiptUrl to permanent cloud storage.`);
                    } catch (expErr) {
                        console.warn(`[OfflineSyncManager] Could not update expense ${item.expenseId}:`, expErr);
                    }
                }

                successCount++;
            } catch (err: any) {
                console.error(`[OfflineSyncManager] Failed to sync item ${item.id}:`, err);
                const updatedRetry = (item.retryCount || 0) + 1;
                if (updatedRetry < MAX_RETRIES) {
                    remainingQueue.push({ ...item, retryCount: updatedRetry });
                } else {
                    console.warn(`[OfflineSyncManager] Dropping item ${item.id} after ${MAX_RETRIES} failed attempts.`);
                }
            }
        }

        try {
            localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remainingQueue));
            this.notifyListeners();
        } catch (e) {
            console.error('[OfflineSyncManager] Failed to update localStorage queue post-sync:', e);
        }

        this.isSyncing = false;

        if (successCount > 0) {
            showToast.success(`Synced ${successCount} offline photo${successCount > 1 ? 's' : ''} to cloud!`);
        }
    }
}

export const offlineSyncManager = new OfflineSyncManager();
export default offlineSyncManager;
