// GAMIQ（ゲーミック） v2 - Memory Games

import { t } from "../i18n.js";
import { byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createMemoryGames() {
  return [
    {
      id: "memory_sequence",
      type: "memory_sequence",
      title: "FLASH ORDER",
      rule: "WATCH THE ORDER, THEN TAP IT BACK!",
      skill: "MEMORY",
      theme: "cyber",
      duration: 10000
    },

    {
      id: "memory_positions",
      type: "memory_positions",
      title: "GHOST GRID",
      rule: "REMEMBER WHERE THE GHOSTS HIDE, THEN FIND THEM ALL!",
      skill: "MEMORY",
      theme: "haunted",
      duration: 9000
    },

    {
      id: "memory_numbers",
      type: "memory_numbers",
      title: "NUMBER TRACE",
      rule: "REMEMBER THE NUMBERS. TAP 1, 2, 3... IN ORDER!",
      skill: "MEMORY",
      theme: "logic",
      duration: 10000
    }
  ];
}


export function runMemoryGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  switch (game.type) {
    case "memory_sequence":
      return runSequenceMemory({
        container,
        onComplete,
        level: game.level
      });

    case "memory_positions":
      return runPositionMemory({
        container,
        onComplete,
        level: game.level
      });

    case "memory_numbers":
      return runNumberMemory({
        container,
        onComplete,
        level: game.level
      });

    default:
      return () => {};
  }
}


/* ==========================================
FLASH ORDER
========================================== */

function runSequenceMemory({
  container,
  onComplete,
  level = 1
}) {
  let active = true;
  let inputEnabled = false;
  let stopClock = null;

  const timers = [];

  const gridSize = 16;

  /*
   * DIFFICULTY BY LEVEL (Lv1 = same as before)
   * - Longer sequence (Lv1: 4-7, Lv10: 7-10)
   * - Faster flashes
   * - Less time per tile to answer
   */
  const flashOn = byLevelInt(level, 480, 330);
  const flashStep = byLevelInt(level, 700, 500);
  const msPerTile = byLevelInt(level, 900, 700);

  const sequenceLength =
    randomInt(byLevelInt(level, 4, 7), byLevelInt(level, 7, 10));

  const sequence =
    createUniqueRandomIndexes(
      gridSize,
      sequenceLength
    );

  let currentStep = 0;
  let correct = 0;

  const startedAt =
    performance.now();


  container.innerHTML = `
    <div class="memory-wrap">

      <div class="memory-top">
        <span>SEQUENCE</span>
        <strong>
          ${sequenceLength}
        </strong>
      </div>

      <div
        class="memory-grid"
        data-memory-grid
      ></div>

      <div
        class="memory-message"
        data-memory-message
      >
        ${t("memory.watch")}
      </div>

    </div>
  `;


  const grid =
    container.querySelector(
      "[data-memory-grid]"
    );

  const message =
    container.querySelector(
      "[data-memory-message]"
    );


  const cells =
    createGridCells(
      grid,
      gridSize
    );


  function schedule(
    callback,
    delay
  ) {
    const timer =
      setTimeout(
        callback,
        delay
      );

    timers.push(timer);
  }


  function showSequence() {
    let delay = 350;

    sequence.forEach(
      (index, position) => {

        schedule(
          () => {
            if (!active) {
              return;
            }

            cells[index]
              .classList.add(
                "memory-flash"
              );

            // Each tile has its own note
            sfx("note", index);

            // Show progress: WATCH 3 / 6
            message.textContent =
              `${t("memory.watch")} ${position + 1} / ${sequence.length}`;
          },
          delay
        );


        schedule(
          () => {
            if (!active) {
              return;
            }

            cells[index]
              .classList.remove(
                "memory-flash"
              );
          },
          delay + flashOn
        );


        delay += flashStep;


        if (
          position ===
          sequence.length - 1
        ) {
          schedule(
            () => {
              if (!active) {
                return;
              }

              inputEnabled = true;

              // Answer within the time limit or it is a fail.
              stopClock = startInputClock({
                message,
                label: t("memory.yourTurn"),
                limitMs: 3000 + sequence.length * msPerTile,
                onTimeout: () => finish(false)
              });
            },
            delay + 120
          );
        }
      }
    );
  }


  function pressCell(
    index
  ) {
    if (
      !active ||
      !inputEnabled
    ) {
      return;
    }


        // Ignore an accidental second tap on an already-correct cell.
    if (
      sequence
        .slice(0, currentStep)
        .includes(index)
    ) {
      return;
    }

    const expected =
      sequence[
        currentStep
      ];


    if (
      index ===
      expected
    ) {
      correct++;
      sfx("note", index);

      cells[index]
        .classList.add(
          "memory-correct"
        );


      schedule(
        () => {
          cells[index]
            ?.classList.remove(
              "memory-correct"
            );
        },
        180
      );


      currentStep++;


      if (
        currentStep >=
        sequence.length
      ) {
        finish(true);
      }

      return;
    }


    cells[index]
      .classList.add(
        "memory-wrong"
      );

    sfx("bad");

    finish(false);
  }


  cells.forEach(
    (cell, index) => {

      cell.addEventListener(
        "pointerdown",
        () => pressCell(index)
      );

    }
  );


  function finish(
    success
  ) {
    if (!active) {
      return;
    }

    active = false;
    inputEnabled = false;

    stopClock?.();


    const elapsed =
      performance.now() -
      startedAt;


    const accuracy =
      correct /
      sequence.length;


    const score =
      success
        ? clamp(
            85 +
            sequenceLength * 2.5 -
            Math.max(
              0,
              elapsed - 3500
            ) / 350,
            0,
            100
          )
        : clamp(
            accuracy * 80,
            0,
            80
          );


    onComplete?.({
      score:
        Math.round(score),

      adapt:
        Math.round(
          clamp(
            45 +
            accuracy * 50,
            0,
            100
          )
        ),

      meta: {
        success,
        sequenceLength,
        correct,
        elapsed:
          Math.round(elapsed)
      }
    });
  }


  showSequence();


  return () => {
    active = false;

    stopClock?.();

    timers.forEach(
      clearTimeout
    );
  };
}



/* ---------- GHOST GRID art ---------- */

const GHOST_SVG = `
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <path d="M20 92 L20 46 Q20 12 50 12 Q80 12 80 46 L80 92
             L70 84 L60 92 L50 84 L40 92 L30 84 Z"
          fill="#f4f1ff" stroke="#c9c2ff" stroke-width="2"/>
    <ellipse cx="39" cy="44" rx="6" ry="8" fill="#2a2140"/>
    <ellipse cx="61" cy="44" rx="6" ry="8" fill="#2a2140"/>
    <circle cx="41" cy="41" r="2" fill="#fff"/>
    <circle cx="63" cy="41" r="2" fill="#fff"/>
    <ellipse cx="50" cy="62" rx="6" ry="7" fill="#2a2140"/>
    <ellipse cx="30" cy="56" rx="5" ry="3" fill="#ffb3c8" opacity=".7"/>
    <ellipse cx="70" cy="56" rx="5" ry="3" fill="#ffb3c8" opacity=".7"/>
  </svg>
`;

/* ==========================================
GHOST GRID
========================================== */

function runPositionMemory({
  container,
  onComplete,
  level = 1
}) {
  let active = true;
  let inputEnabled = false;
  let stopClock = null;

  const timers = [];

  const gridSize = 16;

  /*
   * DIFFICULTY BY LEVEL (Lv1 = same as before)
   * - More lit tiles (Lv1: 4-7, Lv10: 7-9)
   * - Shorter look time
   * - Less time per tile to answer
   */
  const showMs = byLevelInt(level, 1350, 900);
  const msPerTile = byLevelInt(level, 1000, 800);

  const targetCount =
    randomInt(byLevelInt(level, 4, 7), byLevelInt(level, 7, 9));

  const targets =
    createUniqueRandomIndexes(
      gridSize,
      targetCount
    );

  const selected =
    new Set();

  let correct = 0;
  let wrong = 0;

  const startedAt =
    performance.now();


  container.innerHTML = `
    <div class="memory-wrap ghost-grid">

      <div class="memory-top">
        <span>GHOSTS</span>

        <strong>
          ${targetCount}
        </strong>
      </div>

      <div
        class="memory-grid"
        data-position-grid
      ></div>

      <div
        class="memory-message"
        data-position-message
      >
        ${t("ghost.watch")}
      </div>

    </div>
  `;


  const grid =
    container.querySelector(
      "[data-position-grid]"
    );

  const message =
    container.querySelector(
      "[data-position-message]"
    );


  const cells =
    createGridCells(
      grid,
      gridSize
    );


  // Every tile is a gravestone. Ghosts peek out from some of them...
  cells.forEach(cell => cell.classList.add("gg-grave"));

  targets.forEach(
    index => {
      showGhost(cells[index], "gg-peek");
    }
  );

  sfx("ghost");


  const hideTimer =
    setTimeout(
      () => {

        if (!active) {
          return;
        }


        // ...then hide behind them again.
        targets.forEach(
          index => {
            hideGhost(cells[index]);
          }
        );


        inputEnabled =
          true;


        stopClock = startInputClock({
          message,
          label: t("ghost.find"),
          limitMs: 3000 + targetCount * msPerTile,
          onTimeout: () => finish()
        });

      },
      showMs
    );


  timers.push(
    hideTimer
  );


  function showGhost(cell, mode) {
    cell.querySelector(".gg-ghost")?.remove();

    const ghost = document.createElement("span");
    ghost.className = `gg-ghost ${mode}`;
    ghost.innerHTML = GHOST_SVG;

    cell.appendChild(ghost);
  }

  function hideGhost(cell) {
    const ghost = cell.querySelector(".gg-ghost");

    if (!ghost) {
      return;
    }

    ghost.classList.add("gg-sink");

    const timer = setTimeout(() => ghost.remove(), 260);
    timers.push(timer);
  }

  function pressCell(
    index
  ) {
    if (
      !active ||
      !inputEnabled ||
      selected.has(index)
    ) {
      return;
    }


    selected.add(
      index
    );


    if (
      targets.includes(
        index
      )
    ) {
      // Found one! The ghost pops out.
      correct++;
      cells[index].classList.add("gg-found");
      showGhost(cells[index], "gg-caught");
      sfx("pop");
    } else {
      // Nobody here.
      wrong++;
      cells[index].classList.add("gg-empty");
      sfx("bad");
    }


    if (
      selected.size >=
      targetCount
    ) {
      finish();
    }
  }


  cells.forEach(
    (cell, index) => {

      cell.addEventListener(
        "pointerdown",
        () => pressCell(index)
      );

    }
  );


  function finish() {
    if (!active) {
      return;
    }

    active = false;

    stopClock?.();


    const elapsed =
      performance.now() -
      startedAt;


    const accuracy =
      correct /
      targetCount;


    const score =
      clamp(
        accuracy *
        100 -
        wrong * 5 -
        Math.max(
          0,
          elapsed - 3500
        ) /
        500,
        0,
        100
      );


    onComplete?.({
      score:
        Math.round(score),

      adapt:
        Math.round(
          clamp(
            40 +
            accuracy *
            55,
            0,
            100
          )
        ),

      meta: {
        targets:
          targetCount,
        correct,
        wrong,
        elapsed:
          Math.round(elapsed)
      }
    });
  }


  return () => {
    active = false;

    stopClock?.();

    timers.forEach(
      clearTimeout
    );
  };
}


/* ==========================================
NUMBER TRACE
========================================== */

function runNumberMemory({
  container,
  onComplete,
  level = 1
}) {
  let active = true;
  let inputEnabled = false;
  let stopClock = null;

  const gridSize = 16;

  /*
   * DIFFICULTY BY LEVEL (Lv1 = same as before)
   * - More numbers (Lv1: 4-6, Lv10: 7-9)
   * - Shorter look time
   * - Less time per number to answer
   */
  const showMs = byLevelInt(level, 1800, 1300);
  const msPerNumber = byLevelInt(level, 1000, 800);

  const numberCount =
    randomInt(byLevelInt(level, 4, 7), byLevelInt(level, 6, 9));

  const positions =
    createUniqueRandomIndexes(
      gridSize,
      numberCount
    );

  let nextNumber = 1;
  let correct = 0;
  let mistakes = 0;

  const startedAt =
    performance.now();


  container.innerHTML = `
    <div class="memory-wrap">

      <div class="memory-top">

        <span>ORDER</span>

        <strong>
          1 → ${numberCount}
        </strong>

      </div>

      <div
        class="memory-grid"
        data-number-grid
      ></div>

      <div
        class="memory-message"
        data-number-message
      >
        ${t("memory.remember")}
      </div>

    </div>
  `;


  const grid =
    container.querySelector(
      "[data-number-grid]"
    );

  const message =
    container.querySelector(
      "[data-number-message]"
    );


  const cells =
    createGridCells(
      grid,
      gridSize
    );


  positions.forEach(
    (index, position) => {

      cells[index]
        .classList.add(
          "memory-number-visible"
        );


      cells[index]
        .textContent =
          position + 1;

    }
  );


  const hideTimer =
    setTimeout(
      () => {

        if (!active) {
          return;
        }


        positions.forEach(
          index => {

            cells[index]
              .classList.remove(
                "memory-number-visible"
              );


            cells[index]
              .textContent = "";

          }
        );


        inputEnabled =
          true;


        stopClock = startInputClock({
          message,
          label: t("memory.tapInOrder"),
          limitMs: 3000 + numberCount * msPerNumber,
          onTimeout: () => finish(false)
        });

      },
      showMs
    );


  function pressCell(
    index
  ) {
    if (
      !active ||
      !inputEnabled
    ) {
      return;
    }


        // Ignore taps on cells that were already answered.
    if (
      cells[index].classList.contains(
        "memory-correct"
      ) ||
      cells[index].classList.contains(
        "memory-wrong"
      )
    ) {
      return;
    }

    const expectedIndex =
      positions[
        nextNumber - 1
      ];


    if (
      index ===
      expectedIndex
    ) {
      correct++;
      sfx("note", nextNumber);


      cells[index]
        .classList.add(
          "memory-correct"
        );


      cells[index]
        .textContent =
          nextNumber;


      nextNumber++;


      if (
        nextNumber >
        numberCount
      ) {
        finish(true);
      }

      return;
    }


    mistakes++;
    sfx("bad");


    cells[index]
      .classList.add(
        "memory-wrong"
      );


    if (
      mistakes >= 2
    ) {
      finish(false);
    }
  }


  cells.forEach(
    (cell, index) => {

      cell.addEventListener(
        "pointerdown",
        () => pressCell(index)
      );

    }
  );


  function finish(
    success
  ) {
    if (!active) {
      return;
    }


    active = false;

    stopClock?.();


    clearTimeout(
      hideTimer
    );


    const elapsed =
      performance.now() -
      startedAt;


    const accuracy =
      correct /
      numberCount;


    const score =
      success
        ? clamp(
            90 +
            numberCount * 2 -
            Math.max(
              0,
              elapsed - 4200
            ) / 400,
            0,
            100
          )
        : clamp(
            accuracy * 80 -
            mistakes * 8,
            0,
            80
          );


    onComplete?.({
      score:
        Math.round(score),

      adapt:
        Math.round(
          clamp(
            45 +
            accuracy * 50 -
            mistakes * 8,
            0,
            100
          )
        ),

      meta: {
        success,
        numberCount,
        correct,
        mistakes,
        elapsed:
          Math.round(elapsed)
      }
    });
  }


  return () => {
    active = false;

    stopClock?.();

    clearTimeout(
      hideTimer
    );
  };
}


/* ==========================================
INPUT TIME LIMIT (shared by the memory games)
Shows "LABEL · 7" and calls onTimeout when time runs out.
Returns a function that stops the clock.
========================================== */

function startInputClock({
  message,
  label,
  limitMs,
  onTimeout
}) {
  const endsAt =
    performance.now() + limitMs;

  let stopped = false;

  function render() {
    const left = Math.max(
      0,
      endsAt - performance.now()
    );

    message.textContent =
      `${label} · ${Math.ceil(left / 1000)}`;

    message.classList.toggle(
      "memory-time-danger",
      left <= 3000
    );

    return left;
  }

  render();

  const interval = setInterval(() => {
    if (stopped) {
      return;
    }

    if (render() <= 0) {
      stop();
      onTimeout?.();
    }
  }, 200);

  function stop() {
    stopped = true;
    clearInterval(interval);
    message.classList.remove("memory-time-danger");
  }

  return stop;
}


/* ==========================================
GRID
========================================== */

function createGridCells(
  grid,
  count
) {
  const cells = [];


  for (
    let i = 0;
    i < count;
    i++
  ) {
    const button =
      document.createElement(
        "button"
      );


    button.type =
      "button";


    button.className =
      "memory-cell";


    button.dataset.index =
      String(i);


    grid.appendChild(
      button
    );


    cells.push(
      button
    );
  }


  return cells;
}


/* ==========================================
UTIL
========================================== */

function createUniqueRandomIndexes(
  max,
  count
) {
  const values =
    Array.from(
      {
        length:
          max
      },
      (_, index) =>
        index
    );


  for (
    let i =
      values.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() *
        (
          i + 1
        )
      );


    [
      values[i],
      values[j]
    ] = [
      values[j],
      values[i]
    ];
  }


  return values.slice(
    0,
    count
  );
}


function randomInt(
  min,
  max
) {
  return Math.floor(
    Math.random() *
    (
      max -
      min +
      1
    )
  ) + min;
}


function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}
