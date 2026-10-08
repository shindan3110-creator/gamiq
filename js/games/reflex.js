// GAMIQ（ゲーミック） v2 - Advanced Reflex Games

export function createReflexGames() {
  return [
    {
      id: "reflex_ninja_counter",
      type: "ninja_counter",
      title: "NINJA COUNTER",
      rule: "攻撃方向を見極めて瞬時に迎撃しろ",
      skill: "REFLEX",
      theme: "ninja",
      duration: 12000
    },

    {
      id: "reflex_quick_draw",
      type: "quick_draw",
      title: "QUICK DRAW",
      rule: "フェイントに騙されずDRAWの瞬間だけ撃て",
      skill: "REFLEX",
      theme: "western",
      duration: 12000
    },

    {
      id: "reflex_lane_panic",
      type: "lane_panic",
      title: "LANE PANIC",
      rule: "迫る障害物を見て安全なレーンへ逃げろ",
      skill: "REFLEX",
      theme: "cyber",
      duration: 12000
    },

    {
      id: "reflex_friend_foe",
      type: "friend_foe",
      title: "FRIEND OR FOE",
      rule: "3体の中から敵だけを瞬時に撃て",
      skill: "REFLEX",
      theme: "space",
      duration: 12000
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

  switch (game.type) {
    case "ninja_counter":
      return runNinjaCounter({
        container,
        onComplete
      });

    case "quick_draw":
      return runQuickDraw({
        container,
        onComplete
      });

    case "lane_panic":
      return runLanePanic({
        container,
        onComplete
      });

    case "friend_foe":
      return runFriendOrFoe({
        container,
        onComplete
      });

    default:
      return () => {};
  }
}


/* ==========================================
NINJA COUNTER
========================================== */

function runNinjaCounter({
  container,
  onComplete
}) {
  let active = true;

  let round = 0;
  let correct = 0;
  let misses = 0;
  let combo = 0;
  let maxCombo = 0;

  const rounds = 7;

  let answer = null;
  let reactionStartedAt = 0;

  const reactionTimes = [];

  let timer = null;


  container.innerHTML = `
    <div class="reflex-game reflex-ninja-game">

      <div class="reflex-game-hud">
        <span>COMBO</span>
        <strong data-ninja-combo>0</strong>
      </div>

      <div
        class="ninja-arena"
        data-ninja-arena
      >
        <div
          class="ninja-danger ninja-danger-top"
          data-danger="UP"
        >
          ↓
        </div>

        <div
          class="ninja-danger ninja-danger-left"
          data-danger="LEFT"
        >
          →
        </div>

        <div
          class="ninja-danger ninja-danger-right"
          data-danger="RIGHT"
        >
          ←
        </div>

        <div
          class="ninja-player"
          data-ninja-player
        >
          🥷
        </div>

        <div
          class="reflex-impact"
          data-ninja-impact
        ></div>
      </div>

      <div class="ninja-controls">

        <button
          type="button"
          data-ninja-answer="LEFT"
        >
          ←
        </button>

        <button
          type="button"
          data-ninja-answer="UP"
        >
          ↑
        </button>

        <button
          type="button"
          data-ninja-answer="RIGHT"
        >
          →
        </button>

      </div>

    </div>
  `;


  const arena =
    container.querySelector(
      "[data-ninja-arena]"
    );

  const player =
    container.querySelector(
      "[data-ninja-player]"
    );

  const comboElement =
    container.querySelector(
      "[data-ninja-combo]"
    );

  const impact =
    container.querySelector(
      "[data-ninja-impact]"
    );

  const dangerElements =
    [...container.querySelectorAll(
      "[data-danger]"
    )];

  const buttons =
    [...container.querySelectorAll(
      "[data-ninja-answer]"
    )];


  function clearDanger() {
    dangerElements.forEach(
      element => {
        element.classList.remove(
          "show"
        );
      }
    );
  }


  function nextRound() {
    if (!active) {
      return;
    }

    clearDanger();

    answer = null;

    const delay =
      450 +
      Math.random() * 700;

    timer =
      setTimeout(
        () => {
          if (!active) {
            return;
          }

          const directions =
            [
              "LEFT",
              "UP",
              "RIGHT"
            ];

          answer =
            directions[
              Math.floor(
                Math.random() *
                directions.length
              )
            ];

          const danger =
            container.querySelector(
              `[data-danger="${answer}"]`
            );

          danger?.classList.add(
            "show"
          );

          arena.classList.add(
            "ninja-danger-active"
          );

          reactionStartedAt =
            performance.now();

          timer =
            setTimeout(
              () => {
                if (
                  active &&
                  answer
                ) {
                  missRound();
                }
              },
              720
            );

        },
        delay
      );
  }


  function choose(
    direction
  ) {
    if (
      !active ||
      !answer
    ) {
      return;
    }

    clearTimeout(timer);

    const reaction =
      performance.now() -
      reactionStartedAt;

    if (
      direction === answer
    ) {
      correct++;
      combo++;

      maxCombo =
        Math.max(
          maxCombo,
          combo
        );

      reactionTimes.push(
        reaction
      );

      comboElement.textContent =
        combo;

      player.classList.remove(
        "slash-left",
        "slash-up",
        "slash-right"
      );

      player.classList.add(
        `slash-${direction.toLowerCase()}`
      );

      impact.textContent =
        "SLASH!";

      impact.classList.add(
        "show",
        "success"
      );

      arena.classList.add(
        "reflex-screen-hit"
      );

    } else {
      misses++;
      combo = 0;

      comboElement.textContent =
        combo;

      impact.textContent =
        "MISS";

      impact.classList.add(
        "show",
        "fail"
      );

      arena.classList.add(
        "reflex-screen-fail"
      );
    }

    finishRound();
  }


  function missRound() {
    if (!active) {
      return;
    }

    misses++;
    combo = 0;

    comboElement.textContent =
      combo;

    impact.textContent =
      "TOO SLOW";

    impact.classList.add(
      "show",
      "fail"
    );

    arena.classList.add(
      "reflex-screen-fail"
    );

    finishRound();
  }


  function finishRound() {
    answer = null;

    clearDanger();

    round++;

    setTimeout(
      () => {
        impact.classList.remove(
          "show",
          "success",
          "fail"
        );

        arena.classList.remove(
          "ninja-danger-active",
          "reflex-screen-hit",
          "reflex-screen-fail"
        );

        player.classList.remove(
          "slash-left",
          "slash-up",
          "slash-right"
        );

        if (
          round >= rounds
        ) {
          finish();
        } else {
          nextRound();
        }
      },
      280
    );
  }


  function keyDown(
    event
  ) {
    if (
      event.key === "ArrowLeft"
    ) {
      choose("LEFT");
    }

    if (
      event.key === "ArrowUp"
    ) {
      choose("UP");
    }

    if (
      event.key === "ArrowRight"
    ) {
      choose("RIGHT");
    }
  }


  buttons.forEach(
    button => {
      button.addEventListener(
        "pointerdown",
        () => {
          choose(
            button.dataset
              .ninjaAnswer
          );
        }
      );
    }
  );


  window.addEventListener(
    "keydown",
    keyDown
  );


  function finish() {
    if (!active) {
      return;
    }

    active = false;

    clearTimeout(timer);

    const accuracy =
      correct / rounds;

    const averageReaction =
      reactionTimes.length
        ? average(
            reactionTimes
          )
        : 900;

    const reactionScore =
      clamp(
        100 -
        (
          averageReaction -
          200
        ) / 6,
        0,
        100
      );

    const score =
      accuracy * 65 +
      reactionScore * 35;

    onComplete?.({
      score:
        Math.round(score),

      adapt:
        Math.round(
          clamp(
            45 +
            accuracy * 35 +
            maxCombo * 3,
            0,
            100
          )
        ),

      meta: {
        correct,
        misses,
        maxCombo,
        averageReaction:
          Math.round(
            averageReaction
          )
      }
    });
  }


  nextRound();


  return () => {
    active = false;

    clearTimeout(timer);

    window.removeEventListener(
      "keydown",
      keyDown
    );
  };
}


/* ==========================================
QUICK DRAW
========================================== */

function runQuickDraw({
  container,
  onComplete
}) {
  let active = true;
  let round = 0;

  let canShoot = false;
  let falseStarts = 0;
  let hits = 0;

  const rounds = 5;

  const reactions = [];

  let timer = null;
  let signalTime = 0;


  container.innerHTML = `
    <div class="reflex-game duel-game">

      <div
        class="duel-arena"
        data-duel-arena
      >

        <div class="duel-sun"></div>

        <div
          class="duel-opponent"
          data-duel-opponent
        >
          🤠
        </div>

        <div
          class="duel-message"
          data-duel-message
        >
          WAIT...
        </div>

      </div>

      <button
        type="button"
        class="duel-shoot"
        data-duel-shoot
      >
        SHOOT
      </button>

    </div>
  `;


  const arena =
    container.querySelector(
      "[data-duel-arena]"
    );

  const opponent =
    container.querySelector(
      "[data-duel-opponent]"
    );

  const message =
    container.querySelector(
      "[data-duel-message]"
    );

  const shootButton =
    container.querySelector(
      "[data-duel-shoot]"
    );


  function startRound() {
    canShoot = false;

    message.textContent =
      "WAIT...";

    opponent.classList.remove(
      "duel-hit"
    );

    arena.classList.remove(
      "duel-draw"
    );


    const fakeOut =
      Math.random() <
      0.45;


    const firstDelay =
      700 +
      Math.random() *
      900;


    timer =
      setTimeout(
        () => {

          if (!active) {
            return;
          }


          if (fakeOut) {
            message.textContent =
              "...";

            opponent.classList.add(
              "duel-fake"
            );


            timer =
              setTimeout(
                () => {

                  opponent.classList.remove(
                    "duel-fake"
                  );

                  showDraw();

                },
                500 +
                Math.random() *
                500
              );

          } else {
            showDraw();
          }

        },
        firstDelay
      );
  }


  function showDraw() {
    if (!active) {
      return;
    }

    canShoot = true;

    signalTime =
      performance.now();

    message.textContent =
      "DRAW!";

    arena.classList.add(
      "duel-draw"
    );


    timer =
      setTimeout(
        () => {

          if (
            active &&
            canShoot
          ) {
            canShoot = false;

            round++;

            message.textContent =
              "TOO SLOW";

            nextOrFinish();
          }

        },
        720
      );
  }


  function shoot() {
    if (!active) {
      return;
    }


    if (!canShoot) {
      falseStarts++;

      message.textContent =
        "TOO EARLY";

      arena.classList.add(
        "reflex-screen-fail"
      );

      setTimeout(
        () => {
          arena.classList.remove(
            "reflex-screen-fail"
          );
        },
        220
      );

      return;
    }


    clearTimeout(timer);

    canShoot = false;

    hits++;

    const reaction =
      performance.now() -
      signalTime;

    reactions.push(
      reaction
    );

    message.textContent =
      `${Math.round(
        reaction
      )} ms`;

    opponent.classList.add(
      "duel-hit"
    );

    arena.classList.add(
      "reflex-screen-hit"
    );


    round++;

    setTimeout(
      () => {
        arena.classList.remove(
          "reflex-screen-hit"
        );

        nextOrFinish();
      },
      350
    );
  }


  function nextOrFinish() {
    if (
      round >= rounds
    ) {
      finish();
    } else {
      startRound();
    }
  }


  function finish() {
    if (!active) {
      return;
    }

    active = false;

    clearTimeout(timer);

    const avgReaction =
      reactions.length
        ? average(
            reactions
          )
        : 900;

    const speed =
      clamp(
        100 -
        (
          avgReaction -
          180
        ) / 5,
        0,
        100
      );

    const accuracy =
      hits / rounds;

    const score =
      speed * 0.55 +
      accuracy * 100 * 0.45 -
      falseStarts * 8;

    onComplete?.({
      score:
        Math.round(
          clamp(
            score,
            0,
            100
          )
        ),

      adapt:
        Math.round(
          clamp(
            50 +
            accuracy * 35 -
            falseStarts * 5,
            0,
            100
          )
        ),

      meta: {
        hits,
        falseStarts,
        avgReaction:
          Math.round(
            avgReaction
          )
      }
    });
  }


  shootButton.addEventListener(
    "pointerdown",
    shoot
  );


  startRound();


  return () => {
    active = false;

    clearTimeout(timer);

    shootButton.removeEventListener(
      "pointerdown",
      shoot
    );
  };
}


/* ==========================================
LANE PANIC
========================================== */

function runLanePanic({
  container,
  onComplete
}) {
  let active = true;

  let lane = 1;
  let round = 0;
  let survived = 0;

  const rounds = 8;

  let dangerLane = null;

  const reactions = [];

  let signalTime = 0;
  let timer = null;


  container.innerHTML = `
    <div class="reflex-game lane-panic-game">

      <div
        class="lane-panic-arena"
        data-lane-arena
      >

        <div class="lane-panic-road">

          <div
            class="lane-warning"
            data-lane-warning
          >
            ⚠
          </div>

          <div
            class="lane-player"
            data-lane-player
          >
            ◆
          </div>

        </div>

      </div>


      <div class="lane-panic-controls">

        <button
          type="button"
          data-lane-left
        >
          ←
        </button>

        <button
          type="button"
          data-lane-right
        >
          →
        </button>

      </div>

    </div>
  `;


  const player =
    container.querySelector(
      "[data-lane-player]"
    );

  const warning =
    container.querySelector(
      "[data-lane-warning]"
    );

  const leftButton =
    container.querySelector(
      "[data-lane-left]"
    );

  const rightButton =
    container.querySelector(
      "[data-lane-right]"
    );


  function updatePlayer() {
    player.style.left =
      `${16.5 + lane * 33.5}%`;
  }


  function nextRound() {
    if (!active) {
      return;
    }

    dangerLane =
      Math.floor(
        Math.random() * 3
      );

    warning.style.left =
      `${16.5 +
        dangerLane *
        33.5}%`;

    warning.classList.remove(
      "show"
    );

    void warning.offsetWidth;

    warning.classList.add(
      "show"
    );

    signalTime =
      performance.now();


    timer =
      setTimeout(
        resolveRound,
        700
      );
  }


  function changeLane(
    direction
  ) {
    if (!active) {
      return;
    }

    lane =
      clamp(
        lane + direction,
        0,
        2
      );

    updatePlayer();

    reactions.push(
      performance.now() -
      signalTime
    );
  }


  function resolveRound() {
    if (!active) {
      return;
    }

    if (
      lane !==
      dangerLane
    ) {
      survived++;

      player.classList.add(
        "lane-safe"
      );
    } else {
      player.classList.add(
        "lane-crash"
      );
    }

    round++;

    setTimeout(
      () => {
        player.classList.remove(
          "lane-safe",
          "lane-crash"
        );

        if (
          round >= rounds
        ) {
          finish();
        } else {
          nextRound();
        }
      },
      250
    );
  }


  function left() {
    changeLane(-1);
  }

  function right() {
    changeLane(1);
  }


  function keyDown(
    event
  ) {
    if (
      event.key ===
      "ArrowLeft"
    ) {
      left();
    }

    if (
      event.key ===
      "ArrowRight"
    ) {
      right();
    }
  }


  leftButton.addEventListener(
    "pointerdown",
    left
  );

  rightButton.addEventListener(
    "pointerdown",
    right
  );

  window.addEventListener(
    "keydown",
    keyDown
  );


  function finish() {
    active = false;

    clearTimeout(timer);

    const successRate =
      survived / rounds;

    const avgReaction =
      reactions.length
        ? average(
            reactions
          )
        : 700;

    const reactionScore =
      clamp(
        100 -
        (
          avgReaction -
          150
        ) / 7,
        0,
        100
      );

    const score =
      successRate * 70 +
      reactionScore * 0.30;

    onComplete?.({
      score:
        Math.round(score),

      adapt:
        Math.round(
          clamp(
            45 +
            successRate * 45,
            0,
            100
          )
        ),

      meta: {
        survived,
        rounds
      }
    });
  }


  updatePlayer();
  nextRound();


  return () => {
    active = false;

    clearTimeout(timer);

    window.removeEventListener(
      "keydown",
      keyDown
    );
  };
}


/* ==========================================
FRIEND OR FOE
========================================== */

function runFriendOrFoe({
  container,
  onComplete
}) {
  let active = true;

  let round = 0;
  let correct = 0;
  let wrong = 0;

  const rounds = 7;

  let enemyIndex = 0;

  const reactions = [];

  let signalTime = 0;
  let timer = null;


  container.innerHTML = `
    <div class="reflex-game friend-foe-game">

      <div
        class="friend-foe-arena"
        data-foe-arena
      >

        <button
          type="button"
          class="foe-target"
          data-foe-index="0"
        ></button>

        <button
          type="button"
          class="foe-target"
          data-foe-index="1"
        ></button>

        <button
          type="button"
          class="foe-target"
          data-foe-index="2"
        ></button>

      </div>

      <div
        class="foe-status"
        data-foe-status
      >
        FIND THE ENEMY
      </div>

    </div>
  `;


  const targets =
    [...container.querySelectorAll(
      "[data-foe-index]"
    )];

  const status =
    container.querySelector(
      "[data-foe-status]"
    );


  function nextRound() {
    if (!active) {
      return;
    }

    enemyIndex =
      Math.floor(
        Math.random() * 3
      );


    targets.forEach(
      (target, index) => {

        const isEnemy =
          index === enemyIndex;

        target.textContent =
          isEnemy
            ? "👾"
            : "🧑‍🚀";

        target.classList.remove(
          "foe-hit",
          "foe-wrong"
        );
      }
    );


    signalTime =
      performance.now();


    timer =
      setTimeout(
        () => {
          if (!active) {
            return;
          }

          wrong++;

          round++;

          status.textContent =
            "TOO SLOW";

          nextOrFinish();
        },
        900
      );
  }


  function choose(
    index
  ) {
    if (!active) {
      return;
    }

    clearTimeout(timer);

    const reaction =
      performance.now() -
      signalTime;

    if (
      index === enemyIndex
    ) {
      correct++;

      reactions.push(
        reaction
      );

      targets[index]
        .classList.add(
          "foe-hit"
        );

      status.textContent =
        "TARGET DOWN";

    } else {
      wrong++;

      targets[index]
        .classList.add(
          "foe-wrong"
        );

      status.textContent =
        "FRIEND!";
    }


    round++;

    setTimeout(
      nextOrFinish,
      260
    );
  }


  function nextOrFinish() {
    if (
      round >= rounds
    ) {
      finish();
    } else {
      nextRound();
    }
  }


  targets.forEach(
    target => {

      target.addEventListener(
        "pointerdown",
        () => {
          choose(
            Number(
              target.dataset
                .foeIndex
            )
          );
        }
      );

    }
  );


  function finish() {
    if (!active) {
      return;
    }

    active = false;

    clearTimeout(timer);

    const accuracy =
      correct / rounds;

    const avgReaction =
      reactions.length
        ? average(
            reactions
          )
        : 900;

    const reactionScore =
      clamp(
        100 -
        (
          avgReaction -
          180
        ) / 6,
        0,
        100
      );

    const score =
      accuracy * 70 +
      reactionScore * 0.30;

    onComplete?.({
      score:
        Math.round(score),

      adapt:
        Math.round(
          clamp(
            40 +
            accuracy * 55,
            0,
            100
          )
        ),

      meta: {
        correct,
        wrong,
        avgReaction:
          Math.round(
            avgReaction
          )
      }
    });
  }


  nextRound();


  return () => {
    active = false;

    clearTimeout(timer);
  };
}


/* ==========================================
UTIL
========================================== */

function average(
  values
) {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (
        sum,
        value
      ) =>
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
