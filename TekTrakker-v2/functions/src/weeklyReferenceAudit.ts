import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { generateCommercialReferenceSheetHelper } from './aiAgent';

export const weeklyCommercialReferenceAudit = functions.runWith({ 
    timeoutSeconds: 540, 
    memory: '2GB',
    secrets: ["GEMINI_API_KEY"] 
}).pubsub.schedule('0 0 * * 0') // Runs every Sunday at 00:00 (midnight)
.timeZone('America/New_York')
.onRun(async (context) => {
    const db = admin.firestore();
    functions.logger.info("Starting weekly commercial customer reference audit.");

    try {
        const orgsSnap = await db.collection('organizations').get();
        if (orgsSnap.empty) {
            functions.logger.info("No organizations found to audit.");
            return null;
        }

        for (const orgDoc of orgsSnap.docs) {
            const orgId = orgDoc.id;
            const orgData = orgDoc.data();

            // Only run for organizations that have virtualWorkerEnabled
            if (!orgData.virtualWorkerEnabled) {
                continue;
            }

            try {
                // 1. Fetch commercial customers to compute current hash
                const customersSnap = await db.collection('customers')
                    .where('organizationId', '==', orgId)
                    .where('customerType', '==', 'Commercial')
                    .get();

                if (customersSnap.empty) {
                    functions.logger.info(`Organization ${orgId} has no commercial customers. Skipping.`);
                    continue;
                }

                const commercialCustomers = customersSnap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.name || '',
                        phone: data.phone || '',
                        email: data.email || '',
                        address: data.address || '',
                        city: data.city || '',
                        state: data.state || '',
                        zip: data.zip || '',
                        notes: data.notes || '',
                        serviceLocations: data.serviceLocations || [],
                        equipment: data.equipment || [],
                        updatedAt: data.updatedAt || ''
                    };
                });

                // Fetch related jobs in chunks of 30 customerIds
                const customerIds = commercialCustomers.map(c => c.id);
                const jobs: any[] = [];
                for (let i = 0; i < customerIds.length; i += 30) {
                    const chunk = customerIds.slice(i, i + 30);
                    const jobsSnap = await db.collection('jobs')
                        .where('organizationId', '==', orgId)
                        .where('customerId', 'in', chunk)
                        .get();
                    jobsSnap.forEach(doc => {
                        const data = doc.data();
                        jobs.push({
                            id: doc.id,
                            customerId: data.customerId || '',
                            customerName: data.customerName || '',
                            jobType: data.jobType || '',
                            jobStatus: data.jobStatus || '',
                            scheduledDate: data.scheduledDate || data.appointmentTime || '',
                            totalAmount: data.totalAmount || data.total || 0,
                            updatedAt: data.updatedAt || data.createdAt || ''
                        });
                    });
                }

                // Sort by ID to ensure stable hash
                commercialCustomers.sort((a, b) => a.id.localeCompare(b.id));
                const sortedJobs = jobs.map((j: any) => ({
                    id: j.id,
                    customerId: j.customerId,
                    jobStatus: j.jobStatus,
                    totalAmount: j.totalAmount,
                    updatedAt: j.updatedAt || ''
                })).sort((a: any, b: any) => a.id.localeCompare(b.id));

                const hashPayload = {
                    customers: commercialCustomers.map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        email: c.email || '',
                        phone: c.phone || '',
                        address: c.address,
                        updatedAt: c.updatedAt,
                        locationsCount: (c.serviceLocations || []).length,
                        equipmentCount: (c.equipment || []).length
                    })),
                    jobs: sortedJobs
                };

                const crypto = require('crypto');
                const currentHash = crypto.createHash('md5').update(JSON.stringify(hashPayload)).digest('hex');

                // 2. Fetch the last completed reference sheet report from aiLongTasks
                const lastTaskSnap = await db.collection('organizations')
                    .doc(orgId)
                    .collection('aiLongTasks')
                    .where('prompt', '==', 'Weekly Commercial Customer Reference Sheet')
                    .get();

                const completedTasks = lastTaskSnap.docs
                    .map(d => d.data())
                    .filter(d => d.status === 'Completed')
                    .sort((a, b) => {
                        const aTime = a.completedAt || '';
                        const bTime = b.completedAt || '';
                        return bTime.localeCompare(aTime);
                    });

                let lastHash = "";
                if (completedTasks.length > 0) {
                    lastHash = completedTasks[0].customersHash || "";
                }

                // 3. Compare hash to check for changes
                if (currentHash === lastHash) {
                    functions.logger.info(`Organization ${orgId} commercial customers list is unchanged. Skipping update.`);
                    continue;
                }

                functions.logger.info(`Organization ${orgId} commercial customers list has changed. Generating updated reference sheet.`);
                
                // 4. Generate updated reference sheet
                const result = await generateCommercialReferenceSheetHelper(orgId);
                if (result.success) {
                    functions.logger.info(`Successfully updated reference sheet for organization ${orgId}`);
                } else {
                    functions.logger.error(`Failed to update reference sheet for organization ${orgId}: ${result.message}`);
                }
            } catch (orgErr) {
                functions.logger.error(`Error processing organization ${orgId}:`, orgErr);
            }
        }
    } catch (err) {
        functions.logger.error("Global error in weeklyCommercialReferenceAudit scheduled job:", err);
    }

    return null;
});

export const checkEmployeeCompliance = functions.pubsub.schedule('0 4 * * *')
.timeZone('America/New_York')
.onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    try {
        const usersSnap = await db.collection('users').get();
        
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const role = userData.role || '';
            const orgId = userData.organizationId;
            
            if (!orgId || orgId === 'unauthenticated' || role === 'customer') {
                continue;
            }
            
            // Get org required certifications
            const orgDoc = await db.collection('organizations').doc(orgId).get();
            const orgData = orgDoc.exists ? orgDoc.data() : null;
            const requiredCerts = orgData?.requiredCertifications || [];
            
            if (requiredCerts.length === 0) continue;
            
            const userCerts = userData.certifications || [];
            const userDocs = userData.documents || [];
            
            const missingCerts: string[] = [];
            const expiringCerts: { name: string; expiryDate: string }[] = [];
            
            // Fetch private sensitive details for DL expiry
            const privateDoc = await db.collection('users').doc(userDoc.id).collection('private').doc('sensitive').get();
            const privateData = privateDoc.exists ? privateDoc.data() : null;
            
            for (const req of requiredCerts) {
                const reqLower = req.toLowerCase();
                if (reqLower.includes('epa')) {
                    // EPA Section 608 Certification
                    const hasEpa = userCerts.some((c: any) => c.name?.toLowerCase().includes('epa') || c.name?.toLowerCase().includes('608'))
                        || userDocs.some((d: any) => d.label?.toLowerCase().includes('epa') || d.fileName?.toLowerCase().includes('epa'));
                    if (!hasEpa) {
                        missingCerts.push(req);
                    }
                } else if (reqLower.includes('acr')) {
                    // ACR Technician Certification
                    const hasAcr = userCerts.some((c: any) => c.name?.toLowerCase().includes('acr') || c.name?.toLowerCase().includes('technician'))
                        || userDocs.some((d: any) => d.label?.toLowerCase().includes('acr') || d.fileName?.toLowerCase().includes('acr'));
                    if (!hasAcr) {
                        missingCerts.push(req);
                    }
                } else if (reqLower.includes('dl') || reqLower.includes('license')) {
                    // DL unexpired
                    const hasDl = userDocs.some((d: any) => d.label?.toLowerCase().includes('license') || d.label?.toLowerCase().includes('dl'))
                        || privateData?.driversLicense;
                    if (!hasDl) {
                        missingCerts.push(req);
                    } else if (privateData?.driversLicense?.expiryDate) {
                        const expiry = new Date(privateData.driversLicense.expiryDate);
                        if (expiry < now) {
                            expiringCerts.push({ name: req, expiryDate: privateData.driversLicense.expiryDate });
                        } else if (expiry <= thirtyDaysFromNow) {
                            expiringCerts.push({ name: req, expiryDate: privateData.driversLicense.expiryDate });
                        }
                    }
                } else if (reqLower.includes('adp') || reqLower.includes('onboarding')) {
                    // ADP onboarding / forms
                    const completedOnboarding = privateData?.formSubmissions?.['federal-w4'] || userData.documents?.some((d: any) => d.label?.toLowerCase().includes('w4') || d.label?.toLowerCase().includes('w-4'));
                    if (!completedOnboarding) {
                        missingCerts.push(req);
                    }
                }
            }
            
            // Create alerts/notifications
            // Warn the employee if things are expiring
            if (expiringCerts.length > 0) {
                for (const cert of expiringCerts) {
                    const message = `Your certification "${cert.name}" is expiring or has expired on ${cert.expiryDate}. Please renew and upload your new document.`;
                    
                    // Check if notification already exists to avoid duplication
                    const dupSnap = await db.collection('users').doc(userDoc.id).collection('notifications')
                        .where('title', '==', 'Certification Expiration Warning')
                        .where('message', '==', message)
                        .get();
                        
                    if (dupSnap.empty) {
                        await db.collection('users').doc(userDoc.id).collection('notifications').add({
                            title: 'Certification Expiration Warning',
                            message: message,
                            createdAt: new Date().toISOString(),
                            read: false,
                            type: 'system_alert',
                            link: '/profile'
                        });
                    }
                }
            }
            
            // Warn the employee (and admins) if required docs are missing
            if (missingCerts.length > 0) {
                const message = `You are missing the following required compliance documents/certifications: ${missingCerts.join(', ')}. Please upload them as soon as possible.`;
                
                // Check if notification already exists
                const dupSnap = await db.collection('users').doc(userDoc.id).collection('notifications')
                    .where('title', '==', 'Action Required: Missing Compliance Documents')
                    .where('message', '==', message)
                    .get();
                    
                if (dupSnap.empty) {
                    await db.collection('users').doc(userDoc.id).collection('notifications').add({
                        title: 'Action Required: Missing Compliance Documents',
                        message: message,
                        createdAt: new Date().toISOString(),
                        read: false,
                        type: 'system_alert',
                        link: '/profile'
                    });
                }
                
                // Notify organization admins about the missing documents of this employee
                const adminsSnap = await db.collection('users')
                    .where('organizationId', '==', orgId)
                    .where('role', '==', 'admin')
                    .get();
                for (const adminDoc of adminsSnap.docs) {
                    const adminMsg = `Employee ${userData.firstName || ''} ${userData.lastName || ''} is missing required certifications/documents: ${missingCerts.join(', ')}.`;
                    
                    const adminDupSnap = await db.collection('users').doc(adminDoc.id).collection('notifications')
                        .where('title', '==', 'Staff Compliance Warning')
                        .where('message', '==', adminMsg)
                        .get();
                        
                    if (adminDupSnap.empty) {
                        await db.collection('users').doc(adminDoc.id).collection('notifications').add({
                            title: 'Staff Compliance Warning',
                            message: adminMsg,
                            createdAt: new Date().toISOString(),
                            read: false,
                            type: 'system_alert',
                            link: `/admin/workforce`
                        });
                    }
                }
            }
        }
    } catch (error) {
        functions.logger.error("Error checking employee compliance:", error);
    }
});
