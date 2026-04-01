const fs = require('fs');
const { execSync } = require('child_process');

const d = require('./users.json');
const testUsers = d.users.filter(u => u.email && u.email.endsWith('@example.com'));

let uids = testUsers.map(u => u.localId);

console.log(`Found ${uids.length} test users to delete.`);

for (const uid of uids) {
    try {
        console.log(`Deleting Auth user: ${uid}`);
        execSync(`npx -y -p firebase-tools firebase auth:delete ${uid} --project tektrakker --force`, { stdio: 'pipe' });
    } catch(e) {
        console.error(`Error deleting Auth user ${uid}:`, e.message);
    }
    
    try {
        console.log(`Deleting Firestore profile: ${uid}`);
        execSync(`npx -y -p firebase-tools firebase firestore:delete "users/${uid}" --project tektrakker --force`, { stdio: 'pipe' });
    } catch(e) {
        console.error(`Error deleting Firestore user ${uid}:`, e.message);
    }
}
console.log("Cleanup fully finished.");
