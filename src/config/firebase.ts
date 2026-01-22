import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';


const firebaseConfig = {
  apiKey: "AIzaSyAmL3tI2TjsSx3F18ia3dYB4gortK4tNqo",
  authDomain: "souradip-opencv-assignment.firebaseapp.com",
  projectId: "souradip-opencv-assignment",
  storageBucket: "souradip-opencv-assignment.firebasestorage.app", 
  messagingSenderId: "341393792712",
  appId: "1:341393792712:web:be9103ac557706ff0c4ffd",
  measurementId: "G-2T6L9T06H8"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
