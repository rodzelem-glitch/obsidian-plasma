const admin = require('firebase-admin');

try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'tektrakker'
  });
  console.log("Admin initialized successfully!");
} catch (e) {
  console.error("Admin init failed:", e.message);
}
