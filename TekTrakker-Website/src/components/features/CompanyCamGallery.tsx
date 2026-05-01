import React, { useState, useEffect } from 'react';
import { db, functions } from '../../lib/firebase';
import { Camera, RefreshCw, ExternalLink } from 'lucide-react';
import Button from '../ui/Button';
import showToast from '../../lib/toast';

interface CompanyCamGalleryProps {
    jobId: string;
    orgId: string;
    address: string;
}

const CompanyCamGallery: React.FC<CompanyCamGalleryProps> = ({ jobId, orgId, address }) => {
    const [photos, setPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [integrationActive, setIntegrationActive] = useState(false);

    useEffect(() => {
        const checkIntegration = async () => {
            const snap = await db.doc(`organizations/${orgId}/settings/marketplace_integrations`).get();
            const integrations = snap.data()?.integrations || {};
            setIntegrationActive(!!integrations.companycam?.enabled);
        };
        checkIntegration();

        // Listen for synced photos in job subcollection
        const unsubscribe = db.collection(`organizations/${orgId}/jobs/${jobId}/companycam_photos`)
            .onSnapshot(snap => {
                setPhotos(snap.docs.map(doc => doc.data()));
            });

        return () => unsubscribe();
    }, [jobId, orgId]);

    const handleSync = async () => {
        setLoading(true);
        try {
            const syncFunc = functions.httpsCallable('syncCompanyCamPhotos');
            const result = await syncFunc({ orgId, jobId, projectAddress: address });
            const fetchedPhotos = (result.data as any).photos || [];
            
            if (fetchedPhotos.length === 0) {
                showToast.info('No matching CompanyCam project found for this address.');
            } else {
                // Save to subcollection for persistence in the UI
                const batch = db.batch();
                fetchedPhotos.forEach((photo: any) => {
                    const ref = db.collection(`organizations/${orgId}/jobs/${jobId}/companycam_photos`).doc(photo.id.toString());
                    batch.set(ref, {
                        ...photo,
                        syncedAt: new Date().toISOString()
                    });
                });
                await batch.commit();
                showToast.success(`Synced ${fetchedPhotos.length} photos from CompanyCam!`);
            }
        } catch (error) {
            console.error(error);
            showToast.error('Failed to sync with CompanyCam');
        } finally {
            setLoading(false);
        }
    };

    if (!integrationActive) return null;

    return (
        <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h4 className="text-[10px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-2">
                        <Camera size={14}/> CompanyCam Integration
                    </h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">Automated Project Photo Sync</p>
                </div>
                <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleSync} 
                    disabled={loading}
                    className="h-8 text-[10px] uppercase font-black tracking-widest flex items-center gap-2"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    {loading ? 'Syncing...' : 'Sync Now'}
                </Button>
            </div>

            {photos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {photos.map((photo, i) => (
                        <div key={i} className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm">
                            <img src={photo.url} alt="CompanyCam" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <a href={photo.url} target="_blank" rel="noreferrer" aria-label="View photo in new tab" title="View photo" className="p-2 bg-white rounded-full text-slate-900 hover:bg-primary-500 hover:text-white transition-colors">
                                    <ExternalLink size={14} />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                    <Camera size={32} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No photos synced yet</p>
                    <p className="text-[10px] text-slate-300 mt-1">Click sync to fetch photos from CompanyCam projects matching this address.</p>
                </div>
            )}
        </section>
    );
};

export default CompanyCamGallery;
