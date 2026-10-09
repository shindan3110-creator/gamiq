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

  let successfulCounters = 0;
  let misses = 0;
  let combo = 0;
  let maxCombo = 0;
  let lives = 3;

  const goal = 7;

  let answer = null;
  let reactionStartedAt = 0;

  let attackTimer = null;
  let timeoutTimer = null;
  let roundTimer = null;

  let acceptingInput = false;
  let fakeActive = false;

  const reactionTimes = [];

  const startedAt =
    performance.now();


  /* ==========================================
  HTML
  ========================================== */

  container.innerHTML = `
    <div class="ninja-counter-wrap">

      <div class="ninja-counter-hud">

        <div class="ninja-counter-hud-item">
          <span>COUNTER</span>

          <strong>
            <b data-ninja-score>
              0
            </b>
            / ${goal}
          </strong>
        </div>


        <div class="ninja-counter-hud-item">
          <span>COMBO</span>

          <strong data-ninja-combo>
            0
          </strong>
        </div>


        <div class="ninja-counter-hud-item">
          <span>LIFE</span>

          <strong
            class="ninja-life-value"
            data-ninja-life
          >
            ♥ ♥ ♥
          </strong>
        </div>

      </div>


      <div
        class="ninja-counter-stage"
        data-ninja-stage
      >

        <div class="ninja-dojo-bg">

          <div class="ninja-moon"></div>

          <div class="ninja-floor-line"></div>

        </div>


        <div
          class="ninja-enemy ninja-enemy-left"
          data-ninja-enemy="LEFT"
        >
          <div class="ninja-enemy-head">
            <i></i>
          </div>

          <div class="ninja-enemy-body"></div>

          <div class="ninja-enemy-sword"></div>
        </div>


        <div
          class="ninja-enemy ninja-enemy-up"
          data-ninja-enemy="UP"
        >
          <div class="ninja-enemy-head">
            <i></i>
          </div>

          <div class="ninja-enemy-body"></div>

          <div class="ninja-enemy-sword"></div>
        </div>


        <div
          class="ninja-enemy ninja-enemy-right"
          data-ninja-enemy="RIGHT"
        >
          <div class="ninja-enemy-head">
            <i></i>
          </div>

          <div class="ninja-enemy-body"></div>

          <div class="ninja-enemy-sword"></div>
        </div>


        <div
          class="ninja-player-v2"
          data-ninja-player
        >

          <div class="ninja-player-head">
            <i></i>
          </div>

          <div class="ninja-player-body"></div>

          <div class="ninja-player-arm"></div>

          <div class="ninja-player-sword"></div>

        </div>


        <div
          class="ninja-slash-trail"
          data-ninja-slash
        ></div>


        <div
          class="ninja-impact-sparks"
          data-ninja-sparks
        ></div>


        <div
          class="ninja-counter-message"
          data-ninja-message
        ></div>


        <div
          class="ninja-counter-combo-pop"
          data-ninja-combo-pop
        ></div>


        <div class="ninja-counter-hint">
          攻撃方向へCOUNTER
        </div>

      </div>


      <div class="ninja-counter-controls">

        <button
          type="button"
          data-ninja-answer="LEFT"
          aria-label="Counter left"
        >
          ←
        </button>

        <button
          type="button"
          data-ninja-answer="UP"
          aria-label="Counter up"
        >
          ↑
        </button>

        <button
          type="button"
          data-ninja-answer="RIGHT"
          aria-label="Counter right"
        >
          →
        </button>

      </div>

    </div>
  `;


  /* ==========================================
  ELEMENTS
  ========================================== */

  const stage =
    container.querySelector(
      "[data-ninja-stage]"
    );

  const player =
    container.querySelector(
      "[data-ninja-player]"
    );

  const scoreElement =
    container.querySelector(
      "[data-ninja-score]"
    );

  const comboElement =
    container.querySelector(
      "[data-ninja-combo]"
    );

  const lifeElement =
    container.querySelector(
      "[data-ninja-life]"
    );

  const messageElement =
    container.querySelector(
      "[data-ninja-message]"
    );

  const comboPop =
    container.querySelector(
      "[data-ninja-combo-pop]"
    );

  const slashTrail =
    container.querySelector(
      "[data-ninja-slash]"
    );

  const sparks =
    container.querySelector(
      "[data-ninja-sparks]"
    );

  const enemies =
    [
      ...container.querySelectorAll(
        "[data-ninja-enemy]"
      )
    ];

  const buttons =
    [
      ...container.querySelectorAll(
        "[data-ninja-answer]"
      )
    ];


  /* ==========================================
  UTIL
  ========================================== */

  function clearTimers() {
    clearTimeout(
      attackTimer
    );

    clearTimeout(
      timeoutTimer
    );

    clearTimeout(
      roundTimer
    );
  }


  function clearEnemies() {
    enemies.forEach(
      enemy => {

        enemy.classList.remove(
          "attack",
          "fake",
          "hit",
          "retreat"
        );

      }
    );
  }


  function getEnemy(
    direction
  ) {
    return container.querySelector(
      `[data-ninja-enemy="${direction}"]`
    );
  }


  function updateHud() {
    scoreElement.textContent =
      successfulCounters;


    comboElement.textContent =
      combo;


    lifeElement.textContent =
      Array.from(
        {
          length:
            3
        },

        (
          _,
          index
        ) =>
          index <
          lives
            ? "♥"
            : "♡"
      )
      .join(
        " "
      );
  }


  /* ==========================================
  NEXT ATTACK
  ========================================== */

  function nextAttack() {
    if (!active) {
      return;
    }


    clearTimers();

    clearEnemies();


    answer =
      null;


    acceptingInput =
      false;


    fakeActive =
      false;


    const difficulty =
      successfulCounters;


    const delay =
      Math.max(
        330,

        720 -
        difficulty *
        40
      ) +
      Math.random() *
      500;


    attackTimer =
      setTimeout(
        () => {

          if (!active) {
            return;
          }


          /*
           * 25%程度でフェイント
           */

          const shouldFake =
            successfulCounters >= 2 &&
            Math.random() <
            0.25;


          if (shouldFake) {
            showFakeAttack();

          } else {
            launchRealAttack();
          }

        },

        delay
      );
  }


  /* ==========================================
  FAKE
  ========================================== */

  function showFakeAttack() {
    fakeActive =
      true;


    const directions =
      [
        "LEFT",
        "UP",
        "RIGHT"
      ];


    const fakeDirection =
      directions[
        Math.floor(
          Math.random() *
          directions.length
        )
      ];


    const enemy =
      getEnemy(
        fakeDirection
      );


    enemy?.classList.add(
      "fake"
    );


    roundTimer =
      setTimeout(
        () => {

          if (!active) {
            return;
          }


          enemy?.classList.remove(
            "fake"
          );


          fakeActive =
            false;


          roundTimer =
            setTimeout(
              launchRealAttack,
              180 +
              Math.random() *
              180
            );

        },

        260
      );
  }


  /* ==========================================
  REAL ATTACK
  ========================================== */

  function launchRealAttack() {
    if (!active) {
      return;
    }


    fakeActive =
      false;


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


    const enemy =
      getEnemy(
        answer
      );


    enemy?.classList.add(
      "attack"
    );


    acceptingInput =
      true;


    reactionStartedAt =
      performance.now();


    /*
     * 上手くなるほど猶予を短くする
     */

    const windowMs =
      Math.max(
        430,

        700 -
        successfulCounters *
        30
      );


    timeoutTimer =
      setTimeout(
        () => {

          if (
            active &&
            acceptingInput
          ) {
            failCounter(
              "TOO SLOW"
            );
          }

        },

        windowMs
      );
  }


  /* ==========================================
  INPUT
  ========================================== */

  function choose(
    direction
  ) {
    if (!active) {
      return;
    }


    /*
     * フェイント中に押した
     */

    if (
      fakeActive &&
      !acceptingInput
    ) {
      failCounter(
        "FAKE!"
      );

      return;
    }


    if (
      !acceptingInput ||
      !answer
    ) {
      return;
    }


    clearTimeout(
      timeoutTimer
    );


    acceptingInput =
      false;


    const reaction =
      performance.now() -
      reactionStartedAt;


    if (
      direction ===
      answer
    ) {
      successfulCounters++;


      combo++;


      maxCombo =
        Math.max(
          maxCombo,
          combo
        );


      reactionTimes.push(
        reaction
      );


      successfulCounter(
        direction,
        reaction
      );

    } else {

      failCounter(
        "MISS"
      );
    }
  }


  /* ==========================================
  SUCCESS
  ========================================== */

  function successfulCounter(
    direction,
    reaction
  ) {
    const enemy =
      getEnemy(
        answer
      );


    enemy?.classList.add(
      "hit"
    );


    player.classList.remove(
      "counter-left",
      "counter-up",
      "counter-right"
    );


    player.classList.add(
      `counter-${direction.toLowerCase()}`
    );


    slashTrail.className =
      "ninja-slash-trail";


    void slashTrail.offsetWidth;


    slashTrail.classList.add(
      `slash-${direction.toLowerCase()}`,
      "show"
    );


    createSparks(
      direction
    );


    showMessage(
      reaction <= 250
        ? "PERFECT!"
        : "COUNTER!"
    );


    showCombo();


    /*
     * HIT STOP
     */

    stage.classList.remove(
      "ninja-hit-stop"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "ninja-hit-stop"
    );


    updateHud();


    roundTimer =
      setTimeout(
        () => {

          if (!active) {
            return;
          }


          enemy?.classList.add(
            "retreat"
          );


          player.classList.remove(
            "counter-left",
            "counter-up",
            "counter-right"
          );


          if (
            successfulCounters >=
            goal
          ) {
            finish(
              true
            );

            return;
          }


          roundTimer =
            setTimeout(
              nextAttack,
              220
            );

        },

        220
      );
  }


  /* ==========================================
  FAIL
  ========================================== */

  function failCounter(
    text
  ) {
    if (!active) {
      return;
    }


    clearTimeout(
      timeoutTimer
    );


    acceptingInput =
      false;


    fakeActive =
      false;


    misses++;


    lives--;


    combo =
      0;


    showMessage(
      text,
      true
    );


    stage.classList.remove(
      "ninja-damage"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "ninja-damage"
    );


    updateHud();


    clearEnemies();


    if (
      lives <=
      0
    ) {
      roundTimer =
        setTimeout(
          () => {
            finish(
              false
            );
          },

          350
        );

      return;
    }


    roundTimer =
      setTimeout(
        nextAttack,
        480
      );
  }


  /* ==========================================
  MESSAGE
  ========================================== */

  function showMessage(
    text,
    fail = false
  ) {
    messageElement.textContent =
      text;


    messageElement.classList.remove(
      "show",
      "fail"
    );


    void messageElement.offsetWidth;


    if (fail) {
      messageElement.classList.add(
        "fail"
      );
    }


    messageElement.classList.add(
      "show"
    );
  }


  function showCombo() {
    if (
      combo <
      2
    ) {
      return;
    }


    comboPop.textContent =
      `×${combo}`;


    comboPop.classList.remove(
      "show"
    );


    void comboPop.offsetWidth;


    comboPop.classList.add(
      "show"
    );
  }


  /* ==========================================
  SPARKS
  ========================================== */

  function createSparks(
    direction
  ) {
    sparks.innerHTML =
      "";


    sparks.className =
      `ninja-impact-sparks sparks-${direction.toLowerCase()}`;


    for (
      let i = 0;
      i < 12;
      i++
    ) {
      const spark =
        document.createElement(
          "i"
        );


      const angle =
        Math.random() *
        Math.PI *
        2;


      const distance =
        35 +
        Math.random() *
        55;


      spark.style.setProperty(
        "--spark-x",

        `${Math.cos(angle) *
        distance}px`
      );


      spark.style.setProperty(
        "--spark-y",

        `${Math.sin(angle) *
        distance}px`
      );


      spark.style.animationDelay =
        `${Math.random() *
        0.04}s`;


      sparks.appendChild(
        spark
      );
    }


    sparks.classList.add(
      "show"
    );


    setTimeout(
      () => {

        sparks.classList.remove(
          "show"
        );

      },

      300
    );
  }


  /* ==========================================
  KEYBOARD
  ========================================== */

  function keyDown(
    event
  ) {
    if (
      event.key ===
      "ArrowLeft"
    ) {
      event.preventDefault();

      choose(
        "LEFT"
      );
    }


    if (
      event.key ===
      "ArrowUp"
    ) {
      event.preventDefault();

      choose(
        "UP"
      );
    }


    if (
      event.key ===
      "ArrowRight"
    ) {
      event.preventDefault();

      choose(
        "RIGHT"
      );
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


  /* ==========================================
  FINISH
  ========================================== */

  function finish(
    success
  ) {
    if (!active) {
      return;
    }


    active =
      false;


    clearTimers();


    const elapsed =
      performance.now() -
      startedAt;


    const accuracy =
      successfulCounters /
      Math.max(
        1,

        successfulCounters +
        misses
      );


    const averageReaction =
      reactionTimes.length
        ? average(
            reactionTimes
          )
        : 800;


    const reactionScore =
      clamp(
        100 -
        (
          averageReaction -
          180
        ) /
        5,

        0,

        100
      );


    const completion =
      successfulCounters /
      goal;


    const lifeScore =
      lives /
      3;


    const comboScore =
      clamp(
        maxCombo /
        goal,

        0,

        1
      );


    const score =
      clamp(
        completion *
        35 +

        accuracy *
        25 +

        reactionScore /
        100 *
        25 +

        lifeScore *
        10 +

        comboScore *
        5,

        0,

        100
      );


    setTimeout(
      () => {

        onComplete?.({
          score:
            Math.round(
              score
            ),

          adapt:
            Math.round(
              clamp(
                40 +
                accuracy *
                30 +
                comboScore *
                20 +
                (
                  success
                    ? 10
                    : 0
                ),

                0,

                100
              )
            ),

          meta: {
            success,

            counters:
              successfulCounters,

            misses,

            lives,

            maxCombo,

            averageReaction:
              Math.round(
                averageReaction
              ),

            elapsed:
              Math.round(
                elapsed
              )
          }
        });

      },

      success
        ? 480
        : 250
    );
  }


  /* ==========================================
  START
  ========================================== */

  updateHud();


  nextAttack();


  /* ==========================================
  CLEANUP
  ========================================== */

  return () => {
    active =
      false;


    clearTimers();


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
