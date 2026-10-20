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
