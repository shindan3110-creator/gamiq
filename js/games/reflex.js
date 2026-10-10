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

  let score = 0;
  let misses = 0;

  let combo = 0;
  let maxCombo = 0;

  let lives = 3;

  const goal = 12;

  let round = 0;

  let currentTarget = null;
  let currentType = null;

  let spawnTimer = null;
  let hideTimer = null;
  let nextTimer = null;

  let signalTime = 0;

  const reactionTimes = [];

  const startedAt =
    performance.now();


  /* ==========================================
  HTML
  ========================================== */

  container.innerHTML = `
    <div class="ninja-whack-game">

      <div class="ninja-whack-hud">

        <div class="ninja-whack-hud-item">
          <span>SCORE</span>
          <strong data-ninja-score>0 / ${goal}</strong>
        </div>

        <div class="ninja-whack-hud-item">
          <span>COMBO</span>
          <strong data-ninja-combo>0</strong>
        </div>

        <div class="ninja-whack-hud-item">
          <span>LIFE</span>
          <strong
            class="ninja-whack-life"
            data-ninja-life
          >
            ♥ ♥ ♥
          </strong>
        </div>

      </div>


      <div
        class="ninja-whack-stage"
        data-ninja-stage
      >

        <div class="ninja-whack-bg">

          <div class="ninja-whack-moon"></div>

          <div class="ninja-whack-roof"></div>

        </div>


        <button
          type="button"
          class="
            ninja-whack-hole
            ninja-whack-hole-1
          "
          data-hole="0"
        ></button>


        <button
          type="button"
          class="
            ninja-whack-hole
            ninja-whack-hole-2
          "
          data-hole="1"
        ></button>


        <button
          type="button"
          class="
            ninja-whack-hole
            ninja-whack-hole-3
          "
          data-hole="2"
        ></button>


        <button
          type="button"
          class="
            ninja-whack-hole
            ninja-whack-hole-4
          "
          data-hole="3"
        ></button>


        <button
          type="button"
          class="
            ninja-whack-hole
            ninja-whack-hole-5
          "
          data-hole="4"
        ></button>


        <div
          class="ninja-whack-player"
          data-ninja-player
        >
          <div class="ninja-whack-player-head">
            <i></i>
          </div>

          <div class="ninja-whack-player-body"></div>

          <div class="ninja-whack-player-sword"></div>
        </div>


        <div
          class="ninja-whack-slash"
          data-ninja-slash
        ></div>


        <div
          class="ninja-whack-sparks"
          data-ninja-sparks
        ></div>


        <div
          class="ninja-whack-message"
          data-ninja-message
        ></div>


        <div
          class="ninja-whack-combo-pop"
          data-ninja-combo-pop
        ></div>


        <div class="ninja-whack-hint">
          HIT ENEMIES
        </div>

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

  const holes =
    [
      ...container.querySelectorAll(
        "[data-hole]"
      )
    ];

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

  const slash =
    container.querySelector(
      "[data-ninja-slash]"
    );

  const sparks =
    container.querySelector(
      "[data-ninja-sparks]"
    );

  const message =
    container.querySelector(
      "[data-ninja-message]"
    );

  const comboPop =
    container.querySelector(
      "[data-ninja-combo-pop]"
    );


  /* ==========================================
  STATE HELPERS
  ========================================== */

  function clearTimers() {
    clearTimeout(
      spawnTimer
    );

    clearTimeout(
      hideTimer
    );

    clearTimeout(
      nextTimer
    );
  }


  function updateHud() {
    scoreElement.textContent =
      `${score} / ${goal}`;


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
  CHARACTER
  ========================================== */

  function createCharacter(
    type
  ) {
    const wrapper =
      document.createElement(
        "div"
      );


    wrapper.className =
      `
        ninja-whack-character
        ninja-whack-character-${type}
      `;


    const head =
      document.createElement(
        "div"
      );


    head.className =
      "ninja-whack-character-head";


    const eyes =
      document.createElement(
        "i"
      );


    head.appendChild(
      eyes
    );


    const body =
      document.createElement(
        "div"
      );


    body.className =
      "ninja-whack-character-body";


    wrapper.appendChild(
      head
    );


    wrapper.appendChild(
      body
    );


    if (
      type ===
      "enemy"
    ) {
      const sword =
        document.createElement(
          "div"
        );


      sword.className =
        "ninja-whack-character-sword";


      wrapper.appendChild(
        sword
      );
    }


    return wrapper;
  }


  /* ==========================================
  ROUND
  ========================================== */

  function nextRound() {
    if (!active) {
      return;
    }


    clearTimers();


    clearCurrentTarget();


    round++;


    const delay =
      Math.max(
        280,

        650 -
        score *
        22
      ) +
      Math.random() *
      420;


    spawnTimer =
      setTimeout(
        spawnTarget,
        delay
      );
  }


  function spawnTarget() {
    if (!active) {
      return;
    }


    const index =
      Math.floor(
        Math.random() *
        holes.length
      );


    const hole =
      holes[
        index
      ];


    /*
     * 後半ほど味方やフェイントを増やす
     */

    let type =
      "enemy";


    const roll =
      Math.random();


    if (
      score >= 3 &&
      roll <
      0.18
    ) {
      type =
        "friend";
    }


    if (
      score >= 6 &&
      roll >=
        0.18 &&
      roll <
        0.29
    ) {
      type =
        "fake";
    }


    currentTarget =
      hole;


    currentType =
      type;


    const character =
      createCharacter(
        type ===
          "fake"
          ? "enemy"
          : type
      );


    hole.innerHTML =
      "";


    hole.appendChild(
      character
    );


    hole.classList.remove(
      "show",
      "friend",
      "enemy",
      "fake"
    );


    hole.classList.add(
      type
    );


    void hole.offsetWidth;


    hole.classList.add(
      "show"
    );


    signalTime =
      performance.now();


    const visibilityTime =
      Math.max(
        460,

        850 -
        score *
        28
      );


    if (
      type ===
      "fake"
    ) {
      hideTimer =
        setTimeout(
          () => {

            if (!active) {
              return;
            }


            hole.classList.remove(
              "show"
            );


            clearCurrentTarget();


            nextTimer =
              setTimeout(
                nextRound,
                160
              );

          },

          240
        );

      return;
    }


    hideTimer =
      setTimeout(
        () => {

          if (!active) {
            return;
          }


          if (
            currentType ===
            "enemy"
          ) {
            registerMiss(
              "TOO SLOW"
            );

          } else {

            /*
             * 味方は触らなければ正解
             */

            combo++;


            maxCombo =
              Math.max(
                maxCombo,
                combo
              );


            showMessage(
              "GOOD!"
            );


            updateHud();


            clearCurrentTarget();


            nextTimer =
              setTimeout(
                nextRound,
                180
              );
          }

        },

        visibilityTime
      );
  }


  /* ==========================================
  TAP
  ========================================== */

  function handleHoleTap(
    event
  ) {
    if (!active) {
      return;
    }


    const hole =
      event.currentTarget;


    if (
      hole !==
      currentTarget ||
      !currentType
    ) {
      return;
    }


    clearTimeout(
      hideTimer
    );


    const reaction =
      performance.now() -
      signalTime;


    if (
      currentType ===
      "enemy"
    ) {
      score++;


      combo++;


      maxCombo =
        Math.max(
          maxCombo,
          combo
        );


      reactionTimes.push(
        reaction
      );


      attackTarget(
        hole
      );


      showMessage(
        reaction <=
          280
          ? "PERFECT!"
          : "SLASH!"
      );


      showCombo();


      updateHud();


      clearCurrentTarget();


      if (
        score >=
        goal
      ) {
        nextTimer =
          setTimeout(
            () => {

              finish(
                true
              );

            },

            400
          );

        return;
      }


      nextTimer =
        setTimeout(
          nextRound,
          260
        );

      return;
    }


    if (
      currentType ===
      "friend"
    ) {
      registerMiss(
        "FRIEND!"
      );

      return;
    }


    if (
      currentType ===
      "fake"
    ) {
      registerMiss(
        "FAKE!"
      );
    }
  }


  holes.forEach(
    hole => {

      hole.addEventListener(
        "pointerdown",
        handleHoleTap
      );

    }
  );


  /* ==========================================
  PLAYER DASH
  ========================================== */

  function attackTarget(
    hole
  ) {
    const stageRect =
      stage.getBoundingClientRect();


    const holeRect =
      hole.getBoundingClientRect();


    const targetX =
      (
        holeRect.left +
        holeRect.width /
        2
      ) -
      (
        stageRect.left +
        stageRect.width /
        2
      );


    const targetY =
      (
        holeRect.top +
        holeRect.height /
        2
      ) -
      (
        stageRect.top +
        stageRect.height *
        0.72
      );


    player.style.setProperty(
      "--dash-x",

      `${targetX}px`
    );


    player.style.setProperty(
      "--dash-y",

      `${targetY}px`
    );


    player.classList.remove(
      "dash"
    );


    void player.offsetWidth;


    player.classList.add(
      "dash"
    );


    slash.style.left =
      `${
        holeRect.left -
        stageRect.left +
        holeRect.width /
        2
      }px`;


    slash.style.top =
      `${
        holeRect.top -
        stageRect.top +
        holeRect.height /
        2
      }px`;


    slash.classList.remove(
      "show"
    );


    void slash.offsetWidth;


    slash.classList.add(
      "show"
    );


    createSparks(
      holeRect,
      stageRect
    );


    stage.classList.remove(
      "ninja-whack-hit"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "ninja-whack-hit"
    );
  }


  /* ==========================================
  MISS
  ========================================== */

  function registerMiss(
    text
  ) {
    clearTimeout(
      hideTimer
    );


    misses++;


    lives--;


    combo =
      0;


    showMessage(
      text,
      true
    );


    stage.classList.remove(
      "ninja-whack-damage"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "ninja-whack-damage"
    );


    updateHud();


    clearCurrentTarget();


    if (
      lives <=
      0
    ) {
      nextTimer =
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


    nextTimer =
      setTimeout(
        nextRound,
        420
      );
  }


  /* ==========================================
  CLEAR TARGET
  ========================================== */

  function clearCurrentTarget() {
    holes.forEach(
      hole => {

        hole.classList.remove(
          "show",
          "enemy",
          "friend",
          "fake"
        );


        hole.innerHTML =
          "";

      }
    );


    currentTarget =
      null;


    currentType =
      null;
  }


  /* ==========================================
  EFFECTS
  ========================================== */

  function showMessage(
    text,
    failed = false
  ) {
    message.textContent =
      text;


    message.classList.remove(
      "show",
      "fail"
    );


    void message.offsetWidth;


    if (
      failed
    ) {
      message.classList.add(
        "fail"
      );
    }


    message.classList.add(
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


  function createSparks(
    holeRect,
    stageRect
  ) {
    sparks.innerHTML =
      "";


    sparks.style.left =
      `${
        holeRect.left -
        stageRect.left +
        holeRect.width /
        2
      }px`;


    sparks.style.top =
      `${
        holeRect.top -
        stageRect.top +
        holeRect.height /
        2
      }px`;


    for (
      let i = 0;
      i < 14;
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
        25 +
        Math.random() *
        55;


      spark.style.setProperty(
        "--x",

        `${
          Math.cos(
            angle
          ) *
          distance
        }px`
      );


      spark.style.setProperty(
        "--y",

        `${
          Math.sin(
            angle
          ) *
          distance
        }px`
      );


      sparks.appendChild(
        spark
      );
    }


    sparks.classList.remove(
      "show"
    );


    void sparks.offsetWidth;


    sparks.classList.add(
      "show"
    );
  }


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


    const total =
      score +
      misses;


    const accuracy =
      score /
      Math.max(
        1,
        total
      );


    const avgReaction =
      reactionTimes.length
        ? average(
            reactionTimes
          )
        : 900;


    const reactionScore =
      clamp(
        100 -
        (
          avgReaction -
          200
        ) /
        5,

        0,

        100
      );


    const completion =
      clamp(
        score /
        goal,

        0,

        1
      );


    const comboScore =
      clamp(
        maxCombo /
        goal,

        0,

        1
      );


    const finalScore =
      clamp(
        completion *
        35 +

        accuracy *
        30 +

        reactionScore /
        100 *
        25 +

        comboScore *
        10,

        0,

        100
      );


    setTimeout(
      () => {

        onComplete?.({
          score:
            Math.round(
              finalScore
            ),

          adapt:
            Math.round(
              clamp(
                40 +

                accuracy *
                35 +

                comboScore *
                15 +

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

            score,

            misses,

            lives,

            maxCombo,

            avgReaction:
              Math.round(
                avgReaction
              ),

            elapsed:
              Math.round(
                elapsed
              )
          }
        });

      },

      450
    );
  }


  /* ==========================================
  START
  ========================================== */

  updateHud();

  nextRound();


  /* ==========================================
  CLEANUP
  ========================================== */

  return () => {
    active =
      false;


    clearTimers();


    holes.forEach(
      hole => {

        hole.removeEventListener(
          "pointerdown",
          handleHoleTap
        );

      }
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
