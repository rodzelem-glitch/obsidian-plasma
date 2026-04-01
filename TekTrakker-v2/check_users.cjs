const fs = require('fs');
const path = require('path');

const usersFile = path.resolve(__dirname, 'users.json');
if (!fs.existsSync(usersFile)) {
    console.error("users.json not found");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(usersFile, 'utf8'));

console.log(`Analyzing ${data.users.length} total users in Firebase...`);

const candidatesToDelete = [];
const protectedDemoUsers = [];

data.users.forEach(u => {
    const email = (u.email || "").toLowerCase();
    
    // Protect standard identities
    if (
        email.includes('demo') || 
        email === 'admin@tektrakker.com' ||
        email === 'dispatcher@tektrakker.com' ||
        email === 'technician@tektrakker.com' ||
        email === 'customer@tektrakker.com' ||
        email.includes('master')
    ) {
        protectedDemoUsers.push(u);
    } else {
        candidatesToDelete.push(u);
    }
});

console.log("\n--- PROTECTED DEMO USERS (WILL NOT DELETE) ---");
protectedDemoUsers.forEach(u => console.log(`${u.email} (Created: ${new Date(parseInt(u.createdAt)).toISOString()})`));

console.log("\n--- CANDIDATES FOR DELETION (POTENTIAL TEST USERS) ---");
candidatesToDelete.forEach(u => console.log(`${u.email} [UID: ${u.localId}] (Created: ${new Date(parseInt(u.createdAt)).toISOString()})`));

fs.writeFileSync('candidates_to_delete.json', JSON.stringify(candidatesToDelete, null, 2));
