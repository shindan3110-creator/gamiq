// GAMIQ（ゲーミック） v2 - Blind Stop (stopwatch)
//
// BLIND STOP
// - A stopwatch starts. Stop it exactly at the target time.
// - Partway through, the numbers disappear: count in your head!
// - 3 rounds. The target time is random.
// - Higher level: longer target (up to 20s), numbers vanish sooner.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createStopwatchGames() {
  return [
    {
      id: "reflex_blind_stop",
      type: "blind_stop",
      title: "BLIND STOP",
      rule: "STOP THE WATCH EXACTLY ON TIME. THE NUMBERS WILL VANISH!",
      skill: "REFLEX",
      theme: "lab",
      duration: 30000,
      // 3 long rounds at the top level can take a while
      maxDuration: 120000
    }
  ];
}

export function runStopwatchGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "blind_stop") {
    return runBlindStop({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const ROUNDS = 3;

function runBlindStop({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   target time: 3-6s (Lv1) -> 8-20s (Lv10)
   *   numbers visible for: 60% of the target (Lv1) -> 20% (Lv10)
   */
  const minTarget = Math.min(10, byLevel(level, 3, 8));
  const maxTarget = Math.min(22, byLevel(level, 6, 20));
  const visibleRate = Math.max(0.06, byLevel(level, 0.6, 0.2));

  let finished = false;
  let round = 0;
  let running = false;
  let startedAt = 0;
  let target = 0;
  let hideAt = 0;
  let frame = 0;
  let timers = [];

  const results = [];


  container.innerHTML = `
    <div class="sw-game">

      <div class="sw-hud">
        <div>
          <span>ROUND</span>
          <strong data-sw-round>1 / ${ROUNDS}</strong>
        </div>
        <div>
          <span>SCORE</span>
          <strong data-sw-score>0</strong>
        </div>
      </div>

      <div class="sw-stage" data-sw-stage>

        <div class="sw-target">
          <span>TARGET</span>
          <strong data-sw-target>0.00</strong>
        </div>

        <div class="sw-face" data-sw-face>
          <div class="sw-digits" data-sw-digits>0.00</div>
          <div class="sw-blind" aria-hidden="true">?.??</div>
        </div>

        <div class="sw-result" data-sw-result></div>

        <div class="sw-dots" data-sw-dots>
          ${Array.from({ length: ROUNDS }, () => "<i></i>").join("")}
        </div>
      </div>

      <button type="button" class="sw-button" data-sw-button disabled>
        ${t("sw.wait")}
      </button>

    </div>
  `;

  const stage = container.querySelector("[data-sw-stage]");
  const face = container.querySelector("[data-sw-face]");
  const digits = container.querySelector("[data-sw-digits]");
  const targetEl = container.querySelector("[data-sw-target]");
  const resultEl = container.querySelector("[data-sw-result]");
  const roundEl = container.querySelector("[data-sw-round]");
  const scoreEl = container.querySelector("[data-sw-score]");
  const dots = [...container.querySelectorAll("[data-sw-dots] i")];
  const button = container.querySelector("[data-sw-button]");

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (!finished) fn();
    }, ms);

    timers.push(id);
  }

  function format(seconds) {
    return seconds.toFixed(2);
  }


  /* ---------- ROUND ---------- */

  function startRound() {
    // Random target, rounded to 0.01s
    target = Math.round((minTarget + Math.random() * (maxTarget - minTarget)) * 100) / 100;
    hideAt = target * visibleRate;

    roundEl.textContent = `${round + 1} / ${ROUNDS}`;
    targetEl.textContent = format(target);
    digits.textContent = format(0);
    resultEl.textContent = "";
    resultEl.className = "sw-result";

    face.classList.remove("hidden", "stopped", "perfect", "great", "good", "miss");

    button.disabled = true;
    button.textContent = t("sw.ready");

    sfx("tick");

    later(() => {
      running = true;
      startedAt = performance.now();

      button.disabled = false;
      button.textContent = "STOP";

      face.classList.add("running");

      tick();
    }, 900);
  }

  function tick() {
    if (!running || finished) return;

    const elapsed = (performance.now() - startedAt) / 1000;

    if (elapsed >= hideAt && !face.classList.contains("hidden")) {
      face.classList.add("hidden");
      sfx("whoosh");
    }

    digits.textContent = format(elapsed);

    // Never stopped: give up after a while
    if (elapsed > target + Math.max(3, target * 0.5)) {
      stop(true);
      return;
    }

    frame = requestAnimationFrame(tick);
  }

  function stop(timeout = false) {
    if (!running || finished) return;

    running = false;
    cancelAnimationFrame(frame);

    const stoppedAt = (performance.now() - startedAt) / 1000;
    const error = Math.abs(stoppedAt - target);

    // Longer targets get a little more room
    const tolerance = 0.5 + target * 0.06;
    const points = timeout ? 0 : Math.round(100 * Math.max(0, 1 - error / tolerance));

    results.push({ target, stoppedAt, error, points });

    // Show the real time
    digits.textContent = format(stoppedAt);
    face.classList.remove("running", "hidden");
    face.classList.add("stopped");

    const diff = stoppedAt - target;
    const sign = diff >= 0 ? "+" : "−";

    let rating;
    if (timeout) rating = "miss";
    else if (error < 0.05) rating = "perfect";
    else if (error < 0.15) rating = "great";
    else if (error < 0.4) rating = "good";
    else rating = "miss";

    face.classList.add(rating);

    resultEl.className = `sw-result ${rating}`;
    resultEl.innerHTML = timeout
      ? `<b>${t("sw.timeout")}</b>`
      : `<b>${rating.toUpperCase()}</b><span>${sign}${format(Math.abs(diff))}s</span>`;

    dots[round]?.classList.add(rating);

    sfx(rating === "perfect" ? "perfect" : rating === "miss" ? "bad" : "good");

    const total = results.reduce((sum, r) => sum + r.points, 0);
    scoreEl.textContent = String(Math.round(total / results.length));

    button.disabled = true;
    button.textContent = round + 1 < ROUNDS ? t("sw.next") : t("sw.done");

    round++;

    later(() => {
      if (round < ROUNDS) startRound();
      else finish();
    }, 1700);
  }


  /* ---------- INPUT ---------- */

  function onPress(event) {
    if (!running) return;

    event.preventDefault();
    stop(false);
  }

  button.addEventListener("pointerdown", onPress);
  stage.addEventListener("pointerdown", onPress);

  function onKey(event) {
    if (event.code === "Space" || event.code === "Enter") {
      onPress(event);
    }
  }

  window.addEventListener("keydown", onKey);


  /* ---------- FINISH ---------- */

  function finish() {
    if (finished) return;

    finished = true;
    running = false;

    timers.forEach(clearTimeout);
    window.removeEventListener("keydown", onKey);

    const total = results.reduce((sum, r) => sum + r.points, 0);
    const score = Math.round(total / ROUNDS);

    const avgError = results.length
      ? results.reduce((sum, r) => sum + r.error, 0) / results.length
      : 0;

    // ADAPT: did the player get better over the rounds?
    const firstHalf = results[0]?.points ?? 0;
    const last = results.at(-1)?.points ?? 0;

    setTimeout(() => {
      onComplete?.({
        score,

        adapt: Math.round(clamp(40 + score * 0.45 + (last - firstHalf) * 0.15, 0, 100)),

        meta: {
          success: score >= 60,
          rounds: results.length,
          avgErrorMs: Math.round(avgError * 1000),
          best: Math.max(0, ...results.map(r => r.points))
        }
      });
    }, 300);
  }


  /* ---------- START ---------- */

  later(startRound, 200);


  return () => {
    finished = true;
    running = false;

    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    window.removeEventListener("keydown", onKey);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
