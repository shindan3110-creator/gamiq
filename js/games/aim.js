// GAMIQ（ゲーミック） v2 - Aim Games

import { t } from "../i18n.js";
import { byLevel, byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";


export function createAimGames() {
  return [
    {
      // id stays "aim_bullseye" so old links (?start=bullseye) and play data keep working
      id: "aim_bullseye",
      type: "bullseye",
      title: "BUG SHOT",
      rule: "SHOOT THE BUGS EATING THE FIELD! DON'T HIT THE BIRDS!",
      skill: "AIM",
      theme: "field",
      duration: 30000
    }
  ];
}


export function runAimGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  switch (game.type) {
    case "bullseye":
      return runBugShot({
        container,
        onComplete,
        level: game.level
      });

    default:
      return () => {};
  }
}


/* ==========================================
BUG SHOT  (remake of BULLSEYE, Step 78)
- Pests fly over the field. Tap / click to shoot them
  (gunshot, muzzle flash, recoil).
    FLY      : small, flies in a jittery line
    WASP     : zigzags, worth 2x
    HOPPER   : jumps out of the grass in an arc
    GOLD bug : shiny, worth the most
- BIRDS fly through too: do NOT shoot them.
- Hits in a row build a COMBO (x2, x3).
- Later in the game, two bugs come at once.
- Score: how many bugs you hit + how few shots you wasted.
========================================== */

const BUG_COUNT = 14;

const BUG_POINTS = {
  fly: 10,
  wasp: 20,
  hopper: 10
};

function runBugShot({
  container,
  onComplete,
  level = 1
}) {
  /*
   * DIFFICULTY BY LEVEL
   *   crossing time: 2.6s (Lv1) -> 1.6s (old Lv10), faster in hell levels
   *   bug size:      big -> small
   *   two at once:   from bug 8 (Lv1) -> from bug 3
   *   birds:         15% -> 30%
   *   jitter:        calm -> wild
   */
  const flightMs = Math.max(1000, byLevel(level, 2600, 1600));
  const sizeRate = Math.max(0.06, byLevel(level, 0.1, 0.075));
  const doubleFrom = Math.max(1, byLevelInt(level, 8, 3));
  const birdRate = Math.min(0.36, byLevel(level, 0.15, 0.3));
  const jitter = Math.min(1.6, byLevel(level, 0.6, 1.2));
  const goldRate = 0.12;

  let active = true;

  let width = 0;
  let height = 0;
  let dpr = 1;

  let launched = 0;
  let hits = 0;
  let goldHits = 0;
  let birdHits = 0;
  let shots = 0;
  let combo = 0;
  let bestCombo = 0;
  let points = 0;

  const flyers = [];
  const puffs = [];
  const flashes = [];

  let aim = null;
  let kick = 0;

  let frameId = null;
  let launchTimer = null;
  let finishTimer = null;
  let messageTimer = null;

  const startedAt = performance.now();


  container.innerHTML = `
    <div class="be-game cs-game">

      <div class="be-hud">
        <div>
          <span>BUGS</span>
          <strong data-cs-count>0 / ${BUG_COUNT}</strong>
        </div>

        <div>
          <span>COMBO</span>
          <strong data-cs-combo>—</strong>
        </div>

        <div>
          <span>POINTS</span>
          <strong data-cs-points>0</strong>
        </div>
      </div>

      <div class="be-range cs-range" data-cs-range>
        <canvas class="cs-canvas" data-cs-canvas></canvas>
        <div class="be-message cs-message" data-cs-message></div>
      </div>

    </div>
  `;

  const range = container.querySelector("[data-cs-range]");
  const canvas = container.querySelector("[data-cs-canvas]");
  const g = canvas.getContext("2d");
  const countEl = container.querySelector("[data-cs-count]");
  const comboEl = container.querySelector("[data-cs-combo]");
  const pointsEl = container.querySelector("[data-cs-points]");
  const messageEl = container.querySelector("[data-cs-message]");


  /* ---------- SIZE ---------- */

  function resize() {
    const rect = range.getBoundingClientRect();

    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(resize)
      : null;

  observer?.observe(range);
  resize();


  /* ---------- SPAWN ---------- */

  function baseRadius() {
    return Math.max(15, Math.min(width, height * 1.2) * sizeRate);
  }

  function pickBug() {
    const roll = Math.random();
    if (roll < 0.4) return "fly";
    if (roll < 0.72) return "wasp";
    return "hopper";
  }

  function makeFlyer(kind, gold = false) {
    const fromLeft = Math.random() < 0.5;
    const r = baseRadius() * (kind === "bird" ? 1.35 : kind === "fly" ? 0.85 : 1);

    const f = {
      kind,
      gold,
      r,
      dir: fromLeft ? 1 : -1,
      born: performance.now(),
      x: 0,
      y: 0,
      phase: Math.random() * Math.PI * 2,
      done: false
    };

    if (kind === "hopper") {
      // Jumps out of the grass, lands in the grass on the other side
      f.x0 = width * (fromLeft ? 0.05 + Math.random() * 0.25 : 0.7 + Math.random() * 0.25);
      f.x1 = width * (fromLeft ? 0.6 + Math.random() * 0.35 : 0.05 + Math.random() * 0.35);
      f.y0 = height * 0.86;
      f.peak = height * (0.18 + Math.random() * 0.25);
      f.duration = flightMs * (0.85 + Math.random() * 0.2);
    } else {
      // Flies across the sky from one side to the other
      f.x0 = fromLeft ? -r * 2 : width + r * 2;
      f.x1 = fromLeft ? width + r * 2 : -r * 2;
      f.yBase = height * (0.15 + Math.random() * 0.5);
      f.yEnd = f.yBase + (Math.random() - 0.5) * height * 0.25;
      f.duration =
        flightMs *
        (kind === "bird" ? 1.5 : kind === "wasp" ? 1.1 : 1) *
        (0.9 + Math.random() * 0.2);
    }

    return f;
  }

  function position(f, now) {
    const p = Math.min(1, (now - f.born) / f.duration);
    const time = (now - f.born) / 1000;

    if (f.kind === "hopper") {
      f.x = f.x0 + (f.x1 - f.x0) * p;
      f.y = f.y0 - (f.y0 - f.peak) * 4 * p * (1 - p);
      return p;
    }

    f.x = f.x0 + (f.x1 - f.x0) * p;
    let y = f.yBase + (f.yEnd - f.yBase) * p;

    if (f.kind === "fly") {
      // Small fast jitter
      y += Math.sin(time * 18 + f.phase) * f.r * 0.5 * jitter;
      y += Math.sin(time * 7 + f.phase * 2) * f.r * 0.9 * jitter;
    } else if (f.kind === "wasp") {
      // Big zigzag
      y += Math.sin(time * 6 + f.phase) * height * 0.09 * jitter;
    } else {
      // Bird: calm glide
      y += Math.sin(time * 2 + f.phase) * f.r * 0.4;
    }

    f.y = y;
    return p;
  }

  function launchWave() {
    if (!active) return;

    if (launched >= BUG_COUNT) {
      if (flyers.every(f => f.done)) {
        finish();
      } else {
        launchTimer = setTimeout(launchWave, 200);
      }
      return;
    }

    const double =
      launched + 1 >= doubleFrom &&
      launched + 2 <= BUG_COUNT &&
      Math.random() < 0.6;

    const count = double ? 2 : 1;

    for (let i = 0; i < count; i++) {
      const f = makeFlyer(pickBug(), Math.random() < goldRate);

      if (i === 1) {
        f.born += 200 + Math.random() * 250;
      }

      flyers.push(f);
      launched++;
    }

    if (Math.random() < birdRate) {
      const bird = makeFlyer("bird");
      bird.born += Math.random() * 300;
      flyers.push(bird);
    }

    updateHud();

    const gap = flightMs * (double ? 0.85 : 0.6) + 250;
    launchTimer = setTimeout(launchWave, gap);
  }


  /* ---------- SHOOT ---------- */

  function pointerPos(event) {
    const rect = range.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function shoot(event) {
    if (!active) return;

    event.preventDefault();

    const { x, y } = pointerPos(event);
    const now = performance.now();

    shots++;
    kick = 1;
    flashes.push({ x, y, born: now });

    sfx("gunshot");

    range.classList.remove("cs-recoil");
    void range.offsetWidth;
    range.classList.add("cs-recoil");

    // Closest flyer under the shot (a little generous for fingers)
    let target = null;
    let best = Infinity;

    for (const f of flyers) {
      if (f.done || now < f.born) continue;

      const d = Math.hypot(f.x - x, f.y - y);

      if (d <= f.r * 1.5 && d < best) {
        best = d;
        target = f;
      }
    }

    if (!target) {
      combo = 0;
      updateHud();
      return;
    }

    target.done = true;
    puff(target);

    if (target.kind === "bird") {
      birdHits++;
      combo = 0;
      points = Math.max(0, points - 50);
      sfx("bad");
      showMessage(t("bug.bird"), "bad");
      updateHud();
      return;
    }

    hits++;
    combo++;
    bestCombo = Math.max(bestCombo, combo);

    const mult = comboMult();
    const base = target.gold ? 40 : BUG_POINTS[target.kind];
    points += base * mult;

    if (target.gold) {
      goldHits++;
      sfx("perfect");
      showMessage(`GOLD +${base * mult}`, "perfect");
    } else {
      sfx("pop");

      if (mult > 1) {
        showMessage(`COMBO x${mult}`, "great");
      }
    }

    updateHud();
  }

  function comboMult() {
    return Math.min(3, 1 + Math.floor((combo - 1) / 2));
  }

  function puff(f) {
    puffs.push({
      x: f.x,
      y: f.y,
      r: f.r,
      kind: f.kind,
      gold: f.gold,
      born: performance.now()
    });
  }

  function moveAim(event) {
    if (event.pointerType === "mouse") {
      aim = pointerPos(event);
    }
  }

  function leaveAim() {
    aim = null;
  }


  /* ---------- DRAW ---------- */

  function frame(now) {
    if (!active) return;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);

    drawField();

    for (const f of flyers) {
      if (f.done || now < f.born) continue;

      const p = position(f, now);

      if (p >= 1) {
        f.done = true;

        if (f.kind !== "bird") {
          combo = 0;
          updateHud();
        }
        continue;
      }

      if (f.gold) drawGlow(f, now);

      if (f.kind === "bird") drawBird(f, now);
      else if (f.kind === "fly") drawFly(f, now);
      else if (f.kind === "wasp") drawWasp(f, now);
      else drawHopper(f, now);
    }

    drawGrassFront();

    for (let i = puffs.length - 1; i >= 0; i--) {
      if (!drawPuff(puffs[i], now)) puffs.splice(i, 1);
    }

    for (let i = flashes.length - 1; i >= 0; i--) {
      if (!drawFlash(flashes[i], now)) flashes.splice(i, 1);
    }

    if (aim) drawCrosshair(aim.x, aim.y);

    kick *= 0.82;

    frameId = requestAnimationFrame(frame);
  }

  function drawField() {
    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#5fb8f0");
    sky.addColorStop(0.7, "#bfe6ff");
    sky.addColorStop(1, "#e9f7ff");
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);

    // sun
    g.fillStyle = "rgba(255,244,190,.9)";
    g.beginPath();
    g.arc(width * 0.82, height * 0.13, Math.min(width, height) * 0.07, 0, Math.PI * 2);
    g.fill();

    // clouds (drift slowly)
    const t = performance.now() / 1000;
    g.fillStyle = "rgba(255,255,255,.85)";
    [[0.18, 0.2, 1], [0.55, 0.12, 0.8], [0.8, 0.35, 0.9], [0.35, 0.45, 0.7]].forEach(([cx, cy, s], i) => {
      const x = ((cx * width + t * (8 + i * 3)) % (width + 160)) - 80;
      const y = cy * height;
      const r = Math.min(width, height) * 0.05 * s;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.arc(x + r * 1.1, y - r * 0.4, r * 1.2, 0, Math.PI * 2);
      g.arc(x + r * 2.3, y, r * 0.95, 0, Math.PI * 2);
      g.fill();
    });

    // far hills
    g.fillStyle = "#8fcf7a";
    g.beginPath();
    g.moveTo(0, height * 0.8);
    g.quadraticCurveTo(width * 0.3, height * 0.7, width * 0.6, height * 0.78);
    g.quadraticCurveTo(width * 0.85, height * 0.84, width, height * 0.76);
    g.lineTo(width, height);
    g.lineTo(0, height);
    g.closePath();
    g.fill();

    // field rows (cabbages)
    g.fillStyle = "#6fae4f";
    g.fillRect(0, height * 0.84, width, height * 0.16);

    const step = Math.max(26, width / 12);
    for (let row = 0; row < 2; row++) {
      const y = height * (0.87 + row * 0.07);
      for (let x = (row ? step / 2 : 0); x < width + step; x += step) {
        g.fillStyle = row ? "#7cc35a" : "#8bd16a";
        g.beginPath();
        g.arc(x, y, step * 0.28, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,255,255,.18)";
        g.beginPath();
        g.arc(x - step * 0.08, y - step * 0.08, step * 0.1, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function drawGrassFront() {
    g.fillStyle = "#4f8f3a";
    const n = Math.ceil(width / 10);
    g.beginPath();
    g.moveTo(0, height);
    for (let i = 0; i <= n; i++) {
      const x = i * 10;
      g.lineTo(x, height - 6 - ((i * 7) % 9));
      g.lineTo(x + 5, height);
    }
    g.closePath();
    g.fill();
  }

  function drawGlow(f, now) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 120);
    g.save();
    g.globalAlpha = 0.35 + pulse * 0.3;
    const grad = g.createRadialGradient(f.x, f.y, f.r * 0.4, f.x, f.y, f.r * 1.9);
    grad.addColorStop(0, "rgba(255,230,120,.9)");
    grad.addColorStop(1, "rgba(255,210,60,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(f.x, f.y, f.r * 1.9, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function wings(r, now, speed, color) {
    const a = Math.sin(now / speed) * 0.5 + 0.5;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(-r * 0.15, -r * 0.55, r * 0.55, r * (0.2 + a * 0.25), -0.5, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(r * 0.15, -r * 0.55, r * 0.5, r * (0.18 + a * 0.22), 0.5, 0, Math.PI * 2);
    g.fill();
  }

  function drawFly(f, now) {
    const r = f.r;
    g.save();
    g.translate(f.x, f.y);
    g.scale(f.dir, 1);

    wings(r, now, 18, "rgba(220,235,255,.7)");

    g.fillStyle = f.gold ? "#d9a800" : "#2b2f36";
    g.beginPath();
    g.ellipse(-r * 0.15, 0, r * 0.6, r * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(r * 0.45, -r * 0.02, r * 0.32, 0, Math.PI * 2);
    g.fill();

    // big red eyes
    g.fillStyle = "#e0303e";
    g.beginPath();
    g.arc(r * 0.58, -r * 0.14, r * 0.17, 0, Math.PI * 2);
    g.arc(r * 0.5, r * 0.12, r * 0.14, 0, Math.PI * 2);
    g.fill();

    g.restore();
  }

  function drawWasp(f, now) {
    const r = f.r;
    g.save();
    g.translate(f.x, f.y);
    g.scale(f.dir, 1);

    wings(r * 1.05, now, 22, "rgba(230,240,255,.75)");

    // abdomen with stripes
    g.save();
    g.beginPath();
    g.ellipse(-r * 0.35, r * 0.05, r * 0.62, r * 0.4, 0.15, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = f.gold ? "#ffd84a" : "#ffc21a";
    g.fillRect(-r * 1.1, -r * 0.6, r * 1.6, r * 1.3);
    g.fillStyle = "#1e1e22";
    for (let i = 0; i < 3; i++) {
      g.fillRect(-r * 0.75 + i * r * 0.32, -r * 0.6, r * 0.13, r * 1.3);
    }
    g.restore();

    // stinger
    g.fillStyle = "#1e1e22";
    g.beginPath();
    g.moveTo(-r * 0.95, r * 0.08);
    g.lineTo(-r * 1.25, r * 0.15);
    g.lineTo(-r * 0.92, r * 0.22);
    g.closePath();
    g.fill();

    // head
    g.fillStyle = "#ffc21a";
    g.beginPath();
    g.arc(r * 0.45, -r * 0.05, r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1e1e22";
    g.beginPath();
    g.arc(r * 0.55, -r * 0.12, r * 0.1, 0, Math.PI * 2);
    g.fill();

    // angry brow
    g.strokeStyle = "#1e1e22";
    g.lineWidth = Math.max(1.5, r * 0.07);
    g.beginPath();
    g.moveTo(r * 0.42, -r * 0.3);
    g.lineTo(r * 0.68, -r * 0.2);
    g.stroke();

    g.restore();
  }

  function drawHopper(f, now) {
    const r = f.r;
    g.save();
    g.translate(f.x, f.y);
    g.scale(f.dir, 1);
    g.rotate(-0.25);

    // back legs
    g.strokeStyle = f.gold ? "#b98a00" : "#3f7d2a";
    g.lineWidth = Math.max(2, r * 0.13);
    g.lineCap = "round";
    const kickLeg = Math.sin(now / 90) * 0.2;
    g.beginPath();
    g.moveTo(-r * 0.2, 0);
    g.lineTo(-r * 0.75, -r * (0.55 + kickLeg));
    g.lineTo(-r * 1.15, r * 0.25);
    g.stroke();

    // body
    g.fillStyle = f.gold ? "#ffd23a" : "#64c043";
    g.beginPath();
    g.ellipse(0, 0, r * 0.95, r * 0.36, 0, 0, Math.PI * 2);
    g.fill();

    // wing line
    g.strokeStyle = "rgba(0,0,0,.18)";
    g.lineWidth = Math.max(1, r * 0.06);
    g.beginPath();
    g.moveTo(-r * 0.6, -r * 0.1);
    g.lineTo(r * 0.3, -r * 0.18);
    g.stroke();

    // head + eye
    g.fillStyle = f.gold ? "#ffd23a" : "#64c043";
    g.beginPath();
    g.arc(r * 0.85, -r * 0.08, r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1e2a16";
    g.beginPath();
    g.arc(r * 0.95, -r * 0.14, r * 0.09, 0, Math.PI * 2);
    g.fill();

    // antenna
    g.strokeStyle = "#3f7d2a";
    g.lineWidth = Math.max(1, r * 0.05);
    g.beginPath();
    g.moveTo(r * 0.95, -r * 0.3);
    g.quadraticCurveTo(r * 1.3, -r * 0.8, r * 1.55, -r * 0.6);
    g.stroke();

    g.restore();
  }

  function drawBird(f, now) {
    const flap = Math.sin(now / 90) * 0.7;
    const r = f.r;

    g.save();
    g.translate(f.x, f.y);
    g.scale(f.dir, 1);

    // body (blue bird)
    g.fillStyle = "#3d8be0";
    g.beginPath();
    g.ellipse(0, 0, r * 0.75, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();

    // belly
    g.fillStyle = "#fff4e2";
    g.beginPath();
    g.ellipse(r * 0.1, r * 0.15, r * 0.5, r * 0.25, 0, 0, Math.PI * 2);
    g.fill();

    // wing
    g.fillStyle = "#2b6fbe";
    g.beginPath();
    g.moveTo(-r * 0.25, -r * 0.05);
    g.quadraticCurveTo(-r * 0.4, -r * (0.6 + flap), -r * 1.0, -r * (0.4 + flap));
    g.quadraticCurveTo(-r * 0.5, -r * 0.05, -r * 0.25, -r * 0.05);
    g.fill();

    // tail
    g.beginPath();
    g.moveTo(-r * 0.7, 0);
    g.lineTo(-r * 1.15, -r * 0.2);
    g.lineTo(-r * 1.1, r * 0.15);
    g.closePath();
    g.fill();

    // head
    g.fillStyle = "#3d8be0";
    g.beginPath();
    g.arc(r * 0.7, -r * 0.18, r * 0.3, 0, Math.PI * 2);
    g.fill();

    // beak + eye
    g.fillStyle = "#ffb43d";
    g.beginPath();
    g.moveTo(r * 0.95, -r * 0.2);
    g.lineTo(r * 1.25, -r * 0.12);
    g.lineTo(r * 0.95, -r * 0.04);
    g.closePath();
    g.fill();
    g.fillStyle = "#1a1f27";
    g.beginPath();
    g.arc(r * 0.78, -r * 0.24, r * 0.07, 0, Math.PI * 2);
    g.fill();

    g.restore();
  }

  function drawPuff(p, now) {
    const age = (now - p.born) / 420;
    if (age >= 1) return false;

    const r = p.r * (1 + age * 1.4);

    g.save();
    g.globalAlpha = 1 - age;

    // white smoke puff
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.arc(p.x + Math.cos(a) * r * 0.6, p.y + Math.sin(a) * r * 0.6, r * 0.45, 0, Math.PI * 2);
      g.fill();
    }

    // stars
    g.fillStyle = p.kind === "bird" ? "#ff5a73" : p.gold ? "#ffcc33" : "#ffe36b";
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      star(p.x + Math.cos(a) * r * 1.2, p.y + Math.sin(a) * r * 1.2, p.r * 0.28);
    }

    // "POW" text
    g.globalAlpha = Math.min(1, (1 - age) * 1.5);
    g.fillStyle = p.kind === "bird" ? "#ff3b52" : "#ff7a1a";
    g.font = `900 ${Math.round(p.r * 0.9)}px -apple-system, "Hiragino Sans", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(p.kind === "bird" ? "×" : "POW!", p.x, p.y - r * 0.2);

    g.restore();
    return true;
  }

  function star(x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }

  function drawFlash(fl, now) {
    const age = (now - fl.born) / 140;
    if (age >= 1) return false;

    const rr = 10 + age * 26;
    const grad = g.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, rr);
    grad.addColorStop(0, `rgba(255,255,230,${0.95 * (1 - age)})`);
    grad.addColorStop(0.4, `rgba(255,200,90,${0.7 * (1 - age)})`);
    grad.addColorStop(1, "rgba(255,150,40,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(fl.x, fl.y, rr, 0, Math.PI * 2);
    g.fill();
    return true;
  }

  function drawCrosshair(x, y) {
    const k = kick * 6;
    const s = 16 + k;

    g.save();
    g.translate(x, y - k);
    g.strokeStyle = "rgba(20,30,40,.85)";
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(0, 0, s * 0.7, 0, Math.PI * 2);
    g.moveTo(-s, 0); g.lineTo(-s * 0.35, 0);
    g.moveTo(s * 0.35, 0); g.lineTo(s, 0);
    g.moveTo(0, -s); g.lineTo(0, -s * 0.35);
    g.moveTo(0, s * 0.35); g.lineTo(0, s);
    g.stroke();
    g.fillStyle = "#ff3b52";
    g.beginPath();
    g.arc(0, 0, 2.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }


  /* ---------- HUD ---------- */

  function updateHud() {
    countEl.textContent = `${hits} / ${BUG_COUNT}`;
    comboEl.textContent = combo >= 3 ? `x${comboMult()} (${combo})` : combo === 2 ? "2" : "—";
    pointsEl.textContent = String(points);
  }

  function showMessage(text, type) {
    clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `be-message cs-message show ${type || ""}`;
    messageTimer = setTimeout(() => {
      messageEl.className = "be-message cs-message";
    }, 700);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (!active) return;

    active = false;

    clearTimeout(launchTimer);
    cancelAnimationFrame(frameId);

    const hitRate = hits / BUG_COUNT;
    const accuracy = shots ? Math.min(1, hits / shots) : 0;

    const score = clamp(
      hitRate * 82 +
      accuracy * 18 +
      goldHits * 2 -
      birdHits * 8,
      0,
      100
    );

    const success = hitRate >= 0.6 && birdHits <= 1;

    showMessage(success ? "CLEAR!" : "FAILED", success ? "perfect" : "bad");

    finishTimer = setTimeout(() => {
      onComplete?.({
        score: Math.round(score),

        adapt: Math.round(
          clamp(30 + hitRate * 50 + accuracy * 20 - birdHits * 6, 0, 100)
        ),

        meta: {
          success,
          hits,
          bugs: BUG_COUNT,
          shots,
          goldHits,
          birdHits,
          bestCombo,
          points,
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 600);
  }


  /* ---------- START ---------- */

  range.addEventListener("pointerdown", shoot);
  range.addEventListener("pointermove", moveAim);
  range.addEventListener("pointerleave", leaveAim);

  updateHud();

  launchTimer = setTimeout(launchWave, 500);
  frameId = requestAnimationFrame(frame);


  return () => {
    active = false;

    clearTimeout(launchTimer);
    clearTimeout(finishTimer);
    clearTimeout(messageTimer);
    cancelAnimationFrame(frameId);
    observer?.disconnect();

    range.removeEventListener("pointerdown", shoot);
    range.removeEventListener("pointermove", moveAim);
    range.removeEventListener("pointerleave", leaveAim);
  };
}


/* ==========================================
UTIL
========================================== */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
