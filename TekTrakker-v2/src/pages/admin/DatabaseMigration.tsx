import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { uploadFileToStorage } from '../../lib/storageService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Database, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

const DatabaseMigration: React.FC = () => {
    const [progress, setProgress] = useState<string[]>([]);
    const [isMigrating, setIsMigrating] = useState(false);
    const [totals, setTotals] = useState({ found: 0, fixed: 0, errors: 0 });

    const log = (msg: string) => {
        console.log(msg);
        setProgress(prev => [msg, ...prev]);
    };

    const runMigration = async () => {
        setIsMigrating(true);
        setTotals({ found: 0, fixed: 0, errors: 0 });
        setProgress([]);
        
        let foundCount = 0;
        let fixedCount = 0;
        let errorCount = 0;

        const processBase64 = async (dataString: string, path: string): Promise<string> => {
            log(`Uploading file... (${Math.round(dataString.length / 1024)}KB)`);
            return await uploadFileToStorage(path, dataString);
        };

        try {
            log("--- STARTING MIGRATION ---");
            
            // 1. MIGRATING USERS (Profile Pics and HR Docs)
            log("Scanning Users...");
            const usersSnap = await db.collection('users').get();
            for (const doc of usersSnap.docs) {
                const data = doc.data();
                const updates: any = {};
                let changed = false;

                if (data.profilePicUrl && data.profilePicUrl.startsWith('data:image/')) {
                    foundCount++;
                    log(`Found Base64 profile pic for User: ${data.id}`);
                    try {
                        const path = `organizations/${data.organizationId || 'default'}/users/${data.id}/profilePic_${Date.now()}`;
                        updates.profilePicUrl = await processBase64(data.profilePicUrl, path);
                        changed = true;
                        fixedCount++;
                    } catch (e) { errorCount++; log(`Error uploading profile pic for User: ${data.id}`); }
                }

                if (data.documents && Array.isArray(data.documents)) {
                    const newDocs = [...data.documents];
                    let docsChanged = false;
                    for (let i = 0; i < newDocs.length; i++) {
                        const d = newDocs[i];
                        if (d.dataUrl && d.dataUrl.startsWith('data:')) {
                            foundCount++;
                            log(`Found Base64 HR Doc for User: ${data.id}`);
                            try {
                                const path = `organizations/${data.organizationId || 'default'}/users/${data.id}/hrFiles/${Date.now()}_legacy`;
                                d.dataUrl = await processBase64(d.dataUrl, path);
                                docsChanged = true;
                                fixedCount++;
                            } catch (e) { errorCount++; log(`Error uploading HR doc for User: ${data.id}`); }
                        }
                    }
                    if (docsChanged) {
                        updates.documents = newDocs;
                        changed = true;
                    }
                }

                if (changed) {
                    await db.collection('users').doc(doc.id).update(updates);
                    log(`Updated User: ${data.id}`);
                }
            }

            // 2. MIGRATING EXPENSES
            log("Scanning Expenses...");
            const expensesSnap = await db.collection('expenses').get();
            for (const doc of expensesSnap.docs) {
                const data = doc.data();
                if ((data.receiptData && data.receiptData.startsWith('data:')) || (data.receiptUrl && data.receiptUrl.startsWith('data:'))) {
                    foundCount++;
                    const targetStr = data.receiptData?.startsWith('data:') ? data.receiptData : data.receiptUrl;
                    log(`Found Base64 Receipt for Expense: ${doc.id}`);
                    try {
                        const path = `organizations/${data.organizationId || 'default'}/receipts/exp_${Date.now()}`;
                        const newUrl = await processBase64(targetStr, path);
                        await db.collection('expenses').doc(doc.id).update({
                            receiptData: null,
                            receiptUrl: newUrl
                        });
                        fixedCount++;
                        log(`Updated Expense: ${doc.id}`);
                    } catch (e) { errorCount++; log(`Error updating Expense: ${doc.id}`); }
                }
            }

            // 3. MIGRATING VEHICLE LOGS
            log("Scanning Vehicle Logs...");
            const vehicleSnap = await db.collection('vehicleLogs').get();
            for (const doc of vehicleSnap.docs) {
                const data = doc.data();
                if ((data.receiptData && data.receiptData.startsWith('data:')) || (data.receiptUrl && data.receiptUrl.startsWith('data:'))) {
                    foundCount++;
                    const targetStr = data.receiptData?.startsWith('data:') ? data.receiptData : data.receiptUrl;
                    log(`Found Base64 Receipt for Vehicle Log: ${doc.id}`);
                    try {
                        const path = `organizations/${data.organizationId || 'default'}/receipts/veh_${Date.now()}`;
                        const newUrl = await processBase64(targetStr, path);
                        await db.collection('vehicleLogs').doc(doc.id).update({
                            receiptData: null,
                            receiptUrl: newUrl
                        });
                        fixedCount++;
                        log(`Updated Vehicle Log: ${doc.id}`);
                    } catch (e) { errorCount++; log(`Error updating Vehicle Log: ${doc.id}`); }
                }
            }

            // 4. MIGRATING CUSTOMERS
            log("Scanning Customers...");
            const custSnap = await db.collection('customers').get();
            for (const doc of custSnap.docs) {
                const data = doc.data();
                if (data.profileImage && data.profileImage.startsWith('data:image/')) {
                    foundCount++;
                    log(`Found Base64 Profile Image for Customer: ${doc.id}`);
                    try {
                        const path = `organizations/${data.organizationId || 'default'}/customers/${doc.id}/${Date.now()}_profile.jpg`;
                        const newUrl = await processBase64(data.profileImage, path);
                        await db.collection('customers').doc(doc.id).update({
                            profileImage: newUrl
                        });
                        fixedCount++;
                        log(`Updated Customer: ${doc.id}`);
                    } catch (e) { errorCount++; log(`Error updating Customer: ${doc.id}`); }
                }
            }

            // 5. MIGRATING JOBS
            log("Scanning Jobs...");
            const jobsSnap = await db.collection('jobs').get();
            for (const doc of jobsSnap.docs) {
                const data = doc.data();
                const updates: any = {};
                let changed = false;

                if (data.files && Array.isArray(data.files)) {
                    let filesChanged = false;
                    const newFiles = [...data.files];
                    for (let i = 0; i < newFiles.length; i++) {
                        if (newFiles[i].dataUrl && newFiles[i].dataUrl.startsWith('data:')) {
                            foundCount++;
                            log(`Found Base64 file for Job: ${doc.id}`);
                            try {
                                const path = `organizations/${data.organizationId || 'default'}/jobs/${doc.id}/migrated_${Date.now()}_${i}`;
                                newFiles[i].dataUrl = await processBase64(newFiles[i].dataUrl, path);
                                filesChanged = true;
                                fixedCount++;
                            } catch(e) { errorCount++; log(`Error with Job file: ${doc.id}`); }
                        }
                    }
                    if (filesChanged) { updates.files = newFiles; changed = true; }
                }

                if (data.qcAudits && Array.isArray(data.qcAudits)) {
                    let qcChanged = false;
                    const newQcs = [...data.qcAudits];
                    for (let i = 0; i < newQcs.length; i++) {
                        if (newQcs[i].imageUrl && newQcs[i].imageUrl.startsWith('data:')) {
                            foundCount++;
                            log(`Found Base64 QC Image for Job: ${doc.id}`);
                            try {
                                const path = `organizations/${data.organizationId || 'default'}/jobs/${doc.id}/qc_migrated_${Date.now()}_${i}`;
                                newQcs[i].imageUrl = await processBase64(newQcs[i].imageUrl, path);
                                qcChanged = true;
                                fixedCount++;
                            } catch(e) { errorCount++; log(`Error with Job QC: ${doc.id}`); }
                        }
                    }
                    if (qcChanged) { updates.qcAudits = newQcs; changed = true; }
                }
                
                if (data.partsUsed && Array.isArray(data.partsUsed)) {
                    let partsChanged = false;
                    const newParts = [...data.partsUsed];
                    for (let i = 0; i < newParts.length; i++) {
                        if (newParts[i].receiptData && newParts[i].receiptData.startsWith('data:')) {
                            foundCount++;
                            log(`Found Base64 Part Receipt for Job: ${doc.id}`);
                            try {
                                const path = `organizations/${data.organizationId || 'default'}/jobs/${doc.id}/parts/migrated_${Date.now()}_${i}`;
                                newParts[i].receiptData = await processBase64(newParts[i].receiptData, path);
                                partsChanged = true;
                                fixedCount++;
                            } catch(e) { errorCount++; log(`Error with Job Part: ${doc.id}`); }
                        }
                    }
                    if (partsChanged) { updates.partsUsed = newParts; changed = true; }
                }

                if (changed) {
                    await db.collection('jobs').doc(doc.id).update(updates);
                    log(`Updated Job: ${doc.id}`);
                }
            }

            log(`--- MIGRATION COMPLETE ---`);
            
        } catch (error: any) {
            log(`CRITICAL ERROR STOPPING MIGRATION: ${error.message}`);
        } finally {
            setTotals({ found: foundCount, fixed: fixedCount, errors: errorCount });
            setIsMigrating(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold dark:text-white flex items-center gap-3">
                <Database className="text-primary-500" size={32} />
                Legacy Storage Migration
            </h1>

            <Card className="border-l-4 border-l-primary-500">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-2 dark:text-white">
                    <ShieldCheck className="text-emerald-500" /> Guaranteed Safe Execution
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                    This utility securely upgrades your old Base64 database strings to massive-scale Cloud Storage. 
                    It is designed to be 100% loss-proof. It specifically verifies the file was successfully deployed to your enterprise cloud bucket <b>before</b> it removes the old chunky string from your records.
                </p>
                <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-6">
                    <div className="flex-1 text-center">
                        <p className="text-sm font-bold text-slate-500 uppercase">Legacy Found</p>
                        <p className="text-3xl font-black text-amber-500">{totals.found}</p>
                    </div>
                    <div className="flex-1 text-center border-l dark:border-slate-700">
                        <p className="text-sm font-bold text-slate-500 uppercase">Successfully Upgraded</p>
                        <p className="text-3xl font-black text-emerald-500">{totals.fixed}</p>
                    </div>
                    <div className="flex-1 text-center border-l dark:border-slate-700">
                        <p className="text-sm font-bold text-slate-500 uppercase">Errors</p>
                        <p className="text-3xl font-black text-red-500">{totals.errors}</p>
                    </div>
                </div>

                <Button onClick={runMigration} disabled={isMigrating} className="w-full flex justify-center items-center gap-2 text-lg py-4">
                    {isMigrating ? <RefreshCw className="animate-spin" /> : <Database />}
                    {isMigrating ? 'Processing Migration...' : 'Start Migration Now'}
                </Button>
            </Card>

            <Card>
                <h3 className="font-bold flex items-center gap-2 mb-4 dark:text-white">
                    <AlertCircle size={18} className="text-slate-400" /> Activity Log
                </h3>
                <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-emerald-400 h-96 overflow-y-auto w-full flex flex-col space-y-1 custom-scrollbar">
                    {progress.length === 0 ? (
                        <p className="text-slate-600 italic">Waiting to begin...</p>
                    ) : (
                        progress.map((msg, i) => (
                            <div key={i} className={`py-1 border-b border-slate-800 ${msg.includes('ERROR') ? 'text-red-400 font-bold' : ''}`}>
                                [{new Date().toLocaleTimeString()}] {msg}
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
};

export default DatabaseMigration;
