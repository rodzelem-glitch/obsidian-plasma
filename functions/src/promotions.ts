
import * as functionsV1 from "firebase-functions/v1";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

const applyReferralDiscount = async (referringOrgId: string, newOrgId: string): Promise<void> => {
    const now = new Date();
    const expiryDate = new Date(now.setMonth(now.getMonth() + 3));

    const discountData = {
        customDiscountPct: 10,
        discountExpiryDate: expiryDate.toISOString(),
    };

    try {
        const referringOrgRef = db.collection("organizations").doc(referringOrgId);
        const newOrgRef = db.collection("organizations").doc(newOrgId);

        await db.runTransaction(async (transaction) => {
            transaction.update(referringOrgRef, discountData);
            transaction.update(newOrgRef, discountData);
        });

        console.log(`Successfully applied referral discount to ${referringOrgId} and ${newOrgId}`);
    } catch (error) {
        console.error("Error applying referral discount:", error);
        throw new functions.https.HttpsError("internal", "Failed to apply referral discounts.");
    }
};

export const onusercreate = functionsV1.auth.user().onCreate(async (user: any) => {
    const { email } = user;

    if (!email) {
        console.log("User does not have an email address. Skipping referral check.");
        return null;
    }

    const orgsRef = db.collection("organizations");
    const query = orgsRef.where("pendingReferralEmail", "==", email).limit(1);

    try {
        const snapshot = await query.get();

        if (snapshot.empty) {
            console.log(`No pending referral found for email: ${email}`);
            return null;
        }

        const newOrg = snapshot.docs[0];
        const newOrgId = newOrg.id;
        const referringOrgId = newOrg.data().referredBy;

        if (!referringOrgId) {
            console.log(`Organization ${newOrgId} is missing the referredBy field.`);
            return null;
        }

        console.log(`Processing referral for new organization ${newOrgId} referred by ${referringOrgId}`);

        await applyReferralDiscount(referringOrgId, newOrgId);

        await newOrg.ref.update({
            pendingReferralEmail: admin.firestore.FieldValue.delete(),
            referredBy: admin.firestore.FieldValue.delete(),
        });
        return null;

    } catch (error) {
        console.error(`Error processing referral for email ${email}:`, error);
        return null;
    }
});
