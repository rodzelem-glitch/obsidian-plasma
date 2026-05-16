const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
async function check() {
    const users = await db.collection('users').where('role', '==', 'master_admin').get();
    console.log('Master Admins:');
    users.forEach(doc => console.log(doc.id, doc.data().email, doc.data().role));
}
check().catch(console.error);
