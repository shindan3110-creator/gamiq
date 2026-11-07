// GAMIQ（ゲーミック） v2 - Fruit Slice
//
// FRUIT SLICE (AIM)
// - Fruits are thrown up from below. Swipe across them to slice them.
//   (PC: drag with the mouse)
// - Slice several in one swipe = COMBO bonus.
// - Do NOT slice the bombs.
// - Fruits that fall back down without being sliced are lost.
// - Higher level: faster, smaller fruits, more at once, more bombs.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createFruitGames() {
  return [
    {
      id: "aim_fruit_slice",
      type: "fruit_slice",
      title: "FRUIT SLICE",
      rule: "SWIPE TO SLICE THE FRUITS! DON'T TOUCH THE BOMBS!",
      skill: "AIM",
      theme: "dojo",
      duration: 27000
    }
  ];
}

export function runFruitGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "fruit_slice") {
    return runFruitSlice({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const TIME_MS = 25000;

const FRUITS = [
  { name: "watermelon", skin: "#2f9e44", stripe: "#1d6b2c", flesh: "#ff4d5e", seed: "#1a1a1a", size: 1.25 },
  { name: "orange", skin: "#ff9a1f", stripe: null, flesh: "#ffc56b", seed: null, size: 0.95 },
  { name: "apple", skin: "#e8303f", stripe: null, flesh: "#fff1c9", seed: "#5a3a1a", size: 0.9 },
  { name: "kiwi", skin: "#8a6a3d", stripe: null, flesh: "#7fd14a", seed: "#1a1a1a", size: 0.85 },
  { name: "lemon", skin: "#ffe14d", stripe: null, flesh: "#fff6a8", seed: null, size: 0.85 }
];

function runFruitSlice({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   throw speed (gravity): normal (Lv1) -> fast
   *   fruit size: big -> smaller
   *   fruits per throw: 1-2 (Lv1) -> 2-4
   *   bomb chance: 10% -> 28%
   */
  const speed = Math.min(1.9, byLevel(level, 1, 1.45));
  const sizeRate = Math.max(0.065, byLevel(level, 0.095, 0.075));
  const maxPerThrow = Math.min(5, Math.round(byLevel(level, 2, 4)));
  const bombRate = Math.min(0.35, byLevel(level, 0.1, 0.28));
  const throwGap = Math.max(520, byLevel(level, 1250, 800));

  let finished = false;
  let width = 0;
  let height = 0;
  let dpr = 1;

  let thrown = 0;      // fruits thrown (not bombs)
  let sliced = 0;
  let dropped = 0;
  let bombs = 0;
  let bestCombo = 0;
  let points = 0;

  const items = [];    // fruits and bombs in the air
  const halves = [];   // sliced halves
  const splats = [];   // juice drops
  let trail = [];      // blade trail points
  let swiping = false;
  let lastPoint = null;
  let swipeHits = 0;
  let swipeTimer = null;
  let flash = 0;

  let frameId = null;
  let throwTimer = null;
  let messageTimer = null;
  let lastTime = performance.now();
  const startedAt = performance.now();

  container.innerHTML = `
    <div class="be-game fs-game">
      <div class="be-hud">
        <div>
          <span>FRUITS</span>
          <strong data-fs-sliced>0</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-fs-time>${TIME_MS / 1000}</strong>
        </div>
        <div>
          <span>POINTS</span>
          <strong data-fs-points>0</strong>
        </div>
      </div>

      <div class="fs-stage" data-fs-stage>
        <canvas class="fs-canvas" data-fs-canvas></canvas>
        <div class="be-message fs-message" data-fs-message></div>
        <div class="fs-hint" data-fs-hint>${t("fs.hint")}</div>
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-fs-stage]");
  const canvas = container.querySelector("[data-fs-canvas]");
  const g = canvas.getContext("2d");
  const slicedEl = container.querySelector("[data-fs-sliced]");
  const timeEl = container.querySelector("[data-fs-time]");
  const pointsEl = container.querySelector("[data-fs-points]");
  const messageEl = container.querySelector("[data-fs-message]");
  const hintEl = container.querySelector("[data-fs-hint]");


  /* ---------- SIZE ---------- */

  function resize() {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(stage);
  resize();


  /* ---------- THROW ---------- */

  function gravity() {
    // tuned so a throw stays in the air ~2.2s at Lv1
    return height * 1.55 * speed * speed;
  }

  function throwOne(isBomb) {
    const base = Math.min(width, height * 1.1) * sizeRate;
    const fruit = isBomb ? null : FRUITS[Math.floor(Math.random() * FRUITS.length)];
    const r = isBomb ? base * 0.95 : base * fruit.size;

    const x = width * (0.15 + Math.random() * 0.7);
    // aim the peak inside the top part of the screen
    const peakY = height * (0.12 + Math.random() * 0.3);
    const rise = height + r - peakY;
    const vy = -Math.sqrt(2 * gravity() * rise);
    const vx = (width * 0.5 - x) * (0.25 + Math.random() * 0.35) * speed;

    items.push({
      bomb: isBomb,
      fruit,
      r,
      x,
      y: height + r,
      vx,
      vy,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 4,
      done: false
    });

    if (!isBomb) thrown++;
  }

  function throwWave() {
    if (finished) return;

    const elapsed = performance.now() - startedAt;
    if (elapsed > TIME_MS - 2200) return; // stop throwing near the end

    const count = 1 + Math.floor(Math.random() * maxPerThrow);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        if (!finished) throwOne(false);
      }, i * 120);
    }

    if (Math.random() < bombRate) {
      setTimeout(() => {
        if (!finished) throwOne(true);
      }, 60 + Math.random() * 200);
    }

    sfx("whoosh");
    throwTimer = setTimeout(throwWave, throwGap * (0.8 + Math.random() * 0.4));
  }


  /* ---------- SLICE ---------- */

  function point(event) {
    const rect = stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, t: performance.now() };
  }

  function segmentHitsCircle(a, b, cx, cy, r) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let k = ((cx - a.x) * dx + (cy - a.y) * dy) / len2;
    k = Math.max(0, Math.min(1, k));
    const px = a.x + dx * k;
    const py = a.y + dy * k;
    return Math.hypot(cx - px, cy - py) <= r;
  }

  function cut(a, b) {
    // must be a real swipe, not a tiny jitter
    if (Math.hypot(b.x - a.x, b.y - a.y) < 4) return;

    for (const it of items) {
      if (it.done) continue;
      if (!segmentHitsCircle(a, b, it.x, it.y, it.r * 1.1)) continue;

      it.done = true;

      if (it.bomb) {
        bombs++;
        points = Math.max(0, points - 30);
        flash = 1;
        sfx("explosion");
        showMessage(t("fs.bomb"), "bad");
        swipeHits = 0;
        updateHud();
        continue;
      }

      sliced++;
      swipeHits++;
      points += 10;
      sfx("swish");
      split(it, Math.atan2(b.y - a.y, b.x - a.x));
      updateHud();
    }
  }

  function split(it, angle) {
    const n = angle + Math.PI / 2;
    for (const side of [-1, 1]) {
      halves.push({
        fruit: it.fruit,
        r: it.r,
        x: it.x,
        y: it.y,
        vx: it.vx * 0.5 + Math.cos(n) * side * 90,
        vy: Math.min(it.vy, 0) * 0.3 + Math.sin(n) * side * 90 - 60,
        rot: angle,
        spin: side * 3,
        side,
        life: 1
      });
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 180;
      splats.push({
        x: it.x,
        y: it.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: it.r * (0.08 + Math.random() * 0.12),
        color: it.fruit.flesh,
        life: 1
      });
    }
  }

  function endSwipe() {
    if (swipeHits >= 3) {
      const bonus = (swipeHits - 2) * 10;
      points += bonus;
      showMessage(`${swipeHits} ${t("fs.combo")} +${bonus}`, "perfect");
      sfx("perfect");
    }
    bestCombo = Math.max(bestCombo, swipeHits);
    swipeHits = 0;
    updateHud();
  }

  function onDown(event) {
    if (finished) return;
    event.preventDefault();
    hintEl.classList.add("hide");
    stage.setPointerCapture?.(event.pointerId);
    swiping = true;
    lastPoint = point(event);
    trail = [lastPoint];
    swipeHits = 0;
  }

  function onMove(event) {
    if (finished || !swiping) return;
    event.preventDefault();
    const p = point(event);
    cut(lastPoint, p);
    lastPoint = p;
    trail.push(p);
    if (trail.length > 14) trail.shift();
  }

  function onUp() {
    if (!swiping) return;
    swiping = false;
    endSwipe();
  }


  /* ---------- DRAW ---------- */

  function frame(now) {
    if (finished) return;

    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    const left = Math.max(0, TIME_MS - (now - startedAt));
    timeEl.textContent = Math.ceil(left / 1000);

    if (left <= 0 && items.every(it => it.done)) {
      finish();
      return;
    }
    if (left <= 0 && now - startedAt > TIME_MS + 2500) {
      finish();
      return;
    }

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();

    const grav = gravity();

    for (const it of items) {
      if (it.done) continue;
      it.vy += grav * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.spin * dt;

      if (it.vy > 0 && it.y - it.r > height) {
        it.done = true;
        if (!it.bomb) {
          dropped++;
          updateHud();
        }
        continue;
      }

      if (it.bomb) drawBomb(it, now);
      else drawFruit(it);
    }

    for (let i = halves.length - 1; i >= 0; i--) {
      const h = halves[i];
      h.vy += grav * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.spin * dt;
      h.life -= dt * 0.8;
      if (h.y - h.r > height || h.life <= 0) {
        halves.splice(i, 1);
        continue;
      }
      drawHalf(h);
    }

    for (let i = splats.length - 1; i >= 0; i--) {
      const s = splats[i];
      s.vy += grav * 0.6 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt * 1.8;
      if (s.life <= 0) {
        splats.splice(i, 1);
        continue;
      }
      g.globalAlpha = Math.max(0, s.life);
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    drawTrail(now);

    if (flash > 0) {
      g.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
      g.fillRect(0, 0, width, height);
      flash = Math.max(0, flash - dt * 3);
    }

    frameId = requestAnimationFrame(frame);
  }

  function drawBackground() {
    // wooden dojo wall
    g.fillStyle = "#3b2414";
    g.fillRect(0, 0, width, height);
    const plank = Math.max(40, width / 6);
    for (let x = 0; x < width; x += plank) {
      g.fillStyle = (Math.floor(x / plank) % 2) ? "#45291a" : "#3f2617";
      g.fillRect(x, 0, plank - 2, height);
      g.fillStyle = "rgba(0,0,0,.25)";
      g.fillRect(x + plank - 2, 0, 2, height);
    }
    const shade = g.createRadialGradient(width / 2, height * 0.45, 10, width / 2, height * 0.45, Math.max(width, height) * 0.7);
    shade.addColorStop(0, "rgba(255,200,120,.12)");
    shade.addColorStop(1, "rgba(0,0,0,.45)");
    g.fillStyle = shade;
    g.fillRect(0, 0, width, height);
  }

  function drawFruit(it) {
    const f = it.fruit;
    g.save();
    g.translate(it.x, it.y);
    g.rotate(it.rot);

    g.fillStyle = f.skin;
    g.beginPath();
    if (f.name === "lemon") g.ellipse(0, 0, it.r * 1.1, it.r * 0.82, 0, 0, Math.PI * 2);
    else g.arc(0, 0, it.r, 0, Math.PI * 2);
    g.fill();

    if (f.stripe) {
      g.strokeStyle = f.stripe;
      g.lineWidth = it.r * 0.16;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.ellipse(i * it.r * 0.38, 0, it.r * 0.12, it.r * 0.95, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }

    if (f.name === "apple") {
      g.strokeStyle = "#5a3a1a";
      g.lineWidth = it.r * 0.12;
      g.beginPath();
      g.moveTo(0, -it.r * 0.8);
      g.lineTo(it.r * 0.1, -it.r * 1.2);
      g.stroke();
      g.fillStyle = "#3fae4a";
      g.beginPath();
      g.ellipse(it.r * 0.3, -it.r * 1.05, it.r * 0.25, it.r * 0.12, -0.5, 0, Math.PI * 2);
      g.fill();
    }

    // shine
    g.fillStyle = "rgba(255,255,255,.28)";
    g.beginPath();
    g.ellipse(-it.r * 0.35, -it.r * 0.35, it.r * 0.28, it.r * 0.18, -0.6, 0, Math.PI * 2);
    g.fill();

    g.restore();
  }

  function drawHalf(h) {
    const f = h.fruit;
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, h.life * 1.5));
    g.translate(h.x, h.y);
    g.rotate(h.rot);

    // skin half
    g.fillStyle = f.skin;
    g.beginPath();
    g.arc(0, 0, h.r, h.side > 0 ? 0 : Math.PI, h.side > 0 ? Math.PI : Math.PI * 2);
    g.closePath();
    g.fill();

    // flesh
    g.fillStyle = f.flesh;
    g.beginPath();
    g.arc(0, 0, h.r * 0.82, h.side > 0 ? 0 : Math.PI, h.side > 0 ? Math.PI : Math.PI * 2);
    g.closePath();
    g.fill();

    if (f.seed) {
      g.fillStyle = f.seed;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.arc(i * h.r * 0.25, h.side * h.r * 0.3, h.r * 0.06, 0, Math.PI * 2);
        g.fill();
      }
    }

    g.restore();
  }

  function drawBomb(it, now) {
    g.save();
    g.translate(it.x, it.y);

    g.fillStyle = "#1c1f26";
    g.beginPath();
    g.arc(0, 0, it.r, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "#ff3b52";
    g.lineWidth = it.r * 0.12;
    g.beginPath();
    g.arc(0, 0, it.r * 0.92, 0, Math.PI * 2);
    g.stroke();

    // fuse cap + fuse
    g.fillStyle = "#555b66";
    g.fillRect(-it.r * 0.22, -it.r * 1.15, it.r * 0.44, it.r * 0.3);
    g.strokeStyle = "#c9a26b";
    g.lineWidth = it.r * 0.1;
    g.beginPath();
    g.moveTo(0, -it.r * 1.15);
    g.quadraticCurveTo(it.r * 0.3, -it.r * 1.5, it.r * 0.2, -it.r * 1.7);
    g.stroke();

    // spark
    const s = 0.6 + 0.4 * Math.sin(now / 40);
    g.fillStyle = "#ffd76a";
    g.beginPath();
    g.arc(it.r * 0.2, -it.r * 1.72, it.r * 0.18 * s, 0, Math.PI * 2);
    g.fill();

    // X mark
    g.strokeStyle = "#ffffff";
    g.lineWidth = it.r * 0.14;
    g.beginPath();
    g.moveTo(-it.r * 0.35, -it.r * 0.35);
    g.lineTo(it.r * 0.35, it.r * 0.35);
    g.moveTo(it.r * 0.35, -it.r * 0.35);
    g.lineTo(-it.r * 0.35, it.r * 0.35);
    g.stroke();

    g.restore();
  }

  function drawTrail(now) {
    const pts = trail.filter(p => now - p.t < 160);
    if (!swiping) trail = pts;
    if (pts.length < 2) return;

    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const k = i / pts.length;
      g.strokeStyle = `rgba(255,255,255,${0.25 + k * 0.7})`;
      g.lineWidth = 2 + k * 7;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
  }


  /* ---------- HUD ---------- */

  function updateHud() {
    slicedEl.textContent = String(sliced);
    pointsEl.textContent = String(points);
  }

  function showMessage(text, type) {
    clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `be-message fs-message show ${type || ""}`;
    messageTimer = setTimeout(() => {
      messageEl.className = "be-message fs-message";
    }, 800);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;
    finished = true;

    cancelAnimationFrame(frameId);
    clearTimeout(throwTimer);

    const total = Math.max(1, thrown);
    const rate = sliced / total;
    const comboBonus = Math.min(10, Math.max(0, bestCombo - 2) * 3);

    const score = clamp(rate * 92 + comboBonus - bombs * 10, 0, 100);
    const success = rate >= 0.6 && bombs <= 1;

    showMessage(success ? "CLEAR!" : "FAILED", success ? "perfect" : "bad");
    sfx(success ? "clear" : "fail");

    setTimeout(() => {
      onComplete?.({
        score: Math.round(score),
        adapt: Math.round(clamp(30 + rate * 60 - bombs * 8 + comboBonus, 0, 100)),
        meta: {
          success,
          sliced,
          thrown,
          dropped,
          bombs,
          bestCombo,
          points,
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 600);
  }


  /* ---------- START ---------- */

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  updateHud();
  throwTimer = setTimeout(throwWave, 400);
  frameId = requestAnimationFrame(frame);

  // For automatic tests only (not used by the game)
  stage.__fs = { items };

  return () => {
    finished = true;
    cancelAnimationFrame(frameId);
    clearTimeout(throwTimer);
    clearTimeout(messageTimer);
    clearTimeout(swipeTimer);
    observer?.disconnect();
    stage.removeEventListener("pointerdown", onDown);
    stage.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
