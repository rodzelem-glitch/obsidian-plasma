const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
async function check() {
    const subs = await db.collection('office365_subscriptions').get();
    console.log('Subscriptions:');
    subs.forEach(doc => console.log(doc.id, doc.data()));
}
check().catch(console.error);
