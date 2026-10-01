// Configuración del proyecto Firebase.
// Reemplaza estos valores con los que te entrega Firebase Console.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'REEMPLAZA_CON_TU_API_KEY',
  authDomain: 'REEMPLAZA_CON_TU_PROJECT_ID.firebaseapp.com',
  projectId: 'REEMPLAZA_CON_TU_PROJECT_ID',
  storageBucket: 'REEMPLAZA_CON_TU_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'REEMPLAZA_CON_TU_SENDER_ID',
  appId: 'REEMPLAZA_CON_TU_APP_ID'
};

export const firebaseConfigured = !firebaseConfig.apiKey.startsWith('REEMPLAZA');
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Esta función permite mostrar una instrucción clara si aún no se pegó la configuración.
export function assertFirebaseConfigured() {
  if (!firebaseConfigured) {
    throw new Error('Configura js/firebase-config.js con los datos de tu proyecto Firebase.');
  }
}
