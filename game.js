'use strict';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const FONT = '"Pixelify Sans","Courier New",monospace';
const INK = '#1a1420';
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const VK = 2 / 3; let UPS = 1; // VK: Stauchung des Bodens (Schrägsicht), UPS: Gegenstreckung für aufrechte Sprites
let W = 0, H = 0, Z = 1; // Z < 1: auf kleinen Bildschirmen herausgezoomt
function resize() { Z = Math.min(innerWidth, innerHeight) < 700 ? .75 : 1; W = cv.width = Math.round(innerWidth / Z); H = cv.height = Math.round(innerHeight / Z); ctx.imageSmoothingEnabled = false; }
addEventListener('resize', resize); resize();
function angDiff(a, b) { let d = (a - b + Math.PI) % TAU; if (d < 0) d += TAU; return Math.abs(d - Math.PI); }
function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return (h ^ (h >> 16)) >>> 0; }

// ================================================================ Einstellungen & Ton
const settings = { master: .7, music: .5, sfx: .8 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('animeSurvivorsSettings') || '{}')); } catch (e) { }
function saveSettings() { try { localStorage.setItem('animeSurvivorsSettings', JSON.stringify(settings)); } catch (e) { } }
const AU = {};
function initAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return;
  const a = AU.ctx = new AC();
  AU.master = a.createGain(); AU.mus = a.createGain(); AU.sfx = a.createGain();
  AU.mus.connect(AU.master); AU.sfx.connect(AU.master); AU.master.connect(a.destination);
  const buf = a.createBuffer(1, a.sampleRate, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  AU.noise = buf; AU.next = a.currentTime + .1; AU.step = 0;
  applyVolume(); setInterval(musicTick, 80);
}
function applyVolume() {
  if (!AU.ctx) return;
  AU.master.gain.value = settings.master; AU.mus.gain.value = settings.music * .6; AU.sfx.gain.value = settings.sfx;
}
function tone(dest, type, f0, f1, dur, vol, when) {
  const a = AU.ctx, o = a.createOscillator(), g = a.createGain(), t0 = when || a.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + .02);
}
function noise(dur, vol, freq, ftype) {
  const a = AU.ctx, s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(), t0 = a.currentTime;
  s.buffer = AU.noise; f.type = ftype || 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(AU.sfx); s.start(t0); s.stop(t0 + dur + .02);
}
const SFX = {
  shoot: [.07, () => tone(AU.sfx, 'square', 720, 320, .09, .10)],
  ball: [.07, () => { tone(AU.sfx, 'triangle', 300, 140, .09, .25); noise(.05, .15, 2500, 'highpass'); }],
  punch: [.07, () => { tone(AU.sfx, 'sine', 170, 50, .14, .45); noise(.07, .22, 900); }],
  slash: [.08, () => noise(.14, .28, 3200, 'highpass')],
  zap: [.08, () => { noise(.12, .22, 4200, 'highpass'); tone(AU.sfx, 'square', 1300, 240, .11, .09); }],
  fire: [.1, () => noise(.3, .3, 900, 'bandpass')],
  hit: [.05, () => noise(.05, .12, 1500)],
  boom: [.1, () => { noise(.35, .4, 500); tone(AU.sfx, 'sine', 110, 35, .3, .4); }],
  big: [.3, () => { noise(.8, .55, 380); tone(AU.sfx, 'sawtooth', 90, 28, .7, .35); }],
  beam: [.3, () => { tone(AU.sfx, 'sawtooth', 180, 520, .9, .16); tone(AU.sfx, 'sine', 360, 1040, .9, .14); }],
  freeze: [.3, () => { tone(AU.sfx, 'sine', 1400, 180, .9, .22); tone(AU.sfx, 'triangle', 700, 90, .9, .18); }],
  pickup: [.04, () => tone(AU.sfx, 'sine', 900, 1500, .06, .07)],
  heal: [.1, () => tone(AU.sfx, 'sine', 520, 780, .15, .2)],
  hurt: [.25, () => tone(AU.sfx, 'sawtooth', 210, 90, .16, .16)],
  click: [.03, () => tone(AU.sfx, 'square', 520, 780, .06, .12)],
  chest: [.2, () => [659, 784, 988, 1319].forEach((f, i) => tone(AU.sfx, 'triangle', f, 0, .2, .22, AU.ctx.currentTime + i * .06))],
  level: [.3, () => [523, 659, 784, 1047].forEach((f, i) => tone(AU.sfx, 'square', f, 0, .16, .13, AU.ctx.currentTime + i * .08))],
  evo: [.5, () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(AU.sfx, 'square', f, 0, .25, .14, AU.ctx.currentTime + i * .09))],
  over: [1, () => [392, 330, 262, 196].forEach((f, i) => tone(AU.sfx, 'triangle', f, 0, .32, .3, AU.ctx.currentTime + i * .22))],
};
const sfxLast = {};
function sfx(n) {
  if (!AU.ctx || !SFX[n]) return;
  const now = AU.ctx.currentTime; if (now - (sfxLast[n] || -9) < SFX[n][0]) return;
  sfxLast[n] = now; SFX[n][1]();
}
const CHORDS = [[110, 220, 261.63, 329.63, 440], [87.31, 174.61, 220, 261.63, 349.23], [130.81, 261.63, 329.63, 392, 523.25], [98, 196, 246.94, 293.66, 392]];
const ARP = [0, 1, 2, 1, 3, 2, 1, 2];
function musicTick() {
  const a = AU.ctx, sd = 60 / 116 / 4;
  if (AU.next < a.currentTime - .5) AU.next = a.currentTime + .05;
  while (AU.next < a.currentTime + .25) {
    const s = AU.step % 16, ch = CHORDS[Math.floor(AU.step / 16) % 4];
    if (s % 4 === 0) tone(AU.mus, 'triangle', ch[0], 0, sd * 3.5, .5, AU.next);
    if (s % 2 === 0) tone(AU.mus, 'square', ch[1 + ARP[s / 2]], 0, sd * 1.6, .09, AU.next);
    if (s === 4 || s === 12) tone(AU.mus, 'triangle', ch[0] * 2, 0, sd * 1.5, .22, AU.next);
    AU.next += sd; AU.step++;
  }
}

// ================================================================ Pixel-Sprites
const SW = 32, SH = 48, OY = 6, PS = 2;
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = Math.min(255, (n >> 16) * f) | 0, g = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}
function outline(c, col) {
  const w = c.width, h = c.height, g = c.getContext('2d'), img = g.getImageData(0, 0, w, h), d = img.data, a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  g.fillStyle = col || INK;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a[y * w + x]) continue;
    if ((x > 0 && a[y * w + x - 1]) || (x < w - 1 && a[y * w + x + 1]) || (y > 0 && a[(y - 1) * w + x]) || (y < h - 1 && a[(y + 1) * w + x])) g.fillRect(x, y, 1, 1);
  }
}
function tinted(src, col) {
  const c = mk(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  return c;
}
function buildFrame(L, f, atk) {
  const c = mk(SW, SH), g = c.getContext('2d');
  const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y + OY, w, h); };
  const lx = [0, -2, 0, 2][f], b = (f & 1) ? -1 : 0, as = [0, 1, 0, -1][f];
  const sk = L.skin, WH = '#f4f4f4', GOLD = '#e8c53a', h = L.hair || '#000000', hd = L.hair ? shade(L.hair, .7) : '#000', hl = L.hair ? shade(L.hair, 1.35) : '#fff';
  // --- Rücken
  if (L.cape) { r(8, 21 + b, 16, 14, L.cape); r(7 + (f & 1), 28 + b, 1, 7, L.cape); r(24 - (f & 1), 28 + b, 1, 7, L.cape); r(8, 34 + b, 16, 2, shade(L.cape, .8)); }
  if (L.sword) { for (let i = 0; i < 13; i++) { r(2 + i, 9 + i * 2 + b, 5, 3, '#2a2d36'); r(2 + i, 9 + i * 2 + b, 2, 3, '#dfe6ee'); } r(1, 6 + b, 3, 4, '#f0ece0'); }
  // --- Beine
  const leg = (x, dx) => {
    if (L.shorts) { r(x + dx, 31, 4, 3, L.pants); r(x + dx, 34, 4, 3, sk); if (!L.boots && !L.mon) r(x + dx, 34, 4, 1, '#eeeeee'); }
    else r(x + dx, 31, 4, 6, L.pants);
    if (L.boots) r(x + dx, 34, 4, 3, L.shoes);
    r(x + dx, 37, 5, 2, L.shoes); r(x + dx, 38, 5, 1, shade(L.shoes, .75));
  };
  leg(11, lx); leg(17, -lx);
  // --- Arm hinten
  const top = L.sleeve || L.shirt;
  const arm = (x, dy) => {
    r(x, 22 + b + dy, 3, 6, L.bare ? sk : top);
    if (L.shortSleeve) { r(x, 22 + b + dy, 3, 3, top); r(x, 25 + b + dy, 3, 3, sk); }
    if (L.armStripe) r(x + 1, 22 + b + dy, 1, 6, L.armStripe);
    if (L.wrist) r(x, 26 + b + dy, 3, 2, L.wrist);
    r(x, 28 + b + dy, 3, 2, L.glove || sk);
    if (L.claw) r(x - 1, 27 + b + dy, 5, 4, L.claw);
  };
  arm(7, as);
  if (L.blades && !atk) r(8, 30 + b + as, 1, 7, '#d8e0e8');
  // --- Körper
  r(10, 21 + b, 12, 10, L.shirt);
  switch (L.id) {
    case 'gojo': r(11, 19 + b, 10, 3, L.shirt); r(15, 22 + b, 1, 9, '#2c3463'); r(15, 24 + b, 2, 1, '#c9a13a'); break;
    case 'saitama': r(10, 29 + b, 12, 2, '#1a1a1a'); r(15, 29 + b, 2, 2, GOLD); r(16, 22 + b, 1, 7, shade(L.shirt, .8)); r(10, 21 + b, 12, 1, WH); break;
    case 'ichigo': r(14, 21 + b, 1, 2, WH); r(17, 21 + b, 1, 2, WH); r(15, 21 + b, 2, 2, sk); r(15, 23 + b, 2, 2, WH); r(10, 29 + b, 12, 2, '#eeeeee'); for (let i = 0; i < 5; i++) r(11 + i * 2, 22 + b + i, 2, 1, '#8c2f24'); break;
    case 'goku': r(13, 21 + b, 6, 2, '#2a4fb0'); r(15, 21 + b, 2, 1, sk); r(10, 29 + b, 12, 2, '#2a4fb0'); r(12, 24 + b, 2, 2, WH); break;
    case 'vegeta': r(10, 21 + b, 12, 7, WH); r(12, 26 + b, 8, 3, GOLD); r(10, 21 + b, 2, 3, GOLD); r(20, 21 + b, 2, 3, GOLD); r(14, 21 + b, 4, 1, L.shirt); break;
    case 'levi': r(14, 21 + b, 4, 10, WH); r(13, 21 + b, 6, 3, '#ffffff'); r(13, 23 + b, 6, 1, '#cfcfd6'); r(10, 26 + b, 12, 1, '#3a2a1a'); r(10, 30 + b, 12, 1, '#3a2a1a'); break;
    case 'eren': r(10, 21 + b, 12, 2, L.cape); r(14, 23 + b, 4, 8, '#e9e2d0'); r(10, 30 + b, 12, 1, '#3a2a1a'); break;
    case 'hinata': r(10, 21 + b, 1, 10, '#f58a1f'); r(21, 21 + b, 1, 10, '#f58a1f'); r(14, 21 + b, 4, 1, '#f58a1f'); r(13, 24 + b, 1, 4, WH); r(15, 24 + b, 3, 4, WH); r(16, 25 + b, 1, 2, L.shirt); break;
    case 'kageyama': r(10, 21 + b, 1, 10, '#f58a1f'); r(21, 21 + b, 1, 10, '#f58a1f'); r(14, 21 + b, 4, 1, '#f58a1f'); r(14, 24 + b, 3, 3, WH); r(15, 25 + b, 1, 1, L.shirt); r(16, 27 + b, 1, 2, WH); break;
    case 'naruto': r(10, 21 + b, 12, 3, '#1a1a22'); r(13, 21 + b, 6, 2, '#f4f4f4'); r(16, 23 + b, 1, 8, '#1a1a22'); r(10, 30 + b, 12, 1, '#c9601a'); break;
    case 'sasuke': r(14, 21 + b, 4, 5, sk); r(13, 21 + b, 1, 5, '#b9b6c4'); r(18, 21 + b, 1, 5, '#b9b6c4'); r(10, 27 + b, 12, 3, '#6a4aa0'); r(14, 29 + b, 4, 2, '#8a68c8'); break;
    case 'jotaro': r(14, 21 + b, 4, 10, '#3a8a94'); r(11, 22 + b, 2, 1, GOLD); r(12, 23 + b, 1, 3, GOLD); r(10, 29 + b, 12, 1, GOLD); r(10, 30 + b, 12, 1, '#c0392b'); break;
    case 'dio': r(13, 21 + b, 6, 10, '#1a1a22'); r(15, 22 + b, 2, 2, '#3aa04a'); r(10, 29 + b, 12, 2, '#3aa04a'); r(15, 29 + b, 2, 2, GOLD); break;
    case 'gon': r(10, 21 + b, 12, 1, '#d04030'); r(15, 21 + b, 2, 10, '#d04030'); r(13, 21 + b, 6, 1, WH); break;
    case 'killua': r(13, 21 + b, 6, 2, '#2a3a7a'); r(10, 30 + b, 12, 1, '#d8d8e0'); break;
    case 'sukuna': r(15, 21 + b, 2, 4, sk); r(14, 21 + b, 1, 5, '#1a1a22'); r(17, 21 + b, 1, 5, '#1a1a22'); r(10, 29 + b, 12, 2, '#1a1a22'); break;
    case 'garou': r(10, 29 + b, 12, 2, GOLD); r(13, 21 + b, 6, 1, sk); break;
    case 'aizen': r(15, 21 + b, 2, 8, '#1a1a22'); r(13, 21 + b, 6, 1, '#1a1a22'); r(10, 29 + b, 12, 2, '#7a4aa8'); break;
    case 'frieza': r(13, 23 + b, 6, 4, '#7a3ab0'); r(14, 24 + b, 2, 1, '#b080e0'); r(10, 21 + b, 3, 3, '#7a3ab0'); r(19, 21 + b, 3, 3, '#7a3ab0'); break;
    case 'zeke': r(15, 21 + b, 2, 10, '#c8bc98'); r(10, 27 + b, 12, 1, '#3a2a1a'); r(19, 22 + b, 3, 2, '#c0392b'); break;
    case 'oikawa': r(10, 21 + b, 1, 10, '#2ab0a0'); r(21, 21 + b, 1, 10, '#2ab0a0'); r(14, 21 + b, 4, 1, '#2ab0a0'); r(15, 24 + b, 2, 4, '#2ab0a0'); r(14, 25 + b, 1, 1, '#2ab0a0'); break;
    case 'pain': r(11, 24 + b, 4, 3, '#c0202a'); r(11, 24 + b, 4, 1, WH); r(17, 27 + b, 4, 3, '#c0202a'); r(17, 27 + b, 4, 1, WH); r(15, 21 + b, 2, 2, '#c0202a'); break;
    case 'kira': r(14, 21 + b, 4, 5, '#3a8a5a'); r(15, 21 + b, 2, 7, '#2a2a3a'); r(15, 24 + b, 2, 2, WH); break;
    case 'hisoka': r(10, 29 + b, 12, 2, '#e860a0'); r(11, 23 + b, 3, 3, '#c0202a'); r(18, 24 + b, 3, 3, '#1a1a22'); break;
    case 'ana': for (let y = 22; y < 35; y++) { const x0 = y >= 29 ? 9 : 10, x1 = y >= 29 ? 23 : 22; for (let x = x0; x < x1; x++) r(x, y + b, 1, 1, ((x >> 1) + (y >> 1)) & 1 ? '#1a1a22' : WH); }
      r(10, 21 + b, 12, 1, sk); r(11, 21 + b, 1, 1, '#1a1a22'); r(20, 21 + b, 1, 1, '#1a1a22'); r(10, 22 + b, 12, 1, '#1a1a22'); r(15, 21 + b, 2, 1, '#e8e8f0');
      r(6, 28 + b, 4, 5, '#1a1a22'); r(7, 30 + b, 1, 1, GOLD); break;
    case 'nam': for (let i = 0; i < 4; i++) { r(14, 22 + b + i * 2, 4, 1, '#f0ece0'); r(16, 22 + b + i * 2, 1, 1, '#c8c0a8'); } r(10, 30 + b, 12, 1, WH); r(12, 21 + b, 8, 1, shade(L.shirt, 1.3)); break;
    case 'jinwoo': r(14, 21 + b, 4, 7, '#2e2e42'); r(13, 21 + b, 1, 9, '#3a3a52'); r(18, 21 + b, 1, 9, '#3a3a52'); r(10, 29 + b, 12, 1, '#3a3a52'); r(15, 22 + b, 2, 1, '#6a9aff'); break;
    case 'beru': r(11, 22 + b, 10, 1, '#6a58a0'); r(11, 25 + b, 10, 1, '#6a58a0'); r(12, 28 + b, 8, 1, '#6a58a0'); r(15, 22 + b, 2, 8, '#16102a'); r(8, 20 + b, 4, 3, '#4a3a72'); r(20, 20 + b, 4, 3, '#4a3a72'); break;
    case 'cell': r(12, 22 + b, 8, 6, '#1a1a22'); r(13, 23 + b, 6, 1, '#3a3a48'); r(10, 24 + b, 1, 1, '#2f6a22'); r(21, 26 + b, 1, 1, '#2f6a22'); r(10, 28 + b, 1, 1, '#2f6a22'); r(10, 29 + b, 12, 2, '#1a1a22'); r(8, 20 + b, 4, 3, '#1a1a22'); r(20, 20 + b, 4, 3, '#1a1a22'); break;
    case 'kakashi': r(12, 21 + b, 8, 1, '#3a5a2e'); r(11, 23 + b, 3, 2, '#3a5a2e'); r(18, 23 + b, 3, 2, '#3a5a2e'); r(15, 22 + b, 1, 8, '#2a4a22'); r(10, 29 + b, 12, 1, '#22284a'); break;
    case 'doffy': r(14, 21 + b, 4, 8, sk); r(15, 24 + b, 2, 1, shade(sk, .8)); r(10, 29 + b, 12, 2, '#7a3ab0'); r(6, 19 + b, 6, 5, '#f06aa8'); r(20, 19 + b, 6, 5, '#f06aa8'); r(6, 19 + b, 6, 1, '#ff9ac8'); r(20, 19 + b, 6, 1, '#ff9ac8'); r(7, 23 + b, 1, 2, '#c84a88'); r(24, 23 + b, 1, 2, '#c84a88'); break;
    case 'koku': r(11, 23 + b, 2, 2, '#2a1a4a'); r(15, 25 + b, 2, 2, '#2a1a4a'); r(19, 23 + b, 2, 2, '#2a1a4a'); r(12, 27 + b, 2, 2, '#2a1a4a'); r(18, 27 + b, 2, 2, '#2a1a4a'); r(15, 21 + b, 2, 3, '#f0ece0'); r(14, 21 + b, 1, 4, '#3a2466'); r(17, 21 + b, 1, 4, '#3a2466'); r(10, 29 + b, 12, 2, '#18161e'); break;
    case 'buggy': r(10, 23 + b, 12, 1, '#d02828'); r(10, 25 + b, 12, 1, '#d02828'); r(10, 27 + b, 12, 1, '#d02828'); r(10, 29 + b, 12, 2, '#d8b020'); break;
    case 'akaza': r(10, 21 + b, 3, 8, '#8a3a8a'); r(19, 21 + b, 3, 8, '#8a3a8a'); r(13, 24 + b, 6, 1, '#2a4a9a'); r(13, 27 + b, 6, 1, '#2a4a9a'); r(15, 22 + b, 2, 1, '#2a4a9a'); r(10, 29 + b, 12, 2, '#c84a6a'); break;
    case 'igris': r(10, 21 + b, 12, 1, GOLD); r(11, 23 + b, 10, 4, '#a01c2c'); r(12, 23 + b, 8, 1, '#e85a68'); r(15, 23 + b, 2, 6, '#2e0810'); r(10, 29 + b, 12, 2, '#16060a'); r(15, 29 + b, 2, 2, GOLD); r(7, 20 + b, 5, 3, '#c8283a'); r(20, 20 + b, 5, 3, '#c8283a'); r(7, 20 + b, 5, 1, GOLD); r(20, 20 + b, 5, 1, GOLD); break;
    case 'toji': r(10, 29 + b, 12, 2, '#101014'); r(15, 23 + b, 1, 5, '#2a2a34'); r(12, 24 + b, 3, 1, '#2a2a34'); r(17, 24 + b, 3, 1, '#2a2a34'); r(19, 17 + b, 6, 5, '#8a6a9a'); r(21, 18 + b, 1, 1, WH); r(23, 18 + b, 1, 1, WH); r(20, 21 + b, 4, 1, '#5a3a6a'); break;
    case 'madara': r(10, 21 + b, 12, 2, '#a82828'); r(10, 24 + b, 5, 3, '#a82828'); r(17, 24 + b, 5, 3, '#a82828'); r(10, 28 + b, 12, 2, '#8a1e1e'); r(10, 23 + b, 12, 1, '#5a1010'); r(10, 27 + b, 12, 1, '#5a1010'); r(8, 20 + b, 3, 4, '#a82828'); r(21, 20 + b, 3, 4, '#a82828'); break;
    default: if (L.tie) { r(14, 21 + b, 4, 6, WH); r(15, 21 + b, 2, 7, '#c0392b'); } else if (L.stripe) r(10, 25 + b, 12, 2, L.stripe);
  }
  if (L.mon === 'hollow') { r(13, 23 + b, 6, 6, '#6a6878'); r(14, 24 + b, 4, 4, '#08080c'); }
  else if (L.mon === 'armored') { r(10, 21 + b, 12, 2, '#f0dcae'); r(10, 25 + b, 12, 1, '#8a5a2a'); r(15, 23 + b, 1, 8, '#8a5a2a'); }
  else if (L.mon === 'titan') { r(13, 24 + b, 6, 1, shade(sk, .85)); r(15, 25 + b, 1, 5, shade(sk, .85)); }
  else if (L.mon === 'celljr') r(12, 22 + b, 8, 6, '#1a1a2a');
  r(19, 21 + b, 3, 10, 'rgba(0,0,0,.16)'); r(10, 21 + b, 12, 1, 'rgba(0,0,0,.18)');
  // --- Arm vorn
  if (atk || L.armsOut) { r(22, 23 + b, 6, 3, (L.bare || L.shortSleeve) ? sk : top); r(28, 22 + b, 3, 4, L.glove || sk); }
  else { arm(22, -as); if (L.blades) r(23, 30 + b - as, 1, 7, '#d8e0e8'); }
  // --- Kopf
  const hy = 6 + b;
  r(10, hy, 12, 15, sk); r(9, hy + 1, 14, 13, sk); r(8, hy + 2, 16, 11, sk);
  r(10, hy + 14, 12, 1, shade(sk, .82)); r(22, hy + 3, 2, 9, shade(sk, .9));
  const cap = n => { r(10, hy - 1, 12, 1, h); r(9, hy, 14, 1, h); r(8, hy + 1, 16, n, h); r(12, hy, 5, 1, hl); };
  const spike = (x, w, n) => { for (let i = 0; i < n; i++) { const ww = Math.max(1, w - Math.floor(i * w / n)); r(x + ((w - ww) >> 1), hy - 2 - i, ww, 1, h); } };
  // --- Gesicht
  if (L.mon) { /* Monster-Gesicht folgt nach den Haaren */ } else if (L.face === 'saitama') {
    r(12, hy + 7, 3, 2, '#ffffff'); r(18, hy + 7, 3, 2, '#ffffff'); r(13, hy + 7, 1, 1, '#111111'); r(19, hy + 7, 1, 1, '#111111');
    r(12, hy + 5, 3, 1, '#3a2a1a'); r(18, hy + 5, 3, 1, '#3a2a1a'); r(15, hy + 11, 4, 1, '#3a2a1a');
  } else if (!L.noEyes) {
    r(13, hy + 7, 2, 3, L.eye || '#1a1a22'); r(19, hy + 7, 2, 3, L.eye || '#1a1a22'); r(13, hy + 7, 1, 1, '#ffffff'); r(19, hy + 7, 1, 1, '#ffffff');
    if (L.scowl) { r(12, hy + 5, 3, 1, hd); r(14, hy + 6, 1, 1, hd); r(19, hy + 5, 3, 1, hd); r(19, hy + 6, 1, 1, hd); }
    if (L.smile) r(15, hy + 11, 4, 2, '#8a2a2a'); else r(16, hy + 12, 2, 1, shade(sk, .6));
    if (L.whisk) { const wc = shade(sk, .6); r(9, hy + 10, 3, 1, wc); r(9, hy + 12, 3, 1, wc); r(21, hy + 10, 2, 1, wc); r(21, hy + 12, 2, 1, wc); }
  } else r(16, hy + 12, 3, 1, shade(sk, .6));
  // --- Haare
  switch (L.hairStyle) {
    case 'short': cap(3); r(8, hy + 4, 2, 4, h); r(22, hy + 4, 2, 2, h); break;
    case 'long': cap(3); r(7, hy + 3, 3, 13, h); r(22, hy + 3, 3, 13, h); r(10, hy + 4, 4, 1, h); break;
    case 'cap': cap(3); r(20, hy + 3, 8, 2, hd); break;
    case 'bald': r(13, hy + 1, 3, 1, '#ffffff'); r(12, hy + 2, 1, 1, '#ffffff'); break;
    case 'spikeUp': cap(2); spike(8, 4, 3); spike(11, 4, 5); spike(14, 4, 6); spike(18, 4, 5); spike(21, 3, 3);
      r(8, hy + 5, 16, 5, '#101018'); r(8, hy + 6, 16, 1, '#2c2c40'); break;
    case 'spikeMessy': cap(3); spike(7, 4, 3); spike(10, 4, 4); spike(14, 4, 5); spike(18, 4, 4); spike(21, 4, 3);
      r(6, hy + 2, 2, 3, h); r(24, hy + 2, 2, 3, h); r(10, hy + 4, 2, 2, h); r(14, hy + 4, 2, 1, h); r(19, hy + 4, 3, 2, h); break;
    case 'goku': cap(3); spike(9, 4, 4); spike(13, 5, 5); spike(18, 4, 3);
      r(5, hy + 1, 3, 2, h); r(3, hy + 2, 3, 2, h); r(4, hy + 5, 4, 2, h); r(2, hy + 6, 3, 1, h);
      r(24, hy, 3, 2, h); r(26, hy - 1, 3, 2, h); r(24, hy + 4, 3, 2, h); r(26, hy + 5, 2, 1, h);
      r(11, hy + 4, 3, 2, h); r(12, hy + 6, 1, 1, h); r(17, hy + 4, 3, 2, h); r(18, hy + 6, 1, 1, h); break;
    case 'vegeta': cap(2); r(9, hy - 3, 14, 3, h); r(10, hy - 6, 12, 3, h); r(11, hy - 8, 10, 2, h); r(12, hy - 10, 8, 2, h); r(13, hy - 11, 2, 1, h); r(17, hy - 11, 2, 1, h);
      r(12, hy - 8, 1, 7, hl); r(14, hy + 3, 4, 1, h); r(15, hy + 4, 2, 1, h); r(8, hy + 3, 2, 3, h); r(22, hy + 3, 2, 3, h); break;
    case 'curtain': cap(3); r(8, hy + 4, 6, 3, h); r(18, hy + 4, 6, 3, h); r(8, hy + 7, 2, 2, hd); r(22, hy + 7, 2, 2, hd); break;
    case 'messy': cap(3); spike(12, 4, 2); spike(17, 3, 2); r(8, hy + 4, 3, 5, h); r(21, hy + 4, 3, 4, h); r(11, hy + 4, 2, 2, h); r(14, hy + 4, 3, 1, h); r(18, hy + 4, 2, 2, h); break;
    case 'fluffy': r(9, hy - 2, 14, 2, h); r(7, hy, 18, 1, h); r(6, hy + 1, 20, 4, h); r(10, hy - 3, 3, 1, h); r(15, hy - 4, 4, 2, h); r(20, hy - 3, 2, 1, h);
      r(5, hy + 2, 2, 3, h); r(25, hy + 2, 2, 3, h); r(8, hy + 5, 3, 2, h); r(13, hy + 5, 2, 1, h); r(17, hy + 5, 3, 1, h); r(21, hy + 5, 3, 2, h); r(11, hy - 1, 6, 1, hl);
      if (L.id === 'killua') { r(9, hy + 2, 2, 2, '#c4c8dc'); r(15, hy + 1, 2, 2, '#c4c8dc'); r(21, hy + 3, 2, 1, '#c4c8dc'); } break;
    case 'bangs': cap(3); r(8, hy + 4, 16, 2, h); r(15, hy + 6, 2, 1, h); r(8, hy + 6, 2, 4, h); r(22, hy + 6, 2, 4, h); break;
    case 'sasuke': cap(3); spike(9, 4, 3); spike(13, 4, 2); r(8, hy + 4, 3, 8, h); r(21, hy + 4, 3, 8, h); r(11, hy + 4, 3, 2, h); r(18, hy + 4, 3, 2, h);
      r(5, hy, 3, 2, h); r(3, hy - 1, 3, 2, h); r(5, hy + 3, 3, 2, h); r(3, hy + 4, 2, 1, h); break;
    case 'jcap': cap(3); r(6, hy + 2, 2, 6, h); r(8, hy + 4, 2, 5, h); r(16, hy + 3, 10, 2, '#3a3658'); r(12, hy + 1, 2, 2, GOLD); break;
    case 'dio': cap(3); r(5, hy, 3, 3, h); r(4, hy + 3, 3, 3, h); r(6, hy + 6, 2, 3, h); r(10, hy + 4, 2, 1, h); r(19, hy + 4, 3, 1, h); spike(10, 4, 2); spike(15, 4, 3); r(14, hy + 3, 4, 2, '#3aa04a'); break;
    case 'gon': cap(3); spike(8, 4, 6); spike(11, 4, 9); spike(14, 4, 11); spike(18, 4, 9); spike(21, 3, 6); r(15, hy - 9, 1, 7, '#2f6a44'); r(12, hy - 6, 1, 4, '#2f6a44'); break;
    case 'garou': cap(3); spike(7, 6, 7); spike(19, 6, 7); r(11, hy + 4, 2, 2, h); r(19, hy + 4, 2, 2, h); break;
    case 'frieza': r(12, hy, 8, 4, h); r(11, hy + 1, 10, 2, h); r(13, hy + 1, 3, 1, hl); break;
    case 'ana': cap(3); r(7, hy + 2, 3, 13, h); r(22, hy + 2, 3, 13, h); r(6, hy + 6, 1, 3, h); r(25, hy + 6, 1, 3, h); r(6, hy + 11, 1, 4, h); r(25, hy + 11, 1, 4, h); r(8, hy + 15, 3, 2, h); r(21, hy + 15, 3, 2, h); r(10, hy + 4, 3, 1, h); r(19, hy + 4, 3, 1, h); r(8, hy + 8, 1, 4, hl); break;
    case 'nam': cap(3); spike(10, 6, 2); spike(17, 4, 2); r(8, hy + 4, 16, 2, h); r(9, hy + 6, 4, 1, h); r(15, hy + 6, 2, 1, h); r(19, hy + 6, 4, 1, h); r(8, hy + 6, 2, 3, h); r(22, hy + 6, 2, 3, h); break;
    case 'cell': r(8, hy - 1, 16, 4, h); r(8, hy - 6, 3, 6, h); r(21, hy - 6, 3, 6, h); r(9, hy - 8, 1, 2, h); r(22, hy - 8, 1, 2, h); r(13, hy, 6, 2, '#1a1a22'); r(9, hy - 3, 1, 1, '#2f6a22'); r(22, hy - 2, 1, 1, '#2f6a22'); r(11, hy + 1, 1, 1, '#2f6a22'); break;
    case 'kakashi': cap(3); spike(6, 4, 6); spike(9, 5, 8); spike(14, 5, 7); spike(19, 4, 4); r(4, hy - 3, 3, 5, h); r(8, hy - 4, 1, 6, hl); break;
    case 'koku': cap(3); spike(9, 4, 3); spike(14, 4, 4); spike(19, 4, 3); r(4, hy, 4, 4, h); r(2, hy + 3, 4, 14, h); r(1, hy + 14, 3, 8, h); r(3, hy + 4, 1, 14, '#a02030'); r(10, hy + 4, 3, 2, h); r(19, hy + 4, 3, 2, h); break;
    case 'buggy': r(5, hy + 3, 3, 7, h); r(24, hy + 3, 3, 7, h); r(4, hy + 8, 2, 3, h); r(26, hy + 8, 2, 3, h); r(8, hy - 2, 16, 4, '#e8842a'); r(10, hy - 5, 12, 3, '#e8842a'); r(8, hy + 1, 16, 1, '#b05a18'); r(14, hy - 4, 4, 3, WH); r(15, hy - 3, 1, 1, '#1a1a22'); r(17, hy - 3, 1, 1, '#1a1a22'); break;
    case 'plume': r(13, hy - 4, 5, 4, h); r(5, hy - 2, 9, 3, h); r(3, hy + 1, 4, 13, h); r(2, hy + 12, 3, 9, h); r(4, hy + 2, 1, 10, hl); break;
    case 'madara': cap(3); spike(8, 4, 4); spike(13, 5, 5); spike(19, 4, 4); r(5, hy + 1, 4, 18, h); r(3, hy + 6, 3, 14, h); r(23, hy + 1, 4, 16, h); r(26, hy + 6, 2, 10, h); r(17, hy + 4, 6, 6, h); r(10, hy + 4, 3, 2, h); r(6, hy + 3, 1, 12, hl); break;
    case 'flame': cap(2); r(9, hy - 3, 14, 3, h); r(11, hy - 6, 11, 3, h); r(14, hy - 8, 8, 2, h); r(17, hy - 10, 4, 2, h); r(12, hy - 5, 1, 6, hl); r(8, hy + 3, 2, 3, h); r(22, hy + 3, 2, 3, h); break;
  }
  // --- Monster-Gesichter & Bösewicht-Details
  const sd = shade(sk, .6), sl = shade(sk, 1.25), DK = '#15121c', BONE = '#f0ece0';
  const ey = (y, w, hh, col, pc) => { r(12, hy + y, w, hh, col); r(18, hy + y, w, hh, col); if (pc) { r(13, hy + y + (hh >> 1), 1, 1, pc); r(19, hy + y + (hh >> 1), 1, 1, pc); } };
  const teeth = (y, x0, n) => { for (let i = 0; i < n; i++) r(x0 + i * 2, hy + y, 1, 1, WH); };
  switch (L.mon || L.id) {
    case 'saiba': ey(6, 3, 3, '#d02020', '#ffb0b0'); r(14, hy + 11, 5, 1, sd); r(11, hy + 1, 1, 3, sl); r(15, hy, 1, 4, sl); r(20, hy + 1, 1, 3, sl); break;
    case 'zetsu': ey(7, 3, 2, '#e8d040', '#222222'); r(12, hy + 11, 9, 2, DK); teeth(11, 13, 4); break;
    case 'zombie': ey(7, 2, 2, '#f0e050'); r(14, hy + 11, 5, 2, '#3a1010'); r(15, hy + 11, 1, 1, WH); r(17, hy + 12, 1, 1, WH); r(19, hy + 12, 1, 3, '#a01818'); r(10, hy + 5, 3, 1, sd); r(21, hy + 9, 2, 1, sd); break;
    case 'curse': r(11, hy + 4, 3, 2, WH); r(12, hy + 4, 1, 2, DK); r(18, hy + 5, 3, 2, WH); r(19, hy + 5, 1, 2, DK); r(14, hy + 1, 3, 2, WH); r(15, hy + 1, 1, 2, DK); r(10, hy + 9, 13, 4, '#2a0a2a'); teeth(9, 11, 6); teeth(12, 12, 5); break;
    case 'eye': r(11, hy + 3, 11, 8, WH); r(14, hy + 4, 5, 6, '#c02838'); r(15, hy + 5, 3, 4, DK); r(15, hy + 5, 1, 1, WH); r(13, hy + 12, 7, 1, sd); break;
    case 'hollow': r(9, hy + 1, 14, 12, BONE); r(10, hy + 13, 12, 2, BONE); ey(5, 3, 3, DK, '#ffd23c'); r(11, hy + 11, 11, 1, DK); for (let i = 0; i < 5; i++) r(12 + i * 2, hy + 12, 1, 2, DK); r(15, hy + 1, 2, 3, '#c0392b'); break;
    case 'menos': r(10, hy + 2, 12, 11, BONE); r(15, hy + 9, 2, 9, BONE); ey(5, 3, 2, DK); r(11, hy + 11, 4, 1, DK); r(17, hy + 11, 4, 1, DK); for (let i = 0; i < 6; i++) r(8 + i * 3, hy + 16, 1, 3, BONE); break;
    case 'titan': ey(6, 3, 3, WH, DK); r(11, hy + 10, 11, 3, WH); r(11, hy + 11, 11, 1, '#6a1a1a'); for (let i = 0; i < 5; i++) r(12 + i * 2, hy + 10, 1, 3, '#b8b0a8'); break;
    case 'armored': r(8, hy, 16, 5, '#f0dcae'); r(9, hy - 1, 14, 1, '#f0dcae'); r(8, hy + 5, 16, 1, '#8a5a2a'); ey(7, 3, 2, '#ffe45a'); r(10, hy + 10, 12, 4, '#f0e6cc'); for (let i = 0; i < 6; i++) r(10 + i * 2, hy + 10, 1, 4, '#8a5a2a'); break;
    case 'celljr': r(10, hy - 1, 12, 4, '#1a1a2a'); r(8, hy - 4, 3, 6, sk); r(21, hy - 4, 3, 6, sk); r(9, hy - 6, 1, 2, sk); r(22, hy - 6, 1, 2, sk); ey(7, 3, 2, '#e060b0', DK); r(15, hy + 12, 4, 1, DK); r(10, hy + 6, 1, 1, sd); r(21, hy + 7, 1, 1, sd); break;
    case 'ant': r(11, hy - 5, 1, 6, DK); r(9, hy - 6, 3, 1, DK); r(20, hy - 5, 1, 6, DK); r(20, hy - 6, 3, 1, DK); r(10, hy + 4, 5, 6, '#c02828'); r(17, hy + 4, 5, 6, '#c02828'); r(11, hy + 5, 1, 1, '#ff9a9a'); r(18, hy + 5, 1, 1, '#ff9a9a'); r(13, hy + 12, 2, 3, DK); r(17, hy + 12, 2, 3, DK); break;
    case 'crab': r(11, hy - 5, 2, 6, sk); r(19, hy - 5, 2, 6, sk); r(10, hy - 8, 4, 4, WH); r(18, hy - 8, 4, 4, WH); r(12, hy - 7, 1, 2, DK); r(20, hy - 7, 1, 2, DK); r(12, hy + 8, 8, 3, '#5a1010'); teeth(8, 13, 3); r(9, hy + 3, 3, 1, sl); r(20, hy + 3, 3, 1, sl); break;
    case 'vaccine': r(9, hy - 6, 2, 7, sk); r(7, hy - 8, 2, 3, sk); r(21, hy - 6, 2, 7, sk); r(23, hy - 8, 2, 3, sk); ey(6, 4, 2, '#ffe14a', DK); r(12, hy + 10, 9, 3, '#2a0a2a'); r(13, hy + 10, 1, 2, WH); r(19, hy + 10, 1, 2, WH); r(15, hy + 12, 1, 1, WH); r(17, hy + 12, 1, 1, WH); break;
    case 'sukuna': r(9, hy + 9, 3, 1, DK); r(20, hy + 9, 3, 1, DK); r(9, hy + 11, 2, 1, DK); r(21, hy + 11, 2, 1, DK); r(15, hy + 5, 2, 1, DK); break;
    case 'aizen': r(15, hy + 4, 1, 3, h); break;
    case 'igris': r(8, hy, 16, 6, '#a01c2c'); r(9, hy - 1, 14, 1, '#a01c2c'); r(10, hy, 6, 1, '#e85a68'); r(8, hy + 5, 16, 1, GOLD); r(9, hy + 6, 14, 3, '#0c0406'); r(11, hy + 7, 3, 1, '#ff8a8a'); r(18, hy + 7, 3, 1, '#ff8a8a'); r(9, hy + 9, 14, 6, '#8a1624'); r(15, hy + 9, 2, 6, '#3a0a12'); r(11, hy + 11, 3, 1, '#3a0a12'); r(18, hy + 11, 3, 1, '#3a0a12'); r(11, hy + 13, 3, 1, '#3a0a12'); r(18, hy + 13, 3, 1, '#3a0a12'); r(15, hy - 2, 2, 3, GOLD); break;
    case 'jinwoo': r(12, hy + 8, 1, 1, '#b0d0ff'); r(21, hy + 8, 1, 1, '#b0d0ff'); break;
    case 'beru': r(11, hy - 6, 1, 7, '#16102a'); r(9, hy - 7, 3, 1, '#16102a'); r(20, hy - 6, 1, 7, '#16102a'); r(20, hy - 7, 3, 1, '#16102a'); r(10, hy + 5, 5, 5, '#c81838'); r(17, hy + 5, 5, 5, '#c81838'); r(11, hy + 6, 2, 1, '#ff9aa8'); r(18, hy + 6, 2, 1, '#ff9aa8'); r(13, hy + 12, 2, 3, '#16102a'); r(17, hy + 12, 2, 3, '#16102a'); r(9, hy + 1, 14, 2, '#5a4a8a'); break;
    case 'cell': r(9, hy + 8, 1, 5, '#8a4ab0'); r(22, hy + 8, 1, 5, '#8a4ab0'); r(15, hy + 12, 3, 1, '#3a3a48'); break;
    case 'kakashi': r(8, hy + 3, 16, 3, '#22306a'); r(12, hy + 3, 7, 3, '#c9d0da'); r(17, hy + 5, 7, 4, '#22306a'); r(9, hy + 10, 14, 5, '#22284a'); r(10, hy + 14, 12, 1, '#161a34'); break;
    case 'doffy': r(10, hy + 6, 12, 1, WH); r(11, hy + 7, 4, 2, '#7a2a8a'); r(17, hy + 7, 4, 2, '#7a2a8a'); r(12, hy + 7, 1, 1, '#c88ad8'); r(18, hy + 7, 1, 1, '#c88ad8'); r(12, hy + 11, 8, 2, WH); r(12, hy + 12, 8, 1, '#8a2a2a'); break;
    case 'koku': for (const y of [4, 7, 10]) { r(12, hy + y, 3, 2, '#f0d040'); r(18, hy + y, 3, 2, '#f0d040'); r(13, hy + y, 1, 2, '#c02020'); r(19, hy + y, 1, 2, '#c02020'); } r(9, hy + 3, 2, 4, '#a02030'); r(21, hy + 9, 2, 4, '#a02030'); r(15, hy + 13, 3, 1, sd); break;
    case 'buggy': r(13, hy + 4, 1, 3, '#3a6ad0'); r(19, hy + 4, 1, 3, '#3a6ad0'); r(14, hy + 8, 4, 4, '#e02020'); r(15, hy + 8, 1, 1, '#ff9a9a'); r(11, hy + 12, 10, 2, '#a01818'); r(12, hy + 12, 8, 1, WH); break;
    case 'akaza': r(9, hy + 9, 3, 1, '#2a4a9a'); r(20, hy + 9, 3, 1, '#2a4a9a'); r(9, hy + 11, 2, 1, '#2a4a9a'); r(21, hy + 11, 2, 1, '#2a4a9a'); r(15, hy + 3, 2, 2, '#2a4a9a'); break;
    case 'toji': r(19, hy + 11, 1, 3, '#b06a5a'); r(15, hy + 12, 4, 1, '#8a4a40'); break;
    case 'madara': r(13, hy + 10, 2, 1, sd); r(12, hy + 11, 1, 1, sd); break;
    case 'ana': r(11, hy + 10, 2, 1, '#f09a9a'); r(20, hy + 10, 2, 1, '#f09a9a'); break;
    case 'zeke': r(9, hy + 10, 14, 4, h); r(10, hy + 14, 12, 1, h); r(14, hy + 11, 5, 1, '#8a2a2a'); r(11, hy + 6, 5, 4, '#3a3a44'); r(18, hy + 6, 5, 4, '#3a3a44'); r(12, hy + 7, 3, 2, '#d8ecf8'); r(19, hy + 7, 3, 2, '#d8ecf8'); r(13, hy + 8, 1, 1, DK); r(20, hy + 8, 1, 1, DK); r(16, hy + 7, 2, 1, '#3a3a44'); break;
    case 'pain': r(11, hy + 10, 1, 1, DK); r(21, hy + 10, 1, 1, DK); r(15, hy + 9, 1, 2, DK); r(18, hy + 9, 1, 2, DK); r(15, hy + 13, 1, 1, DK); r(18, hy + 13, 1, 1, DK); break;
    case 'hisoka': r(11, hy + 10, 2, 2, '#e860a0'); r(20, hy + 10, 1, 3, '#30b0a0'); break;
    case 'frieza': r(9, hy + 9, 2, 3, '#7a3ab0'); r(21, hy + 9, 2, 3, '#7a3ab0'); r(15, hy + 12, 3, 1, '#3a1a4a'); break;
  }
  if (L.band) { r(8, hy + 3, 16, 3, L.band); r(12, hy + 3, 8, 3, '#c9d0da'); r(15, hy + 4, 2, 1, '#6a7080'); }
  bevel(c); outline(c);
  return { n: c, w: tinted(c, 'rgba(255,255,255,.85)'), z: tinted(c, 'rgba(110,70,230,.55)') };
}
const frameCache = new Map();
function frames(L) {
  let fr = frameCache.get(L);
  if (!fr) { fr = [[0, 1, 2, 3].map(f => buildFrame(L, f, false)), L.hero ? [0, 1, 2, 3].map(f => buildFrame(L, f, true)) : null]; frameCache.set(L, fr); }
  return fr;
}
const FLIP = new Map();
function flipped(img) { let f = FLIP.get(img); if (!f) { f = mk(img.width, img.height); const q = f.getContext('2d'); q.translate(img.width, 0); q.scale(-1, 1); q.drawImage(img, 0, 0); FLIP.set(img, f); } return f; }
const BLOB = (() => { const c = mk(32, 32), q = c.getContext('2d'), gr = q.createRadialGradient(16, 16, 4, 16, 16, 16); gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(.7, 'rgba(0,0,0,.26)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = gr; q.fillRect(0, 0, 32, 32); return c; })();
function drawChar(c, L, x, y, sc, face, animT, moving, atk, mode) {
  const fr = frames(L), f = moving ? Math.floor(animT * 9) % 4 : 0;
  const img = ((atk && fr[1]) ? fr[1] : fr[0])[f][mode || 'n'];
  // direkt zeichnen (gespiegelte Bilder liegen vor), das spart pro Figur drei Zustandswechsel
  const u = c === ctx ? UPS : 1, w = SW * sc;
  c.drawImage(face < 0 ? flipped(img) : img, Math.round(x) - w / 2, Math.round(y) - (SH - 2) * sc * u, w, SH * sc * u);
}

// ================================================================ Charaktere
const CHARS = {
  gojo: { name: 'Gojo Satoru', anime: 'Jujutsu Kaisen', tag: 'jjk', hp: 90, speed: 210, cd: .85, weapon: 'Rot', wdesc: 'Fernkampf: rote Kugeln, die explodieren',
    perk: 'Unendlichkeit: immun gegen Fernangriffe', init(p) { p.rangedImmune = true; } },
  sukuna: { name: 'Ryomen Sukuna', anime: 'Jujutsu Kaisen', tag: 'jjk', villain: true, hp: 105, speed: 215, cd: .75, weapon: 'Zerlegen', wdesc: 'Nahkampf: unsichtbare Schnitte in weitem Bogen',
    perk: 'König der Flüche: +20% Schaden, 10% kritische Treffer', init(p) { p.dmgMul = 1.2; p.crit = .1; } },
  saitama: { name: 'Saitama', anime: 'One Punch Man', tag: 'opm', hp: 130, speed: 200, cd: 1.0, weapon: 'Rote Faust', wdesc: 'Nahkampf: große rote Faust mit Rückstoß',
    perk: '+50% Nahkampfschaden', init(p) { p.meleeMul = 1.5; } },
  garou: { name: 'Garou', anime: 'One Punch Man', tag: 'opm', villain: true, hp: 115, speed: 225, cd: .24, weapon: 'Felsbrecherfaust', wdesc: 'Nahkampf: fließende Schlagserie nach vorn',
    perk: 'Heldenjäger: +20% Angriffstempo, +10% Nahkampfschaden', init(p) { p.rate = 1.2; p.meleeMul = 1.1; } },
  ichigo: { name: 'Ichigo Kurosaki', anime: 'Bleach', tag: 'bl', hp: 110, speed: 215, cd: .8, weapon: 'Zangetsu', wdesc: 'Nahkampf: weiter Schwertschlag im Bogen',
    perk: '+50% EXP', init(p) { p.xpMul = 1.5; } },
  aizen: { name: 'Sosuke Aizen', anime: 'Bleach', tag: 'bl', villain: true, hp: 100, speed: 205, cd: 1.0, weapon: 'Raikoho', wdesc: 'Fernkampf: Kido-Blitz, der zwischen Gegnern überspringt',
    perk: 'Hogyoku: 15% weniger Schaden, +1 Leben pro Sekunde', init(p) { p.armor = .85; p.regen += 1; } },
  goku: { name: 'Son Goku', anime: 'Dragon Ball Z', tag: 'dbz', hp: 110, speed: 210, cd: .45, weapon: 'Ki-Blast', wdesc: 'Fernkampf: schnelle Ki-Kugeln, die durchschlagen',
    perk: 'Saiyajin-Blut: +3% Schaden pro Level', init(p) { p.lvlDmg = .03; } },
  vegeta: { name: 'Vegeta', anime: 'Dragon Ball Z', tag: 'dbz', hp: 100, speed: 205, cd: .26, weapon: 'Dauerfeuer', wdesc: 'Fernkampf: Sperrfeuer aus vielen kleinen Ki-Kugeln',
    perk: 'Saiyajin-Stolz: bis +80% Schaden bei wenig Leben', init(p) { p.pride = .8; } },
  frieza: { name: 'Freezer', anime: 'Dragon Ball Z', tag: 'dbz', villain: true, hp: 85, speed: 215, cd: .6, weapon: 'Todesstrahl', wdesc: 'Fernkampf: dünner Strahl, der alles durchbohrt',
    perk: 'Tyrann: +25% Schaden', init(p) { p.dmgMul = 1.25; } },
  levi: { name: 'Levi Ackerman', anime: 'Attack on Titan', tag: 'aot', hp: 85, speed: 235, cd: .7, weapon: 'Wirbelschnitt', wdesc: 'Nahkampf: Klingenwirbel, der rundum trifft',
    perk: 'Stärkster Soldat: +30% Angriffstempo', init(p) { p.rate = 1.3; } },
  eren: { name: 'Eren Yeager', anime: 'Attack on Titan', tag: 'aot', hp: 140, speed: 200, cd: 1.1, weapon: 'Titanenfaust', wdesc: 'Nahkampf: Titanenschlag mit Flächenschaden',
    perk: 'Titanen-Regeneration: +1,5 Leben pro Sekunde', init(p) { p.regen += 1.5; } },
  zeke: { name: 'Zeke Yeager', anime: 'Attack on Titan', tag: 'aot', villain: true, hp: 120, speed: 200, cd: 1.05, weapon: 'Steinhagel', wdesc: 'Fernkampf: Streuwurf aus zermahlenen Felsbrocken',
    perk: 'Königliches Blut: +20% EXP, +20% Sammelradius', init(p) { p.xpMul = 1.2; p.magnet *= 1.2; } },
  hinata: { name: 'Shoyo Hinata', anime: 'Haikyu!!', tag: 'hq', hp: 90, speed: 265, cd: .8, weapon: 'Schmetterball', wdesc: 'Fernkampf: Ball springt von Gegner zu Gegner',
    perk: 'Sprungkraft: +25% Lauftempo, +30% Sammelradius', init(p) { p.magnet *= 1.3; } },
  kageyama: { name: 'Tobio Kageyama', anime: 'Haikyu!!', tag: 'hq', hp: 100, speed: 210, cd: 1.0, weapon: 'Sprungaufschlag', wdesc: 'Fernkampf: Aufschlag, der die ganze Reihe durchschlägt',
    perk: 'König des Feldes: 25% kritische Treffer (x2)', init(p) { p.crit = .25; } },
  oikawa: { name: 'Toru Oikawa', anime: 'Haikyu!!', tag: 'hq', villain: true, hp: 95, speed: 220, cd: 1.05, weapon: 'Killeraufschlag', wdesc: 'Fernkampf: Aufschlag, der beim Einschlag explodiert',
    perk: 'Großkönig: +10% Schaden, +10% Angriffstempo', init(p) { p.dmgMul = 1.1; p.rate = 1.1; } },
  naruto: { name: 'Naruto Uzumaki', anime: 'Naruto', tag: 'nar', hp: 115, speed: 215, cd: .7, weapon: 'Shuriken', wdesc: 'Fernkampf: Wurfsterne, die durchschlagen',
    perk: 'Neunschwänziger: 1x Wiederbelebung mit vollem Leben', init(p) { p.revives = 1; p.reviveFull = true; } },
  sasuke: { name: 'Sasuke Uchiha', anime: 'Naruto', tag: 'nar', hp: 100, speed: 220, cd: 1.0, weapon: 'Feuerkugel', wdesc: 'Fernkampf: große Flamme, die alles durchdringt',
    perk: 'Sharingan: 20% weniger Schaden, 10% kritische Treffer', init(p) { p.armor = .8; p.crit = .1; } },
  pain: { name: 'Pain', anime: 'Naruto', tag: 'nar', villain: true, hp: 110, speed: 205, cd: 1.4, weapon: 'Shinra Tensei', wdesc: 'Druckwelle rundum, die alle Gegner wegschleudert',
    perk: 'Rinnegan: +25% Flächengröße, +30% Sammelradius', init(p) { p.area = 1.25; p.magnet *= 1.3; } },
  jotaro: { name: 'Jotaro Kujo', anime: 'JoJo', tag: 'jojo', hp: 120, speed: 205, cd: .2, weapon: 'Ora-Ora', wdesc: 'Nahkampf: Star Platinums Faustregen nach vorn',
    perk: 'Präzision: 15% kritische Treffer, +15% Flächengröße', init(p) { p.crit = .15; p.area = 1.15; } },
  dio: { name: 'DIO', anime: 'JoJo', tag: 'jojo', hp: 110, speed: 210, cd: .34, weapon: 'Muda-Muda', wdesc: 'Nahkampf: The Worlds schwere Schlagserie',
    perk: 'Vampir: +0,6 Leben pro besiegtem Gegner', init(p) { p.leech = .6; } },
  kira: { name: 'Yoshikage Kira', anime: 'JoJo', tag: 'jojo', villain: true, hp: 100, speed: 210, cd: 1.1, weapon: 'Killer Queen', wdesc: 'Fernkampf: Bombe mit großer Explosion',
    perk: 'Bites the Dust: 1x Wiederbelebung, 15% kritische Treffer', init(p) { p.revives = 1; p.crit = .15; } },
  gon: { name: 'Gon Freecss', anime: 'Hunter x Hunter', tag: 'hxh', hp: 120, speed: 215, cd: 1.5, weapon: 'Jajanken', wdesc: 'Nahkampf: aufgeladener Schlag mit riesigem Rückstoß',
    perk: 'Potenzial: +2% Schaden und +3 max. Leben pro Level', init(p) { p.lvlDmg = .02; p.lvlHp = 3; } },
  killua: { name: 'Killua Zoldyck', anime: 'Hunter x Hunter', tag: 'hxh', hp: 90, speed: 240, cd: .9, weapon: 'Donnerschlag', wdesc: 'Fernkampf: Blitz, der zwischen Gegnern überspringt',
    perk: 'Assassine: +15% Lauftempo, +15% Angriffstempo', init(p) { p.rate = 1.15; } },
  hisoka: { name: 'Hisoka Morow', anime: 'Hunter x Hunter', tag: 'hxh', villain: true, hp: 100, speed: 230, cd: .6, weapon: 'Kartenwurf', wdesc: 'Fernkampf: Fächer aus scharfen Spielkarten',
    perk: 'Bungee Gum: +50% Sammelradius, 20% kritische Treffer', init(p) { p.magnet *= 1.5; p.crit = .2; } },
  jinwoo: { name: 'Sung Jinwoo', anime: 'Solo Leveling', tag: 'sl', hp: 105, speed: 225, cd: .6, weapon: 'Dämonenkönig-Dolche', wdesc: 'Nahkampf: schnelle Dolchhiebe in weitem Bogen',
    perk: 'Erhebe dich: 12% der besiegten Gegner kämpfen 8 s als Schatten für dich', init(p) { p.arise = .12; } },
  beru: { name: 'Beru', anime: 'Solo Leveling', tag: 'sl', villain: true, hp: 125, speed: 235, cd: .26, weapon: 'Klauenhagel', wdesc: 'Nahkampf: rasende Klauenhiebe nach vorn',
    perk: 'Gefräßig: +0,5 Leben pro besiegtem Gegner, +15% Angriffstempo', init(p) { p.leech = .5; p.rate = 1.15; } },
  ana: { name: 'Ana', anime: 'Chiikawa World', tag: 'chi', hp: 112, speed: 258, cd: .55, weapon: 'Sushi', wdesc: 'Fernkampf: Nigiri, Maki und Sashimi, die durchschlagen',
    perk: '+100% Fernkampfschaden, 50% Schadensminderung · +20% auf alle Werte · Phönix: steht einmal wieder auf und vernichtet alle Gegner im Umfeld', init(p) { p.rangedMul = 2; p.armor = .5; boost20(p); } },
  nam: { name: 'Nam', anime: 'Unlimited Studium', tag: 'uni', villain: true, hp: 448, speed: 126, cd: .22, weapon: 'Hantelwirbel', wdesc: 'Nahkampf: Hanteln, die um ihn kreisen',
    perk: '-50% Lauftempo, +200% Leben, +100% Lebensregeneration · +20% auf alle Werte · Phönix: steht einmal wieder auf und vernichtet alle Gegner im Umfeld', init(p) { p.regenMul = 2; boost20(p); } },
};
const LOOK = {
  gojo: { id: 'gojo', skin: '#f6d9c4', shirt: '#1b2040', pants: '#1b2040', shoes: '#0b0d1a', hairStyle: 'spikeUp', hair: '#f5f7fa', noEyes: true },
  saitama: { id: 'saitama', skin: '#f3cfae', shirt: '#f4d21f', pants: '#f4d21f', shoes: '#d5202a', boots: true, glove: '#d5202a', cape: '#f4f4f4', hairStyle: 'bald', face: 'saitama' },
  ichigo: { id: 'ichigo', skin: '#f1c9a5', shirt: '#1a1a22', pants: '#1a1a22', shoes: '#d9cfb0', hairStyle: 'spikeMessy', hair: '#f58a1f', sword: true, scowl: true, eye: '#5a3210' },
  goku: { id: 'goku', skin: '#f3c9a0', shirt: '#f0751a', pants: '#f0751a', shoes: '#2a4fb0', boots: true, hairStyle: 'goku', hair: '#16161c', bare: true, wrist: '#2a4fb0' },
  vegeta: { id: 'vegeta', skin: '#f0c39a', shirt: '#24408f', pants: '#24408f', shoes: '#f2f2f2', boots: true, glove: '#f2f2f2', hairStyle: 'vegeta', hair: '#16161c', scowl: true },
  levi: { id: 'levi', skin: '#f4dccb', shirt: '#a67c4e', pants: '#f1f1f1', shoes: '#3a2a1a', boots: true, hairStyle: 'curtain', hair: '#1c1c24', scowl: true, eye: '#3a4658', blades: true },
  eren: { id: 'eren', skin: '#eec39d', shirt: '#b89462', pants: '#f1f1f1', shoes: '#4a3320', boots: true, hairStyle: 'messy', hair: '#5a3d28', cape: '#3f7a4a', sleeve: '#3f7a4a', eye: '#2f9a7a' },
  hinata: { id: 'hinata', skin: '#f6d3b3', shirt: '#1a1a1f', pants: '#1a1a1f', shoes: '#f2f2f2', shorts: true, shortSleeve: true, hairStyle: 'fluffy', hair: '#f07d1a', eye: '#8a4a12', smile: true },
  kageyama: { id: 'kageyama', skin: '#f2cfae', shirt: '#1a1a1f', pants: '#1a1a1f', shoes: '#f2f2f2', shorts: true, shortSleeve: true, hairStyle: 'bangs', hair: '#16161f', scowl: true, eye: '#2a3a6a' },
  naruto: { id: 'naruto', skin: '#f5cfa5', shirt: '#f07a1a', pants: '#f07a1a', shoes: '#22263a', hairStyle: 'spikeMessy', hair: '#f7d43a', eye: '#2a6fd0', band: '#22306a', whisk: true },
  sasuke: { id: 'sasuke', skin: '#f3dccb', shirt: '#d9d6e0', pants: '#2a2c44', shoes: '#22263a', hairStyle: 'sasuke', hair: '#1a1a2a', scowl: true, wrist: '#1a1a22' },
  jotaro: { id: 'jotaro', skin: '#eec6a0', shirt: '#2a2540', pants: '#2a2540', shoes: '#1a1a22', hairStyle: 'jcap', hair: '#1c1a2a', scowl: true, eye: '#2a8a8a', cape: '#2a2540' },
  dio: { id: 'dio', skin: '#f6dcc0', shirt: '#f2c61e', pants: '#f2c61e', shoes: '#2a2a2a', hairStyle: 'dio', hair: '#f4de6a', eye: '#c0392b', scowl: true, wrist: '#3aa04a' },
  gon: { id: 'gon', skin: '#f3cba0', shirt: '#3f9a4a', pants: '#3f9a4a', shoes: '#2f7a3a', boots: true, shorts: true, hairStyle: 'gon', hair: '#1c2a22', eye: '#6a3a12', smile: true },
  killua: { id: 'killua', skin: '#f8e2d2', shirt: '#f2f2f5', sleeve: '#2a3a7a', pants: '#5a6a9a', shoes: '#4a3a8a', shorts: true, hairStyle: 'fluffy', hair: '#f0f2f8', eye: '#3a6ad0' },
  // Bösewichte
  sukuna: { id: 'sukuna', skin: '#f3cfae', shirt: '#f0ece4', pants: '#f0ece4', shoes: '#1a1a22', hairStyle: 'spikeMessy', hair: '#e88aa0', eye: '#c0202a', scowl: true, smile: true },
  garou: { id: 'garou', skin: '#f0c8a2', shirt: '#1a1a22', pants: '#e8e4d8', shoes: '#1a1a22', hairStyle: 'garou', hair: '#dfe2ea', eye: '#d8b020', scowl: true },
  aizen: { id: 'aizen', skin: '#f2d2b4', shirt: '#f2f0ea', pants: '#f2f0ea', shoes: '#1a1a22', hairStyle: 'short', hair: '#5a3a22', eye: '#5a3210' },
  frieza: { id: 'frieza', skin: '#f4f0f8', shirt: '#f4f0f8', pants: '#f4f0f8', shoes: '#d8d0e8', boots: true, bare: true, wrist: '#7a3ab0', hairStyle: 'frieza', hair: '#7a3ab0', eye: '#c0202a', scowl: true },
  zeke: { id: 'zeke', skin: '#f0c8a2', shirt: '#e8e0c8', pants: '#e8e0c8', shoes: '#3a2a1a', boots: true, hairStyle: 'short', hair: '#d8c070', noEyes: true },
  oikawa: { id: 'oikawa', skin: '#f6d3b3', shirt: '#f2f2f2', pants: '#f2f2f2', shoes: '#f2f2f2', shorts: true, shortSleeve: true, hairStyle: 'messy', hair: '#6a4a30', eye: '#6a3a12', smile: true },
  pain: { id: 'pain', skin: '#eed8c8', shirt: '#1a1a22', pants: '#1a1a22', shoes: '#22263a', cape: '#1a1a22', hairStyle: 'spikeMessy', hair: '#f08020', eye: '#a080d0' },
  kira: { id: 'kira', skin: '#f3d6ba', shirt: '#b8a0d8', pants: '#b8a0d8', shoes: '#3a2a4a', hairStyle: 'short', hair: '#e8d890', eye: '#3a6ad0' },
  jinwoo: { id: 'jinwoo', skin: '#f2d6c2', shirt: '#14141c', pants: '#14141c', shoes: '#0c0c12', cape: '#14141c', hairStyle: 'messy', hair: '#14141c', eye: '#6a9aff', scowl: true, blades: true },
  beru: { id: 'beru', skin: '#3a2a5a', shirt: '#241a3c', pants: '#241a3c', shoes: '#16102a', bare: true, cape: '#5a7ac8', claw: '#b02040', noEyes: true },
  ana: { id: 'ana', skin: '#f0c8a4', shirt: '#f4f4f4', pants: '#f0c8a4', shoes: '#1a1a22', bare: true, hairStyle: 'ana', hair: '#1c1620', eye: '#3a2210', smile: true },
  nam: { id: 'nam', skin: '#e8c09a', shirt: '#1f3550', pants: '#16161c', shoes: '#f2f2f2', armStripe: '#f0ece0', hairStyle: 'nam', hair: '#1a1a20', eye: '#1a1a22', scowl: true },
  hisoka: { id: 'hisoka', skin: '#f8e8e0', shirt: '#f0e8f0', pants: '#f0e8f0', shoes: '#7a3ab0', boots: true, bare: true, wrist: '#e860a0', hairStyle: 'flame', hair: '#d8284a', eye: '#e8c020', smile: true },
};
for (const k in LOOK) LOOK[k].hero = true;

// ================================================================ Gegner
const ET = {
  walker: { hp: 12, sp: 60, r: 12, dmg: 5, xp: 1, s: 1, mass: 1 },
  jogger: { hp: 8, sp: 105, r: 10, dmg: 4.5, xp: 1, s: .9, mass: .8 },
  thrower: { hp: 10, sp: 68, r: 12, dmg: 4, xp: 2, s: 1, mass: 1 },
  tank: { hp: 65, sp: 44, r: 18, dmg: 10, xp: 5, s: 1.5, mass: 3 },
  boss: { hp: 864, sp: 62, r: 30, dmg: 17, xp: 60, s: 2.5, mass: 12 },
};
// Monster aus den Anime; Haikyu!! hat keine Monster und stellt deshalb keine Gegner.
const mon = (kind, name, skin, o) => Object.assign({ id: 'mon', mon: kind, name, skin, shirt: skin, pants: skin, shoes: skin, bare: true }, o);
const ELOOKS = {
  walker: [
    mon('zetsu', 'Weißer Zetsu', '#f2f2ea', { hairStyle: 'short', hair: '#3f8a4a' }),
    mon('saiba', 'Saibaman', '#6aa83a', { shoes: '#3a6a22' }),
    mon('zombie', 'Zombie', '#8aa088', { hairStyle: 'short', hair: '#2a2420', shirt: '#5a4a6a', pants: '#3a3440', shoes: '#2a2a2a', bare: false, shortSleeve: true, armsOut: true }),
    mon('curse', 'Fluchgeist', '#7a4aa8', { claw: '#4a2a6a' }),
  ],
  jogger: [
    mon('ant', 'Chimera-Ameise', '#8a9a4a', { shirt: '#4a3a2a', stripe: '#6a5638', pants: '#4a3a2a', shoes: '#2a2018' }),
    mon('celljr', 'Cell Jr.', '#5ab0e0', { shoes: '#e8c040', wrist: '#1a1a2a' }),
  ],
  thrower: [
    mon('hollow', 'Hollow', '#22202a', { shotCol: ['#e03a4a', '#ffb0b8'] }),
    mon('eye', 'Fluchgeist', '#4a8a7a', { shotCol: ['#a060e0', '#e6ccff'] }),
  ],
  tank: [
    mon('titan', 'Titan', '#e8b890', { hairStyle: 'short', hair: '#4a3422' }),
    mon('titan', 'Titan', '#dcae88', { hairStyle: 'long', hair: '#d8b45a' }),
    mon('crab', 'Krabbenmonster', '#d84030', { shorts: true, pants: '#f0f0f0', claw: '#b02820' }),
  ],
  boss: [
    mon('armored', 'Gepanzerter Titan', '#d8b070', { hairStyle: 'short', hair: '#e8d080' }),
    mon('vaccine', 'Vaccine Man', '#7a3ab0', { claw: '#4a1a7a' }),
    mon('menos', 'Menos Grande', '#15151c', { cape: '#15151c' }),
  ],
};

// ================================================================ Welt-Grafik
const GT = 64, GS = 3, TILE = GT * GS;
const ground = mk(GT, GT);
(function () {
  const g = ground.getContext('2d'); let s = 12345;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  g.fillStyle = '#5aa652'; g.fillRect(0, 0, GT, GT);
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(((x % GT) + GT) % GT, ((y % GT) + GT) % GT, 1, 1); };
  for (let i = 0; i < 26; i++) { const x = rnd() * GT | 0, y = rnd() * GT | 0, c = rnd() < .5 ? '#4f9a4c' : '#63b25a'; for (let k = 0; k < 9; k++) px(x + (rnd() * 6 | 0), y + (rnd() * 4 | 0), c); }
  for (let i = 0; i < 42; i++) { const x = rnd() * GT | 0, y = rnd() * GT | 0; px(x, y, '#3f8a44'); px(x + 1, y - 1, '#3f8a44'); px(x + 2, y, '#3f8a44'); px(x + 1, y, '#74c069'); }
  for (let i = 0; i < 4; i++) { const x = rnd() * GT | 0, y = rnd() * GT | 0, c = ['#ffffff', '#ffe45a', '#ff9ac0'][i % 3]; px(x, y, c); px(x + 1, y + 1, c); px(x - 1, y + 1, c); px(x, y + 2, c); px(x, y + 1, '#f0a020'); }
})();
function disc(g, cx, cy, rx, ry, col) { g.fillStyle = col; for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) g.fillRect(cx + x, cy + y, 1, 1); }
function pix(g, rows, x, y, s, cols) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const c = cols[rows[j][i]]; if (c) { g.fillStyle = c; g.fillRect(x + i * s, y + j * s, s, s); } } }
const DECOR = {};
(function () {
  let c = mk(34, 44), g = c.getContext('2d');
  g.fillStyle = '#6a4a2a'; g.fillRect(14, 26, 6, 15); g.fillStyle = '#4f361e'; g.fillRect(18, 26, 2, 15);
  disc(g, 17, 16, 14, 13, '#2f7a3c'); disc(g, 15, 13, 11, 9, '#3c9148'); disc(g, 12, 10, 6, 4, '#58b05c'); disc(g, 22, 22, 5, 3, '#255f30');
  outline(c); DECOR.tree = c;
  c = mk(20, 14); g = c.getContext('2d'); disc(g, 10, 8, 8, 5, '#2f7a3c'); disc(g, 8, 6, 5, 3, '#4aa252'); g.fillStyle = '#e0404a'; g.fillRect(5, 8, 2, 2); g.fillRect(12, 6, 2, 2); g.fillRect(14, 10, 2, 2);
  outline(c); DECOR.bush = c;
  c = mk(18, 13); g = c.getContext('2d'); disc(g, 9, 7, 7, 4, '#8c8f98'); disc(g, 7, 5, 4, 2, '#b3b6c0'); g.fillStyle = '#6c6f78'; g.fillRect(4, 10, 11, 1);
  outline(c); DECOR.rock = c;
  c = mk(20, 18); g = c.getContext('2d');
  pix(g, ['  bbbbbbbbbbbbbb  ', ' bBBBBBgBBgBBBBBb ', 'bBBBBBBgBBgBBBBBBb', 'bBBBBBBgBBgBBBBBBb', 'gggggggggggggggggg', 'bddddddgyygddddddb', 'bDDDDDDgyygDDDDDDb', 'bDDDDDDgggGDDDDDDb', 'bDDDDDDgDDgDDDDDDb', 'bDDDDDDgDDgDDDDDDb', 'bDDDDDDgDDgDDDDDDb', 'gggggggggggggggggg', ' bbbbbbbbbbbbbbbb '],
    1, 2, 1, { b: '#5a3418', B: '#a8683a', D: '#8a5028', d: '#6a3c1c', g: '#e8c53a', G: '#b8962a', y: '#fff2a0' });
  outline(c); DECOR.chest = c;
})();
const ICONS = {
  heart: [[' rr rr ', 'rRrrrrr', 'rrrrrrr', ' rrrrr ', '  rrr  ', '   r   '], { r: '#e83a4a', R: '#ffb0b8' }],
  exp: [['   b   ', '  bBb  ', ' bBbbb ', 'bBbbbbb', ' bbbbd ', '  bbd  ', '   d   '], { b: '#59c8ff', B: '#e0f6ff', d: '#2a7ac0' }],
  magnet: [['ww   ww', 'rr   rr', 'rr   rr', 'rr   rr', 'rrr rrr', ' rrrrr ', '  rrr  '], { r: '#e83a4a', w: '#f4f4f4' }],
  bomb: [['    y  ', '   o   ', '  kkk  ', ' kKkkk ', ' kkkkk ', ' kkkkk ', '  kkk  '], { k: '#2a2a36', K: '#8a8aa0', o: '#c08a3a', y: '#ffe45a' }],
};
function drawIcon(kind, x, y, s) {
  const [rows, cols] = ICONS[kind], w = rows[0].length * s, h = rows.length * s;
  ctx.fillStyle = INK; for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] !== ' ') ctx.fillRect(x - w / 2 + i * s - s * .4, y - h / 2 + j * s - s * .4, s * 1.8, s * 1.8);
  pix(ctx, rows, x - w / 2, y - h / 2, s, cols);
}

// ================================================================ Zustand
let state = 'main', lastKind = 'gojo';
let p = null, enemies = [], shots = [], eshots = [], gems = [], fx = [], texts = [], timers = [], parts = [], chests = [], allies = [];
let t = 0, kills = 0, spawnT = 0, nextBoss = 150, pending = 0, shake = 0, chestT = 18, flash = 0;

function newGame(kind) {
  const c = CHARS[kind]; lastKind = kind;
  p = { kind, x: 0, y: 0, r: 14, hp: c.hp + 20, maxHp: c.hp + 20, speed: c.speed, face: 1, moving: false, animT: 0, atkT: 0, aim: 0, hurtT: 0, orb: 0, inv: 0, renT: 0, dashT: 0, dashCd: 0, mvx: 0, mvy: 0, buf: [0, 0, 0], rerolls: 5,
    level: 1, xp: 0, xpNext: 5, magnet: 75, dmgMul: 1, rate: 1, meleeMul: 1, rangedMul: 1, regenMul: 1, xpMul: 1, armor: 1, regen: .4, crit: 0, lvlDmg: 0, lvlHp: 0, pride: 0, area: 1, leech: 0, revives: 0,
    rangedImmune: false, wLvl: 1, wT: .5, ab: {}, abT: {}, up: {}, used: {} };
  c.init(p); resetWorld(); runBalls = 0; newPet();
  enemies = []; shots = []; eshots = []; gems = []; fx = []; texts = []; timers = []; parts = []; chests = []; allies = [];
  t = 0; kills = 0; spawnT = 0; nextBoss = 150; pending = 0; shake = 0; chestT = 18; flash = 0;
  setState('play');
}
let setReturn = 'main';
function setState(s) {
  state = s; document.body.dataset.state = s; if (s !== 'play') joy = null;
  if (s === 'main' || s === 'pets') showPets();
  if (s === 'pklvl') showLv();
  for (const id of ['main', 'select', 'settings', 'lvl', 'pause', 'over', 'pets', 'pklvl', 'gacha']) $(id).classList.toggle('on', id === (s === 'levelup' ? 'lvl' : s));
}

// ================================================================ Helfer & Partikel
function spark(x, y, n, col, spd, life, size, o) {
  o = o || {};
  for (let i = 0; i < n && parts.length < 800; i++) {
    const a = o.a === undefined ? rand(0, TAU) : o.a + rand(-1, 1) * (o.spread || .5), v = rand(.25, 1) * spd, l = rand(.5, 1) * life;
    parts.push({ x: x + rand(-1, 1) * (o.jit || 0), y: y + rand(-1, 1) * (o.jit || 0), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, size: size || 4, col, g: o.g || 0, drag: o.drag === undefined ? 3 : o.drag, dark: o.dark });
  }
}
function boom(x, y, R, col, big) {
  if (R >= 40 && decals.length < 50) decals.push({ x, y, R: Math.min(64, R * .7), life: big ? 6 : 3.5, max: big ? 6 : 3.5 });
  if (R >= 40 && parts.length < 600) spark(x, y, big ? 9 : 4, '#3a3030', R * 3.5, .7, 4, { a: -1.57, spread: 1.3, g: 700, drag: 1 });
  fx.push({ type: 'boom', x, y, R, life: big ? .45 : .3, max: big ? .45 : .3, col });
  spark(x, y, big ? 26 : 10, `rgb(${col})`, R * 4, .5, big ? 6 : 4);
  spark(x, y, big ? 10 : 4, '#ffffff', R * 3, .3, 4);
  if (big) spark(x, y, 12, 'rgba(60,50,60,.7)', R * 1.6, .9, 9, { dark: true, g: -60 });
}
function nearest(x, y, maxD, skip) {
  let best = null, bd = maxD * maxD;
  for (const e of enemies) { if (e.dead || (skip && skip.has(e))) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } }
  return best;
}
function aimDir(range) {
  const e = nearest(p.x, p.y, range || 700);
  if (e) { p.aim = Math.atan2(e.y - p.y, e.x - p.x); p.face = e.x >= p.x ? 1 : -1; }
  return p.aim;
}
const SPARK = { melee: '#ffc070', ranged: '#bfe8ff' };
function hit(e, amt, kind, kb, fx0, fy0) {
  if (e.dead) return;
  let d = amt * p.dmgMul * (p.buf[2] > 0 ? 1.2 : 1) * (kind === 'melee' ? p.meleeMul : p.rangedMul) * (1 + p.lvlDmg * (p.level - 1)) * (1 + p.pride * (1 - p.hp / p.maxHp));
  const crit = p.crit && Math.random() < p.crit; if (crit) d *= 2;
  if (e.ev && room) { d *= room.weak; room.dealt += d; if (room.first < 0) room.first = room.time; }
  e.hp -= d; dmgAcc += d; e.hit = .12; sfx('hit');
  if (parts.length < 500) spark(e.x, e.y - 6, crit ? 6 : 2, crit ? '#ffe45a' : SPARK[kind], 220, .25, crit ? 5 : 3);
  if (texts.length < 90) texts.push({ x: e.x + rand(-6, 6), y: e.y - 30 * e.s, v: Math.round(d) + (crit ? '!' : ''), life: .6, col: crit ? '255,220,60' : kind === 'melee' ? '255,180,90' : '255,255,255', big: crit });
  if (kb) {
    const a = Math.atan2(e.y - (fy0 === undefined ? p.y : fy0), e.x - (fx0 === undefined ? p.x : fx0));
    e.kx += Math.cos(a) * kb / e.mass; e.ky += Math.sin(a) * kb / e.mass;
  }
  if (e.hp <= 0) {
    e.dead = true; kills++; if (e.mb) { tele = tele.filter(q => q.own !== e); laters = laters.filter(q => q.own !== e); }
    if (e.prop) propBroken(e); else petKill();
    if (e.type === 'boss' && Math.random() < .5) gems.push({ x: e.x - 16, y: e.y + 12, ball: true, v: 0 });
    if (e.ev) bossDown(e);
    else if (p.arise && !e.prop && allies.length < 8 && Math.random() < p.arise) { allies.push({ x: e.x, y: e.y, life: 8, atkT: .3, face: 1, animT: 0, dmg: 8 + 2 * p.level, moving: false, pose: 0, shadow: true }); spark(e.x, e.y, 10, '#7a5aff', 160, .5, 5, { a: -1.57, spread: .6 }); }
    if (p.leech) p.hp = Math.min(p.maxHp, p.hp + p.leech);
    gems.push({ x: e.x, y: e.y, v: e.xp });
    if (e.type === 'boss' || (e.type === 'tank' && Math.random() < .2)) gems.push({ x: e.x + 14, y: e.y, heal: true });
    fx.push({ type: 'boom', x: e.x, y: e.y, R: 18 * e.s, life: .25, max: .25, col: '255,255,255' });
    if (parts.length < 600) spark(e.x, e.y, 5, '#ffffff', 160, .35, 4);
  }
}
function area(x, y, R, dmg, kind, kb) { for (const e of enemies) if (Math.hypot(e.x - x, e.y - y) < R + e.r) hit(e, dmg, kind, kb, x, y); }
function cone(a, R, half, dmg, kind, kb) { for (const e of enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < R + e.r && (d < 26 || angDiff(Math.atan2(e.y - p.y, e.x - p.x), a) < half)) hit(e, dmg, kind, kb); } }
function hurtPlayer(d) { if (p.inv > 0 || p.armor <= 0) return; p.hp -= d * p.armor * (p.buf[0] > 0 ? .8 : 1); p.hurtT = .12; sfx('hurt'); }
function levelCheck() {
  while (p.xp >= p.xpNext) { p.xp -= p.xpNext; p.level++; p.xpNext = Math.floor(p.xpNext * 1.1 + 4); pending++; if (p.lvlHp) { p.maxHp += p.lvlHp; p.hp += p.lvlHp; } }
}
function gainXp(v) { p.xp += v * p.xpMul; levelCheck(); }
function shot(type, a, speed, o) {
  const s = Object.assign({ type, x: p.x, y: p.y, a, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 9, life: 1.5, left: 1, kind: 'ranged', hitS: new Set() }, o);
  s.r *= p.area; if (s.boom) s.boom *= p.area;
  shots.push(s); return s;
}
function zapChain(x0, y0, first, count, dmg, range, col) {
  const pts = [[x0, y0]], seen = new Set(); let cur = first;
  while (cur && count-- > 0) { seen.add(cur); pts.push([cur.x, cur.y - 8]); hit(cur, dmg, 'ranged', 40, x0, y0); spark(cur.x, cur.y - 8, 4, col ? `rgb(${col})` : '#bfe8ff', 240, .25, 3); cur = nearest(cur.x, cur.y, range, seen); }
  if (pts.length > 1) fx.push({ type: 'zap', pts, life: .2, max: .2, col: col || '120,200,255' });
  return pts.length - 1;
}

// ================================================================ Startwaffen
const FIST = {
  saitama: { col: '#d5202a', hi: '#ff6a6a', dk: '#8f1219' }, eren: { col: '#d9a878', hi: '#f6d2aa', dk: '#8a5a38' },
  garou: { col: '#f0c8a2', hi: '#fff0d8', dk: '#b07a50' }, beru: { col: '#b02040', hi: '#ff8a9a', dk: '#5a1024' },
  jotaro: { col: '#8a5ad0', hi: '#c8a8ff', dk: '#4a2a8a' }, dio: { col: '#f2c61e', hi: '#fff0a0', dk: '#a8801a' }, gon: { col: '#f3cba0', hi: '#fff0d8', dk: '#c08a50' },
};
function fireWeapon() {
  const l = wl(), k = p.kind, A = p.area;
  if (['gojo', 'goku', 'vegeta', 'hinata', 'kageyama', 'naruto', 'sasuke', 'frieza', 'zeke', 'oikawa', 'kira', 'hisoka', 'ana'].includes(k)) {
    if (!nearest(p.x, p.y, 620)) return false;
    const a = aimDir(620);
    if (k === 'gojo') { const n = 1 + (l >= 3) + (l >= 6); for (let i = 0; i < n; i++) shot('red', a + (i - (n - 1) / 2) * .22, 430, { dmg: 14 + 4 * (l - 1), boom: 45 + 3 * l, col: '255,60,60' }); sfx('shoot'); }
    else if (k === 'goku') { const n = 1 + (l >= 5); for (let i = 0; i < n; i++) shot('ki', a + (i - (n - 1) / 2) * .16, 560, { dmg: 10 + 3 * (l - 1), left: 2 + Math.floor(l / 3), r: 8 }); sfx('shoot'); }
    else if (k === 'vegeta') { const n = 1 + (l >= 4) + (l >= 7); for (let i = 0; i < n; i++) shot('ki', a + rand(-.24, .24), 540, { dmg: 7.5 + 2 * (l - 1), r: 6, small: true, life: 1.1 }); sfx('shoot'); }
    else if (k === 'hinata') { shot('ball', a, 520, { dmg: 13 + 4 * (l - 1), bounce: 2 + Math.floor(l / 2), life: 1.2 }); sfx('ball'); }
    else if (k === 'kageyama') { shot('ball', a, 760, { dmg: 15 + 5 * (l - 1), left: Infinity, life: .9, r: 10, serve: true }); sfx('ball'); }
    else if (k === 'naruto') { const n = 1 + (l >= 3) + (l >= 6); for (let i = 0; i < n; i++) shot('shuriken', a + (i - (n - 1) / 2) * .2, 520, { dmg: 13 + 4 * (l - 1), left: 2 + (l >= 5), r: 9 }); sfx('slash'); }
    else if (k === 'sasuke') { shot('fire', a, 300, { dmg: 14 + 5 * (l - 1), left: Infinity, r: 18 + l, life: 1.15 }); spark(p.x, p.y, 8, '#ffb030', 200, .4, 5, { a, spread: .5 }); sfx('fire'); }
    else if (k === 'frieza') { const n = 1 + (l >= 4) + (l >= 7); for (let i = 0; i < n; i++) shot('ki', a + (i - (n - 1) / 2) * .1, 820, { dmg: 12 + 4 * (l - 1), left: Infinity, r: 6, small: true, life: .8, cc: ['230,90,255', '160,0,220'], trail: '#e070ff' }); sfx('shoot'); }
    else if (k === 'zeke') { const n = 4 + Math.floor(l / 2); for (let i = 0; i < n; i++) shot('rock', a + (i - (n - 1) / 2) * .13 + rand(-.04, .04), rand(420, 520), { dmg: 7 + 2.2 * (l - 1), r: 8, life: .75 }); sfx('ball'); }
    else if (k === 'oikawa') { shot('ball', a, 640, { dmg: 16 + 5 * (l - 1), boom: 50 + 4 * l, col: '90,220,200', life: 1.1, serve: true }); sfx('ball'); }
    else if (k === 'kira') { const n = 1 + (l >= 5); for (let i = 0; i < n; i++) shot('red', a + (i - (n - 1) / 2) * .3, 380, { dmg: 18 + 6 * (l - 1), boom: 60 + 5 * l, col: '255,150,220', cc: ['255,150,220', '220,40,160'], trail: '#ff9ae0' }); sfx('shoot'); }
    else if (k === 'ana') { const n = 1 + (l >= 3) + (l >= 6); for (let i = 0; i < n; i++) shot('sushi', a + (i - (n - 1) / 2) * .2, 500, { dmg: 11 + 3.5 * (l - 1), left: 2 + (l >= 4), r: 10, v: Math.floor(Math.random() * 9) }); sfx('shoot'); }
    else { const n = 3 + (l >= 4) + (l >= 7); for (let i = 0; i < n; i++) shot('card', a + (i - (n - 1) / 2) * .14, 600, { dmg: 9 + 3 * (l - 1), left: 2, r: 7, life: .9 }); sfx('slash'); }
  } else if (k === 'saitama' || k === 'eren') {
    const a = aimDir(260), R = ((k === 'eren' ? 60 : 50) + 5 * l) * A, cx = p.x + Math.cos(a) * 55, cy = p.y + Math.sin(a) * 55;
    area(cx, cy, R, k === 'eren' ? 20 + 6 * (l - 1) : 24 + 7 * (l - 1), 'melee', k === 'eren' ? 220 : 320);
    fx.push(Object.assign({ type: 'fist', a, R, life: .26, max: .26 }, FIST[k]));
    spark(cx, cy, 8, k === 'eren' ? '#fff0d8' : '#ff8a6a', 300, .3, 4, { a, spread: 1.2 });
    if (k === 'eren') { spark(cx, cy, 8, 'rgba(240,240,240,.7)', 90, .9, 8, { dark: true, g: -70 }); shake = Math.max(shake, .12); }
    sfx('punch');
  } else if (k === 'jotaro' || k === 'dio' || k === 'garou' || k === 'beru') {
    if (!nearest(p.x, p.y, 240)) return false;
    // [Reichweite, halber Winkel, Schaden, Schaden pro Stufe, Fäuste, Faustgröße, Aura]
    const M = { jotaro: [88, .6, 4.6, 1.5, 3, 20, '138,90,208'], dio: [78, .9, 8, 2.6, 2, 26, '242,198,30'], garou: [84, .75, 5.6, 1.8, 2, 22, '255,110,70'], beru: [90, .7, 6, 1.9, 3, 20, '170,90,255'] }[k];
    const a = aimDir(240), R = (M[0] + 5 * l) * A, half = M[1];
    cone(a, R, half, M[2] + M[3] * (l - 1), 'melee', 60);
    for (let i = 0; i < M[4]; i++) { const aa = a + rand(-half, half), d = rand(.4, 1) * R; fx.push(Object.assign({ type: 'pop', x: p.x + Math.cos(aa) * d, y: p.y + Math.sin(aa) * d - 6, a: aa, s: M[5], life: .14, max: .14 }, FIST[k])); }
    fx.push({ type: 'stand', a, life: .22, max: .22, col: M[6] });
    sfx('punch');
  } else if (k === 'gon') {
    const a = aimDir(280), R = (70 + 6 * l) * A, cx = p.x + Math.cos(a) * 60, cy = p.y + Math.sin(a) * 60;
    area(cx, cy, R, 48 + 14 * (l - 1), 'melee', 420);
    fx.push(Object.assign({ type: 'fist', a, R: R * .8, life: .3, max: .3, aura: '255,170,40' }, FIST.gon));
    boom(cx, cy, R, '255,180,60', true); shake = Math.max(shake, .2); sfx('boom');
  } else if (k === 'killua') {
    const e = nearest(p.x, p.y, 520); if (!e) return false;
    aimDir(520); zapChain(p.x, p.y - 10, e, 2 + Math.floor(l / 2), 15 + 5 * (l - 1), 210); sfx('zap');
  } else if (k === 'aizen') {
    const e = nearest(p.x, p.y, 540); if (!e) return false;
    aimDir(540); zapChain(p.x, p.y - 10, e, 2 + Math.floor(l / 3), 20 + 6 * (l - 1), 230, '255,225,90'); sfx('zap');
  } else if (k === 'pain') {
    const R = (100 + 9 * l) * A; if (!nearest(p.x, p.y, R * 1.15)) return false;
    aimDir(R * 1.15); area(p.x, p.y, R, 15 + 5 * (l - 1), 'ranged', 520);
    boom(p.x, p.y, R, '190,160,255', true); shake = Math.max(shake, .1); sfx('boom');
  } else if (k === 'nam') {
    const R = (62 + 5 * l) * A; if (!nearest(p.x, p.y, R + 40)) return false;
    aimDir(R + 40); area(p.x, p.y, R + 10, 6 + 2 * (l - 1), 'melee', 90);
    spark(p.x, p.y, 3, '#dfe6f0', R * 5, .18, 3); sfx('punch');
  } else if (k === 'levi') {
    aimDir(260); const R = (72 + 6 * l) * A;
    area(p.x, p.y, R, 13 + 4 * (l - 1), 'melee', 110);
    fx.push({ type: 'spin', R, life: .24, max: .24, a: rand(0, TAU) });
    spark(p.x, p.y, 10, '#e8fff0', R * 5, .22, 3); sfx('slash');
  } else {
    const a = aimDir(260), R = (95 + 8 * l) * A;
    cone(a, R, 1.25, 16 + 5 * (l - 1), 'melee', 120);
    fx.push({ type: 'slash', a, R, life: .22, max: .22, col: k === 'sukuna' ? '255,70,70' : k === 'jinwoo' ? '150,110,255' : '150,210,255' });
    for (let i = 0; i < 8; i++) { const aa = a + rand(-1.2, 1.2); spark(p.x + Math.cos(aa) * R * .9, p.y + Math.sin(aa) * R * .9, 1, k === 'sukuna' ? '#ffd0d0' : '#dff2ff', 160, .3, 3, { a: aa, spread: .3 }); }
    sfx('slash');
  }
  p.atkT = .25;
  return true;
}

// ================================================================ Globale Fähigkeiten
function punchRain(n, gap, range, R, dmg, big) {
  for (let i = 0; i < n; i++) timers.push({ delay: i * gap, fn() {
    const near = enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < range), tg = near.length ? pick(near) : null;
    const x = tg ? tg.x : p.x + rand(-range, range) * .6, y = tg ? tg.y : p.y + rand(-range, range) * .6;
    area(x, y, R * p.area, dmg, 'melee', big ? 260 : 90);
    fx.push(Object.assign({ type: 'pop', x, y, a: Math.atan2(y - p.y, x - p.x), s: big ? 54 : 26, life: big ? .22 : .16, max: big ? .22 : .16 }, FIST.saitama));
    if (big) { boom(x, y, R * p.area, '255,120,90'); shake = Math.max(shake, .18); }
    sfx('punch');
  } });
}
function stomps(n, R, dmg) {
  const a = aimDir(), x0 = p.x, y0 = p.y;
  for (let i = 0; i < n; i++) timers.push({ delay: i * .16, fn() {
    const side = (i % 2 ? 1 : -1) * 55, d = 70 + i * 95, x = x0 + Math.cos(a) * d - Math.sin(a) * side, y = y0 + Math.sin(a) * d + Math.cos(a) * side;
    area(x, y, R * p.area, dmg, 'melee', 160); fx.push({ type: 'stomp', x, y, a, R: R * p.area, life: .7, max: .7 });
    spark(x, y, 14, 'rgba(210,190,160,.8)', 260, .7, 7, { dark: true, g: -40 }); spark(x, y, 8, '#fff0d0', 320, .3, 4);
    shake = Math.max(shake, .25); sfx('boom');
  } });
}
function freezeAll(sec) { for (const e of enemies) if (Math.abs(e.x - p.x) < W / 2 + 60 && Math.abs(e.y - p.y) < H / 2 + 60) e.frozen = Math.max(e.frozen, sec); eshots.length = 0; }
const AB = {
  // ---- Jujutsu Kaisen
  blue: { name: 'Blau', anime: 'Jujutsu Kaisen', tag: 'jjk', max: 5, desc: 'Anziehungskugel, die Gegner zusammenzieht', cd: l => 7.5 - l * .5,
    fire(l) { const e = nearest(p.x, p.y, 450); fx.push({ type: 'blue', x: e ? e.x : p.x + rand(-150, 150), y: e ? e.y : p.y + rand(-150, 150), R: (140 + 15 * l) * p.area, dps: 12 + 5 * l, tick: 0, life: 2.4, max: 2.4 }); sfx('freeze'); } },
  red: { name: 'Umkehrung: Rot', anime: 'Jujutsu Kaisen', tag: 'jjk', max: 5, desc: 'Abstoßende Kugel mit heftiger Explosion', cd: l => 4.2 - l * .3,
    fire(l) { shot('red', aimDir(), 460, { dmg: 30 + 12 * l, boom: 80 + 10 * l, r: 13, col: '255,60,60', kb: 300, big: true }); sfx('shoot'); } },
  void: { name: 'Unendliche Leere', anime: 'Jujutsu Kaisen', tag: 'jjk', max: 5, desc: 'Sphärenentfaltung: friert alle Gegner im Bild ein', cd: l => 24 - l * 2,
    fire(l) { freezeAll(2 + .6 * l); for (const e of enemies) if (e.frozen > 0) hit(e, 6 * l, 'ranged'); fx.push({ type: 'void', life: 1.2, max: 1.2 }); sfx('freeze'); } },
  purple: { name: 'Hollow Purple', anime: 'Jujutsu Kaisen', tag: 'jjk', evo: true, req: ['blue', 'red'], max: 1, desc: 'Blau und Rot verschmelzen: riesige Kugel löscht alles in ihrer Bahn', cd: () => 5.5,
    fire() {
      const a = aimDir(); fx.push({ type: 'merge', a, life: .35, max: .35 });
      timers.push({ delay: .3, fn() { shot('purple', a, 420, { r: 74, dmg: 240, life: 2.4, left: Infinity, kb: 240 }); shake = .4; flash = .25; sfx('big'); } });
    } },
  // ---- Bleach
  getsuga: { name: 'Getsuga Tenshou', anime: 'Bleach', tag: 'bl', max: 5, desc: 'Sichelförmige Energiewelle, die durchschneidet', cd: l => 3.3 - l * .3,
    fire(l) { const a = aimDir(); for (const d of (l >= 4 ? [a, a + Math.PI] : [a])) shot('getsuga', d, 520, { r: 30 + 3 * l, dmg: 22 + 9 * l, life: 1.2, left: Infinity }); sfx('slash'); } },
  bankai: { name: 'Bankai', anime: 'Bleach', tag: 'bl', max: 5, desc: 'Dauerhaft +8% Tempo und +10% Angriffstempo', passive: true, apply() { p.speed *= 1.08; p.rate *= 1.10; p.auraBankai = true; } },
  mugetsu: { name: 'Mugetsu', anime: 'Bleach', tag: 'bl', evo: true, req: ['getsuga', 'bankai'], max: 1, desc: 'Finales Getsuga Tenshou: schwarze Welle über das ganze Feld', cd: () => 6.5,
    fire() { shot('mugetsu', aimDir(), 640, { r: 120, dmg: 320, life: 1.7, left: Infinity, kb: 200 }); fx.push({ type: 'dark', life: .5, max: .5 }); shake = .4; sfx('big'); } },
  // ---- One Punch Man
  serious: { name: 'Ernsthafter Schlag', anime: 'One Punch Man', tag: 'opm', max: 5, desc: 'Gewaltige Druckwelle nach vorn (Nahkampf)', cd: l => 12.5 - l,
    fire(l) {
      const a = aimDir(), R = (420 + 30 * l) * p.area; cone(a, R, .7, 120 + 50 * l, 'melee', 700);
      fx.push({ type: 'cone', a, R, life: .5, max: .5 }); for (let i = 0; i < 30; i++) spark(p.x, p.y, 1, '#ffffff', R * 3, .45, 5, { a, spread: .65 });
      shake = .5; flash = .15; p.atkT = .3; sfx('big');
    } },
  combo: { name: 'Normale Schlagserie', anime: 'One Punch Man', tag: 'opm', max: 5, desc: 'Blitzschnelle Schläge auf Gegner in der Nähe', cd: l => 2.7 - l * .2, fire(l) { punchRain(5 + l, .07, 190, 32, 9 + 3 * l); } },
  sseries: { name: 'Ernsthafte Serie', anime: 'One Punch Man', tag: 'opm', evo: true, req: ['combo', 'serious'], max: 1, desc: 'Schlaghagel aus ernsthaften Schlägen im weiten Umkreis', cd: () => 4.5, fire() { punchRain(16, .055, 340, 64, 75, true); } },
  // ---- Dragon Ball Z
  kame: { name: 'Kamehameha', anime: 'Dragon Ball Z', tag: 'dbz', max: 5, desc: 'Gewaltiger Energiestrahl in Blickrichtung', cd: l => 8.5 - l * .6,
    fire(l) { fx.push({ type: 'beam', a: aimDir(), w: (46 + 7 * l) * p.area, dps: 90 + 45 * l, L: 780, tick: 0, life: 1.1, max: 1.1 }); p.atkT = 1.1; shake = .25; sfx('beam'); } },
  ssj: { name: 'Super-Saiyajin', anime: 'Dragon Ball Z', tag: 'dbz', max: 5, desc: 'Dauerhaft +10% Schaden für alles', passive: true, apply() { p.dmgMul *= 1.10; p.auraSSJ = true; } },
  genki: { name: 'Genkidama', anime: 'Dragon Ball Z', tag: 'dbz', evo: true, req: ['kame', 'ssj'], max: 1, desc: 'Riesige Energiekugel stürzt herab und trifft alle Gegner auf der halben Bildschirmfläche um dich', cd: () => 8,
    fire() { fx.push({ type: 'drop', kind: 'genki', x: p.x, y: p.y, R: Math.sqrt(W * H / (2 * Math.PI * VK)), dmg: 352, life: 1.8, max: 1.8 }); } },
  // ---- Attack on Titan
  spear: { name: 'Donnerspeer', anime: 'Attack on Titan', tag: 'aot', max: 5, desc: 'Speer mit großer Explosion beim Einschlag', cd: l => 5 - l * .4,
    fire(l) { shot('spear', aimDir(), 620, { dmg: 40 + 15 * l, boom: 90 + 10 * l, col: '255,170,60', big: true }); sfx('shoot'); } },
  harden: { name: 'Verhärtung', anime: 'Attack on Titan', tag: 'aot', max: 5, desc: 'Dauerhaft 8% weniger erlittener Schaden', passive: true, apply() { p.armor *= .92; } },
  rumble: { name: 'Das Grollen', anime: 'Attack on Titan', tag: 'aot', evo: true, req: ['spear', 'harden'], max: 1, desc: 'Kolossale Titanen marschieren über das Feld und zertreten alles', cd: () => 7.5, fire() { stomps(11, 105, 120); } },
  // ---- Haikyu!!
  quick: { name: 'Blitzangriff', anime: 'Haikyu!!', tag: 'hq', max: 5, desc: 'Schnellangriff auf den stärksten Gegner in Reichweite', cd: l => 4.6 - l * .4,
    fire(l) { return spikeAt(1, 80 + 45 * l, 20 + 10 * l); } },
  wall: { name: 'Eiserne Mauer', anime: 'Haikyu!!', tag: 'hq', max: 5, desc: 'Kreisende Blocks, die Gegner treffen und wegstoßen', passive: true, apply() { } },
  sync: { name: 'Synchronangriff', anime: 'Haikyu!!', tag: 'hq', evo: true, req: ['quick', 'wall'], max: 1, desc: 'Das ganze Team schmettert gleichzeitig auf die sechs stärksten Gegner', cd: () => 3.2,
    fire() { return spikeAt(6, 210, 70); } },
  // ---- Naruto
  rasengan: { name: 'Rasengan', anime: 'Naruto', tag: 'nar', max: 5, desc: 'Rotierende Chakrakugel, die vor dir alles zermahlt', cd: l => 3.4 - l * .25,
    fire(l) { fx.push({ type: 'rasengan', a: aimDir(300), R: (46 + 5 * l) * p.area, dmg: 9 + 4 * l, tick: 0, life: .9, max: .9 }); sfx('freeze'); } },
  clones: { name: 'Schattendoppelgänger', anime: 'Naruto', tag: 'nar', max: 5, desc: 'Doppelgänger, die selbstständig Gegner angreifen', cd: l => 9 - l * .5,
    fire(l) { const n = 2 + (l >= 3) + (l >= 5); for (let i = 0; i < n; i++) { const a = i * TAU / n; allies.push({ x: p.x + Math.cos(a) * 40, y: p.y + Math.sin(a) * 40, life: 5.5, atkT: .3, face: 1, animT: rand(0, 5), dmg: 10 + 4 * l, moving: false, pose: 0 }); spark(p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40, 10, 'rgba(240,240,240,.8)', 120, .6, 8, { dark: true }); } sfx('fire'); } },
  chidori: { name: 'Chidori', anime: 'Naruto', tag: 'nar', max: 5, desc: 'Blitzlanze, die eine ganze Linie durchbohrt', cd: l => 5 - l * .4,
    fire(l) {
      const a = aimDir(), L = (330 + 30 * l) * p.area, ca = Math.cos(a), sa = Math.sin(a);
      for (const e of enemies) { const dx = e.x - p.x, dy = e.y - p.y, al = dx * ca + dy * sa; if (al > -10 && al < L && Math.abs(dy * ca - dx * sa) < 26 + e.r) hit(e, 45 + 18 * l, 'ranged', 120); }
      fx.push({ type: 'zap', pts: [[p.x, p.y - 8], [p.x + ca * L, p.y + sa * L - 8]], life: .32, max: .32, col: '120,200,255', big: true });
      for (let i = 0; i < 14; i++) spark(p.x + ca * L * rand(0, 1), p.y + sa * L * rand(0, 1), 1, '#dff2ff', 200, .3, 3); p.atkT = .3; sfx('zap');
    } },
  rshuriken: { name: 'Rasen-Shuriken', anime: 'Naruto', tag: 'nar', evo: true, req: ['rasengan', 'clones'], max: 1, desc: 'Windklingen-Rasengan, das in einem Sturm aus Klingen explodiert', cd: () => 5.5,
    fire() { shot('rshuriken', aimDir(), 440, { dmg: 160, r: 30, boom: 170, col: '190,235,255', big: true, vortex: true, kb: 120 }); sfx('big'); } },
  // ---- JoJo
  emerald: { name: 'Smaragdsplitter', anime: 'JoJo', tag: 'jojo', max: 5, desc: 'Fächer aus scharfen Smaragden', cd: l => 2.6 - l * .2,
    fire(l) { const a = aimDir(), n = 5 + l; for (let i = 0; i < n; i++) shot('shard', a + (i - (n - 1) / 2) * .11 + rand(-.03, .03), rand(480, 580), { dmg: 9 + 3 * l, r: 7, life: .9 }); sfx('shoot'); } },
  knives: { name: 'Messerwurf', anime: 'JoJo', tag: 'jojo', max: 5, desc: 'Ring aus Messern in alle Richtungen', cd: l => 4.2 - l * .3,
    fire(l) { const n = 8 + 2 * l, o = rand(0, TAU); for (let i = 0; i < n; i++) shot('knife', o + i * TAU / n, 480, { dmg: 12 + 4 * l, left: 2, r: 7, life: 1 }); sfx('slash'); } },
  tstop: { name: 'The World', anime: 'JoJo', tag: 'jojo', max: 5, desc: 'Zeitstopp: alle Gegner erstarren kurz', cd: l => 16 - l,
    fire(l) { freezeAll(1.3 + .4 * l); fx.push({ type: 'tstop', life: .9, max: .9 }); sfx('freeze'); } },
  roller: { name: 'Straßenwalze', anime: 'JoJo', tag: 'jojo', evo: true, req: ['knives', 'tstop'], max: 1, desc: 'Zeitstopp – und eine Straßenwalze kracht auf die Gegner', cd: () => 9,
    fire() { freezeAll(3); fx.push({ type: 'tstop', life: .9, max: .9 }); const e = nearest(p.x, p.y, 420); fx.push({ type: 'drop', kind: 'roller', x: e ? e.x : p.x + 80, y: e ? e.y : p.y, R: 190 * p.area, dmg: 400, life: 1.1, max: 1.1 }); sfx('freeze'); } },
  // ---- Hunter x Hunter
  ren: { name: 'Ren', anime: 'Hunter x Hunter', tag: 'hxh', max: 5, desc: 'Nen-Aura, die Gegner in deiner Nähe dauerhaft verletzt', passive: true, apply() { } },
  godspeed: { name: 'Gottesgeschwindigkeit', anime: 'Hunter x Hunter', tag: 'hxh', max: 5, desc: 'Dauerhaft +7% Tempo und +8% Angriffstempo', passive: true, apply() { p.speed *= 1.07; p.rate *= 1.08; p.auraGod = true; } },
  whirl: { name: 'Wirbelwind', anime: 'Hunter x Hunter', tag: 'hxh', evo: true, req: ['ren', 'godspeed'], max: 1, desc: 'Gottesgeschwindigkeit: Blitze schlagen pausenlos in nahe Gegner ein', cd: () => .4,
    fire() {
      const seen = new Set(); let any = false;
      for (let i = 0; i < 3; i++) { const e = nearest(p.x, p.y, 290 * p.area, seen); if (!e) break; seen.add(e); zapChain(p.x, p.y - 10, e, 2, 42, 150); any = true; }
      if (any) sfx('zap'); return any;
    } },
};
function spikeAt(n, dmg, splash) {
  const c = enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 560).sort((a, b) => b.hp - a.hp).slice(0, n);
  if (!c.length) return false;
  for (const tg of c) {
    fx.push({ type: 'line', x0: p.x, y0: p.y - 10, x1: tg.x, y1: tg.y, life: .25, max: .25 });
    boom(tg.x, tg.y, 44 * p.area, '255,230,90'); hit(tg, dmg, 'ranged', 260); area(tg.x, tg.y, 44 * p.area, splash, 'ranged', 120);
  }
  sfx('ball');
}
const PARTNER = {};
for (const id in AB) if (AB[id].evo) { const [a, b] = AB[id].req; PARTNER[a] = { other: b, evo: id }; PARTNER[b] = { other: a, evo: id }; }
const STATS = {
  might: { name: 'Kraft', desc: '+15% Schaden für alles', max: 5, apply() { p.dmgMul *= 1.15; } },
  haste: { name: 'Angriffstempo', desc: 'Alle Angriffe laden 8% schneller nach', max: 5, apply() { p.rate *= 1.08; } },
  hp: { name: 'Ausdauer', desc: '+25 max. Leben und 25 Heilung', max: 5, apply() { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  regen: { name: 'Regeneration', desc: '+0,6 Leben pro Sekunde', max: 5, apply() { p.regen += .6; } },
  armor: { name: 'Rüstung', desc: '6% weniger erlittener Schaden', max: 5, apply() { p.armor *= .94; } },
  area: { name: 'Reichweite', desc: '+10% Größe aller Angriffe und Explosionen', max: 5, apply() { p.area *= 1.10; } },
  crit: { name: 'Glück', desc: '+6% Chance auf kritische Treffer (x2)', max: 5, apply() { p.crit += .06; } },
  growth: { name: 'Wachstum', desc: '+8% EXP', max: 5, apply() { p.xpMul *= 1.08; } },
  speed: { name: 'Schnelle Füße', desc: '+10% Lauftempo', max: 5, apply() { p.speed *= 1.1; } },
  magnet: { name: 'Magnet', desc: '+35% Sammelradius', max: 5, apply() { p.magnet *= 1.35; } },
  revive: { name: 'Zweite Chance', desc: 'Einmal mit halbem Leben wiederbeleben', max: 1, apply() { p.revives++; } },
};
const MAX_AB = 6;
const hasMax = id => (p.ab[id] || 0) >= AB[id].max || (id === 'red' && p.kind === 'gojo' && p.wLvl >= 5);
const partnerName = id => id === 'red' && p.kind === 'gojo' ? 'Rot (Startwaffe Stufe 5)' : AB[id].name;

// ================================================================ Level-Up
let options = [];
function wpick(pool) { let s = 0; for (const o of pool) s += o.w; let r = Math.random() * s; for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) return pool.splice(i, 1)[0]; } return pool.pop(); }
function showLevelUp() {
  const pool = [], owned = Object.keys(p.ab).length; options = [];
  for (const id in AB) {
    const a = AB[id]; if (!a.evo || p.ab[id] || !a.req.every(hasMax)) continue;
    options.push({ name: a.name, tag: 'evo', anime: 'KOMBINATION', desc: a.desc, evo: true, sub: a.req.map(partnerName).join(' + '), go() {
      for (const r of a.req) if (p.ab[r]) { delete p.ab[r]; p.used[r] = 1; }
      p.ab[id] = 1; p.abT[id] = .5; flash = .4; sfx('evo');
    } });
  }
  if (p.wLvl < 5) pool.push({ w: 2.5, name: CHARS[p.kind].weapon, tag: CHARS[p.kind].tag, anime: 'Startwaffe', desc: CHARS[p.kind].wdesc, info: WINFO(p.kind, p.wLvl + 1), mx: p.wLvl + 1 >= 5, lv: p.wLvl + 1, go() { p.wLvl++; } });
  for (const id in AB) {
    const a = AB[id], l = p.ab[id] || 0, pt = PARTNER[id];
    if (a.evo || p.used[id] || l >= a.max || (!l && owned >= MAX_AB) || (id === 'red' && p.kind === 'gojo')) continue;
    const pOwned = pt && (p.ab[pt.other] || (pt.other === 'red' && p.kind === 'gojo'));
    pool.push({ w: l ? 2.5 : pOwned ? 4 : 1.5, name: a.name, tag: a.tag, anime: a.anime, desc: a.desc, info: INFO[id] ? INFO[id](l + 1) : '', mx: l + 1 >= a.max, lv: l + 1, isNew: !l,
      combo: pt && !p.ab[pt.evo] ? `+ ${partnerName(pt.other)} → ${AB[pt.evo].name}` : '',
      go() { p.ab[id] = l + 1; if (a.passive) a.apply(); else if (!l) p.abT[id] = .6; } });
  }
  for (const id in STATS) {
    const s = STATS[id], l = p.up[id] || 0;
    if (l < s.max) pool.push({ w: 1, name: s.name, tag: 'gen', anime: 'Passiv', desc: s.desc, info: s.max > 1 ? `Stufe ${l + 1} von ${s.max}` : '', lv: l + 1, isNew: !l, go() { p.up[id] = l + 1; s.apply(); } });
  }
  options = options.slice(0, 3);
  while (options.length < 3 && pool.length) options.push(wpick(pool));
  if (!options.length) { pending = 0; return; }
  const box = $('choices'); box.innerHTML = '';
  options.forEach((o, i) => {
    const d = document.createElement('div'); d.className = 'card' + (o.evo ? ' evo' : '');
    d.innerHTML = `<span class="tag ${o.tag}">${o.anime}</span><h3>${o.name}</h3><p class="perk">${o.evo ? o.sub : o.isNew ? 'NEU' : 'Stufe ' + o.lv}</p><p>${o.desc}</p>${o.info ? `<p class="info">${o.info}</p>` : ''}${o.mx ? '<p class="mx">Stufe 5: neue Animation</p>' : ''}${o.combo ? `<p class="combo">Kombi: ${o.combo}</p>` : ''}<p class="key">Taste ${i + 1}</p>`;
    d.onclick = () => choose(i); box.appendChild(d);
  });
  const rb = $('bReroll'); rb.textContent = `Neu würfeln (noch ${p.rerolls}×)`; rb.disabled = p.rerolls <= 0; rb.style.opacity = p.rerolls > 0 ? '1' : '.4';
  sfx('level'); setState('levelup');
}
function choose(i) {
  if (state !== 'levelup' || !options[i]) return;
  options[i].go(); pending--; sfx('click');
  if (pending > 0) showLevelUp(); else setState('play');
}

// ================================================================ Truhen
const ITEMS = {
  heart: { label: 'Herz: +50% Leben', go() { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .5); sfx('heal'); } },
  exp: { label: 'Großer EXP-Kristall: +1 Level', go() { p.xp = p.xpNext; levelCheck(); } },
  magnet: { label: 'Magnet: alles eingesammelt', go() { for (const g of gems) g.pull = true; } },
  bomb: { label: 'Bombe: Bildschirm geräumt', go() { for (const e of enemies) if (Math.abs(e.x - p.x) < W / 2 + 80 && Math.abs(e.y - p.y) < H / 2 + 80) hit(e, e.type === 'boss' ? 350 / p.dmgMul : 1e6, 'ranged'); flash = .5; shake = .5; sfx('big'); } },
};
function openChest(c) {
  const low = p.hp < p.maxHp * .5, pool = ['heart', 'heart', 'heart', 'exp', 'exp', 'exp', 'magnet', 'magnet', 'bomb'];
  if (low) pool.push('heart', 'heart', 'heart'); if (gems.length > 60) pool.push('magnet', 'magnet');
  const k = pick(pool); c.dead = true; ITEMS[k].go(); sfx('chest');
  fx.push({ type: 'item', icon: k, label: ITEMS[k].label, x: c.x, y: c.y, life: 1.8, max: 1.8 });
  spark(c.x, c.y - 10, 24, '#ffe45a', 300, .7, 5, { g: 300 }); spark(c.x, c.y - 10, 10, '#ffffff', 200, .5, 4);
}

// ================================================================ Eingabe
const keys = {};
let joy = null;
addEventListener('keydown', e => {
  initAudio();
  const k = e.key.toLowerCase(); keys[k] = true;
  if (k === 'shift' && !e.repeat) tryDash();
  if (state === 'levelup' && '123'.includes(k)) choose(+k - 1);
  else if (state === 'levelup' && k === 'r' && !e.repeat) reroll();
  else if (k === 'p' || k === 'escape') {
    if (state === 'play') setState('pause'); else if (state === 'pause') setState('play');
    else if (state === 'select' || state === 'pets') setState('main'); else if (state === 'settings') setState(setReturn);
  }
  if (k.startsWith('arrow') || k === ' ') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('pointerdown', initAudio);
cv.addEventListener('pointerdown', e => { if (!joy) joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (joy && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
addEventListener('pointerup', e => { if (joy && e.pointerId === joy.id) joy = null; });
addEventListener('pointercancel', e => { if (joy && e.pointerId === joy.id) joy = null; });
$('bDash').addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); tryDash(); });
$('bPause').addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); if (state === 'play') { sfx('click'); joy = null; setState('pause'); } });
addEventListener('contextmenu', e => e.preventDefault());

// ================================================================ Spawns
function spawn(type) {
  const d = ET[type], a = rand(0, TAU), dist = Math.hypot(W, H / VK) / 2 + 70, hp = d.hp * (1 + t / 150);
  enemies.push({ type, sp: d.sp, r: d.r, dmg: d.dmg, xp: d.xp, s: d.s, mass: d.mass, hp, maxHp: hp,
    x: p.x + Math.cos(a) * dist, y: p.y + Math.sin(a) * dist, kx: 0, ky: 0, hit: 0, frozen: 0, wallT: 0, face: 1,
    animT: rand(0, 9), shootT: rand(1, 2.5), look: pick(ELOOKS[type]), dead: false, walking: true });
}
function pickType() {
  const r = Math.random();
  if (t > 120 && r < .07) return 'tank';
  if (t > 30 && r < .2) return 'thrower';
  if (t > 40 && r < .45) return 'jogger';
  return 'walker';
}

// ================================================================ Update
const TRAIL = { red: '#ff5a4a', ki: '#ffe14a', purple: '#c98bff', getsuga: '#8fd6ff', mugetsu: '#3a1a4a', spear: '#ffd070', fire: '#ff8a20', shard: '#5aff9a', rshuriken: '#dff6ff', shuriken: '#c8d0dc', knife: '#e0e6ee', ball: '#ffffff', rock: '#b0a898', card: '#ffd0e8', sushi: '#ffc0a0' };
function update(dt) {
  t += dt; if (p.rev !== undefined) tickRevive(dt);
  let mx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  let my = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
  if (joy) { const jx = joy.x - joy.x0, jy = joy.y - joy.y0; if (Math.hypot(jx, jy) > 12) { mx = jx; my = jy; } }
  if (p.rev !== undefined) mx = my = 0;
  const ml = Math.hypot(mx, my);
  p.moving = ml > 0; p.mvx = p.moving ? mx / ml : 0; p.mvy = p.moving ? my / ml : 0;
  if (p.dashT > 0) { p.dashT -= dt; p.x += p.dvx * dt; p.y += p.dvy * dt; if (parts.length < 600) spark(p.x, p.y - 4, 2, '#cfe8ff', 50, .25, 6); }
  p.dashCd -= dt;
  if (p.moving) {
    p.x += mx / ml * p.speed * dt; p.y += my / ml * p.speed * dt;
    if (p.atkT <= 0) { p.aim = Math.atan2(my, mx); if (mx) p.face = mx > 0 ? 1 : -1; }
  }
  p.animT += dt; p.atkT -= dt; p.hurtT -= dt; p.inv -= dt; shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt); p.orb += dt * 2.6;
  p.hp = Math.min(p.maxHp, p.hp + p.regen * p.regenMul * dt);

  tickWorld(dt);
  if (!room) spawnT -= dt;
  if (!room && spawnT <= 0) {
    spawnT = Math.max(.25, .95 - t / 500) * (hordeT > 0 ? .5 : 1);
    const n = 1 + Math.floor(t / 100);
    for (let i = 0; i < n && enemies.length < 300; i++) spawn(pickType());
  }
  if (!room && t >= nextBoss) { nextBoss += 150; spawn('boss'); }
  if (!room) chestT -= dt;
  if (chestT <= 0) { chestT = 26; if (chests.length < 3) { const a = rand(0, TAU), d = rand(320, 560); chests.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, born: t }); } }
  for (const c of chests) if (Math.hypot(c.x - p.x, c.y - p.y) < 38) openChest(c);
  chests = chests.filter(c => !c.dead);

  const wl = p.ab.wall || 0, wn = wl ? 2 + (wl >= 3) + (wl >= 5) : 0, walls = [];
  for (let i = 0; i < wn; i++) walls.push([p.x + Math.cos(p.orb + i * TAU / wn) * 80 * p.area, p.y + Math.sin(p.orb + i * TAU / wn) * 80 * p.area]);
  if (p.ab.ren) { p.renT -= dt; if (p.renT <= 0) { p.renT = .4; area(p.x, p.y, (70 + 10 * p.ab.ren) * p.area, 6 + 3 * p.ab.ren, 'ranged', 40); } }

  for (const e of enemies) {
    e.hit -= dt; e.wallT -= dt;
    e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(.002, dt); e.ky *= Math.pow(.002, dt);
    if (wn && e.wallT <= 0) for (const w of walls) if (Math.hypot(e.x - w[0], e.y - w[1]) < 22 + e.r) { e.wallT = .5; hit(e, 8 + 4 * wl, 'melee', 240); break; }
    if (e.dead) continue;
    if (e.frozen > 0) { e.frozen -= dt; continue; }
    e.animT += dt;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.face = dx >= 0 ? 1 : -1;
    let dir = 1;
    if (e.type === 'thrower') {
      dir = d > 270 ? 1 : d < 200 ? -.6 : 0;
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 460) { e.shootT = 2.6; eshots.push({ x: e.x, y: e.y, vx: dx / d * 200, vy: dy / d * 200, life: 3, dmg: 5, col: e.look.shotCol }); }
    }
    e.walking = dir !== 0;
    e.x += dx / d * e.sp * dir * dt; e.y += dy / d * e.sp * dir * dt;
    if (e.dmg && d < e.r + p.r) hurtPlayer(e.dmg * dt);
  }
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j], dx = b.x - a.x, m = a.r + b.r;
      if (dx > m || dx < -m) continue;
      const dy = b.y - a.y; if (dy > m || dy < -m) continue;
      const d = Math.hypot(dx, dy) || .01;
      if (d < m) { const o = (m - d) / d, ta = b.mass / (a.mass + b.mass), tb = 1 - ta; a.x -= dx * o * ta; a.y -= dy * o * ta; b.x += dx * o * tb; b.y += dy * o * tb; }
    }
  }

  p.wT -= dt * p.rate * (p.buf[1] > 0 ? 1.2 : 1);
  if (p.wT <= 0 && p.rev === undefined) p.wT = tagRun(p.wLvl >= 5, fireWeapon) ? CHARS[p.kind].cd : .1;
  if (p.rev === undefined) for (const id in p.ab) {
    const a = AB[id]; if (a.passive) continue;
    p.abT[id] -= dt * p.rate * (p.buf[1] > 0 ? 1.2 : 1);
    if (p.abT[id] <= 0) p.abT[id] = tagRun(!a.evo && p.ab[id] >= 5, () => a.fire(p.ab[id])) === false ? .3 : a.cd(p.ab[id]);
  }
  for (const q of timers) { q.delay -= dt; if (q.delay <= 0) { tagRun(q.mx, q.fn); q.done = true; } }
  timers = timers.filter(q => !q.done);

  // Doppelgänger
  for (const c of allies) {
    c.life -= dt; c.animT += dt; c.atkT -= dt; c.pose -= dt;
    const e = nearest(c.x, c.y, 420); c.moving = false;
    if (e) {
      const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy) || 1; c.face = dx >= 0 ? 1 : -1;
      if (d > 30 + e.r) { c.x += dx / d * 250 * dt; c.y += dy / d * 250 * dt; c.moving = true; }
      else if (c.atkT <= 0) { c.atkT = .45; c.pose = .2; area(c.x + dx / d * 16, c.y + dy / d * 16, 36, c.dmg, 'melee', 120); spark(e.x, e.y - 8, 4, '#ffd070', 200, .25, 3); sfx('punch'); }
    }
    if (c.life <= 0) spark(c.x, c.y, 10, 'rgba(240,240,240,.8)', 120, .6, 8, { dark: true });
  }
  allies = allies.filter(c => c.life > 0);

  for (const s of shots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (parts.length < 650 && Math.random() < (s.small ? .35 : .8)) spark(s.x, s.y, 1, s.trail || TRAIL[s.type], 40, s.type === 'fire' ? .45 : .3, s.type === 'purple' || s.type === 'mugetsu' ? 8 : s.type === 'fire' ? 7 : 4, { jit: s.r * .5, dark: s.type === 'mugetsu', g: s.type === 'fire' ? -80 : 0 });
    for (const e of enemies) {
      if (e.dead || s.hitS.has(e) || Math.hypot(e.x - s.x, e.y - s.y) > s.r + e.r) continue;
      s.hitS.add(e); hit(e, s.dmg, s.kind, s.kb || 60, s.x - s.vx * .05, s.y - s.vy * .05); s.left--;
      if (s.boom) {
        for (const o of enemies) if (o !== e && Math.hypot(o.x - s.x, o.y - s.y) < s.boom + o.r) hit(o, s.dmg * .6, s.kind, s.kb || 80, s.x, s.y);
        tagRun(s.mx, () => boom(s.x, s.y, s.boom, s.col, s.big)); sfx('boom'); if (s.big) shake = Math.max(shake, .22);
        if (s.vortex) fx.push({ type: 'vortex', x: s.x, y: s.y, R: s.boom, dps: 130, tick: 0, life: 1.6, max: 1.6 });
      }
      if (s.bounce > 0) {
        s.bounce--; s.left = 1; const n = nearest(s.x, s.y, 300, s.hitS);
        if (n) { const a = Math.atan2(n.y - s.y, n.x - s.x); s.vx = Math.cos(a) * 520; s.vy = Math.sin(a) * 520; s.life = .9; sfx('ball'); } else s.life = 0;
        break;
      }
      if (s.left <= 0) { s.life = 0; break; }
    }
  }
  shots = shots.filter(s => s.life > 0);

  for (const s of eshots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (p.rangedImmune) { if (d < 40) { s.life = 0; fx.push({ type: 'boom', x: s.x, y: s.y, R: 14, life: .3, max: .3, col: '120,220,255' }); spark(s.x, s.y, 4, '#9fe8ff', 120, .3, 3); } }
    else if (d < p.r + 5) { s.life = 0; hurtPlayer(s.dmg); }
    if (wn && s.life > 0) for (const w of walls) if (Math.hypot(s.x - w[0], s.y - w[1]) < 24) { s.life = 0; break; }
  }
  eshots = eshots.filter(s => s.life > 0);

  for (const f of fx) {
    f.life -= dt;
    if (f.type === 'blue' || f.type === 'vortex') {
      f.tick -= dt; const doT = f.tick <= 0; if (doT) f.tick = .25;
      for (const e of enemies) {
        const dx = f.x - e.x, dy = f.y - e.y, d = Math.hypot(dx, dy);
        if (d > f.R + e.r) continue;
        if (f.type === 'blue' && d > 6) { const pull = (e.type === 'boss' ? 30 : 170) * dt; e.x += dx / d * pull; e.y += dy / d * pull; }
        if (doT) hit(e, f.dps * .25, 'ranged');
      }
      if (parts.length < 600) { const a = rand(0, TAU); if (f.type === 'blue') spark(f.x + Math.cos(a) * f.R, f.y + Math.sin(a) * f.R, 1, '#8fd0ff', 260, .45, 4, { a: a + Math.PI, spread: .2, drag: 0 }); else spark(f.x, f.y, 1, '#e8fbff', f.R * 2.5, .4, 3); }
    } else if (f.type === 'beam') {
      f.tick -= dt;
      if (f.tick <= 0 && f.life < f.max - .12) {
        f.tick = .1; const ca = Math.cos(f.a), sa = Math.sin(f.a);
        for (const e of enemies) { const dx = e.x - p.x, dy = e.y - p.y, al = dx * ca + dy * sa; if (al > -10 && al < f.L && Math.abs(dy * ca - dx * sa) < f.w / 2 + e.r) hit(e, f.dps * .1, 'ranged', 50); }
        for (let i = 0; i < 4; i++) { const d = rand(30, f.L); spark(p.x + ca * d, p.y + sa * d, 1, '#bfe4ff', 160, .35, 4, { a: f.a + (Math.random() < .5 ? 1.57 : -1.57), spread: .4 }); }
      }
    } else if (f.type === 'rasengan') {
      f.tick -= dt; const x = p.x + Math.cos(f.a) * 52, y = p.y + Math.sin(f.a) * 52;
      if (f.tick <= 0) { f.tick = .15; area(x, y, f.R, f.dmg, 'melee', 50); spark(x, y, 3, '#bfe8ff', f.R * 5, .25, 3); }
    } else if (f.type === 'drop' && !f.done && f.life <= .25) {
      f.done = true; area(f.x, f.y, f.R, f.dmg, f.kind === 'roller' ? 'melee' : 'ranged', 320);
      boom(f.x, f.y, f.R, f.kind === 'roller' ? '255,220,90' : '140,220,255', true); boom(f.x, f.y, f.R * .6, '255,255,255', true); shake = .6; flash = .3; sfx('big');
    } else if (f.type === 'drop' && f.kind === 'genki' && parts.length < 600) {
      const a = rand(0, TAU), k = 1 - f.life / f.max, y = f.y - 460 * (1 - Math.min(1, k / .8) ** 2); spark(f.x + Math.cos(a) * 160, y + Math.sin(a) * 160, 1, '#bfeaff', 380, .4, 4, { a: a + Math.PI, spread: .1, drag: 0 });
    }
  }
  fx = fx.filter(f => f.life > 0);
  for (const q of parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; const dr = Math.max(0, 1 - q.drag * dt); q.vx *= dr; q.vy *= dr; }
  parts = parts.filter(q => q.life > 0);
  for (const x of texts) { x.life -= dt; x.y -= 40 * dt; }
  texts = texts.filter(x => x.life > 0);
  enemies = enemies.filter(e => !e.dead);

  for (const g of gems) {
    const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1;
    if (g.pull) { g.x += dx / d * Math.max(700, d * 3) * dt; g.y += dy / d * Math.max(700, d * 3) * dt; }
    else if (d < p.magnet) { g.x += dx / d * 430 * dt; g.y += dy / d * 430 * dt; }
    if (d < 22) { g.got = true; if (g.ball) { runBalls++; sfx('evo'); texts.push({ x: p.x, y: p.y - 44, v: '+1 Pokéball', life: 1.2, col: '255,120,120', big: true }); } else if (g.heal) { p.hp = Math.min(p.maxHp, p.hp + 30); sfx('heal'); } else { gainXp(g.v); sfx('pickup'); } }
  }
  gems = gems.filter(g => !g.got);
  if (gems.length > 240) {
    let n = gems.length - 200, carry = 0;
    gems = gems.filter(g => { if (n > 0 && !g.heal && !g.ball && !g.pull && Math.abs(g.x - p.x) + Math.abs(g.y - p.y) > 500) { carry += g.v; n--; return false; } return true; });
    if (carry) { const k = gems.find(g => !g.heal && !g.ball); if (k) k.v += carry; else gems.push({ x: p.x + 200, y: p.y, v: carry }); }
  }

  if (p.hp <= 0 && p.phoenix) { p.phoenix = false; p.rev = 0; p.hp = 1; p.inv = 9; p.dashT = 0; shake = .4; sfx('over'); }
  if (p.hp <= 0) {
    if (p.revives > 0) {
      p.revives--; p.hp = p.reviveFull ? p.maxHp : p.maxHp * .5; p.reviveFull = false; p.inv = 2.5;
      area(p.x, p.y, 260, 60, 'ranged', 900); boom(p.x, p.y, 260, '255,150,40', true); flash = .5; shake = .5; sfx('evo');
      fx.push({ type: 'item', icon: 'heart', label: 'Wiederbelebt!', x: p.x, y: p.y - 30, life: 1.8, max: 1.8 });
    } else {
      p.hp = 0;
      { const nb = bankRun(); $('stats').textContent = `${CHARS[p.kind].name} · Zeit ${fmt(t)} · Level ${p.level} · ${kills} Gegner besiegt · ${nb} Pokébälle gesammelt (gesamt ${SAVE.balls})`; }
      sfx('over'); setState('over'); return;
    }
  }
  if (pending > 0) showLevelUp();
}
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

// ================================================================ Rendern
function glow(x, y, R, c0, c1, c2) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, c0); g.addColorStop(.4, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
}
function crescent(x, y, R, a0, a1, thick, col) {
  if (a1 - a0 < .05) return;
  const am = (a0 + a1) / 2, c = 2 * (R - thick) - R * Math.cos((a1 - a0) / 2);
  ctx.beginPath(); ctx.arc(x, y, R, a0, a1);
  ctx.quadraticCurveTo(x + Math.cos(am) * c, y + Math.sin(am) * c, x + Math.cos(a0) * R, y + Math.sin(a0) * R);
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}
function bolt(x0, y0, x1, y1, col, wid, jag) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.floor(d / 28)), nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1);
  ctx.beginPath(); ctx.moveTo(x0, y0);
  for (let i = 1; i < n; i++) { const o = rand(-1, 1) * jag; ctx.lineTo(x0 + (x1 - x0) * i / n + nx * o, y0 + (y1 - y0) * i / n + ny * o); }
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = `rgba(${col},.45)`; ctx.lineWidth = wid * 3; ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = wid; ctx.stroke();
}
function fistShape(s, f) {
  ctx.fillStyle = INK; ctx.fillRect(-s / 2 - 3, -s / 2 - 3, s + 6, s + 6);
  ctx.fillStyle = f.col; ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.fillStyle = f.hi; ctx.fillRect(-s / 2 + s * .08, -s / 2 + s * .08, s * .55, s * .2);
  ctx.fillStyle = f.dk; ctx.fillRect(-s / 2, s * .3, s, s * .2);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = INK; ctx.fillRect(s * .28, -s / 2 + i * s / 4, s * .22 + 3, s / 4); ctx.fillStyle = i % 2 ? f.col : f.hi; ctx.fillRect(s * .28, -s / 2 + i * s / 4 + 2, s * .22, s / 4 - 3); }
  ctx.fillStyle = INK; ctx.fillRect(-s * .2 - 2, s * .14 - 2, s * .45 + 4, s * .22 + 4); ctx.fillStyle = f.hi; ctx.fillRect(-s * .2, s * .14, s * .45, s * .22);
}
const ROUND = { rasengan: 1, item: 1, drop: 1, merge: 1, stand: 1 }; // Effekte, die aufrecht statt flach am Boden gezeichnet werden
function fistFx(x, y, a, s, f, k) {
  ctx.fillStyle = `rgba(0,0,0,${.26 * Math.min(1, (1 - k) * 3)})`; ctx.beginPath(); ctx.ellipse(x, y + s * .75 + 12, s * .62, s * .45, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.scale(1, UPS); ctx.rotate(Math.atan2(Math.sin(a) * VK, Math.cos(a)));
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 3; i >= 1; i--) { ctx.globalAlpha = .16 * (1 - k); ctx.fillStyle = f.hi; ctx.fillRect(-s / 2 - i * s * .45, -s / 2, s, s); }
  ctx.globalAlpha = (1 - k) * .9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath();
  for (let i = -2; i <= 2; i++) { ctx.moveTo(-s * .7, i * s * .22); ctx.lineTo(-s * (1.5 + (i & 1) * .5), i * s * .22); } ctx.stroke();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, (1 - k) * 3);
  fistShape(s, f);
  if (k > .35) { // Einschlag-Stern
    const q = (k - .35) / .65; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const aa = i * TAU / 8 + .3; ctx.moveTo(s * .6 + Math.cos(aa) * s * (.3 + q * .5), Math.sin(aa) * s * (.3 + q * .5)); ctx.lineTo(s * .6 + Math.cos(aa) * s * (.7 + q * .9), Math.sin(aa) * s * (.7 + q * .9)); } ctx.stroke();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(s * .6, 0, s * (.4 + q * .9), 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
function render() {
  const sx = shake > 0 ? rand(-1, 1) * shake * 16 : 0, sy = shake > 0 ? rand(-1, 1) * shake * 16 : 0;
  const cx = p.x - W / 2 + sx, cy = p.y - H / 2 / VK + sy, list = [];
  UPS = 1 / VK; ctx.save(); ctx.scale(1, VK); drawGround(cx, cy, list);
  ctx.translate(-Math.round(cx), -Math.round(cy / 3) * 3);

  // ---------- Bodeneffekte
  drawFloorFx();
  for (const f of fx) {
    const k = 1 - f.life / f.max;
    if (f.type === 'blue') {
      const al = Math.min(1, f.life * 2);
      glow(f.x, f.y, f.R, `rgba(200,240,255,${.95 * al})`, `rgba(40,120,255,${.45 * al})`, 'rgba(20,60,200,0)');
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const q = (t * 1.3 + i / 4) % 1; ctx.strokeStyle = `rgba(200,235,255,${.8 * al * q})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.R * (1 - q), t * 3 + i, t * 3 + i + 4.5); ctx.stroke(); }
      ctx.fillStyle = `rgba(10,20,80,${al})`; ctx.beginPath(); ctx.arc(f.x, f.y, 12 + Math.sin(t * 20) * 2, 0, TAU); ctx.fill();
    } else if (f.type === 'vortex') {
      const al = Math.min(1, f.life * 2);
      glow(f.x, f.y, f.R, `rgba(255,255,255,${.5 * al})`, `rgba(170,225,255,${.3 * al})`, 'rgba(120,200,255,0)');
      ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const rr = f.R * (.2 + (i * .37 % 1) * .8), a0 = t * (9 + i) + i * 2; ctx.strokeStyle = `rgba(255,255,255,${.75 * al})`; ctx.lineWidth = 2 + i % 3; ctx.beginPath(); ctx.arc(f.x, f.y, rr, a0, a0 + 1.1); ctx.stroke(); }
      ctx.lineCap = 'butt';
    } else if (f.type === 'cone') {
      const R = f.R * Math.min(1, k * 3 + .15);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R); g.addColorStop(0, `rgba(255,255,255,${.9 * (1 - k)})`); g.addColorStop(.7, `rgba(255,220,150,${.6 * (1 - k)})`); g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, R, f.a - .7, f.a + .7); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * (1 - i * .3)})`; ctx.lineWidth = 8 - i * 2; ctx.beginPath(); ctx.arc(p.x, p.y, R * (1 - i * .18), f.a - .7, f.a + .7); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    } else if (f.type === 'stomp') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a + Math.PI / 2); ctx.globalAlpha = Math.min(1, f.life * 3);
      ctx.fillStyle = 'rgba(40,24,16,.65)'; ctx.beginPath(); ctx.ellipse(0, 0, f.R * .5, f.R * .8, 0, 0, TAU); ctx.fill();
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * f.R * .2, -f.R * .9 + Math.abs(i) * 6, f.R * .11, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(30,18,10,.8)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 7; i++) { const aa = i * .9 + f.x; ctx.moveTo(Math.cos(aa) * f.R * .5, Math.sin(aa) * f.R * .7); ctx.lineTo(Math.cos(aa + .2) * f.R * 1.1, Math.sin(aa + .2) * f.R * 1.2); } ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = `rgba(240,220,190,${1 - k})`; ctx.lineWidth = 7 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.R * (.5 + k * .8), 0, TAU); ctx.stroke();
    } else if (f.type === 'drop') {
      const q = Math.min(1, k * 1.3); ctx.fillStyle = `rgba(0,0,30,${.35 * q})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.R * q * .7, f.R * q * .42, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${.5 * q})`; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(f.x, f.y, f.R, t * 2, t * 2 + TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (p.ab.ren >= 5) { const R = 120 * p.area; ctx.save(); ctx.translate(p.x, p.y); ctx.globalCompositeOperation = 'lighter'; ctx.rotate(t * 1.6); ctx.strokeStyle = 'rgba(255,215,90,.8)'; ctx.lineWidth = 5; ctx.setLineDash([10, 12]); ctx.beginPath(); ctx.arc(0, 0, R * .8, 0, TAU); ctx.stroke(); ctx.setLineDash([]); for (let i = 0; i < 3; i++) { const a = rand(0, TAU); if (Math.random() < .3) bolt(0, 0, Math.cos(a) * R, Math.sin(a) * R, '255,220,110', 1.5, 14); } ctx.restore(); ctx.globalCompositeOperation = 'source-over'; }
  if (p.ab.ren) { const R = (70 + 10 * p.ab.ren) * p.area, pu = 1 + Math.sin(t * 6) * .04; ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y, R * pu, 'rgba(255,255,200,0)', 'rgba(255,240,150,.10)', 'rgba(255,230,120,.22)'); ctx.strokeStyle = 'rgba(255,245,180,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, R * pu, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
  { // EXP-Kristalle: vorgezeichnete Bilder, nur im sichtbaren Bereich
    const x0 = cx - 50, x1 = cx + W + 50, y0 = cy - 80, y1 = cy + H / VK + 60;
    for (const g of gems) {
      if (g.x < x0 || g.x > x1 || g.y < y0 || g.y > y1) continue;
      const sp = gemSprite(g.ball ? 3 : g.heal ? 2 : g.v >= 5 ? 1 : 0), x = Math.round(g.x), gy = g.y + 8, bob = Math.sin(t * 5 + g.x) * 3;
      ctx.drawImage(sp.g, x - sp.gw / 2, gy - sp.gw / 2);
      ctx.drawImage(sp.u, x - sp.uw / 2, gy - (sp.uh - 6 - bob) * UPS, sp.uw, sp.uh * UPS);
    }
  }
  // dunkle Partikel (Rauch, Staub)
  for (const q of parts) if (q.dark) { const al = q.life / q.max, s = q.size * (.5 + (1 - al)); ctx.globalAlpha = al * .8; ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), s, s); }
  ctx.globalAlpha = 1;

  // ---------- Figuren, Truhen, Deko nach y sortiert
  for (const e of enemies) if (e.x > cx - 90 && e.x < cx + W + 90 && e.y > cy - 130 && e.y < cy + H / VK + 150) list.push(e);
  for (const c of chests) list.push(c); for (const c of allies) list.push(c);
  if (pet) list.push(pet); list.push(p); list.sort((a, b) => a.y - b.y);
  const lite = list.length > 110; // viele Figuren im Bild: einfache Schatten statt geworfener
  for (const e of list) {
    if (e.deco) { drawDeco(e); continue; }
    if (e === p) { drawPlayer(); continue; }
    if (e.pet) { drawPet(e); continue; }
    if (e.born !== undefined) {
      const bob = Math.round(Math.sin(t * 4 + e.x) * 2);
      ctx.globalCompositeOperation = 'lighter'; glow(e.x, e.y - 10, 46 + Math.sin(t * 5) * 6, 'rgba(255,240,150,.5)', 'rgba(255,220,90,.2)', 'rgba(255,200,60,0)'); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 14, 28, 15, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y + 18)); ctx.scale(1, UPS); ctx.drawImage(DECOR.chest, -30, -56 + bob, 60, 54); ctx.restore();
      if (parts.length < 600 && Math.random() < .08) spark(e.x + rand(-20, 20), e.y - 20, 1, '#fff2a0', 30, .7, 3, { a: -1.57, spread: .3, drag: 0 });
      continue;
    }
    if (e.life !== undefined) { // Doppelgänger
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 23, 12, 8, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = Math.min(.85, e.life * 2); drawChar(ctx, LOOK[p.kind], e.x, e.y + 23, PS, e.face, e.animT, e.moving, e.pose > 0, e.shadow ? 'z' : 'n'); ctx.globalAlpha = 1; continue;
    }
    if (e.prop) { drawProp(e); continue; }
    ctx.drawImage(BLOB, e.x - 14 * e.s, e.y + 12 * e.s, 28 * e.s, 20 * e.s);
    if (!lite || e.type === 'boss') castShadow(e.look, e.x, e.y + 22 * e.s, PS * e.s, e.face, e.animT, e.walking && e.frozen <= 0);
    drawChar(ctx, e.look, e.x, e.y + 22 * e.s, PS * e.s, e.face, e.animT, e.walking && e.frozen <= 0, false, e.hit > 0 ? 'w' : e.frozen > 0 ? 'z' : 'n');
    if (e.type === 'boss' && !e.ev) { const hh = -92 * e.s - 12; ctx.save(); ctx.translate(e.x, e.y + 22 * e.s); ctx.scale(1, UPS); ctx.fillStyle = INK; ctx.fillRect(-42, hh, 84, 10); ctx.fillStyle = '#e33'; ctx.fillRect(-40, hh + 2, 80 * Math.max(0, e.hp / e.maxHp), 6); txt(e.look.name, 0, hh - 8, 14, 'center'); ctx.restore(); }
  }
  // Eiserne Mauer
  const wl = p.ab.wall || 0, wn = wl ? 2 + (wl >= 3) + (wl >= 5) : 0;
  for (let i = 0; i < wn; i++) {
    const a = p.orb + i * TAU / wn, R = 80 * p.area;
    ctx.strokeStyle = 'rgba(127,224,208,.35)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(p.x, p.y, R, a - .7, a); ctx.stroke(); ctx.lineCap = 'butt';
    if (wl >= 5) { ctx.globalCompositeOperation = 'lighter'; glow(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 46, 'rgba(255,255,255,.7)', 'rgba(255,210,90,.4)', 'rgba(255,170,40,0)'); ctx.strokeStyle = 'rgba(255,220,110,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, R, a - 1.6, a); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.save(); ctx.translate(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); ctx.rotate(a);
    ctx.fillStyle = INK; ctx.fillRect(-9, -21, 18, 42); ctx.fillStyle = '#2f9c8f'; ctx.fillRect(-6, -18, 12, 36); ctx.fillStyle = '#7fe0d0'; ctx.fillRect(-6, -18, 4, 36); ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-2, -4, 6, 8);
    ctx.restore();
  }
  for (const s of eshots) { // Gegnergeschosse: vorgezeichnete Kugeln
    if (s.x < cx - 20 || s.x > cx + W + 20) continue;
    const im = ballImg(s.col ? s.col[0] : '#9a9aa4', s.col ? s.col[1] : '#e8e8f0');
    ctx.drawImage(BLOB, s.x - 9, s.y + 15, 18, 14); ctx.drawImage(im, s.x - 10, s.y - 10 * UPS, 20, 20 * UPS);
  }

  // ---------- Geschosse
  for (const s0 of shots) {
    shotShadow(s0); // Flugrichtung an die Schrägsicht anpassen, dann aufrecht zeichnen
    const s = Object.assign({}, s0, { vy: s0.vy * VK, a: Math.atan2(Math.sin(s0.a) * VK, Math.cos(s0.a)) }), ty = s.type; up(s.x, s.y); if (s.mx) maxShot(s);
    if (ty === 'red' || ty === 'ki') {
      const R = (s.small ? 12 : 20) * (s.r / 9) ** .5, c = s.cc || (ty === 'red' ? ['255,70,60', '255,0,0'] : ['255,225,80', '255,170,0']);
      ctx.globalCompositeOperation = 'lighter';
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx)); const g = ctx.createLinearGradient(-R * 3, 0, 0, 0); g.addColorStop(0, `rgba(${c[1]},0)`); g.addColorStop(1, `rgba(${c[0]},.7)`); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -R * .5); ctx.lineTo(-R * 3, 0); ctx.lineTo(0, R * .5); ctx.fill(); ctx.restore();
      glow(s.x, s.y, R * 1.3, '#ffffff', `rgba(${c[0]},.9)`, `rgba(${c[1]},0)`);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, R * .32, 0, TAU); ctx.fill();
    } else if (ty === 'fire') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) glow(s.x - s.vx * .03 * i + rand(-3, 3), s.y - s.vy * .03 * i + rand(-3, 3), s.r * (1.5 - i * .25), i ? 'rgba(255,200,80,.5)' : '#fff8d0', 'rgba(255,120,20,.55)', 'rgba(200,30,0,0)');
      ctx.globalCompositeOperation = 'source-over';
    } else if (ty === 'ball') {
      ctx.save(); ctx.translate(s.x, s.y);
      if (s.serve) { ctx.rotate(Math.atan2(s.vy, s.vx)); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-70, 0); ctx.lineTo(0, 10); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      ctx.rotate(t * 14);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f2c81e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 9, 0, 1.6); ctx.fill();
      ctx.fillStyle = '#2a58c0'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 9, 3.1, 4.7); ctx.fill();
      ctx.restore();
    } else if (ty === 'shuriken') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(t * 22);
      for (const [c, R] of [[INK, 14], ['#c8d0dc', 11]]) { ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? R * .32 : R, a = i * TAU / 8; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill(); ctx.restore();
    } else if (ty === 'rock' || ty === 'card') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a + t * (ty === 'rock' ? 6 : 18));
      if (ty === 'rock') { ctx.fillStyle = INK; ctx.fillRect(-9, -8, 18, 16); ctx.fillStyle = '#8a8478'; ctx.fillRect(-7, -6, 14, 12); ctx.fillStyle = '#b8b2a4'; ctx.fillRect(-7, -6, 8, 5); ctx.fillStyle = '#5e5a52'; ctx.fillRect(1, 2, 6, 4); }
      else { ctx.fillStyle = INK; ctx.fillRect(-10, -7, 20, 14); ctx.fillStyle = '#f8f4ee'; ctx.fillRect(-8, -5, 16, 10); ctx.fillStyle = '#d02848'; ctx.fillRect(-2, -2, 4, 4); }
      ctx.restore();
    } else if (ty === 'sushi') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.sin(t * 9 + s.a * 7) * .35);
      const v = s.v, F = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }, P = (c, pts) => { ctx.fillStyle = c; ctx.beginPath(); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.fill(); };
      if (v < 4) { // Nigiri: Lachs, Thunfisch, Garnele, Tamago
        const top = ['#ff7a4a', '#d8283a', '#ff9a6a', '#f8d040'][v], str = ['#ffd2b8', '#f06a78', '#fff4ec', '#fce88a'][v];
        F(INK, -14, -10, 28, 20); F('#f8f4ee', -11, -1, 22, 9); F('#d8d2c6', -11, 5, 22, 3); F(top, -12, -8, 24, 8);
        if (v === 3) { F(str, -12, -8, 24, 2); F(INK, -4, -10, 8, 20); F('#1f3a2a', -3, -9, 6, 17); }
        else { for (let i = 0; i < 4; i++) F(str, -9 + i * 6, -8, v === 2 ? 3 : 2, 8); if (v === 2) { F(INK, 12, -9, 8, 9); F('#ff5a3a', 12, -7, 6, 5); F('#ffb090', 14, -7, 1, 5); } }
      } else if (v < 7) { // Maki: Lachs, Gurke, Thunfisch
        const mid = ['#ff7a4a', '#6ac04a', '#d8283a'][v - 4];
        for (const [c, R] of [[INK, 12], ['#1f3a2a', 10], ['#f8f4ee', 7.5]]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); }
        F(mid, -3, -3, 6, 6); F('rgba(255,255,255,.45)', -3, -3, 3, 2); F('#e4ded0', -6, 2, 2, 2); F('#e4ded0', 4, -5, 2, 2);
      } else { // Sashimi: Lachs, Thunfisch
        const c = v === 7 ? '#ff7a4a' : '#d8283a', st = v === 7 ? '#ffd2b8' : '#f06a78';
        P(INK, [[-16, 10], [-9, -10], [16, -10], [9, 10]]); P(c, [[-13, 8], [-7, -8], [13, -8], [7, 8]]);
        for (let i = 0; i < 3; i++) { const x = -7 + i * 6; P(st, [[x - 2.5, 8], [x + 3.5, -8], [x + 5.5, -8], [x - .5, 8]]); }
        P('rgba(0,0,0,.18)', [[-13, 8], [-12, 5], [8, 5], [7, 8]]);
      }
      ctx.restore();
    } else if (ty === 'shard' || ty === 'knife') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx));
      if (ty === 'shard') { ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(0, -7); ctx.lineTo(-13, 0); ctx.lineTo(0, 7); ctx.fill(); ctx.fillStyle = '#3ad880'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(0, -4.5); ctx.lineTo(-10, 0); ctx.lineTo(0, 4.5); ctx.fill(); ctx.fillStyle = '#c8ffe0'; ctx.fillRect(-2, -2, 8, 2); }
      else { ctx.fillStyle = INK; ctx.fillRect(-14, -4, 30, 8); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-12, -2, 9, 4); ctx.fillStyle = '#e0e6ee'; ctx.beginPath(); ctx.moveTo(-3, -2.5); ctx.lineTo(14, 0); ctx.lineTo(-3, 2.5); ctx.fill(); }
      ctx.restore();
    } else if (ty === 'spear') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
      ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(-90, 0, -20, 0); g.addColorStop(0, 'rgba(255,200,80,0)'); g.addColorStop(1, 'rgba(255,240,180,.8)'); ctx.fillStyle = g; ctx.fillRect(-90, -4 - rand(0, 2), 70, 8 + rand(0, 4)); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = INK; ctx.fillRect(-24, -5, 46, 10); ctx.fillStyle = '#8a8f9a'; ctx.fillRect(-22, -3, 34, 6); ctx.fillStyle = '#c8ccd6'; ctx.fillRect(-22, -3, 34, 2); ctx.fillStyle = '#ffb030'; ctx.fillRect(12, -3, 8, 6);
      ctx.restore();
    } else if (ty === 'purple') {
      ctx.globalCompositeOperation = 'lighter';
      glow(s.x, s.y, s.r * 1.7, 'rgba(255,255,255,.9)', 'rgba(170,90,255,.7)', 'rgba(90,20,200,0)');
      for (let i = 0; i < 6; i++) { const a = t * 7 + i * 1.05; bolt(s.x + Math.cos(a) * s.r * .3, s.y + Math.sin(a) * s.r * .3, s.x + Math.cos(a + .6) * s.r * 1.3, s.y + Math.sin(a + .6) * s.r * 1.3, '200,150,255', 1.5, 10); }
      for (let i = 0; i < 2; i++) { const a = t * 10 + i * Math.PI; glow(s.x + Math.cos(a) * s.r * .85, s.y + Math.sin(a) * s.r * .85, 14, '#fff', i ? 'rgba(255,60,60,.9)' : 'rgba(60,120,255,.9)', 'rgba(0,0,0,0)'); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#f4e8ff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * .45, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a3ae0'; ctx.lineWidth = 4; ctx.stroke();
    } else if (ty === 'getsuga' || ty === 'mugetsu') {
      const R = s.r * 1.5, mu = ty === 'mugetsu';
      ctx.save(); ctx.translate(s.x - Math.cos(s.a) * R, s.y - Math.sin(s.a) * R);
      ctx.globalCompositeOperation = mu ? 'source-over' : 'lighter';
      for (let i = 3; i >= 1; i--) crescent(-Math.cos(s.a) * i * 14, -Math.sin(s.a) * i * 14, R, s.a - 1.1, s.a + 1.1, R * .3, mu ? `rgba(20,0,30,${.22 * (4 - i)})` : `rgba(80,160,255,${.12 * (4 - i)})`);
      ctx.globalCompositeOperation = 'source-over';
      crescent(0, 0, R + 5, s.a - 1.15, s.a + 1.15, R * .42, mu ? '#c02040' : '#0d1a3a');
      crescent(0, 0, R, s.a - 1.1, s.a + 1.1, R * .36, mu ? '#0a0410' : '#8fd6ff');
      crescent(0, 0, R - 2, s.a - .9, s.a + .9, R * .14, mu ? '#5a1a6a' : '#ffffff');
      ctx.restore();
    } else if (ty === 'rshuriken') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.globalCompositeOperation = 'lighter';
      glow(0, 0, s.r * 1.6, 'rgba(255,255,255,.9)', 'rgba(150,220,255,.5)', 'rgba(120,200,255,0)');
      ctx.rotate(t * 26); ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(s.r * 1.2, -s.r * .5, s.r * 1.9, 0); ctx.quadraticCurveTo(s.r, 2, 0, 6); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, s.r * .4, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7ad0ff'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- Effekte oben
  for (const f of fx) {
    const k = 1 - f.life / f.max, rb = ROUND[f.type];
    if (f.mx) maxFx(f, k);
    if (rb) up(f.x === undefined ? p.x : f.x, f.y === undefined ? p.y : f.y);
    if (bossFx(f, k)) { /* Boss-Technik gezeichnet */ } else if (f.type === 'boom') {
      boomFx(f, k);
    } else if (f.type === 'fist') {
      const s = f.R * .95, dist = 18 + 46 * Math.min(1, k * 2.4), x = p.x + Math.cos(f.a) * dist, y = p.y + Math.sin(f.a) * dist;
      if (f.aura) { ctx.globalCompositeOperation = 'lighter'; glow(x, y, s * 1.4, 'rgba(255,255,255,.8)', `rgba(${f.aura},.6)`, `rgba(${f.aura},0)`); ctx.globalCompositeOperation = 'source-over'; }
      fistFx(x, y, f.a, s, f, k);
    } else if (f.type === 'pop') {
      fistFx(f.x - Math.cos(f.a) * (1 - k) * 14, f.y - Math.sin(f.a) * (1 - k) * 14, f.a, f.s || 26, f, k);
    } else if (f.type === 'stand') {
      ctx.globalCompositeOperation = 'lighter'; glow(p.x + Math.cos(f.a) * 26, p.y + Math.sin(f.a) * 26 - 14, 40, `rgba(${f.col},${.5 * (1 - k)})`, `rgba(${f.col},${.25 * (1 - k)})`, `rgba(${f.col},0)`); ctx.globalCompositeOperation = 'source-over';
    } else if (f.type === 'slash') {
      const q = Math.min(1, k * 2.2), a0 = f.a - 1.25, a1 = a0 + 2.5 * q, al = Math.min(1, (1 - k) * 1.8);
      crescent(p.x, p.y + 18, f.R, a0, a1, f.R * .3, `rgba(0,0,0,${.2 * al})`);
      ctx.globalCompositeOperation = 'lighter';
      crescent(p.x, p.y - 8, f.R * .96, a1 - Math.min(2.5 * q, .9), a1, f.R * .1, `rgba(255,255,255,${.55 * al})`);
      for (let i = 0; i < 5; i++) { const aa = a0 + (a1 - a0) * (i + .5) / 5; ctx.strokeStyle = `rgba(${f.col},${.6 * al})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(aa) * f.R * 1.02, p.y + Math.sin(aa) * f.R * 1.02); ctx.lineTo(p.x + Math.cos(aa) * f.R * (1.12 + .2 * k), p.y + Math.sin(aa) * f.R * (1.12 + .2 * k)); ctx.stroke(); }
      crescent(p.x, p.y, f.R * 1.05, a0, a1, f.R * .5, `rgba(${f.col},${.35 * al})`);
      crescent(p.x, p.y, f.R, a1 - Math.min(2.5 * q, 1.6), a1, f.R * .34, `rgba(${f.col},${.75 * al})`);
      crescent(p.x, p.y, f.R, a1 - Math.min(2.5 * q, 1.1), a1, f.R * .16, `rgba(255,255,255,${al})`);
      ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, f.R, a0, a1); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else if (f.type === 'spin') {
      const al = Math.min(1, (1 - k) * 2), a0 = f.a + k * 8;
      ctx.fillStyle = `rgba(0,0,0,${.16 * al})`; ctx.beginPath(); ctx.ellipse(p.x, p.y + 22, f.R, f.R * .5, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.save(); ctx.translate(p.x, p.y + 20); ctx.scale(1, .5); ctx.strokeStyle = `rgba(200,255,220,${.6 * al})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, f.R * (.7 + k * .5), 0, TAU); ctx.stroke(); ctx.restore();
      for (let i = 0; i < 2; i++) { const b = a0 + i * Math.PI; crescent(p.x, p.y, f.R, b, b + 2.4, f.R * .4, `rgba(180,235,200,${.5 * al})`); crescent(p.x, p.y, f.R, b + 1.2, b + 2.4, f.R * .16, `rgba(255,255,255,${al})`); }
      ctx.strokeStyle = `rgba(255,255,255,${.7 * al})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, f.R * (.6 + k * .4), 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else if (f.type === 'beam') {
      const ch = Math.min(1, k / .11), fade = f.life < .18 ? f.life / .18 : 1, w = f.w * (ch < 1 ? .15 : 1) * fade * (1 + Math.sin(t * 70) * .07);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(f.a); ctx.globalCompositeOperation = 'lighter';
      if (ch < 1) { glow(26, 0, 16 + 30 * ch, '#ffffff', 'rgba(120,200,255,.9)', 'rgba(60,140,255,0)'); for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 9, d = 70 * (1 - ch) + 12; ctx.fillStyle = '#bfe8ff'; ctx.fillRect(26 + Math.cos(a) * d - 2, Math.sin(a) * d - 2, 4, 4); } }
      else {
        let g = ctx.createLinearGradient(0, -w, 0, w); g.addColorStop(0, 'rgba(40,110,255,0)'); g.addColorStop(.5, 'rgba(70,160,255,.55)'); g.addColorStop(1, 'rgba(40,110,255,0)');
        ctx.fillStyle = g; ctx.fillRect(26, -w, f.L, w * 2);
        g = ctx.createLinearGradient(0, -w / 2, 0, w / 2); g.addColorStop(0, 'rgba(90,180,255,0)'); g.addColorStop(.3, 'rgba(140,210,255,.95)'); g.addColorStop(.5, '#ffffff'); g.addColorStop(.7, 'rgba(140,210,255,.95)'); g.addColorStop(1, 'rgba(90,180,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(26, 0);
        for (let x = 26; x <= f.L; x += 26) ctx.lineTo(x, -w / 2 * (1 + Math.sin(x * .05 - t * 40) * .16));
        for (let x = f.L; x >= 26; x -= 26) ctx.lineTo(x, w / 2 * (1 + Math.sin(x * .05 - t * 40 + 2) * .16));
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) { const x = 40 + ((t * 900 + i * f.L / 5) % f.L); ctx.beginPath(); ctx.ellipse(x, 0, 7, w * .62, 0, 0, TAU); ctx.stroke(); }
        glow(44, 0, w * .7, '#ffffff', 'rgba(130,205,255,.9)', 'rgba(60,140,255,0)');
      }
      ctx.restore(); ctx.globalCompositeOperation = 'source-over';
    } else if (f.type === 'drop' && !f.done) {
      const q = Math.min(1, k / .8), y = f.y - 460 * (1 - q * q);
      if (f.kind === 'genki') {
        const R = 24 + f.R * .42 * q; ctx.globalCompositeOperation = 'lighter';
        glow(f.x, y, R * 1.5, 'rgba(255,255,255,.9)', 'rgba(120,200,255,.6)', 'rgba(60,150,255,0)'); ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.arc(f.x, y, R * .75, 0, TAU); ctx.fill(); ctx.strokeStyle = '#6ac0ff'; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = 'rgba(120,200,255,.8)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(f.x, y, R * (.3 + i * .15), t * 6 + i * 2, t * 6 + i * 2 + 2.2); ctx.stroke(); }
      } else {
        ctx.save(); ctx.translate(f.x, y); ctx.rotate(-.25 + q * .25); const s = 2.6;
        ctx.fillStyle = INK; ctx.fillRect(-46 * s / 2 - 3, -30 * s / 2 - 3, 46 * s + 6, 30 * s + 6);
        ctx.fillStyle = '#f2c61e'; ctx.fillRect(-23 * s, -15 * s, 46 * s, 18 * s); ctx.fillStyle = '#fff0a0'; ctx.fillRect(-23 * s, -15 * s, 46 * s, 3 * s); ctx.fillStyle = '#a8801a'; ctx.fillRect(-23 * s, 0, 46 * s, 3 * s);
        ctx.fillStyle = '#2a2a36'; ctx.fillRect(-8 * s, -13 * s, 16 * s, 9 * s); ctx.fillStyle = '#7ac0e0'; ctx.fillRect(-6 * s, -12 * s, 12 * s, 6 * s);
        ctx.fillStyle = '#5a5a66'; ctx.fillRect(-23 * s, 3 * s, 18 * s, 12 * s); ctx.fillRect(5 * s, 3 * s, 18 * s, 12 * s); ctx.fillStyle = '#8a8a98'; ctx.fillRect(-23 * s, 3 * s, 18 * s, 3 * s); ctx.fillRect(5 * s, 3 * s, 18 * s, 3 * s);
        ctx.restore();
      }
    } else if (f.type === 'rasengan') {
      const x = p.x + Math.cos(f.a) * 52, y = p.y + Math.sin(f.a) * 52, R = f.R * Math.min(1, k * 5) * (f.life < .15 ? f.life / .15 : 1);
      ctx.globalCompositeOperation = 'lighter'; glow(x, y, R * 1.25, 'rgba(255,255,255,.95)', 'rgba(110,190,255,.7)', 'rgba(60,140,255,0)');
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const a0 = t * (16 + i * 2) + i * .8; ctx.strokeStyle = `rgba(255,255,255,${.5 + (i % 3) * .2})`; ctx.lineWidth = 2 + i % 2; ctx.beginPath(); ctx.ellipse(x, y, R * (.35 + i * .08), R * (.9 - i * .07), a0, 0, 2.6); ctx.stroke(); }
      ctx.lineCap = 'butt'; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, R * .28, 0, TAU); ctx.fill();
    } else if (f.type === 'zap') {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, f.life / f.max * 1.6); ctx.lineJoin = 'round';
      for (let i = 1; i < f.pts.length; i++) { ctx.save(); ctx.translate(f.pts[i][0], f.pts[i][1] + 26); ctx.scale(1, .42); glow(0, 0, f.big ? 90 : 46, `rgba(${f.col},.5)`, `rgba(${f.col},.2)`, `rgba(${f.col},0)`); ctx.restore(); bolt(f.pts[i - 1][0], f.pts[i - 1][1], f.pts[i][0], f.pts[i][1], f.col, f.big ? 5 : 2.5, f.big ? 22 : 13); if (f.big) bolt(f.pts[i - 1][0], f.pts[i - 1][1], f.pts[i][0], f.pts[i][1], f.col, 2, 40); glow(f.pts[i][0], f.pts[i][1], f.big ? 40 : 20, '#ffffff', `rgba(${f.col},.7)`, `rgba(${f.col},0)`); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } else if (f.type === 'line') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,220,90,${.6 * (1 - k)})`; ctx.lineWidth = 16 * (1 - k) + 2; ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 4 * (1 - k) + 1; ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
    } else if (f.type === 'merge') {
      const d = 46 * (1 - k), px = -Math.sin(f.a), py = Math.cos(f.a), x = p.x + Math.cos(f.a) * 40, y = p.y + Math.sin(f.a) * 40 - 8;
      ctx.globalCompositeOperation = 'lighter'; glow(x + px * d, y + py * d, 22, '#fff', 'rgba(255,60,60,.9)', 'rgba(255,0,0,0)'); glow(x - px * d, y - py * d, 22, '#fff', 'rgba(60,130,255,.9)', 'rgba(0,60,255,0)');
      if (k > .6) glow(x, y, 60 * (k - .6) / .4, '#fff', 'rgba(190,120,255,.9)', 'rgba(120,40,220,0)'); ctx.globalCompositeOperation = 'source-over';
    } else if (f.type === 'item') {
      const y = f.y - 30 - Math.min(1, k * 3) * 46, al = Math.min(1, f.life * 2.5);
      ctx.globalAlpha = al; ctx.globalCompositeOperation = 'lighter'; glow(f.x, y, 44, 'rgba(255,255,220,.7)', 'rgba(255,230,120,.3)', 'rgba(255,220,90,0)'); ctx.globalCompositeOperation = 'source-over';
      drawIcon(f.icon, f.x, y, 5); txt(f.label, f.x, y - 34, 18, 'center', '#ffe45a'); ctx.globalAlpha = 1;
    }
    if (rb) ctx.restore();
  }
  drawTopFx();
  // helle Partikel
  ctx.globalCompositeOperation = 'lighter';
  for (const q of parts) if (!q.dark && q.x > cx - 20 && q.x < cx + W + 20) { const al = q.life / q.max, s = Math.max(1, q.size * (.35 + .65 * al)); ctx.globalAlpha = Math.min(1, al * 1.4); ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), s, s); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center';
  for (const x of texts) {
    ctx.font = `700 ${x.big ? 22 : 16}px ${FONT}`; const al = Math.min(1, x.life * 2.2);
    ctx.save(); ctx.translate(x.x, x.y); ctx.scale(1, UPS);
    ctx.fillStyle = `rgba(26,20,32,${al})`; ctx.fillText(x.v, 2, 2); ctx.fillStyle = `rgba(${x.col},${al})`; ctx.fillText(x.v, 0, 0); ctx.restore();
  }
  ctx.restore(); UPS = 1;

  // ---------- Bildschirmeffekte
  for (const f of fx) {
    const k = 1 - f.life / f.max;
    if (f.type === 'void') {
      ctx.fillStyle = `rgba(10,5,30,${.7 * (1 - k)})`; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(W / 2, H / 2, k * Math.hypot(W, H) * .6, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
      for (let i = 0; i < 70; i++) { const h = hash(i, 7); ctx.fillRect(h % W, (h >> 8) % H, 3, 3); }
    } else if (f.type === 'tstop') {
      const R = Math.sin(Math.min(1, k * 1.15) * Math.PI) * Math.hypot(W, H) * .62;
      ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(0, R), 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(255,220,80,${1 - k})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(0, R), 0, TAU); ctx.stroke();
    } else if (f.type === 'dark') { ctx.fillStyle = `rgba(0,0,0,${.75 * (1 - k)})`; ctx.fillRect(0, 0, W, H); }
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(.45, flash * 1.1)})`; ctx.fillRect(0, 0, W, H); }
  if (p.hurtT > 0) { ctx.fillStyle = 'rgba(255,0,0,.14)'; ctx.fillRect(0, 0, W, H); }
  // Truhen-Wegweiser
  for (const c of chests) {
    const dx = c.x - p.x, dy = (c.y - p.y) * VK; if (Math.abs(dx) < W / 2 - 30 && Math.abs(dy) < H / 2 - 30) continue;
    const a = Math.atan2(dy, dx), m = 46, sc = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || .001), (H / 2 - m) / Math.abs(Math.sin(a) || .001)), x = W / 2 + Math.cos(a) * sc, y = H / 2 + Math.sin(a) * sc;
    ctx.drawImage(DECOR.chest, Math.round(x - 20), Math.round(y - 18), 40, 36);
    ctx.save(); ctx.translate(x + Math.cos(a) * 30, y + Math.sin(a) * 30); ctx.rotate(a); ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -11); ctx.lineTo(-6, 11); ctx.fill(); ctx.fillStyle = '#ffd23c'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-3, -7); ctx.lineTo(-3, 7); ctx.fill(); ctx.restore();
  }
  drawHud(); drawOverlay();
}
function drawPlayer() {
  ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 23, 13, 9, 0, 0, TAU); ctx.fill();
  if (p.rev === undefined) castShadow(LOOK[p.kind], p.x, p.y + 23, PS, p.face, p.animT, p.moving);
  ctx.globalCompositeOperation = 'lighter';
  if (p.auraBankai) glow(p.x, p.y - 8, 50, 'rgba(255,60,60,.35)', 'rgba(200,20,30,.3)', 'rgba(0,0,0,0)');
  if (p.auraSSJ) { glow(p.x, p.y - 8, 56, 'rgba(255,240,150,.4)', `rgba(255,220,60,${.32 + .12 * Math.sin(t * 14)})`, 'rgba(255,200,0,0)'); if (parts.length < 600 && Math.random() < .3) spark(p.x + rand(-16, 16), p.y + 16, 1, '#ffe45a', 90, .5, 4, { a: -1.57, spread: .2, drag: 0 }); }
  if (p.auraGod && Math.random() < .3) bolt(p.x + rand(-18, 18), p.y + rand(-30, 20), p.x + rand(-26, 26), p.y + rand(-34, 22), '120,200,255', 1.5, 6);
  if (p.kind === 'gojo') { ctx.strokeStyle = `rgba(120,220,255,${.3 + .12 * Math.sin(t * 4)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y - 6, 40, 0, TAU); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over';
  if (p.inv > 0 && Math.floor(t * 16) % 2) ctx.globalAlpha = .45;
  if (p.rev !== undefined) drawRevive(); else drawChar(ctx, LOOK[p.kind], p.x, p.y + 23, PS, p.face, p.animT, p.moving, p.atkT > 0, p.hurtT > 0 && Math.floor(t * 30) % 2 ? 'w' : 'n');
  ctx.globalAlpha = 1;
  if (p.kind === 'nam') { // kreisende Hanteln
    const l = wl(), n = 2 + (l >= 3) + (l >= 6), R = (62 + 5 * l) * p.area;
    for (let i = 0; i < n; i++) {
      const a = t * 5.5 + i * TAU / n, x = p.x + Math.cos(a) * R, y = p.y - 4 + Math.sin(a) * R;
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(220,228,240,.16)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(p.x, p.y - 4, R, a - .7, a); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,240,250,.3)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(p.x, p.y - 4, R, a - .35, a); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.save(); ctx.translate(x, y); ctx.scale(1, UPS); ctx.rotate(a + Math.PI / 2); ctx.scale(1.35, 1.35);
      ctx.fillStyle = INK; ctx.fillRect(-16, -9, 10, 18); ctx.fillRect(6, -9, 10, 18); ctx.fillRect(-8, -4, 16, 8);
      ctx.fillStyle = '#aab2c0'; ctx.fillRect(-7, -2, 14, 4); ctx.fillStyle = '#e4e9f0'; ctx.fillRect(-7, -2, 14, 1);
      ctx.fillStyle = '#2c2f3a'; ctx.fillRect(-14, -7, 6, 14); ctx.fillRect(8, -7, 6, 14); ctx.fillStyle = '#5a6070'; ctx.fillRect(-14, -7, 6, 3); ctx.fillRect(8, -7, 6, 3);
      ctx.restore();
    }
  }
}
function bar(x, y, w, h, frac, col) {
  ctx.fillStyle = INK; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#3a3048'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), 3);
}
function txt(s, x, y, size, align, col) {
  ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align || 'left';
  ctx.fillStyle = INK; ctx.fillText(s, x + 2, y + 2); ctx.fillStyle = col || '#fff'; ctx.fillText(s, x, y);
}
function drawHud() {
  const w0 = W, h0 = H; ctx.save(); ctx.scale(1 / Z, 1 / Z); W = Math.round(W * Z); H = Math.round(H * Z); // HUD in Originalgröße
  bar(3, 3, W - 6, 10, p.xp / p.xpNext, '#59c8ff');
  bar(18, 30, Math.min(210, Math.round(W * .33)), 16, p.hp / p.maxHp, '#e03a3a');
  txt(`${Math.ceil(p.hp)} / ${p.maxHp}`, 24, 44, 14);
  bar(18, 53, Math.min(210, Math.round(W * .33)), 4, 1 - Math.max(0, p.dashCd) / 2.5, p.dashCd > 0 ? '#6a7a9a' : '#7fe0ff');
  txt(`${CHARS[p.kind].name} · Lv ${p.level}`, 16, 72, 18);
  let y = 94; txt(`${CHARS[p.kind].weapon} ${p.wLvl >= 5 ? 'MAX' : p.wLvl}`, 16, y, 14, 'left', '#ffd23c'); y += 18;
  for (const id in p.ab) { txt(AB[id].evo ? `★ ${AB[id].name}` : `${AB[id].name} ${p.ab[id] >= 5 ? 'MAX' : p.ab[id]}`, 16, y, 14, 'left', AB[id].evo ? '#ffd23c' : '#e8e0ff'); y += 18; }
  txt(fmt(t), W / 2, 48, 30, 'center');
  txt(`Besiegt: ${kills}`, W - 16, 44, 18, 'right');
  y = 66; txt(`Pokébälle: ${runBalls}`, W - 16, y, 13, 'right', '#ff9a9a'); y += 16;
  if (pet) { const sv = pet.sv, mx = sv.l >= PET_MAXLV; txt(`${pet.form.name} Lv ${sv.l}${mx ? ' MAX' : ''}`, W - 16, y, 13, 'right', RAR[pet.form.P.rar].col); y += 6; bar(W - 106, y, 90, 5, mx ? 1 : sv.x / PET_KILLS, '#ffd23c'); y += 18; }
  for (const id in p.up) { txt(`${STATS[id].name} ${p.up[id]}`, W - 16, y, 13, 'right', '#bfe8c8'); y += 16; }
  if (p.revives > 0) { txt(`Wiederbelebung x${p.revives}`, W - 16, y, 13, 'right', '#ff9ab0'); y += 16; }
  if (p.phoenix) txt('Phönix bereit', W - 16, y, 13, 'right', '#ffd23c');
  if (joy) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(joy.x0, joy.y0, 40, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(joy.x, joy.y, 14, 0, TAU); ctx.fill(); }
  W = w0; H = h0; ctx.restore();
}

// ================================================================ Menüs
const previews = [];
for (const id in CHARS) {
  const c = CHARS[id], d = document.createElement('div'); d.className = 'card';
  d.innerHTML = `<canvas width="96" height="100"></canvas><h3>${c.name}</h3><span class="tag ${c.tag}">${c.anime}</span>${c.villain ? ' <span class="tag vil">Bösewicht</span>' : ''}<p><b>${c.weapon}</b><br>${c.wdesc}</p><p class="perk">${c.perk}</p><p class="key">Leben ${c.hp + 20} · Tempo ${c.speed}</p>`;
  d.onclick = () => { sfx('click'); newGame(id); };
  $('chars').appendChild(d);
  const g = d.querySelector('canvas').getContext('2d'); g.imageSmoothingEnabled = false;
  previews.push({ id, c: g });
}
function drawMenu(time) {
  drawGround(time * 24, time * 10, null);
  if (state === 'select') for (const pv of previews) {
    const c = pv.c; c.clearRect(0, 0, 96, 100);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(48, 94, 16, 5, 0, 0, TAU); c.fill();
    drawChar(c, LOOK[pv.id], 48, 94, 2, 1, time, true, (time % 2.4) < .35, 'n');
  }
}
const click = (id, fn) => { $(id).onclick = () => { initAudio(); sfx('click'); fn(); }; };
click('bPlay', () => setState('select'));
click('bSet', () => { setReturn = 'main'; setState('settings'); });
click('bGood', () => { }); // echter Link in index.html, hier nur der Klick-Ton
click('bSet2', () => { setReturn = 'pause'; setState('settings'); });
click('bBack1', () => setState('main'));
click('bBack2', () => setState(setReturn));
click('bResume', () => setState('play'));
click('bQuit', () => { bankRun(); setState('main'); });
click('bMenu', () => setState('main'));
click('bRetry', () => newGame(lastKind));
click('bReroll', reroll);
for (const [id, key] of [['vMaster', 'master'], ['vMusic', 'music'], ['vSfx', 'sfx']]) {
  const el = $(id), out = $(id + 'N');
  el.value = Math.round(settings[key] * 100); out.textContent = el.value;
  el.oninput = () => { initAudio(); settings[key] = el.value / 100; out.textContent = el.value; applyVolume(); saveSettings(); };
  el.onchange = () => sfx('click');
}

// ================================================================ Volumen-Schattierung
// Licht von links oben: jede Sprite-Zeile wird wie ein Zylinder schattiert, Kanten bekommen Licht- und Schattenseite.
function bevel(c) {
  const w = c.width, h = c.height, g = c.getContext('2d'), img = g.getImageData(0, 0, w, h), d = img.data;
  const A = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0, f = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (A(x, y)) { if (l < 0) l = x; r = x; }
    if (l < 0) continue;
    for (let x = l; x <= r; x++) {
      if (!A(x, y)) continue;
      const u = r > l ? (x - l) / (r - l) : .5; let m = 1.1 - .3 * Math.pow(u, 1.6);
      if (!A(x - 1, y) || !A(x, y - 1)) m += .12;
      if (!A(x + 1, y) || !A(x, y + 1)) m -= .2; else if (!A(x + 2, y) || !A(x, y + 2)) m -= .08;
      f[y * w + x] = Math.round(m / .07) * .07;
    }
  }
  for (let i = 0; i < w * h; i++) if (f[i]) for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.min(255, d[i * 4 + k] * f[i]);
  g.putImageData(img, 0, 0);
}
const S = (w, h, fn, plain) => { const c = mk(w, h), g = c.getContext('2d'); fn((x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, g); if (!plain) bevel(c); outline(c); return c; };

// ================================================================ Welten (zufällig verteilte Anime-Gebiete)
function mkGround(base, specks, extra) {
  const c = mk(GT, GT), g = c.getContext('2d'); let s = 777 + parseInt(base.slice(1), 16);
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  g.fillStyle = base; g.fillRect(0, 0, GT, GT);
  const px = (x, y, col, w = 1, h = 1) => { g.fillStyle = col; for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) g.fillRect(((x + a) % GT + GT) % GT, ((y + b) % GT + GT) % GT, 1, 1); };
  for (let i = 0; i < 30; i++) { const x = rnd() * GT | 0, y = rnd() * GT | 0, col = specks[i % specks.length]; for (let k = 0; k < 8; k++) px(x + (rnd() * 6 | 0), y + (rnd() * 4 | 0), col); }
  if (extra) extra(px, rnd);
  return c;
}
const mkTree = (c1, c2, c3, c4, tr = '#6a4a2a') => S(34, 44, (r, g) => { r(14, 26, 6, 15, tr); r(18, 26, 2, 15, shade(tr, .7)); disc(g, 17, 16, 14, 13, c1); disc(g, 15, 13, 11, 9, c2); disc(g, 12, 10, 6, 4, c3); disc(g, 22, 22, 5, 3, c4); }, true);
const BIOMES = [
  { name: 'Walinsel', anime: 'Hunter x Hunter', ground, decor: [DECOR.tree, DECOR.bush, DECOR.rock] },
  { name: 'Wald von Konoha', anime: 'Naruto',
    ground: mkGround('#3f8a45', ['#357a3c', '#4a9a50'], (px, rnd) => { for (let i = 0; i < 14; i++) { const x = rnd() * GT | 0, y = rnd() * GT | 0; px(x, y, i % 2 ? '#d8862a' : '#b85a1e', 2, 1); px(x + 1, y + 1, '#8a4a1a'); } for (let i = 0; i < 5; i++) px(rnd() * GT | 0, rnd() * GT | 0, '#7a6238', 4, 2); }),
    decor: [mkTree('#1f6a34', '#2c8040', '#48a050', '#17502a'),
      S(14, 30, r => { r(4, 4, 6, 24, '#8a6238'); r(8, 4, 2, 24, '#6a4826'); r(3, 8, 8, 2, '#d8d0b8'); r(3, 14, 8, 2, '#d8d0b8'); r(5, 10, 4, 4, '#c03030'); r(2, 27, 10, 3, '#5a8a3a'); }), DECOR.bush] },
  { name: 'Planet Namek', anime: 'Dragon Ball Z',
    ground: mkGround('#4aa7a0', ['#3f968f', '#5cb8b0'], (px, rnd) => { for (let i = 0; i < 36; i++) { const x = rnd() * GT | 0, y = rnd() * GT | 0; px(x, y, '#2f8078'); px(x + 1, y - 1, '#7ad0c4'); px(x + 2, y, '#2f8078'); } px(40, 20, '#3a78c0', 7, 3); px(41, 19, '#5a9ae0', 5, 1); }),
    decor: [S(22, 46, (r, g) => { r(10, 16, 3, 28, '#7a8a6a'); r(12, 16, 1, 28, '#5a6a4e'); disc(g, 11, 10, 9, 8, '#2f9a8a'); disc(g, 9, 8, 6, 5, '#48b8a4'); disc(g, 7, 6, 3, 2, '#7ad8c4'); }, true),
      S(16, 30, r => { r(6, 2, 4, 26, '#7a9aa0'); r(4, 10, 8, 18, '#7a9aa0'); r(2, 20, 12, 8, '#6a8a90'); r(6, 2, 2, 24, '#a0c0c4'); }), DECOR.rock] },
  { name: 'Shibuya', anime: 'Jujutsu Kaisen',
    ground: mkGround('#3c3e48', ['#363842', '#444752'], (px, rnd) => { px(30, 6, '#d8d8d0', 3, 16); px(30, 38, '#d8d8d0', 3, 16); for (let i = 0; i < 4; i++) { let x = rnd() * GT | 0, y = rnd() * GT | 0; for (let k = 0; k < 10; k++) { px(x, y, '#24262e'); x += rnd() < .6 ? 1 : 0; y += rnd() < .5 ? 1 : 0; } } }),
    decor: [S(14, 46, r => { r(6, 8, 2, 36, '#4a4c56'); r(4, 42, 6, 3, '#3a3c44'); r(2, 4, 10, 4, '#5a5c66'); r(3, 8, 8, 2, '#fff2a0'); }),
      S(12, 14, r => { r(5, 1, 2, 3, '#f07a1a'); r(4, 4, 4, 3, '#f4f4f4'); r(3, 7, 6, 3, '#f07a1a'); r(1, 10, 10, 3, '#2a2a30'); }),
      S(22, 12, r => { r(2, 6, 18, 5, '#55575f'); r(5, 3, 8, 4, '#6a6c76'); r(14, 4, 5, 3, '#44464e'); r(6, 2, 3, 1, '#8a8c96'); })] },
  { name: 'Hueco Mundo', anime: 'Bleach',
    ground: mkGround('#d9d5c8', ['#ccc7b8', '#e6e2d6'], (px, rnd) => { for (let i = 0; i < 12; i++) { const x = rnd() * GT | 0, y = rnd() * GT | 0; px(x, y, '#bfb9a8', 6, 1); px(x + 2, y + 1, '#bfb9a8', 6, 1); } }),
    decor: [S(26, 36, r => { r(12, 12, 3, 22, '#e8e4dc'); r(6, 6, 2, 10, '#e8e4dc'); r(6, 14, 7, 2, '#e8e4dc'); r(18, 3, 2, 12, '#e8e4dc'); r(14, 13, 6, 2, '#e8e4dc'); r(3, 4, 3, 2, '#e8e4dc'); r(20, 1, 3, 2, '#e8e4dc'); r(14, 12, 1, 22, '#b8b4a8'); }),
      S(18, 13, (r, g) => { disc(g, 9, 7, 7, 4, '#c8c4b8'); disc(g, 7, 5, 4, 2, '#e8e4dc'); }, true),
      S(12, 18, r => { r(2, 2, 8, 14, '#d8d4c8'); r(1, 1, 10, 3, '#e8e4dc'); r(1, 14, 10, 3, '#b8b4a8'); r(7, 4, 2, 10, '#b8b4a8'); })] },
  { name: 'Shiganshina', anime: 'Attack on Titan',
    ground: mkGround('#8c8478', ['#847c70', '#948c80'], px => { for (let y = 0; y < GT; y += 8) { for (let x = 0; x < GT; x++) { px(x, y, '#5e574e'); px(x, y + 1, '#a09888'); } for (let x = (y / 8 % 2) * 6; x < GT; x += 12) px(x, y, '#5e574e', 1, 8); } }),
    decor: [S(44, 44, r => { r(4, 18, 36, 24, '#d8cdb0'); r(4, 18, 36, 2, '#6a4a2a'); r(4, 30, 36, 2, '#6a4a2a'); r(4, 18, 2, 24, '#6a4a2a'); r(38, 18, 2, 24, '#6a4a2a'); r(20, 18, 2, 24, '#6a4a2a'); for (let i = 0; i < 8; i++) r(1 + i * 3, 16 - i * 2, 42 - i * 6, 2, i % 2 ? '#a04a32' : '#b85a3c'); r(9, 34, 7, 8, '#5a3a1e'); r(26, 23, 8, 6, '#7ab0d0'); r(29, 23, 1, 6, '#6a4a2a'); }, true),
      S(12, 15, r => { r(2, 1, 8, 13, '#8a5a30'); r(1, 3, 10, 9, '#8a5a30'); r(1, 4, 10, 1, '#3a3a40'); r(1, 10, 10, 1, '#3a3a40'); r(3, 1, 2, 13, '#a8743e'); }),
      S(14, 13, r => { r(1, 1, 12, 11, '#a8743e'); r(1, 1, 12, 2, '#c08a4a'); r(1, 1, 2, 11, '#7a5228'); r(11, 1, 2, 11, '#7a5228'); r(1, 10, 12, 2, '#7a5228'); r(3, 3, 8, 1, '#7a5228'); })] },
  { name: 'Sporthalle Karasuno', anime: 'Haikyu!!',
    ground: mkGround('#d9a35a', ['#d09a52', '#e0ac64'], px => { for (let y = 0; y < GT; y += 8) { px(0, y, '#b8843e', GT, 1); px((y * 5) % GT, y, '#b8843e', 1, 8); } px(0, 0, '#f4f4f4', GT, 2); px(0, 0, '#f4f4f4', 2, GT); }),
    decor: [S(18, 18, r => { r(2, 6, 14, 8, '#3a5aa8'); r(2, 6, 14, 1, '#6a8ad8'); r(3, 14, 2, 3, '#2a2a30'); r(13, 14, 2, 3, '#2a2a30'); r(3, 2, 4, 4, '#f4f4f4'); r(8, 1, 4, 5, '#f2c81e'); r(12, 3, 3, 3, '#f4f4f4'); r(4, 3, 2, 2, '#2a58c0'); }),
      S(8, 8, (r, g) => { disc(g, 4, 4, 3, 3, '#f4f4f4'); r(4, 1, 3, 3, '#f2c81e'); r(1, 4, 3, 3, '#2a58c0'); }, true),
      S(26, 10, r => { r(1, 2, 24, 3, '#b8843e'); r(1, 2, 24, 1, '#d8a45e'); r(3, 5, 2, 4, '#5a5a66'); r(21, 5, 2, 4, '#5a5a66'); })] },
  { name: 'Wüste bei Kairo', anime: 'JoJo',
    ground: mkGround('#e0c07a', ['#d4b26a', '#ecd08e'], (px, rnd) => { for (let i = 0; i < 10; i++) { const x = rnd() * GT | 0, y = rnd() * GT | 0; px(x, y, '#b8985a', 2, 1); px(x, y - 1, '#f4e0a8', 2, 1); } for (let i = 0; i < 6; i++) px(rnd() * GT | 0, rnd() * GT | 0, '#c8a868', 8, 1); }),
    decor: [S(30, 46, r => { r(14, 16, 3, 28, '#a8824a'); r(16, 16, 1, 28, '#7a5a30'); for (let i = 0; i < 6; i++) r(14, 18 + i * 5, 3, 1, '#7a5a30'); r(4, 8, 10, 3, '#3a9a48'); r(16, 8, 10, 3, '#3a9a48'); r(2, 11, 6, 3, '#2f8040'); r(22, 11, 6, 3, '#2f8040'); r(8, 4, 6, 4, '#48b058'); r(16, 4, 6, 4, '#48b058'); r(12, 2, 6, 6, '#3a9a48'); r(1, 14, 3, 3, '#2f8040'); r(26, 14, 3, 3, '#2f8040'); }, true),
      S(14, 26, r => { r(3, 4, 8, 20, '#d8c090'); r(1, 22, 12, 3, '#c0a878'); r(2, 1, 10, 3, '#e8d4a8'); r(5, 4, 1, 18, '#b89a68'); r(8, 4, 1, 18, '#b89a68'); }),
      S(10, 12, r => { r(3, 1, 4, 2, '#b8683a'); r(2, 3, 6, 7, '#c87a48'); r(1, 5, 8, 3, '#c87a48'); r(2, 6, 6, 1, '#f0e0b0'); r(3, 10, 4, 1, '#8a4a28'); })] },
  { name: 'Stadt Z', anime: 'One Punch Man',
    ground: mkGround('#8a8c90', ['#828488', '#929498'], (px, rnd) => { px(0, 0, '#6a6c70', GT, 1); px(0, 0, '#6a6c70', 1, GT); px(0, 1, '#a0a2a6', GT, 1); for (let i = 0; i < 3; i++) { let x = rnd() * GT | 0, y = rnd() * GT | 0; for (let k = 0; k < 14; k++) { px(x, y, '#5a5c60'); x += rnd() < .6 ? 1 : 0; y += rnd() < .6 ? 1 : -1; } } for (let i = 0; i < 8; i++) px(rnd() * GT | 0, rnd() * GT | 0, '#6e7074', 2, 2); }),
    decor: [S(24, 24, r => { r(2, 6, 20, 17, '#9a9ca2'); r(2, 2, 6, 5, '#9a9ca2'); r(14, 4, 5, 3, '#9a9ca2'); r(2, 22, 20, 1, '#6e7076'); r(18, 8, 4, 15, '#7c7e84'); r(6, 10, 5, 4, '#3a3c44'); r(12, 16, 4, 1, '#6e7076'); }),
      S(10, 15, r => { r(3, 3, 4, 10, '#d02828'); r(2, 1, 6, 2, '#e84a4a'); r(1, 6, 8, 2, '#d02828'); r(2, 13, 6, 2, '#8a1818'); r(4, 7, 2, 2, '#f0c040'); }),
      S(26, 14, r => { r(2, 8, 22, 5, '#6e7076'); r(5, 4, 9, 5, '#86888e'); r(15, 5, 7, 4, '#5c5e64'); r(8, 2, 4, 3, '#9a9ca2'); r(19, 9, 2, 1, '#c06030'); r(4, 10, 3, 1, '#c06030'); })] },
];
let worldSeed = 1, curBiome = -1, banner = null, decals = [];
const BC = 18; // Gebietsgröße in Kacheln (rund 3500 Pixel)
function biomeAt(i, j) {
  i += BC / 2; j += BC / 2; // Startpunkt liegt mitten in einem Gebiet statt auf einer Ecke
  const ci = Math.floor(i / BC), cj = Math.floor(j / BC); let best = 0, bd = 1e9;
  for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) {
    const h = hash(a * 7 + worldSeed, b * 13 - worldSeed), sx = (a + .5) * BC + ((h & 255) / 255 - .5) * BC * .6, sy = (b + .5) * BC + (((h >> 8) & 255) / 255 - .5) * BC * .6, d = (sx - i) ** 2 + (sy - j) ** 2;
    if (d < bd) { bd = d; best = (h >>> 16) % BIOMES.length; }
  }
  return best;
}
// Bodenkacheln einmal auf Endgröße bringen: flach (192x192) für das Menü, gestaucht (192x128) für die Schrägsicht
const TILES = new Map();
function tileImg(src, squash) { let e = TILES.get(src); if (!e) { e = [null, null]; TILES.set(src, e); } if (!e[squash]) { const c = mk(TILE, squash ? TILE * VK : TILE), q = c.getContext('2d'); q.imageSmoothingEnabled = false; q.drawImage(src, 0, 0, c.width, c.height); e[squash] = c; } return e[squash]; }
function drawGround(cx, cy, deco) {
  if (room && deco) return drawArena(cx, cy, deco);
  const sq = UPS !== 1 ? 1 : 0, ky = sq ? VK : 1, tf = ctx.getTransform(); ctx.setTransform(1, 0, 0, 1, 0, 0); // Boden 1:1 ohne Skalierung zeichnen
  const i0 = Math.floor(cx / TILE), j0 = Math.floor(cy / TILE);
  for (let i = i0; i <= i0 + W / TILE + 1; i++) for (let j = j0 - 1; j <= j0 + H / VK / TILE + 1; j++) {
    const x = Math.round(i * TILE - cx), y = j * TILE - Math.round(cy / 3) * 3, B = BIOMES[biomeAt(i, j)];
    if (j >= j0) ctx.drawImage(tileImg(B.ground, sq), x, y * ky);
    const h = hash(i, j), k = h % 9;
    if (deco && k < 3) { const dy = j * TILE + 40 + (h >> 12) % 130; if (dy > cy - 20 && dy < cy + H / VK + 150) deco.push({ deco: B.decor[k], x: i * TILE + 30 + (h >> 4) % 130, y: dy }); }
  }
  ctx.setTransform(tf);
}
const say = (text, sub) => { banner = { text, sub, life: 3.2, max: 3.2 }; };

// ================================================================ 2,5D: Boden liegt schräg (VK), alles Aufrechte wird als stehendes Sprite gezeichnet
const DARK = new Map();
function dark(img) { let d = DARK.get(img); if (!d) { d = tinted(img, '#000000'); DARK.set(img, d); } return d; }
const LIGHT = new Map();
function lightImg(img) { let d = LIGHT.get(img); if (!d) { d = tinted(img, 'rgba(255,255,255,.85)'); LIGHT.set(img, d); } return d; }
function up(x, y) { ctx.save(); ctx.translate(x, y); ctx.scale(1, UPS); ctx.translate(-x, -y); } // danach ctx.restore()
function castShadow(L, x, y, sc, face, animT, moving) { // geworfener Schatten in Sprite-Form, Licht von links oben
  const fr = frames(L), fo = fr[0][moving ? Math.floor(animT * 9) % 4 : 0];
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(1, UPS); ctx.transform(1, 0, -.55, -.38, 0, 0); ctx.scale(face * sc, sc);
  ctx.globalAlpha *= .26; ctx.drawImage(dark(fo.n), -SW / 2, -(SH - 2)); ctx.restore();
}
function drawDeco(e) {
  const w = e.deco.width * 3, h = e.deco.height * 3;
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(1, UPS);
  ctx.save(); ctx.transform(1, 0, -.55, -.38, 0, 0); ctx.globalAlpha = .24; ctx.drawImage(dark(e.deco), -w / 2, -h, w, h); ctx.restore();
  ctx.drawImage(e.deco, -w / 2, -h, w, h); ctx.restore();
}

const BALLS = new Map();
function ballImg(c0, c1) { const k = c0 + c1; let c = BALLS.get(k); if (!c) { c = mk(20, 20); const q = c.getContext('2d'); q.fillStyle = INK; q.beginPath(); q.arc(10, 10, 9, 0, TAU); q.fill(); const gr = q.createRadialGradient(7, 7, 1, 10, 10, 7); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.4, c1); gr.addColorStop(1, c0); q.fillStyle = gr; q.beginPath(); q.arc(10, 10, 7, 0, TAU); q.fill(); BALLS.set(k, c); } return c; }
const GEMSPR = [];
function gemSprite(kind) { // 0 blau, 1 gold, 2 Heilung
  if (GEMSPR[kind]) return GEMSPR[kind];
  const c = ['90,200,255', '255,210,60', '90,255,140', '255,90,90'][kind], s = [7, 9, 10, 10][kind];
  const rg = (q, x, y, r, a0, a1) => { const gr = q.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${a0})`); gr.addColorStop(.4, `rgba(${c},${a1})`); gr.addColorStop(1, `rgba(${c},0)`); q.fillStyle = gr; q.beginPath(); q.arc(x, y, r, 0, TAU); q.fill(); };
  const gw = Math.ceil(s * 8), gc = mk(gw, gw), q = gc.getContext('2d');
  rg(q, gw / 2, gw / 2, gw / 2, .42, .16); q.fillStyle = 'rgba(0,0,0,.3)'; q.beginPath(); q.arc(gw / 2, gw / 2, s * .85, 0, TAU); q.fill();
  const uw = Math.ceil(s * 6), uh = Math.ceil(s * 6), uc = mk(uw, uh), u = uc.getContext('2d'), x = uw / 2, y = uh / 2;
  rg(u, x, y, uw / 2, .55, .18);
  const P = (col, pts) => { u.fillStyle = col; u.beginPath(); for (const m of pts) u.lineTo(x + m[0] * s, y + m[1] * s); u.fill(); };
  P('#ffffff', [[0, -1.5], [.95, -.5], [.95, .55], [0, 1.5], [-.95, .55], [-.95, -.5]]);
  P(INK, [[0, -1.3], [.8, -.45], [.8, .5], [0, 1.3], [-.8, .5], [-.8, -.45]]);
  P(`rgb(${c})`, [[0, -1.1], [.62, -.38], [.62, .42], [0, 1.1], [-.62, .42], [-.62, -.38]]);
  P('rgba(255,255,255,.6)', [[0, -1.1], [-.62, -.38], [-.62, .42], [0, .2]]);
  P('rgba(0,0,0,.28)', [[0, 1.1], [.62, .42], [.62, -.38], [0, .2]]);
  u.fillStyle = '#ffffff'; u.fillRect(x - s * .3, y - s * .55, 2, 3);
  if (kind) { u.fillRect(x + s * .7, y - s * 1.3, 2, 6); u.fillRect(x + s * .7 - 2, y - s * 1.3 + 2, 6, 2); }
  if (kind === 3) { // Pokéball statt Kristall
    u.clearRect(0, 0, uw, uh); rg(u, x, y, uw / 2, .5, .16); const r0 = s * 1.15;
    u.fillStyle = INK; u.beginPath(); u.arc(x, y, r0 + 2, 0, TAU); u.fill();
    u.fillStyle = '#f4f4f4'; u.beginPath(); u.arc(x, y, r0, 0, TAU); u.fill(); u.fillStyle = '#e03030'; u.beginPath(); u.arc(x, y, r0, Math.PI, TAU); u.fill();
    u.fillStyle = '#ff8a8a'; u.beginPath(); u.ellipse(x - r0 * .35, y - r0 * .5, r0 * .3, r0 * .16, -.5, 0, TAU); u.fill();
    u.fillStyle = 'rgba(0,0,0,.2)'; u.beginPath(); u.arc(x, y, r0, .1, 1.5); u.arc(x - 3, y - 3, r0, 1.5, .1, true); u.fill();
    u.fillStyle = INK; u.fillRect(x - r0, y - 1.5, r0 * 2, 3); u.beginPath(); u.arc(x, y, r0 * .36, 0, TAU); u.fill(); u.fillStyle = '#f4f4f4'; u.beginPath(); u.arc(x, y, r0 * .2, 0, TAU); u.fill();
  }
  return GEMSPR[kind] = { g: gc, gw, u: uc, uw, uh };
}

// ================================================================ Portal & Bossraum
const PORTAL_EVERY = 180;
let room = null, portal = null, nextPortal = PORTAL_EVERY, bossIdx = 0, tele = [], saved = null, dpsAvg = 0, dmgAcc = 0;
let nextB = null, lastB = null; // nextB nur noch für Test-Links; lastB verhindert denselben Boss zweimal hintereinander
let laters = [], curOwner = null, nextEvent = 60, hordeT = 0, zones = [], orbs = [], zoneT = 30, orbT = 15;
const BOSSLOOK = {
  igris: { id: 'igris', skin: '#7a1220', shirt: '#4a0c16', pants: '#2e0810', shoes: '#16060a', boots: true, glove: '#16060a', cape: '#1c0408', hairStyle: 'plume', hair: '#e02838', noEyes: true, sword: true },
  toji: { id: 'toji', skin: '#f0d2b6', shirt: '#17171d', pants: '#ebe8e0', shoes: '#17171d', shortSleeve: true, hairStyle: 'curtain', hair: '#16161c', eye: '#3a7a4a', scowl: true, blades: true },
  madara: { id: 'madara', skin: '#f0d6c0', shirt: '#1c2038', pants: '#1c2038', shoes: '#16161c', glove: '#16161c', hairStyle: 'madara', hair: '#16161c', eye: '#d02030', scowl: true },
};
BOSSLOOK.koku = { id: 'koku', skin: '#f0dcd0', shirt: '#5a3a8a', pants: '#18161e', shoes: '#f0ece0', hairStyle: 'koku', hair: '#2a1216', noEyes: true, sword: true };
const ringOf = (n, R, deco, a0 = 0, skip) => { const o = []; for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n; if (skip && skip(a)) continue; o.push({ deco, x: Math.cos(a) * R, y: Math.sin(a) * R }); } return o; };
const AR = 560;
const ARENAS = {
  igris: { void: '#0c0a12', rim: '#4a4656', rim2: '#c0283a',
    ground: mkGround('#2c2834', ['#26222e', '#322e3c'], px => { for (let i = 0; i < GT; i++) for (const o of [0, 32]) { px(i, o, '#1a1720'); px(o, i, '#1a1720'); px(i, o + 1, '#3c3848'); px(o + 1, i, '#3c3848'); } }),
    floor(R) { ctx.fillStyle = '#6a1220'; ctx.fillRect(-64, -R, 128, 2 * R); ctx.fillStyle = '#8a1a2a'; ctx.fillRect(-52, -R, 104, 2 * R); ctx.fillStyle = '#d8a838'; ctx.fillRect(-64, -R, 4, 2 * R); ctx.fillRect(60, -R, 4, 2 * R);
      ctx.strokeStyle = 'rgba(255,60,80,.35)'; ctx.lineWidth = 4; for (const q of [150, 170]) { ctx.beginPath(); ctx.arc(0, 0, q, 0, TAU); ctx.stroke(); } },
    deco: ringOf(12, AR - 60, S(16, 44, r => { r(3, 6, 10, 34, '#3a3644'); r(1, 2, 14, 5, '#4a4656'); r(1, 38, 14, 5, '#2a2632'); r(5, 6, 2, 32, '#565266'); r(10, 6, 3, 32, '#2a2632'); r(7, 14, 2, 2, '#c0283a'); }), TAU / 24, a => Math.abs(Math.cos(a)) < .2)
      .concat([{ x: 0, y: -AR + 120, deco: S(30, 44, r => { r(6, 2, 18, 30, '#2a2632'); r(8, 4, 14, 26, '#7a1422'); r(4, 0, 4, 34, '#3a3644'); r(22, 0, 4, 34, '#3a3644'); r(2, 26, 26, 10, '#3a3644'); r(6, 24, 18, 6, '#a01c2c'); r(2, 36, 26, 6, '#2a2632'); r(13, 6, 4, 4, '#d8a838'); }) }]) },
  toji: { void: '#10141a', rim: '#6a665c', rim2: '#c8302a',
    ground: mkGround('#aaa698', ['#a09c8e', '#b4b0a2'], px => { for (let y = 0; y < GT; y += 16) { px(0, y, '#86827a', GT, 1); px(0, y + 1, '#bcb8aa', GT, 1); for (const x of [0, 32]) px(x + (y / 16 % 2) * 16, y, '#86827a', 1, 16); } }),
    floor(R) { ctx.strokeStyle = 'rgba(70,66,58,.5)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, 230, 0, TAU); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 210, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(70,66,58,.35)'; ctx.fillRect(-44, -R, 88, R - 230); },
    deco: ringOf(10, AR - 50, S(12, 24, r => { r(4, 10, 4, 12, '#9a968a'); r(2, 21, 8, 2, '#7a766a'); r(1, 4, 10, 6, '#b0ac9e'); r(3, 5, 6, 4, '#ffe89a'); r(0, 2, 12, 2, '#7a766a'); r(4, 0, 4, 2, '#9a968a'); }), TAU / 20, a => Math.sin(a) < -.9)
      .concat([{ x: 0, y: -AR + 110, deco: S(60, 46, r => { r(2, 4, 56, 5, '#c8302a'); r(0, 1, 60, 4, '#2a2228'); r(8, 13, 44, 3, '#c8302a'); r(11, 9, 5, 35, '#c8302a'); r(44, 9, 5, 35, '#c8302a'); r(14, 9, 2, 35, '#8a1c18'); r(47, 9, 2, 35, '#8a1c18'); r(10, 41, 7, 4, '#2a2228'); r(43, 41, 7, 4, '#2a2228'); r(28, 9, 4, 4, '#2a2228'); }, true) }]) },
  madara: { void: '#1a120c', rim: '#5a4630', rim2: '#e88a30',
    ground: mkGround('#8c6c4c', ['#80603f', '#987858'], (px, rnd) => { for (let i = 0; i < 6; i++) { let x = rnd() * GT | 0, y = rnd() * GT | 0; for (let k = 0; k < 14; k++) { px(x, y, '#5a4028'); x += rnd() < .5 ? 1 : 0; y += rnd() < .6 ? 1 : 0; } } for (let i = 0; i < 10; i++) px(rnd() * GT | 0, rnd() * GT | 0, '#a88a68', 2, 1); }),
    floor() { for (let i = 0; i < 7; i++) { const h = hash(i, 91), x = (h % 800) - 400, y = ((h >> 10) % 800) - 400, r = 50 + (h >> 20) % 60; ctx.fillStyle = 'rgba(50,34,20,.4)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * .6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(40,26,14,.4)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 4, r * .7, r * .4, 0, 0, TAU); ctx.fill(); } },
    deco: ringOf(9, AR - 40, S(28, 22, (r, g) => { disc(g, 14, 12, 12, 8, '#7a6a5a'); disc(g, 11, 9, 8, 5, '#9a8a76'); disc(g, 8, 7, 3, 2, '#b8a892'); r(16, 16, 6, 1, '#5a4c40'); }, true), .3)
      .concat(ringOf(7, AR - 70, S(34, 20, r => { r(2, 14, 30, 5, '#6a4a2a'); r(6, 9, 8, 6, '#7a5632'); r(12, 4, 5, 7, '#7a5632'); r(15, 1, 3, 4, '#8a6238'); r(20, 10, 8, 5, '#6a4a2a'); r(26, 6, 3, 5, '#7a5632'); r(4, 15, 26, 1, '#4a3218'); }), 1)) },
};
ARENAS.koku = { void: '#0a0608', rim: '#3a2418', rim2: '#a070ff',
  ground: mkGround('#6a4a30', ['#62432a', '#735238'], px => { for (let y = 0; y < GT; y += 8) { px(0, y, '#4a321e', GT, 1); px(0, y + 1, '#7e5c3e', GT, 1); px((y * 7) % GT, y, '#4a321e', 1, 8); } }),
  floor(R) { for (let i = -2; i < 2; i++) for (let j = -1; j < 1; j++) { const x = i * 130 + 4, y = j * 190 + 4; ctx.fillStyle = '#2a2418'; ctx.fillRect(x - 3, y - 3, 128, 188); ctx.fillStyle = (i + j) & 1 ? '#a8a070' : '#b4ac7c'; ctx.fillRect(x, y, 122, 182); ctx.fillStyle = 'rgba(60,50,30,.18)'; for (let k = 6; k < 182; k += 6) ctx.fillRect(x, y + k, 122, 1); }
    ctx.strokeStyle = 'rgba(170,120,255,.3)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, R - 110, 0, TAU); ctx.stroke(); },
  deco: ringOf(12, AR - 55, S(16, 46, r => { r(4, 4, 8, 40, '#7a2a20'); r(2, 1, 12, 4, '#3a2418'); r(2, 42, 12, 3, '#3a2418'); r(6, 4, 2, 38, '#a04030'); r(10, 4, 2, 38, '#4a1810'); }), TAU / 24)
    .concat(ringOf(6, AR - 95, S(30, 40, r => { r(1, 1, 28, 38, '#3a2418'); for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) r(3 + i * 9, 3 + j * 9, 7, 7, '#f0e6c8'); r(3, 30, 25, 7, '#c8b890'); }, true), .5)) };
function drawArena(cx, cy, deco) {
  const A = room.B.ar, R = room.R, ox = -Math.round(cx), oy = -Math.round(cy / 3) * 3;
  ctx.fillStyle = A.void; ctx.fillRect(0, 0, W, H / VK + 2);
  ctx.save(); ctx.beginPath(); ctx.arc(ox, oy, R, 0, TAU); ctx.clip();
  const i0 = Math.floor(cx / TILE), j0 = Math.floor(cy / TILE);
  for (let i = i0; i <= i0 + W / TILE + 1; i++) for (let j = j0; j <= j0 + H / VK / TILE + 1; j++) ctx.drawImage(tileImg(A.ground, 0), i * TILE + ox, j * TILE + oy);
  ctx.translate(ox, oy); A.floor(R);
  const g = ctx.createRadialGradient(0, 0, R * .55, 0, 0, R); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = g; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.restore();
  ctx.strokeStyle = A.rim; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(ox, oy, R + 7, 0, TAU); ctx.stroke();
  ctx.strokeStyle = A.rim2; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ox, oy, R - 3, 0, TAU); ctx.stroke();
  for (const d of A.deco) deco.push(d);
}

// Ankündigungen: Form liegt 2-3 Sekunden sichtbar am Boden, dann schlägt der Angriff ein
function T(shape, delay, o) { delay = Math.min(2, delay); const q = Object.assign({ shape, delay, t: 0, own: curOwner, dmg: room ? room.dmg : 14 + t / 30, col: room ? room.B.col : curOwner ? curOwner.mb.col : '255,80,80' }, o); tele.push(q); return q; }
function inTele(q) {
  const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
  if (q.shape === 'circle') return d < q.R;
  if (q.shape === 'ring') return d > q.R0 && d < q.R;
  if (q.shape === 'cone') return d < q.R && angDiff(Math.atan2(dy, dx), q.a) < q.half;
  const ca = Math.cos(q.a), sa = Math.sin(q.a), al = dx * ca + dy * sa; return al > 0 && al < q.L && Math.abs(dy * ca - dx * sa) < q.w / 2;
}
function fireTele(q) {
  if (inTele(q)) hurtPlayer(q.dmg);
  shake = Math.max(shake, q.big ? .55 : .22); sfx(q.snd || 'boom'); if (q.big) flash = Math.max(flash, .3);
  const c = `rgb(${q.col})`;
  if (q.shape === 'circle') { boom(q.x, q.y, q.R, q.col, q.R > 120); if (q.big) boom(q.x, q.y, q.R * .6, '255,255,255', true); }
  else if (q.shape === 'ring') for (let i = 0; i < 14; i++) { const a = i * TAU / 14, d = (q.R0 + q.R) / 2; spark(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, 4, c, 260, .5, 5); }
  else if (q.shape === 'cone') for (let i = 0; i < 16; i++) { const a = q.a + rand(-q.half, q.half), d = rand(.2, 1) * q.R; spark(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, 3, c, 240, .5, 5, { a, spread: .4 }); }
  else for (let d = 20; d < q.L; d += 55) spark(q.x + Math.cos(q.a) * d, q.y + Math.sin(q.a) * d, 3, c, 220, .45, 5);
  teleVis(q);
  if (q.onFire) q.onFire();
}
const aimP = b => Math.atan2(p.y - b.y, p.x - b.x);
const later = (d, fn) => laters.push({ d, fn, own: curOwner });
function dashes(b, n, delay, gap, w, vis) { // Sprintkette: jeder Sprint wird einzeln kurz vorher angekündigt
  const st = { x: b.x, y: b.y };
  for (let i = 0; i < n; i++) later(i * gap, () => {
    if (b.dead) return;
    const a = Math.atan2(p.y - st.y, p.x - st.x); let ex = st.x + Math.cos(a) * 620, ey = st.y + Math.sin(a) * 620;
    if (room) { const d = Math.hypot(ex, ey), m = room.R - 50; if (d > m) { ex *= m / d; ey *= m / d; } }
    const x0 = st.x, y0 = st.y, x1 = ex, y1 = ey; st.x = ex; st.y = ey;
    T('line', delay, { x: x0, y: y0, a: Math.atan2(y1 - y0, x1 - x0), L: Math.hypot(x1 - x0, y1 - y0), w: w || 84, snd: 'slash', vis: vis || 'cut', onFire() { b.x = x1; b.y = y1; } });
  });
  return delay + (n - 1) * gap;
}
const shout = (b, s) => { texts.push({ x: b.x, y: b.y - 34 * b.s, v: s, life: 1.5, col: '255,236,170', big: true }); };
const fan = (b, n, step, delay, o) => { const a = aimP(b); for (let i = 0; i < n; i++) T('line', delay, Object.assign({ x: b.x, y: b.y, a: a + (i - (n - 1) / 2) * step, L: 760, w: 40 }, o)); };
const radial = (b, n, a0, delay, o) => { for (let i = 0; i < n; i++) T('line', delay, Object.assign({ x: b.x, y: b.y, a: a0 + i * TAU / n, L: 700, w: 34 }, o)); };
const cross = (n, a0, delay, o) => { for (let i = 0; i < n; i++) { const a = a0 + i * Math.PI / n; T('line', delay, Object.assign({ x: p.x - Math.cos(a) * 700, y: p.y - Math.sin(a) * 700, a, L: 1400, w: 66 }, o)); } };
const scatter = (n, R, spread, delay, o) => { for (let i = 0; i < n; i++) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * spread; T('circle', delay + i * .08, Object.assign({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, R }, o)); } return delay + n * .08; };
// Jede Ankündigung dauert höchstens 2 Sekunden; Folgeangriffe werden zeitversetzt neu angekündigt.
const BOSSES = [
  { id: 'igris', name: 'Igris', title: 'Blutroter Kommandant', anime: 'Solo Leveling', arena: 'Thronsaal', col: '255,50,70', sp: 105, ar: ARENAS.igris, atk: [
    (b, r) => { shout(b, 'Blitzhieb'); return dashes(b, r ? 4 : 2, 1.1, .45, 84, 'cut'); },
    (b, r) => { shout(b, 'Halbmondschnitt'); const a = aimP(b); T('cone', 1.4, { x: b.x, y: b.y, a, R: 350, half: .85, snd: 'slash', vis: 'slash' }); if (r) later(.6, () => T('cone', 1.2, { x: b.x, y: b.y, a: a + Math.PI, R: 350, half: .85, snd: 'slash', vis: 'slash' })); return r ? 1.8 : 1.4; },
    (b, r) => { shout(b, 'Erderschütterer'); const x = p.x, y = p.y; T('circle', 1.5, { x, y, R: 190, big: true, onFire() { b.x = x; b.y = y - 12; T('ring', 1.1, { x, y, R0: 190, R: r ? 470 : 400 }); } }); return 2.6; },
    (b, r) => { shout(b, 'Klingensturm'); const a0 = rand(0, TAU), n = r ? 6 : 4; for (let i = 0; i < n; i++) { const a = a0 + i * Math.PI / n; T('line', 1.5 + i * .08, { x: b.x - Math.cos(a) * 700, y: b.y - Math.sin(a) * 700, a, L: 1400, w: 62, snd: 'slash', vis: 'cut' }); } return 2; },
    (b, r) => { shout(b, 'Ritterfaust'); const n = r ? 5 : 3; for (let i = 0; i < n; i++) later(i * .45, () => T('circle', 1, { x: p.x, y: p.y, R: 115, snd: 'punch' })); return 1 + (n - 1) * .45; },
  ] },
  { id: 'toji', name: 'Toji Fushiguro', title: 'Zaubererkiller', anime: 'Jujutsu Kaisen', arena: 'Schreinhof der Jujutsu-Akademie', col: '120,255,170', sp: 135, ar: ARENAS.toji, atk: [
    (b, r) => { shout(b, 'Umgekehrter Himmelsspeer'); return dashes(b, r ? 5 : 3, 1, .4, 70, 'cut'); },
    (b, r) => { shout(b, 'Kette der tausend Meilen'); T('ring', 1.6, { x: b.x, y: b.y, R0: 150, R: 480, snd: 'slash' }); if (r) later(.9, () => T('circle', 1.2, { x: b.x, y: b.y, R: 200 })); return r ? 2.1 : 1.6; },
    (b, r) => { shout(b, 'Verspielte Wolke'); const n = r ? 5 : 3; for (let i = 0; i < n; i++) later(i * .5, () => T('circle', 1.2, { x: p.x, y: p.y, R: 150, snd: 'punch' })); return 1.2 + (n - 1) * .5; },
    (b, r) => { shout(b, 'Fluchgeist-Schwarm'); for (let i = 0; i < (r ? 14 : 9); i++) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 330; T('circle', 1.5 + i * .03, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, R: 82, col: '190,120,255', snd: 'zap' }); } return 2; },
    (b, r) => { shout(b, 'Seelenspalter-Katana'); cross(2, aimP(b) + Math.PI / 4, 1.3, { snd: 'slash', vis: 'cut' }); if (r) later(.7, () => cross(2, aimP(b), 1.2, { snd: 'slash', vis: 'cut' })); return r ? 1.9 : 1.3; },
  ] },
  { id: 'madara', name: 'Madara Uchiha', title: 'Geist der Uchiha', anime: 'Naruto', arena: 'Schlachtfeld des Ninjakriegs', col: '255,140,40', sp: 90, ar: ARENAS.madara, atk: [
    (b, r) => { shout(b, 'Katon: Goka Mekkyaku'); T('cone', 1.8, { x: b.x, y: b.y, a: aimP(b), R: 620, half: 1.05, snd: 'fire', vis: 'fire' }); if (r) later(1, () => T('cone', 1.5, { x: b.x, y: b.y, a: aimP(b), R: 620, half: .8, snd: 'fire', vis: 'fire' })); return r ? 2.5 : 1.8; },
    (b, r) => { shout(b, 'Tengai Shinsei'); const o = { R: 290, big: true, met: true, snd: 'big' }; T('circle', 2, Object.assign({ x: p.x, y: p.y, dmg: room.dmg * 1.6 }, o)); later(1, () => T('circle', 2, Object.assign({ x: p.x, y: p.y, dmg: room.dmg * 1.6 }, o))); return 3; },
    (b, r) => { shout(b, 'Susanoo'); const a0 = aimP(b) + .4, n = r ? 4 : 2; for (let i = 0; i < n; i++) later(i * .35, () => { const a = a0 + i * Math.PI / n; T('line', 1.5, { x: p.x - Math.cos(a) * 700, y: p.y - Math.sin(a) * 700, a, L: 1400, w: 150, col: '90,150,255', snd: 'slash', vis: 'beam' }); }); return 1.5 + (n - 1) * .35; },
    (b, r) => { shout(b, 'Mokuton: Kajukai Korin'); const n = r ? 14 : 10, x = p.x, y = p.y; for (let i = 0; i < n; i++) { const a = i * TAU / n; T('circle', 1.4 + i * .03, { x: x + Math.cos(a) * 210, y: y + Math.sin(a) * 210, R: 88, col: '150,220,90', vis: 'spike' }); } later(.8, () => T('circle', 1.1, { x: p.x, y: p.y, R: 125, col: '150,220,90', vis: 'spike' })); return 1.9; },
    (b, r) => { shout(b, 'Yasaka Magatama'); fan(b, r ? 7 : 5, .26, 1.3, { w: 56, col: '90,150,255', snd: 'zap', vis: 'beam' }); return 1.3; },
  ] },
  { id: 'koku', name: 'Kokushibo', title: 'Oberer Mond Eins', anime: 'Demon Slayer', arena: 'Unendlichkeitsfestung', col: '180,120,255', sp: 115, ar: ARENAS.koku, atk: [
    (b, r) => { shout(b, 'Erste Form: Dunkler Mond'); T('cone', 1.1, { x: b.x, y: b.y, a: aimP(b), R: 390, half: .9, snd: 'slash', vis: 'moon' }); if (r) later(.5, () => T('cone', 1, { x: b.x, y: b.y, a: aimP(b), R: 390, half: .9, snd: 'slash', vis: 'moon' })); return r ? 1.5 : 1.1; },
    (b, r) => { shout(b, 'Zweite Form: Perlblumen-Mondschau'); fan(b, r ? 5 : 3, .3, 1.3, { w: 72, snd: 'slash', vis: 'moon' }); return 1.3; },
    (b, r) => { shout(b, 'Fünfte Form: Unheilswirbel'); const x = b.x, y = b.y; T('circle', 1.4, { x, y, R: 290, snd: 'slash', vis: 'moon', onFire() { T('ring', 1, { x, y, R0: 290, R: r ? 540 : 470, snd: 'slash', vis: 'moon' }); } }); return 2.4; },
    (b, r) => { shout(b, 'Siebte Form: Unheilsspiegel'); fan(b, r ? 7 : 5, .2, 1.6, { L: 1000, w: 54, snd: 'slash', vis: 'moon' }); return 1.6; },
    (b, r) => { shout(b, 'Vierzehnte Form: Sichelmond-Katastrophe'); for (let i = 0; i < (r ? 18 : 13); i++) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 420; T('circle', 1.6 + i * .02, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, R: 92, snd: 'slash', vis: 'moon' }); } return 2; },
  ] },
];
function resetWorld() { nextB = null; lastB = null; worldSeed = (Math.random() * 1e6) | 0; curBiome = -1; banner = null; decals = []; room = null; portal = null; nextPortal = PORTAL_EVERY; bossIdx = 0; tele = []; saved = null; dpsAvg = 0; dmgAcc = 0; laters = []; curOwner = null; nextEvent = 60; hordeT = 0; zones = []; orbs = []; zoneT = 30; orbT = 15; broken = new Set(); propT = 0; }
function enterRoom() {
  const B = nextB || pick(BOSSES.filter(b => b !== lastB)), tier = 1 + Math.floor(bossIdx / BOSSES.length), dur = Math.min(45, 26 + 4 * bossIdx), hp = 70 * Math.pow(Math.max(t, 60) / 180, 1.6) * dur; // geplante Kampfdauer: 26 s beim 1. Boss, je Boss 4 s mehr, höchstens 45 s
  saved = { x: p.x, y: p.y, enemies, gems, chests, eshots };
  enemies = []; gems = []; chests = []; eshots = []; shots = []; fx = []; allies = []; timers = []; tele = []; decals = []; portal = null;
  p.x = 0; p.y = 200; p.inv = 1.5;
  const boss = { type: 'boss', ev: true, sp: 0, r: 26, dmg: 16 + 4 * tier, xp: 0, s: 2.2, mass: 1e9, hp, maxHp: hp, x: 0, y: -90, kx: 0, ky: 0, hit: 0, frozen: 0, wallT: 0, face: 1, animT: 0, shootT: 9, look: BOSSLOOK[B.id], dead: false, walking: true, cd: 2.2, hold: 0, atkI: 0 };
  enemies.push(boss);
  nextB = null; lastB = B;
  room = { B, boss, R: AR, tier, dmg: 24 + 8 * tier, done: 0, time: 0, weak: 1, dur, dealt: 0, first: -1, cal: false }; laters = []; hordeT = 0;
  flash = .6; shake = .3; sfx('evo'); say(B.name, `${B.anime} · ${B.arena}`);
}
function bossDown(b) {
  room.done = 3.2; tele = []; laters = []; flash = .6; shake = .7; sfx('big');
  boom(b.x, b.y, 220, room.B.col, true); boom(b.x, b.y, 130, '255,255,255', true);
  for (let i = 0; i < 24; i++) { const a = rand(0, TAU), d = rand(20, 150); gems.push({ x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, v: 5 }); }
  p.hp = p.maxHp; pending += 3; say('Sieg!', `${room.B.name} besiegt · volle Heilung · +3 Level`);
}
function exitRoom() {
  p.x = saved.x; p.y = saved.y; enemies = saved.enemies; gems = saved.gems; chests = saved.chests; eshots = saved.eshots;
  shots = []; fx = []; tele = []; decals = []; allies = []; timers = []; saved = null; room = null; bossIdx++; nextPortal = t + PORTAL_EVERY; nextEvent = (Math.floor(t / 60) + 1) * 60; laters = []; p.inv = 2.5; flash = .5; curBiome = -1;
  area(p.x, p.y, 240, 40, 'ranged', 700); boom(p.x, p.y, 240, '200,160,255', true);
}
function tickWorld(dt) {
  dpsAvg += (dmgAcc / Math.max(dt, .001) - dpsAvg) * Math.min(1, dt / 8); dmgAcc = 0; tickPet(dt);
  if (banner && (banner.life -= dt) <= 0) banner = null;
  for (let k = 0; k < 3; k++) p.buf[k] -= dt;
  for (const d of decals) d.life -= dt; decals = decals.filter(d => d.life > 0);
  for (const q of laters) if ((q.d -= dt) <= 0) { curOwner = q.own; q.fn(); curOwner = null; q.done = true; }
  laters = laters.filter(q => !q.done);
  for (const q of tele) { q.t += dt; if (!q.fired && q.t >= q.delay) { q.fired = true; fireTele(q); } }
  tele = tele.filter(q => q.t < q.delay + .35);
  if (!room) {
    tickEvents(dt);
    const b = biomeAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    if (b !== curBiome) { curBiome = b; if (!banner || banner.life < 2) say(BIOMES[b].name, BIOMES[b].anime); }
    if (!portal && t >= nextPortal) { const a = rand(0, TAU); portal = { x: p.x + Math.cos(a) * 300, y: p.y + Math.sin(a) * 300, born: t }; sfx('evo'); sfx('big'); flash = Math.max(flash, .35); shake = Math.max(shake, .35); say('Boss-Portal geöffnet!', 'Tritt hinein, um den Boss herauszufordern'); }
    if (portal && t - portal.born > 1 && Math.hypot(portal.x - p.x, portal.y - 20 - p.y) < 40) enterRoom();
    return;
  }
  const b = room.boss, lim = room.R - 26, pd = Math.hypot(p.x, p.y), bd = Math.hypot(b.x, b.y);
  if (pd > lim) { p.x *= lim / pd; p.y *= lim / pd; }
  if (bd > lim - 30) { b.x *= (lim - 30) / bd; b.y *= (lim - 30) / bd; }
  if (room.done) { for (const g of gems) g.pull = true; if ((room.done -= dt) <= 0) exitRoom(); return; }
  b.frozen = Math.min(b.frozen, .3);
  room.time += dt;
  // Nach 7 Sekunden echtem Kampf: Leben so anpassen, dass der Rest zur geplanten Dauer passt. Schwache Builds werden voll entlastet, starke nur zur Hälfte gebremst.
  if (!room.cal && room.first >= 0 && room.time - room.first >= 7) {
    room.cal = true; let k = room.dealt / 7 * (room.dur - 7) / Math.max(1, b.hp); k = k > 1 ? Math.min(1.8, Math.sqrt(k)) : Math.max(.15, k);
    b.hp *= k; b.maxHp *= k;
  }
  room.weak = 1 + Math.max(0, room.time - room.dur * 1.3) * .1; // dauert es trotzdem viel zu lange, ermüdet der Boss
  b.hold -= dt; b.sp = b.hold > 0 ? 0 : room.B.sp; b.cd -= dt;
  if (b.cd <= 0) { const rage = b.hp < b.maxHp * .5, dur = room.B.atk[b.atkI++ % room.B.atk.length](b, rage); b.hold = dur; b.cd = dur + (rage ? .5 : 1); }
}
// ================================================================ Minuten-Events: Horde, Level-Kreis, Miniboss
const MBLOOK = {
  cell: { id: 'cell', name: 'Cell', skin: '#f0f0e8', shirt: '#5aa83a', pants: '#5aa83a', shoes: '#1a1a22', boots: true, glove: '#f0f0e8', cape: '#1a1a22', hairStyle: 'cell', hair: '#5aa83a', eye: '#e060b0', scowl: true },
  kakashi: { id: 'kakashi', name: 'Kakashi Hatake', skin: '#f0d6c0', shirt: '#4a6a3a', sleeve: '#22284a', pants: '#22284a', shoes: '#22284a', glove: '#22284a', hairStyle: 'kakashi', hair: '#c8ccd8', eye: '#16161c' },
  doffy: { id: 'doffy', name: 'Doflamingo', skin: '#e8b890', shirt: '#f4f4f4', sleeve: '#f06aa8', pants: '#e87a30', shoes: '#16161c', cape: '#f06aa8', hairStyle: 'short', hair: '#f0d860', noEyes: true },
};
MBLOOK.buggy = { id: 'buggy', name: 'Buggy', skin: '#f4dcc8', shirt: '#f4f4f4', sleeve: '#e8842a', pants: '#3a9a8a', shoes: '#a02828', cape: '#e8842a', glove: '#f4f4f4', hairStyle: 'buggy', hair: '#5ab0e8', eye: '#16161c' };
MBLOOK.akaza = { id: 'akaza', name: 'Akaza', skin: '#f4e6e0', shirt: '#f4e6e0', pants: '#f2f0ea', shoes: '#f4e6e0', bare: true, armStripe: '#2a4a9a', hairStyle: 'short', hair: '#f07aa8', eye: '#f0d040', scowl: true };
const MINIS = [
  { id: 'cell', name: 'Cell', anime: 'Dragon Ball Z', col: '120,230,90', sp: 85, atk: [
    e => { shout(e, 'Kamehameha'); T('line', 1.7, { x: e.x, y: e.y, a: aimP(e), L: 900, w: 120, col: '120,200,255', snd: 'big', vis: 'beam' }); return 1.7; },
    e => { shout(e, 'Höllenspirale'); T('line', 1.1, { x: e.x, y: e.y, a: aimP(e), L: 1000, w: 46, col: '255,220,90', snd: 'zap', vis: 'beam' }); return 1.1; },
    e => { shout(e, 'Ki-Sperrfeuer'); for (let i = 0; i < 7; i++) later(i * .12, () => { const a = rand(0, TAU), d = rand(0, 240); T('circle', 1.2, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, R: 80, col: '255,220,90' }); }); return 2; },
    e => { shout(e, 'Teleport-Tritt'); const x = p.x, y = p.y; T('circle', 1.1, { x, y, R: 140, snd: 'punch', onFire() { e.x = x; e.y = y - 10; } }); return 1.1; },
  ] },
  { id: 'kakashi', name: 'Kakashi Hatake', anime: 'Naruto', col: '120,200,255', sp: 110, atk: [
    e => { shout(e, 'Raikiri'); return dashes(e, 1, 1.1, 0, 74, 'bolt'); },
    e => { shout(e, 'Katon: Gokakyu'); T('cone', 1.5, { x: e.x, y: e.y, a: aimP(e), R: 400, half: .6, col: '255,140,40', snd: 'fire', vis: 'fire' }); return 1.5; },
    e => { shout(e, 'Kamui'); for (let i = 0; i < 2; i++) later(i * .7, () => T('circle', 1.3, { x: p.x, y: p.y, R: 120, col: '170,110,255', snd: 'zap' })); return 2; },
    e => { shout(e, 'Suiton: Wasserdrache'); T('line', 1.6, { x: e.x, y: e.y, a: aimP(e), L: 820, w: 110, col: '70,150,255', snd: 'big', vis: 'beam' }); return 1.6; },
  ] },
  { id: 'doffy', name: 'Donquixote Doflamingo', anime: 'One Piece', col: '255,120,190', sp: 100, atk: [
    e => { shout(e, 'Goshikito'); fan(e, 5, .2, 1.3, { L: 720, w: 30, snd: 'slash', vis: 'string' }); return 1.3; },
    e => { shout(e, 'Overheat'); for (let i = 0; i < 2; i++) later(i * .6, () => T('line', 1.2, { x: e.x, y: e.y, a: aimP(e), L: 850, w: 64, col: '255,170,60', snd: 'fire', vis: 'beam' })); return 1.8; },
    e => { shout(e, 'Tamaito'); for (let i = 0; i < 4; i++) later(i * .3, () => T('line', .9, { x: e.x, y: e.y, a: aimP(e), L: 900, w: 26, snd: 'zap', vis: 'string' })); return 1.8; },
    e => { shout(e, 'Gott-Faden'); radial(e, 12, rand(0, TAU), 1.6, { snd: 'slash', vis: 'string' }); return 1.6; },
  ] },
  { id: 'buggy', name: 'Buggy der Clown', anime: 'One Piece', col: '255,150,60', sp: 95, atk: [
    e => { shout(e, 'Bara-Bara-Kanone'); const a = aimP(e); T('line', 1.2, { x: e.x, y: e.y, a, L: 720, w: 50, snd: 'slash', vis: 'cut' }); later(.8, () => T('line', 1, { x: e.x + Math.cos(a) * 720, y: e.y + Math.sin(a) * 720, a: a + Math.PI + rand(-.25, .25), L: 760, w: 50, snd: 'slash', vis: 'cut' })); return 1.8; },
    e => { shout(e, 'Buggy-Bombe'); T('circle', 1.8, { x: p.x, y: p.y, R: 210, big: true, col: '255,90,40', snd: 'big' }); return 1.8; },
    e => { shout(e, 'Bara-Bara-Festival'); for (let i = 0; i < 10; i++) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 300; T('circle', 1.4 + i * .04, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, R: 72, snd: 'punch' }); } return 1.8; },
  ] },
  { id: 'akaza', name: 'Akaza', anime: 'Demon Slayer', col: '90,170,255', sp: 125, atk: [
    e => { shout(e, 'Luft-Typ'); for (let i = 0; i < 3; i++) later(i * .3, () => T('line', .9, { x: e.x, y: e.y, a: aimP(e), L: 620, w: 60, snd: 'punch', vis: 'beam' })); return 1.5; },
    e => { shout(e, 'Vernichtungs-Typ'); later(1.1, () => { if (!e.dead) T('circle', .9, { x: e.x, y: e.y, R: 170, snd: 'boom' }); }); return dashes(e, 1, 1.1, 0, 78, 'cut') + .9; },
    e => { shout(e, 'Unordnung'); T('cone', 1.2, { x: e.x, y: e.y, a: aimP(e), R: 310, half: .75, snd: 'punch', vis: 'slash' }); return 1.2; },
    e => { shout(e, 'Blausilberner Chaos-Nachglanz'); const a0 = rand(0, TAU); radial(e, 12, a0, 1.5, { snd: 'zap', vis: 'beam' }); later(.6, () => { if (!e.dead) radial(e, 12, a0 + TAU / 24, 1.2, { snd: 'zap', vis: 'beam' }); }); return 1.9; },
  ] },
];
function spawnMini(id) {
  const M = MINIS.find(m => m.id === id) || pick(MINIS), a = rand(0, TAU), dist = Math.hypot(W, H / VK) / 2 + 60, hp = ET.tank.hp * (1 + t / 150) * 10.8; // 1000 % des stärksten normalen Monsters
  enemies.push({ type: 'boss', mb: M, sp: M.sp, r: 20, dmg: 12, xp: 40, s: 1.7, mass: 30, hp, maxHp: hp, x: p.x + Math.cos(a) * dist, y: p.y + Math.sin(a) * dist, kx: 0, ky: 0, hit: 0, frozen: 0, wallT: 0, face: 1,
    animT: 0, shootT: 9, look: MBLOOK[M.id], dead: false, walking: true, cd: 2, hold: 0, atkI: 0 });
  say('Miniboss: ' + M.name, M.anime); sfx('evo');
}
const ZONE_T = 6; // Sekunden im Kraftkreis für +1 Level
const ORBS = [{ name: 'Blauer Orb', sub: '20 Sekunden lang 20 % weniger Schaden', col: '90,160,255' }, { name: 'Gelber Orb', sub: '20 Sekunden lang 20 % schnellere Angriffe', col: '255,220,70' }, { name: 'Roter Orb', sub: '20 Sekunden lang 20 % mehr Schaden', col: '255,80,80' }];
function tickEvents(dt) {
  tickProps(dt); hordeT -= dt;
  if (t >= nextEvent) {
    nextEvent += 60;
    if (Math.random() < .5) { hordeT = 10; say('Horde!', '10 Sekunden lang doppelt so viele Gegner'); sfx('big'); shake = Math.max(shake, .3); }
    else spawnMini();
  }
  // Kraftkreise: alle 30 Sekunden einer, höchstens 3 gleichzeitig
  if ((zoneT -= dt) <= 0) { zoneT = 30; if (zones.length < 3) { const a = rand(0, TAU), d = rand(260, 400); zones.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, R: 110, prog: 0 }); sfx('pickup'); } }
  for (const z of zones) {
    if (Math.hypot(z.x - p.x, z.y - p.y) < z.R) { z.prog += dt; if (parts.length < 600 && Math.random() < .3) spark(z.x + rand(-z.R, z.R) * .7, z.y + rand(-z.R, z.R) * .7, 1, '#ffe45a', 80, .6, 4, { a: -1.57, spread: .2, drag: 0 }); }
    if (z.prog >= ZONE_T) { z.done = true; boom(z.x, z.y, z.R, '255,220,90', true); p.xp = p.xpNext; levelCheck(); sfx('evo'); say('Level Up!', 'Kraftkreis abgeschlossen'); }
  }
  zones = zones.filter(z => !z.done);
  // Orbs: alle 30 Sekunden einer, höchstens 5 gleichzeitig
  if ((orbT -= dt) <= 0) { orbT = 30; if (orbs.length < 5) { const a = rand(0, TAU), d = rand(240, 460); orbs.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, k: Math.floor(Math.random() * 3) }); } }
  for (const o of orbs) if (Math.hypot(o.x - p.x, o.y - p.y) < 34) { o.done = true; p.buf[o.k] = 20; sfx('heal'); say(ORBS[o.k].name, ORBS[o.k].sub); boom(o.x, o.y, 50, ORBS[o.k].col); }
  orbs = orbs.filter(o => !o.done);
  for (const e of enemies) if (e.mb && !e.dead) {
    e.frozen = Math.min(e.frozen, .5); e.hold -= dt; e.sp = e.hold > 0 ? 0 : e.mb.sp; e.cd -= dt;
    if (e.cd <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 720) { curOwner = e; const dur = e.mb.atk[e.atkI++ % e.mb.atk.length](e); curOwner = null; e.hold = dur; e.cd = dur + 1.4; }
  }
}
function reroll() { if (state !== 'levelup' || p.rerolls <= 0) return; p.rerolls--; showLevelUp(); }
// Punkt innerhalb einer angekündigten Fläche
function samp(q) {
  if (q.shape === 'circle') { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * q.R; return [q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, a]; }
  if (q.shape === 'ring') { const a = rand(0, TAU), d = rand(q.R0, q.R); return [q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, a]; }
  if (q.shape === 'cone') { const a = q.a + rand(-q.half, q.half), d = rand(.2, 1) * q.R; return [q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, a]; }
  const d = rand(0, q.L), o = rand(-.5, .5) * q.w; return [q.x + Math.cos(q.a) * d - Math.sin(q.a) * o, q.y + Math.sin(q.a) * d + Math.cos(q.a) * o, q.a];
}
// Einschlag-Animation je Technik
function teleVis(q) {
  const v = q.vis; if (!v) return;
  if (v === 'slash') fx.push({ type: 'bslash', x: q.x, y: q.y, a: q.a, R: q.R, half: q.half, col: q.col, life: .38, max: .38 });
  else if (v === 'beam') fx.push({ type: 'bbeam', x: q.x, y: q.y, a: q.a, L: q.L, w: q.w, col: q.col, life: .5, max: .5 });
  else if (v === 'bolt') { const x1 = q.x + Math.cos(q.a) * q.L, y1 = q.y + Math.sin(q.a) * q.L, pts = [[q.x, q.y]]; for (let i = 1; i <= 4; i++) pts.push([q.x + (x1 - q.x) * i / 4, q.y + (y1 - q.y) * i / 4]); fx.push({ type: 'zap', pts, col: q.col, big: true, life: .35, max: .35 }); }
  else if (v === 'string' || v === 'cut') fx.push({ type: 'bline', x0: q.x, y0: q.y, x1: q.x + Math.cos(q.a) * q.L, y1: q.y + Math.sin(q.a) * q.L, w: v === 'cut' ? q.w * .5 : 7, col: q.col, life: .32, max: .32 });
  else if (v === 'moon') { const pts = [], n = q.shape === 'circle' && q.R < 120 ? 3 : 9; for (let i = 0; i < n; i++) { const s = samp(q); pts.push([s[0], s[1], rand(24, 46), s[2] + rand(-.6, .6)]); } fx.push({ type: 'moons', pts, col: q.col, life: .5, max: .5 }); }
  else if (v === 'spike') { const pts = []; for (let i = 0; i < 7; i++) { const s = samp(q); pts.push([s[0], s[1], rand(30, 62)]); } fx.push({ type: 'spikes', pts, life: .8, max: .8 }); }
  else if (v === 'fire') { for (let i = 0; i < 9; i++) { const s = samp(q); fx.push({ type: 'boom', x: s[0], y: s[1], R: rand(44, 80), life: .45, max: .45, col: i % 2 ? '255,120,30' : '255,190,70' }); } } if (v === 'fire') for (let i = 0; i < 34 && parts.length < 760; i++) { const s = samp(q); spark(s[0], s[1], 1, i % 3 ? '#ff8a20' : '#ffe080', 90, rand(.5, 1), rand(6, 11), { g: -220, a: -1.57, spread: .5 }); }
}
function bossFx(f, k) {
  const al = 1 - k, ty = f.type;
  if (ty === 'bslash') {
    const q = Math.min(1, k * 3.5), a0 = f.a - f.half, a1 = a0 + 2 * f.half * q;
    crescent(f.x, f.y + 16, f.R, a0, a1, f.R * .3, `rgba(0,0,0,${.2 * al})`);
    ctx.globalCompositeOperation = 'lighter'; crescent(f.x, f.y, f.R, a0, a1, f.R * .42, `rgba(${f.col},${.75 * al})`); crescent(f.x, f.y, f.R * .98, a0, a1, f.R * .14, `rgba(255,255,255,${al})`); ctx.globalCompositeOperation = 'source-over';
  } else if (ty === 'bbeam') {
    const w = f.w * (.55 + .45 * al) * (1 + Math.sin(t * 60) * .06);
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2); g.addColorStop(0, `rgba(${f.col},0)`); g.addColorStop(.28, `rgba(${f.col},${.9 * al})`); g.addColorStop(.5, `rgba(255,255,255,${al})`); g.addColorStop(.72, `rgba(${f.col},${.9 * al})`); g.addColorStop(1, `rgba(${f.col},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, -w / 2, f.L, w);
    ctx.strokeStyle = `rgba(255,255,255,${.7 * al})`; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { const x = (t * 1100 + i * f.L / 5) % f.L; ctx.beginPath(); ctx.ellipse(x, 0, 6, w * .5, 0, 0, TAU); ctx.stroke(); }
    glow(0, 0, w * .9, `rgba(255,255,255,${al})`, `rgba(${f.col},${.8 * al})`, `rgba(${f.col},0)`);
    ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  } else if (ty === 'bline') {
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${f.col},${.8 * al})`; ctx.lineWidth = f.w * al + 2; ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.lineWidth = Math.max(2, f.w * .25 * al); ctx.stroke(); ctx.lineCap = 'butt'; ctx.globalCompositeOperation = 'source-over';
  } else if (ty === 'moons') {
    ctx.globalCompositeOperation = 'lighter';
    for (const m of f.pts) { const r = m[2] * (.7 + .5 * k), a = m[3] + k * 1.6; crescent(m[0], m[1], r, a - 1.2, a + 1.2, r * .5, `rgba(${f.col},${.85 * al})`); crescent(m[0], m[1], r * .97, a - 1.2, a + 1.2, r * .18, `rgba(255,255,255,${al})`); }
    ctx.globalCompositeOperation = 'source-over';
  } else if (ty === 'spikes') {
    const up = Math.min(1, k * 6) * (k > .65 ? (1 - k) / .35 : 1); // Höhe in Bodenkoordinaten, deshalb unten mit 1,5 gestreckt
    for (const m of f.pts) { const h = m[2] * up * 1.5; if (h < 2) continue;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(m[0] - 12, m[1] + 2); ctx.lineTo(m[0], m[1] - h - 4); ctx.lineTo(m[0] + 12, m[1] + 2); ctx.fill();
      ctx.fillStyle = '#7a5632'; ctx.beginPath(); ctx.moveTo(m[0] - 9, m[1]); ctx.lineTo(m[0], m[1] - h); ctx.lineTo(m[0] + 9, m[1]); ctx.fill();
      ctx.fillStyle = '#a8804a'; ctx.beginPath(); ctx.moveTo(m[0] - 9, m[1]); ctx.lineTo(m[0], m[1] - h); ctx.lineTo(m[0] - 2, m[1]); ctx.fill(); }
  } else return false;
  return true;
}
function drawPickups() { // Kraftkreise und Orbs
  if (room) return;
  for (const z of zones) {
    const k = z.prog / ZONE_T, inside = Math.hypot(z.x - p.x, z.y - p.y) < z.R, pu = .5 + .5 * Math.sin(t * 4), R = z.R, pw = inside ? 1 : .55;
    ctx.globalCompositeOperation = 'lighter';
    glow(z.x, z.y, R * 1.35, `rgba(255,236,150,${(.2 + .1 * pu) * pw})`, `rgba(255,200,70,${.12 * pw})`, 'rgba(255,170,40,0)');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(60,40,10,${.25})`; ctx.beginPath(); ctx.arc(z.x, z.y, R, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(z.x, z.y); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,230,140,${.9 * pw})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R - 12, 0, TAU); ctx.stroke();
    ctx.save(); ctx.rotate(t * .5); ctx.setLineDash([6, 14]); ctx.lineWidth = 7; ctx.strokeStyle = `rgba(255,210,90,${.8 * pw})`; ctx.beginPath(); ctx.arc(0, 0, R - 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,240,180,${.7 * pw})`; for (let s = 0; s < 2; s++) { ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = s * Math.PI / 3 + i * TAU / 3; ctx.lineTo(Math.cos(a) * (R - 16), Math.sin(a) * (R - 16)); } ctx.stroke(); } ctx.restore();
    ctx.save(); ctx.rotate(-t * .8); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,250,210,${.8 * pw})`; ctx.beginPath(); ctx.arc(0, 0, R * .45, 0, TAU); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.fillStyle = `rgba(255,240,170,${.9 * pw})`; ctx.fillRect(Math.cos(a) * R * .45 - 3, Math.sin(a) * R * .45 - 3, 6, 6); } ctx.restore();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, R + 9, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.restore();
    // Lichtsäule und aufsteigende Funken (stehen aufrecht)
    up(z.x, z.y); const hgt = 240 + 60 * pu, g = ctx.createLinearGradient(0, z.y - hgt, 0, z.y); g.addColorStop(0, 'rgba(255,220,110,0)'); g.addColorStop(1, `rgba(255,236,150,${(.2 + .16 * k) * pw})`);
    ctx.fillStyle = g; ctx.fillRect(z.x - R * .8, z.y - hgt, R * 1.6, hgt);
    const g2 = ctx.createLinearGradient(0, z.y - hgt * 1.3, 0, z.y); g2.addColorStop(0, 'rgba(255,255,230,0)'); g2.addColorStop(1, `rgba(255,255,230,${(.22 + .3 * k) * pw})`); ctx.fillStyle = g2; ctx.fillRect(z.x - 16, z.y - hgt * 1.3, 32, hgt * 1.3);
    for (let i = 0; i < 12; i++) { const h = hash(i, 77), q = (t * (.25 + (h % 7) * .04) + (h % 100) / 100) % 1, a = (h >> 8) % 628 / 100; ctx.fillStyle = `rgba(255,245,190,${(1 - q) * pw})`; const sz = 3 + (h >> 4) % 4; ctx.fillRect(z.x + Math.cos(a + t) * R * .75 * (1 - q * .5) - sz / 2, z.y + Math.sin(a + t) * R * .3 - q * hgt * .9, sz, sz); }
    ctx.globalCompositeOperation = 'source-over';
    txt(k > 0 ? Math.ceil(ZONE_T - z.prog) + ' s' : '+1 Level', z.x, z.y - 70, 26, 'center', '#fff2a0');
    ctx.restore();
  }
  for (const o of orbs) {
    const c = ORBS[o.k].col, gy = o.y + 8, bob = Math.sin(t * 3 + o.x) * 5;
    ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.beginPath(); ctx.ellipse(o.x, gy, 15, 12, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; glow(o.x, gy, 62, `rgba(${c},.42)`, `rgba(${c},.15)`, `rgba(${c},0)`); ctx.globalCompositeOperation = 'source-over';
    up(o.x, gy); const y = gy - 30 + bob, R = 15;
    ctx.globalCompositeOperation = 'lighter'; glow(o.x, y, 40, `rgba(${c},.55)`, `rgba(${c},.2)`, `rgba(${c},0)`); ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(${c},.9)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(o.x, y, R * 1.7, R * .55, -.35, Math.PI, TAU); ctx.stroke(); // Ring hinten
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(o.x, y, R + 3, 0, TAU); ctx.fill();
    let g = ctx.createRadialGradient(o.x - R * .4, y - R * .45, 1, o.x, y, R); g.addColorStop(0, '#ffffff'); g.addColorStop(.28, `rgb(${c})`); g.addColorStop(.8, `rgba(${c},.75)`); g.addColorStop(1, 'rgba(10,10,30,.9)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, y, R, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(o.x + 3, y + 4, R, .2, 2.2); ctx.arc(o.x, y, R, 2.2, .2, true); ctx.fill(); // Eigenschatten unten rechts
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(o.x - R * .42, y - R * .5, R * .26, R * .16, -.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,.9)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(o.x, y, R * 1.7, R * .55, -.35, 0, Math.PI); ctx.stroke(); // Ring vorn
    const sa = t * 4 + o.x; ctx.fillStyle = '#ffffff'; ctx.fillRect(o.x + Math.cos(sa) * R * 1.7 - 2, y + Math.sin(sa) * R * .55 - Math.cos(sa) * 8 - 2, 4, 4);
    ctx.restore();
  }
}
function tryDash() {
  if (state !== 'play' || !p || p.dashCd > 0 || p.rev !== undefined) return;
  let dx = p.mvx, dy = p.mvy; if (!dx && !dy) { dx = p.face; dy = 0; }
  const l = Math.hypot(dx, dy); p.dvx = dx / l * 1000; p.dvy = dy / l * 1000; p.dashT = .17; p.dashCd = 2.5; p.inv = Math.max(p.inv, .3);
  sfx('slash'); spark(p.x, p.y, 12, '#ffffff', 220, .3, 4);
}
function edgeMarker(x, y, col, w, h) {
  const dx = x - p.x, dy = (y - p.y) * VK; if (Math.abs(dx) < W / 2 - 30 && Math.abs(dy) < H / 2 - 30) return null;
  const a = Math.atan2(dy, dx), m = 60, sc = Math.min((w / 2 - m) / Math.abs(Math.cos(a) || .001), (h / 2 - m) / Math.abs(Math.sin(a) || .001)), mx = w / 2 + Math.cos(a) * sc, my = h / 2 + Math.sin(a) * sc;
  ctx.save(); ctx.translate(mx + Math.cos(a) * 30, my + Math.sin(a) * 30); ctx.rotate(a); ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -11); ctx.lineTo(-6, 11); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-3, -7); ctx.lineTo(-3, 7); ctx.fill(); ctx.restore();
  return [mx, my];
}
function telePath(q, k) {
  ctx.beginPath();
  if (q.shape === 'circle') ctx.arc(q.x, q.y, q.R * k, 0, TAU);
  else if (q.shape === 'ring') { ctx.arc(q.x, q.y, q.R0 + (q.R - q.R0) * k, 0, TAU); ctx.moveTo(q.x + q.R0, q.y); ctx.arc(q.x, q.y, q.R0, 0, TAU, true); }
  else if (q.shape === 'cone') { ctx.moveTo(q.x, q.y); ctx.arc(q.x, q.y, q.R * k, q.a - q.half, q.a + q.half); ctx.closePath(); }
  else { const ca = Math.cos(q.a), sa = Math.sin(q.a), w = q.w / 2, L = q.L * k; ctx.moveTo(q.x - sa * w, q.y + ca * w); ctx.lineTo(q.x + ca * L - sa * w, q.y + sa * L + ca * w); ctx.lineTo(q.x + ca * L + sa * w, q.y + sa * L - ca * w); ctx.lineTo(q.x + sa * w, q.y - ca * w); ctx.closePath(); }
}
function drawFloorFx() {
  for (const d of decals) { ctx.fillStyle = `rgba(20,14,10,${Math.min(1, d.life / d.max * 2) * .3})`; ctx.beginPath(); ctx.ellipse(d.x, d.y + 4, d.R, d.R, 0, 0, TAU); ctx.fill(); }
  for (const q of tele) {
    const k = Math.min(1, q.t / q.delay);
    if (!q.fired) {
      const pu = .5 + .5 * Math.sin(t * (6 + 16 * k));
      telePath(q, 1); ctx.fillStyle = `rgba(${q.col},${.12 + .08 * pu})`; ctx.fill();
      ctx.strokeStyle = `rgba(${q.col},.95)`; ctx.lineWidth = 3; ctx.setLineDash([14, 8]); ctx.lineDashOffset = -t * 40; ctx.stroke(); ctx.setLineDash([]);
      telePath(q, k); ctx.fillStyle = `rgba(${q.col},.3)`; ctx.fill();
      if (k > .7) { telePath(q, 1); ctx.strokeStyle = `rgba(255,255,255,${(k - .7) * 3.3 * pu})`; ctx.lineWidth = 3; ctx.stroke(); }
    } else {
      const al = Math.max(0, 1 - (q.t - q.delay) / .35); ctx.globalCompositeOperation = 'lighter';
      const fl = q.vis ? .28 : .7; telePath(q, 1); ctx.fillStyle = `rgba(255,255,255,${fl * al})`; ctx.fill(); ctx.fillStyle = `rgba(${q.col},${fl * al})`; ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
  }
  drawPickups();
  if (portal) { // Bodenringe, Lichtsäule bis über den Bildrand und ein deutlich größeres Tor
    const x = portal.x, y = portal.y, c = '200,140,255', k = Math.min(1, (t - portal.born) / .8), pu = .5 + .5 * Math.sin(t * 5);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 6, 46 * k, 26 * k, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; glow(x, y + 6, 230 * k, `rgba(${c},${.4 + .15 * pu})`, `rgba(${c},.16)`, `rgba(${c},0)`);
    for (let i = 0; i < 3; i++) { const q = (t * .55 + i / 3) % 1; ctx.strokeStyle = `rgba(${c},${(1 - q) * .8})`; ctx.lineWidth = 6 - q * 3; ctx.beginPath(); ctx.arc(x, y + 6, (44 + q * 210) * k, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(x, y + 6); ctx.scale(1, UPS);
    ctx.globalCompositeOperation = 'lighter';
    for (const [bw, al] of [[46, .3 + .2 * pu], [16, .45 + .25 * pu]]) { const lg = ctx.createLinearGradient(0, -700, 0, 0); lg.addColorStop(0, `rgba(${c},0)`); lg.addColorStop(.6, `rgba(${c},${al * .6})`); lg.addColorStop(1, `rgba(255,235,255,${al})`); ctx.fillStyle = lg; ctx.fillRect(-bw * k, -700, 2 * bw * k, 700); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(0, -76); ctx.scale(1.5 * k, 1.5 * k);
    ctx.globalCompositeOperation = 'lighter'; glow(0, 0, 110, `rgba(${c},.6)`, `rgba(${c},.25)`, `rgba(${c},0)`); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0a0612'; ctx.beginPath(); ctx.ellipse(0, 0, 28, 48, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) { const a = t * 3 + i * 1.3, rr = 1 - i * .17; ctx.strokeStyle = `rgba(${c},${.9 - i * .14})`; ctx.lineWidth = 4 - i * .5; ctx.beginPath(); ctx.ellipse(0, 0, 28 * rr, 48 * rr, 0, a, a + 3.6); ctx.stroke(); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 + pu; ctx.beginPath(); ctx.ellipse(0, 0, 29, 49, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 34 + pu * 3, 54 + pu * 3, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    if (parts.length < 600) spark(x + rand(-46, 46), y - rand(0, 150), 2, Math.random() < .3 ? '#ffd23c' : `rgb(${c})`, 70, .8, 4, { a: -1.57, spread: .4, drag: 0 });
  }
}
function drawTopFx() { // herabstürzende Meteore
  for (const q of tele) if (q.met && !q.fired) {
    up(q.x, q.y); const k = q.t / q.delay, e = k * k, x = q.x + 260 * (1 - e), y = q.y - 900 * (1 - e), R = q.R * .5 * (.45 + .55 * k);
    ctx.globalCompositeOperation = 'lighter'; for (let i = 1; i < 5; i++) glow(x + i * 26 * (1 - e * .5), y - i * 90 * (1 - e * .5), R * (1.2 - i * .16), 'rgba(255,220,150,.5)', 'rgba(255,120,30,.35)', 'rgba(200,40,0,0)'); ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(x - R * .35, y - R * .4, R * .1, x, y, R); g.addColorStop(0, '#c8a888'); g.addColorStop(.55, '#7a5a40'); g.addColorStop(1, '#2a1a10');
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, R + 4, 0, TAU); ctx.fill(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(30,18,10,.45)'; for (let i = 0; i < 5; i++) { const h = hash(i, 5); ctx.beginPath(); ctx.arc(x + ((h % 100) / 50 - 1) * R * .55, y + (((h >> 8) % 100) / 50 - 1) * R * .55, R * .13, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}
function drawOverlay() {
  ctx.save(); ctx.scale(1 / Z, 1 / Z); const w = W * Z, h = H * Z;
  if (room && !room.boss.dead) { const b = room.boss, bw = Math.min(520, w - 40), x = (w - bw) / 2, y = h - 44; bar(x, y, bw, 14, b.hp / b.maxHp, `rgb(${room.B.col})`); txt(`${room.B.name} · ${room.B.title}`, w / 2, y - 9, 18, 'center'); }
  if (portal) { // dauerhafter Hinweis unten in der Mitte, dazu ein großer pulsierender Wegweiser am Bildrand
    const dx = portal.x - p.x, dy = (portal.y - p.y) * VK, pu = .5 + .5 * Math.sin(t * 6), off = Math.abs(dx) > W / 2 - 30 || Math.abs(dy) > H / 2 - 30;
    const fs = w < 560 ? 14 : 18, msg = 'BOSS-PORTAL OFFEN · ' + (off ? Math.max(1, Math.round(Math.hypot(portal.x - p.x, portal.y - p.y) / 40)) + ' m · folge dem Pfeil' : 'tritt hinein');
    ctx.font = `700 ${fs}px ${FONT}`; const tw = ctx.measureText(msg).width + 34, bx = w / 2 - tw / 2, by = h - 64;
    ctx.fillStyle = INK; ctx.fillRect(bx - 4, by - 4, tw + 8, fs + 22); ctx.fillStyle = `rgba(${Math.round(70 + 60 * pu)},30,${Math.round(120 + 70 * pu)},.95)`; ctx.fillRect(bx, by, tw, fs + 14);
    ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, tw - 2, fs + 12);
    txt(msg, w / 2, by + fs + 3, fs, 'center', '#ffffff');
    if (t - portal.born < 2.5) { const al = (1 - (t - portal.born) / 2.5) * .35, g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .7); g.addColorStop(0, 'rgba(200,140,255,0)'); g.addColorStop(1, `rgba(200,140,255,${al})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
    if (off) {
      const a = Math.atan2(dy, dx), m = 70, sc = Math.min((w / 2 - m) / Math.abs(Math.cos(a) || .001), (h / 2 - m) / Math.abs(Math.sin(a) || .001)), x = w / 2 + Math.cos(a) * sc, y = h / 2 + Math.sin(a) * sc, z = 1 + .18 * pu;
      ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0, x, y, 60); g.addColorStop(0, `rgba(200,140,255,${.5 + .3 * pu})`); g.addColorStop(1, 'rgba(200,140,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 60, y - 60, 120, 120); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0a0612'; ctx.beginPath(); ctx.ellipse(x, y, 17 * z, 27 * z, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c98bff'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 22 * z, 32 * z, 0, 0, TAU); ctx.stroke();
      ctx.save(); ctx.translate(x + Math.cos(a) * (46 + 6 * pu), y + Math.sin(a) * (46 + 6 * pu)); ctx.rotate(a); ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-9, -17); ctx.lineTo(-9, 17); ctx.fill(); ctx.fillStyle = '#ffd23c'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-5, -11); ctx.lineTo(-5, 11); ctx.fill(); ctx.restore();
      txt('BOSS', x, y + 5, 12, 'center', '#ffd23c');
    }
  }
  if (!room) {
    for (const z of zones) { const m = edgeMarker(z.x, z.y, '#ffd23c', w, h); if (m) { ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(m[0], m[1], 13, 0, TAU); ctx.stroke(); } }
    for (const o of orbs) { const c = `rgb(${ORBS[o.k].col})`, m = edgeMarker(o.x, o.y, c, w, h); if (m) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(m[0], m[1], 10, 0, TAU); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(m[0], m[1], 7, 0, TAU); ctx.fill(); } }
    if (hordeT > 0) txt('Horde ' + Math.ceil(hordeT) + ' s', w / 2, 110, 18, 'center', '#ff8a6a');
  }
  { const act = [0, 1, 2].filter(k => p.buf[k] > 0), labels = ['-20% Schaden erlitten', '+20% Angriffstempo', '+20% Schaden']; let y = 76;
    for (const k of act) { const s = `${labels[k]} · ${Math.ceil(p.buf[k])} s`; ctx.font = `700 14px ${FONT}`; const tw = ctx.measureText(s).width; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(w / 2 - tw / 2 - 12, y - 5, 8, 0, TAU); ctx.fill(); ctx.fillStyle = `rgb(${ORBS[k].col})`; ctx.beginPath(); ctx.arc(w / 2 - tw / 2 - 12, y - 5, 6, 0, TAU); ctx.fill(); txt(s, w / 2, y, 14, 'center', `rgb(${ORBS[k].col})`); y += 18; } }
  if (banner) { ctx.globalAlpha = Math.max(0, Math.min(1, banner.life, (banner.max - banner.life) * 3)); txt(banner.text, w / 2, h * .2, w < 500 ? 26 : 36, 'center', '#ffd23c'); if (banner.sub) txt(banner.sub, w / 2, h * .2 + 26, w < 500 ? 13 : 16, 'center'); ctx.globalAlpha = 1; }
  ctx.restore();
}

// ================================================================ Tiefe für Geschosse: Schlagschatten und Lichtschein am Boden
const GLOWY = { red: '255,80,60', ki: '255,220,90', fire: '255,140,40', purple: '180,110,255', getsuga: '120,200,255', mugetsu: '120,60,200', spear: '255,210,110', rshuriken: '200,240,255', shard: '90,255,150' };
function shotShadow(s) {
  const r = s.r || 9;
  ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 24, r * 1.1, r * .85, 0, 0, TAU); ctx.fill();
  const c = s.cc ? s.cc[0] : GLOWY[s.type];
  if (c) { ctx.globalCompositeOperation = 'lighter'; glow(s.x, s.y + 24, r * 4.6, `rgba(${c},.36)`, `rgba(${c},.14)`, `rgba(${c},0)`); ctx.globalCompositeOperation = 'source-over'; }
}
function boomFx(f, k) { // Explosion: Bodenwelle liegt flach, Feuerball und Lichtsäule stehen
  const R = f.R, e = Math.sqrt(k);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${f.col},${1 - k})`; ctx.lineWidth = 10 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, R * (.3 + .7 * e), 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${.75 * (1 - k)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, R * (.15 + .7 * e), 0, TAU); ctx.stroke();
  if (k < .5) glow(f.x, f.y, R * (.6 + k), `rgba(${f.col},${.5 * (1 - k * 2)})`, `rgba(${f.col},${.2 * (1 - k * 2)})`, `rgba(${f.col},0)`);
  up(f.x, f.y);
  if (k < .65) {
    const q = k / .65, rr = R * (.28 + .4 * q), al = 1 - q, cy = f.y - rr * .55 - R * .25 * q;
    const g = ctx.createRadialGradient(f.x - rr * .3, cy - rr * .4, rr * .05, f.x, cy, rr); g.addColorStop(0, `rgba(255,255,255,${al})`); g.addColorStop(.35, `rgba(${f.col},${.85 * al})`); g.addColorStop(.8, `rgba(${f.col},${.3 * al})`); g.addColorStop(1, `rgba(${f.col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, cy, rr, 0, TAU); ctx.fill();
  }
  if (k < .3 && R > 30) { ctx.fillStyle = `rgba(255,255,255,${.5 * (1 - k / .3)})`; ctx.fillRect(f.x - R * .07, f.y - R * 1.7, R * .14, R * 1.7); }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

// ================================================================ Upgrade-Beschreibungen (genaue Werte der nächsten Stufe)
const f1 = x => String(Math.round(x * 10) / 10).replace('.', ',');
const pc = x => Math.round((x - 1) * 100);
const INFO = {
  blue: l => `Radius ${140 + 15 * l} · ${12 + 5 * l} Schaden pro Sekunde · alle ${f1(7.5 - l * .5)} s`,
  red: l => `${30 + 12 * l} Schaden · Explosionsradius ${80 + 10 * l} · alle ${f1(4.2 - l * .3)} s`,
  void: l => `Friert alle Gegner ${f1(2 + .6 * l)} s ein · ${6 * l} Schaden · alle ${24 - l * 2} s`,
  getsuga: l => `${22 + 9 * l} Schaden, durchschlägt alles · alle ${f1(3.3 - l * .3)} s` + (l >= 4 ? ' · zweite Welle nach hinten' : ''),
  bankai: l => `Insgesamt +${pc(1.08 ** l)}% Lauftempo und +${pc(1.1 ** l)}% Angriffstempo`,
  serious: l => `${120 + 50 * l} Schaden · Reichweite ${420 + 30 * l} · alle ${f1(12.5 - l)} s`,
  combo: l => `${5 + l} Schläge mit je ${9 + 3 * l} Schaden · alle ${f1(2.7 - l * .2)} s`,
  kame: l => `${90 + 45 * l} Schaden pro Sekunde · Breite ${46 + 7 * l} · alle ${f1(8.5 - l * .6)} s`,
  ssj: l => `Insgesamt +${pc(1.1 ** l)}% Schaden für alles`,
  spear: l => `${40 + 15 * l} Schaden · Explosionsradius ${90 + 10 * l} · alle ${f1(5 - l * .4)} s`,
  harden: l => `Insgesamt ${Math.round((1 - .92 ** l) * 100)}% weniger erlittener Schaden`,
  quick: l => `${80 + 45 * l} Schaden auf das Ziel, ${20 + 10 * l} im Umkreis · alle ${f1(4.6 - l * .4)} s`,
  wall: l => `${2 + (l >= 3) + (l >= 5)} kreisende Blocks · ${8 + 4 * l} Schaden pro Treffer`,
  rasengan: l => `6 Treffer mit je ${9 + 4 * l} Schaden · Radius ${46 + 5 * l} · alle ${f1(3.4 - l * .25)} s`,
  clones: l => `${2 + (l >= 3) + (l >= 5)} Doppelgänger · ${10 + 4 * l} Schaden pro Schlag · alle ${f1(9 - l * .5)} s`,
  chidori: l => `${45 + 18 * l} Schaden · Länge ${330 + 30 * l} · alle ${f1(5 - l * .4)} s`,
  emerald: l => `${5 + l} Splitter mit je ${9 + 3 * l} Schaden · alle ${f1(2.6 - l * .2)} s`,
  knives: l => `${8 + 2 * l} Messer mit je ${12 + 4 * l} Schaden · alle ${f1(4.2 - l * .3)} s`,
  tstop: l => `Stoppt die Zeit für ${f1(1.3 + .4 * l)} s · alle ${16 - l} s`,
  ren: l => `Radius ${70 + 10 * l} · ${6 + 3 * l} Schaden alle 0,4 s`,
  godspeed: l => `Insgesamt +${pc(1.07 ** l)}% Lauftempo und +${pc(1.08 ** l)}% Angriffstempo`,
};
const wl = () => p.wLvl >= 5 ? 8 : p.wLvl; // Stufe 5 ist die Maximalstufe und zählt wie die frühere Stufe 8
function WINFO(k, lv) {
  const l = lv >= 5 ? 8 : lv, d = (a, b) => f1(a + b * (l - 1)), n = (...ts) => 1 + ts.filter(x => l >= x).length, g = (c, w) => c > 1 ? `${c} ${w}` : '';
  const j = (...xs) => xs.filter(Boolean).join(' · ');
  switch (k) {
    case 'gojo': return j(`${d(14, 4)} Schaden`, g(n(3, 6), 'Kugeln'), `Explosionsradius ${45 + 3 * l}`);
    case 'goku': return j(`${d(10, 3)} Schaden`, g(n(5), 'Kugeln'), `durchschlägt ${2 + Math.floor(l / 3)} Gegner`);
    case 'vegeta': return j(`${d(7.5, 2)} Schaden`, g(n(4, 7), 'Kugeln pro Salve'));
    case 'hinata': return j(`${d(13, 4)} Schaden`, `springt ${2 + Math.floor(l / 2)}-mal weiter`);
    case 'kageyama': return j(`${d(15, 5)} Schaden`, 'durchschlägt alle Gegner in der Reihe');
    case 'naruto': return j(`${d(13, 4)} Schaden`, g(n(3, 6), 'Shuriken'), `durchschlägt ${2 + (l >= 5)} Gegner`);
    case 'sasuke': return j(`${d(14, 5)} Schaden`, `Flammengröße ${18 + l}`, 'durchdringt alles');
    case 'frieza': return j(`${d(12, 4)} Schaden`, g(n(4, 7), 'Strahlen'), 'durchbohrt alles');
    case 'zeke': return j(`${4 + Math.floor(l / 2)} Felsbrocken`, `je ${d(7, 2.2)} Schaden`);
    case 'oikawa': return j(`${d(16, 5)} Schaden`, `Explosionsradius ${50 + 4 * l}`);
    case 'kira': return j(`${d(18, 6)} Schaden`, g(n(5), 'Bomben'), `Explosionsradius ${60 + 5 * l}`);
    case 'hisoka': return j(`${2 + n(4, 7)} Karten`, `je ${d(9, 3)} Schaden`);
    case 'ana': return j(`${d(11, 3.5)} Schaden`, g(n(3, 6), 'Sushi'), `durchschlägt ${2 + (l >= 4)} Gegner`);
    case 'saitama': return j(`${d(24, 7)} Schaden`, `Radius ${50 + 5 * l}`);
    case 'eren': return j(`${d(20, 6)} Schaden`, `Radius ${60 + 5 * l}`);
    case 'jotaro': return j(`${d(4.6, 1.5)} Schaden pro Schlag`, `Reichweite ${88 + 5 * l}`);
    case 'dio': return j(`${d(8, 2.6)} Schaden pro Schlag`, `Reichweite ${78 + 5 * l}`);
    case 'garou': return j(`${d(5.6, 1.8)} Schaden pro Schlag`, `Reichweite ${84 + 5 * l}`);
    case 'beru': return j(`${d(6, 1.9)} Schaden pro Hieb`, `Reichweite ${90 + 5 * l}`);
    case 'gon': return j(`${d(48, 14)} Schaden`, `Radius ${70 + 6 * l}`);
    case 'killua': return j(`${d(15, 5)} Schaden`, `springt auf ${2 + Math.floor(l / 2)} Gegner`);
    case 'aizen': return j(`${d(20, 6)} Schaden`, `springt auf ${2 + Math.floor(l / 3)} Gegner`);
    case 'pain': return j(`${d(15, 5)} Schaden`, `Radius ${100 + 9 * l}`);
    case 'levi': return j(`${d(13, 4)} Schaden`, `Radius ${72 + 6 * l}`);
    case 'nam': return j(`${d(6, 2)} Schaden pro Treffer`, `${1 + n(3, 6)} Hanteln`, `Radius ${62 + 5 * l}`);
    default: return j(`${d(16, 5)} Schaden`, `Reichweite ${95 + 8 * l}`);
  }
}

// ================================================================ Maximalstufe (5): Skills bekommen eine neue, aufwendigere Animation
function tagRun(mx, fn) { // markiert alles, was ein Skill auf Stufe 5 erzeugt
  const a = shots.length, b = fx.length, c = timers.length, r = fn();
  if (mx) { for (let i = a; i < shots.length; i++) shots[i].mx = 1; for (let i = b; i < fx.length; i++) fx[i].mx = 1; for (let i = c; i < timers.length; i++) timers[i].mx = 1; }
  return r;
}
function maxShot(s) { // goldene Aura, Nachbilder, kreisende Ringe und Blitze; das Geschoss selbst wird größer
  const r = (s.r || 9) + 6, sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 4; i >= 1; i--) glow(s.x - ux * i * r * 1.3, s.y - uy * i * r * 1.3, r * (2 - i * .28), `rgba(255,255,255,${.3 - i * .05})`, `rgba(255,200,70,${.3 - i * .05})`, 'rgba(255,150,30,0)');
  glow(s.x, s.y, r * 2.6, 'rgba(255,255,255,.55)', 'rgba(255,210,90,.3)', 'rgba(255,160,30,0)');
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 2; i++) { ctx.strokeStyle = i ? 'rgba(255,255,255,.9)' : 'rgba(255,215,90,.9)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, r * 1.8, r * .6, t * (i ? -7 : 7) + i * 1.3, 0, TAU); ctx.stroke(); }
  if (Math.random() < .5) { const a = rand(0, TAU); bolt(s.x, s.y, s.x + Math.cos(a) * r * 2.6, s.y + Math.sin(a) * r * 2.6, '255,220,110', 1.5, 8); }
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(s.x, s.y); ctx.scale(1.3, 1.3); ctx.translate(-s.x, -s.y);
}
function maxFx(f, k) { // Runenkreis, Risse, Blitze und Lichtsäule um jeden Stufe-5-Effekt
  const ty = f.type; if (ty === 'void' || ty === 'tstop' || ty === 'dark' || ty === 'item' || ty === 'boom' && !f.R) return;
  let x = f.x, y = f.y, R = f.R || (f.s ? f.s * 2.2 : 70);
  if (ty === 'beam') { const al = Math.min(1, f.life * 3); ctx.globalCompositeOperation = 'lighter'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(f.a);
    for (let i = 0; i < 3; i++) bolt(30, rand(-1, 1) * f.w * .7, f.L, rand(-1, 1) * f.w * .9, '255,220,110', 2, 26);
    ctx.strokeStyle = `rgba(255,220,110,${.8 * al})`; ctx.lineWidth = 4; for (let i = 0; i < 9; i++) { const xx = (t * 700 + i * f.L / 9) % f.L; ctx.beginPath(); ctx.ellipse(xx, 0, 10, f.w * (.8 + .2 * Math.sin(t * 20 + i)), 0, 0, TAU); ctx.stroke(); }
    ctx.restore(); ctx.globalCompositeOperation = 'source-over'; return; }
  if (ty === 'zap') { ctx.globalCompositeOperation = 'lighter'; for (let i = 1; i < f.pts.length; i++) { bolt(f.pts[i - 1][0], f.pts[i - 1][1], f.pts[i][0], f.pts[i][1], '255,220,110', 3, 34); ctx.strokeStyle = `rgba(255,220,110,${1 - k})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.pts[i][0], f.pts[i][1] + 20, 20 + 50 * k, 0, TAU); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; return; }
  if (ty === 'line' || ty === 'bline') { x = f.x1; y = f.y1; R = 60; }
  else if (x === undefined) { const d = ty === 'fist' ? 62 : ty === 'rasengan' ? 52 : ty === 'cone' ? R * .5 : 0; x = p.x + Math.cos(f.a || 0) * d; y = p.y + Math.sin(f.a || 0) * d; if (ty === 'cone') R *= .5; }
  if (ty === 'drop') R = Math.min(R, 260);
  const al = Math.min(1, (1 - k) * 2.2), gy = y + 20, rr = R * (1.05 + .25 * k);
  ctx.save(); ctx.translate(x, gy);
  ctx.strokeStyle = `rgba(40,20,0,${.5 * al})`; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = i * .7 + x * .01; ctx.moveTo(Math.cos(a) * rr * .2, Math.sin(a) * rr * .2); ctx.lineTo(Math.cos(a + .15) * rr * (.7 + (i % 3) * .2), Math.sin(a + .15) * rr * (.7 + (i % 3) * .2)); } ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,215,90,${.95 * al})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
  ctx.save(); ctx.rotate(t * 2.4); ctx.setLineDash([8, 12]); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, rr * .82, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,245,190,${.8 * al})`; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * TAU / 3; ctx.lineTo(Math.cos(a) * rr * .8, Math.sin(a) * rr * .8); } ctx.stroke(); ctx.restore();
  if (al > .3) for (let i = 0; i < 3; i++) { const a = rand(0, TAU); bolt(0, 0, Math.cos(a) * rr * 1.15, Math.sin(a) * rr * 1.15, '255,220,110', 2, 18); }
  ctx.strokeStyle = `rgba(255,255,255,${.7 * (1 - k)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, rr * (1 + k * .7), 0, TAU); ctx.stroke();
  ctx.scale(1, UPS); const h = Math.min(320, R * 2.4) * (.5 + .5 * Math.min(1, k * 4)), g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, 'rgba(255,220,110,0)'); g.addColorStop(1, `rgba(255,236,160,${.5 * al})`);
  ctx.fillStyle = g; ctx.fillRect(-rr * .5, -h, rr, h); ctx.fillStyle = `rgba(255,255,240,${.45 * al})`; ctx.fillRect(-5, -h * 1.15, 10, h * 1.15);
  ctx.restore(); ctx.globalCompositeOperation = 'source-over';
}

// ================================================================ Zerstörbare Kisten, Fässer, Steine und Krüge (kommen nicht wieder)
const PROPS = [BIOMES[5].decor[2], BIOMES[5].decor[1], DECOR.rock, BIOMES[7].decor[2]];
let broken = new Set(), propT = 0;
function tickProps(dt) {
  if ((propT -= dt) > 0) return; propT = .5;
  const i0 = Math.floor(p.x / TILE), j0 = Math.floor(p.y / TILE), have = new Set();
  for (const e of enemies) if (e.prop) { if (Math.abs(e.x - p.x) > 1600 || Math.abs(e.y - p.y) > 1600) e.gone = true; else have.add(e.key); }
  enemies = enemies.filter(e => !e.gone);
  for (let i = i0 - 7; i <= i0 + 7; i++) for (let j = j0 - 7; j <= j0 + 7; j++) {
    const h = hash(i * 3 + worldSeed, j * 5 + 11); if (h % 22) continue;
    const key = i + ',' + j; if (broken.has(key) || have.has(key)) continue;
    const x = i * TILE + 20 + (h >> 9) % 150, y = j * TILE + 20 + (h >> 17) % 150; if (Math.hypot(x - p.x, y - p.y) < 90) continue;
    enemies.push({ type: 'prop', prop: PROPS[(h >> 5) % PROPS.length], key, sp: 0, r: 16, dmg: 0, xp: 2, s: 1, mass: 1e6, hp: 26, maxHp: 26, x, y, kx: 0, ky: 0, hit: 0, frozen: 0, wallT: 0, face: 1, animT: 0, shootT: 9, look: null, dead: false, walking: false });
  }
}
function propBroken(e) { kills--; broken.add(e.key); for (let i = 0; i < 2; i++) gems.push({ x: e.x + rand(-20, 20), y: e.y + rand(-20, 20), v: 1 }); spark(e.x, e.y, 10, '#a8743e', 220, .6, 5, { g: 500, a: -1.57, spread: 1.4, drag: 1, dark: true }); sfx('punch'); }
function drawProp(e) {
  const w = e.prop.width * 3, h = e.prop.height * 3, jx = e.hit > 0 ? rand(-2, 2) : 0;
  ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 16, w * .42, w * .28, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y + 18)); ctx.scale(1, UPS);
  ctx.save(); ctx.transform(1, 0, -.55, -.38, 0, 0); ctx.globalAlpha = .24; ctx.drawImage(dark(e.prop), -w / 2, -h, w, h); ctx.restore();
  ctx.drawImage(e.hit > 0 ? lightImg(e.prop) : e.prop, -w / 2 + jx, -h, w, h);
  if (e.hp < e.maxHp) { ctx.fillStyle = INK; ctx.fillRect(-17, -h - 12, 34, 7); ctx.fillStyle = '#ffd23c'; ctx.fillRect(-15, -h - 10, 30 * Math.max(0, e.hp / e.maxHp), 3); }
  ctx.restore();
}

// ================================================================ Phönix (Ana, Nam): fällt, schwebt auf, leuchtet, explodiert und steht wieder auf
function boost20(pl) { pl.dmgMul *= 1.2; pl.rate *= 1.2; pl.regen *= 1.2; pl.magnet *= 1.2; pl.xpMul *= 1.2; pl.area *= 1.2; pl.armor *= .8; pl.phoenix = true; }
function tickRevive(dt) {
  const a = p.rev; p.rev += dt; p.inv = 9; p.hp = Math.max(1, p.hp); p.moving = false;
  if (a > .6 && a < 2.7 && parts.length < 700) spark(p.x + rand(-40, 40), p.y + 20, 1, '#ffe89a', 120, .8, 5, { a: -1.57, spread: .3, drag: 0 });
  if (a < 2.7 && p.rev >= 2.7) {
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 900) hit(e, e.type === 'boss' ? e.maxHp * .2 / p.dmgMul : 1e9, 'ranged', 700);
    eshots.length = 0; p.hp = p.maxHp; flash = .9; shake = .9; sfx('big'); sfx('evo');
    boom(p.x, p.y, 460, '255,220,120', true); boom(p.x, p.y, 280, '255,255,255', true); boom(p.x, p.y, 140, '255,150,60', true);
    for (let i = 0; i < 40 && parts.length < 780; i++) spark(p.x, p.y - 40, 1, i % 2 ? '#fff2b0' : '#ffb040', 700, .9, 7);
  }
  if (p.rev >= 3.4) { delete p.rev; p.inv = 2; say('Wiedergeboren!', 'Phönix verbraucht'); }
}
function drawRevive() {
  const r = p.rev, after = r > 2.7, q = after ? Math.min(1, (r - 2.7) / .6) : 0, fall = Math.min(1, r / .5), fl = r < .7 ? 0 : Math.min(1, (r - .7) / 2), ease = fl * fl * (3 - 2 * fl);
  const ang = (after ? 1 - q : fall * fall) * 1.5, lift = after ? (1 - q) * 90 : ease * 90, gl = after ? 0 : ease;
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(0,0,0,${.3 - .15 * lift / 90})`; ctx.beginPath(); ctx.ellipse(p.x, p.y + 23, 16 - lift * .06, 10 - lift * .04, 0, 0, TAU); ctx.fill();
  if (gl > 0) { ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y + 23, 60 + 140 * gl, `rgba(255,236,150,${.35 * gl})`, `rgba(255,200,70,${.15 * gl})`, 'rgba(255,170,40,0)'); ctx.globalCompositeOperation = 'source-over'; }
  ctx.save(); ctx.translate(p.x, p.y + 23); ctx.scale(1, UPS); ctx.translate(-p.face * ang * 14, -lift - Math.sin(ang) * 12 + (gl ? Math.sin(t * 5) * 4 * gl : 0));
  if (gl > 0) { ctx.globalCompositeOperation = 'lighter'; glow(0, -24, 30 + 90 * gl, `rgba(255,255,255,${.8 * gl})`, `rgba(255,220,110,${.5 * gl})`, 'rgba(255,170,40,0)');
    ctx.strokeStyle = `rgba(255,240,180,${.7 * gl})`; ctx.lineWidth = 3; for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + t * 1.5, r0 = 30 + 20 * gl, r1 = r0 + 60 * gl * (.6 + .4 * Math.sin(t * 9 + i)); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, -24 + Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, -24 + Math.sin(a) * r1); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; }
  ctx.rotate(ang * p.face); const u = UPS; UPS = 1;
  drawChar(ctx, LOOK[p.kind], 0, 0, PS, p.face, 0, false, false, gl > .55 && Math.floor(t * (10 + 20 * gl)) % 2 ? 'w' : 'n'); UPS = u;
  ctx.restore();
}

// ================================================================ Pokébälle & Begleiter (Spielstand liegt im Browser, localStorage)
const SAVE = { balls: 0, pets: {}, active: null };
try { Object.assign(SAVE, JSON.parse(localStorage.getItem('animeSurvivorsSave') || '{}')); } catch (e) { }
function saveGame() { try { localStorage.setItem('animeSurvivorsSave', JSON.stringify(SAVE)); } catch (e) { } }
let runBalls = 0, pet = null, petSaveT = 0;
const SUMMON_COST = 3, PET_MAXLV = 100, PET_KILLS = 500; // ein besiegter Gegner = 0,2 % eines Levels
// Seltenheit: Chance beim Beschwören (p) und Stärkefaktor (m)
const RAR = {
  u: { n: 'Ungewöhnlich', p: .35, m: 1, col: '#8d93a3', rgb: '160,168,185' },
  g: { n: 'Gewöhnlich', p: .25, m: 1.1, col: '#4fae5a', rgb: '90,200,110' },
  s: { n: 'Selten', p: .20, m: 1.22, col: '#3f8ae0', rgb: '80,150,255' },
  e: { n: 'Episch', p: .15, m: 1.36, col: '#a45ae8', rgb: '180,100,255' },
  L: { n: 'Legendär', p: .05, m: 1.8, col: '#ffd23c', rgb: '255,210,60' },
};
const RORDER = ['u', 'g', 's', 'e', 'L'];
const petAim = (q, range) => { const e = nearest(q.x, q.y, range); if (!e) return null; q.face = e.x >= q.x ? 1 : -1; return { e, a: Math.atan2(e.y - q.y, e.x - q.x) }; };
// Handgezeichnete Sprites der ersten Begleiter
const PIMG = {
  pikachu: S(16, 16, r => { r(3, 0, 2, 4, '#f8d030'); r(11, 0, 2, 4, '#f8d030'); r(3, 0, 2, 1, '#222222'); r(11, 0, 2, 1, '#222222'); r(3, 3, 10, 7, '#f8d030'); r(4, 9, 8, 6, '#f8d030'); r(5, 5, 1, 2, '#222222'); r(10, 5, 1, 2, '#222222'); r(4, 7, 2, 2, '#e03030'); r(10, 7, 2, 2, '#e03030'); r(12, 9, 3, 2, '#f8d030'); r(13, 6, 2, 3, '#f8d030'); r(4, 15, 3, 1, '#c8a020'); r(9, 15, 3, 1, '#c8a020'); }),
  glumanda: S(16, 17, r => { r(4, 2, 8, 7, '#f08030'); r(4, 8, 7, 8, '#f08030'); r(6, 10, 4, 5, '#f8e0a0'); r(5, 4, 1, 2, '#222222'); r(10, 4, 1, 2, '#222222'); r(11, 11, 3, 2, '#f08030'); r(13, 7, 3, 4, '#f8d030'); r(14, 8, 1, 2, '#e03030'); r(4, 16, 3, 1, '#c06020'); r(8, 16, 3, 1, '#c06020'); }),
  schiggy: S(16, 17, r => { r(4, 2, 8, 7, '#58a8e8'); r(4, 8, 8, 8, '#a06030'); r(5, 8, 7, 8, '#58a8e8'); r(6, 10, 5, 5, '#f8e0a0'); r(5, 4, 1, 2, '#222222'); r(10, 4, 1, 2, '#222222'); r(12, 13, 3, 2, '#58a8e8'); r(4, 16, 3, 1, '#3878b8'); r(9, 16, 3, 1, '#3878b8'); }),
  bisasam: S(18, 16, r => { r(6, 2, 8, 6, '#408850'); r(8, 1, 4, 1, '#408850'); r(3, 7, 12, 7, '#60c0a0'); r(1, 6, 7, 6, '#60c0a0'); r(2, 8, 1, 2, '#c03030'); r(5, 8, 1, 2, '#c03030'); r(10, 9, 2, 2, '#308870'); r(13, 11, 1, 1, '#308870'); r(4, 14, 2, 2, '#308870'); r(11, 14, 2, 2, '#308870'); }),
  evoli: S(16, 16, r => { r(3, 0, 2, 4, '#b07840'); r(11, 0, 2, 4, '#b07840'); r(4, 2, 8, 6, '#b07840'); r(4, 8, 8, 7, '#b07840'); r(4, 7, 8, 3, '#f0e0b0'); r(5, 4, 1, 2, '#222222'); r(10, 4, 1, 2, '#222222'); r(12, 7, 4, 5, '#b07840'); r(13, 6, 3, 2, '#f0e0b0'); r(4, 15, 3, 1, '#805828'); r(9, 15, 3, 1, '#805828'); }),
  relaxo: S(20, 18, r => { r(6, 0, 2, 2, '#386878'); r(12, 0, 2, 2, '#386878'); r(6, 1, 8, 5, '#386878'); r(7, 3, 6, 3, '#f0e0c0'); r(8, 4, 2, 1, '#222222'); r(11, 4, 2, 1, '#222222'); r(2, 5, 16, 12, '#386878'); r(5, 8, 10, 8, '#f0e0c0'); r(2, 15, 4, 3, '#f0e0c0'); r(14, 15, 4, 3, '#f0e0c0'); }),
  mewtu: S(16, 19, r => { r(4, 0, 2, 2, '#d8d0e0'); r(10, 0, 2, 2, '#d8d0e0'); r(4, 1, 8, 6, '#d8d0e0'); r(5, 3, 2, 2, '#8040c0'); r(9, 3, 2, 2, '#8040c0'); r(5, 7, 6, 9, '#d8d0e0'); r(6, 11, 4, 5, '#9060b0'); r(3, 8, 2, 5, '#d8d0e0'); r(11, 8, 2, 5, '#d8d0e0'); r(11, 13, 4, 2, '#9060b0'); r(14, 10, 2, 4, '#9060b0'); r(4, 16, 3, 3, '#d8d0e0'); r(9, 16, 3, 3, '#d8d0e0'); }),
};
// Baukasten-Sprite: Aussehen aus Farben und Merkmalen
function monSprite(o) {
  return S(18, 18, r => {
    const b = o.b, a = o.a || b, y0 = 2, dk = shade(b, .7);
    if (o.wing) { r(0, 7, 4, 6, o.wing); r(14, 7, 4, 6, o.wing); r(0, 5, 2, 3, o.wing); r(16, 5, 2, 3, o.wing); }
    if (o.tail) { r(13, 13, 4, 2, o.tail); r(15, 10, 2, 4, o.tail); }
    if (o.ear === 'point') { r(4, 0, 2, 5, a); r(12, 0, 2, 5, a); } else if (o.ear === 'round') { r(3, 2, 3, 3, a); r(12, 2, 3, 3, a); } else if (o.ear === 'long') { r(3, 0, 2, 7, a); r(13, 0, 2, 7, a); }
    if (o.horn) r(8, 0, 2, 4, o.horn);
    if (o.crest) { r(6, 1, 1, 3, o.crest); r(11, 1, 1, 3, o.crest); }
    r(4, y0 + 2, 10, 7, b); r(5, y0 + 8, 8, 6, b);
    if (o.head) r(4, y0 + 2, 10, 3, o.head);
    if (o.belly) r(7, y0 + 9, 4, 4, o.belly);
    r(6, y0 + 5, 1, 2, o.eye || '#222222'); r(11, y0 + 5, 1, 2, o.eye || '#222222');
    if (o.cheek) { r(4, y0 + 7, 2, 1, o.cheek); r(12, y0 + 7, 2, 1, o.cheek); }
    if (o.mark) { r(8, y0 + 3, 2, 2, o.mark); r(8, y0 + 11, 2, 1, o.mark); }
    r(5, y0 + 14, 3, 1, dk); r(10, y0 + 14, 3, 1, dk);
  });
}
// Merkmale: p/r/l Ohren (spitz/rund/lang), h Horn, t Schweif, w Flügel, b Bauch, c Wangen, m Zeichnung, k Kopfkappe. Jede Entwicklung bekommt ein Merkmal dazu.
function mkLook(b, a, f, st) {
  const o = { b }, has = c => f.includes(c);
  if (has('p')) o.ear = 'point'; else if (has('r')) o.ear = 'round'; else if (has('l')) o.ear = 'long';
  if (has('h')) o.horn = a; if (has('t')) o.tail = shade(b, .82); if (has('w')) o.wing = a; if (has('b')) o.belly = '#f4e8c0';
  if (has('c')) o.cheek = a; if (has('m')) o.mark = a; if (has('k')) o.head = a;
  if (st >= 1) { if (!o.horn) o.horn = a; else o.crest = a; if (!o.tail) o.tail = shade(b, .82); }
  if (st >= 2) { if (!o.wing) o.wing = shade(b, .82); if (!o.mark) o.mark = a; o.crest = a; }
  return o;
}
const PATK = {
  zap: (q, m, o) => { const t0 = petAim(q, 420); if (!t0) return false; zapChain(q.x, q.y - 8, t0.e, o.n || 3, o.d * m, 180, o.c); sfx('zap'); },
  shot: (q, m, o) => { const t0 = petAim(q, 460); if (!t0) return false; for (let i = 0; i < (o.n || 1); i++) shot('ki', t0.a + (i - ((o.n || 1) - 1) / 2) * .22, 600, { x: q.x, y: q.y, dmg: o.d * m, left: o.p || 3, r: o.r || 8, small: (o.r || 8) < 7, life: .9, cc: [o.c, o.c], trail: `rgb(${o.c})` }); sfx('shoot'); },
  fire: (q, m, o) => { const t0 = petAim(q, 380); if (!t0) return false; for (let i = 0; i < (o.n || 1); i++) shot('fire', t0.a + (i - ((o.n || 1) - 1) / 2) * .3, 320, { x: q.x, y: q.y, dmg: o.d * m, left: Infinity, r: 13, life: .9 }); sfx('fire'); },
  spread: (q, m, o) => { const t0 = petAim(q, 400); if (!t0) return false; for (let i = 0; i < (o.n || 3); i++) shot('shard', t0.a + (i - ((o.n || 3) - 1) / 2) * .18, 520, { x: q.x, y: q.y, dmg: o.d * m, r: 7, life: .9 }); sfx('slash'); },
  burst: (q, m, o) => { const t0 = petAim(q, 460); if (!t0) return false; const es = [t0.e]; if (o.n > 1) { const seen = new Set(es); for (let i = 1; i < o.n; i++) { const e = nearest(q.x, q.y, 520, seen); if (!e) break; seen.add(e); es.push(e); } }
    for (const e of es) { area(e.x, e.y, o.R || 90, o.d * m, 'ranged', 200); boom(e.x, e.y, o.R || 90, o.c, true); } sfx('boom'); },
  heal: (q, m, o, m0) => { if (p.hp >= p.maxHp) return false; const v = Math.round(o.d * m0 * 10) / 10; p.hp = Math.min(p.maxHp, p.hp + v); texts.push({ x: p.x, y: p.y - 40, v: '+' + f1(v), life: .8, col: '120,255,150', big: true }); sfx('heal'); },
};
const PWORD = { zap: 'springt auf mehrere Gegner', shot: 'durchschlägt Gegner', fire: 'durchdringt alle Gegner', spread: 'Fächer aus Geschossen', burst: 'Explosion am Ziel' };
// Angriffsart je Typ: F Feuer, W Wasser, G Pflanze, E Elektro, P Psycho, D Unlicht, H Geist, N Normal, K Kampf, R Gestein/Boden, I Eis, Y Fee (heilt), S Stahl, A Drache, L Flug, B Käfer, X Gift
const PT = {
  F: { k: 'fire', cd: 1.9, o: { d: 14 }, mv: ['Glut', 'Flammenwurf', 'Feuersturm'] },
  W: { k: 'shot', cd: 1.3, o: { d: 10, c: '90,170,255' }, mv: ['Aquaknarre', 'Blubbstrahl', 'Hydropumpe'] },
  G: { k: 'spread', cd: 1.5, o: { d: 6, n: 3 }, mv: ['Rasierblatt', 'Zauberblatt', 'Blättersturm'] },
  E: { k: 'zap', cd: 1.6, o: { d: 10, n: 3, c: '255,230,80' }, mv: ['Donnerschock', 'Donnerblitz', 'Donner'] },
  P: { k: 'zap', cd: 1.7, o: { d: 11, n: 3, c: '200,120,255' }, mv: ['Konfusion', 'Psystrahl', 'Psychokinese'] },
  D: { k: 'burst', cd: 2.7, o: { d: 20, c: '90,60,160' }, mv: ['Verfolgung', 'Nachthieb', 'Finsteraura'] },
  H: { k: 'burst', cd: 2.7, o: { d: 20, c: '150,100,220' }, mv: ['Nachtnebel', 'Spukball', 'Schattenstoß'] },
  N: { k: 'shot', cd: .6, o: { d: 5, p: 1, r: 6, c: '255,230,140' }, mv: ['Sternschauer', 'Rundumschlag', 'Hyperstrahl'] },
  K: { k: 'burst', cd: 2.4, o: { d: 19, c: '255,150,80', R: 80 }, mv: ['Karateschlag', 'Aurasphäre', 'Nahkampf'] },
  R: { k: 'shot', cd: 1.6, o: { d: 8, n: 2, p: 2, c: '200,170,120' }, mv: ['Steinwurf', 'Steinhagel', 'Erdbeben'] },
  I: { k: 'shot', cd: 1.3, o: { d: 9, p: 4, c: '170,230,255' }, mv: ['Pulverschnee', 'Eisstrahl', 'Blizzard'] },
  Y: { k: 'heal', cd: 4, o: { d: 3 }, mv: ['Heilwoge', 'Wunschtraum', 'Mondschein'] },
  S: { k: 'shot', cd: 1.6, o: { d: 13, p: 4, r: 9, c: '200,210,230' }, mv: ['Metallklaue', 'Lichtkanone', 'Sternenhieb'] },
  A: { k: 'burst', cd: 2.6, o: { d: 21, c: '120,140,255' }, mv: ['Drachenwut', 'Drachenpuls', 'Draco Meteor'] },
  L: { k: 'spread', cd: 1.5, o: { d: 5, n: 4 }, mv: ['Windstoß', 'Luftschnitt', 'Orkan'] },
  B: { k: 'spread', cd: 1.2, o: { d: 6, n: 2 }, mv: ['Käferbiss', 'Kreuzschere', 'Käfergebrumm'] },
  X: { k: 'burst', cd: 2.4, o: { d: 17, c: '170,90,200', R: 100 }, mv: ['Säure', 'Matschbombe', 'Mülltreffer'] },
};
const LEGO = { shot: { n: 3, p: Infinity, r: 11 }, spread: { n: 5 }, zap: { n: 5 }, burst: { n: 2, R: 120 }, fire: { n: 2 }, heal: {} }; // Legendäre treffen breiter
const PETS = {};
const hx = s => '#' + s.replace(/./g, '$&$&');
const pid = n => n.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/é/g, 'e').replace(/[^a-z0-9]/g, '');
// Zeile: Name>Level>Entwicklung>Level>Entwicklung  Typ  Seltenheit  Körperfarbe  Zweitfarbe  Merkmale
// Entwicklungen durch Stein, Tausch oder Zuneigung haben hier ein festes Level bekommen.
function addGen(gen, rows) {
  for (const row of rows.trim().split('\n')) {
    const [chain, T, rar, b, a, f = ''] = row.trim().split(/\s+/), c = chain.split('>'), st = [];
    for (let i = 0; i < c.length; i += 2) st.push({ name: c[i], lv: i ? +c[i - 1] : 1 });
    const id = pid(st[0].name);
    if (PETS[id]) throw new Error('Doppeltes Pokémon: ' + id);
    PETS[id] = { id, name: st[0].name, gen, rar, T, st, b: hx(b), a: hx(a), f, imgs: {} };
  }
}
addGen(1, `
Pikachu>30>Raichu E g fd3 e33 ptc
Glumanda>16>Glutexo>36>Glurak F e f83 fd3 tb
Schiggy>16>Schillok>36>Turtok W s 5ae a63 tb
Bisasam>16>Bisaknosp>32>Bisaflor G s 6ca 485 m
Evoli>30>* N g b74 fec pt
Relaxo Y e 367 fec rb
Nebulak>25>Alpollo>40>Gengar H s 536 a6c p
Dratini>30>Dragonir>55>Dragoran A e 68d fff tm
Karpador>20>Garados W e e53 fd3 hm
Fukano>34>Arkani F s f83 fec ptk
Vulpix>32>Vulnona F g d64 fc8 pt
Abra>16>Kadabra>36>Simsala P g ec4 a74 pt
Machollo>28>Maschock>40>Machomei K g 8ab c44 h
Enton>33>Entoron W u fd5 fec b
Mauzi>28>Snobilikat N u fec fd3 ptm
Pummeluff>24>Knuddeluff Y u fbc 4a8 pc
Flegmon>37>Lahmus W g f9a fec rtb
Lapras I s 59d fec hb
Tragosso>28>Knogga R u c96 eee kb
Kleinstein>25>Georok>38>Geowaz R u 998 776 m
Mewtu P L ddd 96b t
Mew P L fbd f8b lt
Zapdos E L fd3 222 wh
`);
addGen(2, `
Endivie>16>Lorblatt>32>Meganie G s be8 483 hm
Feurigel>14>Igelavar>36>Tornupto F s fea 346 kt
Karnimani>18>Tyracroc>30>Impergator W s 5bd d33 bht
Togepi>20>Togetic>35>Togekiss Y g ffd d44 pm
Voltilamm>15>Waaty>30>Ampharos E g fea 48c rt
Larvitar>30>Pupitar>55>Despotar R e 8b6 c44 hb
Hunduster>24>Hundemon D g 333 f83 ptb
Felino>20>Morlord W u 6be a8c t
Marill>18>Azumarill W u 49e fff rtb
Skorgla>32>Skorgro R g c8c 44a wt
Sniebel>34>Snibunna D s 345 e45 pc
Skaraborn B e 46a fd3 h
Panzaeron S s aab d44 w
Miltank Y u fbc 333 hb
Teddiursa>30>Ursaring N g c84 fd8 rm
Phanpy>25>Donphan R u 7be d44 l
Traunfugil>32>Traunmagil H g 366 d4a m
Kramurx>30>Kramshef D u 234 fd3 wh
Natu>25>Xatu P u 6c5 d44 wm
Quiekel>33>Keifel>45>Mamutel I e a74 fec t
Lugia P L eef 58c wbh
Ho-Oh F L e53 fd3 wh
Celebi G L 9d7 485 hw
`);
addGen(3, `
Geckarbor>16>Reptain>36>Gewaldro G s 7c5 e65 bt
Flemmli>16>Jungglut>36>Lohgock F e f94 fd4 hb
Hydropi>16>Moorabbel>36>Sumpex W s 5ae f83 hct
Trasla>20>Kirlia>30>Guardevoir P s fff 6c7 kh
Absol D g eef 235 pht
Kindwurm>30>Draschel>50>Brutalanda A e 6ae ccc kb
Tanhel>20>Metang>45>Metagross S e 59c ccc m
Knacklion>35>Vibrava>45>Libelldra R s f94 fff b
Fiffyen>18>Magnayen D u 888 333 pt
Frizelbliz>26>Voltenso E u 8c8 fd3 pt
Wablu>35>Altaria A g 6bf fff w
Stollunior>32>Stollrak>42>Stolloss S s ccd 444 km
Zobiris H u 64a 5df p
Flunkifer S u fe8 333 kt
Barschwa>35>Milotic W e ba8 46c t
Schneppke>42>Firnontor I u fd3 333 kh
Zwirrlicht>37>Zwirrklop>50>Zwirrfinst H g 555 ddd m
Kanivanha>30>Tohaido W g 36a d33 h
Eneco>25>Enekoro Y u fbc fec pt
Wailmer>40>Wailord W u 36a fec b
Rayquaza A L 495 fd4 hmt
Groudon R L d33 333 hm
Kyogre W L 36c d33 wm
`);
addGen(4, `
Chelast>18>Chelcarain>32>Chelterrar G s 8c6 a74 kbh
Panflam>14>Panpyro>36>Panferno F e f94 fec rbt
Plinfa>16>Pliprin>36>Impoleon W s 47c fff bh
Sheinux>15>Luxio>30>Luxtra E g 7be 234 rkt
Riolu>25>Lucario K e 48c 223 pkt
Kaumalat>24>Knarksel>48>Knakrack A e 47a d44 hb
Staralili>14>Staravia>34>Staraptor L g 765 fff wh
Bidiza>15>Bidifas N u a75 fec rt
Rotom E s f73 5cf h
Haspiror>25>Schlapor N u a75 fec l
Charmian>38>Shnurgarst N u aab fff pt
Skunkapuh>34>Skuntank X u 536 fec t
Bamelin>26>Bojelin W u f93 fec t
Pachirisu E u fff 5ad ptc
Kryppuk H g 648 6d5 m
Glibunkel>37>Toxiquak X g 45a f83 c
Shnebedeck>40>Rexblisar I g fff 485 k
Hippopotas>34>Hippoterus R g ca7 333 b
Driftlon>28>Drifzepeli H u 859 fd3 m
Koknodon>30>Rameidon R s 889 47c k
Arceus N L fff fd4 hwm
Dialga S L 47a 9df hm
Giratina H L 888 fd3 wh
`);
addGen(5, `
Serpifeu>17>Efoserp>36>Serpiroyal G s 5a6 fd4 bt
Floink>17>Ferkokel>36>Flambirex F s f84 333 pkc
Ottaro>17>Zwottronin>36>Admurai W s fff 347 rt
Zorua>30>Zoroark D g 445 d34 phm
Emolga E u fff 223 rkw
Kapuno>50>Duodino>64>Trikephalo A e 46a 223 k
Milza>38>Sharfax>48>Maxax A e 8a7 d44 h
Lichtel>41>Laternecto>50>Skelabra H e eef a6f h
Picochilla>25>Chillabell N u bbb fff lt
Ignivor>59>Ramoth F e fff f73 hw
Golbit>43>Golgantes H g 6aa fd3 m
Ganovil>29>Rokkaiman>40>Rabigator R g ca8 333 t
Zurrokex>39>Irokex K g fd5 d44 k
Makabaja>34>Echnatoll H u 444 fd3 m
Fleknoil>25>Fletiamo L u 8ce 333 w
Yorkleff>16>Terribark>32>Bissbark N g c96 347 r
Mollimorba>32>Hypnomorba>41>Morbitesse P u 333 fff m
Monozyto>32>Mitodos>41>Zytomega P g 9d9 d66 c
Petznief>37>Siberio I u bdf fff r
Wattzapf>36>Voltula E u fd3 47c m
Reshiram F L fff 9cf wt
Zekrom E L 222 5cf wh
Kyurem I L 9ab fd3 hw
`);
addGen(6, `
Igamaro>16>Igastarnish>36>Brigaron G s 8b5 a74 kh
Fynx>16>Rutena>36>Fennexis F s fd6 f73 pt
Froxy>16>Amphizel>36>Quajutsu W e 6be fff c
Dartiri>17>Dartignis>35>Fiaro L g f73 999 w
Leufeo>35>Pyroleo F g a74 f73 rh
Gramokles>35>Duokles>50>Durengard S e aab 47c m
Viscora>40>Viscargot>50>Viscogon A e b9d 8c6 h
eF-eM>48>UHaFnir A s 648 333 lw
Dedenne E u f94 333 rtc
Psiau>25>Psiaugon P u aab 648 p
Pam-Pam>32>Pandagro K g fff 333 rk
Scoppel>20>Grebbit R u aa9 a74 l
Balgoras>39>Monargoras R s a85 f73 h
Amarino>39>Amagarga I g 9cf fd3 l
Resladero K g 4a7 d44 w
Clavion S u ccd fbc m
Paragoni>30>Trombork H u 543 485 h
Irrbis>30>Pumpdjinn H u 543 f93 p
Coiffwaff N u fff 333 lt
Flabébé>19>Floette>35>Florges Y g fff d44 k
Xerneas A L 36a fd3 h
Yveltal D L d33 222 wh
Zygarde R L 6b5 222 m
`);
addGen(7, `
Bauz>17>Arboretoss>34>Silvarro G s db9 6b5 wm
Flamiau>17>Miezunder>34>Fuegro F s 333 d33 ptm
Robball>17>Marikeck>34>Primarene W s 47c fbc rc
Wuffels>25>Wolwerock R g ca8 fff pt
Mimigma H e fd6 333 pt
Miniras>35>Mediras>45>Grandiras A e aab fd3 h
Molunk>33>Amfira X g 444 f63 t
Pampuli>30>Pampross R u a75 333 r
Velursi>27>Kosturso K g fbc 843 r
Peppeck>14>Trompeck>28>Tukanon L u 333 d33 wh
Mangunior>20>Manguspektor N u a85 fd6 k
Togedemaru E u aab fd3 rc
Koalelu N u 9ab fff r
Sen-Long A g 6a9 fff k
Tortunator F g d44 fd3 h
Sankabuh>42>Colossand H u ca8 333 h
Frubberl>18>Frubaila>29>Fruyal G g f8b 6b5 k
Imantis>34>Mantidea G u f9b 6b5 h
Reißlaus>30>Tectass B s aab 648 m
Wommel>25>Bandelby Y u fd6 fff w
Solgaleo S L fff f93 km
Lunala H L 648 fd3 w
Necrozma P L 222 fff hm
`);
addGen(8, `
Chimpep>16>Chimstix>35>Gortrom G s 7b5 f93 rt
Hopplo>16>Kickerlo>35>Liberlo F e fff f63 lc
Memmeon>16>Phlegleon>35>Intelleon W s 6be fd3 ht
Wolly>24>Zwollock N u fff 333 h
Voldi>25>Bellektro E u c96 fd3 pt
Grolldra>50>Phantadrak>60>Katapuldra A e 4a8 d55 h
Toxel>30>Riffex E g a6c fd3 h
Kamehaps>22>Kamalm W u 47c f93 h
Meikro>18>Kranoviz>38>Krarmor L s 347 fd3 w
Kleptifux>18>Gaunux D u a53 333 pt
Klonkett>18>Wagong>34>Montecarbo R g 333 f63 m
Knapfel>30>Drapfel G u d44 6b5 h
Thermopod>28>Infernopod F g a43 fd3 m
Fatalitee>30>Mortipot H u 859 fff m
Bähmon>32>Pelzebub>42>Olangaar D g f8b 333 p
Hokumil>30>Pokusan Y u ffe fbc k
Snomnom>30>Mottineva I u eef 9cf h
Morpeko E u fd6 333 rc
Kupfanti>34>Patinaraja S g f93 485 l
Duraludon S s ccd 999 h
Zacian S L 5ad d44 pt
Zamazenta K L d44 47c pk
Endynalos X L 347 d33 hw
`);
addGen(9, `
Felori>16>Feliospa>36>Maskagato G e 9c7 485 pt
Krokel>16>Lokroko>36>Skelokrok F s d44 fff hb
Kwaks>16>Fuentente>36>Bailonda W s fff 4ad k
Ferkuli>18>Fragrunz N u 555 fd6 r
Pamo>18>Pamamo>32>Pamomamo E g f93 fd6 rc
Hefel>26>Backel Y u fea f93 l
Olini>25>Olivinio>35>Olithena G u 9b5 fea h
Frospino>35>Cryospino>54>Espinodon I e 9bc fd3 h
Forgita>24>Tafforgita>38>Granforgita S s f8b aab k
Gruff>30>Friedwuff H g fff 859 lh
Flaminkno K g f6a 333 w
Knattox>40>Knattatox X u 889 a6c m
Mobtiff>30>Mastifioso D g f93 444 r
Mopex A g 6b5 333 kt
Flaniwal>30>Kolowal I u fff 9ab h
Normifin>38>Delfinator W s 4ad fbc h
Geosali>24>Sedisal>38>Saltigant R g ca8 fff k
Knarbon>35>Crimanzo F s 444 f63 h
Blipp>30>Wampitz E u 9c5 fd3 c
Gierspenst>50>Monetigo H e fd3 aab h
Koraidon K L d44 fff ht
Miraidon E L 64a fd3 ht
Terapagos N L 6cd fd3 k
`);
// Evoli entwickelt sich zufällig; die Form wird beim Erhalt ausgelost und im Spielstand gemerkt
const EEV = [['Aquana', 'W', '6be', 'fec'], ['Blitza', 'E', 'fd3', 'fff'], ['Flamara', 'F', 'f83', 'fd6'], ['Psiana', 'P', 'c9d', 'd44'], ['Nachtara', 'D', '333', 'fd3'], ['Folipurba', 'G', 'fea', '6b5'], ['Glaziola', 'I', '9df', '47c'], ['Feelinara', 'Y', 'fbd', '6cf']];
const newSv = (l, f) => ({ l: l || 1, x: 0, f: f === undefined ? Math.floor(Math.random() * EEV.length) : f });
// Alte Spielstände (Version 13 und früher) umziehen
(() => {
  const old = SAVE.pets || {}, nw = {};
  for (const k in old) {
    const v = old[k];
    if (PETS[k]) nw[k] = typeof v === 'object' && v ? Object.assign(newSv(), v) : newSv();
    else if (k === 'lucario') nw.riolu = newSv(25);
    else if (k === 'nachtara' && !old.evoli) nw.evoli = newSv(30, 4);
    else SAVE.balls += SUMMON_COST;
  }
  for (const k in nw) { const v = nw[k]; v.l = Math.max(1, Math.min(PET_MAXLV, Math.floor(+v.l) || 1)); v.x = Math.max(0, Math.min(PET_KILLS - 1, Math.floor(+v.x) || 0)); }
  SAVE.pets = nw;
  if (SAVE.active === 'lucario') SAVE.active = 'riolu'; if (SAVE.active === 'nachtara') SAVE.active = 'evoli';
  if (!nw[SAVE.active]) SAVE.active = null;
})();
function petStage(P, lv) { let s = 0; while (s + 1 < P.st.length && lv >= P.st[s + 1].lv) s++; return s; }
function petForm(id, lv, sv) { // aktuelle Gestalt: Name, Typ, Sprite und Größe je nach Level
  const P = PETS[id], s = petStage(P, lv); let name = P.st[s].name, T = P.T, b = P.b, a = P.a, key = s;
  if (name === '*') { const fi = sv && sv.f != null ? sv.f % EEV.length : 0, e = EEV[fi]; name = e[0]; T = e[1]; b = hx(e[2]); a = hx(e[3]); key = 'e' + fi; }
  const img = P.imgs[key] || (P.imgs[key] = s === 0 && PIMG[id] ? PIMG[id] : monSprite(mkLook(b, a, P.f, s)));
  return { P, s, name, T, img, sc: (P.rar === 'L' ? 3 : 2.5) + .35 * s };
}
// Wirkung: +1,2 % pro Level, +12 % pro Entwicklung, dazu der Faktor der Seltenheit. Bewusst klein gehalten – der Held bleibt klar stärker.
const petPow = (P, lv, s) => RAR[P.rar].m * (1 + .012 * (lv - 1)) * (1 + .12 * s);
const petO = (P, T) => P.rar === 'L' ? Object.assign({}, PT[T].o, LEGO[PT[T].k]) : PT[T].o;
function petDesc(f, lv) {
  const t0 = PT[f.T], o = petO(f.P, f.T), v = f1(o.d * petPow(f.P, lv, f.s)), mv = t0.mv[Math.min(2, f.s + (f.P.rar === 'L' ? 2 : 0))];
  return t0.k === 'heal' ? `${mv}: heilt dich alle ${f1(t0.cd)} s um ${v} Leben` : `${mv}: ${o.n > 1 ? o.n + '× ' : ''}${v} Schaden, ${PWORD[t0.k]}`;
}
function nextEvo(id, sv) { const P = PETS[id], s = petStage(P, sv.l), n = P.st[s + 1]; return n ? { lv: n.lv, name: n.name === '*' ? '???' : n.name } : null; }

function newPet() { const k = SAVE.active, sv = k && PETS[k] && SAVE.pets[k]; pet = sv ? { pet: true, kind: k, sv, form: petForm(k, sv.l, sv), x: p.x - 46, y: p.y + 10, cdT: 1.5, face: 1, bob: 0 } : null; }
function tickPet(dt) {
  if (!pet) return;
  const tx = p.x - p.face * 46, ty = p.y + 14, d = Math.hypot(tx - pet.x, ty - pet.y);
  if (d > 700) { pet.x = tx; pet.y = ty; } else if (d > 6) { const k = Math.min(1, dt * 4.5); pet.x += (tx - pet.x) * k; pet.y += (ty - pet.y) * k; pet.bob += dt * (d > 20 ? 14 : 4); if (d > 20) pet.face = tx >= pet.x ? 1 : -1; }
  if ((pet.cdT -= dt) <= 0 && p.rev === undefined) {
    const f = pet.form, t0 = PT[f.T], m0 = petPow(f.P, pet.sv.l, f.s);
    pet.cdT = PATK[t0.k](pet, m0 * (1 + .02 * (p.level - 1)), petO(f.P, f.T), m0) === false ? .3 : t0.cd;
  }
  if (petSaveT > 0 && (petSaveT -= dt) <= 0) saveGame();
}
function petKill() { // jeder besiegte Gegner: 0,2 % Erfahrung für den aktiven Begleiter
  if (!pet) return; const sv = pet.sv; if (sv.l >= PET_MAXLV) return;
  if (++sv.x < PET_KILLS) { if (petSaveT <= 0) petSaveT = 10; return; }
  sv.x = 0; sv.l++; const old = pet.form; pet.form = petForm(pet.kind, sv.l, sv);
  if (pet.form.s !== old.s) {
    say(`${old.name} entwickelt sich!`, `${pet.form.name} · Level ${sv.l}`); flash = Math.max(flash, .5); shake = Math.max(shake, .3); sfx('evo');
    boom(pet.x, pet.y, 110, '255,255,255', true); spark(pet.x, pet.y - 10, 30, `rgb(${RAR[old.P.rar].rgb})`, 320, .9, 5);
  } else { texts.push({ x: pet.x, y: pet.y - 44, v: `${old.name} Lv. ${sv.l}`, life: 1.6, col: '255,220,60', big: true }); spark(pet.x, pet.y - 10, 12, '#ffe45a', 200, .6, 4, { a: -1.57, spread: .8 }); sfx('level'); }
  saveGame();
}
function drawPet(q) {
  const f = q.form, im = f.img, w = im.width * f.sc, h = im.height * f.sc, hop = Math.abs(Math.sin(q.bob)) * 5;
  ctx.drawImage(BLOB, q.x - 13, q.y + 12, 26, 18);
  ctx.drawImage(q.face > 0 ? flipped(im) : im, Math.round(q.x - w / 2), q.y + 22 - (h + hop) * UPS, w, h * UPS);
}
function bankRun() { const n = runBalls; SAVE.balls += n; runBalls = 0; petSaveT = 0; saveGame(); return n; }
addEventListener('pagehide', saveGame);
function rollPet() { // erst die Seltenheit auslosen, dann ein Pokémon dieser Stufe
  let r = Math.random(), k = 'u';
  for (const q of RORDER) { k = q; if ((r -= RAR[q].p) < 0) break; }
  return pick(Object.keys(PETS).filter(id => PETS[id].rar === k));
}
function summon() { // ein doppeltes Pokémon wird wieder zu einem Pokéball
  if (SAVE.balls < SUMMON_COST) return;
  SAVE.balls -= SUMMON_COST;
  const id = rollPet(), dup = !!SAVE.pets[id];
  if (dup) SAVE.balls += 1; else { SAVE.pets[id] = newSv(); if (!SAVE.active) SAVE.active = id; }
  saveGame(); startGacha(id, dup);
}

// ---------- Beschwörung: Ball fällt, wackelt dreimal, glüht in der Farbe der Seltenheit und platzt auf
let gacha = null;
const G_OPEN = 2.7, gcx = $('gc').getContext('2d');
function startGacha(id, dup) {
  gacha = { id, dup, t: 0, wob: -1, open: false, f: petForm(id, 1, SAVE.pets[id]), ps: [] };
  $('gName').textContent = ' '; $('gName').style.color = ''; $('gInfo').textContent = 'Tippen zum Überspringen'; $('gBtns').style.visibility = 'hidden';
  setState('gacha'); sfx('shoot');
}
function gBall(c, x, y, R, ang) {
  c.save(); c.translate(x, y + R); c.rotate(ang); c.translate(0, -R);
  c.fillStyle = INK; c.beginPath(); c.arc(0, 0, R + 4, 0, TAU); c.fill();
  c.fillStyle = '#e23a3a'; c.beginPath(); c.arc(0, 0, R, Math.PI, 0); c.fill();
  c.fillStyle = '#f4f0ea'; c.beginPath(); c.arc(0, 0, R, 0, Math.PI); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-R * .4, -R * .5, R * .28, R * .16, -.6, 0, TAU); c.fill();
  c.fillStyle = INK; c.fillRect(-R, -4, 2 * R, 8); c.beginPath(); c.arc(0, 0, R * .3, 0, TAU); c.fill();
  c.fillStyle = '#f4f0ea'; c.beginPath(); c.arc(0, 0, R * .17, 0, TAU); c.fill();
  c.restore();
}
function gGlow(c, x, y, R, rgb, al) { const g = c.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, `rgba(${rgb},${al})`); g.addColorStop(.5, `rgba(${rgb},${al * .4})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(x - R, y - R, 2 * R, 2 * R); }
function tickGacha(dt) {
  const g = gacha, c = gcx; if (!g) return; g.t += dt;
  const P = PETS[g.id], R = RAR[P.rar], t1 = g.t, X = 160, Y = 185;
  c.clearRect(0, 0, 320, 320); c.imageSmoothingEnabled = false;
  if (t1 < G_OPEN) {
    let y = Y, ang = 0, jx = 0;
    if (t1 < .5) { const k = t1 / .5; y = -50 + (Y + 50) * k * k; }
    else if (t1 < .7) y = Y - Math.sin((t1 - .5) / .2 * Math.PI) * 26;
    else if (t1 < 2.2) { const i = Math.floor((t1 - .7) / .5), ph = ((t1 - .7) % .5) / .5; if (i !== g.wob) { g.wob = i; sfx('click'); } if (ph < .6) ang = Math.sin(ph / .6 * TAU) * .42; }
    else { const k = (t1 - 2.2) / (G_OPEN - 2.2); jx = Math.sin(t1 * 90) * 5 * k; c.globalCompositeOperation = 'lighter'; gGlow(c, X, Y, 60 + 100 * k, R.rgb, .9 * k); c.globalCompositeOperation = 'source-over'; }
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(X, Y + 44, 34 * Math.min(1, t1 / .5), 9, 0, 0, TAU); c.fill();
    gBall(c, X + jx, y, 38, ang);
    if (t1 > 2.2) { const k = (t1 - 2.2) / (G_OPEN - 2.2); c.fillStyle = `rgba(255,255,255,${k * .8})`; c.beginPath(); c.arc(X + jx, y, 44, 0, TAU); c.fill(); }
    return;
  }
  if (!g.open) {
    g.open = true; g.t = G_OPEN; sfx('evo'); if (P.rar === 'L' || P.rar === 'e') sfx('big');
    for (let i = 0; i < (P.rar === 'L' ? 70 : 40); i++) { const a = rand(0, TAU), v = rand(60, 330); g.ps.push({ x: X, y: Y - 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: rand(.5, 1.2), s: rand(3, 7), w: Math.random() < .3 }); }
    const n = $('gName'); n.textContent = g.f.name; n.style.color = R.col;
    $('gInfo').textContent = `${R.n} · Generation ${P.gen} · ` + (g.dup ? 'schon im Besitz – 1 Pokéball zurück' : 'Neu!');
    const b = $('bAgain'); b.disabled = SAVE.balls < SUMMON_COST; b.style.opacity = b.disabled ? '.4' : '1'; b.textContent = `Nochmal (${SUMMON_COST} von ${SAVE.balls} Bällen)`;
    $('gBtns').style.visibility = 'visible';
  }
  const u = g.t - G_OPEN, cy = Y - 30;
  c.save(); c.translate(X, cy); c.rotate(u * .5); c.fillStyle = `rgba(${R.rgb},${P.rar === 'L' ? .4 : .22})`;
  for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(0, 0); c.lineTo(-22, -240); c.lineTo(22, -240); c.fill(); }
  c.restore();
  c.globalCompositeOperation = 'lighter'; gGlow(c, X, cy, 150, R.rgb, .7); c.globalCompositeOperation = 'source-over';
  const k = Math.min(1, u / .35), sc = (k < 1 ? 1.25 * k * (2 - k) : 1 + .25 * Math.max(0, 1 - (u - .35) / .2)) * 7, im = g.f.img, bob = Math.sin(u * 3) * 4;
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(X, Y + 44, 50, 11, 0, 0, TAU); c.fill();
  c.drawImage(im, Math.round(X - im.width * sc / 2), Math.round(Y + 40 - im.height * sc + bob), im.width * sc, im.height * sc);
  for (const q of g.ps) { q.l -= dt; if (q.l <= 0) continue; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .97; q.vy = q.vy * .97 + 160 * dt; c.fillStyle = q.w ? '#ffffff' : R.col; c.globalAlpha = Math.min(1, q.l * 2); c.fillRect(q.x, q.y, q.s, q.s); }
  c.globalAlpha = 1;
  if (u < .3) { c.fillStyle = `rgba(255,255,255,${1 - u / .3})`; c.fillRect(0, 0, 320, 320); }
  { c.globalCompositeOperation = 'destination-in'; const m = c.createRadialGradient(160, 160, 95, 160, 160, 160); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = m; c.fillRect(0, 0, 320, 320); c.globalCompositeOperation = 'source-over'; } // Strahlen laufen zum Rand hin weich aus
}
$('gacha').onclick = () => { if (gacha && !gacha.open) gacha.t = G_OPEN; };
click('bAgain', () => { if (gacha && gacha.open) summon(); });
click('bGOk', () => { if (gacha && gacha.open) { gacha = null; setState('pets'); } });

// ---------- Sammlung und Level-Up-Übersicht
let petGen = 0;
const rarTag = P => `<span class="tag" style="background:${RAR[P.rar].col};color:${P.rar === 'L' ? '#1a1420' : '#fff'}">${RAR[P.rar].n}</span>`;
function petCanvas(d, f, owned) {
  const c = d.querySelector('canvas').getContext('2d'), s = f.sc + .8; c.imageSmoothingEnabled = false; c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(48, 72, 22, 6, 0, 0, TAU); c.fill();
  c.drawImage(owned ? f.img : dark(f.img), Math.round(48 - f.img.width * s / 2), Math.round(72 - f.img.height * s), f.img.width * s, f.img.height * s);
}
function setActive(id) { SAVE.active = SAVE.active === id ? null : id; saveGame(); sfx('click'); }
function showPets() {
  const ids = Object.keys(PETS), own = ids.filter(k => SAVE.pets[k]).length, act = SAVE.active && SAVE.pets[SAVE.active];
  $('ballInfo').textContent = `Pokébälle: ${SAVE.balls} · Beschwören kostet ${SUMMON_COST} · ${own} von ${ids.length} gesammelt`;
  $('rarInfo').innerHTML = 'Chancen: ' + RORDER.map(k => `<b style="color:${RAR[k].col}">${RAR[k].n} ${Math.round(RAR[k].p * 100)} %</b>`).join(' · ');
  $('ver').textContent = `Version 14 · ${ids.length} Pokémon mit Leveln und Entwicklungen`;
  $('ballMain').textContent = `Pokébälle: ${SAVE.balls}` + (act ? ` · Begleiter: ${petForm(SAVE.active, act.l, act).name} Lv. ${act.l}` : '');
  const b = $('bSummon'); b.textContent = `Beschwören (${SUMMON_COST} Pokébälle)`; b.disabled = SAVE.balls < SUMMON_COST; b.style.opacity = SAVE.balls < SUMMON_COST ? '.4' : '1';
  if (state !== 'pets') return;
  const tabs = $('petTabs'); tabs.innerHTML = '';
  for (let g = 0; g <= 9; g++) { const t0 = document.createElement('button'); t0.className = 'mini' + (g === petGen ? '' : ' sec'); t0.textContent = g ? 'Gen ' + g : 'Alle'; t0.onclick = () => { petGen = g; sfx('click'); showPets(); }; tabs.appendChild(t0); }
  const box = $('petList'); box.innerHTML = '';
  for (const id of ids) {
    const P = PETS[id]; if (petGen && P.gen !== petGen) continue;
    const sv = SAVE.pets[id], f = petForm(id, sv ? sv.l : 1, sv), d = document.createElement('div'); d.className = 'card' + (SAVE.active === id ? ' evo' : '') + (sv ? '' : ' off');
    d.innerHTML = `<canvas width="96" height="80"></canvas><h3>${sv ? f.name : '???'}</h3>${rarTag(P)} <span class="tag gen">Gen ${P.gen}</span><p class="perk">${sv ? 'Level ' + sv.l : 'Noch nicht beschworen'}</p>${sv ? `<p>${petDesc(f, sv.l)}</p>` : ''}<p class="key">${SAVE.active === id ? 'Aktiv – begleitet dich im Spiel' : sv ? 'Klicken zum Auswählen' : ''}</p>`;
    petCanvas(d, f, !!sv);
    if (sv) d.onclick = () => { setActive(id); showPets(); };
    box.appendChild(d);
  }
}
function showLv() {
  const ids = Object.keys(PETS).filter(k => SAVE.pets[k]).sort((a, b) => (b === SAVE.active) - (a === SAVE.active) || SAVE.pets[b].l - SAVE.pets[a].l || SAVE.pets[b].x - SAVE.pets[a].x);
  $('lvInfo').textContent = ids.length ? 'Dein aktiver Begleiter erhält für jeden besiegten Gegner 0,2 % Erfahrung. Jedes Level verstärkt seine Wirkung um 1,2 %, jede Entwicklung um weitere 12 %. Maximallevel 100.' : 'Du besitzt noch keine Pokémon. Beschwöre welche unter „Begleiter“.';
  const box = $('lvList'); box.innerHTML = '';
  for (const id of ids) {
    const P = PETS[id], sv = SAVE.pets[id], f = petForm(id, sv.l, sv), ev = nextEvo(id, sv), mx = sv.l >= PET_MAXLV, pc = mx ? 100 : sv.x / PET_KILLS * 100, d = document.createElement('div');
    d.className = 'card' + (SAVE.active === id ? ' evo' : '');
    d.innerHTML = `<canvas width="96" height="80"></canvas><h3>${f.name}</h3>${rarTag(P)} <span class="tag gen">Gen ${P.gen}</span><p class="perk">Level ${sv.l} / ${PET_MAXLV}</p><div class="xpb"><i style="width:${pc}%"></i></div><p class="key">${mx ? 'Maximallevel erreicht' : `${f1(pc)} % · noch ${PET_KILLS - sv.x} Gegner bis Level ${sv.l + 1}`}</p><p>${petDesc(f, sv.l)}</p><p class="info">Wirkung ×${String(Math.round(petPow(P, sv.l, f.s) * 100) / 100).replace('.', ',')}</p><p class="combo">${ev ? `Entwicklung: ${ev.name} ab Level ${ev.lv}` : P.st.length > 1 ? 'Voll entwickelt' : 'Entwickelt sich nicht'}</p><p class="key">${SAVE.active === id ? 'Aktiv – sammelt Erfahrung' : 'Klicken zum Auswählen'}</p>`;
    petCanvas(d, f, true);
    d.onclick = () => { setActive(id); showLv(); };
    box.appendChild(d);
  }
}
click('bPets', () => setState('pets'));
click('bLv', () => setState('pklvl'));
click('bBack3', () => setState('main'));
click('bBack4', () => setState('main'));
click('bSummon', summon);
showPets();

// ================================================================ Schleife
// Debug: index.html#select  |  #play=goku  |  #play=goku&ab=kame,ssj&t=12
if (typeof location !== 'undefined' && location.hash) {
  const hs = location.hash.slice(1), q = {};
  for (const kv of hs.split('&')) { const [a, b] = kv.split('='); q[a] = b; }
  if (hs === 'select') setState('select');
  else if ('pets' in q) { if (q.draw) { const cnt = {}, seen = new Set(); for (let i = 0; i < +q.draw; i++) { const id = rollPet(); cnt[PETS[id].rar] = (cnt[PETS[id].rar] || 0) + 1; seen.add(id); } const per = {}; for (const k in PETS) { const g = PETS[k].gen + PETS[k].rar; per[g] = (per[g] || 0) + 1; } document.title = 'DRAW ' + JSON.stringify(cnt) + ' arten=' + seen.size + ' gesamt=' + Object.keys(PETS).length + ' ' + JSON.stringify(per); } if (q.balls) SAVE.balls = +q.balls; if (q.own) for (const id of (q.own === 'all' ? Object.keys(PETS) : q.own.split(','))) if (PETS[id]) SAVE.pets[id] = newSv(+q.pl || 1); if (q.sum) { SAVE.balls = 99; setState('pets'); summon(); if (+q.sum > 1) { gacha.t = +q.sum; } } else setState(q.lv ? 'pklvl' : 'pets'); }
  else if (q.play && CHARS[q.play]) {
    if (q.pet && PETS[q.pet]) { SAVE.pets[q.pet] = newSv(+q.pl || 1); SAVE.pets[q.pet].x = +q.px || 0; SAVE.active = q.pet; }
    newGame(q.play);
    if (q.seed) worldSeed = +q.seed;
    if (q.portal) nextPortal = 1;
    if (q.ev !== undefined) { update(1 / 60); if (+q.ev === 0) hordeT = 10; else spawnMini(q.mini); }
    if (q.orb) { zoneT = 0; orbT = 0; p.buf = [20, 20, 20]; }
    if (q.rb) { const cnt = {}; let rep = 0, prev = null; for (let i = 0; i < +q.rb; i++) { const B = pick(BOSSES.filter(b => b !== prev)); if (B === prev) rep++; prev = B; cnt[B.id] = (cnt[B.id] || 0) + 1; } document.title = 'BOSS ' + JSON.stringify(cnt) + ' wiederholt=' + rep; }
    if (q.boss !== undefined) { nextB = BOSSES[+q.boss % BOSSES.length]; bossIdx = +q.bi || 0; dpsAvg = +q.dps || 1e5; enterRoom(); }
    for (const id of (q.ab || '').split(',')) if (AB[id]) { p.ab[id] = AB[id].max; if (AB[id].passive) AB[id].apply(); else p.abT[id] = +(q.at || 11.6); }
    const n = Math.round((+q.t || 12) * 60);
    for (let i = 0; i < n; i++) { if (state !== 'play') { pending = 0; setState('play'); } update(1 / 60); p.hp = p.maxHp * .7; }
    if (q.kill && room) { hit(room.boss, 1e12, 'ranged'); for (let i = 0; i < 300; i++) { if (state !== 'play') { pending = 0; setState('play'); } update(1 / 60); } }
    if (q.max) p.wLvl = 5;
    if (q.die) { p.hp = -99; update(1 / 60); const n2 = Math.round(+q.die * 60); for (let i = 0; i < n2; i++) { if (state !== 'play') { pending = 0; setState('play'); } update(1 / 60); } }
    if (q.lvl) { pending = 1; showLevelUp(); }
    if (q.sim) { // Bot: läuft im Quadrat, wählt zufällige Fähigkeiten und misst jeden Bosskampf
      const out = [], step = () => { if (state === 'levelup') choose(Math.random() * 3 | 0); else if (state !== 'play') { pending = 0; setState('play'); } const ph = Math.floor(t / 1.5) % 4; keys.d = ph === 0; keys.s = ph === 1; keys.a = ph === 2; keys.w = ph === 3; update(1 / 60); p.hp = p.maxHp; };
      for (let b = 0; b < +q.sim; b++) { let g = 0; while (!portal && g++ < 2e4) step(); const e0 = { t: Math.round(t), lv: p.level, dps: Math.round(dpsAvg) }; p.x = portal.x; p.y = portal.y - 20; portal.born = -9; g = 0; while (!room && g++ < 99) step(); e0.hp = Math.round(room.boss.maxHp); const t0 = t; g = 0; while (room && !room.done && g++ < 36000) step(); e0.sec = Math.round(t - t0); e0.hp2 = Math.round(room.boss.maxHp); e0.real = Math.round(e0.hp2 / (t - t0)); out.push(e0); while (room) step(); }
      for (const k of 'wasd') keys[k] = false; document.title = 'SIM ' + JSON.stringify(out) + (pet ? ' pet=' + JSON.stringify(pet.sv) : '');
    }
  }
}
const mqRot = matchMedia('(pointer:coarse) and (orientation:portrait) and (max-width:900px)'); // Handy im Hochformat: Hinweis zum Drehen, Spiel wartet
let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now;
  if (state === 'play' && !mqRot.matches) update(dt);
  if (state === 'gacha') tickGacha(dt);
  if (p) { const o = p.dashCd > 0 ? '.4' : '1', b = $('bDash'); if (b.style.opacity !== o) b.style.opacity = o; }
  if (state === 'main' || state === 'select' || state === 'pets' || state === 'pklvl' || state === 'gacha' || (state === 'settings' && setReturn === 'main') || !p) drawMenu(now / 1000); else render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
