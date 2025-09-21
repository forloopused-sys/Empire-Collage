
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyB3hJgj94vZxlor-kY7Hru3q1BJRD7mX7k",
  authDomain: "empire-college-of-science.firebaseapp.com",
  databaseURL: "https://empire-college-of-science-default-rtdb.firebaseio.com",
  projectId: "empire-college-of-science",
  storageBucket: "empire-college-of-science.firebasestorage.app",
  messagingSenderId: "570698806473",
  appId: "1:570698806473:web:04140b4aea81a982e58918",
  measurementId: "G-M4TS72WK6D"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getDatabase(app);

export { app, auth, db };
