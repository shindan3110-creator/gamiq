// GAMIQ（ゲーミック） v2 - Balance Stick
//
// BALANCE STICK (REFLEX)
// - A stick stands on your fingertip. Move left and right to keep it up.
//   (drag your finger / move the mouse, or ← → keys)
// - Gusts of wind push it. 20 seconds.
// - If it falls, it comes back after a moment (the lost time counts).
// - Score: how long the stick stayed up.
// - Higher level: shorter stick (falls faster), stronger and more gusts.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createBalanceGames() {
  return [
    {
      id: "reflex_balance",
      type: "balance",
      title: "BALANCE STICK",
      rule: "KEEP THE STICK STANDING! MOVE LEFT AND RIGHT TO BALANCE IT.",
      skill: "REFLEX",
      theme: "circus",
      duration: 22000
    }
  ];
}

export function runBalanceGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "balance") {
    return runBalance({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const TIME_MS = 20000;
const FALL_ANGLE = 1.2;        // ~70 degrees
const RESET_MS = 800;

function runBalance({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   "fall speed" (tau): 0.72s (Lv1) -> 0.46s (old Lv10)
   *   gusts: weak, every 3-5s -> strong, every 1.5-3s
   */
  const tau = Math.max(0.34, byLevel(level, 0.85, 0.5));
  const gustPower = Math.min(1.8, byLevel(level, 0.25, 1.1));
  const gustGapMin = Math.max(1000, byLevel(level, 3000, 1500));
  const gustGapMax = Math.max(1800, byLevel(level, 5000, 3000));

  let finished = false;
  let width = 0;
  let height = 0;
  let dpr = 1;

  // stick
  let theta = (Math.random() < 0.5 ? -1 : 1) * 0.04;
  let omega = 0;
  // base (fingertip)
  let baseX = 0;
  let baseV = 0;
  let targetX = 0;
  let keyDir = 0;

  let upMs = 0;
  let falls = 0;
  let fallenAt = 0;
  let gustAt = 0;
  let gustDir = 0;
  let nextGust = 0;
  let started = false;

  let frameId = null;
  let messageTimer = null;
  let lastTime = performance.now();
  const startedAt = performance.now();

  container.innerHTML = `
    <div class="be-game bl-game">
      <div class="be-hud">
        <div>
          <span>UP</span>
          <strong data-bl-up>0.0s</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-bl-time>${TIME_MS / 1000}</strong>
        </div>
        <div>
          <span>FALLS</span>
          <strong data-bl-falls>0</strong>
        </div>
      </div>

      <div class="bl-stage" data-bl-stage>
        <canvas class="bl-canvas" data-bl-canvas></canvas>
        <div class="be-message bl-message" data-bl-message></div>
        <div class="bl-hint" data-bl-hint>${t("bl.hint")}</div>
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-bl-stage]");
  const canvas = container.querySelector("[data-bl-canvas]");
  const g = canvas.getContext("2d");
  const upEl = container.querySelector("[data-bl-up]");
  const timeEl = container.querySelector("[data-bl-time]");
  const fallsEl = container.querySelector("[data-bl-falls]");
  const messageEl = container.querySelector("[data-bl-message]");
  const hintEl = container.querySelector("[data-bl-hint]");


  /* ---------- SIZE ---------- */

  function resize() {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const first = !width;
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (first) {
      baseX = width / 2;
      targetX = width / 2;
    }
  }

  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(stage);
  resize();

  function stickLen() { return Math.min(height * 0.55, width * 0.9); }
  function baseY() { return height * 0.86; }


  /* ---------- INPUT ---------- */

  function setTarget(event) {
    const rect = stage.getBoundingClientRect();
    targetX = Math.max(20, Math.min(width - 20, event.clientX - rect.left));
  }

  function begin() {
    if (!started) {
      started = true;
      hintEl.classList.add("hide");
      nextGust = performance.now() + gustGapMin;
    }
  }

  function onDown(event) {
    if (finished) return;
    event.preventDefault();
    stage.setPointerCapture?.(event.pointerId);
    begin();
    setTarget(event);
  }

  function onMove(event) {
    if (finished) return;
    if (event.pointerType === "mouse" || event.buttons || event.pressure > 0) {
      begin();
      setTarget(event);
    }
  }

  function onKeyDown(event) {
    if (event.code === "ArrowLeft" || event.code === "KeyA") { keyDir = -1; begin(); event.preventDefault(); }
    else if (event.code === "ArrowRight" || event.code === "KeyD") { keyDir = 1; begin(); event.preventDefault(); }
  }

  function onKeyUp(event) {
    if ((event.code === "ArrowLeft" || event.code === "KeyA") && keyDir < 0) keyDir = 0;
    if ((event.code === "ArrowRight" || event.code === "KeyD") && keyDir > 0) keyDir = 0;
  }


  /* ---------- LOOP ---------- */

  function frame(now) {
    if (finished) return;

    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;

    const left = Math.max(0, TIME_MS - (now - startedAt));
    timeEl.textContent = Math.ceil(left / 1000);

    if (left <= 0) {
      finish();
      return;
    }

    const L = stickLen();
    const grav = L / (tau * tau);

    if (keyDir) {
      targetX = Math.max(20, Math.min(width - 20, targetX + keyDir * width * 1.1 * dt));
    }

    // Fingertip follows the target quickly (a stiff spring)
    const k = 900;
    const c = 2 * Math.sqrt(k);
    const baseA = k * (targetX - baseX) - c * baseV;
    baseV += baseA * dt;
    baseX += baseV * dt;
    if (baseX < 20) { baseX = 20; baseV = 0; }
    if (baseX > width - 20) { baseX = width - 20; baseV = 0; }

    if (fallenAt) {
      if (now - fallenAt > RESET_MS) {
        fallenAt = 0;
        theta = (Math.random() < 0.5 ? -1 : 1) * 0.04;
        omega = 0;
      }
    } else {
      // Gusts of wind
      if (started && now >= nextGust) {
        gustDir = Math.random() < 0.5 ? -1 : 1;
        gustAt = now;
        omega += gustDir * gustPower * (0.6 + Math.random() * 0.5);
        sfx("whoosh");
        nextGust = now + gustGapMin + Math.random() * (gustGapMax - gustGapMin);
      }

      // Inverted pendulum on a moving fingertip
      // (it waits, standing still, until you first touch / move)
      if (!started) {
        draw(now, L);
        frameId = requestAnimationFrame(frame);
        return;
      }
      const alpha = (grav * Math.sin(theta) - baseA * Math.cos(theta)) / L;
      omega += alpha * dt;
      omega *= 1 - 0.8 * dt;
      theta += omega * dt;

      if (started) upMs += dt * 1000;

      if (Math.abs(theta) > FALL_ANGLE) {
        falls++;
        fallenAt = now;
        sfx("thud");
        showMessage(t("bl.fall"), "bad");
        updateHud();
      }
    }

    upEl.textContent = `${(upMs / 1000).toFixed(1)}s`;

    draw(now, L);
    frameId = requestAnimationFrame(frame);
  }


  /* ---------- DRAW ---------- */

  function draw(now, L) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // circus tent background
    const bg = g.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#2a0f2e");
    bg.addColorStop(1, "#4a1830");
    g.fillStyle = bg;
    g.fillRect(0, 0, width, height);

    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      if (i % 2) continue;
      g.fillStyle = "rgba(255,80,110,.12)";
      g.beginPath();
      g.moveTo(width / 2, -20);
      g.lineTo((i / stripes) * width * 1.4 - width * 0.2, height);
      g.lineTo(((i + 1) / stripes) * width * 1.4 - width * 0.2, height);
      g.closePath();
      g.fill();
    }

    // spotlight
    const spot = g.createRadialGradient(baseX, baseY() - L * 0.5, 10, baseX, baseY() - L * 0.5, L * 0.9);
    spot.addColorStop(0, "rgba(255,240,200,.22)");
    spot.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = spot;
    g.fillRect(0, 0, width, height);

    // floor
    g.fillStyle = "#7a2a1a";
    g.fillRect(0, height * 0.93, width, height * 0.07);

    // gust lines
    if (now - gustAt < 600) {
      const a = 1 - (now - gustAt) / 600;
      g.strokeStyle = `rgba(255,255,255,${0.6 * a})`;
      g.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const y = height * (0.25 + i * 0.12);
        const x0 = gustDir > 0 ? width * (0.05 + (1 - a) * 0.3) : width * (0.95 - (1 - a) * 0.3);
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x0 + gustDir * width * 0.22, y);
        g.stroke();
      }
    }

    // safe zone guide (shows how tilted it is)
    const tilt = Math.min(1, Math.abs(theta) / FALL_ANGLE);
    const color = tilt < 0.35 ? "#79f6ab" : tilt < 0.7 ? "#ffd76a" : "#ff5a73";

    // stick
    const by = baseY();
    const shown = fallenAt ? Math.sign(theta) * Math.min(Math.PI / 2, Math.abs(theta) + (now - fallenAt) / 300) : theta;
    const tipX = baseX + Math.sin(shown) * L;
    const tipY = by - Math.cos(shown) * L;

    g.strokeStyle = "#f2e2c4";
    g.lineWidth = Math.max(6, L * 0.035);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(baseX, by);
    g.lineTo(tipX, tipY);
    g.stroke();

    // stripes on the stick
    g.strokeStyle = "#e0394d";
    g.lineWidth = Math.max(6, L * 0.035);
    g.lineCap = "butt";
    for (let i = 1; i < 6; i += 2) {
      const k0 = i / 6;
      const k1 = (i + 0.5) / 6;
      g.beginPath();
      g.moveTo(baseX + Math.sin(shown) * L * k0, by - Math.cos(shown) * L * k0);
      g.lineTo(baseX + Math.sin(shown) * L * k1, by - Math.cos(shown) * L * k1);
      g.stroke();
    }

    // ball on top
    g.fillStyle = color;
    g.beginPath();
    g.arc(tipX, tipY, Math.max(10, L * 0.06), 0, Math.PI * 2);
    g.fill();

    // fingertip / hand
    g.fillStyle = "#ffd2a6";
    g.beginPath();
    g.ellipse(baseX, by + 10, 12, 18, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffc08a";
    g.beginPath();
    g.ellipse(baseX, by + 34, 26, 18, 0, 0, Math.PI * 2);
    g.fill();

    // tilt meter
    const mw = Math.min(160, width * 0.5);
    const mx = width / 2 - mw / 2;
    g.fillStyle = "rgba(255,255,255,.12)";
    g.fillRect(mx, 14, mw, 8);
    g.fillStyle = color;
    const p = Math.max(-1, Math.min(1, shown / FALL_ANGLE));
    g.fillRect(width / 2 + Math.min(0, p * mw / 2), 14, Math.abs(p * mw / 2), 8);
    g.fillStyle = "#fff";
    g.fillRect(width / 2 - 1, 11, 2, 14);
  }


  /* ---------- HUD ---------- */

  function updateHud() {
    fallsEl.textContent = String(falls);
  }

  function showMessage(text, type) {
    clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `be-message bl-message show ${type || ""}`;
    messageTimer = setTimeout(() => {
      messageEl.className = "be-message bl-message";
    }, 700);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frameId);

    const rate = Math.min(1, upMs / TIME_MS);
    const score = clamp(rate * 100, 0, 100);
    const success = rate >= 0.6;

    showMessage(success ? "CLEAR!" : "FAILED", success ? "perfect" : "bad");
    sfx(success ? "clear" : "fail");

    setTimeout(() => {
      onComplete?.({
        score: Math.round(score),
        adapt: Math.round(clamp(30 + rate * 70 - falls * 3, 0, 100)),
        meta: {
          success,
          upMs: Math.round(upMs),
          falls,
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 600);
  }


  /* ---------- START ---------- */

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  updateHud();
  frameId = requestAnimationFrame(frame);

  // For automatic tests only (not used by the game)
  stage.__bl = {
    get theta() { return theta; },
    get omega() { return omega; },
    get baseX() { return baseX; },
    get L() { return stickLen(); }
  };

  return () => {
    finished = true;
    cancelAnimationFrame(frameId);
    clearTimeout(messageTimer);
    observer?.disconnect();
    stage.removeEventListener("pointerdown", onDown);
    stage.removeEventListener("pointermove", onMove);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
