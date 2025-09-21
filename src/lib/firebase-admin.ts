
import admin from 'firebase-admin';

// This file is for server-side use only.
// It is intended to be used in server actions and API routes.

function initializeFirebaseAdmin() {
    if (!admin.apps.length) {
        try {
            const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
            if (!serviceAccountEnv) {
                // This error will be thrown if the key is not set, which is expected
                // if the project hasn't been fully configured.
                throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY must be set in environment variables for admin actions.');
            }
            const serviceAccount = JSON.parse(serviceAccountEnv);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: "https://empire-college-of-science-default-rtdb.firebaseio.com",
            });
        } catch (error) {
            // We ignore this error if it's just telling us the app already exists.
            if (error instanceof Error && !/already exists/i.test(error.message)) {
                console.error('Firebase admin initialization error', error.stack);
                throw new Error('Firebase admin initialization failed: ' + error.message);
            }
        }
    }
}


// We no longer initialize on module load to prevent crashes.
// Functions that need the admin SDK will call initializeFirebaseAdmin() themselves.

// We export the admin object, but it must be initialized before use.
export default admin;
