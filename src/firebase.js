import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB4WeXNn8y7HSMWHsKGY84bDwEIvIRqJE8",
  authDomain: "mi-cine-web.firebaseapp.com",
  projectId: "mi-cine-web",
  appId: "1:464379362876:web:1c6a23861403582fce8d39"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);