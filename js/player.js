/* Reproductor personalizado de NOCTURNO para archivos MP4 y WebM. */

const PLAYER_READY = 'nocturnoPlayerReady';

function formatTime(value) {
  if (!Number.isFinite(value)) return '00:00';
  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

function makeButton(label, action, className, ariaLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.dataset.playerAction = action;
  button.setAttribute('aria-label', ariaLabel);
  return button;
}

function makeRange(className, control, min, max, value, step, ariaLabel) {
  const input = document.createElement('input');
  input.className = className;
  input.type = 'range';
  input.dataset.playerControl = control;
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.step = String(step);
  input.setAttribute('aria-label', ariaLabel);
  return input;
}

function enhanceVideo(video) {
  if (video.dataset[PLAYER_READY] === 'true') return;
  video.dataset[PLAYER_READY] = 'true';
  video.removeAttribute('controls');
  video.setAttribute('playsinline', '');
  video.preload = 'metadata';

  const player = document.createElement('div');
  player.className = 'nocturno-player is-paused';
  video.parentElement?.insertBefore(player, video);
  player.appendChild(video);

  const centerButton = makeButton('▶', 'play', 'player-center-button', 'Reproducir pelicula');
  const controls = document.createElement('div');
  controls.className = 'nocturno-controls';
  controls.setAttribute('aria-label', 'Controles del reproductor');
  const progress = makeRange('player-progress', 'progress', 0, 1000, 0, 1, 'Progreso de la pelicula');
  const toolbar = document.createElement('div');
  toolbar.className = 'player-toolbar';
  const playButton = makeButton('▶', 'play', 'player-button player-play', 'Reproducir o pausar');
  const backButton = makeButton('BACK 10', 'back', 'player-button', 'Retroceder 10 segundos');
  const forwardButton = makeButton('10 NEXT', 'forward', 'player-button', 'Adelantar 10 segundos');
  const time = document.createElement('span');
  time.className = 'player-time';
  const currentLabel = document.createElement('span');
  currentLabel.dataset.playerLabel = 'current';
  currentLabel.textContent = '00:00';
  const durationLabel = document.createElement('span');
  durationLabel.dataset.playerLabel = 'duration';
  durationLabel.textContent = '00:00';
  time.append(currentLabel, document.createTextNode(' / '), durationLabel);

  const volumeLabel = document.createElement('label');
  volumeLabel.className = 'player-volume';
  volumeLabel.setAttribute('aria-label', 'Volumen');
  const volumeText = document.createElement('span');
  volumeText.textContent = 'VOL';
  const volume = makeRange('', 'volume', 0, 1, 1, 0.05, 'Volumen');
  volumeLabel.append(volumeText, volume);

  const speedLabel = document.createElement('label');
  speedLabel.className = 'player-speed';
  speedLabel.setAttribute('aria-label', 'Velocidad');
  const speedText = document.createElement('span');
  speedText.textContent = 'Velocidad';
  const speed = document.createElement('select');
  speed.dataset.playerControl = 'speed';
  speed.setAttribute('aria-label', 'Velocidad de reproduccion');
  [['0.5', '0.5x'], ['0.75', '0.75x'], ['1', '1x'], ['1.25', '1.25x'], ['1.5', '1.5x'], ['2', '2x']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (value === '1') option.selected = true;
    speed.appendChild(option);
  });
  speedLabel.append(speedText, speed);
  const fullscreenButton = makeButton('FULL', 'fullscreen', 'player-button player-fullscreen', 'Pantalla completa');
  toolbar.append(playButton, backButton, forwardButton, time, volumeLabel, speedLabel, fullscreenButton);
  controls.append(progress, toolbar);
  player.append(centerButton, controls);

  const playButtons = [centerButton, playButton];
  const updateProgress = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const percent = duration ? (video.currentTime / duration) * 1000 : 0;
    progress.value = String(percent);
    progress.style.setProperty('--progress', (duration ? percent / 10 : 0) + '%');
    currentLabel.textContent = formatTime(video.currentTime);
    durationLabel.textContent = formatTime(duration);
  };

  const updatePlayState = () => {
    const paused = video.paused;
    player.classList.toggle('is-paused', paused);
    player.classList.toggle('is-playing', !paused);
    playButton.textContent = paused ? '▶' : '||';
    playButtons.forEach((button) => button.setAttribute('aria-label', paused ? 'Reproducir pelicula' : 'Pausar pelicula'));
  };
  const togglePlay = () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };
  playButtons.forEach((button) => button.addEventListener('click', togglePlay));
  backButton.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 10); });
  forwardButton.addEventListener('click', () => { video.currentTime = Math.min(video.duration || video.currentTime + 10, video.currentTime + 10); });
  fullscreenButton.addEventListener('click', async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await player.requestFullscreen?.();
  });
  progress.addEventListener('input', () => { if (Number.isFinite(video.duration)) video.currentTime = Number(progress.value) / 1000 * video.duration; });
  volume.addEventListener('input', () => { video.volume = Number(volume.value); });
  speed.addEventListener('change', () => { video.playbackRate = Number(speed.value); });
  video.addEventListener('click', togglePlay);
  video.addEventListener('loadedmetadata', updateProgress);
  video.addEventListener('timeupdate', updateProgress);
  video.addEventListener('durationchange', updateProgress);
  video.addEventListener('play', updatePlayState);
  video.addEventListener('pause', updatePlayState);
  video.addEventListener('ended', updatePlayState);
  updateProgress();
  updatePlayState();
}

function scanForVideos(root = document) {
  root.querySelectorAll('video:not([data-nocturno-player-ready])').forEach(enhanceVideo);
}

function initPlayer() {
  scanForVideos();
  const observer = new MutationObserver(() => scanForVideos());
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPlayer);
else initPlayer();
