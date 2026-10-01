import { db, assertFirebaseConfigured } from './firebase-config.js';
import { addFavorite, isFavorite, removeFavorite, requireAuth, showToast, watchAuth } from './auth.js';
import { collection, doc, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let allMovies = [];
let currentProfile = null;

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, function(character) { return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]; });
}
export function validHttpsUrl(value) { try { return new URL(value).protocol === 'https:'; } catch (error) { return false; } }
function normalize(snapshot) { return Object.assign({ id: snapshot.id }, snapshot.data()); }
export async function getAllMovies() { assertFirebaseConfigured(); const result = await getDocs(collection(db, 'movies')); return result.docs.map(normalize).sort(function(a,b) { return Number(b.año || 0) - Number(a.año || 0); }); }
export async function getMovieById(id) { assertFirebaseConfigured(); const result = await getDoc(doc(db, 'movies', id)); return result.exists() ? normalize(result) : null; }

function movieCard(movie) {
  const favorite = isFavorite(currentProfile, movie.id);
  const genres = movie.genero || 'Película';
  return '<article class="movie-card">' +
    '<button class="favorite-button ' + (favorite ? 'active' : '') + '" data-favorite="' + escapeHtml(movie.id) + '" aria-label="' + (favorite ? 'Quitar de mi lista' : 'Agregar a mi lista') + '">' + (favorite ? '♥' : '♡') + '</button>' +
    '<a class="poster-link" href="movie.html?id=' + encodeURIComponent(movie.id) + '"><img src="' + escapeHtml(movie.posterUrl || '') + '" alt="Póster de ' + escapeHtml(movie.titulo || '') + '" loading="lazy"></a>' +
    '<div class="movie-card-info"><h3>' + escapeHtml(movie.titulo || 'Sin título') + '</h3><div class="movie-meta">' + escapeHtml(movie.año || '') + ' · ' + escapeHtml(genres) + '</div><div class="movie-card-actions"><a class="card-link" href="movie.html?id=' + encodeURIComponent(movie.id) + '">Ver detalles</a></div></div></article>';
}

function bindFavorites(scope) {
  scope.querySelectorAll('[data-favorite]').forEach(function(button) {
    button.addEventListener('click', async function(event) {
      event.preventDefault(); event.stopPropagation();
      try {
        if (isFavorite(currentProfile, button.dataset.favorite)) { await removeFavorite(button.dataset.favorite); currentProfile.favoritos = currentProfile.favoritos.filter(function(id) { return id !== button.dataset.favorite; }); showToast('Película retirada de tu lista.'); }
        else { await addFavorite(button.dataset.favorite); currentProfile.favoritos = (currentProfile.favoritos || []).concat(button.dataset.favorite); showToast('Película agregada a tu lista.'); }
        renderHome(getFiltered());
      } catch (error) { showToast(error.message, true); }
    });
  });
}
function getGenres(movie) { return String(movie.genero || 'Otros').split(',').map(function(item) { return item.trim(); }).filter(Boolean); }
function getFiltered() { const search = (document.querySelector('#searchInput') && document.querySelector('#searchInput').value || '').toLowerCase(); const genre = document.querySelector('#genreFilter') && document.querySelector('#genreFilter').value || 'all'; return allMovies.filter(function(movie) { const genres = getGenres(movie); return (!search || (movie.titulo + ' ' + movie.sinopsis + ' ' + genres.join(' ')).toLowerCase().includes(search)) && (genre === 'all' || genres.includes(genre)); }); }
function renderHome(movies) {
  const container = document.querySelector('#movieSections');
  const favorites = document.querySelector('#favoritesGrid');
  if (!container) return;
  if (!movies.length) container.innerHTML = '<div class="empty-state">No encontramos películas con esos filtros.</div>';
  else {
    const groups = {};
    movies.forEach(function(movie) { getGenres(movie).forEach(function(genre) { groups[genre] = (groups[genre] || []).concat(movie); }); });
    container.innerHTML = Object.keys(groups).map(function(genre) { return '<section class="movie-section"><div class="movie-section-heading"><h3>' + escapeHtml(genre) + '</h3><span class="muted">' + groups[genre].length + ' título' + (groups[genre].length === 1 ? '' : 's') + '</span></div><div class="movie-row">' + groups[genre].map(movieCard).join('') + '</div></section>'; }).join('');
    bindFavorites(container);
  }
  if (favorites) { const ids = currentProfile && currentProfile.favoritos || []; const list = allMovies.filter(function(movie) { return ids.includes(movie.id); }); favorites.innerHTML = list.length ? list.map(movieCard).join('') : '<div class="empty-state">Agrega películas a tu lista usando el corazón.</div>'; bindFavorites(favorites); }
}
function fillGenres() { const select = document.querySelector('#genreFilter'); if (!select) return; const set = {}; allMovies.forEach(function(movie) { getGenres(movie).forEach(function(genre) { set[genre] = true; }); }); select.innerHTML = '<option value="all">Todos los géneros</option>' + Object.keys(set).sort().map(function(genre) { return '<option value="' + escapeHtml(genre) + '">' + escapeHtml(genre) + '</option>'; }).join(''); }
async function settings() { const result = await getDoc(doc(db, 'settings', 'site')); return result.exists() ? result.data() : {}; }
function renderHero(config) { const hero = document.querySelector('#hero'); const movie = allMovies.find(function(item) { return item.destacada; }) || allMovies[0]; if (!hero) return; const banner = movie && movie.bannerUrl || config.bannerUrl || ''; if (validHttpsUrl(banner)) hero.style.backgroundImage = 'url("' + banner + '")'; document.querySelector('#heroTitle').textContent = movie ? movie.titulo : 'Descubre tu próxima historia'; document.querySelector('#heroDescription').textContent = movie ? movie.sinopsis : 'Inicia sesión para explorar el catálogo de películas.'; document.querySelector('#heroWatch').href = movie ? 'movie.html?id=' + encodeURIComponent(movie.id) : 'login.html'; document.querySelector('#heroInfo').onclick = function() { window.location.href = movie ? 'movie.html?id=' + encodeURIComponent(movie.id) : 'login.html'; }; }
async function initHome() { watchAuth(async function(user, profile) { currentProfile = profile; if (!user) { document.querySelector('#movieSections').innerHTML = '<div class="empty-state">Inicia sesión para ver el catálogo privado.<br><br><a class="btn btn-primary" href="login.html">Entrar o registrarse</a></div>'; document.querySelector('#favoritesGrid').innerHTML = '<div class="empty-state">Inicia sesión para crear tu lista.</div>'; return; } try { allMovies = await getAllMovies(); const config = await settings(); fillGenres(); renderHero(config); renderHome(allMovies); document.querySelector('#searchInput').addEventListener('input', function() { renderHome(getFiltered()); }); document.querySelector('#genreFilter').addEventListener('change', function() { renderHome(getFiltered()); }); } catch (error) { const box = document.querySelector('#catalogMessage'); box.textContent = error.message; box.className = 'notice'; } }); }
function embed(url) { if (!validHttpsUrl(url)) return ''; try { const parsed = new URL(url); if (parsed.hostname.includes('youtube.com') && parsed.searchParams.get('v')) return 'https://www.youtube.com/embed/' + parsed.searchParams.get('v'); if (parsed.hostname === 'youtu.be') return 'https://www.youtube.com/embed/' + parsed.pathname.slice(1); if (parsed.hostname.includes('vimeo.com')) return 'https://player.vimeo.com/video/' + parsed.pathname.split('/').pop(); return url; } catch (error) { return ''; } }
function player(url, label) { if (!validHttpsUrl(url)) return '<div class="empty-state">No hay un enlace válido para ' + label + '.</div>'; if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return '<video controls preload="metadata" src="' + escapeHtml(url) + '"></video>'; return '<iframe src="' + escapeHtml(embed(url)) + '" title="' + escapeHtml(label) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'; }
async function initDetail() { const state = await requireAuth(); if (!state) return; currentProfile = state.profile; const id = new URLSearchParams(window.location.search).get('id'); const loading = document.querySelector('#detailLoading'); const detail = document.querySelector('#movieDetail'); try { const movie = await getMovieById(id); if (!movie) throw new Error('No encontramos esta película.'); detail.style.backgroundImage = validHttpsUrl(movie.bannerUrl) ? 'url("' + movie.bannerUrl + '")' : ''; const favorite = isFavorite(currentProfile, movie.id); const html = '<div class="detail-inner"><img class="detail-poster" src="' + escapeHtml(movie.posterUrl || '') + '" alt="Póster de ' + escapeHtml(movie.titulo || '') + '"><div class="detail-copy"><span class="eyebrow">' + escapeHtml(movie.genero || '') + '</span><h1>' + escapeHtml(movie.titulo || '') + '</h1><div class="detail-meta"><span>' + escapeHtml(movie.año || '') + '</span><span>' + escapeHtml(movie.duracion || '') + '</span><span>' + escapeHtml(movie.genero || '') + '</span></div><p>' + escapeHtml(movie.sinopsis || '') + '</p><div class="button-row"><button id="detailFavorite" class="btn btn-primary" type="button">' + (favorite ? '♥ En mi lista' : '♡ Agregar a mi lista') + '</button><a class="btn btn-secondary" href="index.html">Volver</a></div></div></div><div class="player-area"><h2>Tráiler</h2><div class="video-frame">' + player(movie.trailerUrl, 'el tráiler') + '</div></div><div class="player-area"><h2>Reproducir película</h2><div class="video-frame">' + player(movie.linkUrl, 'la película') + '</div></div>'; detail.innerHTML = html; loading.classList.add('hidden'); detail.classList.remove('hidden'); document.querySelector('#detailFavorite').addEventListener('click', async function() { try { if (isFavorite(currentProfile, movie.id)) { await removeFavorite(movie.id); } else { await addFavorite(movie.id); } window.location.reload(); } catch (error) { showToast(error.message, true); } }); } catch (error) { loading.innerHTML = '<div class="empty-state">' + escapeHtml(error.message) + '<br><br><a class="btn btn-secondary" href="index.html">Volver</a></div>'; } }
if (document.body.dataset.page === 'home') initHome();
if (document.body.dataset.page === 'movie') initDetail();
