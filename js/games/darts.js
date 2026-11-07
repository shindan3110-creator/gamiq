// GAMIQ（ゲーミック） v2 - Darts
//
// DARTS (AIM)
// - Your aim sways around the board on its own.
// - Tap (PC: click or Space) when it is over the center to throw.
// - 6 darts. The closer to the center, the more points.
// - Higher level: the aim sways faster and wider, and WIND pushes
//   the dart (watch the arrow and throw a little off-center).

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createDartsGames() {
  return [
    {
      id: "aim_darts",
      type: "darts",
      title: "DARTS",
      rule: "THE AIM SWAYS. THROW WHEN IT'S ON THE CENTER! 6 DARTS.",
      skill: "AIM",
      theme: "bar",
      duration: 30000
    }
  ];
}

export function runDartsGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "darts") {
    return runDarts({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const DARTS = 6;
const TIME_MS = 30000;

// Rings as a share of the board radius (from the center out)
const RINGS = [
  { limit: 0.07, points: 50, label: "BULL!" },
  { limit: 0.16, points: 25, label: "25" },
  { limit: 0.42, points: 15, label: "15" },
  { limit: 0.68, points: 10, label: "10" },
  { limit: 1.0, points: 5, label: "5" }
];

function runDarts({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   sway size:  32% of the board (Lv1) -> 55%
   *   sway speed: slow -> fast
   *   wind:       none (Lv1-3) -> strong
   */
  const swaySize = Math.min(0.7, byLevel(level, 0.32, 0.55));
  const swaySpeed = Math.min(2.6, byLevel(level, 1, 1.8));
  const windMax = level >= 4 ? Math.min(0.45, byLevel(level, 0.05, 0.3)) : 0;

  let finished = false;
  let thrown = 0;
  let total = 0;
  let bulls = 0;
  let misses = 0;
  let flying = null;       // dart in the air
  const stuck = [];        // darts on the board
  let wind = { x: 0, y: 0 };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let R = 10;

  let frameId = null;
  let messageTimer = null;
  let phase = Math.random() * 10;
  let lastTime = performance.now();
  const startedAt = performance.now();

  container.innerHTML = `
    <div class="be-game dt-game">
      <div class="be-hud">
        <div>
          <span>DART</span>
          <strong data-dt-count>0 / ${DARTS}</strong>
        </div>
        <div>
          <span>WIND</span>
          <strong data-dt-wind>—</strong>
        </div>
        <div>
          <span>POINTS</span>
          <strong data-dt-points>0</strong>
        </div>
      </div>

      <div class="dt-stage" data-dt-stage>
        <canvas class="dt-canvas" data-dt-canvas></canvas>
        <div class="be-message dt-message" data-dt-message></div>
        <div class="dt-hint" data-dt-hint>${t("dt.hint")}</div>
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-dt-stage]");
  const canvas = container.querySelector("[data-dt-canvas]");
  const g = canvas.getContext("2d");
  const countEl = container.querySelector("[data-dt-count]");
  const windEl = container.querySelector("[data-dt-wind]");
  const pointsEl = container.querySelector("[data-dt-points]");
  const messageEl = container.querySelector("[data-dt-message]");
  const hintEl = container.querySelector("[data-dt-hint]");


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
    cx = width / 2;
    cy = height * 0.47;
    R = Math.min(width * 0.42, height * 0.38);
  }

  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(stage);
  resize();


  /* ---------- AIM ---------- */

  // Where the aim is now (relative to the center, in board radii)
  function aimAt(time) {
    const s = time * swaySpeed;
    return {
      x: Math.sin(s * 1.3 + phase) * swaySize + Math.sin(s * 3.1 + phase * 2) * swaySize * 0.18,
      y: Math.sin(s * 1.9 + phase * 1.5) * swaySize * 0.8 + Math.cos(s * 2.7) * swaySize * 0.15
    };
  }

  function newWind() {
    if (!windMax) {
      wind = { x: 0, y: 0 };
      windEl.textContent = "—";
      return;
    }
    const a = Math.random() * Math.PI * 2;
    const p = windMax * (0.4 + Math.random() * 0.6);
    wind = { x: Math.cos(a) * p, y: Math.sin(a) * p };
    const arrows = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
    const idx = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
    windEl.textContent = `${arrows[idx]} ${Math.round(p * 10)}`;
  }


  /* ---------- THROW ---------- */

  function throwDart() {
    if (finished || flying || thrown >= DARTS) return;

    hintEl.classList.add("hide");

    const now = performance.now();
    const a = aimAt((now - startedAt) / 1000);

    // Tiny random shake + wind
    const jitter = 0.025;
    const land = {
      x: a.x + wind.x + (Math.random() - 0.5) * jitter,
      y: a.y + wind.y + (Math.random() - 0.5) * jitter
    };

    flying = { from: { x: 0.9, y: 1.6 }, to: land, born: now, duration: 260 };
    thrown++;
    sfx("whoosh");
    updateHud();
  }

  function land(d) {
    const dist = Math.hypot(d.x, d.y);
    const ring = RINGS.find(r => dist <= r.limit);

    stuck.push({ x: d.x, y: d.y });

    if (!ring) {
      misses++;
      sfx("thud");
      showMessage("MISS", "bad");
    } else {
      total += ring.points;
      if (ring.points === 50) {
        bulls++;
        sfx("perfect");
        showMessage("BULL! +50", "perfect");
      } else {
        sfx("wood");
        showMessage(`+${ring.points}`, ring.points >= 25 ? "great" : "good");
      }
    }

    updateHud();

    if (thrown >= DARTS) {
      setTimeout(finish, 700);
    } else {
      newWind();
    }
  }

  function onDown(event) {
    event.preventDefault();
    throwDart();
  }

  function onKey(event) {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      throwDart();
    }
  }


  /* ---------- DRAW ---------- */

  function frame(now) {
    if (finished) return;

    const left = Math.max(0, TIME_MS - (now - startedAt));
    if (left <= 0) {
      finish();
      return;
    }

    lastTime = now;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRoom();
    drawBoard();

    for (const d of stuck) drawDart(cx + d.x * R, cy + d.y * R, 1);

    if (flying) {
      const p = Math.min(1, (now - flying.born) / flying.duration);
      const e = 1 - Math.pow(1 - p, 2);
      const x = flying.from.x + (flying.to.x - flying.from.x) * e;
      const y = flying.from.y + (flying.to.y - flying.from.y) * e - Math.sin(p * Math.PI) * 0.25;
      drawDart(cx + x * R, cy + y * R, 1 + (1 - p) * 1.6);
      if (p >= 1) {
        const done = flying.to;
        flying = null;
        land(done);
      }
    }

    if (!flying && thrown < DARTS) {
      const a = aimAt((now - startedAt) / 1000);
      drawAim(cx + a.x * R, cy + a.y * R);
    }

    if (wind.x || wind.y) drawWind(now);

    frameId = requestAnimationFrame(frame);
  }

  function drawRoom() {
    const bg = g.createRadialGradient(cx, cy, R * 0.5, cx, cy, Math.max(width, height));
    bg.addColorStop(0, "#3a2a20");
    bg.addColorStop(1, "#140d09");
    g.fillStyle = bg;
    g.fillRect(0, 0, width, height);
  }

  function drawBoard() {
    // outer wooden ring
    g.fillStyle = "#1a1210";
    g.beginPath();
    g.arc(cx, cy, R * 1.12, 0, Math.PI * 2);
    g.fill();

    // Scoring zones match the colors exactly:
    //   5 = outer black/cream, 10 = red/green ring, 15 = inner black/cream,
    //   25 = green, 50 = red bull
    const segs = 20;
    for (let k = 0; k < segs; k++) {
      const a0 = (k / segs) * Math.PI * 2 - Math.PI / 2 - Math.PI / segs;
      const a1 = a0 + (Math.PI * 2) / segs;
      const dark = k % 2 === 0;

      ringSeg(a0, a1, R * 0.68, R, dark ? "#1b1b1b" : "#f2e6c9");
      ringSeg(a0, a1, R * 0.42, R * 0.68, dark ? "#c8293a" : "#1f8a4c");
      ringSeg(a0, a1, R * 0.16, R * 0.42, dark ? "#2a2a2a" : "#fff4dc");
    }

    // metal wires on the zone borders
    g.strokeStyle = "rgba(220,220,220,.8)";
    g.lineWidth = 1.5;
    [0.16, 0.42, 0.68, 1].forEach(k => {
      g.beginPath();
      g.arc(cx, cy, R * k, 0, Math.PI * 2);
      g.stroke();
    });

    // 25 and bull
    g.fillStyle = "#1f8a4c";
    g.beginPath();
    g.arc(cx, cy, R * 0.16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#c8293a";
    g.beginPath();
    g.arc(cx, cy, R * 0.07, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // point labels on the left side of each zone
    g.font = `900 ${Math.max(10, R * 0.075)}px -apple-system, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    [[0.84, "5"], [0.55, "10"], [0.29, "15"]].forEach(([k, label]) => {
      const x = cx - R * k;
      g.fillStyle = "rgba(0,0,0,.55)";
      g.beginPath();
      g.arc(x, cy, R * 0.075, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffff";
      g.fillText(label, x, cy + 0.5);
    });
  }

  function ringSeg(a0, a1, r0, r1, color) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(cx, cy, r1, a0, a1);
    g.arc(cx, cy, r0, a1, a0, true);
    g.closePath();
    g.fill();
  }

  function drawAim(x, y) {
    const s = R * 0.12;
    g.save();
    g.strokeStyle = "rgba(255,255,255,.95)";
    g.shadowColor = "rgba(0,0,0,.6)";
    g.shadowBlur = 4;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.moveTo(x - s * 1.6, y); g.lineTo(x - s * 0.5, y);
    g.moveTo(x + s * 0.5, y); g.lineTo(x + s * 1.6, y);
    g.moveTo(x, y - s * 1.6); g.lineTo(x, y - s * 0.5);
    g.moveTo(x, y + s * 0.5); g.lineTo(x, y + s * 1.6);
    g.stroke();
    g.fillStyle = "#5fefff";
    g.beginPath();
    g.arc(x, y, 3, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawDart(x, y, scale) {
    const L = R * 0.32 * scale;
    g.save();
    g.translate(x, y);
    g.rotate(0.55);
    // shaft
    g.fillStyle = "#c9ced8";
    g.fillRect(0, -L * 0.04, L * 0.65, L * 0.08);
    // tip
    g.fillStyle = "#e9ecf2";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(L * 0.12, -L * 0.03);
    g.lineTo(L * 0.12, L * 0.03);
    g.closePath();
    g.fill();
    // flights
    g.fillStyle = "#5fefff";
    g.beginPath();
    g.moveTo(L * 0.6, 0);
    g.lineTo(L, -L * 0.16);
    g.lineTo(L * 0.92, 0);
    g.lineTo(L, L * 0.16);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawWind(now) {
    const x = width - 44;
    const y = 30;
    const a = Math.atan2(wind.y, wind.x);
    const len = 14 + Math.hypot(wind.x, wind.y) * 60;
    const wob = Math.sin(now / 150) * 2;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.strokeStyle = "#ffd76a";
    g.fillStyle = "#ffd76a";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-len / 2 + wob, 0);
    g.lineTo(len / 2, 0);
    g.stroke();
    g.beginPath();
    g.moveTo(len / 2 + 6, 0);
    g.lineTo(len / 2 - 4, -6);
    g.lineTo(len / 2 - 4, 6);
    g.closePath();
    g.fill();
    g.restore();
  }


  /* ---------- HUD ---------- */

  function updateHud() {
    countEl.textContent = `${thrown} / ${DARTS}`;
    pointsEl.textContent = String(total);
  }

  function showMessage(text, type) {
    clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `be-message dt-message show ${type || ""}`;
    messageTimer = setTimeout(() => {
      messageEl.className = "be-message dt-message";
    }, 700);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frameId);

    // An average of 35 points per dart (mostly 25s and bulls) = full score
    const average = total / DARTS;
    const score = clamp((average / 35) * 100, 0, 100);
    const success = average >= 15 && misses <= 2;

    showMessage(success ? "CLEAR!" : "FAILED", success ? "perfect" : "bad");
    sfx(success ? "clear" : "fail");

    setTimeout(() => {
      onComplete?.({
        score: Math.round(score),
        adapt: Math.round(clamp(30 + (average / 35) * 60 - misses * 5, 0, 100)),
        meta: {
          success,
          total,
          average: Math.round(average * 10) / 10,
          bulls,
          misses,
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 600);
  }


  /* ---------- START ---------- */

  stage.addEventListener("pointerdown", onDown);
  window.addEventListener("keydown", onKey);

  newWind();
  updateHud();
  frameId = requestAnimationFrame(frame);

  // For automatic tests only (not used by the game)
  stage.__dt = { aimAt: () => aimAt((performance.now() - startedAt) / 1000), get wind() { return wind; } };

  return () => {
    finished = true;
    cancelAnimationFrame(frameId);
    clearTimeout(messageTimer);
    observer?.disconnect();
    stage.removeEventListener("pointerdown", onDown);
    window.removeEventListener("keydown", onKey);
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
