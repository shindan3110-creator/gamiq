// GAMIQ（ゲーミック） v2 - Color Mix (color memory)
//
// COLOR MIX
// - A color is shown for a moment. Remember it!
// - Then it is hidden. Tap the paints to drop them on the palette
//   and mix the same color from memory.
// - The closer your color, the higher the score (match %).
// - 2 rounds.
// - Higher level: shorter look, more paints in the color.

import { t } from "../i18n.js";
import { byLevel, safeLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createColorMixGames() {
  return [
    {
      id: "memory_color_mix",
      type: "color_mix",
      title: "COLOR MIX",
      rule: "REMEMBER THE COLOR, THEN MIX IT WITH THE PAINTS!",
      skill: "MEMORY",
      theme: "atelier",
      duration: 35000
    }
  ];
}

export function runColorMixGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "color_mix") {
    return runColorMix({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
PAINT MIXING
Mixed like real paint (not like light):
yellow + blue = green.
========================================== */

const PAINTS = [
  { id: "red", rgb: [0.89, 0.12, 0.16] },
  { id: "yellow", rgb: [1.0, 0.86, 0.1] },
  { id: "blue", rgb: [0.1, 0.32, 0.86] },
  { id: "white", rgb: [1.0, 1.0, 1.0] },
  { id: "black", rgb: [0.09, 0.09, 0.11] }
];

// Mix = weighted geometric mean (works like paint)
function mix(drops) {
  const total = drops.reduce((sum, n) => sum + n, 0);
  if (!total) return null;

  return [0, 1, 2].map(ch => {
    let logSum = 0;

    drops.forEach((n, i) => {
      if (n) logSum += n * Math.log(Math.max(0.02, PAINTS[i].rgb[ch]));
    });

    return Math.exp(logSum / total);
  });
}

function css(rgb) {
  if (!rgb) return "transparent";
  return `rgb(${rgb.map(v => Math.round(v * 255)).join(",")})`;
}

// Color difference that matches how people see it (CIE Lab, ΔE)
function toLab(rgb) {
  const lin = rgb.map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));

  const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047;
  const y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
  const z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883;

  const f = v => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);

  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a, b) {
  const la = toLab(a);
  const lb = toLab(b);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

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

const ROUNDS = 2;
const ROUND_LIMIT_MS = 18000;

function runColorMix({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   look at the color: 2.6s (Lv1) -> 1.2s (Lv10)
   *   paints in the color: 2 (Lv1-4) -> 3 (Lv5-10), black only from Lv5
   *   drops of each: 1-3 (Lv1-7) -> 1-4 (Lv8-10)
   */
  const lv = safeLevel(level);
  const showMs = byLevel(level, 2600, 1200);
  const paintCount = lv <= 4 ? 2 : 3;
  const maxDrops = lv <= 7 ? 3 : 4;

  let finished = false;
  let round = 0;
  let phase = "show"; // show | mix | result
  let drops = [0, 0, 0, 0, 0];
  let target = null;
  let roundStartedAt = 0;
  let clockTimer = null;
  let timers = [];

  const results = [];

  container.innerHTML = `
    <div class="cx-game">

      <div class="cx-hud">
        <div>
          <span>ROUND</span>
          <strong data-cx-round>1 / ${ROUNDS}</strong>
        </div>
        <div>
          <span>MATCH</span>
          <strong data-cx-match>--</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong data-cx-time>${ROUND_LIMIT_MS / 1000}</strong>
        </div>
      </div>

      <div class="cx-stage">

        <div class="cx-swatches">
          <div class="cx-swatch">
            <div class="cx-target" data-cx-target><b>?</b></div>
            <span>${t("cx.sample")}</span>
          </div>
          <div class="cx-swatch">
            <div class="cx-mine" data-cx-mine></div>
            <span>${t("cx.yours")}</span>
          </div>
        </div>

        <div class="cx-message" data-cx-message></div>

        <div class="cx-bar"><i data-cx-bar></i></div>

        <div class="cx-paints" data-cx-paints>
          ${PAINTS.map((p, i) => `
            <button type="button" class="cx-paint" data-cx-paint="${i}" style="--paint:${css(p.rgb)}" disabled>
              <i></i>
              <span>${t(`cx.${p.id}`)}</span>
              <b data-cx-count="${i}"></b>
            </button>
          `).join("")}
        </div>

        <div class="cx-actions">
          <button type="button" class="cx-reset" data-cx-reset disabled>${t("cx.reset")}</button>
          <button type="button" class="cx-done" data-cx-done disabled>${t("cx.done")}</button>
        </div>

      </div>

    </div>
  `;

  const targetEl = container.querySelector("[data-cx-target]");
  const mineEl = container.querySelector("[data-cx-mine]");
  const messageEl = container.querySelector("[data-cx-message]");
  const barEl = container.querySelector("[data-cx-bar]");
  const roundEl = container.querySelector("[data-cx-round]");
  const matchEl = container.querySelector("[data-cx-match]");
  const timeEl = container.querySelector("[data-cx-time]");
  const paintButtons = [...container.querySelectorAll("[data-cx-paint]")];
  const countEls = [...container.querySelectorAll("[data-cx-count]")];
  const resetButton = container.querySelector("[data-cx-reset]");
  const doneButton = container.querySelector("[data-cx-done]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);

    timers.push(id);
  }

  function setEnabled(on) {
    paintButtons.forEach(b => (b.disabled = !on));
    resetButton.disabled = !on;
    doneButton.disabled = !on;
  }


  /* ---------- MAKE A COLOR ---------- */

  function makeTarget() {
    // Black only from Lv5. Never only white.
    const pool = lv <= 4 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];

    for (let tries = 0; tries < 30; tries++) {
      const chosen = shuffle(pool).slice(0, paintCount);

      if (chosen.every(i => i >= 3)) continue;

      const d = [0, 0, 0, 0, 0];
      chosen.forEach(i => {
        d[i] = 1 + Math.floor(Math.random() * maxDrops);
      });

      const rgb = mix(d);

      // Skip colors that are almost gray (boring and too hard)
      const max = Math.max(...rgb);
      const min = Math.min(...rgb);
      if (max - min < 0.12 && tries < 25) continue;

      return { rgb, drops: d };
    }

    return { rgb: mix([1, 1, 0, 0, 0]), drops: [1, 1, 0, 0, 0] };
  }


  /* ---------- ROUND ---------- */

  function startRound() {
    phase = "show";
    drops = [0, 0, 0, 0, 0];
    target = makeTarget();

    roundEl.textContent = `${round + 1} / ${ROUNDS}`;

    updateMine();
    setEnabled(false);

    targetEl.className = "cx-target show";
    targetEl.style.setProperty("--color", css(target.rgb));
    targetEl.innerHTML = "";

    messageEl.textContent = t("cx.look");
    messageEl.className = "cx-message";

    // Time bar for looking
    barEl.style.transition = "none";
    barEl.style.transform = "scaleX(1)";
    void barEl.offsetWidth;
    barEl.style.transition = `transform ${showMs}ms linear`;
    barEl.style.transform = "scaleX(0)";

    sfx("tick");

    later(startMix, showMs);
  }

  function startMix() {
    phase = "mix";

    // Hide the sample
    targetEl.className = "cx-target hidden";
    targetEl.innerHTML = "<b>?</b>";

    messageEl.textContent = t("cx.mix");

    setEnabled(true);
    sfx("whoosh");

    roundStartedAt = performance.now();
    clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 200);
  }

  function updateMine() {
    const rgb = mix(drops);

    mineEl.style.setProperty("--color", css(rgb));
    mineEl.classList.toggle("empty", !rgb);

    countEls.forEach((el, i) => {
      el.textContent = drops[i] ? String(drops[i]) : "";
    });
  }

  function addDrop(i) {
    if (phase !== "mix") return;

    // Up to 12 drops in total (keeps it simple)
    if (drops.reduce((s, n) => s + n, 0) >= 12) {
      messageEl.textContent = t("cx.full");
      return;
    }

    drops[i]++;
    updateMine();

    mineEl.classList.remove("drip");
    void mineEl.offsetWidth;
    mineEl.classList.add("drip");

    sfx("click");
  }

  function resetDrops() {
    if (phase !== "mix") return;

    drops = [0, 0, 0, 0, 0];
    updateMine();
    messageEl.textContent = t("cx.mix");
  }

  function submit(timeUp = false) {
    if (phase !== "mix") return;

    phase = "result";
    setEnabled(false);
    clearInterval(clockTimer);

    const mine = mix(drops);

    let match = 0;

    if (mine) {
      // ΔE 0 = 100%, about ΔE 60 = 0%
      match = clamp(100 - deltaE(mine, target.rgb) * 1.65, 0, 100);
    }

    results.push(match);

    // Show both colors
    targetEl.className = "cx-target show";
    targetEl.innerHTML = "";

    matchEl.textContent = `${Math.round(match)}%`;

    const kind = match >= 90 ? "perfect" : match >= 75 ? "good" : "bad";

    messageEl.className = `cx-message result ${kind}`;
    messageEl.innerHTML = timeUp && !mine
      ? t("cx.timeUp")
      : `<b>${match.toFixed(1)}%</b> ${t(`cx.${kind}`)}`;

    sfx(kind === "perfect" ? "perfect" : kind === "good" ? "good" : "bad");

    round++;

    later(() => {
      if (round < ROUNDS) startRound();
      else finish();
    }, 2200);
  }

  paintButtons.forEach((button, i) => {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      addDrop(i);
    });
  });

  resetButton.addEventListener("click", resetDrops);
  doneButton.addEventListener("click", () => submit(false));


  /* ---------- CLOCK ---------- */

  function updateClock() {
    const left = Math.max(0, ROUND_LIMIT_MS - (performance.now() - roundStartedAt));

    timeEl.textContent = String(Math.ceil(left / 1000));
    timeEl.classList.toggle("danger", left <= 5000);

    if (left <= 0) submit(true);
  }


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;

    finished = true;

    clearInterval(clockTimer);
    timers.forEach(clearTimeout);

    const avg = results.reduce((s, v) => s + v, 0) / ROUNDS;

    // 50% match is about 0 points, 95%+ is full
    const score = clamp(((avg - 50) / 45) * 100, 0, 100);

    setTimeout(() => {
      onComplete?.({
        score: Math.round(score),

        adapt: Math.round(clamp(40 + score * 0.4 + ((results[1] ?? 0) - (results[0] ?? 0)) * 0.3, 0, 100)),

        meta: {
          success: avg >= 80,
          match: Math.round(avg * 10) / 10,
          rounds: results.length
        }
      });
    }, 300);
  }


  /* ---------- START ---------- */

  // A little extra wait: the "GO!" flash would cover the sample
  later(startRound, 700);


  return () => {
    finished = true;

    clearInterval(clockTimer);
    timers.forEach(clearTimeout);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
