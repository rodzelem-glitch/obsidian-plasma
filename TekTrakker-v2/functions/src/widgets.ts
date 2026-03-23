
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import cors from "cors";
import { v4 as uuidv4 } from 'uuid';
import type { Organization } from './types';

const corsHandler = cors({ origin: true });

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

export const submitWidgetForm = functions.https.onRequest((req, res) => {
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
      const uploadFile = async (dataUrl: string, folder: string, originalName: string) => {
        try {
          if (!dataUrl || !dataUrl.startsWith('data:')) return null;
          const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (!matches || matches.length !== 3) return null;
          
          const contentType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = `${folder}/${uuidv4()}_${originalName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const file = bucket.file(filename);

          await file.save(buffer, { metadata: { contentType } });
          const [url] = await file.getSignedUrl({ action: 'read', expires: '03-01-2500' });
          return url;
        } catch (e) {
          console.error("File upload to storage failed:", e);
          return null;
        }
      };

      if (rawData.resumeDataUrl) {
        const url = await uploadFile(rawData.resumeDataUrl, `resumes/${orgId}`, rawData.resumeFileName || 'resume.pdf');
        if (url) rawData.resumeUrl = url;
        delete rawData.resumeDataUrl;
        delete rawData.resumeFileName;
      }

      if (rawData.photoDataUrl) {
        const url = await uploadFile(rawData.photoDataUrl, `photos/${orgId}`, rawData.photoFileName || 'photo.jpg');
        if (url) rawData.photoUrl = url;
        delete rawData.photoDataUrl;
        delete rawData.photoFileName;
      }

      const timestamp = new Date().toISOString();
      let collectionPath = '';
      let finalData: any = { ...rawData, organizationId: orgId, createdAt: timestamp };
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

      } else if (formType === 'applicant') {
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

      } else if (formType === 'booking_request') {
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

      } else if (formType === 'marketplace_contact') {
        const orgDoc = await db.collection('organizations').doc(orgId).get();
        if (orgDoc.exists) {
            const orgData = orgDoc.data() as Organization;
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

      } else {
        res.status(400).send('Invalid form type');
        return;
      }

      // Save the document to Firestore
      const docRef = await db.collection(collectionPath).add(finalData);
      
      // Send email notification for persistent documents
      const orgDoc = await db.collection('organizations').doc(orgId).get();
      if (orgDoc.exists) {
          const orgData = orgDoc.data() as Organization;
          if (orgData.notificationEmails && orgData.notificationEmails.length > 0) {
              await db.collection('mail').add({
                  to: orgData.notificationEmails,
                  message: { subject: `[TekTrakker] ${notificationTitle}`, text: notificationText }
              });
          }
      }

      res.status(200).send({ success: true, id: docRef.id });

    } catch (error: any) {
      console.error('CRITICAL: Unhandled Error in submitWidgetForm:', error);
      res.status(500).send(`Internal Server Error: ${error.message}`);
    }
  });
});
