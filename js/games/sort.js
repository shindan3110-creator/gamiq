// GAMIQ（ゲーミック） v2 - Sort Rush
//
// SORT RUSH
// - Items come down a factory conveyor belt.
// - Send the front item to the LEFT or RIGHT box (tap that side).
// - Fruit / vegetable, land / sea animal, even / odd...
// - The belt gets faster and faster. Items that reach the end fall off!
// - Higher level: faster belt from the start.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createSortGames() {
  return [
    {
      id: "speed_sort_rush",
      type: "sort_rush",
      title: "SORT RUSH",
      rule: "SORT THE ITEMS LEFT OR RIGHT. THE BELT GETS FASTER!",
      skill: "SPEED",
      theme: "factory",
      duration: 25000
    }
  ];
}

export function runSortGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "sort_rush") {
    return runSortRush({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
RULE SETS (left / right)
========================================== */

const SETS = [
  {
    left: { key: "sort.fruit", icon: "🍎", items: ["🍎", "🍌", "🍇", "🍓", "🍊", "🍑", "🍍", "🍒"] },
    right: { key: "sort.veg", icon: "🥕", items: ["🥕", "🥦", "🍆", "🌽", "🥒", "🧅", "🥔", "🫑"] }
  },
  {
    left: { key: "sort.land", icon: "🐶", items: ["🐶", "🐱", "🐮", "🐷", "🦁", "🐰", "🐻", "🐴"] },
    right: { key: "sort.sea", icon: "🐟", items: ["🐟", "🐙", "🦀", "🐬", "🐳", "🦈", "🐡", "🦑"] }
  },
  {
    left: { key: "sort.even", icon: "2", items: ["2", "4", "6", "8", "12", "14", "16", "18"], number: true },
    right: { key: "sort.odd", icon: "3", items: ["1", "3", "5", "7", "9", "11", "13", "15"], number: true }
  },
  {
    left: { key: "sort.sweet", icon: "🍰", items: ["🍰", "🍩", "🍪", "🍫", "🍭", "🍦", "🧁", "🍬"] },
    right: { key: "sort.meal", icon: "🍔", items: ["🍔", "🍕", "🍣", "🍜", "🌭", "🍛", "🍙", "🥪"] }
  }
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}


/* ==========================================
GAME
========================================== */

const TIME_LIMIT_MS = 25000;

function runSortRush({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   time for an item to go down the belt: 2.6s (Lv1) -> 1.5s (Lv10)
   *   it gets 40% faster by the end of the game
   *   about 3 items are on the belt at once
   */
  const startTravel = byLevel(level, 2600, 1500);
  const endTravel = startTravel * 0.6;

  const set = pick(SETS);

  let finished = false;
  let startedAt = 0;
  let lastFrame = 0;
  let nextSpawnAt = 0;
  let frame = 0;
  let timers = [];

  let correct = 0;
  let wrong = 0;
  let dropped = 0;
  let combo = 0;
  let bestCombo = 0;

  const items = [];

  const label = side => {
    const s = set[side];
    return `<b class="${s.number ? "num" : ""}">${s.icon}</b><span>${t(s.key)}</span>`;
  };

  container.innerHTML = `
    <div class="sr-game">

      <div class="sr-hud">
        <div>
          <span>OK</span>
          <strong data-sr-ok>0</strong>
        </div>
        <div>
          <span>COMBO</span>
          <strong data-sr-combo>0</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-sr-time>${TIME_LIMIT_MS / 1000}</strong>
        </div>
      </div>

      <div class="sr-stage" data-sr-stage>
        <div class="sr-belt" data-sr-belt><i></i></div>
        <div class="sr-gate"></div>

        <div class="sr-bin left" data-sr-bin="left">${label("left")}</div>
        <div class="sr-bin right" data-sr-bin="right">${label("right")}</div>

        <div class="sr-arrow left">◀</div>
        <div class="sr-arrow right">▶</div>

        <div class="sr-pop" data-sr-pop></div>
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-sr-stage]");
  const belt = container.querySelector("[data-sr-belt]");
  const okEl = container.querySelector("[data-sr-ok]");
  const comboEl = container.querySelector("[data-sr-combo]");
  const timeEl = container.querySelector("[data-sr-time]");
  const bins = {
    left: container.querySelector('[data-sr-bin="left"]'),
    right: container.querySelector('[data-sr-bin="right"]')
  };
  const popEl = container.querySelector("[data-sr-pop]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);

    timers.push(id);
  }


  /* ---------- BELT GEOMETRY ---------- */

  function geometry() {
    const beltRect = belt.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();

    return {
      top: beltRect.top - stageRect.top,
      end: beltRect.bottom - stageRect.top,
      size: Math.min(beltRect.width * 0.8, 76)
    };
  }

  function travelNow(elapsed) {
    const p = Math.min(1, elapsed / TIME_LIMIT_MS);
    return startTravel + (endTravel - startTravel) * p;
  }


  /* ---------- ITEMS ---------- */

  function spawn() {
    const side = Math.random() < 0.5 ? "left" : "right";
    const s = set[side];

    const el = document.createElement("div");
    el.className = s.number ? "sr-item num" : "sr-item";
    el.textContent = pick(s.items);

    stage.appendChild(el);

    const g = geometry();
    const item = { el, side, y: g.top - g.size, done: false };

    el.style.setProperty("--size", `${g.size}px`);
    el.style.transform = `translate(-50%, ${item.y}px)`;

    items.push(item);
  }

  function frontItem() {
    let best = null;

    for (const item of items) {
      if (item.done) continue;
      if (!best || item.y > best.y) best = item;
    }

    return best;
  }

  function resolve(item, how) {
    item.done = true;

    const el = item.el;

    if (how === "drop") {
      el.classList.add("drop");
    } else {
      el.classList.add(how === "ok" ? "fly-ok" : "fly-bad", `to-${how === "ok" ? item.side : item.side === "left" ? "right" : "left"}`);
    }

    setTimeout(() => el.remove(), 450);
  }

  function pop(text, kind) {
    popEl.className = "sr-pop";
    void popEl.offsetWidth;
    popEl.className = `sr-pop show ${kind}`;
    popEl.textContent = text;
  }

  function sort(side) {
    if (finished || !startedAt) return;

    const item = frontItem();
    if (!item) return;

    const bin = bins[side];
    bin.classList.remove("hit", "bad");
    void bin.offsetWidth;

    if (item.side === side) {
      correct++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);

      okEl.textContent = String(correct);
      comboEl.textContent = String(combo);

      bin.classList.add("hit");
      resolve(item, "ok");

      sfx(combo > 0 && combo % 10 === 0 ? "perfect" : "pop");

      if (combo >= 5 && combo % 5 === 0) pop(`${combo} COMBO!`, "good");
    } else {
      wrong++;
      combo = 0;
      comboEl.textContent = "0";

      bin.classList.add("bad");
      resolve(item, "bad");

      sfx("bad");
      pop("✕", "bad");
    }
  }


  /* ---------- LOOP ---------- */

  function loop(now) {
    if (finished) return;

    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;

    const elapsed = now - startedAt;
    const travel = travelNow(elapsed);
    const g = geometry();
    const speed = (g.end - g.top + g.size) / (travel / 1000); // px per second

    // The belt stripes move at the same speed
    belt.style.setProperty("--belt-speed", `${Math.max(0.12, 40 / speed)}s`);

    // New item: about 3 on the belt at once
    if (now >= nextSpawnAt) {
      spawn();
      nextSpawnAt = now + travel / 3;
    }

    for (const item of items) {
      if (item.done) continue;

      item.y += speed * dt;
      item.el.style.transform = `translate(-50%, ${item.y}px)`;

      // Reached the end: falls off the belt
      if (item.y > g.end - g.size * 0.35) {
        dropped++;
        combo = 0;
        comboEl.textContent = "0";

        resolve(item, "drop");
        sfx("crash");
      }
    }

    // Forget finished items
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].done && !items[i].el.isConnected) items.splice(i, 1);
    }

    const left = Math.max(0, TIME_LIMIT_MS - elapsed);
    timeEl.textContent = String(Math.ceil(left / 1000));
    timeEl.classList.toggle("danger", left <= 5000);

    if (left <= 0) {
      finish();
      return;
    }

    frame = requestAnimationFrame(loop);
  }


  /* ---------- INPUT ---------- */

  function onPointer(event) {
    event.preventDefault();

    const rect = stage.getBoundingClientRect();
    sort(event.clientX - rect.left < rect.width / 2 ? "left" : "right");
  }

  stage.addEventListener("pointerdown", onPointer);

  function onKey(event) {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      event.preventDefault();
      sort("left");
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      event.preventDefault();
      sort("right");
    }
  }

  window.addEventListener("keydown", onKey);


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;

    finished = true;

    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    window.removeEventListener("keydown", onKey);

    belt.classList.add("stop");

    const handled = correct + wrong + dropped;
    const accuracy = handled ? correct / handled : 0;

    const score = accuracy * 100;

    setTimeout(() => {
      onComplete?.({
        score: Math.round(clamp(score, 0, 100)),

        // ADAPT: kept up as the belt got faster (long combos)
        adapt: Math.round(clamp(30 + accuracy * 50 + Math.min(20, bestCombo), 0, 100)),

        meta: {
          success: accuracy >= 0.75,
          correct,
          wrong,
          dropped,
          bestCombo
        }
      });
    }, 700);
  }


  /* ---------- START ---------- */

  later(() => {
    startedAt = performance.now();
    nextSpawnAt = startedAt;
    frame = requestAnimationFrame(loop);
  }, 300);


  return () => {
    finished = true;

    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    window.removeEventListener("keydown", onKey);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
