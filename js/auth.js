import { auth, db, googleProvider, assertFirebaseConfigured } from './firebase-config.js';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let authStateReady;
let resolveAuthState;
authStateReady = new Promise((resolve) => { resolveAuthState = resolve; });

// Convierte los errores técnicos de Firebase en mensajes entendibles.
export function readableAuthError(error) {
  const code = error?.code || '';
  const messages = {
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/invalid-login-credentials': 'El correo o la contraseña no son correctos.',
    'auth/email-already-in-use': 'Este correo ya está registrado.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'Escribe un correo electrónico válido.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de completar el acceso.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo de nuevo.',
    'auth/network-request-failed': 'No hay conexión con Firebase. Revisa tu internet.',
    'permission-denied': 'No tienes permisos para realizar esta acción.'
  };
  return messages[code] || error?.message || 'Ocurrió un error. Inténtalo de nuevo.';
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const profile = await ensureUserDocument(user);
        if (profile.blocked) {
          await signOut(auth);
          showToast('Tu cuenta está bloqueada. Contacta al administrador.', true);
          callback(null, null);
          resolveAuthState({ user: null, profile: null });
          return;
        }
        callback(user, profile);
        resolveAuthState({ user, profile });
      } catch (error) {
        console.error(error);
        callback(user, null);
        resolveAuthState({ user, profile: null });
      }
    } else {
      callback(null, null);
      resolveAuthState({ user: null, profile: null });
    }
  });
}

export async function waitForAuth() {
  return authStateReady;
}

export async function ensureUserDocument(user, extraData = {}) {
  assertFirebaseConfigured();
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);
  const existing = snapshot.exists() ? snapshot.data() : {};
  const profile = {
    uid: user.uid,
    nombre: existing.nombre || extraData.nombre || user.displayName || 'Usuario',
    email: user.email || existing.email || '',
    rol: existing.rol || 'user',
    bloqueado: existing.bloqueado === true,
    fechaRegistro: existing.fechaRegistro || serverTimestamp(),
    favoritos: Array.isArray(existing.favoritos) ? existing.favoritos : []
  };
  await setDoc(userRef, profile, { merge: true });
  return { ...profile, fechaRegistro: existing.fechaRegistro || null };
}

export async function getCurrentProfile() {
  if (!auth.currentUser) return null;
  const snapshot = await getDoc(doc(db, 'users', auth.currentUser.uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function requireAuth(redirect = 'login.html') {
  const state = await waitForAuth();
  if (!state.user) {
    window.location.href = redirect;
    return null;
  }
  return state;
}

export async function requireAdmin() {
  const state = await waitForAuth();
  if (!state.user || state.profile?.rol !== 'admin') {
    window.location.href = state.user ? 'index.html' : 'login.html';
    return null;
  }
  return state;
}

export async function addFavorite(movieId) {
  assertFirebaseConfigured();
  if (!auth.currentUser) throw new Error('Debes iniciar sesión para agregar favoritos.');
  await updateDoc(doc(db, 'users', auth.currentUser.uid), { favoritos: arrayUnion(movieId) });
}

export async function removeFavorite(movieId) {
  assertFirebaseConfigured();
  if (!auth.currentUser) throw new Error('Debes iniciar sesión para quitar favoritos.');
  await updateDoc(doc(db, 'users', auth.currentUser.uid), { favoritos: arrayRemove(movieId) });
}

export function isFavorite(profile, movieId) {
  return Array.isArray(profile?.favoritos) && profile.favoritos.includes(movieId);
}

function showAuthMessage(message, type = 'error') {
  const element = document.querySelector('#authMessage');
  if (!element) return;
  if (!message) {
    element.textContent = '';
    element.className = 'form-message hidden';
    return;
  }
  element.textContent = message;
  element.className = `form-message ${type}`;
}

export function showToast(message, error = false) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.className = 'toast'; }, 3500);
}

function setAuthLoading(loading) {
  const submit = document.querySelector('#authSubmit');
  const google = document.querySelector('#googleButton');
  if (submit) { submit.disabled = loading; submit.textContent = loading ? 'Procesando...' : (document.body.dataset.authMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'); }
  if (google) google.disabled = loading;
}

function initLoginPage() {
  const form = document.querySelector('#authForm');
  if (!form) return;
  let registerMode = false;
  const nameField = document.querySelector('#nameField');
  const title = document.querySelector('#authTitle');
  const subtitle = document.querySelector('#authSubtitle');
  const submit = document.querySelector('#authSubmit');
  const toggle = document.querySelector('#modeToggle');

  const updateMode = () => {
    document.body.dataset.authMode = registerMode ? 'register' : 'login';
    nameField?.classList.toggle('hidden', !registerMode);
    title.textContent = registerMode ? 'Crea tu cuenta' : 'Inicia sesión';
    subtitle.textContent = registerMode ? 'Guarda tus favoritas y disfruta la noche.' : 'Continúa disfrutando tus películas favoritas.';
    submit.textContent = registerMode ? 'Crear cuenta' : 'Iniciar sesión';
    toggle.textContent = registerMode ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showAuthMessage('');
    const email = form.email.value.trim();
    const password = form.password.value;
    const name = form.name?.value.trim() || '';
    if (!form.checkValidity() || (registerMode && name.length < 2)) {
      showAuthMessage('Completa correctamente todos los campos.');
      form.reportValidity();
      return;
    }
    try {
      assertFirebaseConfigured();
      setAuthLoading(true);
      await setPersistence(auth, browserLocalPersistence);
      if (registerMode) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUserDocument(credential.user, { nombre: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      window.location.href = 'index.html';
    } catch (error) {
      showAuthMessage(readableAuthError(error));
      setAuthLoading(false);
    }
  });

  document.querySelector('#googleButton')?.addEventListener('click', async () => {
    try {
      assertFirebaseConfigured();
      setAuthLoading(true);
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithPopup(auth, googleProvider);
      await ensureUserDocument(credential.user);
      window.location.href = 'index.html';
    } catch (error) {
      showAuthMessage(readableAuthError(error));
      setAuthLoading(false);
    }
  });
  toggle?.addEventListener('click', () => { registerMode = !registerMode; updateMode(); });
  updateMode();
}

function initCommonUI() {
  const menuTogyle = document.querySelector('#menuToggle');
  const mainNav = document.querySelector('#mainNav');
  menuToggle?.addEventListener('click', () => mainNav?.classList.toggle('open'));
  if (!document.querySelector('#authActions')) return;
  watchAuth((user, profile) => {
    const actions = document.querySelector('#authActions');
    const label = document.querySelector('#userLabel');
    const adminLink = document.querySelector('#adminLink');
    if (user) {
      label.textContent = profile?.nombre || user.email || '';
      actions.innerHTML = '<button class="header-button" id="logoutButton" type="button>Salir"</button>';
      adminLink?.classList.toggle('hidden', profile?.rol !== 'admin');
      document.querySelector('#logoutButton')?.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'login.html';
      });
    } else {
      label.textContent = '';
      actions.innerHTML = '<a class="header-button" href="login.html">Entrar</a>';
      adminLink?.classList.add('hidden');
    }
  });
}

if (document.body.dataset.page === 'login') {
  initLoginPage();
} else {
  initCommonUI();
}

export { auth, db, GoogleAuthProvider };
