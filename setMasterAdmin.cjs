
// This is a one-time use script to grant master_admin privileges.
// Make sure you have the 'serviceAccountKey.json' file in the root of your project first.
const admin = require('firebase-admin');

// The email address of the user to make a master admin.
const userEmail = 'rodzelem@gmail.com';

try {
    const serviceAccount = require('./serviceAccountKey.json');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log(`Looking up user: ${userEmail}...`);

    admin.auth().getUserByEmail(userEmail)
        .then(user => {
            return admin.auth().setCustomUserClaims(user.uid, { role: 'master_admin' });
        })
        .then(() => {
            console.log(`\n✅ Success!`);
            console.log(`   The 'master_admin' role has been set for ${userEmail}.`);
            console.log(`\n👉 IMPORTANT: You must now log out and log back into the application.`);
            console.log(`   This will refresh your user token and apply the new role.`);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error setting custom claim:', error.message);
            if (error.code === 'auth/user-not-found') {
                console.error(`   Could not find a user with the email: ${userEmail}`);
            }
            process.exit(1);
        });

} catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
        console.error('\n❌ Error: The `serviceAccountKey.json` file was not found.');
        console.error('   Please complete Step 1 of the instructions before running this script.');
    } else {
        console.error('\n❌ An unexpected error occurred:', error.message);
    }
    process.exit(1);
}
