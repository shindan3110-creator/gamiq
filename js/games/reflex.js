// GAMIQ（ゲーミック） v2 - Reflex Games

export function createReflexGames() {
  return [
    {
      id: "reflex_quick_draw",
      type: "reflex_quick_draw",
      title: "QUICK DRAW",
      rule: "合図が出た瞬間に撃て",
      skill: "REFLEX",
      theme: "western",
      duration: 8000
    },

    {
      id: "reflex_ninja_strike",
      type: "reflex_quick_draw",
      title: "NINJA STRIKE",
      rule: "敵が動いた瞬間に斬れ",
      skill: "REFLEX",
      theme: "ninja",
      duration: 8000
    },

    {
      id: "reflex_space_duel",
      type: "reflex_quick_draw",
      title: "SPACE DUEL",
      rule: "敵艦が発光した瞬間に反撃",
      skill: "REFLEX",
      theme: "space",
      duration: 8000
    },

    {
      id: "reflex_go_no_go",
      type: "reflex_go_no_go",
      title: "FRIEND OR FOE",
      rule: "敵だけ撃て。味方は撃つな",
      skill: "REFLEX",
      theme: "cyber",
      duration: 9000
    }
  ];
}


export function runReflexGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  if (
    game.type ===
    "reflex_quick_draw"
  ) {
    return runQuickDraw({
      game,
      container,
      onComplete
    });
  }

  if (
    game.type ===
    "reflex_go_no_go"
  ) {
    return runGoNoGo({
      game,
      container,
      onComplete
    });
  }

  return () => {};
}


function runQuickDraw({
  game,
  container,
  onComplete
}) {
  let active = true;
  let ready = false;

  let signalTime = 0;

  let round = 0;
  let falseStarts = 0;

  const scores = [];

  const maxRounds = 5;

  container.innerHTML = `
    <div class="reflex-stage">

      <div
        class="reflex-scene"
        data-reflex-scene
      >

        <div
          class="reflex-enemy"
          data-reflex-enemy
        >
          ?
        </div>

        <div
          class="reflex-status"
          data-reflex-status
        >
          WAIT
        </div>

      </div>

    </div>
  `;

  const scene =
    container.querySelector(
      "[data-reflex-scene]"
    );

  const enemy =
    container.querySelector(
      "[data-reflex-enemy]"
    );

  const status =
    container.querySelector(
      "[data-reflex-status]"
    );

  const symbols = {
    western: "🤠",
    ninja: "🥷",
    space: "🛸",
    cyber: "🤖"
  };

  enemy.textContent =
    symbols[game.theme] || "🎯";


  let timer = null;

  function startRound() {
    if (!active) {
      return;
    }

    ready = false;

    status.textContent =
      "WAIT";

    scene.classList.remove(
      "reflex-ready"
    );

    const delay =
      700 +
      Math.random() * 1500;

    timer =
      setTimeout(
        () => {
          if (!active) {
            return;
          }

          ready = true;

          signalTime =
            performance.now();

          status.textContent =
            "NOW!";

          scene.classList.add(
            "reflex-ready"
          );
        },
        delay
      );
  }


  function press() {
    if (!active) {
      return;
    }

    if (!ready) {
      falseStarts++;

      scores.push(0);

      status.textContent =
        "TOO EARLY";

      scene.classList.add(
        "reflex-fail"
      );

      setTimeout(
        () => {
          scene.classList.remove(
            "reflex-fail"
          );

          round++;

          nextOrFinish();
        },
        450
      );

      clearTimeout(timer);

      return;
    }

    const reaction =
      performance.now() -
      signalTime;

    ready = false;

    const score =
      clamp(
        100 -
        (reaction - 170) / 5,
        0,
        100
      );

    scores.push(score);

    status.textContent =
      `${Math.round(reaction)} ms`;

    scene.classList.remove(
      "reflex-ready"
    );

    scene.classList.add(
      "reflex-hit"
    );

    setTimeout(
      () => {
        scene.classList.remove(
          "reflex-hit"
        );

        round++;

        nextOrFinish();
      },
      450
    );
  }


  function nextOrFinish() {
    if (!active) {
      return;
    }

    if (round >= maxRounds) {
      finish();
      return;
    }

    startRound();
  }


  function finish() {
    if (!active) {
      return;
    }

    active = false;

    clearTimeout(timer);

    const averageScore =
      scores.length
        ? scores.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / scores.length
        : 0;

    const adapt =
      calculateAdapt(scores);

    onComplete?.({
      score:
        Math.round(
          averageScore
        ),

      adapt:
        Math.round(adapt),

      meta: {
        falseStarts,
        rounds:
          scores.length
      }
    });
  }


  scene.addEventListener(
    "pointerdown",
    press
  );


  startRound();


  return () => {
    active = false;

    clearTimeout(timer);

    scene.removeEventListener(
      "pointerdown",
      press
    );
  };
}


function runGoNoGo({
  game,
  container,
  onComplete
}) {
  let active = true;

  let hits = 0;
  let misses = 0;
  let wrong = 0;

  let round = 0;

  const maxRounds = 8;

  let currentEnemy = false;

  const scores = [];

  container.innerHTML = `
    <div class="reflex-stage">

      <div
        class="reflex-scene"
        data-gng-scene
      >

        <div
          class="reflex-enemy"
          data-gng-target
        >
          ?
        </div>

        <div
          class="reflex-status"
          data-gng-status
        >
          READY
        </div>

      </div>

    </div>
  `;

  const scene =
    container.querySelector(
      "[data-gng-scene]"
    );

  const target =
    container.querySelector(
      "[data-gng-target]"
    );

  const status =
    container.querySelector(
      "[data-gng-status]"
    );


  let timer = null;


  function showNext() {
    if (!active) {
      return;
    }

    currentEnemy =
      Math.random() > 0.45;

    target.textContent =
      currentEnemy
        ? "👾"
        : "🧑‍🚀";

    status.textContent =
      currentEnemy
        ? "ENEMY"
        : "FRIEND";

    scene.classList.toggle(
      "reflex-ready",
      currentEnemy
    );

    timer =
      setTimeout(
        () => {
          if (!active) {
            return;
          }

          if (currentEnemy) {
            misses++;

            scores.push(25);
          } else {
            scores.push(85);
          }

          round++;

          nextOrFinish();
        },
        800
      );
  }


  function press() {
    if (!active) {
      return;
    }

    clearTimeout(timer);

    if (currentEnemy) {
      hits++;

      scores.push(100);

      status.textContent =
        "HIT";

      scene.classList.add(
        "reflex-hit"
      );
    } else {
      wrong++;

      scores.push(0);

      status.textContent =
        "WRONG";

      scene.classList.add(
        "reflex-fail"
      );
    }

    setTimeout(
      () => {
        scene.classList.remove(
          "reflex-hit",
          "reflex-fail"
        );

        round++;

        nextOrFinish();
      },
      300
    );
  }


  function nextOrFinish() {
    if (!active) {
      return;
    }

    if (round >= maxRounds) {
      finish();
      return;
    }

    showNext();
  }


  function finish() {
    active = false;

    clearTimeout(timer);

    const score =
      scores.length
        ? scores.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / scores.length
        : 0;

    onComplete?.({
      score:
        Math.round(score),

      adapt:
        Math.round(
          calculateAdapt(
            scores
          )
        ),

      meta: {
        hits,
        misses,
        wrong
      }
    });
  }


  scene.addEventListener(
    "pointerdown",
    press
  );


  showNext();


  return () => {
    active = false;

    clearTimeout(timer);

    scene.removeEventListener(
      "pointerdown",
      press
    );
  };
}


function calculateAdapt(series) {
  if (!series.length) {
    return 50;
  }

  if (series.length < 4) {
    return clamp(
      40 +
      average(series) * 0.25,
      25,
      75
    );
  }

  const split =
    Math.max(
      1,
      Math.floor(
        series.length / 3
      )
    );

  const first =
    average(
      series.slice(0, split)
    );

  const last =
    average(
      series.slice(-split)
    );

  return clamp(
    50 +
    (last - first) * 0.8,
    0,
    100
  );
}


function average(values) {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    values.length
  );
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
