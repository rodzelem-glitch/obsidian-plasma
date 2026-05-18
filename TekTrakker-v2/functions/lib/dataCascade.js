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
exports.cascadeCustomerUpdates = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
exports.cascadeCustomerUpdates = functions.firestore
    .document('customers/{customerId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const customerId = context.params.customerId;
    // Check if relevant fields changed
    const nameChanged = before.name !== after.name;
    const emailChanged = before.email !== after.email;
    const phoneChanged = before.phone !== after.phone;
    const addressChanged = before.address !== after.address;
    if (!nameChanged && !emailChanged && !phoneChanged && !addressChanged) {
        return null; // Nothing to cascade
    }
    functions.logger.info(`Cascading updates for customer ${customerId}`);
    const batch = db.batch();
    let updateCount = 0;
    try {
        // Update Jobs
        const jobsSnap = await db.collection('jobs').where('customerId', '==', customerId).get();
        jobsSnap.forEach(doc => {
            const job = doc.data();
            const updates = {};
            if (nameChanged)
                updates.customerName = after.name;
            if (addressChanged && job.address === before.address)
                updates.address = after.address;
            // Update embedded invoice if present
            if (job.invoice) {
                const invoiceUpdates = {};
                if (nameChanged)
                    invoiceUpdates['invoice.customerName'] = after.name;
                if (emailChanged)
                    invoiceUpdates['invoice.customerEmail'] = after.email;
                if (Object.keys(invoiceUpdates).length > 0) {
                    Object.assign(updates, invoiceUpdates);
                }
            }
            if (Object.keys(updates).length > 0) {
                batch.update(doc.ref, updates);
                updateCount++;
            }
        });
        // Update standalone proposals/estimates if they exist in a root collection
        // Assuming collection 'proposals' exists
        try {
            const proposalsSnap = await db.collection('proposals').where('customerId', '==', customerId).get();
            proposalsSnap.forEach(doc => {
                const updates = {};
                if (nameChanged)
                    updates.customerName = after.name;
                if (emailChanged)
                    updates.customerEmail = after.email;
                if (Object.keys(updates).length > 0) {
                    batch.update(doc.ref, updates);
                    updateCount++;
                }
            });
        }
        catch (e) {
            // Ignore if proposals collection doesn't exist
        }
        // Commit batch
        if (updateCount > 0) {
            // Firebase batch limit is 500, but typically a customer won't have 500 jobs
            // If they do, this will fail. We'd need chunking for robust production.
            // For now, doing a single batch.
            if (updateCount <= 500) {
                await batch.commit();
                functions.logger.info(`Successfully cascaded customer updates to ${updateCount} documents.`);
            }
            else {
                functions.logger.warn(`Too many documents to update (${updateCount}). Not chunked yet.`);
            }
        }
    }
    catch (error) {
        functions.logger.error("Error cascading customer updates:", error);
    }
    return null;
});
//# sourceMappingURL=dataCascade.js.map