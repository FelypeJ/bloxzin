// ==========================================================
// Fruit Power - Ilha da Aventura (versão completa)
// Jogo 2D original. Cada fruta tem um estilo de combate
// totalmente diferente (corpo a corpo, perfurante, em cadeia,
// teleguiado, explosivo). Inclui itens, inimigo ladrão,
// biomas, ciclo dia/noite, minimapa, música ambiente,
// placar de recordes e save automático.
// ==========================================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap-canvas');
const mctx = minimapCanvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;
const MMW = minimapCanvas.width;
const MMH = minimapCanvas.height;

const levelEl = document.getElementById('level');
const hpBar = document.getElementById('hp-bar');
const xpBar = document.getElementById('xp-bar');
const powerNameEl = document.getElementById('power-name');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const pauseBtn = document.getElementById('pause-btn');
const muteBtn = document.getElementById('mute-btn');

const cdAttack = document.getElementById('cd-attack');
const cdAbility = document.getElementById('cd-ability');
const cdDash = document.getElementById('cd-dash');

const overlay = document.getElementById('message-overlay');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const messageBtn = document.getElementById('message-btn');

const startMenu = document.getElementById('start-menu');
const playBtn = document.getElementById('play-btn');
const continueBtn = document.getElementById('continue-btn');
const leaderboardList = document.getElementById('leaderboard-list');
const fruitPreview = document.getElementById('fruit-preview');

// ==========================================================
// ÁUDIO (sintetizado, sem arquivos externos)
// ==========================================================
let audioCtx = null;
let audioEnabled = true;
let musicTimer = null;

function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, duration, type = 'sine', gain = 0.15, slideTo = null) {
  if (!audioCtx || !audioEnabled) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + duration);
  g.gain.setValueAtTime(gain, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(g).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function pitchVar(base) {
  return base * rand(0.94, 1.06);
}

const sfx = {
  attack: () => playTone(pitchVar(440), 0.1, 'triangle', 0.12, 220),
  melee: () => playTone(pitchVar(520), 0.06, 'square', 0.1, 300),
  pierce: () => playTone(pitchVar(500), 0.12, 'sine', 0.1, 900),
  chain: () => playTone(pitchVar(700), 0.15, 'sawtooth', 0.12, 1200),
  homing: () => playTone(pitchVar(380), 0.14, 'sine', 0.1, 700),
  hit: () => playTone(pitchVar(180), 0.08, 'square', 0.1, 90),
  eatFruit: () => playTone(pitchVar(523), 0.18, 'sine', 0.18, 1046),
  eatItem: () => playTone(pitchVar(660), 0.15, 'sine', 0.16, 990),
  levelUp: () => { playTone(523, 0.12, 'sine', 0.15, 659); setTimeout(() => playTone(784, 0.2, 'sine', 0.15, 1046), 120); },
  damage: () => playTone(pitchVar(140), 0.15, 'sawtooth', 0.12, 60),
  dash: () => playTone(pitchVar(300), 0.1, 'sine', 0.1, 700),
  ability: () => playTone(pitchVar(200), 0.25, 'sawtooth', 0.15, 500),
  enemyDeath: () => playTone(pitchVar(300), 0.15, 'square', 0.1, 60),
  steal: () => playTone(700, 0.2, 'sine', 0.12, 200),
  boss: () => { playTone(110, 0.3, 'sawtooth', 0.2, 80); setTimeout(() => playTone(90, 0.4, 'sawtooth', 0.2, 55), 250); },
  biome: () => { playTone(300, 0.3, 'sine', 0.14, 500); setTimeout(() => playTone(500, 0.3, 'sine', 0.14, 800), 200); },
  gameOver: () => playTone(220, 0.6, 'sawtooth', 0.18, 55),
};

// Música ambiente: pequeno arpejo em loop, volume baixo
const musicScale = [220, 261.6, 293.7, 329.6, 392, 440];
function scheduleMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = setInterval(() => {
    if (!audioEnabled || !audioCtx || paused || manualPaused) return;
    const note = musicScale[Math.floor(rand(0, musicScale.length))];
    playTone(note, 1.1, 'sine', 0.035);
  }, 1400);
}

muteBtn.addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  muteBtn.textContent = audioEnabled ? '🔊' : '🔇';
});

// ==========================================================
// BIOMAS
// ==========================================================
const BIOMES = [
  { name: 'Ilha Tropical', skyTop: '#0e4d75', skyBottom: '#124a6e', sun: '#fff4d6', sand: '#e9c46a', foliage: '#2d6a4f', accent: '#ffffff' },
  { name: 'Ilha Vulcânica', skyTop: '#3a0d0d', skyBottom: '#5c1a1a', sun: '#ff9f1c', sand: '#4a2c2a', foliage: '#7a1f1f', accent: '#ffb703' },
  { name: 'Ilha Gelada', skyTop: '#274c77', skyBottom: '#6096ba', sun: '#eaf4fb', sand: '#dbe9f4', foliage: '#a9d6e5', accent: '#ffffff' },
  { name: 'Ilha das Sombras', skyTop: '#0b0014', skyBottom: '#240046', sun: '#c77dff', sand: '#2b1b3d', foliage: '#5a189a', accent: '#e0aaff' },
];
let biomeIndex = 0;
function currentBiome() { return BIOMES[biomeIndex % BIOMES.length]; }

// ==========================================================
// DEFINIÇÃO DAS FRUTAS — cada uma com estilo de combate único
// ==========================================================
const FRUITS = [
  {
    key: 'fire', name: 'Fruta de Fogo', color: '#ff6b35', projectile: '#ff9f1c',
    attackType: 'explosive', damage: 15, splashRadius: 45, splashDamage: 8, range: 480, cooldown: 650,
    abilityName: 'Chão em Chamas', abilityType: 'dot_zone', abilityCooldown: 5200,
    abilityRadius: 95, tickDamage: 7, tickInterval: 500, zoneDuration: 3000,
    desc: 'Explosão em área a cada tiro + cria uma zona de fogo que queima quem ficar dentro.',
  },
  {
    key: 'ice', name: 'Fruta do Gelo', color: '#4cc9f0', projectile: '#a9def9',
    attackType: 'pierce', damage: 10, pierceCount: 3, range: 620, cooldown: 480,
    abilityName: 'Nevasca Congelante', abilityType: 'freeze', abilityCooldown: 6200,
    abilityRadius: 130, freezeDuration: 1800,
    desc: 'Tiro perfurante que atravessa vários inimigos e desacelera; habilidade congela todos ao redor.',
  },
  {
    key: 'thunder', name: 'Fruta do Trovão', color: '#f9c74f', projectile: '#ffe066',
    attackType: 'chain', damage: 13, chainCount: 4, chainRange: 170, range: 260, cooldown: 950,
    abilityName: 'Tempestade Elétrica', abilityType: 'random_strikes', abilityCooldown: 6000,
    strikeCount: 6, strikeDamage: 28,
    desc: 'Ataque em cadeia salta entre inimigos próximos; habilidade chama vários raios aleatórios.',
  },
  {
    key: 'dark', name: 'Fruta das Trevas', color: '#7209b7', projectile: '#b298dc',
    attackType: 'homing', damage: 14, turnRate: 0.16, range: 550, cooldown: 520,
    abilityName: 'Investida Sombria', abilityType: 'teleport_strike', abilityCooldown: 4200,
    abilityDamage: 42, invisDuration: 650,
    desc: 'Projétil teleguiado persegue o alvo; habilidade teleporta você até o inimigo mais próximo com um golpe forte e fica invisível por instantes.',
  },
  {
    key: 'rubber', name: 'Fruta da Borracha', color: '#ff477e', projectile: '#ffafcc',
    attackType: 'melee', damage: 9, meleeRange: 55, cooldown: 190,
    abilityName: 'Onda de Impacto', abilityType: 'knockback_wave', abilityCooldown: 3400,
    abilityRadius: 115, abilityDamage: 20, knockbackForce: 70,
    desc: 'Socos rápidos de curto alcance sem cooldown quase nenhum; habilidade empurra e reflete projéteis inimigos.',
  },
];

// ==========================================================
// ESTADO DO JOGADOR
// ==========================================================
const DASH_COOLDOWN = 2200;
const DASH_DURATION = 160;
const DASH_SPEED = 9;

const player = {
  x: W / 2, y: H / 2, radius: 16, speed: 3.2,
  hp: 100, maxHp: 100, level: 1, xp: 0, xpToNext: 50, score: 0,
  fruitPower: null, lastAttack: -9999, lastAbility: -9999, lastDash: -9999,
  invulnUntil: 0, facing: { x: 1, y: 0 }, dashUntil: 0, dashDir: { x: 0, y: 0 },
  hasEatenBefore: false, squash: 1, walkPhase: 0,
  shieldUntil: 0, invisibleUntil: 0, magnetUntil: 0,
};

let fruits = [];
let items = [];
let enemies = [];
let projectiles = [];
let particles = [];
let floatingTexts = [];
let zones = [];
let lightningBolts = [];

let keys = {};
let paused = false;
let manualPaused = false;
let gameStarted = false;
let lastTime = 0;
let enemySpawnTimer = 0;
let fruitSpawnTimer = 0;
let itemSpawnTimer = 0;
let saveTimer = 0;
let bossActive = false;
let highScore = 0;

let shakeTime = 0, shakeMag = 0, hitStop = 0;

// ==========================================================
// PERSISTÊNCIA (recorde, placar, save de progresso)
// ==========================================================
function safeGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); } catch (e) { /* indisponível */ }
}

highScore = parseInt(safeGet('fruitPowerHighScore') || '0', 10) || 0;
highScoreEl.textContent = highScore;

function saveHighScore() {
  if (player.score > highScore) {
    highScore = player.score;
    highScoreEl.textContent = highScore;
    safeSet('fruitPowerHighScore', String(highScore));
  }
}

function getLeaderboard() {
  try { return JSON.parse(safeGet('fruitPowerLeaderboard') || '[]'); } catch (e) { return []; }
}

function saveLeaderboard(list) {
  safeSet('fruitPowerLeaderboard', JSON.stringify(list.slice(0, 5)));
}

function maybeAddToLeaderboard(score) {
  if (score <= 0) return;
  const list = getLeaderboard();
  const qualifies = list.length < 5 || score > list[list.length - 1].score;
  if (!qualifies) return;
  let name = 'Jogador';
  try {
    const input = window.prompt(`Pontuação: ${score}! Novo recorde no top 5. Digite seu nome:`, 'Jogador');
    if (input && input.trim()) name = input.trim().slice(0, 14);
  } catch (e) { /* prompt indisponível */ }
  list.push({ name, score });
  list.sort((a, b) => b.score - a.score);
  saveLeaderboard(list.slice(0, 5));
}

function renderLeaderboard() {
  const list = getLeaderboard();
  leaderboardList.innerHTML = '';
  if (list.length === 0) {
    leaderboardList.innerHTML = '<li class="empty">Nenhuma pontuação ainda</li>';
    return;
  }
  for (const entry of list) {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = entry.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.textContent = entry.score;
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    leaderboardList.appendChild(li);
  }
}

function saveProgress() {
  const data = {
    level: player.level, score: player.score, hp: player.hp, maxHp: player.maxHp,
    xp: player.xp, xpToNext: player.xpToNext,
    fruitKey: player.fruitPower ? player.fruitPower.key : null,
    biomeIndex,
  };
  safeSet('fruitPowerSave', JSON.stringify(data));
}

function loadProgress() {
  try {
    const data = JSON.parse(safeGet('fruitPowerSave') || 'null');
    return data;
  } catch (e) { return null; }
}

function clearProgress() {
  try { localStorage.removeItem('fruitPowerSave'); } catch (e) { /* ignore */ }
}

// ==========================================================
// UTILITÁRIOS
// ==========================================================
function rand(min, max) { return Math.random() * (max - min) + min; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function triggerShake(mag, time = 200) { shakeMag = Math.max(shakeMag, mag); shakeTime = Math.max(shakeTime, time); }
function triggerHitStop(ms) { hitStop = Math.max(hitStop, ms); }
function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* indisponível */ } }

function showMessage(title, text) {
  messageTitle.textContent = title;
  messageText.textContent = text;
  overlay.classList.remove('hidden');
  paused = true;
}

messageBtn.addEventListener('click', () => {
  ensureAudio();
  overlay.classList.add('hidden');
  paused = false;
  lastTime = performance.now();
  requestAnimationFrame(loop);
});

pauseBtn.addEventListener('click', togglePause);
function togglePause() {
  if (paused || !gameStarted) return;
  manualPaused = !manualPaused;
  pauseBtn.textContent = manualPaused ? '▶' : '⏸';
  if (!manualPaused) {
    lastTime = performance.now();
    requestAnimationFrame(loop);
  } else {
    saveProgress();
    drawPauseOverlay();
  }
}

// ==========================================================
// SPAWN — frutas, itens, inimigos
// ==========================================================
function spawnFruit() {
  const type = FRUITS[Math.floor(rand(0, FRUITS.length))];
  fruits.push({ x: rand(40, W - 40), y: rand(40, H - 40), radius: 12, type, bob: Math.random() * Math.PI * 2 });
}

const ITEM_TYPES = ['potion', 'shield', 'magnet'];
function spawnItem() {
  const type = ITEM_TYPES[Math.floor(rand(0, ITEM_TYPES.length))];
  items.push({ x: rand(40, W - 40), y: rand(40, H - 40), radius: 11, type, bob: Math.random() * Math.PI * 2 });
}

const ENEMY_TYPES = ['chaser', 'fast', 'tank', 'ranged'];

function spawnEnemy(forceBoss = false) {
  const edge = Math.floor(rand(0, 4));
  let x, y;
  if (edge === 0) { x = -20; y = rand(0, H); }
  else if (edge === 1) { x = W + 20; y = rand(0, H); }
  else if (edge === 2) { x = rand(0, W); y = -20; }
  else { x = rand(0, W); y = H + 20; }

  const tier = clamp(Math.floor(player.level / 2), 0, 5);

  if (forceBoss) {
    bossActive = true;
    enemies.push({
      x, y, radius: 34, speed: 1.3, hp: 220 + tier * 60, maxHp: 220 + tier * 60,
      damage: 16 + tier * 3, xpValue: 120 + tier * 20, color: '#d90429', type: 'boss', isBoss: true, lastShot: 0,
    });
    sfx.boss();
    showMessage('Um chefe apareceu!', 'Um inimigo poderoso surgiu na ilha. Use sua habilidade (E) e o dash (Shift) para sobreviver!');
    return;
  }

  let type = ENEMY_TYPES[Math.floor(rand(0, ENEMY_TYPES.length))];
  if (player.level >= 3 && Math.random() < 0.18) type = 'thief';

  let base = { x, y, color: `hsl(${rand(0, 360)}, 60%, 55%)`, lastShot: 0, type };

  if (type === 'fast') {
    Object.assign(base, { radius: 10 + tier, speed: 2.4 + tier * 0.2, hp: 16 + tier * 8, maxHp: 16 + tier * 8, damage: 4 + tier, xpValue: 12 + tier * 6 });
  } else if (type === 'tank') {
    Object.assign(base, { radius: 22 + tier * 2, speed: 0.7 + tier * 0.08, hp: 60 + tier * 30, maxHp: 60 + tier * 30, damage: 10 + tier * 3, xpValue: 25 + tier * 12 });
  } else if (type === 'ranged') {
    Object.assign(base, { radius: 13 + tier, speed: 1.0 + tier * 0.1, hp: 20 + tier * 10, maxHp: 20 + tier * 10, damage: 5 + tier, xpValue: 18 + tier * 8, keepDistance: 160 });
  } else if (type === 'thief') {
    Object.assign(base, { radius: 12, speed: 2.7 + tier * 0.15, hp: 18 + tier * 6, maxHp: 18 + tier * 6, damage: 4, xpValue: 20 + tier * 6, color: '#adb5bd' });
  } else {
    Object.assign(base, { radius: 14 + tier * 2, speed: 1.1 + tier * 0.15, hp: 30 + tier * 20, maxHp: 30 + tier * 20, damage: 6 + tier * 2, xpValue: 15 + tier * 10 });
  }

  enemies.push(base);
}

function spawnParticles(x, y, color, count = 8, opts = {}) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y, vx: rand(-2.5, 2.5) * (opts.speed || 1), vy: rand(-2.5, 2.5) * (opts.speed || 1),
      life: opts.life || 30, maxLife: opts.life || 30, color, size: opts.size || rand(2, 4),
    });
  }
}

function spawnFloatingText(x, y, text, color = '#ffd166') {
  floatingTexts.push({ x, y, text, color, life: 45, maxLife: 45 });
}

// ==========================================================
// INPUT — teclado
// ==========================================================
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (!keys[k]) ensureAudio();
  keys[k] = true;
  if (e.key === ' ') e.preventDefault();
  if (k === 'p') togglePause();
  if (k === 'm') muteBtn.click();
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// ==========================================================
// INPUT — touch
// ==========================================================
const joystickZone = document.getElementById('joystick-zone');
const joystickKnob = document.getElementById('joystick-knob');
let joystickActive = false;
let joystickVec = { x: 0, y: 0 };
let joystickTouchId = null;

joystickZone.addEventListener('touchstart', (e) => {
  ensureAudio();
  const t = e.changedTouches[0];
  joystickTouchId = t.identifier;
  joystickActive = true;
  e.preventDefault();
}, { passive: false });

joystickZone.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === joystickTouchId) {
      const rect = joystickZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const maxR = rect.width / 2;
      const len = Math.hypot(dx, dy);
      if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR; }
      joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      joystickVec = { x: dx / maxR, y: dy / maxR };
    }
  }
  e.preventDefault();
}, { passive: false });

function resetJoystick(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joystickTouchId) {
      joystickActive = false; joystickTouchId = null; joystickVec = { x: 0, y: 0 };
      joystickKnob.style.transform = 'translate(-50%, -50%)';
    }
  }
}
joystickZone.addEventListener('touchend', resetJoystick);
joystickZone.addEventListener('touchcancel', resetJoystick);

function wireTouchBtn(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('touchstart', (e) => { ensureAudio(); keys[key] = true; e.preventDefault(); }, { passive: false });
  el.addEventListener('touchend', (e) => { keys[key] = false; e.preventDefault(); }, { passive: false });
}
wireTouchBtn('btn-attack', ' ');
wireTouchBtn('btn-ability', 'e');
wireTouchBtn('btn-dash', 'shift');

// ==========================================================
// ATUALIZAÇÃO — jogador, ataques e habilidades
// ==========================================================
function updatePlayer(dt) {
  const now = performance.now();
  const dashing = now < player.dashUntil;

  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (joystickActive) { dx = joystickVec.x; dy = joystickVec.y; }

  if (dashing) {
    player.x = clamp(player.x + player.dashDir.x * DASH_SPEED, player.radius, W - player.radius);
    player.y = clamp(player.y + player.dashDir.y * DASH_SPEED, player.radius, H - player.radius);
    if (Math.random() < 0.6) spawnParticles(player.x, player.y, player.fruitPower ? player.fruitPower.color : '#f1f5f9', 2, { life: 18, size: 3 });
  } else if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    player.x = clamp(player.x + dx * player.speed, player.radius, W - player.radius);
    player.y = clamp(player.y + dy * player.speed, player.radius, H - player.radius);
    player.facing = { x: dx, y: dy };
    player.walkPhase += 0.25;
  }

  if (keys['shift'] && now - player.lastDash > DASH_COOLDOWN && !dashing) {
    let len = Math.hypot(player.facing.x, player.facing.y) || 1;
    player.dashDir = { x: player.facing.x / len, y: player.facing.y / len };
    player.dashUntil = now + DASH_DURATION;
    player.lastDash = now;
    player.invulnUntil = Math.max(player.invulnUntil, now + DASH_DURATION + 100);
    player.squash = 1.4;
    sfx.dash();
  }

  if (keys[' '] && player.fruitPower && now - player.lastAttack > player.fruitPower.cooldown) {
    player.lastAttack = now;
    performAttack();
  }

  if (keys['e'] && player.fruitPower && now - player.lastAbility > player.fruitPower.abilityCooldown) {
    player.lastAbility = now;
    performAbility();
  }

  player.squash += (1 - player.squash) * 0.2;
  if (!dashing) player.hp = clamp(player.hp + dt * 0.0025, 0, player.maxHp);

  // ímã: puxa frutas e itens
  if (now < player.magnetUntil) {
    for (const f of fruits) pullToward(f, player, 0.18);
    for (const it of items) pullToward(it, player, 0.18);
  }
}

function pullToward(obj, target, strength) {
  const dx = target.x - obj.x, dy = target.y - obj.y;
  const len = Math.hypot(dx, dy) || 1;
  if (len > 6) { obj.x += (dx / len) * strength * len * 0.06; obj.y += (dy / len) * strength * len * 0.06; }
}

// ---------- Ataques diferenciados por fruta ----------
function nearestEnemy(from, maxRange = Infinity, exclude = null) {
  let target = null, best = maxRange;
  for (const en of enemies) {
    if (en === exclude) continue;
    const d = dist(from, en);
    if (d < best) { best = d; target = en; }
  }
  return target;
}

function performAttack() {
  const power = player.fruitPower;
  player.squash = 1.25;

  switch (power.attackType) {
    case 'melee': {
      sfx.melee();
      const dirx = player.facing.x || 1, diry = player.facing.y || 0;
      const hx = player.x + dirx * 18, hy = player.y + diry * 18;
      spawnParticles(hx, hy, power.projectile, 6, { life: 14, size: 3 });
      for (const en of enemies) {
        if (dist(player, en) < power.meleeRange + en.radius) {
          damageEnemy(en, power.damage, power.projectile);
        }
      }
      break;
    }
    case 'pierce': {
      sfx.pierce();
      const target = nearestEnemy(player, power.range);
      let vx, vy;
      if (target) { vx = target.x - player.x; vy = target.y - player.y; }
      else { vx = player.facing.x || 1; vy = player.facing.y || 0; }
      const len = Math.hypot(vx, vy) || 1;
      projectiles.push({
        x: player.x, y: player.y, vx: (vx / len) * 7.5, vy: (vy / len) * 7.5, radius: 7,
        color: power.projectile, damage: power.damage, life: 70, fromPlayer: true,
        pierceRemaining: power.pierceCount, hitSet: new Set(), slow: true,
      });
      break;
    }
    case 'chain': {
      sfx.chain();
      const points = [{ x: player.x, y: player.y }];
      let current = player;
      const hitEnemies = [];
      for (let i = 0; i < power.chainCount; i++) {
        const range = i === 0 ? power.range : power.chainRange;
        const next = nearestEnemy(current, range, null);
        const candidate = enemies.find((en) => !hitEnemies.includes(en) && dist(current, en) < range);
        if (!candidate) break;
        hitEnemies.push(candidate);
        points.push({ x: candidate.x, y: candidate.y });
        damageEnemy(candidate, power.damage, power.projectile);
        current = candidate;
      }
      if (points.length > 1) {
        lightningBolts.push({ points, life: 14, maxLife: 14, color: power.projectile });
        triggerShake(3, 100);
      }
      break;
    }
    case 'homing': {
      sfx.homing();
      const target = nearestEnemy(player, power.range);
      let vx = player.facing.x || 1, vy = player.facing.y || 0;
      if (target) { vx = target.x - player.x; vy = target.y - player.y; }
      const len = Math.hypot(vx, vy) || 1;
      projectiles.push({
        x: player.x, y: player.y, vx: (vx / len) * 6, vy: (vy / len) * 6, radius: 7,
        color: power.projectile, damage: power.damage, life: 90, fromPlayer: true,
        homing: true, turnRate: power.turnRate,
      });
      break;
    }
    case 'explosive':
    default: {
      sfx.attack();
      const target = nearestEnemy(player, power.range);
      let vx, vy;
      if (target) { vx = target.x - player.x; vy = target.y - player.y; }
      else { vx = player.facing.x || 1; vy = player.facing.y || 0; }
      const len = Math.hypot(vx, vy) || 1;
      projectiles.push({
        x: player.x, y: player.y, vx: (vx / len) * 7, vy: (vy / len) * 7, radius: 7,
        color: power.projectile, damage: power.damage, life: 60, fromPlayer: true,
        explosive: true, splashRadius: power.splashRadius, splashDamage: power.splashDamage,
      });
      break;
    }
  }
  spawnParticles(player.x, player.y, power.projectile, 4, { life: 12, size: 2 });
}

function performAbility() {
  const power = player.fruitPower;
  sfx.ability();
  spawnFloatingText(player.x, player.y - 30, power.abilityName, power.color);

  switch (power.abilityType) {
    case 'dot_zone': {
      triggerShake(4, 150);
      zones.push({
        x: player.x, y: player.y, radius: power.abilityRadius, color: power.projectile,
        tickDamage: power.tickDamage, tickInterval: power.tickInterval, nextTick: performance.now(),
        expiresAt: performance.now() + power.zoneDuration,
      });
      spawnParticles(player.x, player.y, power.projectile, 20, { life: 30, speed: 1.5 });
      break;
    }
    case 'freeze': {
      triggerShake(5, 180);
      spawnParticles(player.x, player.y, power.projectile, 30, { life: 35, speed: 2 });
      for (const en of enemies) {
        if (dist(player, en) < power.abilityRadius) {
          en.frozenUntil = performance.now() + power.freezeDuration;
          spawnFloatingText(en.x, en.y - 18, 'Congelado!', '#a9def9');
        }
      }
      break;
    }
    case 'random_strikes': {
      triggerShake(7, 260);
      const candidates = enemies.slice();
      for (let i = 0; i < power.strikeCount && candidates.length > 0; i++) {
        const idx = Math.floor(rand(0, candidates.length));
        const target = candidates.splice(idx, 1)[0];
        setTimeout(() => {
          if (target.hp > 0) {
            damageEnemy(target, power.strikeDamage, power.projectile);
            spawnParticles(target.x, target.y, '#ffe066', 10, { life: 20 });
          }
          lightningBolts.push({ points: [{ x: target.x, y: -20 }, { x: target.x, y: target.y }], life: 10, maxLife: 10, color: '#ffe066' });
        }, i * 90);
      }
      break;
    }
    case 'teleport_strike': {
      const target = nearestEnemy(player, 900);
      spawnParticles(player.x, player.y, power.color, 16, { life: 20 });
      if (target) {
        player.x = clamp(target.x - Math.sign(target.x - player.x || 1) * (target.radius + 20), player.radius, W - player.radius);
        player.y = clamp(target.y, player.radius, H - player.radius);
        damageEnemy(target, power.abilityDamage, power.projectile);
        triggerHitStop(60);
        triggerShake(6, 180);
      }
      spawnParticles(player.x, player.y, power.color, 16, { life: 20 });
      player.invisibleUntil = performance.now() + power.invisDuration;
      player.invulnUntil = Math.max(player.invulnUntil, player.invisibleUntil);
      break;
    }
    case 'knockback_wave': {
      triggerShake(8, 220);
      spawnParticles(player.x, player.y, power.color, 24, { life: 25, speed: 2.5 });
      for (const en of enemies) {
        if (dist(player, en) < power.abilityRadius) {
          damageEnemy(en, power.abilityDamage, power.color);
          const dx = en.x - player.x, dy = en.y - player.y;
          const l = Math.hypot(dx, dy) || 1;
          en.x = clamp(en.x + (dx / l) * power.knockbackForce, en.radius, W - en.radius);
          en.y = clamp(en.y + (dy / l) * power.knockbackForce, en.radius, H - en.radius);
        }
      }
      // reflete projéteis inimigos próximos
      for (const p of projectiles) {
        if (!p.fromPlayer && dist(player, p) < power.abilityRadius) {
          p.fromPlayer = true;
          p.color = power.color;
          p.vx *= -1; p.vy *= -1;
        }
      }
      break;
    }
  }
}

function damageEnemy(en, amount, particleColor) {
  en.hp -= amount;
  spawnParticles(en.x, en.y, particleColor, 5, { life: 16 });
  spawnFloatingText(en.x, en.y - 16, `-${Math.round(amount)}`, '#ffffff');
  if (en.hp <= 0 && !en.dying) {
    triggerHitStop(en.isBoss ? 80 : 24);
    killEnemy(en);
  } else if (en.isBoss) {
    triggerHitStop(15);
  }
}

function killEnemy(en) {
  player.xp += en.xpValue;
  player.score += en.xpValue * 2;
  spawnParticles(en.x, en.y, '#ffd166', 16, { life: 26, speed: 1.5 });
  sfx.enemyDeath();
  en.dying = true;
  en.deathTimer = 260;
  if (en.isBoss) {
    bossActive = false;
    player.score += 100;
    spawnFloatingText(en.x, en.y - 30, 'CHEFE DERROTADO! +100', '#ffd166');
    triggerShake(10, 350);
    fruits.push({ x: en.x, y: en.y, radius: 12, type: FRUITS[Math.floor(rand(0, FRUITS.length))], bob: 0 });
  }
  checkLevelUp();
}

function updateEnemies(dt) {
  const now = performance.now();
  for (const en of enemies) {
    if (en.dying) { en.deathTimer -= dt; continue; }

    const frozen = en.frozenUntil && en.frozenUntil > now;
    if (frozen) continue;

    const dx = player.x - en.x, dy = player.y - en.y;
    const len = Math.hypot(dx, dy) || 1;
    const slowed = en.slowUntil && en.slowUntil > now;
    const spd = slowed ? en.speed * 0.4 : en.speed;

    if (en.type === 'ranged') {
      if (len < en.keepDistance - 20) { en.x -= (dx / len) * spd; en.y -= (dy / len) * spd; }
      else if (len > en.keepDistance + 20) { en.x += (dx / len) * spd; en.y += (dy / len) * spd; }
      if (now - en.lastShot > 1400 && len < 400) {
        en.lastShot = now;
        projectiles.push({ x: en.x, y: en.y, vx: (dx / len) * 4, vy: (dy / len) * 4, radius: 6, color: '#ef476f', damage: en.damage, life: 90, fromPlayer: false });
      }
    } else {
      en.x += (dx / len) * spd;
      en.y += (dy / len) * spd;
    }

    if (en.isBoss && now - en.lastShot > 2200) {
      en.lastShot = now;
      for (let a = 0; a < 6; a++) {
        const ang = (Math.PI * 2 * a) / 6;
        projectiles.push({ x: en.x, y: en.y, vx: Math.cos(ang) * 3.4, vy: Math.sin(ang) * 3.4, radius: 6, color: '#d90429', damage: en.damage * 0.7, life: 100, fromPlayer: false });
      }
    }

    const invisible = now < player.invisibleUntil;
    if (len < en.radius + player.radius && !invisible) {
      if (now > player.invulnUntil && now > player.shieldUntil) {
        if (en.type === 'thief' && player.fruitPower) {
          player.fruitPower = null;
          spawnFloatingText(player.x, player.y - 30, 'Poder roubado!', '#adb5bd');
          sfx.steal();
          en.dying = true; en.deathTimer = 200; en.hp = 0;
          spawnParticles(en.x, en.y, '#adb5bd', 14, { life: 20 });
        } else {
          player.hp -= en.damage;
          player.invulnUntil = now + 500;
          spawnParticles(player.x, player.y, '#ef476f', 10);
          triggerShake(4, 150);
          sfx.damage();
          vibrate(60);
        }
      }
    }
  }

  enemies = enemies.filter((en) => !(en.dying && en.deathTimer <= 0));
}

function updateZones() {
  const now = performance.now();
  for (const z of zones) {
    if (now >= z.nextTick) {
      z.nextTick = now + z.tickInterval;
      for (const en of enemies) {
        if (!en.dying && dist(z, en) < z.radius) {
          damageEnemy(en, z.tickDamage, z.color);
        }
      }
      spawnParticles(z.x + rand(-z.radius / 2, z.radius / 2), z.y + rand(-z.radius / 2, z.radius / 2), z.color, 2, { life: 20, size: 3 });
    }
  }
  zones = zones.filter((z) => now < z.expiresAt);
}

function updateLightning(dt) {
  for (const b of lightningBolts) b.life -= dt * 0.06;
  lightningBolts = lightningBolts.filter((b) => b.life > 0);
}

function updateProjectiles() {
  const now = performance.now();
  for (const p of projectiles) {
    if (p.homing) {
      const target = nearestEnemy(p, 700);
      if (target) {
        const dx = target.x - p.x, dy = target.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const tvx = (dx / len) * 6, tvy = (dy / len) * 6;
        p.vx += (tvx - p.vx) * p.turnRate;
        p.vy += (tvy - p.vy) * p.turnRate;
      }
    }
    p.x += p.vx; p.y += p.vy; p.life--;
  }

  for (const p of projectiles) {
    if (p.life <= 0) continue;
    if (p.fromPlayer) {
      for (const en of enemies) {
        if (en.dying) continue;
        if (p.hitSet && p.hitSet.has(en)) continue;
        if (dist(p, en) < p.radius + en.radius) {
          damageEnemy(en, p.damage, p.color);
          if (p.slow) en.slowUntil = now + 1500;

          if (p.explosive) {
            for (const other of enemies) {
              if (other !== en && !other.dying && dist(p, other) < p.splashRadius) {
                damageEnemy(other, p.splashDamage, p.color);
              }
            }
            spawnParticles(p.x, p.y, p.color, 14, { life: 22, speed: 2 });
            triggerShake(3, 120);
            p.life = 0;
          } else if (p.pierceRemaining !== undefined) {
            p.hitSet.add(en);
            p.pierceRemaining--;
            if (p.pierceRemaining < 0) p.life = 0;
          } else {
            p.life = 0;
          }
        }
      }
    } else {
      const invisible = now < player.invisibleUntil;
      if (!invisible && dist(p, player) < p.radius + player.radius && now > player.invulnUntil && now > player.shieldUntil) {
        player.hp -= p.damage;
        player.invulnUntil = now + 400;
        p.life = 0;
        spawnParticles(player.x, player.y, p.color, 8);
        triggerShake(3, 130);
        sfx.damage();
        vibrate(40);
      }
    }
  }

  projectiles = projectiles.filter((p) => p.life > 0 && p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20);
}

function checkLevelUp() {
  let leveled = false;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.xpToNext = Math.round(player.xpToNext * 1.32);
    player.maxHp += 15;
    player.hp = player.maxHp;
    spawnParticles(player.x, player.y, '#06d6a0', 22, { life: 35, speed: 1.8 });
    spawnFloatingText(player.x, player.y - 30, `Nível ${player.level}!`, '#06d6a0');
    leveled = true;

    if (player.level % 5 === 0 && !bossActive) {
      setTimeout(() => spawnEnemy(true), 600);
    }
    if (player.level % 10 === 0) {
      biomeIndex++;
      sfx.biome();
      spawnFloatingText(player.x, player.y - 55, currentBiome().name, currentBiome().accent);
    }
  }
  if (leveled) { sfx.levelUp(); triggerShake(5, 180); }
}

function updateFruitsAndItems() {
  for (const f of fruits) {
    f.bob += 0.05;
    if (dist(player, f) < player.radius + f.radius) {
      player.fruitPower = f.type;
      player.score += 5;
      spawnParticles(f.x, f.y, f.type.color, 14, { life: 30 });
      spawnFloatingText(f.x, f.y - 16, f.type.name, f.type.color);
      f.eaten = true;
      sfx.eatFruit();
      if (!player.hasEatenBefore) {
        player.hasEatenBefore = true;
        showMessage('Fruta consumida!', `Você comeu a ${f.type.name}. ${f.type.desc} (ESPAÇO ataca, E usa a habilidade)`);
      }
    }
  }
  fruits = fruits.filter((f) => !f.eaten);

  const now = performance.now();
  for (const it of items) {
    it.bob += 0.06;
    if (dist(player, it) < player.radius + it.radius) {
      it.eaten = true;
      sfx.eatItem();
      spawnParticles(it.x, it.y, itemColor(it.type), 12, { life: 26 });
      if (it.type === 'potion') {
        player.hp = clamp(player.hp + 30, 0, player.maxHp);
        spawnFloatingText(it.x, it.y - 16, '+30 HP', '#06d6a0');
      } else if (it.type === 'shield') {
        player.shieldUntil = now + 4000;
        spawnFloatingText(it.x, it.y - 16, 'Escudo!', '#4cc9f0');
      } else if (it.type === 'magnet') {
        player.magnetUntil = now + 5000;
        spawnFloatingText(it.x, it.y - 16, 'Ímã!', '#f9c74f');
      }
    }
  }
  items = items.filter((it) => !it.eaten);
}

function itemColor(type) {
  if (type === 'potion') return '#06d6a0';
  if (type === 'shield') return '#4cc9f0';
  return '#f9c74f';
}

function updateParticles() {
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life--; }
  particles = particles.filter((p) => p.life > 0);
  for (const t of floatingTexts) { t.y -= 0.5; t.life--; }
  floatingTexts = floatingTexts.filter((t) => t.life > 0);
}

function checkGameOver() {
  if (player.hp <= 0) {
    sfx.gameOver();
    saveHighScore();
    maybeAddToLeaderboard(player.score);
    renderLeaderboard();
    clearProgress();
    const isRecord = player.score >= highScore && player.score > 0;
    showMessage('Você foi derrotado!', `Pontuação final: ${player.score}.${isRecord ? ' Novo recorde!' : ` Recorde: ${highScore}.`} Pressione continuar para recomeçar a aventura.`);
    resetGame();
  }
}

function resetGame() {
  player.x = W / 2; player.y = H / 2;
  player.hp = player.maxHp = 100;
  player.level = 1; player.xp = 0; player.xpToNext = 50; player.score = 0;
  player.fruitPower = null; player.hasEatenBefore = false;
  player.lastAttack = -9999; player.lastAbility = -9999; player.lastDash = -9999;
  player.shieldUntil = 0; player.invisibleUntil = 0; player.magnetUntil = 0;
  bossActive = false; biomeIndex = 0;
  enemies = []; fruits = []; items = []; projectiles = []; particles = []; floatingTexts = []; zones = []; lightningBolts = [];
}

function applySavedProgress(data) {
  player.level = data.level || 1;
  player.score = data.score || 0;
  player.maxHp = data.maxHp || 100;
  player.hp = data.hp || player.maxHp;
  player.xp = data.xp || 0;
  player.xpToNext = data.xpToNext || 50;
  biomeIndex = data.biomeIndex || 0;
  if (data.fruitKey) {
    const f = FRUITS.find((fr) => fr.key === data.fruitKey);
    if (f) { player.fruitPower = f; player.hasEatenBefore = true; }
  }
}

// ==========================================================
// CENÁRIO DECORATIVO
// ==========================================================
const clouds = Array.from({ length: 5 }, () => ({ x: rand(0, W), y: rand(20, 110), scale: rand(0.6, 1.3), speed: rand(0.08, 0.22) }));
const sparkles = Array.from({ length: 40 }, () => ({ x: rand(0, W), y: rand(0, H), phase: rand(0, Math.PI * 2) }));
const palms = [
  { x: W / 2 - 190, y: H / 2 + 40, scale: 1.1, sway: rand(0, 10) },
  { x: W / 2 - 120, y: H / 2 + 95, scale: 0.85, sway: rand(0, 10) },
  { x: W / 2 + 170, y: H / 2 + 30, scale: 1.2, sway: rand(0, 10) },
  { x: W / 2 + 230, y: H / 2 + 90, scale: 0.9, sway: rand(0, 10) },
  { x: W / 2 + 30, y: H / 2 + 120, scale: 1.0, sway: rand(0, 10) },
];

let animClock = 0;
let dayNightClock = 0;

function drawBackground(dt) {
  animClock += dt * 0.001;
  dayNightClock += dt * 0.00005; // ciclo lento (~2min por volta completa)
  const nightFactor = (Math.sin(dayNightClock) + 1) / 2; // 0 = dia, 1 = noite

  const biome = currentBiome();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, biome.skyTop);
  grad.addColorStop(0.35, biome.skyBottom);
  grad.addColorStop(1, biome.skyTop);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const sunX = W - 90, sunY = 70;
  const pulse = 1 + Math.sin(animClock * 1.5) * 0.06;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70 * pulse);
  sunGrad.addColorStop(0, biome.sun.replace(')', ', 0.9)').replace('rgb', 'rgba') || 'rgba(255,244,214,0.9)');
  sunGrad.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath(); ctx.arc(sunX, sunY, 70 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = biome.sun;
  ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI * 2); ctx.fill();

  for (const c of clouds) {
    c.x += c.speed;
    if (c.x > W + 80) c.x = -80;
    drawCloud(c.x, c.y, c.scale);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 6; row++) {
    const yBase = 130 + row * 70;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const y = yBase + Math.sin(x * 0.02 + animClock * 1.6 + row) * 4;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (const s of sparkles) {
    const a = (Math.sin(animClock * 2 + s.phase) + 1) / 2;
    ctx.globalAlpha = a * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(s.x, s.y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  const islandGrad = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 270);
  islandGrad.addColorStop(0, biome.sand);
  islandGrad.addColorStop(0.7, shadeColor(biome.sand, -25));
  islandGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = islandGrad;
  ctx.beginPath(); ctx.ellipse(W / 2, H / 2, 260, 160, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = shadeColor(biome.foliage, 0) + '';
  ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.ellipse(W / 2, H / 2, 170, 100, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  for (const p of palms) drawPalm(p.x, p.y, p.scale, Math.sin(animClock * 1.2 + p.sway) * 0.08, biome);

  // ciclo dia/noite: escurece gradualmente
  if (nightFactor > 0.05) {
    ctx.fillStyle = `rgba(6, 10, 30, ${nightFactor * 0.45})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(18, -6, 18, 10, 0, 0, Math.PI * 2);
  ctx.ellipse(-18, -4, 16, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPalm(x, y, scale, sway, biome) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.strokeStyle = '#7a4a2b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 46);
  ctx.quadraticCurveTo(6 + sway * 40, 20, 4 + sway * 60, -6);
  ctx.stroke();
  const topX = 4 + sway * 60, topY = -6;
  ctx.translate(topX, topY); ctx.rotate(sway * 0.4);
  ctx.fillStyle = biome.foliage;
  for (let i = 0; i < 5; i++) {
    const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    ctx.save(); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(16, 0, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = shadeColor(biome.foliage, -40);
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function shadeColor(hex, percent) {
  if (!hex.startsWith('#')) return hex;
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + percent, g = ((num >> 8) & 0x00ff) + percent, b = (num & 0x0000ff) + percent;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

// ==========================================================
// ÍCONES DE FRUTAS E ITENS
// ==========================================================
function drawFruitIcon(x, y, r, fruit) {
  ctx.save(); ctx.translate(x, y);
  if (fruit.key === 'fire') {
    const flick = Math.sin(animClock * 8) * 2;
    const grad = ctx.createRadialGradient(0, 2, 1, 0, 2, r + 4);
    grad.addColorStop(0, '#ffe066'); grad.addColorStop(0.6, '#ff6b35'); grad.addColorStop(1, '#c1121f');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -r - 4 - flick * 0.3);
    ctx.quadraticCurveTo(r + 2, -2, 0, r + 4);
    ctx.quadraticCurveTo(-r - 2, -2, 0, -r - 4 - flick * 0.3);
    ctx.fill();
  } else if (fruit.key === 'ice') {
    ctx.fillStyle = '#a9def9'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const rr = i % 2 === 0 ? r + 3 : r - 3;
      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (fruit.key === 'thunder') {
    ctx.fillStyle = '#f9c74f';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5c00';
    ctx.beginPath();
    ctx.moveTo(-2, -r + 3); ctx.lineTo(4, -1); ctx.lineTo(-1, -1); ctx.lineTo(3, r - 3); ctx.lineTo(-5, 2); ctx.lineTo(0, 2);
    ctx.closePath(); ctx.fill();
  } else if (fruit.key === 'dark') {
    ctx.fillStyle = '#3c096c';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b298dc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0.3, Math.PI * 1.4); ctx.stroke();
  } else {
    ctx.fillStyle = '#ff477e';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd6e3'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#2d6a4f';
  ctx.beginPath(); ctx.ellipse(3, -r - 2, 5, 2.5, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFruits() {
  for (const f of fruits) {
    const bobY = Math.sin(f.bob) * 4;
    ctx.save(); ctx.shadowColor = f.type.color; ctx.shadowBlur = 12;
    drawFruitIcon(f.x, f.y + bobY, f.radius, f.type);
    ctx.restore();
  }
}

function drawItemIcon(x, y, r, type) {
  ctx.save(); ctx.translate(x, y);
  if (type === 'potion') {
    ctx.fillStyle = '#0a1c2b';
    ctx.fillRect(-2, -r - 2, 4, 4);
    ctx.fillStyle = '#06d6a0';
    ctx.beginPath();
    ctx.moveTo(-6, -r + 2); ctx.lineTo(6, -r + 2); ctx.lineTo(9, r); ctx.quadraticCurveTo(9, r + 4, 0, r + 4);
    ctx.quadraticCurveTo(-9, r + 4, -9, r); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-3, 2, 2, 6, 0, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'shield') {
    ctx.fillStyle = '#4cc9f0';
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.quadraticCurveTo(r, -r * 0.6, r * 0.8, r * 0.2);
    ctx.quadraticCurveTo(r * 0.6, r, 0, r + 3);
    ctx.quadraticCurveTo(-r * 0.6, r, -r * 0.8, r * 0.2);
    ctx.quadraticCurveTo(-r, -r * 0.6, 0, -r);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  } else {
    ctx.strokeStyle = '#f9c74f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 2, r * 0.7, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.68, -1); ctx.lineTo(-r * 0.68, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.68, -1); ctx.lineTo(r * 0.68, 5); ctx.stroke();
  }
  ctx.restore();
}

function drawItems() {
  for (const it of items) {
    const bobY = Math.sin(it.bob) * 4;
    ctx.save(); ctx.shadowColor = itemColor(it.type); ctx.shadowBlur = 10;
    drawItemIcon(it.x, it.y + bobY, it.radius, it.type);
    ctx.restore();
  }
}

// ==========================================================
// PERSONAGEM
// ==========================================================
function drawPlayer() {
  const now = performance.now();
  const blinking = now < player.invulnUntil && Math.floor(now / 80) % 2 === 0;
  const dashing = now < player.dashUntil;
  const invisible = now < player.invisibleUntil;
  const shielded = now < player.shieldUntil;
  const moving = keys['w'] || keys['a'] || keys['s'] || keys['d'] || keys['arrowup'] || keys['arrowleft'] || keys['arrowdown'] || keys['arrowright'] || joystickActive;
  const bob = moving ? Math.sin(player.walkPhase) * 2 : Math.sin(animClock * 2) * 1;

  const facingLeft = player.facing.x < -0.1;
  const bodyColor = player.fruitPower ? player.fruitPower.color : '#f1f5f9';

  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.scale((facingLeft ? -1 : 1) * player.squash, 1 / (player.squash * 0.5 + 0.5));

  if (invisible) ctx.globalAlpha = 0.25;
  else if (dashing) ctx.globalAlpha = 0.55;
  else if (blinking) ctx.globalAlpha = 0.4;

  ctx.save();
  ctx.globalAlpha *= 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, player.radius + 6 - bob * 0.3, player.radius * 0.9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (player.fruitPower) {
    const swing = Math.sin(player.walkPhase * 0.5) * 4;
    ctx.fillStyle = player.fruitPower.color;
    ctx.globalAlpha *= 0.85;
    ctx.beginPath();
    ctx.moveTo(-player.radius * 0.6, -2);
    ctx.quadraticCurveTo(-player.radius * 1.6 - swing, player.radius * 1.2, -player.radius * 0.3, player.radius * 1.4);
    ctx.quadraticCurveTo(-player.radius * 0.9, player.radius * 0.4, -player.radius * 0.5, player.radius * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = invisible ? 0.25 : dashing ? 0.55 : blinking ? 0.4 : 1;
  }

  ctx.fillStyle = '#334155';
  const legOffset = moving ? Math.sin(player.walkPhase) * 4 : 0;
  ctx.beginPath(); ctx.ellipse(-5, player.radius - 2 + legOffset, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, player.radius - 2 - legOffset, 4, 6, 0, 0, Math.PI * 2); ctx.fill();

  if (player.fruitPower) { ctx.shadowColor = player.fruitPower.color; ctx.shadowBlur = 16; }
  const bodyGrad = ctx.createRadialGradient(-4, -6, 2, 0, 0, player.radius + 2);
  bodyGrad.addColorStop(0, shadeColor(bodyColor, 35));
  bodyGrad.addColorStop(1, bodyColor);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#0a1c2b'; ctx.lineWidth = 2; ctx.stroke();

  const atkPulse = clamp(1 - (now - player.lastAttack) / 150, 0, 1);
  if (atkPulse > 0) {
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(player.radius + atkPulse * 8, -2, 5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = '#0a1c2b';
  ctx.beginPath(); ctx.ellipse(6, -3, 2.4, blinking ? 0.5 : 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-3, -4, 2, blinking ? 0.5 : 2.6, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;

  if (shielded) {
    ctx.save();
    ctx.strokeStyle = 'rgba(76, 201, 240, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y + bob, player.radius + 8 + Math.sin(animClock * 4) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // reflexo suave na água
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.translate(player.x, player.y + player.radius + 14);
  ctx.scale(1, -0.5);
  ctx.fillStyle = bodyColor;
  ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ==========================================================
// INIMIGOS
// ==========================================================
function drawEnemies() {
  for (const en of enemies) {
    ctx.save();
    ctx.translate(en.x, en.y);

    let scale = 1, alpha = 1;
    if (en.dying) {
      const t = clamp(en.deathTimer / 260, 0, 1);
      scale = t; alpha = t;
    }
    ctx.globalAlpha = alpha;
    ctx.scale(scale, scale);

    if (en.isBoss) { ctx.shadowColor = '#d90429'; ctx.shadowBlur = 22; }
    else { ctx.shadowColor = en.color; ctx.shadowBlur = 8; }

    const wob = Math.sin(animClock * 6 + en.x) * 0.05;
    const frozen = en.frozenUntil && en.frozenUntil > performance.now();

    if (en.isBoss) {
      drawSpikedBlob(en.radius, en.color, 10, wob);
      drawEyes(en.radius, 3, true);
    } else if (en.type === 'tank') {
      drawHexArmor(en.radius, en.color);
      drawEyes(en.radius * 0.5, 1, false);
    } else if (en.type === 'fast') {
      drawSpikedBlob(en.radius, en.color, 5, wob * 2);
      drawEyes(en.radius * 0.5, 1, false);
    } else if (en.type === 'ranged') {
      ctx.fillStyle = en.color;
      ctx.beginPath(); ctx.arc(0, 0, en.radius, 0, Math.PI * 2); ctx.fill();
      drawTrackingEye(en);
    } else if (en.type === 'thief') {
      ctx.fillStyle = en.color;
      ctx.beginPath();
      ctx.moveTo(0, -en.radius); ctx.lineTo(en.radius, en.radius * 0.6); ctx.lineTo(-en.radius, en.radius * 0.6);
      ctx.closePath(); ctx.fill();
      drawEyes(en.radius * 0.5, 1, false);
    } else {
      drawSpikedBlob(en.radius, en.color, 6, wob);
      drawEyes(en.radius * 0.55, 1, false);
    }

    if (frozen) {
      ctx.fillStyle = 'rgba(169, 222, 249, 0.55)';
      ctx.beginPath(); ctx.arc(0, 0, en.radius + 2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;

    if (!en.dying) {
      const barW = en.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(en.x - barW / 2, en.y - en.radius - 10, barW, 4);
      ctx.fillStyle = en.isBoss ? '#d90429' : '#ef476f';
      ctx.fillRect(en.x - barW / 2, en.y - en.radius - 10, barW * (en.hp / en.maxHp), 4);
    }
  }
}

function drawSpikedBlob(r, color, spikes, wob) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= spikes * 2; i++) {
    const ang = (Math.PI * i) / spikes;
    const rr = i % 2 === 0 ? r * (1 + wob) : r * 0.72;
    const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

function drawHexArmor(r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI * 2 * i) / 6 - Math.PI / 6;
    const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 3; ctx.stroke();
}

function drawEyes(r, count, angry) {
  ctx.fillStyle = '#fff';
  const positions = count === 1 ? [[0, -1]] : [[-r * 0.5, -r * 0.3], [0, -r * 0.6], [r * 0.5, -r * 0.3]];
  for (const [ex, ey] of positions) {
    ctx.beginPath(); ctx.arc(ex, ey, r * 0.32 + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a1c2b';
    ctx.beginPath(); ctx.arc(ex, ey + (angry ? 1 : 0), r * 0.15 + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
  }
  if (angry) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.6); ctx.lineTo(-r * 0.2, -r * 0.4);
    ctx.moveTo(r * 0.7, -r * 0.6); ctx.lineTo(r * 0.2, -r * 0.4);
    ctx.stroke();
  }
}

function drawTrackingEye(en) {
  const dx = player.x - en.x, dy = player.y - en.y;
  const len = Math.hypot(dx, dy) || 1;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, en.radius * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0a1c2b';
  ctx.beginPath(); ctx.arc((dx / len) * en.radius * 0.25, (dy / len) * en.radius * 0.25, en.radius * 0.28, 0, Math.PI * 2); ctx.fill();
}

// ==========================================================
// PROJÉTEIS, ZONAS, RAIOS E PARTÍCULAS
// ==========================================================
function drawProjectiles() {
  for (const p of projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.shadowColor = p.color; ctx.shadowBlur = 10;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.ellipse(0, 0, p.radius + 3, p.radius * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-p.radius - 3, 0);
    ctx.lineTo(-p.radius - 10, -p.radius * 0.5);
    ctx.lineTo(-p.radius - 10, p.radius * 0.5);
    ctx.closePath();
    ctx.globalAlpha = 0.5; ctx.fill();
    ctx.restore();
  }
}

function drawZones() {
  const now = performance.now();
  for (const z of zones) {
    const life = clamp((z.expiresAt - now) / 1000, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.28 + Math.sin(animClock * 6) * 0.05;
    ctx.fillStyle = z.color;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = z.color; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawLightning() {
  for (const b of lightningBolts) {
    ctx.save();
    ctx.globalAlpha = clamp(b.life / b.maxLife, 0, 1);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = b.color; ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < b.points.length - 1; i++) {
      const a = b.points[i], c = b.points[i + 1];
      const midx = (a.x + c.x) / 2 + rand(-8, 8);
      const midy = (a.y + c.y) / 2 + rand(-8, 8);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(midx, midy);
      ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawFloatingTexts() {
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px Segoe UI';
  for (const t of floatingTexts) {
    ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(10,28,43,0.8)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
    ctx.globalAlpha = 1;
  }
}

function drawVignette() {
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 32px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSADO', W / 2, H / 2);
  ctx.font = '14px Segoe UI';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('Pressione P ou clique no botão para continuar', W / 2, H / 2 + 30);
}

// ---------- Minimapa ----------
function drawMinimap() {
  mctx.clearRect(0, 0, MMW, MMH);
  mctx.fillStyle = 'rgba(20, 60, 90, 0.5)';
  mctx.fillRect(0, 0, MMW, MMH);
  const sx = MMW / W, sy = MMH / H;

  for (const f of fruits) {
    mctx.fillStyle = f.type.color;
    mctx.beginPath(); mctx.arc(f.x * sx, f.y * sy, 2, 0, Math.PI * 2); mctx.fill();
  }
  for (const it of items) {
    mctx.fillStyle = itemColor(it.type);
    mctx.beginPath(); mctx.arc(it.x * sx, it.y * sy, 2, 0, Math.PI * 2); mctx.fill();
  }
  for (const en of enemies) {
    if (en.dying) continue;
    mctx.fillStyle = en.isBoss ? '#d90429' : (en.type === 'thief' ? '#adb5bd' : '#ef476f');
    mctx.beginPath(); mctx.arc(en.x * sx, en.y * sy, en.isBoss ? 4 : 2, 0, Math.PI * 2); mctx.fill();
  }
  mctx.fillStyle = '#ffffff';
  mctx.beginPath(); mctx.arc(player.x * sx, player.y * sy, 3, 0, Math.PI * 2); mctx.fill();
}

// ==========================================================
// HUD
// ==========================================================
function updateHUD() {
  const now = performance.now();
  levelEl.textContent = player.level;
  hpBar.style.width = `${clamp((player.hp / player.maxHp) * 100, 0, 100)}%`;
  xpBar.style.width = `${clamp((player.xp / player.xpToNext) * 100, 0, 100)}%`;
  powerNameEl.textContent = player.fruitPower ? player.fruitPower.name : 'Nenhum';
  scoreEl.textContent = player.score;

  if (player.fruitPower) {
    const atkPct = clamp((now - player.lastAttack) / player.fruitPower.cooldown, 0, 1);
    const abPct = clamp((now - player.lastAbility) / player.fruitPower.abilityCooldown, 0, 1);
    cdAttack.style.height = `${atkPct * 100}%`;
    cdAbility.style.height = `${abPct * 100}%`;
  } else {
    cdAttack.style.height = '0%';
    cdAbility.style.height = '0%';
  }
  const dashPct = clamp((now - player.lastDash) / DASH_COOLDOWN, 0, 1);
  cdDash.style.height = `${dashPct * 100}%`;
}

// ==========================================================
// LOOP PRINCIPAL
// ==========================================================
function loop(time) {
  if (paused || manualPaused || !gameStarted) return;

  let dt = time - lastTime;
  lastTime = time;
  dt = clamp(dt, 0, 50);

  if (hitStop > 0) {
    hitStop -= dt;
  } else {
    const lowHp = player.hp / player.maxHp < 0.3;
    fruitSpawnTimer += dt;
    itemSpawnTimer += dt;
    enemySpawnTimer += dt;
    saveTimer += dt;

    const fruitInterval = lowHp ? 2400 : 4000;
    const enemyInterval = Math.max(1000, 2800 - player.level * 90) * (lowHp ? 1.4 : 1);

    if (fruitSpawnTimer > fruitInterval && fruits.length < 5) { fruitSpawnTimer = 0; spawnFruit(); }
    if (itemSpawnTimer > 9000 && items.length < 2) { itemSpawnTimer = 0; spawnItem(); }
    if (!bossActive && enemySpawnTimer > enemyInterval && enemies.length < 10) { enemySpawnTimer = 0; spawnEnemy(); }
    if (saveTimer > 5000) { saveTimer = 0; saveProgress(); }

    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles();
    updateZones();
    updateFruitsAndItems();
    checkGameOver();
  }

  updateParticles();
  updateLightning(dt);
  updateHUD();

  if (shakeTime > 0) shakeTime -= dt; else shakeMag = 0;
  const sx = shakeMag > 0 ? rand(-shakeMag, shakeMag) : 0;
  const sy = shakeMag > 0 ? rand(-shakeMag, shakeMag) : 0;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(sx, sy);
  drawBackground(dt);
  drawZones();
  drawFruits();
  drawItems();
  drawEnemies();
  drawLightning();
  drawProjectiles();
  drawParticles();
  drawFloatingTexts();
  drawPlayer();
  drawVignette();
  ctx.restore();

  drawMinimap();

  requestAnimationFrame(loop);
}

// ==========================================================
// MENU INICIAL / INÍCIO DO JOGO
// ==========================================================
for (const f of FRUITS) {
  const dot = document.createElement('span');
  dot.style.background = f.color;
  dot.style.color = f.color;
  dot.title = f.name;
  fruitPreview.appendChild(dot);
}

renderLeaderboard();
const existingSave = loadProgress();
if (existingSave && existingSave.score > 0) {
  continueBtn.classList.remove('hidden');
}

function startGame(fromSave) {
  ensureAudio();
  startMenu.classList.add('hidden');
  gameStarted = true;
  resetGame();
  if (fromSave && existingSave) {
    applySavedProgress(existingSave);
  } else {
    clearProgress();
  }
  spawnFruit();
  spawnFruit();
  scheduleMusic();
  if (!player.hasEatenBefore) {
    showMessage(
      'Bem-vindo à Ilha da Aventura!',
      'Explore a ilha, colete frutas para ganhar poderes bem diferentes entre si, cuidado com o inimigo ladrão (cinza) que rouba seu poder, e chefes aparecem a cada 5 níveis! WASD/Setas move, ESPAÇO ataca, E usa habilidade, SHIFT faz dash.'
    );
  }
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

playBtn.addEventListener('click', () => startGame(false));
continueBtn.addEventListener('click', () => startGame(true));
