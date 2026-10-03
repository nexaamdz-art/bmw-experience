import Lenis from 'lenis';
import gsap from 'gsap';

// ==========================================================================
// Configuration & State
// ==========================================================================
const SCENE_CONFIGS = [
  { id: 'scene-1', folder: 's1', frameCount: 192, soundKey: 'scene-1' },
  { id: 'scene-2', folder: 's2', frameCount: 192, soundKey: 'scene-2' },
  { id: 'scene-3', folder: 's3', frameCount: 192, soundKey: 'scene-3' },
  { id: 'scene-r', reverse: true, soundKey: 'scene-r' },
  { id: 'scene-4', folder: 's4', frameCount: 240, soundKey: 'scene-4' },
  { id: 'scene-5', folder: 's5', frameCount: 171, soundKey: 'scene-5' },
  { id: 'scene-6', folder: 's6', frameCount: 120, soundKey: 'scene-6' },
  { id: 'scene-7', folder: 's7', frameCount: 120, soundKey: 'scene-7' },
];

const state = {
  soundEnabled: true,
  soundInitialized: false,
  currentLang: 'en',
  statsAnimated: false,
  currentSceneIndex: -1,
};

// ==========================================================================
// Intelligent Cross-Fading Audio Engine
// ==========================================================================
class AudioManager {
  constructor() {
    this.players = {
      'scene-1': new Audio('/audio/startup.mp3'),
      'scene-2': new Audio('/audio/teardown.mp3'),
      'scene-3': new Audio('/audio/engine_dive.mp3'),
      'scene-r': new Audio('/audio/reassemble.mp3'),
      'scene-4': new Audio('/audio/headlight.mp3'),
      'scene-5': new Audio('/audio/grille.mp3'),
      'scene-6': new Audio('/audio/aerodynamics.mp3'),
      'scene-7': new Audio('/audio/launch.mp3'),
    };

    Object.values(this.players).forEach((a) => {
      a.preload = 'auto';
      a.volume = 0;
    });

    this.currentSceneId = null;
    this.currentAudio = null;
    this.idleTimer = null;
    this.isMuted = false;
  }

  unlockAll() {
    Object.values(this.players).forEach((a) => {
      a.play().then(() => {
        a.pause();
        a.currentTime = 0;
      }).catch(() => {});
    });
  }

  playScene(sceneId, isForward = true) {
    if (!state.soundEnabled || this.isMuted) return;

    if (!isForward && this.currentSceneId !== sceneId) {
      if (this.currentAudio) {
        this.fadeOut(this.currentAudio, 500);
      }
      this.currentSceneId = sceneId;
      this.currentAudio = null;
      return;
    }

    if (this.currentSceneId === sceneId && this.currentAudio && !this.currentAudio.paused) {
      return;
    }

    const nextAudio = this.players[sceneId];
    if (!nextAudio) return;

    if (this.currentAudio && this.currentAudio !== nextAudio) {
      this.fadeOut(this.currentAudio, 350);
    }

    this.currentSceneId = sceneId;
    this.currentAudio = nextAudio;

    if (nextAudio.paused || nextAudio.currentTime > 7) {
      nextAudio.currentTime = 0;
    }

    this.fadeIn(nextAudio, 0.75, 300);
  }

  fadeIn(audio, targetVol = 0.75, duration = 300) {
    if (!state.soundEnabled || this.isMuted) return;
    audio.play().catch(() => {});

    clearInterval(audio._fadeInterval);
    const stepTime = 25;
    const step = targetVol / (duration / stepTime);

    audio._fadeInterval = setInterval(() => {
      if (audio.volume + step >= targetVol) {
        audio.volume = targetVol;
        clearInterval(audio._fadeInterval);
      } else {
        audio.volume = Math.min(targetVol, audio.volume + step);
      }
    }, stepTime);
  }

  fadeOut(audio, duration = 400) {
    if (!audio) return;
    clearInterval(audio._fadeInterval);

    const stepTime = 25;
    const current = audio.volume;
    const step = current / (duration / stepTime);

    audio._fadeInterval = setInterval(() => {
      if (audio.volume - step <= 0.02) {
        audio.volume = 0;
        audio.pause();
        clearInterval(audio._fadeInterval);
      } else {
        audio.volume = Math.max(0, audio.volume - step);
      }
    }, stepTime);
  }

  onUserScroll(direction) {
    if (!state.soundEnabled || this.isMuted) return;

    if (this.currentAudio && this.currentAudio.volume < 0.4 && !this.currentAudio.paused) {
      this.fadeIn(this.currentAudio, 0.75, 200);
    }

    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.currentAudio) {
        this.fadeOut(this.currentAudio, 600);
      }
    }, 1400);
  }

  stopAll() {
    clearTimeout(this.idleTimer);
    Object.values(this.players).forEach((a) => {
      clearInterval(a._fadeInterval);
      a.pause();
      a.volume = 0;
      a.currentTime = 0;
    });
    this.currentSceneId = null;
    this.currentAudio = null;
  }
}

const audioManager = new AudioManager();

// ==========================================================================
// Image Cache & Preloader (100% Reliable & Memory Optimized)
// ==========================================================================
const frameCache = new Map();
const requestedKeys = new Set();
let lastDrawnImg = null;

function getFrameKey(folder, frameNum) {
  return `${folder}/${frameNum}`;
}

function formatFrameNumber(num) {
  return String(num).padStart(4, '0');
}

function getFrameUrl(folder, frameNum) {
  return `/frames/${folder}/f_${formatFrameNumber(frameNum)}.webp`;
}

function loadSingleImage(folder, frameNum) {
  const key = getFrameKey(folder, frameNum);
  if (frameCache.has(key)) {
    return Promise.resolve(frameCache.get(key));
  }
  if (requestedKeys.has(key)) {
    return Promise.resolve(null);
  }

  requestedKeys.add(key);
  const img = new Image();
  img.src = getFrameUrl(folder, frameNum);

  return new Promise((resolve) => {
    img.onload = () => {
      frameCache.set(key, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
  });
}

function preloadUpcomingFrames(currentFolder, currentFrame) {
  for (let i = 1; i <= 25; i++) {
    loadSingleImage(currentFolder, currentFrame + i);
  }
}

function startIdlePreload() {
  const scenes = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
  let sIdx = 0;
  let fIdx = 1;

  function loadNextStep() {
    if (sIdx >= scenes.length) return;
    const folder = scenes[sIdx];
    const maxF = folder === 's4' ? 240 : (folder === 's5' ? 171 : (folder === 's6' || folder === 's7' ? 120 : 192));

    for (let i = 0; i < 8; i++) {
      if (fIdx <= maxF) {
        loadSingleImage(folder, fIdx);
        fIdx++;
      } else {
        sIdx++;
        fIdx = 1;
        break;
      }
    }

    if (window.requestIdleCallback) {
      window.requestIdleCallback(loadNextStep);
    } else {
      setTimeout(loadNextStep, 25);
    }
  }

  setTimeout(loadNextStep, 300);
}

// ==========================================================================
// Canvas Renderer (High-Performance 60FPS)
// ==========================================================================
let canvas = null;
let ctx = null;

function initCanvas() {
  canvas = document.getElementById('main-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d', { alpha: false });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  resizeCanvas();
}

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;

  const targetW = Math.min(Math.floor(w * dpr), 1920);
  const targetH = Math.min(Math.floor(h * dpr), 1080);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  if (lastDrawnImg) {
    drawDirect(lastDrawnImg);
  }
}

window.addEventListener('resize', resizeCanvas);

function drawDirect(img) {
  if (!ctx || !canvas || !img) return;
  lastDrawnImg = img;

  const cw = canvas.width;
  const ch = canvas.height;
  const iw = img.naturalWidth || img.width || 1600;
  const ih = img.naturalHeight || img.height || 900;

  if (cw <= 0 || ch <= 0 || iw <= 0 || ih <= 0) return;

  const scale = Math.max(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) * 0.5;
  const dy = (ch - dh) * 0.5;

  ctx.drawImage(img, dx, dy, dw, dh);
}

function renderSceneProgress(sceneIndex, sceneProgress) {
  const scene = SCENE_CONFIGS[sceneIndex];
  if (!scene) return;

  let folder = scene.folder;
  let targetFrame = 1;
  let total = scene.frameCount || 192;

  if (scene.reverse) {
    if (sceneProgress < 0.5) {
      folder = 's3';
      total = 192;
      const p = sceneProgress / 0.5;
      targetFrame = Math.max(1, Math.min(192, Math.round(192 - p * 191)));
    } else {
      folder = 's2';
      total = 192;
      const p = (sceneProgress - 0.5) / 0.5;
      targetFrame = Math.max(1, Math.min(192, Math.round(192 - p * 191)));
    }
  } else {
    targetFrame = Math.max(1, Math.min(total, Math.round(1 + sceneProgress * (total - 1))));
  }

  const key = getFrameKey(folder, targetFrame);
  const exactImg = frameCache.get(key);

  if (exactImg) {
    drawDirect(exactImg);
    preloadUpcomingFrames(folder, targetFrame);
    return;
  }

  loadSingleImage(folder, targetFrame).then((img) => {
    if (img && !lastDrawnImg) {
      drawDirect(img);
    }
  });

  preloadUpcomingFrames(folder, targetFrame);

  // Fast nearest-frame fallback during active scrub
  for (let offset = 1; offset <= 40; offset++) {
    const prev = frameCache.get(getFrameKey(folder, Math.max(1, targetFrame - offset)));
    if (prev) {
      drawDirect(prev);
      return;
    }
    const next = frameCache.get(getFrameKey(folder, Math.min(total, targetFrame + offset)));
    if (next) {
      drawDirect(next);
      return;
    }
  }

  if (lastDrawnImg) {
    drawDirect(lastDrawnImg);
  }
}

// ==========================================================================
// Smooth Lenis Scroll & Synced Audio Loop
// ==========================================================================
let lenis = null;
let targetProgress = 0;
let smoothProgress = 0;
let lastRenderVal = -1;
let prevSmoothProgress = 0;

function setupScroll() {
  lenis = new Lenis({
    duration: 1.0,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.5,
  });

  const progressLine = document.getElementById('progress-line');
  const sections = Array.from(document.querySelectorAll('.scene'));
  const totalScenes = SCENE_CONFIGS.length;

  lenis.on('scroll', ({ scroll, limit, direction }) => {
    const maxScroll = limit > 0 ? limit : (document.documentElement.scrollHeight - window.innerHeight);
    targetProgress = maxScroll > 0 ? Math.min(1, Math.max(0, scroll / maxScroll)) : 0;

    if (progressLine) {
      progressLine.style.width = `${targetProgress * 100}%`;
    }

    audioManager.onUserScroll(direction);
  });

  function raf(time) {
    lenis.raf(time);

    const diff = targetProgress - smoothProgress;
    const isMovingForward = smoothProgress >= prevSmoothProgress;
    prevSmoothProgress = smoothProgress;

    if (Math.abs(diff) > 0.00005) {
      smoothProgress += diff * 0.18;
    } else {
      smoothProgress = targetProgress;
    }

    const scaled = smoothProgress * (totalScenes - 0.0001);
    const sceneIdx = Math.min(totalScenes - 1, Math.floor(scaled));
    const sceneProg = smoothProgress >= 1 ? 1 : (scaled - sceneIdx);

    const renderVal = sceneIdx * 1000 + Math.round(sceneProg * 1000);
    if (renderVal !== lastRenderVal) {
      lastRenderVal = renderVal;
      renderSceneProgress(sceneIdx, sceneProg);
    }

    sections.forEach((sec, idx) => {
      const textEl = sec.querySelector('.scene-text');
      if (!textEl) return;

      if (idx === sceneIdx) {
        textEl.classList.add('active');
        if (sec.id === 'scene-3' && !state.statsAnimated) {
          animateStats();
        }
      } else {
        textEl.classList.remove('active');
      }
    });

    if (sceneIdx !== state.currentSceneIndex) {
      state.currentSceneIndex = sceneIdx;
      const config = SCENE_CONFIGS[sceneIdx];
      if (config && config.soundKey) {
        audioManager.playScene(config.soundKey, isMovingForward);
      }
    }

    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);
  lenis.resize();

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      lenis.scrollTo(window.scrollY + window.innerHeight * 0.8, { duration: 1.2 });
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      lenis.scrollTo(Math.max(0, window.scrollY - window.innerHeight * 0.8), { duration: 1.2 });
    }
  });
}

// ==========================================================================
// UI Helpers & Sound Toggle
// ==========================================================================
function updateSoundUI() {
  const soundWaves = document.getElementById('sound-waves');
  const soundSlash = document.getElementById('sound-slash');

  if (state.soundEnabled) {
    if (soundWaves) soundWaves.classList.remove('muted');
    if (soundSlash) soundSlash.classList.remove('muted');
  } else {
    if (soundWaves) soundWaves.classList.add('muted');
    if (soundSlash) soundSlash.classList.add('muted');
  }
}

function setLanguage(lang) {
  state.currentLang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  const langLabel = document.getElementById('lang-label');
  if (langLabel) {
    langLabel.textContent = lang === 'ar' ? 'EN' : 'AR';
  }

  const elements = document.querySelectorAll('[data-en][data-ar]');
  elements.forEach((el) => {
    const text = el.getAttribute(`data-${lang}`);
    if (text) {
      const hasChildrenWithData = el.querySelector('[data-en]');
      if (!hasChildrenWithData) {
        el.textContent = text;
      }
    }
  });
}

function animateStats() {
  state.statsAnimated = true;
  const statNumbers = document.querySelectorAll('.stat-num[data-target]');

  statNumbers.forEach((el) => {
    const target = parseFloat(el.getAttribute('data-target') || '0');
    const suffix = el.getAttribute('data-suffix') || '';
    const isDecimal = el.hasAttribute('data-decimal');
    const decimalPlaces = parseInt(el.getAttribute('data-decimal') || '0', 10);

    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate: () => {
        let displayVal;
        if (isDecimal) {
          const scaled = obj.val / Math.pow(10, decimalPlaces);
          displayVal = scaled.toFixed(decimalPlaces);
        } else {
          displayVal = Math.round(obj.val);
        }
        el.textContent = `${displayVal}${suffix}`;
      },
    });
  });
}

// ==========================================================================
// Main Bootloader
// ==========================================================================
function bootApp() {
  const loaderEl = document.getElementById('loader');
  const loaderFill = document.getElementById('loader-fill');
  const loaderPct = document.getElementById('loader-pct');

  const btnMute = document.getElementById('btn-mute');
  const btnLang = document.getElementById('btn-lang');

  initCanvas();
  updateSoundUI();

  function dismissLoader() {
    if (loaderEl && !loaderEl.classList.contains('fade-out')) {
      loaderEl.classList.add('fade-out');
    }
  }

  setTimeout(dismissLoader, 300);

  loadSingleImage('s1', 1).then((img) => {
    if (img) {
      drawDirect(img);
    }
    if (loaderFill) loaderFill.style.width = '100%';
    if (loaderPct) loaderPct.textContent = '100%';
    dismissLoader();
  }).catch(() => {
    dismissLoader();
  });

  for (let i = 2; i <= 25; i++) {
    loadSingleImage('s1', i);
  }

  startIdlePreload();
  setupScroll();

  const firstText = document.querySelector('#scene-1 .scene-text');
  if (firstText) {
    firstText.classList.add('active');
  }

  function unlockAudio() {
    if (state.soundInitialized) return;
    state.soundInitialized = true;
    audioManager.unlockAll();
    audioManager.playScene('scene-1', true);

    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('wheel', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  }

  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('wheel', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });

  if (btnMute) {
    btnMute.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      audioManager.isMuted = !state.soundEnabled;
      updateSoundUI();
      if (!state.soundEnabled) {
        audioManager.stopAll();
      } else {
        unlockAudio();
      }
    });
  }

  if (btnLang) {
    btnLang.addEventListener('click', () => {
      const nextLang = state.currentLang === 'en' ? 'ar' : 'en';
      setLanguage(nextLang);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
