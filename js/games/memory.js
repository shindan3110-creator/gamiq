// GAMIQ（ゲーミック） v2 - Memory Games

export function createMemoryGames() {
  return [
    {
      id: "memory_sequence",
      type: "memory_sequence",
      title: "FLASH ORDER",
      rule: "光った順番を覚えて、その順に押せ",
      skill: "MEMORY",
      theme: "cyber",
      duration: 10000
    },

    {
      id: "memory_positions",
      type: "memory_positions",
      title: "GHOST GRID",
      rule: "光った場所を覚えて、すべて選べ",
      skill: "MEMORY",
      theme: "space",
      duration: 9000
    },

    {
      id: "memory_numbers",
      type: "memory_numbers",
      title: "NUMBER TRACE",
      rule: "数字の位置を覚えて、1から順番に押せ",
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
        onComplete
      });

    case "memory_positions":
      return runPositionMemory({
        container,
        onComplete
      });

    case "memory_numbers":
      return runNumberMemory({
        container,
        onComplete
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
  onComplete
}) {
  let active = true;
  let inputEnabled = false;

  const timers = [];

  const gridSize = 16;

  const sequenceLength =
    randomInt(4, 7);

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
        WATCH
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
          delay + 360
        );


        delay += 560;


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

              message.textContent =
                "YOUR TURN";
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


    const expected =
      sequence[
        currentStep
      ];


    if (
      index ===
      expected
    ) {
      correct++;

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

    timers.forEach(
      clearTimeout
    );
  };
}


/* ==========================================
GHOST GRID
========================================== */

function runPositionMemory({
  container,
  onComplete
}) {
  let active = true;
  let inputEnabled = false;

  const timers = [];

  const gridSize = 16;

  const targetCount =
    randomInt(4, 7);

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
    <div class="memory-wrap">

      <div class="memory-top">
        <span>TARGETS</span>

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
        REMEMBER
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


  targets.forEach(
    index => {
      cells[index]
        .classList.add(
          "memory-target"
        );
    }
  );


  const hideTimer =
    setTimeout(
      () => {

        if (!active) {
          return;
        }


        targets.forEach(
          index => {
            cells[index]
              .classList.remove(
                "memory-target"
              );
          }
        );


        inputEnabled =
          true;


        message.textContent =
          "SELECT";

      },
      1350
    );


  timers.push(
    hideTimer
  );


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
      correct++;

      cells[index]
        .classList.add(
          "memory-correct"
        );

    } else {
      wrong++;

      cells[index]
        .classList.add(
          "memory-wrong"
        );
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
  onComplete
}) {
  let active = true;
  let inputEnabled = false;

  const gridSize = 16;

  const numberCount =
    randomInt(4, 6);

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
        REMEMBER
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


        message.textContent =
          "1から順番に";

      },
      1800
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


    const expectedIndex =
      positions[
        nextNumber - 1
      ];


    if (
      index ===
      expectedIndex
    ) {
      correct++;


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

    clearTimeout(
      hideTimer
    );
  };
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
