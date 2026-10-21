// GAMIQ（ゲーミック） v2 - Card Match (神経衰弱)
//
// CARD MATCH
// - All cards are shown for a moment. Remember them!
// - Then they turn over. Find all the pairs.
// - Fewer misses = higher score.
// - Higher level: more cards, shorter look at the start.

import { t } from "../i18n.js";
import { byLevel, safeLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createCardMatchGames() {
  return [
    {
      id: "memory_card_match",
      type: "card_match",
      title: "CARD MATCH",
      rule: "REMEMBER THE CARDS, THEN FIND ALL THE PAIRS!",
      skill: "MEMORY",
      theme: "cards",
      duration: 45000
    }
  ];
}

export function runCardMatchGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "card_match") {
    return runCardMatch({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
CARDS
========================================== */

const FACES = [
  "🍎", "🍋", "🍇", "🍉", "🍒", "🥝",
  "🐶", "🐱", "🐸", "🐼", "🦊", "🐙",
  "⚽", "🎸", "🚀", "🌵", "🍩", "⭐"
];

function shuffle(list) {
  const a = [...list];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}


/* ==========================================
GAME
========================================== */

function runCardMatch({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   pairs: 6 (Lv1-3) -> 8 (Lv4-7) -> 10 (Lv8-10)
   *   first look at all cards: 1.6s (Lv1) -> 0.8s (Lv10)
   *   time limit: 15s + 4s per pair
   */
  const lv = safeLevel(level);
  const pairs = lv <= 3 ? 6 : lv <= 7 ? 8 : 10;
  const peekMs = byLevel(level, 1600, 800);
  const timeLimitMs = 15000 + pairs * 4000;

  const faces = shuffle(FACES).slice(0, pairs);
  const deck = shuffle([...faces, ...faces]);

  let finished = false;
  let playing = false;
  let open = [];
  let found = 0;
  let misses = 0;
  let startedAt = 0;
  let clockTimer = null;
  let closeTimer = null;
  let timers = [];

  const seen = new Set();
  let wastedMisses = 0;

  container.innerHTML = `
    <div class="cm-game">

      <div class="cm-hud">
        <div>
          <span>PAIRS</span>
          <strong data-cm-pairs>0 / ${pairs}</strong>
        </div>
        <div>
          <span>MISS</span>
          <strong data-cm-miss>0</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-cm-time>${Math.round(timeLimitMs / 1000)}</strong>
        </div>
      </div>

      <div class="cm-stage" data-cm-stage>
        <div class="cm-grid" data-cm-grid></div>
        <div class="cm-message" data-cm-message>${t("cm.look")}</div>
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-cm-stage]");
  const grid = container.querySelector("[data-cm-grid]");
  const pairsEl = container.querySelector("[data-cm-pairs]");
  const missEl = container.querySelector("[data-cm-miss]");
  const timeEl = container.querySelector("[data-cm-time]");
  const messageEl = container.querySelector("[data-cm-message]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);

    timers.push(id);
    return id;
  }


  /* ---------- LAYOUT ---------- */

  // Pick the number of columns that gives the biggest cards
  function fit() {
    const total = deck.length;
    const w = stage.clientWidth;
    const h = stage.clientHeight - 30;
    const gap = 8;
    const ratio = 1.25; // card height / width

    let best = { cols: 4, size: 0 };

    for (let cols = 3; cols <= 7; cols++) {
      const rows = Math.ceil(total / cols);
      if (rows * cols - total >= cols) continue;

      const cw = (w - gap * (cols - 1)) / cols;
      const ch = (h - gap * (rows - 1)) / rows;
      const size = Math.min(cw, ch / ratio);

      if (size > best.size) best = { cols, size };
    }

    grid.style.setProperty("--cols", best.cols);
    grid.style.setProperty("--card-w", `${Math.floor(best.size)}px`);
  }

  window.addEventListener("resize", fit);


  /* ---------- BUILD ---------- */

  const cards = deck.map((face, index) => {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "cm-card up";
    card.dataset.face = face;
    card.innerHTML = `
      <span class="cm-inner">
        <span class="cm-back"><b>G</b></span>
        <span class="cm-front">${face}</span>
      </span>
    `;

    card.addEventListener("pointerdown", event => {
      event.preventDefault();
      choose(index);
    });

    grid.appendChild(card);
    return card;
  });


  /* ---------- PLAY ---------- */

  function closeOpen() {
    clearTimeout(closeTimer);

    open.forEach(i => cards[i].classList.remove("up", "wrong"));
    open = [];
  }

  function choose(index) {
    if (!playing || finished) return;

    const card = cards[index];

    if (card.classList.contains("done")) return;

    // Two wrong cards still showing: a new tap turns them back at once
    // (also when the tap is on one of those two cards)
    if (open.length === 2) closeOpen();

    if (open.includes(index)) return;

    card.classList.add("up");
    open.push(index);

    sfx("click");

    if (open.length < 2) return;

    const [a, b] = open;

    if (cards[a].dataset.face === cards[b].dataset.face) {
      // Pair!
      cards[a].classList.add("done");
      cards[b].classList.add("done");
      open = [];

      found++;
      pairsEl.textContent = `${found} / ${pairs}`;

      sfx(found === pairs ? "perfect" : "pop");

      if (found === pairs) finish(true);
    } else {
      misses++;
      missEl.textContent = String(misses);

      // A miss on a card you had already seen counts as "forgot"
      if (seen.has(a) && seen.has(b)) wastedMisses++;

      cards[a].classList.add("wrong");
      cards[b].classList.add("wrong");

      sfx("tick");

      closeTimer = later(closeOpen, 750);
    }

    seen.add(a);
    seen.add(b);
  }


  /* ---------- CLOCK ---------- */

  function updateClock() {
    const left = Math.max(0, timeLimitMs - (performance.now() - startedAt));

    timeEl.textContent = String(Math.ceil(left / 1000));
    timeEl.classList.toggle("danger", left <= 8000);

    if (left <= 0) finish(false);
  }


  /* ---------- FINISH ---------- */

  function finish(cleared) {
    if (finished) return;

    finished = true;
    playing = false;

    clearInterval(clockTimer);
    timers.forEach(clearTimeout);

    const usedMs = performance.now() - startedAt;

    let score;

    if (cleared) {
      // Clear: 60 + up to 30 for few misses + up to 10 for speed
      const missRate = Math.min(1, misses / (pairs * 1.5));
      const speed = Math.max(0, 1 - usedMs / timeLimitMs);

      score = 60 + (1 - missRate) * 30 + speed * 10;

      messageEl.textContent = t("cm.clear");
      messageEl.className = "cm-message good";
    } else {
      score = (found / pairs) * 60;

      // Show the cards that were left
      cards.forEach(card => card.classList.add("up"));

      messageEl.textContent = t("cm.timeUp", { n: found });
      messageEl.className = "cm-message";
    }

    setTimeout(() => {
      onComplete?.({
        score: Math.round(clamp(score, 0, 100)),

        adapt: Math.round(clamp(40 + (found / pairs) * 35 - wastedMisses * 4 + (cleared ? 15 : 0), 0, 100)),

        meta: {
          success: cleared,
          pairs,
          found,
          misses,
          forgot: wastedMisses,
          seconds: Math.round(usedMs / 1000)
        }
      });
    }, 1000);
  }


  /* ---------- START ---------- */

  requestAnimationFrame(() => {
    if (finished) return;

    fit();

    // Look at all the cards for a moment...
    later(() => {
      cards.forEach(card => card.classList.remove("up"));

      messageEl.textContent = t("cm.go");
      sfx("whoosh");

      later(() => {
        playing = true;
        startedAt = performance.now();
        clockTimer = setInterval(updateClock, 200);

        messageEl.textContent = t("cm.find");
      }, 350);
    }, peekMs + 900); // +0.9s: the "GO!" flash covers the cards at first
  });


  return () => {
    finished = true;
    playing = false;

    clearInterval(clockTimer);
    timers.forEach(clearTimeout);
    window.removeEventListener("resize", fit);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
