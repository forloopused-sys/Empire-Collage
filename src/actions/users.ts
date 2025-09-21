
"use server";

import admin from 'firebase-admin';
import type { UserRecord } from "firebase-admin/auth";

// This file is for server-side use only.
// It is intended to be used in server actions and API routes.
// The initialization is handled within the functions that need it.

function initializeFirebaseAdmin() {
    if (!admin.apps.length) {
        try {
          const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
          if (!serviceAccountEnv) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set in the environment.');
          }
          const serviceAccount = JSON.parse(serviceAccountEnv);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://empire-college-of-science-default-rtdb.firebaseio.com",
          });
        } catch (error) {
          if (error instanceof Error && !/already exists/i.test(error.message)) {
            console.error('Firebase admin initialization error', error.stack);
            // Throw the error to be caught by the caller
            throw new Error('Firebase admin initialization failed: ' + error.message);
          }
        }
    }
}


type UserData = {
    email: string;
    name: string;
    role: 'student' | 'teacher' | 'admin' | 'sub-admin';
    courseId?: string;
    admissionNo?: string;
    assignedCourses?: string[];
}

export async function createUser(userData: UserData): Promise<{ user?: UserRecord; error?: string }> {
    try {
        initializeFirebaseAdmin();
        const authAdmin = admin.auth();
        const db = admin.database();

        const userRecord = await authAdmin.createUser({
            email: userData.email,
            password: "OnlineEmpire@123", // Set a secure temporary password
            displayName: userData.name,
            emailVerified: false, 
        });

        // Save user profile data to Realtime Database
        const profileData: any = {
            uid: userRecord.uid,
            email: userData.email,
            name: userData.name,
            role: userData.role,
        };

        if (userData.role === 'student') {
            profileData.admissionNo = userData.admissionNo;
            profileData.courseId = userData.courseId;
        } else if (userData.role === 'teacher') {
            profileData.assignedCourses = userData.assignedCourses || [];
        }

        await db.ref(`users/${userRecord.uid}`).set(profileData);

        return { user: userRecord };
    } catch (error: any) {
        console.error("Error creating user with Admin SDK:", error);
        
        let errorMessage = "An unknown error occurred while creating the user.";
        if (error.code === 'auth/email-already-exists') {
            errorMessage = "The email address is already in use by another account.";
        } else if (error.code === 'auth/invalid-password') {
            errorMessage = "The password must be at least 6 characters long.";
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        return { error: errorMessage };
    }
}
