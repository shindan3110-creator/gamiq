// GAMIQ（ゲーミック） v2 - Hand Drip Coffee
//
// HAND DRIP (AIM)
// - Seen from above: a dripper with coffee grounds.
// - Press and hold to pour hot water where your finger is.
//   Draw SLOW, SMALL circles near the center (like the letter "の").
// - Too fast -> "Slower!"   Not moving -> "Make circles!"
//   Too far out -> "Don't hit the filter!"
// - Stop pouring when the server reaches the target line.
//   Too much = it overflows.
// - Score: how well you poured + how close to the line you stopped.
// - Higher level: narrower "good speed", narrower target, faster pouring.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createCoffeeGames() {
  return [
    {
      id: "aim_hand_drip",
      type: "hand_drip",
      title: "HAND DRIP",
      rule: "HOLD TO POUR. DRAW SLOW, SMALL CIRCLES. STOP AT THE LINE!",
      skill: "AIM",
      theme: "cafe",
      duration: 28000
    }
  ];
}

export function runCoffeeGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "hand_drip") {
    return runHandDrip({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const TIME_MS = 26000;

function runHandDrip({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   good circle speed (dripper radii / s): 0.35-2.4 (Lv1) -> 0.55-1.5
   *   target zone: 72% ±8% (Lv1) -> ±4%
   *   time to fill 100%: 10s (Lv1) -> 7s
   */
  const vMin = Math.min(0.75, byLevel(level, 0.35, 0.55));
  const vMax = Math.max(1.2, byLevel(level, 2.4, 1.5));
  const tol = Math.max(0.025, byLevel(level, 0.08, 0.04));
  const target = 0.72;
  const fillSec = Math.max(5.5, byLevel(level, 10, 7));
  const innerR = 0.58;   // pour inside this (share of the dripper radius)
  const filterR = 0.8;   // hitting outside this = hitting the filter

  let finished = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let R = 10;

  let pouring = false;
  let pointer = null;
  let lastPointer = null;
  let speed = 0;           // smoothed, dripper radii per second
  let fill = 0;            // 0..1 (server)
  let pourMs = 0;
  let goodMs = 0;
  let stoppedAt = 0;
  let overflow = false;
  let state = "ok";        // ok | fast | still | out | filter
  let stateShown = "";
  let bloom = 0;
  const drops = [];        // where water has been poured (for the bloom look)

  let frameId = null;
  let lastTime = performance.now();
  const startedAt = performance.now();

  container.innerHTML = `
    <div class="be-game cf-game">
      <div class="be-hud">
        <div>
          <span>POUR</span>
          <strong data-cf-quality>—</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-cf-time>${TIME_MS / 1000}</strong>
        </div>
        <div>
          <span>SERVER</span>
          <strong data-cf-fill>0%</strong>
        </div>
      </div>

      <div class="cf-stage" data-cf-stage>
        <canvas class="cf-canvas" data-cf-canvas></canvas>
        <div class="cf-tip" data-cf-tip>${t("cf.hint")}</div>
        <div class="cf-server" data-cf-server>
          <div class="cf-target" data-cf-target></div>
          <div class="cf-liquid" data-cf-liquid></div>
          <span>SERVER</span>
        </div>
        <button type="button" class="cf-done" data-cf-done>${t("cf.done")}</button>
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-cf-stage]");
  const canvas = container.querySelector("[data-cf-canvas]");
  const g = canvas.getContext("2d");
  const tip = container.querySelector("[data-cf-tip]");
  const qualityEl = container.querySelector("[data-cf-quality]");
  const timeEl = container.querySelector("[data-cf-time]");
  const fillEl = container.querySelector("[data-cf-fill]");
  const targetEl = container.querySelector("[data-cf-target]");
  const liquid = container.querySelector("[data-cf-liquid]");
  const doneBtn = container.querySelector("[data-cf-done]");

  targetEl.style.bottom = `${(target - tol) * 100}%`;
  targetEl.style.height = `${tol * 2 * 100}%`;


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
    // leave room for the server gauge on the right
    cx = width * 0.44;
    cy = height * 0.5;
    R = Math.min(width * 0.36, height * 0.4);
  }

  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(stage);
  resize();


  /* ---------- INPUT ---------- */

  function pos(event) {
    const rect = stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, t: performance.now() };
  }

  function onDown(event) {
    if (finished) return;
    if (event.target === doneBtn) return;
    event.preventDefault();
    stage.setPointerCapture?.(event.pointerId);
    pouring = true;
    pointer = pos(event);
    lastPointer = pointer;
    speed = 0;
    stoppedAt = 0;
    tip.classList.add("hide");
    sfx("water");
  }

  function onMove(event) {
    if (finished || !pouring) return;
    event.preventDefault();
    pointer = pos(event);
  }

  function onUp() {
    if (!pouring) return;
    pouring = false;
    stoppedAt = performance.now();
  }

  function onKey(event) {
    if (event.code === "Enter") {
      event.preventDefault();
      finish();
    }
  }


  /* ---------- LOOP ---------- */

  function frame(now) {
    if (finished) return;

    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    const left = Math.max(0, TIME_MS - (now - startedAt));
    timeEl.textContent = Math.ceil(left / 1000);

    if (left <= 0) {
      finish();
      return;
    }

    if (pouring && pointer) {
      // speed of the circle, in dripper radii per second
      const d = Math.hypot(pointer.x - lastPointer.x, pointer.y - lastPointer.y) / R;
      const inst = dt > 0 ? d / dt : 0;
      speed += (inst - speed) * Math.min(1, dt * 6);
      lastPointer = { ...pointer };

      const dist = Math.hypot(pointer.x - cx, pointer.y - cy) / R;

      if (dist > filterR) state = "filter";
      else if (dist > innerR) state = "out";
      else if (speed > vMax) state = "fast";
      else if (speed < vMin) state = "still";
      else state = "ok";

      pourMs += dt * 1000;
      if (state === "ok") goodMs += dt * 1000;

      fill += dt / fillSec;
      bloom = Math.min(1, bloom + dt * 0.15);

      if (Math.random() < 0.7) {
        drops.push({ x: pointer.x, y: pointer.y, life: 1 });
        if (drops.length > 160) drops.shift();
      }

      if (fill >= 1) {
        fill = 1;
        overflow = true;
        sfx("bad");
        finish();
        return;
      }

      showState();
    } else {
      state = "ok";
      if (stateShown !== "") {
        tip.textContent = "";
        stateShown = "";
      }
      // Stopped near the line for a moment = done
      if (stoppedAt && fill >= target - tol && now - stoppedAt > 1500) {
        finish();
        return;
      }
    }

    fillEl.textContent = `${Math.round(fill * 100)}%`;
    liquid.style.height = `${fill * 100}%`;
    liquid.classList.toggle("ok", Math.abs(fill - target) <= tol);
    qualityEl.textContent = pourMs > 300 ? `${Math.round((goodMs / pourMs) * 100)}%` : "—";

    draw(now, dt);
    frameId = requestAnimationFrame(frame);
  }

  function showState() {
    if (state === stateShown) return;
    stateShown = state;

    const text = {
      ok: t("cf.good"),
      fast: t("cf.slower"),
      still: t("cf.circle"),
      out: t("cf.inner"),
      filter: t("cf.filter")
    }[state];

    tip.textContent = text;
    tip.className = `cf-tip show ${state}`;

    if (state === "fast" || state === "filter") sfx("tick");
  }


  /* ---------- DRAW ---------- */

  function draw(now, dt) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // wooden counter
    g.fillStyle = "#5a3a22";
    g.fillRect(0, 0, width, height);
    for (let y = 0; y < height; y += 22) {
      g.fillStyle = (y / 22) % 2 ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.03)";
      g.fillRect(0, y, width, 22);
    }

    // dripper rim
    g.fillStyle = "#f4f1ec";
    g.beginPath();
    g.arc(cx, cy, R * 1.12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#d8d2c8";
    g.beginPath();
    g.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
    g.fill();

    // paper filter
    g.fillStyle = "#efe2c6";
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(160,130,90,.35)";
    g.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * R * filterR, cy + Math.sin(a) * R * filterR);
      g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      g.stroke();
    }

    // coffee grounds (swell = bloom)
    const gr = R * (filterR + bloom * 0.03);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, gr);
    grad.addColorStop(0, bloom > 0.05 ? "#3a2114" : "#6b4428");
    grad.addColorStop(0.7, "#5a3620");
    grad.addColorStop(1, "#7a5232");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, gr, 0, Math.PI * 2);
    g.fill();

    // wet marks where you poured
    for (const d of drops) {
      d.life = Math.max(0, d.life - dt * 0.25);
      g.fillStyle = `rgba(30,15,8,${0.35 * d.life})`;
      g.beginPath();
      g.arc(d.x, d.y, R * 0.07, 0, Math.PI * 2);
      g.fill();
    }

    // good zone guide
    g.setLineDash([6, 6]);
    g.strokeStyle = "rgba(255,255,255,.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, R * innerR, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);

    // the water stream
    if (pouring && pointer) {
      const colors = {
        ok: "rgba(140,220,255,.85)",
        fast: "rgba(255,210,90,.9)",
        still: "rgba(255,210,90,.9)",
        out: "rgba(255,150,90,.9)",
        filter: "rgba(255,90,110,.95)"
      };
      g.fillStyle = colors[state];
      g.beginPath();
      g.arc(pointer.x, pointer.y, R * 0.06, 0, Math.PI * 2);
      g.fill();
      const ring = (now / 300) % 1;
      g.strokeStyle = colors[state];
      g.lineWidth = 2;
      g.globalAlpha = 1 - ring;
      g.beginPath();
      g.arc(pointer.x, pointer.y, R * (0.08 + ring * 0.12), 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frameId);
    pouring = false;

    const quality = pourMs > 0 ? goodMs / pourMs : 0;     // 0..1
    const off = Math.abs(fill - target);
    // amount: full points inside the zone, falls off outside it
    const amount = overflow ? 0 : off <= tol ? 1 - (off / tol) * 0.3 : Math.max(0, 0.7 - (off - tol) * 4);

    const score = clamp(quality * 60 + amount * 40, 0, 100);
    const success = !overflow && off <= tol && quality >= 0.5;

    tip.textContent = overflow ? t("cf.overflow") : success ? t("cf.perfect") : t("cf.finish");
    tip.className = `cf-tip show ${success ? "ok" : "filter"}`;
    sfx(success ? "clear" : "fail");

    setTimeout(() => {
      onComplete?.({
        score: Math.round(score),
        adapt: Math.round(clamp(30 + quality * 40 + amount * 30, 0, 100)),
        meta: {
          success,
          quality: Math.round(quality * 100),
          fill: Math.round(fill * 100),
          overflow,
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 700);
  }


  /* ---------- START ---------- */

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey);
  doneBtn.addEventListener("click", event => {
    event.preventDefault();
    if (!pouring && fill > 0.05) finish();
  });

  frameId = requestAnimationFrame(frame);

  // For automatic tests only (not used by the game)
  stage.__cf = { get cx() { return cx; }, get cy() { return cy; }, get R() { return R; }, get fill() { return fill; }, target, tol };

  return () => {
    finished = true;
    cancelAnimationFrame(frameId);
    observer?.disconnect();
    stage.removeEventListener("pointerdown", onDown);
    stage.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey);
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
