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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserRegistration = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const applyReferralDiscount = async (referringOrgId, newOrgId) => {
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
    }
    catch (error) {
        console.error("Error applying referral discount:", error);
        throw new functions.https.HttpsError("internal", "Failed to apply referral discounts.");
    }
};
exports.onUserRegistration = functions.firestore.document('users/{userId}').onCreate(async (snap, context) => {
    const userData = snap.data();
    const email = userData?.email;
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
    }
    catch (error) {
        console.error(`Error processing referral for email ${email}:`, error);
        return null;
    }
});
//# sourceMappingURL=promotions.js.map