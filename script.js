// ==========================================================
// Fruit Power - Ilha da Aventura (versão aprimorada)
// Jogo 2D original: colete frutas para ganhar poderes,
// lute contra inimigos variados e chefes, suba de nível.
// Inclui "juice" (screen shake, hit-stop, partículas),
// som sintetizado via Web Audio e controles touch.
// ==========================================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

const levelEl = document.getElementById('level');
const hpBar = document.getElementById('hp-bar');
const xpBar = document.getElementById('xp-bar');
const powerNameEl = document.getElementById('power-name');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const pauseBtn = document.getElementById('pause-btn');

const cdAttack = document.getElementById('cd-attack');
const cdAbility = document.getElementById('cd-ability');
const cdDash = document.getElementById('cd-dash');

const overlay = document.getElementById('message-overlay');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const messageBtn = document.getElementById('message-btn');

// ---------- Áudio sintetizado (sem arquivos externos) ----------
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
  }
}

function playTone(freq, duration, type = 'sine', gain = 0.15, slideTo = null) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + duration);
  }
  g.gain.setValueAtTime(gain, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(g).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
  attack: () => playTone(440, 0.1, 'triangle', 0.12, 220),
  hit: () => playTone(180, 0.08, 'square', 0.1, 90),
  eatFruit: () => playTone(523, 0.18, 'sine', 0.18, 1046),
  levelUp: () => {
    playTone(523, 0.12, 'sine', 0.15, 659);
    setTimeout(() => playTone(784, 0.2, 'sine', 0.15, 1046), 120);
  },
  damage: () => playTone(140, 0.15, 'sawtooth', 0.12, 60),
  dash: () => playTone(300, 0.1, 'sine', 0.1, 700),
  ability: () => playTone(200, 0.25, 'sawtooth', 0.15, 500),
  enemyDeath: () => playTone(300, 0.15, 'square', 0.1, 60),
  boss: () => {
    playTone(110, 0.3, 'sawtooth', 0.2, 80);
    setTimeout(() => playTone(90, 0.4, 'sawtooth', 0.2, 55), 250);
  },
  gameOver: () => playTone(220, 0.6, 'sawtooth', 0.18, 55),
};

// ---------- Definição de poderes de frutas ----------
const FRUITS = [
  {
    name: 'Fruta de Fogo', color: '#ff6b35', damage: 18, range: 90, cooldown: 600,
    projectile: '#ff9f1c', abilityName: 'Explosão Flamejante', abilityCooldown: 4000, abilityRadius: 110, abilityDamage: 35,
  },
  {
    name: 'Fruta do Gelo', color: '#4cc9f0', damage: 12, range: 70, cooldown: 450,
    projectile: '#a9def9', slow: true, abilityName: 'Nevasca', abilityCooldown: 5000, abilityRadius: 130, abilityDamage: 18, abilitySlow: true,
  },
  {
    name: 'Fruta do Trovão', color: '#f9c74f', damage: 26, range: 130, cooldown: 1000,
    projectile: '#ffe066', abilityName: 'Tempestade', abilityCooldown: 6000, abilityRadius: 150, abilityDamage: 45,
  },
  {
    name: 'Fruta das Trevas', color: '#7209b7', damage: 20, range: 100, cooldown: 700,
    projectile: '#b298dc', abilityName: 'Onda Sombria', abilityCooldown: 4500, abilityRadius: 120, abilityDamage: 30,
  },
  {
    name: 'Fruta da Borracha', color: '#ff477e', damage: 10, range: 60, cooldown: 300,
    projectile: '#ffafcc', abilityName: 'Impacto Elástico', abilityCooldown: 3000, abilityRadius: 90, abilityDamage: 22, knockback: true,
  },
];

// ---------- Estado do jogo ----------
const DASH_COOLDOWN = 2200;
const DASH_DURATION = 160;
const DASH_SPEED = 9;

const player = {
  x: W / 2,
  y: H / 2,
  radius: 16,
  speed: 3.2,
  hp: 100,
  maxHp: 100,
  level: 1,
  xp: 0,
  xpToNext: 50,
  score: 0,
  fruitPower: null,
  lastAttack: -9999,
  lastAbility: -9999,
  lastDash: -9999,
  invulnUntil: 0,
  facing: { x: 1, y: 0 },
  dashUntil: 0,
  dashDir: { x: 0, y: 0 },
  hasEatenBefore: false,
  squash: 1,
};

let fruits = [];
let enemies = [];
let projectiles = [];
let particles = [];
let floatingTexts = [];
let keys = {};
let paused = false;      // pausa por mensagem (level up / boas-vindas / game over)
let manualPaused = false; // pausa manual do jogador (tecla P)
let lastTime = 0;
let enemySpawnTimer = 0;
let fruitSpawnTimer = 0;
let bossActive = false;
let highScore = 0;

let shakeTime = 0;
let shakeMag = 0;
let hitStop = 0; // ms restantes de "freeze" do jogo

// ---------- Recorde local ----------
try {
  highScore = parseInt(localStorage.getItem('fruitPowerHighScore') || '0', 10) || 0;
} catch (e) {
  highScore = 0;
}
highScoreEl.textContent = highScore;

function saveHighScore() {
  if (player.score > highScore) {
    highScore = player.score;
    highScoreEl.textContent = highScore;
    try {
      localStorage.setItem('fruitPowerHighScore', String(highScore));
    } catch (e) {
      /* localStorage indisponível: ignora silenciosamente */
    }
  }
}

// ---------- Utilidades ----------
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function triggerShake(mag, time = 200) {
  shakeMag = Math.max(shakeMag, mag);
  shakeTime = Math.max(shakeTime, time);
}

function triggerHitStop(ms) {
  hitStop = Math.max(hitStop, ms);
}

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
  if (paused) return; // não pausa manualmente durante uma mensagem
  manualPaused = !manualPaused;
  pauseBtn.textContent = manualPaused ? '▶' : '⏸';
  if (!manualPaused) {
    lastTime = performance.now();
    requestAnimationFrame(loop);
  } else {
    drawPauseOverlay();
  }
}

// ---------- Entidades ----------
function spawnFruit() {
  const type = FRUITS[Math.floor(rand(0, FRUITS.length))];
  fruits.push({
    x: rand(40, W - 40),
    y: rand(40, H - 40),
    radius: 12,
    type,
    bob: Math.random() * Math.PI * 2,
  });
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
      x, y,
      radius: 34,
      speed: 1.3,
      hp: 220 + tier * 60,
      maxHp: 220 + tier * 60,
      damage: 16 + tier * 3,
      xpValue: 120 + tier * 20,
      color: '#d90429',
      type: 'boss',
      isBoss: true,
      lastShot: 0,
    });
    sfx.boss();
    showMessage('Um chefe apareceu!', 'Um inimigo poderoso surgiu na ilha. Cuidado com o dano extra e use sua habilidade (E) para se defender!');
    return;
  }

  const type = ENEMY_TYPES[Math.floor(rand(0, ENEMY_TYPES.length))];
  let base = {
    x, y,
    color: `hsl(${rand(0, 360)}, 60%, 55%)`,
    lastShot: 0,
    type,
  };

  if (type === 'fast') {
    Object.assign(base, {
      radius: 10 + tier,
      speed: 2.4 + tier * 0.2,
      hp: 16 + tier * 8,
      maxHp: 16 + tier * 8,
      damage: 4 + tier,
      xpValue: 12 + tier * 6,
    });
  } else if (type === 'tank') {
    Object.assign(base, {
      radius: 22 + tier * 2,
      speed: 0.7 + tier * 0.08,
      hp: 60 + tier * 30,
      maxHp: 60 + tier * 30,
      damage: 10 + tier * 3,
      xpValue: 25 + tier * 12,
    });
  } else if (type === 'ranged') {
    Object.assign(base, {
      radius: 13 + tier,
      speed: 1.0 + tier * 0.1,
      hp: 20 + tier * 10,
      maxHp: 20 + tier * 10,
      damage: 5 + tier,
      xpValue: 18 + tier * 8,
      keepDistance: 160,
    });
  } else {
    Object.assign(base, {
      radius: 14 + tier * 2,
      speed: 1.1 + tier * 0.15,
      hp: 30 + tier * 20,
      maxHp: 30 + tier * 20,
      damage: 6 + tier * 2,
      xpValue: 15 + tier * 10,
    });
  }

  enemies.push(base);
}

function spawnParticles(x, y, color, count = 8, opts = {}) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: rand(-2.5, 2.5) * (opts.speed || 1),
      vy: rand(-2.5, 2.5) * (opts.speed || 1),
      life: opts.life || 30,
      maxLife: opts.life || 30,
      color,
      size: opts.size || rand(2, 4),
    });
  }
}

function spawnFloatingText(x, y, text, color = '#ffd166') {
  floatingTexts.push({ x, y, text, color, life: 45, maxLife: 45 });
}

// ---------- Input teclado ----------
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (!keys[k]) {
    ensureAudio();
  }
  keys[k] = true;
  if (e.key === ' ') e.preventDefault();
  if (k === 'p') togglePause();
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ---------- Controles touch ----------
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
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
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
      joystickActive = false;
      joystickTouchId = null;
      joystickVec = { x: 0, y: 0 };
      joystickKnob.style.transform = 'translate(-50%, -50%)';
    }
  }
}
joystickZone.addEventListener('touchend', resetJoystick);
joystickZone.addEventListener('touchcancel', resetJoystick);

document.getElementById('btn-attack').addEventListener('touchstart', (e) => {
  ensureAudio();
  keys[' '] = true;
  e.preventDefault();
}, { passive: false });
document.getElementById('btn-attack').addEventListener('touchend', (e) => { keys[' '] = false; e.preventDefault(); }, { passive: false });

document.getElementById('btn-ability').addEventListener('touchstart', (e) => {
  ensureAudio();
  keys['e'] = true;
  e.preventDefault();
}, { passive: false });
document.getElementById('btn-ability').addEventListener('touchend', (e) => { keys['e'] = false; e.preventDefault(); }, { passive: false });

document.getElementById('btn-dash').addEventListener('touchstart', (e) => {
  ensureAudio();
  keys['shift'] = true;
  e.preventDefault();
}, { passive: false });
document.getElementById('btn-dash').addEventListener('touchend', (e) => { keys['shift'] = false; e.preventDefault(); }, { passive: false });

// ---------- Lógica de atualização ----------
function updatePlayer(dt) {
  const now = performance.now();
  const dashing = now < player.dashUntil;

  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  if (joystickActive) {
    dx = joystickVec.x;
    dy = joystickVec.y;
  }

  if (dashing) {
    player.x = clamp(player.x + player.dashDir.x * DASH_SPEED, player.radius, W - player.radius);
    player.y = clamp(player.y + player.dashDir.y * DASH_SPEED, player.radius, H - player.radius);
    if (Math.random() < 0.6) {
      spawnParticles(player.x, player.y, player.fruitPower ? player.fruitPower.color : '#f1f5f9', 2, { life: 18, size: 3 });
    }
  } else if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    player.x = clamp(player.x + dx * player.speed, player.radius, W - player.radius);
    player.y = clamp(player.y + dy * player.speed, player.radius, H - player.radius);
    player.facing = { x: dx, y: dy };
  }

  // Dash (Shift)
  if (keys['shift'] && now - player.lastDash > DASH_COOLDOWN && !dashing) {
    let ddx = player.facing.x, ddy = player.facing.y;
    const len = Math.hypot(ddx, ddy) || 1;
    player.dashDir = { x: ddx / len, y: ddy / len };
    player.dashUntil = now + DASH_DURATION;
    player.lastDash = now;
    player.invulnUntil = Math.max(player.invulnUntil, now + DASH_DURATION + 100);
    player.squash = 1.4;
    sfx.dash();
  }

  // Ataque (Espaço)
  if (keys[' '] && player.fruitPower && now - player.lastAttack > player.fruitPower.cooldown) {
    player.lastAttack = now;
    fireProjectile();
  }

  // Habilidade (E)
  if (keys['e'] && player.fruitPower && now - player.lastAbility > player.fruitPower.abilityCooldown) {
    player.lastAbility = now;
    useAbility();
  }

  // suaviza o "squash" de volta ao normal
  player.squash += (1 - player.squash) * 0.2;

  // Regeneração leve de HP com o tempo
  if (!dashing) {
    player.hp = clamp(player.hp + dt * 0.0025, 0, player.maxHp);
  }
}

function fireProjectile() {
  const power = player.fruitPower;
  sfx.attack();
  player.squash = 1.25;

  let target = null;
  let best = Infinity;
  for (const en of enemies) {
    const d = dist(player, en);
    if (d < best) { best = d; target = en; }
  }

  let vx, vy;
  if (target && best < power.range * 2.5) {
    vx = target.x - player.x;
    vy = target.y - player.y;
  } else {
    vx = player.facing.x || 1;
    vy = player.facing.y || 0;
  }
  const len = Math.hypot(vx, vy) || 1;
  vx /= len; vy /= len;

  projectiles.push({
    x: player.x,
    y: player.y,
    vx: vx * 7.5,
    vy: vy * 7.5,
    radius: 7,
    color: power.projectile,
    damage: power.damage,
    life: 60,
    slow: power.slow || false,
    fromPlayer: true,
  });

  spawnParticles(player.x, player.y, power.projectile, 4, { life: 14, size: 2 });
}

function useAbility() {
  const power = player.fruitPower;
  sfx.ability();
  triggerShake(6, 220);
  spawnParticles(player.x, player.y, power.projectile, 26, { life: 40, speed: 2.2, size: 4 });
  spawnFloatingText(player.x, player.y - 30, power.abilityName, power.color);

  for (const en of enemies) {
    if (dist(player, en) < power.abilityRadius) {
      en.hp -= power.abilityDamage;
      if (power.abilitySlow) en.slowUntil = performance.now() + 2000;
      if (power.knockback) {
        const dx = en.x - player.x, dy = en.y - player.y;
        const l = Math.hypot(dx, dy) || 1;
        en.x = clamp(en.x + (dx / l) * 40, en.radius, W - en.radius);
        en.y = clamp(en.y + (dy / l) * 40, en.radius, H - en.radius);
      }
      spawnFloatingText(en.x, en.y - 20, `-${power.abilityDamage}`, '#ffffff');
      if (en.hp <= 0) killEnemy(en);
    }
  }
}

function killEnemy(en) {
  player.xp += en.xpValue;
  player.score += en.xpValue * 2;
  spawnParticles(en.x, en.y, '#ffd166', 16, { life: 26, speed: 1.5 });
  sfx.enemyDeath();
  if (en.isBoss) {
    bossActive = false;
    player.score += 100;
    spawnFloatingText(en.x, en.y - 30, 'CHEFE DERROTADO! +100', '#ffd166');
    triggerShake(10, 350);
    // chefe sempre solta uma fruta
    fruits.push({ x: en.x, y: en.y, radius: 12, type: FRUITS[Math.floor(rand(0, FRUITS.length))], bob: 0 });
  }
  en.hp = 0;
  checkLevelUp();
}

function updateEnemies(dt) {
  const now = performance.now();
  for (const en of enemies) {
    const dx = player.x - en.x;
    const dy = player.y - en.y;
    const len = Math.hypot(dx, dy) || 1;
    const slowed = en.slowUntil && en.slowUntil > now;
    const spd = slowed ? en.speed * 0.4 : en.speed;

    if (en.type === 'ranged') {
      if (len < en.keepDistance - 20) {
        en.x -= (dx / len) * spd;
        en.y -= (dy / len) * spd;
      } else if (len > en.keepDistance + 20) {
        en.x += (dx / len) * spd;
        en.y += (dy / len) * spd;
      }
      if (now - en.lastShot > 1400 && len < 400) {
        en.lastShot = now;
        projectiles.push({
          x: en.x, y: en.y,
          vx: (dx / len) * 4, vy: (dy / len) * 4,
          radius: 6, color: '#ef476f', damage: en.damage, life: 90, fromPlayer: false,
        });
      }
    } else {
      en.x += (dx / len) * spd;
      en.y += (dy / len) * spd;
    }

    if (en.isBoss && now - en.lastShot > 2200) {
      en.lastShot = now;
      for (let a = 0; a < 6; a++) {
        const ang = (Math.PI * 2 * a) / 6;
        projectiles.push({
          x: en.x, y: en.y,
          vx: Math.cos(ang) * 3.4, vy: Math.sin(ang) * 3.4,
          radius: 6, color: '#d90429', damage: en.damage * 0.7, life: 100, fromPlayer: false,
        });
      }
    }

    if (len < en.radius + player.radius) {
      if (now > player.invulnUntil) {
        player.hp -= en.damage;
        player.invulnUntil = now + 500;
        spawnParticles(player.x, player.y, '#ef476f', 10);
        triggerShake(4, 150);
        sfx.damage();
      }
    }
  }

  enemies = enemies.filter((en) => en.hp > 0);
}

function updateProjectiles() {
  for (const p of projectiles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
  }

  for (const p of projectiles) {
    if (p.life <= 0) continue;
    if (p.fromPlayer) {
      for (const en of enemies) {
        if (dist(p, en) < p.radius + en.radius) {
          en.hp -= p.damage;
          p.life = 0;
          spawnParticles(en.x, en.y, p.color, 6);
          spawnFloatingText(en.x, en.y - 16, `-${p.damage}`, '#ffffff');
          if (p.slow) en.slowUntil = performance.now() + 1500;
          if (en.hp <= 0) {
            triggerHitStop(en.isBoss ? 80 : 30);
            killEnemy(en);
          } else if (en.isBoss) {
            triggerHitStop(20);
          }
        }
      }
    } else {
      if (dist(p, player) < p.radius + player.radius && performance.now() > player.invulnUntil) {
        player.hp -= p.damage;
        player.invulnUntil = performance.now() + 400;
        p.life = 0;
        spawnParticles(player.x, player.y, p.color, 8);
        triggerShake(3, 130);
        sfx.damage();
      }
    }
  }

  projectiles = projectiles.filter(
    (p) => p.life > 0 && p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20
  );
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
  }
  if (leveled) {
    sfx.levelUp();
    triggerShake(5, 180);
  }
}

function updateFruits() {
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
        showMessage(
          'Fruta consumida!',
          `Você comeu a ${f.type.name} e ganhou um ataque à distância (ESPAÇO) e a habilidade especial "${f.type.abilityName}" (tecla E).`
        );
      }
    }
  }
  fruits = fruits.filter((f) => !f.eaten);
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life--;
  }
  particles = particles.filter((p) => p.life > 0);

  for (const t of floatingTexts) {
    t.y -= 0.5;
    t.life--;
  }
  floatingTexts = floatingTexts.filter((t) => t.life > 0);
}

function checkGameOver() {
  if (player.hp <= 0) {
    sfx.gameOver();
    saveHighScore();
    const isRecord = player.score >= highScore && player.score > 0;
    showMessage(
      'Você foi derrotado!',
      `Pontuação final: ${player.score}.${isRecord ? ' Novo recorde!' : ` Recorde: ${highScore}.`} Pressione continuar para recomeçar a aventura.`
    );
    resetGame();
  }
}

function resetGame() {
  player.x = W / 2;
  player.y = H / 2;
  player.hp = player.maxHp = 100;
  player.level = 1;
  player.xp = 0;
  player.xpToNext = 50;
  player.score = 0;
  player.fruitPower = null;
  player.hasEatenBefore = false;
  player.lastAttack = -9999;
  player.lastAbility = -9999;
  player.lastDash = -9999;
  bossActive = false;
  enemies = [];
  fruits = [];
  projectiles = [];
  particles = [];
  floatingTexts = [];
}

// ---------- Cenário decorativo ----------
const clouds = Array.from({ length: 5 }, () => ({
  x: rand(0, W),
  y: rand(20, 110),
  scale: rand(0.6, 1.3),
  speed: rand(0.08, 0.22),
}));

const sparkles = Array.from({ length: 40 }, () => ({
  x: rand(0, W),
  y: rand(0, H),
  phase: rand(0, Math.PI * 2),
}));

const palms = [
  { x: W / 2 - 190, y: H / 2 + 40, scale: 1.1, sway: rand(0, 10) },
  { x: W / 2 - 120, y: H / 2 + 95, scale: 0.85, sway: rand(0, 10) },
  { x: W / 2 + 170, y: H / 2 + 30, scale: 1.2, sway: rand(0, 10) },
  { x: W / 2 + 230, y: H / 2 + 90, scale: 0.9, sway: rand(0, 10) },
  { x: W / 2 + 30, y: H / 2 + 120, scale: 1.0, sway: rand(0, 10) },
];

let animClock = 0;

// ---------- Desenho ----------
function drawBackground(dt) {
  animClock += dt * 0.001;

  // Céu / água em gradiente
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0e4d75');
  grad.addColorStop(0.35, '#1b6ca8');
  grad.addColorStop(1, '#124a6e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Sol com brilho pulsante
  const sunX = W - 90, sunY = 70;
  const pulse = 1 + Math.sin(animClock * 1.5) * 0.06;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70 * pulse);
  sunGrad.addColorStop(0, 'rgba(255, 244, 214, 0.9)');
  sunGrad.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 70 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff4d6';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
  ctx.fill();

  // Nuvens flutuantes
  for (const c of clouds) {
    c.x += c.speed;
    if (c.x > W + 80) c.x = -80;
    drawCloud(c.x, c.y, c.scale);
  }

  // Ondulações da água
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

  // Brilhos aleatórios na água
  for (const s of sparkles) {
    const a = (Math.sin(animClock * 2 + s.phase) + 1) / 2;
    ctx.globalAlpha = a * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ilha central (areia)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  const islandGrad = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 270);
  islandGrad.addColorStop(0, '#e9c46a');
  islandGrad.addColorStop(0.7, '#d9a441');
  islandGrad.addColorStop(1, 'rgba(217, 164, 65, 0)');
  ctx.fillStyle = islandGrad;
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, 260, 160, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(120, 190, 90, 0.35)';
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, 170, 100, 0, 0, Math.PI * 2);
  ctx.fill();

  // Palmeiras decorativas
  for (const p of palms) {
    drawPalm(p.x, p.y, p.scale, Math.sin(animClock * 1.2 + p.sway) * 0.08);
  }
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(18, -6, 18, 10, 0, 0, Math.PI * 2);
  ctx.ellipse(-18, -4, 16, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPalm(x, y, scale, sway) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // tronco curvado
  ctx.strokeStyle = '#7a4a2b';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 46);
  ctx.quadraticCurveTo(6 + sway * 40, 20, 4 + sway * 60, -6);
  ctx.stroke();

  const topX = 4 + sway * 60, topY = -6;
  ctx.translate(topX, topY);
  ctx.rotate(sway * 0.4);
  ctx.fillStyle = '#2d6a4f';
  for (let i = 0; i < 5; i++) {
    const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    ctx.save();
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(16, 0, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#8d5524';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- Ícones de frutas (por nome) ----------
function drawFruitIcon(x, y, r, fruit) {
  const name = fruit.name;
  ctx.save();
  ctx.translate(x, y);

  if (name === 'Fruta de Fogo') {
    const flick = Math.sin(animClock * 8) * 2;
    const grad = ctx.createRadialGradient(0, 2, 1, 0, 2, r + 4);
    grad.addColorStop(0, '#ffe066');
    grad.addColorStop(0.6, '#ff6b35');
    grad.addColorStop(1, '#c1121f');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -r - 4 - flick * 0.3);
    ctx.quadraticCurveTo(r + 2, -2, 0, r + 4);
    ctx.quadraticCurveTo(-r - 2, -2, 0, -r - 4 - flick * 0.3);
    ctx.fill();
  } else if (name === 'Fruta do Gelo') {
    ctx.fillStyle = '#a9def9';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const rr = i % 2 === 0 ? r + 3 : r - 3;
      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (name === 'Fruta do Trovão') {
    ctx.fillStyle = '#f9c74f';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5c00';
    ctx.beginPath();
    ctx.moveTo(-2, -r + 3);
    ctx.lineTo(4, -1);
    ctx.lineTo(-1, -1);
    ctx.lineTo(3, r - 3);
    ctx.lineTo(-5, 2);
    ctx.lineTo(0, 2);
    ctx.closePath();
    ctx.fill();
  } else if (name === 'Fruta das Trevas') {
    ctx.fillStyle = '#3c096c';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b298dc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0.3, Math.PI * 1.4);
    ctx.stroke();
  } else {
    // Fruta da Borracha
    ctx.fillStyle = '#ff477e';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd6e3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.stroke();
  }

  // folha
  ctx.fillStyle = '#2d6a4f';
  ctx.beginPath();
  ctx.ellipse(3, -r - 2, 5, 2.5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFruits() {
  for (const f of fruits) {
    const bobY = Math.sin(f.bob) * 4;
    ctx.save();
    ctx.shadowColor = f.type.color;
    ctx.shadowBlur = 12;
    drawFruitIcon(f.x, f.y + bobY, f.radius, f.type);
    ctx.restore();
  }
}

// ---------- Personagem ----------
function drawPlayer() {
  const now = performance.now();
  const blinking = now < player.invulnUntil && Math.floor(now / 80) % 2 === 0;
  const dashing = now < player.dashUntil;
  const moving = keys['w'] || keys['a'] || keys['s'] || keys['d'] ||
    keys['arrowup'] || keys['arrowleft'] || keys['arrowdown'] || keys['arrowright'] || joystickActive;
  player.walkPhase = (player.walkPhase || 0) + (moving ? 0.25 : 0);
  const bob = moving ? Math.sin(player.walkPhase) * 2 : Math.sin(animClock * 2) * 1;

  const facingLeft = player.facing.x < -0.1;
  const bodyColor = player.fruitPower ? player.fruitPower.color : '#f1f5f9';

  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.scale((facingLeft ? -1 : 1) * player.squash, 1 / (player.squash * 0.5 + 0.5));

  if (dashing) ctx.globalAlpha = 0.55;
  else if (blinking) ctx.globalAlpha = 0.4;

  // sombra
  ctx.save();
  ctx.globalAlpha *= 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, player.radius + 6 - bob * 0.3, player.radius * 0.9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // capa (cor do poder)
  if (player.fruitPower) {
    const swing = Math.sin(player.walkPhase * 0.5) * 4;
    ctx.fillStyle = player.fruitPower.color;
    ctx.globalAlpha *= 0.85;
    ctx.beginPath();
    ctx.moveTo(-player.radius * 0.6, -2);
    ctx.quadraticCurveTo(-player.radius * 1.6 - swing, player.radius * 1.2, -player.radius * 0.3, player.radius * 1.4);
    ctx.quadraticCurveTo(-player.radius * 0.9, player.radius * 0.4, -player.radius * 0.5, player.radius * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = dashing ? 0.55 : blinking ? 0.4 : 1;
  }

  // pernas (alternam ao andar)
  ctx.fillStyle = '#334155';
  const legOffset = moving ? Math.sin(player.walkPhase) * 4 : 0;
  ctx.beginPath();
  ctx.ellipse(-5, player.radius - 2 + legOffset, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5, player.radius - 2 - legOffset, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // corpo
  if (player.fruitPower) {
    ctx.shadowColor = player.fruitPower.color;
    ctx.shadowBlur = 16;
  }
  const bodyGrad = ctx.createRadialGradient(-4, -6, 2, 0, 0, player.radius + 2);
  bodyGrad.addColorStop(0, shadeColor(bodyColor, 35));
  bodyGrad.addColorStop(1, bodyColor);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#0a1c2b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // braço que ataca
  const atkPulse = clamp(1 - (now - player.lastAttack) / 150, 0, 1);
  if (atkPulse > 0) {
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(player.radius + atkPulse * 8, -2, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // rosto
  ctx.fillStyle = '#0a1c2b';
  ctx.beginPath();
  ctx.ellipse(6, -3, 2.4, blinking ? 0.5 : 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-3, -4, 2, blinking ? 0.5 : 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00ff) + percent;
  let b = (num & 0x0000ff) + percent;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

// ---------- Inimigos ----------
function drawEnemies() {
  for (const en of enemies) {
    ctx.save();
    ctx.translate(en.x, en.y);

    if (en.isBoss) {
      ctx.shadowColor = '#d90429';
      ctx.shadowBlur = 22;
    } else {
      ctx.shadowColor = en.color;
      ctx.shadowBlur = 8;
    }

    const wob = Math.sin(animClock * 6 + en.x) * 0.05;

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
      ctx.beginPath();
      ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
      ctx.fill();
      drawTrackingEye(en);
    } else {
      drawSpikedBlob(en.radius, en.color, 6, wob);
      drawEyes(en.radius * 0.55, 1, false);
    }

    ctx.restore();

    const barW = en.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(en.x - barW / 2, en.y - en.radius - 10, barW, 4);
    ctx.fillStyle = en.isBoss ? '#d90429' : '#ef476f';
    ctx.fillRect(en.x - barW / 2, en.y - en.radius - 10, barW * (en.hp / en.maxHp), 4);
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
  ctx.closePath();
  ctx.fill();
}

function drawHexArmor(r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI * 2 * i) / 6 - Math.PI / 6;
    const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawEyes(r, count, angry) {
  ctx.fillStyle = '#fff';
  const positions = count === 1 ? [[0, -1]] : [[-r * 0.5, -r * 0.3], [0, -r * 0.6], [r * 0.5, -r * 0.3]];
  for (const [ex, ey] of positions) {
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.32 + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a1c2b';
    ctx.beginPath();
    ctx.arc(ex, ey + (angry ? 1 : 0), r * 0.15 + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
  }
  if (angry) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.6);
    ctx.lineTo(-r * 0.2, -r * 0.4);
    ctx.moveTo(r * 0.7, -r * 0.6);
    ctx.lineTo(r * 0.2, -r * 0.4);
    ctx.stroke();
  }
}

function drawTrackingEye(en) {
  const dx = player.x - en.x, dy = player.y - en.y;
  const len = Math.hypot(dx, dy) || 1;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, en.radius * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a1c2b';
  ctx.beginPath();
  ctx.arc((dx / len) * en.radius * 0.25, (dy / len) * en.radius * 0.25, en.radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawProjectiles() {
  for (const p of projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.radius + 3, p.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-p.radius - 3, 0);
    ctx.lineTo(-p.radius - 10, -p.radius * 0.5);
    ctx.lineTo(-p.radius - 10, p.radius * 0.5);
    ctx.closePath();
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
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

// ---------- Loop principal ----------
function loop(time) {
  if (paused || manualPaused) return;

  let dt = time - lastTime;
  lastTime = time;
  dt = clamp(dt, 0, 50);

  if (hitStop > 0) {
    hitStop -= dt;
  } else {
    fruitSpawnTimer += dt;
    enemySpawnTimer += dt;

    if (fruitSpawnTimer > 4000 && fruits.length < 5) {
      fruitSpawnTimer = 0;
      spawnFruit();
    }
    if (!bossActive && enemySpawnTimer > Math.max(1000, 2800 - player.level * 90) && enemies.length < 10) {
      enemySpawnTimer = 0;
      spawnEnemy();
    }

    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles();
    updateFruits();
    checkGameOver();
  }

  updateParticles();
  updateHUD();

  if (shakeTime > 0) {
    shakeTime -= dt;
  } else {
    shakeMag = 0;
  }
  const sx = shakeMag > 0 ? rand(-shakeMag, shakeMag) : 0;
  const sy = shakeMag > 0 ? rand(-shakeMag, shakeMag) : 0;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(sx, sy);
  drawBackground(dt);
  drawFruits();
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawFloatingTexts();
  drawPlayer();
  drawVignette();
  ctx.restore();

  requestAnimationFrame(loop);
}

// ---------- Início ----------
spawnFruit();
spawnFruit();
showMessage(
  'Bem-vindo à Ilha da Aventura!',
  'Explore a ilha, colete frutas para ganhar poderes, derrote inimigos (há tipos rápidos, tanques e atiradores) e cuidado com os chefes a cada 5 níveis! WASD/Setas move, ESPAÇO ataca, E usa habilidade, SHIFT faz um dash.'
);
requestAnimationFrame(loop);
