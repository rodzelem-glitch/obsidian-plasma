const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'tektrakker'
    });
}

const db = admin.firestore();

db.collection('organizations').doc('nWYBg3LkmkkQEW7kjstB').update({
    kortAccountId: null,
    tilledUserId: null
}).then(() => {
    console.log('Successfully wiped stale sandbox Tilled credentials for TektestSub!');
}).catch(err => {
    console.error('Failed to wipe credentials:', err);
});
