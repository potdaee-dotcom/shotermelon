/* =========================================================
   말랑이 쇼타로 수박게임
   - Matter.js 물리엔진 기반 머지 게임
   - 모바일 터치 + PC 마우스 (드래그 후 놓기)
   - 도형으로 먼저 그리고, 나중에 이미지로 교체 가능하게 설계
   ========================================================= */

const { Engine, World, Bodies, Body, Events, Composite } = Matter;

/* ---------- 캐릭터 정의 (말랑이 성장기) ----------
   나중에 이미지로 바꾸려면 각 레벨에 image: '경로.png' 만 추가하면 됩니다.
   render() 가 image 가 있으면 이미지를, 없으면 도형을 그립니다. */
const LEVELS = [
  { name: "🫐 블루베리 쇼타로", r: 18,  color: "#5a6fd6", face: "tiny",  image: "assets/faces/out/1.png" },
  { name: "🍒 체리 쇼타로",   r: 24,  color: "#e23a4e", face: "tiny",  image: "assets/faces/out/2.png" },
  { name: "🍇 포도 쇼타로",   r: 32,  color: "#8e5bc4", face: "small", image: "assets/faces/out/3.png" },
  { name: "🍊 귤 쇼타로",     r: 40,  color: "#ff9f1c", face: "small", image: "assets/faces/out/4.png" },
  { name: "🥝 키위 쇼타로",   r: 50,  color: "#8bbf3f", face: "happy", image: "assets/faces/out/5.png" },
  { name: "🍓 딸기 쇼타로",   r: 62,  color: "#ff4d6d", face: "happy", image: "assets/faces/out/6.png" },
  { name: "🍑 복숭아 쇼타로", r: 74,  color: "#ff9eb5", face: "cool",  image: "assets/faces/out/7.png" },
  { name: "🍐 배 쇼타로",     r: 88,  color: "#cfe05a", face: "cool",  image: "assets/faces/out/8.png" },
  { name: "🍋 레몬 쇼타로",   r: 104, color: "#ffdd00", face: "love",  image: "assets/faces/out/9.png" },
  { name: "🍈 멜론 쇼타로",   r: 120, color: "#9ed16a", face: "love", image: "assets/faces/out/10.png" },
  { name: "🍉 수박 쇼타로",   r: 140, color: "#4caf50", face: "king", image: "assets/faces/out/11.png" },
];
// 이미지가 늦게 로딩돼도 "다음" 미리보기를 최신으로 다시 그림
function refreshNextPreview() {
  if (typeof drawNextPreview === "function" && Number.isInteger(nextLevel)) drawNextPreview();
}
// 얼굴 이미지 미리 로딩 (각 레벨의 imgEl 에 보관). 로딩 전엔 도형으로 표시됨.
for (const def of LEVELS) {
  if (def.image) { def.imgEl = new Image(); def.imgEl.onload = refreshNextPreview; def.imgEl.src = def.image; }
}
// 과일 프레임 미리 로딩 (assets/fruits/{단계}.png). 있는 단계만 fruitEl 세팅됨.
LEVELS.forEach((def, i) => {
  const fe = new Image();
  fe.onload = () => { def.fruitEl = fe; refreshNextPreview(); };
  fe.src = "assets/fruits/" + (i + 1) + ".png";
});
const MAX_LEVEL = LEVELS.length - 1;
const SCORE_TABLE = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
// 새로 떨어뜨릴 수 있는 캐릭터는 레벨 0~4 까지만 (수박게임 규칙)
const SPAWN_MAX_LEVEL = 4;

// 충돌(물리) 반지름 = 시각 반지름 × 이 배율. 1보다 작게 잡으면 과일들이
// 살짝 겹치며 바짝 쌓여서, 꼭지 때문에 벌어져 보이던 간격이 사라집니다.
const COLLIDE_SCALE = 0.9;

// 카드/OG 등 캔버스 텍스트에 쓰는 폰트 (Pretendard 우선)
const FONT_STACK = "Pretendard, 'Apple SD Gothic Neo', 'Helvetica Neue', sans-serif";
// 게임 시작 시 카드에 쓰는 굵기를 미리 로드해둠 (게임오버 때 폴백 안 나오게)
if (document.fonts && document.fonts.load) {
  document.fonts.load("800 40px Pretendard");
  document.fonts.load("700 16px Pretendard");
}

/* ---------- 효과음 ---------- */
const SOUND_FILES = {
  whatsthis1: "assets/sounds/whatsthis1.m4a", // 과일 떨어뜨릴 때(일괄)
  clap:      "assets/sounds/clap.m4a",
  wait:      "assets/sounds/wait.m4a",
  laugh:     "assets/sounds/laugh.m4a",
  hajima:    "assets/sounds/hajima.m4a",
  kkakka:    "assets/sounds/kkakka.m4a",
  topokki:   "assets/sounds/topokki.m4a",
  whatsthis: "assets/sounds/whatsthis.m4a",
};
const sounds = {};
for (const k in SOUND_FILES) { const a = new Audio(SOUND_FILES[k]); a.preload = "auto"; sounds[k] = a; }
// 합성 결과 레벨(index) -> 효과음. (사용자 지정 매핑)
// index n = "n+1단계" 로 합쳐질 때. clap=수박(11단계), wait=멜론(10단계).
const MERGE_SOUND = {
  1: "whatsthis",  // 2단계
  2: "kkakka",     // 3단계
  3: "hajima",     // 4단계
  4: "whatsthis1", // 5단계
  5: "laugh",      // 6단계
  6: "whatsthis",  // 7단계
  7: "hajima",     // 8단계
  8: "topokki",    // 9단계
  9: "wait",       // 10단계
  10: "clap",      // 11단계
};
let soundMuted = false;
let audioUnlocked = false;
let audioCtx = null;
function getCtx() {
  if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
  return audioCtx;
}
// 과일 떨어뜨릴 때 '뾱' 팝음 (Web Audio 로 즉석 합성 — 파일 불필요, 매번 살짝 달라 덜 반복적)
function playPop() {
  if (soundMuted) return;
  const ctx = getCtx(); if (!ctx) return;
  const t = ctx.currentTime;
  const f0 = 620 + Math.random() * 140;   // 시작 음정 살짝 랜덤
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(170, t + 0.09);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.32, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.18);
}
// 모바일: 첫 사용자 제스처에서 오디오 잠금 해제
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  const ctx = getCtx(); if (ctx && ctx.state === "suspended") ctx.resume();
  for (const k in sounds) {
    const a = sounds[k];
    a.muted = true;
    const p = a.play();
    if (p) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    else a.muted = false;
  }
}
// 합성 효과음은 겹치지 않게 큐로 하나씩 순차 재생
const mergeQueue = [];
let mergePlaying = false;
function enqueueMergeSound(name) {
  if (!name || !sounds[name]) return;
  mergeQueue.push(name);
  if (!mergePlaying) playNextMerge();
}
function playNextMerge() {
  if (mergeQueue.length === 0) { mergePlaying = false; return; }
  mergePlaying = true;
  const a = sounds[mergeQueue.shift()];
  if (soundMuted || !a) { setTimeout(playNextMerge, 0); return; }
  let advanced = false;
  const next = () => { if (advanced) return; advanced = true; a.onended = null; playNextMerge(); };
  a.onended = next;
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p) p.catch(() => setTimeout(next, 0));
    const ms = ((isFinite(a.duration) && a.duration > 0) ? a.duration : 3) * 1000 + 250;
    setTimeout(next, ms); // 안전장치: onended 안 와도 다음으로
  } catch (_) { setTimeout(next, 0); }
}
function setMuted(m) {
  soundMuted = m;
  if (m) {
    for (const k in sounds) { try { sounds[k].pause(); sounds[k].currentTime = 0; } catch (_) {} }
    mergeQueue.length = 0; mergePlaying = false;
  }
}
const muteBtn = document.getElementById("mute-btn");
if (muteBtn) {
  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    unlockAudio();
    setMuted(!soundMuted);
    muteBtn.textContent = soundMuted ? "🔇" : "🔊";
  });
}

/* ---------- 월드(고정 좌표계) ----------
   내부 해상도는 고정하고, 화면 크기에 맞춰 CSS 로 스케일합니다.
   덕분에 어떤 폰에서도 물리/난이도가 동일합니다. */
const WORLD_W = 480;
const WORLD_H = 720;
const WALL = 14;          // 벽 두께
const DROP_Y = 70;        // 캐릭터가 대기하는 높이
const DANGER_Y = 110;     // 이 선을 넘어 오래 머물면 게임오버

/* ---------- DOM ---------- */
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const cardCanvas = document.getElementById("card-canvas");

/* ---------- 상태 ---------- */
let engine, world;
let score = 0;
let best = Number(localStorage.getItem("mallang_best") || 0);
let maxLevelReached = 0;
let currentLevel = 0;     // 지금 들고 있는 캐릭터 레벨
let nextLevel = 0;        // 다음 캐릭터 레벨
let dropX = WORLD_W / 2;  // 떨어뜨릴 x 위치
let canDrop = true;
let gameOver = false;
let overTimers = new Map(); // body.id -> 위험선 위에 머문 시간(ms)

bestEl.textContent = best;

/* ---------- 캔버스 해상도(레티나 대응) ---------- */
function setupCanvas() {
  // stage-wrap 안에서 9:13.5 비율을 유지하며 최대 크기로
  const wrap = document.getElementById("stage-wrap");
  const availW = wrap.clientWidth;
  const availH = wrap.clientHeight;
  const ratio = WORLD_W / WORLD_H;
  let cssW = availW;
  let cssH = cssW / ratio;
  if (cssH > availH) { cssH = availH; cssW = cssH * ratio; }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.round(WORLD_W * dpr);
  canvas.height = Math.round(WORLD_H * dpr);
  // 모든 그리기는 WORLD 좌표계(480x720)로 하고, 여기서 실제 픽셀로 스케일
  ctx.setTransform(canvas.width / WORLD_W, 0, 0, canvas.height / WORLD_H, 0, 0);
}

/* ---------- 물리 세계 만들기 ---------- */
function buildWorld() {
  engine = Engine.create();
  engine.gravity.y = 1.1;
  world = engine.world;

  const opt = { isStatic: true, restitution: 0.2, friction: 0.6,
                render: { visible: false } };
  const floor = Bodies.rectangle(WORLD_W / 2, WORLD_H - WALL / 2, WORLD_W, WALL, opt);
  const left  = Bodies.rectangle(WALL / 2, WORLD_H / 2, WALL, WORLD_H, opt);
  const right = Bodies.rectangle(WORLD_W - WALL / 2, WORLD_H / 2, WALL, WORLD_H, opt);
  World.add(world, [floor, left, right]);

  Events.on(engine, "collisionStart", onCollision);
}

/* ---------- 캐릭터 바디 생성 ---------- */
function makeMallang(x, y, level) {
  const def = LEVELS[level];
  const body = Bodies.circle(x, y, def.r * COLLIDE_SCALE, {
    restitution: 0.15,
    friction: 0.45,
    frictionStatic: 0.6,
    density: 0.001,
    label: "mallang",
  });
  body.level = level;
  body.merging = false;
  return body;
}

/* ---------- 합치기(머지) ---------- */
function onCollision(e) {
  for (const pair of e.pairs) {
    const a = pair.bodyA, b = pair.bodyB;
    if (a.label !== "mallang" || b.label !== "mallang") continue;
    if (a.merging || b.merging) continue;
    if (a.level !== b.level) continue;
    if (a.level >= MAX_LEVEL) continue; // 최종 단계는 더 안 합쳐짐

    a.merging = true;
    b.merging = true;
    const nx = (a.position.x + b.position.x) / 2;
    const ny = (a.position.y + b.position.y) / 2;
    const newLevel = a.level + 1;

    World.remove(world, a);
    World.remove(world, b);
    overTimers.delete(a.id);
    overTimers.delete(b.id);

    const merged = makeMallang(nx, ny, newLevel);
    World.add(world, merged);
    // 살짝 튀어오르는 연출
    Body.setVelocity(merged, { x: 0, y: -2 });
    spawnPop(nx, ny, LEVELS[newLevel].color);

    addScore(SCORE_TABLE[newLevel] || newLevel);
    if (newLevel > maxLevelReached) maxLevelReached = newLevel;
    enqueueMergeSound(MERGE_SOUND[newLevel]); // 합성 효과음(큐로 순차)
  }
}

function addScore(pts) {
  score += pts;
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem("mallang_best", best);
  }
}

/* ---------- 합칠 때 반짝 효과 ---------- */
let pops = [];
function spawnPop(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI * 2 * i) / 8;
    pops.push({ x, y, vx: Math.cos(ang) * 3, vy: Math.sin(ang) * 3, life: 1, color });
  }
}
function updatePops(dt) {
  pops = pops.filter(p => p.life > 0);
  for (const p of pops) {
    p.x += p.vx; p.y += p.vy; p.life -= dt * 2.5;
  }
}

/* ---------- 다음 캐릭터 ---------- */
function rollLevel() { return Math.floor(Math.random() * (SPAWN_MAX_LEVEL + 1)); }
function setupNext() {
  currentLevel = nextLevel;
  nextLevel = rollLevel();
  drawNextPreview();
}

/* ---------- 떨어뜨리기 ---------- */
function dropCurrent() {
  if (!canDrop || gameOver) return;
  canDrop = false;
  const r = LEVELS[currentLevel].r;
  const x = clamp(dropX, WALL + r, WORLD_W - WALL - r);
  const body = makeMallang(x, DROP_Y, currentLevel);
  World.add(world, body);
  playPop();
  setupNext();
  setTimeout(() => { canDrop = true; }, 480); // 쿨다운
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* 색을 percent 만큼 밝게(+)/어둡게(-) */
function shade(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* ---------- 입력(드래그 후 놓기) ---------- */
function pointerToWorldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const rel = (clientX - rect.left) / rect.width;
  return clamp(rel * WORLD_W, WALL, WORLD_W - WALL);
}
let pointerActive = false;
function onDown(e) {
  unlockAudio();            // 첫 터치/클릭에서 모바일 오디오 잠금 해제
  if (gameOver) return;
  pointerActive = true;
  dropX = pointerToWorldX(getX(e));
}
function onMove(e) {
  if (!pointerActive) return;
  dropX = pointerToWorldX(getX(e));
}
function onUp(e) {
  if (!pointerActive) return;
  pointerActive = false;
  dropX = pointerToWorldX(getX(e));
  dropCurrent();
}
function getX(e) {
  // touchend 에는 e.touches 가 비어있으므로 changedTouches 를 우선 사용
  const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  return t ? t.clientX : e.clientX;
}

canvas.addEventListener("touchstart", e => { e.preventDefault(); onDown(e); }, { passive: false });
canvas.addEventListener("touchmove",  e => { e.preventDefault(); onMove(e); }, { passive: false });
canvas.addEventListener("touchend",   e => { e.preventDefault(); onUp(e); },  { passive: false });
canvas.addEventListener("mousedown", onDown);
window.addEventListener("mousemove", onMove);
window.addEventListener("mouseup", onUp);

/* ---------- 게임오버 판정 ---------- */
function checkGameOver(dt) {
  const bodies = Composite.allBodies(world);
  for (const b of bodies) {
    if (b.label !== "mallang" || b.merging) continue;
    const top = b.position.y - b.circleRadius;
    const slow = b.speed < 0.6;
    if (top < DANGER_Y && slow) {
      const t = (overTimers.get(b.id) || 0) + dt * 1000;
      overTimers.set(b.id, t);
      if (t > 1600) { triggerGameOver(); return; }
    } else {
      overTimers.delete(b.id);
    }
  }
}

function triggerGameOver() {
  if (gameOver) return;
  gameOver = true;
  drawResultCard();
  overlay.classList.remove("hidden");
  startConfetti();
}

/* ---------- 렌더링 ---------- */
function drawMallang(g, x, y, level, scale = 1) {
  const def = LEVELS[level];
  const r = def.r * scale;

  // 얼굴 이미지가 로딩됐으면: 과일 프레임이 있으면 구멍 크기로 얼굴 + 과일 모자,
  // 없으면 기존처럼 꽉 찬 얼굴 + 색 테두리.
  if (def.imgEl && def.imgEl.complete && def.imgEl.naturalWidth) {
    const hasFruit = def.fruitEl && def.fruitEl.complete && def.fruitEl.naturalWidth;
    const holeR = hasFruit ? r * 0.80 : r;  // 과일 프레임 구멍 비율과 일치
    g.save();
    g.beginPath(); g.arc(x, y, holeR, 0, Math.PI * 2); g.closePath(); g.clip();
    g.drawImage(def.imgEl, x - holeR, y - holeR, holeR * 2, holeR * 2);
    g.restore();
    if (hasFruit) {
      g.drawImage(def.fruitEl, x - r, y - r, r * 2, r * 2);
    } else {
      g.lineWidth = Math.max(2, r * 0.06);
      g.strokeStyle = shade(def.color, -10);
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    }
    return;
  }

  // 얼굴 이미지가 아직 로딩 전이면 아무것도 그리지 않음 (초기 폴백 이미지 숨김)
}

function render() {
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);

  // 위험선
  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = "rgba(255,77,109,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(WALL, DANGER_Y); ctx.lineTo(WORLD_W - WALL, DANGER_Y);
  ctx.stroke();
  ctx.restore();

  // 대기 중인 캐릭터 + 가이드 라인
  if (!gameOver) {
    const r = LEVELS[currentLevel].r;
    const x = clamp(dropX, WALL + r, WORLD_W - WALL - r);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = LEVELS[currentLevel].color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, DROP_Y + r); ctx.lineTo(x, WORLD_H - WALL); ctx.stroke();
    ctx.restore();
    drawMallang(ctx, x, DROP_Y, currentLevel);
  }

  // 모든 말랑이
  for (const b of Composite.allBodies(world)) {
    if (b.label !== "mallang") continue;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    drawMallang(ctx, 0, 0, b.level);
    ctx.restore();
  }

  // 반짝 효과
  for (const p of pops) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4 * p.life + 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawNextPreview() {
  const SIZE = 56;
  // 레티나 대응: 백킹 해상도를 dpr 배로 (기존 56x56 은 저해상도라 깨져 보였음)
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  if (nextCanvas.width !== Math.round(SIZE * dpr)) {
    nextCanvas.width = Math.round(SIZE * dpr);
    nextCanvas.height = Math.round(SIZE * dpr);
    nextCanvas.style.width = SIZE + "px";
    nextCanvas.style.height = SIZE + "px";
  }
  nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  nextCtx.clearRect(0, 0, SIZE, SIZE);
  const tmpR = 22;
  const saved = LEVELS[nextLevel].r;
  // drawMallang 은 def.r 을 쓰므로 scale 로 보정
  drawMallang(nextCtx, SIZE / 2, SIZE / 2, nextLevel, tmpR / saved);
}

/* ---------- 결과 카드(공유용, 고해상도) ---------- */
function drawResultCard() {
  const S = 3;                 // 고해상도 배율 (320x360 → 960x1080)
  const BW = 320, BH = 360;    // 기본 레이아웃 좌표계
  cardCanvas.width = BW * S;
  cardCanvas.height = BH * S;
  const g = cardCanvas.getContext("2d");
  g.setTransform(S, 0, 0, S, 0, 0);
  g.clearRect(0, 0, BW, BH);

  // 배경 (부드러운 핑크 그라데이션)
  const bg = g.createLinearGradient(0, 0, 0, BH);
  bg.addColorStop(0, "#fff4f9");
  bg.addColorStop(1, "#ffdaeb");
  g.fillStyle = bg;
  g.fillRect(0, 0, BW, BH);

  // 장식 도트
  const dots = [["#ffd24d",26,46,5],["#5bbf52",298,58,4],["#ff7eb3",36,306,6],
                ["#5a6fd6",292,312,5],["#ff4d6d",280,150,3],["#9ed16a",44,150,3]];
  for (const [c,x,y,r] of dots) { g.fillStyle = c; g.globalAlpha = 0.5; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); }
  g.globalAlpha = 1;

  g.textAlign = "center";

  // 타이틀
  g.fillStyle = "#ff5fa2";
  g.font = "800 17px " + FONT_STACK;
  g.fillText("🍉 말랑이 쇼타로 수박게임", BW / 2, 36);

  // 도달한 최대 캐릭터 (흰 원 배경 + 부드러운 그림자)
  const def = LEVELS[maxLevelReached];
  const cx = BW / 2, cy = 140, R = 74;
  g.save();
  g.shadowColor = "rgba(180,60,110,0.28)";
  g.shadowBlur = 18; g.shadowOffsetY = 7;
  g.fillStyle = "#ffffff";
  g.beginPath(); g.arc(cx, cy, R + 10, 0, 7); g.fill();
  g.restore();
  drawMallang(g, cx, cy, maxLevelReached, R / def.r);

  // 점수
  g.fillStyle = "#ff3d7f";
  g.font = "800 42px " + FONT_STACK;
  g.fillText(`${score}점`, BW / 2, 272);

  // 최고 도달 캐릭터명
  g.fillStyle = "#7a4a5c";
  g.font = "700 16px " + FONT_STACK;
  g.fillText(`최고 도달 · ${def.name}`, BW / 2, 302);
}

/* ---------- 컨페티 ---------- */
const confettiCanvas = document.getElementById("confetti-canvas");
const cfx = confettiCanvas.getContext("2d");
let confetti = [], confettiRAF = null;
function startConfetti() {
  const rect = overlay.getBoundingClientRect();
  confettiCanvas.width = rect.width;
  confettiCanvas.height = rect.height;
  const colors = ["#ff5fa2","#ffd24d","#5bbf52","#5a6fd6","#ff7eb3","#ff4d6d","#9ed16a","#ff9f1c"];
  confetti = [];
  for (let i = 0; i < 150; i++) {
    confetti.push({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * confettiCanvas.height * 0.6,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 2 + Math.random() * 3.5,
      w: 6 + Math.random() * 7, h: 8 + Math.random() * 9,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.32,
      color: colors[i % colors.length],
    });
  }
  if (!confettiRAF) confettiRAF = requestAnimationFrame(confettiLoop);
}
function confettiLoop() {
  cfx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  let alive = 0;
  for (const p of confetti) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.rot += p.vr;
    if (p.y < confettiCanvas.height + 30) alive++;
    cfx.save();
    cfx.translate(p.x, p.y); cfx.rotate(p.rot);
    cfx.fillStyle = p.color;
    cfx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    cfx.restore();
  }
  if (alive > 0) {
    confettiRAF = requestAnimationFrame(confettiLoop);
  } else {
    cfx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiRAF = null;
  }
}
function stopConfetti() {
  if (confettiRAF) { cancelAnimationFrame(confettiRAF); confettiRAF = null; }
  cfx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

/* ---------- 공유 (X에 이미지 자동 첨부) ---------- */
const shareMsg = document.getElementById("share-msg");
// 공유할 때마다 앞 문구를 랜덤으로 선택
const SHARE_INTROS = [
  "이것 뭐에요~?",
  "우리 팀에 쇼타로 있다!",
  "레모응 쿵쿵따!",
  "제예요~",
  "쟌~!",
];
const GAME_URL = "https://shotermelon.pages.dev";
function buildShareText() {
  const intro = SHARE_INTROS[Math.floor(Math.random() * SHARE_INTROS.length)];
  return `${intro} 말랑이 쇼타로 수박게임에서 ${score}점 달성!\n🍉 최고 도달: ${LEVELS[maxLevelReached].name}\n${GAME_URL}`;
}
function openXIntent(text) {
  window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(text), "_blank", "noopener");
}
// X로 바로 이동: 결과 이미지 첨부 없이 글만 채우고, 링크의 OG 미리보기가 대표 이미지가 됨
function shareToX() {
  openXIntent(buildShareText());
}
document.getElementById("btn-share").addEventListener("click", shareToX);
document.getElementById("btn-retry").addEventListener("click", restart);

/* ---------- 시작 / 재시작 ---------- */
function restart() {
  overlay.classList.add("hidden");
  stopConfetti();
  if (world) World.clear(world, false);
  if (engine) Engine.clear(engine);
  overTimers.clear();
  pops = [];
  score = 0; maxLevelReached = 0; gameOver = false; canDrop = true;
  scoreEl.textContent = "0";
  buildWorld();
  nextLevel = rollLevel();
  setupNext();
}

/* ---------- 메인 루프 ---------- */
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop); // 한 프레임이 예외로 죽어도 루프는 계속
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!gameOver) {
    Engine.update(engine, 1000 / 60);
    updatePops(dt);
    checkGameOver(dt);
  }
  render();
}

/* ---------- 부트 ---------- */
function boot() {
  setupCanvas();
  buildWorld();
  nextLevel = rollLevel();
  setupNext();
  requestAnimationFrame(loop);
}
window.addEventListener("resize", setupCanvas);
window.addEventListener("orientationchange", () => setTimeout(setupCanvas, 200));
boot();
