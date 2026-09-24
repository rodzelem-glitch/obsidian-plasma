import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

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
