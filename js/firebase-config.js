// Configuration Firebase App, Auth & Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBmYgWluWO9dBTFLsDbJLYo-yKMgeY4gWU",
  authDomain: "aux-fourneaux-3289d.firebaseapp.com",
  projectId: "aux-fourneaux-3289d",
  storageBucket: "aux-fourneaux-3289d.firebasestorage.app",
  messagingSenderId: "18344848440",
  appId: "1:18344848440:web:c3d0925caf08dde0708acd",
  measurementId: "G-17KRVNJ9X4"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
