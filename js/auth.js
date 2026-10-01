import { auth, db, googleProvider, assertFirebaseConfigured } from './firebase-config.js';
import { browserLocalPersistence, createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { arrayRemove, arrayUnion, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let resolveAuth;
const authReady = new Promise(function(resolve) { resolveAuth = resolve; });

export function readableAuthError(error) {
  const messages = {
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/invalid-login-credentials': 'El correo o la contraseña no son correctos.',
    'auth/email-already-in-use': 'Este correo ya está registrado.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'Escribe un correo electrónico válido.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google.',
    'auth/network-request-failed': 'No hay conexión con Firebase.',
    'permission-denied': 'No tienes permisos para realizar esta acción.'
  };
  return messages[error && error.code] || (error && error.message) || 'Ocurrió un error. Inténtalo de nuevo.';
}

export async function ensureUserDocument(user, extraData) {
  assertFirebaseConfigured();
  extraData = extraData || {};
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  const old = snapshot.exists() ? snapshot.data() : {};
  const profile = {
    uid: user.uid,
    nombre: old.nombre || extraData.nombre || user.displayName || 'Usuario',
    email: user.email || old.email || '',
    rol: old.rol || 'user',
    bloqueado: old.bloqueado === true,
    fechaRegistro: old.fechaRegistro || serverTimestamp(),
    favoritos: Array.isArray(old.favoritos) ? old.favoritos : []
  };
  await setDoc(ref, profile, { merge: true });
  return { uid: profile.uid, nombre: profile.nombre, email: profile.email, rol: profile.rol, bloqueado: profile.bloqueado, favoritos: profile.favoritos, fechaRegistro: old.fechaRegistro || null };
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async function(user) {
    if (!user) {
      callback(null, null);
      resolveAuth({ user: null, profile: null });
      return;
    }
    try {
      const profile = await ensureUserDocument(user);
      if (profile.bloqueado) {
        await signOut(auth);
        showToast('Tu cuenta está bloqueada. Contacta al administrador.', true);
        callback(null, null);
        resolveAuth({ user: null, profile: null });
        return;
      }
      callback(user, profile);
      resolveAuth({ user: user, profile: profile });
    } catch (error) {
      console.error(error);
      callback(user, null);
      resolveAuth({ user: user, profile: null });
    }
  });
}

export function waitForAuth() { return authReady; }
export async function requireAuth(redirect) { const state = await waitForAuth(); if (!state.user) { window.location.href = redirect || 'login.html'; return null; } return state; }
export async function requireAdmin() { const state = await waitForAuth(); if (!state.user || !state.profile || state.profile.rol !== 'admin') { window.location.href = state.user ? 'index.html' : 'login.html'; return null; } return state; }
export async function addFavorite(id) { if (!auth.currentUser) throw new Error('Debes iniciar sesión.'); await updateDoc(doc(db, 'users', auth.currentUser.uid), { favoritos: arrayUnion(id) }); }
export async function removeFavorite(id) { if (!auth.currentUser) throw new Error('Debes iniciar sesión.'); await updateDoc(doc(db, 'users', auth.currentUser.uid), { favoritos: arrayRemove(id) }); }
export function isFavorite(profile, id) { return !!(profile && Array.isArray(profile.favoritos) && profile.favoritos.includes(id)); }

export function showToast(message, isError) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(function() { toast.className = 'toast'; }, 3500);
}

function authMessage(message, type) {
  const box = document.querySelector('#authMessage');
  if (!box) return;
  box.textContent = message || '';
  box.className = message ? 'form-message ' + (type || 'error') : 'form-message hidden';
}

function initLogin() {
  const form = document.querySelector('#authForm');
  if (!form) return;
  let register = false;
  const nameField = document.querySelector('#nameField');
  const title = document.querySelector('#authTitle');
  const subtitle = document.querySelector('#authSubtitle');
  const submit = document.querySelector('#authSubmit');
  const toggle = document.querySelector('#modeToggle');
  function mode() {
    document.body.dataset.authMode = register ? 'register' : 'login';
    nameField.classList.toggle('hidden', !register);
    title.textContent = register ? 'Crea tu cuenta' : 'Inicia sesión';
    subtitle.textContent = register ? 'Guarda tus favoritas y disfruta la noche.' : 'Continúa disfrutando tus películas favoritas.';
    submit.textContent = register ? 'Crear cuenta' : 'Iniciar sesión';
    toggle.textContent = register ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate';
  }
  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    authMessage('');
    if (!form.checkValidity() || (register && form.name.value.trim().length < 2)) { authMessage('Completa correctamente todos los campos.'); form.reportValidity(); return; }
    try {
      assertFirebaseConfigured();
      submit.disabled = true;
      await setPersistence(auth, browserLocalPersistence);
      if (register) { const result = await createUserWithEmailAndPassword(auth, form.email.value.trim(), form.password.value); await ensureUserDocument(result.user, { nombre: form.name.value.trim() }); }
      else { await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value); }
      window.location.href = 'index.html';
    } catch (error) { authMessage(readableAuthError(error)); submit.disabled = false; }
  });
  document.querySelector('#googleButton').addEventListener('click', async function() {
    try { assertFirebaseConfigured(); await setPersistence(auth, browserLocalPersistence); const result = await signInWithPopup(auth, googleProvider); await ensureUserDocument(result.user); window.location.href = 'index.html'; }
    catch (error) { authMessage(readableAuthError(error)); }
  });
  toggle.addEventListener('click', function() { register = !register; mode(); });
  mode();
}

function initCommon() {
  const menu = document.querySelector('#menuToggle');
  const nav = document.querySelector('#mainNav');
  if (menu) menu.addEventListener('click', function() { nav.classList.toggle('open'); });
  watchAuth(function(user, profile) {
    const actions = document.querySelector('#authActions');
    const label = document.querySelector('#userLabel');
    const admin = document.querySelector('#adminLink');
    if (!actions) return;
    if (user) {
      label.textContent = (profile && profile.nombre) || user.email || '';
      actions.innerHTML = '<button class="header-button" id="logoutButton" type="button">Salir</button>';
      if (admin) admin.classList.toggle('hidden', !profile || profile.rol !== 'admin');
      document.querySelector('#logoutButton').addEventListener('click', async function() { await signOut(auth); window.location.href = 'login.html'; });
    } else {
      label.textContent = '';
      actions.innerHTML = '<a class="header-button" href="login.html">Entrar</a>';
      if (admin) admin.classList.add('hidden');
    }
  });
}

if (document.body.dataset.page === 'login') initLogin(); else initCommon();
export { auth, db };
