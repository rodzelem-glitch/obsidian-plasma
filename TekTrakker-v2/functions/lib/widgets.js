"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitWidgetForm = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const uuid_1 = require("uuid");
const corsHandler = (0, cors_1.default)({ origin: true });
const db = admin.firestore();
const storage = admin.storage();
exports.submitWidgetForm = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        try {
            const rawData = req.body;
            const { organizationId } = rawData;
            // Correctly handle both new and legacy form type fields for backward compatibility
            const formType = rawData.formType || rawData.type;
            if (!formType || !organizationId) {
                console.error("Missing formType/type or organizationId. Data:", rawData);
                res.status(400).send('Missing form type or organizationId');
                return;
            }
            const orgId = organizationId.trim();
            // File upload logic (remains the same)
            const bucket = storage.bucket();
            const uploadFile = async (dataUrl, folder, originalName) => {
                try {
                    if (!dataUrl || !dataUrl.startsWith('data:'))
                        return null;
                    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                    if (!matches || matches.length !== 3)
                        return null;
                    const contentType = matches[1];
                    const buffer = Buffer.from(matches[2], 'base64');
                    const filename = `${folder}/${(0, uuid_1.v4)()}_${originalName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                    const file = bucket.file(filename);
                    await file.save(buffer, { metadata: { contentType } });
                    const [url] = await file.getSignedUrl({ action: 'read', expires: '03-01-2500' });
                    return url;
                }
                catch (e) {
                    console.error("File upload to storage failed:", e);
                    return null;
                }
            };
            if (rawData.resumeDataUrl) {
                const url = await uploadFile(rawData.resumeDataUrl, `resumes/${orgId}`, rawData.resumeFileName || 'resume.pdf');
                if (url)
                    rawData.resumeUrl = url;
                delete rawData.resumeDataUrl;
                delete rawData.resumeFileName;
            }
            if (rawData.photoDataUrl) {
                const url = await uploadFile(rawData.photoDataUrl, `photos/${orgId}`, rawData.photoFileName || 'photo.jpg');
                if (url)
                    rawData.photoUrl = url;
                delete rawData.photoDataUrl;
                delete rawData.photoFileName;
            }
            const timestamp = new Date().toISOString();
            let collectionPath = '';
            let finalData = { ...rawData, organizationId: orgId, createdAt: timestamp };
            let notificationTitle = '';
            let notificationText = '';
            if (formType === 'booking') {
                collectionPath = 'appointments';
                finalData = {
                    ...finalData,
                    customerName: rawData.name,
                    customerPhone: rawData.phone,
                    customerEmail: rawData.email || '',
                    address: rawData.address,
                    tasks: [rawData.serviceCategory, rawData.jobType].filter(Boolean),
                    appointmentTime: rawData.date ? `${rawData.date} ${rawData.arrivalWindow || ''}`.trim() : 'TBD',
                    status: 'Pending',
                    specialInstructions: `System Age: ${rawData.systemAge || 'N/A'}, Brand: ${rawData.systemBrand || 'N/A'}.`,
                    source: 'Widget'
                };
                notificationTitle = 'New Booking Request (Widget)';
                notificationText = `You have a new service request from ${finalData.customerName} for ${finalData.address}. Log in to your dashboard to view and approve it.`;
            }
            else if (formType === 'applicant') {
                collectionPath = 'applicants';
                const nameParts = (rawData.name || '').trim().split(' ');
                finalData = {
                    ...finalData,
                    firstName: nameParts[0] || '',
                    lastName: nameParts.slice(1).join(' ') || '',
                    position: rawData.position || 'Technician',
                    experienceYears: rawData.experienceLevel || 0,
                    status: 'New',
                    appliedDate: timestamp,
                    source: 'Widget'
                };
                notificationTitle = 'New Job Applicant (Widget)';
                notificationText = `${finalData.firstName} ${finalData.lastName} has applied for the ${finalData.position} position. Log in to your dashboard to review.`;
            }
            else if (formType === 'booking_request') {
                collectionPath = 'appointments';
                finalData = {
                    ...finalData,
                    customerName: rawData.name,
                    customerPhone: rawData.phone,
                    customerEmail: rawData.email,
                    address: 'On-site service requested',
                    tasks: ['Follow-up required'],
                    appointmentTime: rawData.preferredDate ? `${rawData.preferredDate} ${rawData.preferredTime || ''}`.trim() : 'TBD',
                    status: 'Pending',
                    specialInstructions: rawData.message,
                    source: 'Marketplace'
                };
                notificationTitle = 'New Booking Request (Marketplace)';
                notificationText = `You have a new service request from ${finalData.customerName}. Log in to your dashboard to view and approve it.`;
            }
            else if (formType === 'marketplace_contact') {
                const orgDoc = await db.collection('organizations').doc(orgId).get();
                if (orgDoc.exists) {
                    const orgData = orgDoc.data();
                    if (orgData.notificationEmails && orgData.notificationEmails.length > 0) {
                        await db.collection('mail').add({
                            to: orgData.notificationEmails,
                            message: {
                                subject: `[TekTrakker] Marketplace Inquiry from ${rawData.name}`,
                                text: `You have a new message from the TekTrakker marketplace:\n\nName: ${rawData.name}\nEmail: ${rawData.email}\nPhone: ${rawData.phone || 'Not provided'}\n\nMessage:\n${rawData.message}`
                            }
                        });
                        res.status(200).send({ success: true, message: "Message sent." });
                        return; // Exit here as no document is saved
                    }
                }
                res.status(404).send({ success: false, message: "Organization not found or has no notification emails." });
                return;
            }
            else {
                res.status(400).send('Invalid form type');
                return;
            }
            // Save the document to Firestore
            const docRef = await db.collection(collectionPath).add(finalData);
            // Send email notification for persistent documents
            const orgDoc = await db.collection('organizations').doc(orgId).get();
            if (orgDoc.exists) {
                const orgData = orgDoc.data();
                if (orgData.notificationEmails && orgData.notificationEmails.length > 0) {
                    await db.collection('mail').add({
                        to: orgData.notificationEmails,
                        message: { subject: `[TekTrakker] ${notificationTitle}`, text: notificationText }
                    });
                }
            }
            res.status(200).send({ success: true, id: docRef.id });
        }
        catch (error) {
            console.error('CRITICAL: Unhandled Error in submitWidgetForm:', error);
            res.status(500).send(`Internal Server Error: ${error.message}`);
        }
    });
});
//# sourceMappingURL=widgets.js.map