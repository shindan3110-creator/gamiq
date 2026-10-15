// GAMIQ（ゲーミック） v2 - Speed Games

import { t } from "../i18n.js";


export function createSpeedGames() {
  return [
    {
      id: "speed_color_switch",
      type: "color_switch",
      title: "COLOR SWITCH",
      rule: "MATCH THE COLOR OR THE WORD. WATCH FOR THE SWITCH!",
      skill: "SPEED",
      theme: "cyber",
      duration: 20000
    }
  ];
}


export function runSpeedGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  switch (game.type) {
    case "color_switch":
      return runColorSwitch({
        container,
        onComplete
      });

    default:
      return () => {};
  }
}


/* ==========================================
COLOR SWITCH
- A color word is shown in a (usually different) ink color.
- COLOR mode: tap the button of the INK color.
- WORD mode:  tap the button of the color the WORD says.
- The mode switches every few answers.
- 20 seconds. Answer as many as you can.
- Wrong answers cost points and lock the buttons briefly,
  so mashing does not work.
========================================== */

const CS_TIME_LIMIT = 20000;
const CS_GOOD_SCORE = 22; // correct answers for ~100 points

const CS_COLORS = [
  { id: "red", hex: "#ff4d6a" },
  { id: "blue", hex: "#3fa9ff" },
  { id: "green", hex: "#3ee089" },
  { id: "yellow", hex: "#ffd43b" }
];


function runColorSwitch({
  container,
  onComplete
}) {
  let active = true;

  let mode = "color";
  let answersUntilSwitch = randomInt(3, 5);

  let correct = 0;
  let wrong = 0;
  let streak = 0;
  let bestStreak = 0;

  let current = null;
  let shownAt = 0;
  let locked = false;

  const reactions = [];

  let clockTimer = null;
  let lockTimer = null;
  let finishTimer = null;

  const startedAt = performance.now();


  container.innerHTML = `
    <div class="cs-game">

      <div class="cs-hud">
        <div>
          <span>TIME</span>
          <strong data-cs-time>${CS_TIME_LIMIT / 1000}</strong>
        </div>

        <div>
          <span>SCORE</span>
          <strong data-cs-score>0</strong>
        </div>

        <div>
          <span>STREAK</span>
          <strong data-cs-streak>0</strong>
        </div>
      </div>

      <div class="cs-stage" data-cs-stage>

        <div class="cs-mode" data-cs-mode></div>

        <div class="cs-word" data-cs-word></div>

        <div class="cs-feedback" data-cs-feedback></div>

      </div>

      <div class="cs-buttons" data-cs-buttons>
        ${CS_COLORS.map(color => `
          <button
            type="button"
            class="cs-button"
            data-cs-color="${color.id}"
            style="--cs-color:${color.hex}"
            aria-label="${t(`color.${color.id}`)}"
          ></button>
        `).join("")}
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-cs-stage]");
  const modeElement = container.querySelector("[data-cs-mode]");
  const wordElement = container.querySelector("[data-cs-word]");
  const feedbackElement = container.querySelector("[data-cs-feedback]");
  const timeElement = container.querySelector("[data-cs-time]");
  const scoreElement = container.querySelector("[data-cs-score]");
  const streakElement = container.querySelector("[data-cs-streak]");
  const buttons = [...container.querySelectorAll("[data-cs-color]")];


  /* ---------- QUESTION ---------- */

  function renderMode(switched) {
    modeElement.textContent =
      mode === "color"
        ? t("cs.modeColor")
        : t("cs.modeWord");

    modeElement.className =
      `cs-mode ${mode}`;

    if (switched) {
      stage.classList.remove("cs-switch");
      void stage.offsetWidth;
      stage.classList.add("cs-switch");
    }
  }

  function nextQuestion() {
    const word = pick(CS_COLORS);

    // Ink usually differs from the word, so you must really read the rule.
    const ink =
      Math.random() < 0.8
        ? pick(CS_COLORS.filter(color => color.id !== word.id))
        : word;

    current = { word, ink };

    wordElement.textContent =
      t(`color.${word.id}`);

    wordElement.style.color =
      ink.hex;

    wordElement.classList.remove("pop");
    void wordElement.offsetWidth;
    wordElement.classList.add("pop");

    shownAt = performance.now();
  }


  /* ---------- ANSWER ---------- */

  function answer(colorId) {
    if (!active || locked || !current) {
      return;
    }

    const expected =
      mode === "color"
        ? current.ink.id
        : current.word.id;

    if (colorId === expected) {
      correct++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);

      reactions.push(performance.now() - shownAt);

      showFeedback("✓", "good");

    } else {
      wrong++;
      streak = 0;

      showFeedback("✕", "bad");

      // Short lock: random mashing is not worth it.
      locked = true;
      container.classList.add("cs-locked");

      lockTimer = setTimeout(() => {
        locked = false;
        container.classList.remove("cs-locked");
      }, 350);
    }

    scoreElement.textContent = String(correct);
    streakElement.textContent = String(streak);

    answersUntilSwitch--;

    if (answersUntilSwitch <= 0) {
      mode = mode === "color" ? "word" : "color";
      answersUntilSwitch = randomInt(3, 5);
      renderMode(true);
    }

    nextQuestion();
  }

  function showFeedback(text, type) {
    feedbackElement.textContent = text;
    feedbackElement.className = `cs-feedback ${type}`;

    void feedbackElement.offsetWidth;

    feedbackElement.classList.add("show");
  }

  function onButton(event) {
    event.preventDefault();

    answer(event.currentTarget.dataset.csColor);
  }

  // PC: number keys 1-4 also work (same order as the buttons).
  function onKey(event) {
    const index = ["1", "2", "3", "4"].indexOf(event.key);

    if (index !== -1) {
      event.preventDefault();
      answer(CS_COLORS[index].id);
    }
  }


  /* ---------- TIMER / FINISH ---------- */

  clockTimer = setInterval(() => {
    if (!active) {
      return;
    }

    const left = Math.max(
      0,
      CS_TIME_LIMIT - (performance.now() - startedAt)
    );

    timeElement.textContent = String(Math.ceil(left / 1000));
    timeElement.classList.toggle("danger", left <= 5000);

    if (left <= 0) {
      finish();
    }
  }, 100);

  function finish() {
    if (!active) {
      return;
    }

    active = false;

    clearInterval(clockTimer);
    clearTimeout(lockTimer);

    container.classList.add("cs-done");

    const answered = correct + wrong;

    const accuracy =
      answered > 0
        ? correct / answered
        : 0;

    // Each wrong answer cancels 1.5 correct ones.
    const perf =
      correct - wrong * 1.5;

    const score =
      clamp(perf / CS_GOOD_SCORE * 100, 0, 100);

    const success =
      correct >= 12 &&
      accuracy >= 0.8;

    const avgReaction =
      reactions.length
        ? reactions.reduce((sum, value) => sum + value, 0) / reactions.length
        : 0;

    wordElement.textContent = "TIME UP";
    wordElement.style.color = "#ffffff";

    finishTimer = setTimeout(() => {
      onComplete?.({
        score: Math.round(score),

        adapt: Math.round(
          clamp(35 + accuracy * 45 + Math.min(1, bestStreak / 10) * 20, 0, 100)
        ),

        meta: {
          success,
          correct,
          wrong,
          bestStreak,
          accuracy: Math.round(accuracy * 100),
          avgReaction: Math.round(avgReaction)
        }
      });
    }, 450);
  }


  /* ---------- START ---------- */

  buttons.forEach(button => {
    button.addEventListener("pointerdown", onButton);
  });

  window.addEventListener("keydown", onKey);

  renderMode(false);
  nextQuestion();


  return () => {
    active = false;

    clearInterval(clockTimer);
    clearTimeout(lockTimer);
    clearTimeout(finishTimer);

    buttons.forEach(button => {
      button.removeEventListener("pointerdown", onButton);
    });

    window.removeEventListener("keydown", onKey);
  };
}


/* ==========================================
UTIL
========================================== */

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
