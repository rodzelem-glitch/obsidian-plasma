# 🚨 REMINDER: Delete Firebase App Hosting 🚨

### When to do this:
May 3rd, 2026 (2 days from now).

### Why:
You successfully migrated `tektrakker.com` and `app.tektrakker.com` over to **Standard Firebase Hosting**. 
We left the old **App Hosting** backend running for 48 hours to ensure all global DNS caches (ISPs, mobile networks, etc.) are fully flushed and completely routing to the new servers without dropping a single user.

### Action Item:
1. Go to the Firebase Console.
2. Click **App Hosting** on the left sidebar.
3. Delete the App Hosting backend. 
*(This will save you from failing build logs and cleanup your cloud environment!)*
