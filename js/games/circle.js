// GAMIQ（ゲーミック） v2 - Perfect Circle
//
// PERFECT CIRCLE
// - Draw a circle around the dot with one stroke.
// - You get a "roundness" percentage (like 91.4%).
// - 3 tries. The line turns red where it goes off.
// - Higher level: you need a rounder circle for a full score,
//   and the circle must be bigger.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createCircleGames() {
  return [
    {
      id: "aim_perfect_circle",
      type: "perfect_circle",
      title: "PERFECT CIRCLE",
      rule: "DRAW A PERFECT CIRCLE AROUND THE DOT IN ONE STROKE!",
      skill: "AIM",
      theme: "sketch",
      duration: 25000
    }
  ];
}

export function runCircleGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "perfect_circle") {
    return runPerfectCircle({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const TRIES = 3;
const TIME_LIMIT_MS = 30000;

function runPerfectCircle({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   roundness for a full score: 90% (Lv1) -> 96% (Lv10)
   *   smallest circle allowed: 22% -> 34% of the drawing area
   */
  const fullAt = byLevel(level, 90, 96);
  const minSizeRate = byLevel(level, 0.22, 0.34);

  let finished = false;
  let drawing = false;
  let locked = false;
  let tries = 0;
  let points = [];
  let angleSum = 0;
  let lastAngle = 0;
  let pointerId = null;
  let startedAt = performance.now();
  let clockTimer = null;
  let timers = [];

  const results = [];

  container.innerHTML = `
    <div class="pc-game">

      <div class="pc-hud">
        <div>
          <span>TRY</span>
          <strong data-pc-try>1 / ${TRIES}</strong>
        </div>
        <div>
          <span>BEST</span>
          <strong data-pc-best>--</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-pc-time>${TIME_LIMIT_MS / 1000}</strong>
        </div>
      </div>

      <div class="pc-stage" data-pc-stage>
        <canvas class="pc-canvas" data-pc-canvas></canvas>
        <i class="pc-dot"></i>
        <div class="pc-score" data-pc-score></div>
        <div class="pc-hint" data-pc-hint>${t("pc.hint")}</div>
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-pc-stage]");
  const canvas = container.querySelector("[data-pc-canvas]");
  const ctx = canvas.getContext("2d");
  const tryEl = container.querySelector("[data-pc-try]");
  const bestEl = container.querySelector("[data-pc-best]");
  const timeEl = container.querySelector("[data-pc-time]");
  const scoreEl = container.querySelector("[data-pc-score]");
  const hintEl = container.querySelector("[data-pc-hint]");

  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);

    timers.push(id);
  }


  /* ---------- CANVAS ---------- */

  function resize() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    width = rect.width;
    height = rect.height;
    cx = width / 2;
    cy = height / 2;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    redraw();
  }

  window.addEventListener("resize", resize);

  function meanRadius() {
    if (!points.length) return 0;
    return points.reduce((sum, p) => sum + p.r, 0) / points.length;
  }

  // Green when the line is round, red when it goes off
  function colorFor(r, mean) {
    if (!mean) return "#5fefff";

    const off = Math.min(1, Math.abs(r - mean) / mean / 0.18);
    const hue = 140 - off * 140;

    return `hsl(${hue} 95% 60%)`;
  }

  function redraw(ideal = null) {
    ctx.clearRect(0, 0, width, height);

    if (ideal) {
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, ideal, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (points.length < 2) return;

    const mean = meanRadius();

    drawSegments(1, mean);
    drawnUpTo = points.length;
  }

  // Draw the line from point "from" to the end.
  // A wide soft line + a thin bright line gives a glow
  // (canvas shadowBlur is very slow on phones, so it is not used).
  function drawSegments(from, mean) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = Math.max(1, from); i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const color = colorFor(b.r, points.length > 8 ? mean : 0);

      ctx.strokeStyle = color;

      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  // While drawing: only add the new part, once per frame
  let drawnUpTo = 0;
  let drawFrame = 0;

  function drawNew() {
    drawFrame = 0;
    if (points.length < 2) return;

    drawSegments(Math.max(1, drawnUpTo), meanRadius());
    drawnUpTo = points.length;
  }


  /* ---------- DRAWING ---------- */

  // The stage position is read once per stroke (reading it for
  // every point made phones slow)
  let stageRect = null;

  function local(event) {
    const rect = stageRect || stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function addPoint(event) {
    const { x, y } = local(event);
    const r = Math.hypot(x - cx, y - cy);
    const angle = Math.atan2(y - cy, x - cx);

    if (points.length) {
      let d = angle - lastAngle;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      angleSum += d;
    }

    lastAngle = angle;
    points.push({ x, y, r });
  }

  function onDown(event) {
    if (finished || locked || drawing) return;

    event.preventDefault();

    drawing = true;
    pointerId = event.pointerId;
    stage.setPointerCapture?.(event.pointerId);

    points = [];
    angleSum = 0;
    drawnUpTo = 0;
    stageRect = stage.getBoundingClientRect();

    scoreEl.className = "pc-score";
    scoreEl.textContent = "";
    hintEl.classList.add("hide");

    addPoint(event);
    redraw();
  }

  function onMove(event) {
    if (!drawing || event.pointerId !== pointerId) return;

    event.preventDefault();

    // Use all the in-between points (smoother on fast phones)
    const list = event.getCoalescedEvents?.() || [event];
    list.forEach(addPoint);

    if (!drawFrame) drawFrame = requestAnimationFrame(drawNew);

    // A full turn: finish this circle automatically
    if (Math.abs(angleSum) >= Math.PI * 2 * 1.04) {
      endStroke();
    }
  }

  function onUp(event) {
    if (!drawing || event.pointerId !== pointerId) return;

    event.preventDefault();
    endStroke();
  }

  stage.addEventListener("pointerdown", onDown);

  // iPhone Safari: make sure the page never scrolls while drawing
  const stopScroll = event => event.preventDefault();
  stage.addEventListener("touchmove", stopScroll, { passive: false });
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);


  /* ---------- JUDGE ---------- */

  function endStroke() {
    drawing = false;
    locked = true;
    stageRect = null;

    cancelAnimationFrame(drawFrame);
    drawFrame = 0;

    const mean = meanRadius();
    const minR = Math.min(width, height) * minSizeRate;
    const turn = Math.abs(angleSum) / (Math.PI * 2);

    let roundness = 0;
    let problem = "";

    if (points.length < 12 || turn < 0.9) {
      problem = t("pc.notClosed");
    } else if (mean < minR) {
      problem = t("pc.tooSmall");
    } else {
      const variance =
        points.reduce((sum, p) => sum + (p.r - mean) ** 2, 0) / points.length;
      const cv = Math.sqrt(variance) / mean;

      // Gap between the start and the end of the line
      const first = points[0];
      const last = points.at(-1);
      const gap = turn >= 1 ? 0 : Math.hypot(first.x - last.x, first.y - last.y) / mean;

      roundness = clamp(100 * (1 - cv * 3) - gap * 8, 0, 100);
    }

    const points100 = problem
      ? 0
      : Math.round(clamp((roundness - 55) / (fullAt - 55), 0, 1) * 100);

    results.push({ roundness, points: points100 });
    tries++;

    redraw(problem ? null : mean);

    // Show the result
    if (problem) {
      scoreEl.className = "pc-score bad";
      scoreEl.innerHTML = `<b>✕</b><span>${problem}</span>`;
      sfx("bad");
    } else {
      const rank = roundness >= fullAt ? "perfect" : roundness >= fullAt - 8 ? "great" : roundness >= 70 ? "good" : "bad";

      scoreEl.className = `pc-score ${rank}`;
      scoreEl.innerHTML = `<b>${roundness.toFixed(1)}<small>%</small></b><span>${t(`pc.${rank}`)}</span>`;

      sfx(rank === "perfect" ? "perfect" : rank === "bad" ? "bad" : "good");
    }

    const best = Math.max(...results.map(r => r.roundness));
    bestEl.textContent = best > 0 ? `${best.toFixed(1)}%` : "--";

    if (tries >= TRIES) {
      later(() => finish(), 1400);
    } else {
      later(() => {
        locked = false;
        points = [];
        redraw();

        tryEl.textContent = `${tries + 1} / ${TRIES}`;
        hintEl.textContent = t("pc.again");
        hintEl.classList.remove("hide");
      }, 1400);
    }
  }


  /* ---------- CLOCK ---------- */

  function updateClock() {
    const left = Math.max(0, TIME_LIMIT_MS - (performance.now() - startedAt));

    timeEl.textContent = String(Math.ceil(left / 1000));
    timeEl.classList.toggle("danger", left <= 8000);

    if (left <= 0 && !drawing) finish();
  }

  clockTimer = setInterval(updateClock, 200);


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;

    finished = true;
    drawing = false;

    clearInterval(clockTimer);
    timers.forEach(clearTimeout);

    // Tries not used count as 0
    const total = results.reduce((sum, r) => sum + r.points, 0);
    const score = Math.round(total / TRIES);

    const best = results.length ? Math.max(...results.map(r => r.roundness)) : 0;
    const firstTry = results[0]?.points ?? 0;
    const lastTry = results.at(-1)?.points ?? 0;

    setTimeout(() => {
      onComplete?.({
        score,

        adapt: Math.round(clamp(40 + score * 0.4 + (lastTry - firstTry) * 0.2, 0, 100)),

        meta: {
          success: score >= 60,
          tries: results.length,
          best: Math.round(best * 10) / 10
        }
      });
    }, 300);
  }


  /* ---------- START ---------- */

  requestAnimationFrame(() => {
    if (!finished) resize();
  });


  return () => {
    finished = true;
    drawing = false;

    clearInterval(clockTimer);
    timers.forEach(clearTimeout);
    window.removeEventListener("resize", resize);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
