import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCpdHWgEPYWtLlJrVcAm-QMBguT9okjLvs",
  authDomain: "laforja-4be1d.firebaseapp.com",
  projectId: "laforja-4be1d",
  storageBucket: "laforja-4be1d.firebasestorage.app",
  messagingSenderId: "443885461462",
  appId: "1:443885461462:web:1e8e500cedf8c16d76ce77",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
