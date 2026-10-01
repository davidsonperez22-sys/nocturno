import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Avatares predefinidos de NOCTURNO. Se guarda solo el identificador elegido.
const AVATARS = [
  { id: 'luna', label: 'Luna', emoji: '🌙', a: '#7c3aed', b: '#2563eb' },
  { id: 'cine', label: 'Cine', emoji: '🎬', a: '#db2777', b: '#7c3aed' },
  { id: 'planeta', label: 'Planeta', emoji: '🪐', a: '#0891b2', b: '#1d4ed8' },
  { id: 'robot', label: 'Robot', emoji: '🤖', a: '#475569', b: '#0f766e' },
  { id: 'zorro', label: 'Zorro', emoji: '🦊', a: '#ea580c', b: '#be123c' },
  { id: 'panda', label: 'Panda', emoji: '🐼', a: '#334155', b: '#111827' },
  { id: 'alien', label: 'Alien', emoji: '👽', a: '#16a34a', b: '#0f766e' },
  { id: 'buho', label: 'Búho', emoji: '🦉', a: '#92400e', b: '#4c1d95' }
];

let activeUser = null;
let pendingAvatar = 'luna';

function toast(message, error = false) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.className = 'toast show' + (error ? ' error' : '');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => { element.className = 'toast'; }, 3500);
}

function getAvatar(id) {
  return AVATARS.find((avatar) => avatar.id === id) || AVATARS[0];
}

function applyAvatar(element, id) {
  if (!element) return;
  const avatar = getAvatar(id);
  element.textContent = avatar.emoji;
  element.style.setProperty('--avatar-a', avatar.a);
  element.style.setProperty('--avatar-b', avatar.b);
  element.setAttribute('aria-label', 'Avatar: ' + avatar.label);
}

function renderAvatarChoices(selected) {
  const container = document.querySelector('#avatarChoices');
  if (!container) return;
  container.innerHTML = AVATARS.map((avatar) => 
    '<button class="avatar-choice ' + (avatar.id === selected ? 'selected' : '') + '" data-avatar-option="' + avatar.id + '" type="button" aria-label="Elegir avatar ' + avatar.label + '">' +
    '<span class="avatar avatar-option" style="--avatar-a:' + avatar.a + ';--avatar-b:' + avatar.b + '">' + avatar.emoji + '</span>' +
    '<span>' + avatar.label + '</span></button>'
  ).join('');
  container.querySelectorAll('[data-avatar-option]').forEach((button) => button.addEventListener('click', () => {
    pendingAvatar = button.dataset.avatarOption;
    container.querySelectorAll('.avatar-choice').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
  }));
}

function initProfile() {
  const menu = document.querySelector('#profileMenu');
  const button = document.querySelector('#profileButton');
  const panel = document.querySelector('#profilePanel');
  const saveButton = document.querySelector('#saveAvatarButton');
  if (!menu || !button) return;

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    panel?.classList.toggle('hidden');
  });
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) panel?.classList.add('hidden');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') panel?.classList.add('hidden');
  });
  saveButton?.addEventListener('click', async () => {
    if (!activeUser) return;
    try {
      saveButton.disabled = true;
      await updateDoc(doc(db, 'users', activeUser.uid), { avatarId: pendingAvatar });
      applyAvatar(document.querySelector('#profileAvatar'), pendingAvatar);
      toast('Avatar guardado correctamente.');
      panel?.classList.add('hidden');
    } catch (error) {
      toast('No se pudo guardar el avatar. Inténtalo de nuevo.', true);
      console.error(error);
    } finally {
      saveButton.disabled = false;
    }
  });

  onAuthStateChanged(auth, async (user) => {
    activeUser = user;
    if (!user) {
      button.classList.add('hidden');
      panel?.classList.add('hidden');
      return;
    }
    try {
      const snapshot = await getDoc(doc(db, 'users', user.uid));
      const profile = snapshot.exists() ? snapshot.data() : {};
      const name = profile.nombre || user.displayName || user.email?.split('@')[0] || 'Usuario';
      const username = profile.usuario || name;
      document.querySelector('#profileName').textContent = name;
      document.querySelector('#profileEmail').textContent = user.email || profile.email || '';
      document.querySelector('#userLabel').textContent = '@' + username;
      pendingAvatar = profile.avatarId || 'luna';
      applyAvatar(document.querySelector('#profileAvatar'), pendingAvatar);
      renderAvatarChoices(pendingAvatar);
      button.classList.remove('hidden');
    } catch (error) {
      console.error(error);
      button.classList.add('hidden');
    }
  });
}

if (document.body.dataset.page !== 'login') initProfile();
