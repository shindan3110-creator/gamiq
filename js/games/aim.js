// GAMIQ（ゲーミック） v2 - Aim Games

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";


export function createAimGames() {
  return [
    {
      id: "aim_bullseye",
      type: "bullseye",
      title: "BULLSEYE",
      rule: "HIT THE CENTER BEFORE THE TARGET SHRINKS AWAY!",
      skill: "AIM",
      theme: "range",
      duration: 25000
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
      return runBullseye({
        container,
        onComplete,
        level: game.level
      });

    default:
      return () => {};
  }
}


/* ==========================================
BULLSEYE
- Targets appear one at a time and shrink.
- Tap / click as close to the center as you can.
- The closer to the center, the more points.
- If it shrinks away, you get nothing.
- Shots that miss the target lower your score.
- 12 targets. Precision matters more than speed.
========================================== */

const BE_TARGETS = 12;

// Ring size (as a share of the target radius) and points.
const BE_RINGS = [
  { limit: 0.2, points: 100, label: "BULLSEYE!", type: "perfect" },
  { limit: 0.45, points: 70, label: "GREAT", type: "great" },
  { limit: 0.7, points: 40, label: "GOOD", type: "good" },
  { limit: 1.0, points: 15, label: "EDGE", type: "edge" }
];

const BE_TARGET_SVG = `
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="50" fill="#f4f6fa"/>
    <circle cx="50" cy="50" r="35" fill="#ff4d6a"/>
    <circle cx="50" cy="50" r="22.5" fill="#f4f6fa"/>
    <circle cx="50" cy="50" r="10" fill="#ff4d6a"/>
    <circle cx="50" cy="50" r="2.5" fill="#ffffff"/>
  </svg>
`;


function runBullseye({
  container,
  onComplete,
  level = 1
}) {
  let active = true;

  /*
   * DIFFICULTY BY LEVEL (Lv1 = same as before)
   * Targets are smaller and shrink away faster.
   */
  const sizeMul = byLevel(level, 1, 0.8);
  const lifeMul = byLevel(level, 1, 0.7);

  let index = 0;
  let totalPoints = 0;
  let perfects = 0;
  let vanished = 0;
  let missedShots = 0;

  let target = null;

  let frameId = null;
  let spawnTimer = null;
  let finishTimer = null;
  let messageTimer = null;

  const startedAt = performance.now();


  container.innerHTML = `
    <div class="be-game">

      <div class="be-hud">
        <div>
          <span>TARGET</span>
          <strong data-be-count>0 / ${BE_TARGETS}</strong>
        </div>

        <div>
          <span>POINTS</span>
          <strong data-be-points>0</strong>
        </div>

        <div>
          <span>BULLSEYE</span>
          <strong data-be-perfect>0</strong>
        </div>
      </div>

      <div class="be-range" data-be-range>
        <div class="be-message" data-be-message></div>
      </div>

    </div>
  `;

  const range = container.querySelector("[data-be-range]");
  const countElement = container.querySelector("[data-be-count]");
  const pointsElement = container.querySelector("[data-be-points]");
  const perfectElement = container.querySelector("[data-be-perfect]");
  const messageElement = container.querySelector("[data-be-message]");


  /* ---------- HELPERS ---------- */

  function baseSize() {
    return Math.round(
      (range.clientWidth < 480 ? 104 : 124) * sizeMul
    );
  }

  function lifeTime() {
    // 1.9s at the start -> 1.25s at the end
    return (1900 - (index / BE_TARGETS) * 650) * lifeMul;
  }

  function updateHud() {
    countElement.textContent = `${index} / ${BE_TARGETS}`;
    pointsElement.textContent = String(totalPoints);
    perfectElement.textContent = String(perfects);
  }

  function showMessage(text, type) {
    clearTimeout(messageTimer);

    messageElement.textContent = text;
    messageElement.className = `be-message ${type}`;

    void messageElement.offsetWidth;

    messageElement.classList.add("show");

    messageTimer = setTimeout(() => {
      messageElement.classList.remove("show");
    }, 500);
  }


  /* ---------- TARGET ---------- */

  function spawnTarget() {
    if (!active) {
      return;
    }

    if (index >= BE_TARGETS) {
      finish();
      return;
    }

    index++;
    updateHud();

    const size = baseSize();
    const width = range.clientWidth;
    const height = range.clientHeight;

    const element = document.createElement("div");

    element.className = "be-target";
    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    element.innerHTML = BE_TARGET_SVG;

    const margin = size / 2 + 6;

    const x = margin + Math.random() * Math.max(1, width - margin * 2);
    const y = margin + Math.random() * Math.max(1, height - margin * 2);

    element.style.left = `${x - size / 2}px`;
    element.style.top = `${y - size / 2}px`;

    range.appendChild(element);

    target = {
      element,
      x,
      y,
      size,
      born: performance.now(),
      life: lifeTime(),
      scale: 1
    };
  }

  function removeTarget(className) {
    if (!target) {
      return;
    }

    const element = target.element;

    element.classList.add(className);

    setTimeout(() => element.remove(), 260);

    target = null;
  }

  function nextTarget(delay = 280) {
    spawnTimer = setTimeout(spawnTarget, delay);
  }


  /* ---------- SHRINK LOOP ---------- */

  function frame(now) {
    if (!active) {
      return;
    }

    if (target) {
      const age = now - target.born;

      // Shrinks from 100% down to 25%, then disappears.
      target.scale = Math.max(0.25, 1 - (age / target.life) * 0.75);

      target.element.style.transform = `scale(${target.scale})`;

      if (age >= target.life) {
        vanished++;

        removeTarget("vanish");
        showMessage(t("be.tooSlow"), "bad");

        nextTarget();
      }
    }

    frameId = requestAnimationFrame(frame);
  }


  /* ---------- SHOOT ---------- */

  function shoot(event) {
    if (!active) {
      return;
    }

    event.preventDefault();

    const rect = range.getBoundingClientRect();

    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    showShotMark(px, py);

    if (!target) {
      return;
    }

    const radius = (target.size / 2) * target.scale;
    const distance = Math.hypot(px - target.x, py - target.y);
    const ratio = distance / radius;

    const ring = BE_RINGS.find(item => ratio <= item.limit);

    if (!ring) {
      // Missed the target completely.
      missedShots++;
      showMessage("MISS", "bad");
      return;
    }

    totalPoints += ring.points;

    if (ring.type === "perfect") {
      perfects++;
    }

    showMessage(`${ring.label} +${ring.points}`, ring.type);

    removeTarget("hit");
    updateHud();

    nextTarget();
  }

  function showShotMark(x, y) {
    const mark = document.createElement("div");

    mark.className = "be-shot";
    mark.style.left = `${x}px`;
    mark.style.top = `${y}px`;

    range.appendChild(mark);

    setTimeout(() => mark.remove(), 400);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (!active) {
      return;
    }

    active = false;

    clearTimeout(spawnTimer);
    cancelAnimationFrame(frameId);

    const average = totalPoints / BE_TARGETS;

    // Average ring points, minus a little for wild shots.
    const score = clamp(average - missedShots * 3, 0, 100);

    const success =
      average >= 55 &&
      vanished <= 2;

    showMessage(
      success ? "CLEAR!" : "FAILED",
      success ? "perfect" : "bad"
    );

    finishTimer = setTimeout(() => {
      onComplete?.({
        score: Math.round(score),

        adapt: Math.round(
          clamp(
            35 +
            (average / 100) * 45 +
            ((BE_TARGETS - vanished) / BE_TARGETS) * 20 -
            missedShots * 3,
            0,
            100
          )
        ),

        meta: {
          success,
          totalPoints,
          averagePoints: Math.round(average),
          perfects,
          vanished,
          missedShots,
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 500);
  }


  /* ---------- START ---------- */

  range.addEventListener("pointerdown", shoot);

  updateHud();

  nextTarget(400);
  frameId = requestAnimationFrame(frame);


  return () => {
    active = false;

    clearTimeout(spawnTimer);
    clearTimeout(finishTimer);
    clearTimeout(messageTimer);
    cancelAnimationFrame(frameId);

    range.removeEventListener("pointerdown", shoot);
  };
}


/* ==========================================
UTIL
========================================== */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
