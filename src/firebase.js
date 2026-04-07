import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { db as backendDb } from "./services/backendFirestore";

const firebaseConfig = {
  apiKey: "AIzaSyC8MoPIGl_CeJML6GVfQdGkaYP8i-55fyk",
  authDomain: "richetsgoal-finanzas-gtq.firebaseapp.com",
  projectId: "richetsgoal-finanzas-gtq",
  storageBucket: "richetsgoal-finanzas-gtq.firebasestorage.app",
  messagingSenderId: "584862009573",
  appId: "1:584862009573:web:2cd06ffb6dbfaec207ac0c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = backendDb;
