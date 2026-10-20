// GAMIQ（ゲーミック） v2 - Juice (game feel)
//
// Small effects that make every game feel better, without touching
// each game's own code:
//   - tapFx(host):        a ring + spark where the player taps
//   - celebrate(card, n): score counts up, a rating word appears
//                         (PERFECT / GREAT / GOOD / ...) and
//                         particles burst from the score
// Everything is pointer-events:none, so it never blocks a game.

const REDUCED =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/* ==========================================
TAP RIPPLE
========================================== */

let lastTap = null;

export function tapFx(host) {
  if (!host || host.dataset.tapFx) return;

  host.dataset.tapFx = "1";

  host.addEventListener(
    "pointerdown",
    event => {
      if (REDUCED) return;

      const rect = host.getBoundingClientRect();
      const ring = document.createElement("span");

      ring.className = "jx-ring";
      ring.style.left = `${event.clientX - rect.left}px`;
      ring.style.top = `${event.clientY - rect.top}px`;

      host.appendChild(ring);

      lastTap = { host, x: event.clientX - rect.left, y: event.clientY - rect.top, at: performance.now() };

      setTimeout(() => ring.remove(), 450);
    },
    { capture: true, passive: true }
  );
}


/* ==========================================
SCORE CELEBRATION
========================================== */

export function ratingFor(score) {
  if (score >= 95) return { word: "PERFECT!", tone: "perfect", count: 46 };
  if (score >= 80) return { word: "GREAT!", tone: "great", count: 30 };
  if (score >= 60) return { word: "GOOD", tone: "good", count: 16 };
  if (score >= 30) return { word: "OK", tone: "ok", count: 0 };
  return { word: "MISS", tone: "miss", count: 0 };
}

const COLORS = {
  perfect: ["#ffd76a", "#fff3c4", "#ff9f43", "#ffffff"],
  great: ["#5fefff", "#b7f9ff", "#7cffb2", "#ffffff"],
  good: ["#7cffb2", "#3fb950", "#ffffff"]
};

/**
 * @param {HTMLElement} card     the card that has the complete overlay
 * @param {number} score         0-100
 */
export function celebrate(card, score) {
  const overlay = card?.querySelector("[data-card-complete]");
  const scoreEl = card?.querySelector("[data-complete-score]");

  if (!overlay || !scoreEl || !Number.isFinite(score)) return;

  const rating = ratingFor(score);

  overlay.dataset.tone = rating.tone;

  // Rating word under the score
  let wordEl = overlay.querySelector(".jx-rating");

  if (!wordEl) {
    wordEl = document.createElement("div");
    wordEl.className = "jx-rating";
    scoreEl.after(wordEl);
  }

  wordEl.textContent = rating.word;
  wordEl.className = `jx-rating ${rating.tone}`;

  // Count up 0 -> score
  if (REDUCED) {
    scoreEl.textContent = String(score);
  } else {
    const start = performance.now();
    const duration = 650;

    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);

      scoreEl.textContent = String(Math.round(score * eased));

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        scoreEl.classList.remove("jx-pop");
        void scoreEl.offsetWidth;
        scoreEl.classList.add("jx-pop");

        burst(overlay, scoreEl, rating);
      }
    };

    requestAnimationFrame(step);
  }
}

function burst(overlay, from, rating) {
  if (REDUCED || !rating.count) return;

  const colors = COLORS[rating.tone];
  const o = overlay.getBoundingClientRect();
  const s = from.getBoundingClientRect();

  const cx = s.left - o.left + s.width / 2;
  const cy = s.top - o.top + s.height / 2;

  const layer = document.createElement("div");
  layer.className = "jx-burst";
  overlay.appendChild(layer);

  for (let i = 0; i < rating.count; i++) {
    const p = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 160;
    const size = 5 + Math.random() * 7;

    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.width = `${size}px`;
    p.style.height = `${size * (Math.random() < 0.5 ? 1 : 2.2)}px`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist - 40}px`);
    p.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    p.style.animationDelay = `${Math.random() * 60}ms`;

    layer.appendChild(p);
  }

  setTimeout(() => layer.remove(), 1300);
}


/* ==========================================
HIT / MISS EFFECTS
The games already play a sound at the right moment
("good", "bad", "slashHit"...). sound.js tells us the name,
and we add a matching visual effect where the player tapped.
========================================== */

const GOOD_SOUNDS = new Set([
  "good", "pop", "slashHit", "explosion", "impact", "boost", "wood"
]);
const BIG_SOUNDS = new Set(["perfect"]);
const BAD_SOUNDS = new Set(["bad", "hurt", "crash", "bonk", "gunshotFar"]);

let juiceReady = false;
let lastFx = 0;

export function initJuice() {
  if (juiceReady) return;

  juiceReady = true;

  window.addEventListener("gamiq:sfx", event => {
    const name = event.detail;

    if (REDUCED) return;

    const now = performance.now();
    if (now - lastFx < 70) return;

    if (GOOD_SOUNDS.has(name)) {
      lastFx = now;
      spark(false, name);
    } else if (BIG_SOUNDS.has(name)) {
      lastFx = now;
      spark(true);
    } else if (BAD_SOUNDS.has(name)) {
      lastFx = now;
      hurt();
    }
  });
}

function activeHost() {
  return (
    document.querySelector(".dl-overlay.show .dl-card [data-game-host]") ||
    document.querySelector(".gamiq-feed-card.current [data-game-host]")
  );
}

function spark(big, name) {
  const host = activeHost();
  if (!host) return;

  // 3D games play "impact" on every bullet hit: too much there.
  if (name === "impact" && host.querySelector("canvas")) return;

  // Where: the last tap in this game (if recent), else the middle.
  let x = host.clientWidth / 2;
  let y = host.clientHeight / 2;

  if (lastTap && lastTap.host === host && performance.now() - lastTap.at < 1500) {
    x = lastTap.x;
    y = lastTap.y;
  }

  const layer = document.createElement("div");
  layer.className = "jx-burst jx-hit";
  host.appendChild(layer);

  const colors = big ? COLORS.perfect : COLORS.great;
  const count = big ? 22 : 10;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = (big ? 70 : 40) + Math.random() * (big ? 70 : 35);
    const size = 4 + Math.random() * (big ? 6 : 4);

    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.borderRadius = "50%";
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist - 60}px`);
    p.style.setProperty("--rot", "0deg");

    layer.appendChild(p);
  }

  // A soft flash of light where it happened
  const glow = document.createElement("span");
  glow.className = big ? "jx-glow big" : "jx-glow";
  glow.style.left = `${x}px`;
  glow.style.top = `${y}px`;
  layer.appendChild(glow);

  setTimeout(() => layer.remove(), 900);
}

function hurt() {
  const host = activeHost();
  if (!host) return;

  // Red edges + a short shake of the game area
  const flash = document.createElement("span");
  flash.className = "jx-hurt";
  host.appendChild(flash);
  setTimeout(() => flash.remove(), 420);

  host.classList.remove("jx-shake");
  void host.offsetWidth;
  host.classList.add("jx-shake");
  setTimeout(() => host.classList.remove("jx-shake"), 360);

  navigator.vibrate?.(30);
}
