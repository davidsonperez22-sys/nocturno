// Configuración del proyecto Firebase para NOCTURNO.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBrM4lHVZYfQNBqZazic1uPjDHAuRkU_JA',
  authDomain: 'nocturno-f2e6a.firebaseapp.com',
  projectId: 'nocturno-f2e6a',
  storageBucket: 'nocturno-f2e6a.firebasestorage.app',
  messagingSenderId: '550762329671',
  appId: '1:550762329671:web:03c88cdc41649c9ddf6362'
};

export const firebaseConfigured = true;
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export function assertFirebaseConfigured() {
  if (!firebaseConfigured) {
    throw new Error('Configura js/firebase-config.js con los datos de tu proyecto Firebase.');
  }
}
