// GAMIQ（ゲーミック） v2 - Hoop Shot
//
// HOOP SHOT
// - Pull back (drag) and let go to shoot, like a small slingshot.
// - 10 balls. How many go in?
// - A clean shot that does not touch the rim (SWISH) gets a bonus.
// - Higher level: the hoop moves faster and wider,
//   and the aim guide gets shorter.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createBasketGames() {
  return [
    {
      id: "aim_hoop_shot",
      type: "hoop_shot",
      title: "HOOP SHOT",
      rule: "PULL BACK AND LET GO TO SHOOT. MAKE AS MANY AS YOU CAN!",
      skill: "AIM",
      theme: "court",
      duration: 30000
    }
  ];
}

export function runBasketGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "hoop_shot") {
    return runHoopShot({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const BALLS = 10;
const TIME_LIMIT_MS = 35000;

function runHoopShot({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   hoop movement: still (Lv1) -> 28% of the width (Lv10)
   *   aim guide: 0.2s of the flight (Lv1) -> 0.08s (Lv10)
   */
  const moveAmp = byLevel(level, 0, 0.28);
  const moveSpeed = byLevel(level, 0, 1.2);
  const guideSec = byLevel(level, 0.2, 0.08);

  let finished = false;
  let frame = 0;
  let lastFrame = 0;
  let startedAt = 0;
  let timers = [];

  let shotsTaken = 0;
  let makes = 0;
  let swishes = 0;
  let streak = 0;

  // Sizes (set in resize)
  let W = 0;
  let H = 0;
  let R = 10; // ball radius
  let G = 1000; // gravity px/s²
  let maxDrag = 100;
  let maxSpeed = 1000;

  // Ball
  const ball = { x: 0, y: 0, vx: 0, vy: 0, flying: false, touched: false, scored: false, wasAbove: false, spin: 0, angle: 0 };
  let flightTime = 0;

  // Hoop
  const hoop = { x: 0, baseX: 0, y: 0, rw: 30, phase: Math.random() * 6 };

  // Drag
  let dragging = false;
  let dragStart = null;
  let dragNow = null;
  let pointerId = null;

  container.innerHTML = `
    <div class="hs-game">

      <div class="hs-hud">
        <div>
          <span>BALLS</span>
          <strong data-hs-balls>${BALLS}</strong>
        </div>
        <div>
          <span>SCORE</span>
          <strong data-hs-makes>0</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-hs-time>${TIME_LIMIT_MS / 1000}</strong>
        </div>
      </div>

      <div class="hs-stage" data-hs-stage>
        <canvas class="hs-canvas" data-hs-canvas></canvas>
        <div class="hs-call" data-hs-call></div>
        <div class="hs-hint" data-hs-hint>${t("hs.hint")}</div>
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-hs-stage]");
  const canvas = container.querySelector("[data-hs-canvas]");
  const ctx = canvas.getContext("2d");
  const ballsEl = container.querySelector("[data-hs-balls]");
  const makesEl = container.querySelector("[data-hs-makes]");
  const timeEl = container.querySelector("[data-hs-time]");
  const callEl = container.querySelector("[data-hs-call]");
  const hintEl = container.querySelector("[data-hs-hint]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);

    timers.push(id);
  }

  function call(text, kind) {
    callEl.className = "hs-call";
    void callEl.offsetWidth;
    callEl.className = `hs-call show ${kind}`;
    callEl.textContent = text;
  }


  /* ---------- SIZES ---------- */

  function resize() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    W = rect.width;
    H = rect.height;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const unit = Math.min(W, H);

    R = unit * 0.055;
    G = H * 2.2;
    maxDrag = unit * 0.32;
    maxSpeed = H * 2.05;

    hoop.y = H * 0.3;
    hoop.rw = Math.max(R * 1.4, unit * 0.08);

    if (!ball.flying) resetBall();
  }

  window.addEventListener("resize", resize);

  // The ball looks smaller as it goes up toward the hoop (far away)
  function radiusNow() {
    const start = H * 0.84;
    const p = clamp((start - ball.y) / (start - hoop.y), 0, 1);
    return R * (1 - 0.3 * p);
  }

  function resetBall() {
    ball.x = W / 2;
    ball.y = H * 0.84;
    ball.vx = 0;
    ball.vy = 0;
    ball.flying = false;
    ball.touched = false;
    ball.scored = false;
    ball.wasAbove = false;
    ball.angle = 0;
  }

  function newHoopSpot() {
    // Each ball: the hoop stands in a new place
    hoop.baseX = W * (0.3 + Math.random() * 0.4);
  }


  /* ---------- SHOOTING ---------- */

  function launchVector() {
    const dx = dragStart.x - dragNow.x;
    const dy = dragStart.y - dragNow.y;
    const len = Math.hypot(dx, dy);
    const power = Math.min(1, len / maxDrag);

    if (len < 1) return { vx: 0, vy: 0, power: 0 };

    return {
      vx: (dx / len) * power * maxSpeed,
      vy: (dy / len) * power * maxSpeed,
      power
    };
  }

  function local(event) {
    const rect = stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onDown(event) {
    if (finished || ball.flying || dragging || !startedAt) return;
    if (shotsTaken >= BALLS) return;

    event.preventDefault();

    dragging = true;
    pointerId = event.pointerId;
    stage.setPointerCapture?.(event.pointerId);

    dragStart = local(event);
    dragNow = dragStart;

    hintEl.classList.add("hide");
  }

  function onMove(event) {
    if (!dragging || event.pointerId !== pointerId) return;

    event.preventDefault();
    dragNow = local(event);
  }

  function onUp(event) {
    if (!dragging || event.pointerId !== pointerId) return;

    event.preventDefault();
    dragging = false;

    const v = launchVector();

    // A tiny pull does nothing (no ball wasted)
    if (v.power < 0.12 || v.vy > -50) return;

    ball.vx = v.vx;
    ball.vy = v.vy;
    ball.flying = true;
    ball.spin = (v.vx / maxSpeed) * 10;
    flightTime = 0;

    shotsTaken++;
    ballsEl.textContent = String(BALLS - shotsTaken);

    sfx("whoosh");
  }

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);


  /* ---------- PHYSICS ---------- */

  function hitPoint(px, py) {
    // Bounce off one end of the rim
    const dx = ball.x - px;
    const dy = ball.y - py;
    const dist = Math.hypot(dx, dy);
    const min = radiusNow() + 3;

    if (dist >= min || dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;

    ball.x = px + nx * min;
    ball.y = py + ny * min;

    const dot = ball.vx * nx + ball.vy * ny;

    if (dot < 0) {
      ball.vx = (ball.vx - 2 * dot * nx) * 0.62;
      ball.vy = (ball.vy - 2 * dot * ny) * 0.62;

      if (!ball.touched) sfx("thud");
      ball.touched = true;
    }
  }

  function step(dt) {
    flightTime += dt;

    ball.vy += G * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.angle += ball.spin * dt;

    // Side walls
    const r = radiusNow();

    if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * 0.6; }
    if (ball.x > W - r) { ball.x = W - r; ball.vx = -Math.abs(ball.vx) * 0.6; }

    const left = hoop.x - hoop.rw;
    const right = hoop.x + hoop.rw;

    if (ball.y < hoop.y - R) ball.wasAbove = true;

    // The rim only counts on the way down.
    // (On the way up the ball is in front of the hoop, closer to you.)
    if (ball.vy > 0 && ball.wasAbove) {
      hitPoint(left, hoop.y);
      hitPoint(right, hoop.y);
    }

    // Went in: crossed the rim line going down, between the ends
    if (!ball.scored && ball.wasAbove && ball.vy > 0 && ball.y >= hoop.y && ball.y - ball.vy * dt < hoop.y && ball.x > left + r * 0.25 && ball.x < right - r * 0.25) {
      ball.scored = true;
      scored();
    }

    // The ball is gone (fell off the bottom, or took too long)
    if (ball.y > H + R * 2 || flightTime > 3.5) {
      endShot();
    }
  }

  function scored() {
    makes++;
    streak++;

    const swish = !ball.touched;
    if (swish) swishes++;

    makesEl.textContent = String(makes);

    if (swish) {
      call("SWISH!", "perfect");
      sfx("perfect");
    } else {
      call(streak >= 3 ? `${streak} IN A ROW!` : t("hs.in"), "good");
      sfx("good");
    }

    netShake = 1;
  }

  function endShot() {
    if (!ball.flying) return;

    ball.flying = false;

    if (!ball.scored) {
      streak = 0;
      call(t("hs.miss"), "bad");
      sfx("bad");
    }

    if (shotsTaken >= BALLS) {
      later(finish, 700);
      return;
    }

    later(() => {
      newHoopSpot();
      resetBall();
    }, 350);
  }


  /* ---------- DRAW ---------- */

  let netShake = 0;

  function drawCourt() {
    // Floor line + paint
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fillRect(0, H * 0.9, W, H * 0.1);
  }

  function drawBoard() {
    const bw = hoop.rw * 3;
    const bh = hoop.rw * 1.9;
    const bx = hoop.x - bw / 2;
    const by = hoop.y - bh * 0.9;

    ctx.fillStyle = "rgba(255,255,255,.9)";
    roundRect(bx, by, bw, bh, 6);
    ctx.fill();

    ctx.strokeStyle = "#e23c4a";
    ctx.lineWidth = 3;
    ctx.strokeRect(hoop.x - hoop.rw * 0.7, hoop.y - bh * 0.55, hoop.rw * 1.4, bh * 0.5);

    // Pole
    ctx.fillStyle = "#59606b";
    ctx.fillRect(hoop.x - 4, by - H, 8, H - 0);
  }

  function drawNet() {
    const left = hoop.x - hoop.rw;
    const right = hoop.x + hoop.rw;
    const depth = hoop.rw * 1.1;
    const shake = Math.sin(performance.now() / 40) * netShake * 5;

    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 1.6;

    for (let i = 0; i <= 6; i++) {
      const tx = left + ((right - left) * i) / 6;
      const bx = hoop.x + (tx - hoop.x) * 0.55 + shake;

      ctx.beginPath();
      ctx.moveTo(tx, hoop.y);
      ctx.lineTo(bx, hoop.y + depth);
      ctx.stroke();
    }

    for (let j = 1; j <= 3; j++) {
      const y = hoop.y + (depth * j) / 3;
      const k = 1 - 0.45 * (j / 3);

      ctx.beginPath();
      ctx.moveTo(hoop.x - hoop.rw * k + shake * (j / 3), y);
      ctx.lineTo(hoop.x + hoop.rw * k + shake * (j / 3), y);
      ctx.stroke();
    }
  }

  function drawRim() {
    ctx.strokeStyle = "#ff7a1a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(hoop.x - hoop.rw, hoop.y);
    ctx.lineTo(hoop.x + hoop.rw, hoop.y);
    ctx.stroke();
  }

  function drawBall() {
    const R = radiusNow();

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.angle);

    const grad = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.2, 0, 0, R);
    grad.addColorStop(0, "#ffb15c");
    grad.addColorStop(1, "#d9590f");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(40,15,0,.75)";
    ctx.lineWidth = Math.max(1.2, R * 0.08);

    ctx.beginPath();
    ctx.moveTo(-R, 0);
    ctx.lineTo(R, 0);
    ctx.moveTo(0, -R);
    ctx.lineTo(0, R);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-R * 1.15, 0, R * 0.8, -0.9, 0.9);
    ctx.arc(R * 1.15, 0, R * 0.8, Math.PI - 0.9, Math.PI + 0.9);
    ctx.stroke();

    ctx.restore();
  }

  function drawAim() {
    if (!dragging || !dragNow) return;

    const v = launchVector();
    if (v.power < 0.05) return;

    // Rubber band
    ctx.strokeStyle = "rgba(255,255,255,.45)";
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x - (dragStart.x - dragNow.x) * 0.6, ball.y - (dragStart.y - dragNow.y) * 0.6);
    ctx.stroke();
    ctx.setLineDash([]);

    // Short guide: only the start of the flight
    ctx.fillStyle = "rgba(255,215,106,.85)";

    const dots = 7;
    for (let i = 1; i <= dots; i++) {
      const tt = (guideSec * i) / dots;
      const x = ball.x + v.vx * tt;
      const y = ball.y + v.vy * tt + 0.5 * G * tt * tt;

      ctx.globalAlpha = 1 - i / (dots + 2);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, R * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Power bar
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(W * 0.3, H * 0.95, W * 0.4, 6);
    ctx.fillStyle = v.power > 0.9 ? "#ff6b6b" : "#ffd76a";
    ctx.fillRect(W * 0.3, H * 0.95, W * 0.4 * v.power, 6);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    drawCourt();
    drawBoard();

    // Ball going down inside the hoop: draw it behind the net
    const inside = ball.flying && ball.y > hoop.y - R && ball.x > hoop.x - hoop.rw && ball.x < hoop.x + hoop.rw && ball.vy > 0;

    if (inside) {
      drawBall();
      drawNet();
      drawRim();
    } else {
      drawNet();
      drawRim();
      if (shotsTaken < BALLS || ball.flying) drawBall();
    }

    drawAim();
  }


  /* ---------- LOOP ---------- */

  function loop(now) {
    if (finished) return;

    const dt = lastFrame ? Math.min(0.033, (now - lastFrame) / 1000) : 0;
    lastFrame = now;

    // Moving hoop
    hoop.phase += dt * moveSpeed;
    const wantX = hoop.baseX + Math.sin(hoop.phase) * W * moveAmp * 0.5;
    hoop.x = Math.max(hoop.rw * 1.6, Math.min(W - hoop.rw * 1.6, wantX));

    if (ball.flying) {
      // Small steps so the ball does not jump through the rim
      const steps = 3;
      for (let i = 0; i < steps && ball.flying; i++) step(dt / steps);
    }

    netShake = Math.max(0, netShake - dt * 2.5);

    draw();

    const left = Math.max(0, TIME_LIMIT_MS - (now - startedAt));
    timeEl.textContent = String(Math.ceil(left / 1000));
    timeEl.classList.toggle("danger", left <= 8000);

    if (left <= 0 && !ball.flying) {
      finish();
      return;
    }

    frame = requestAnimationFrame(loop);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;

    finished = true;
    dragging = false;

    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    window.removeEventListener("resize", resize);

    // 10 points a basket, +2 for a swish (max 100)
    const score = Math.min(100, makes * 10 + swishes * 2);

    setTimeout(() => {
      onComplete?.({
        score,

        adapt: Math.round(clamp(35 + (makes / BALLS) * 50 + Math.min(15, swishes * 3), 0, 100)),

        meta: {
          success: makes >= 6,
          makes,
          swishes,
          shots: shotsTaken
        }
      });
    }, 500);
  }


  /* ---------- START ---------- */

  requestAnimationFrame(() => {
    if (finished) return;

    resize();
    newHoopSpot();
    hoop.x = hoop.baseX;
    resetBall();

    startedAt = performance.now();
    frame = requestAnimationFrame(loop);
  });


  return () => {
    finished = true;
    dragging = false;

    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    window.removeEventListener("resize", resize);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
