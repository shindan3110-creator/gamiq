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

  let counters = 0;
  let misses = 0;

  let combo = 0;
  let maxCombo = 0;

  let lives = 3;

  const goal = 7;

  let answer = null;

  let acceptingInput = false;
  let fakeActive = false;

  let reactionStartedAt = 0;

  const reactionTimes = [];

  let attackTimer = null;
  let timeoutTimer = null;
  let nextTimer = null;

  const startedAt =
    performance.now();


  /* ==========================================
  HTML
  ========================================== */

  container.innerHTML = `
    <div class="ninja-swipe-game">

      <div class="ninja-swipe-hud">

        <div class="ninja-swipe-hud-item">
          <span>COUNTER</span>

          <strong>
            <b data-ninja-counter>0</b>
            / ${goal}
          </strong>
        </div>


        <div class="ninja-swipe-hud-item">
          <span>COMBO</span>

          <strong data-ninja-combo>
            0
          </strong>
        </div>


        <div class="ninja-swipe-hud-item">
          <span>LIFE</span>

          <strong
            class="ninja-swipe-life"
            data-ninja-life
          >
            ♥ ♥ ♥
          </strong>
        </div>

      </div>


      <div
        class="ninja-swipe-stage"
        data-ninja-stage
      >

        <div class="ninja-swipe-background">

          <div class="ninja-swipe-moon"></div>

          <div class="ninja-swipe-ground"></div>

        </div>


        <!-- LEFT ENEMY -->

        <div
          class="
            ninja-swipe-enemy
            ninja-swipe-enemy-left
          "
          data-ninja-enemy="LEFT"
        >

          <div class="ninja-swipe-enemy-head">
            <i></i>
          </div>

          <div class="ninja-swipe-enemy-body"></div>

          <div class="ninja-swipe-enemy-arm"></div>

          <div class="ninja-swipe-enemy-sword"></div>

        </div>


        <!-- UP ENEMY -->

        <div
          class="
            ninja-swipe-enemy
            ninja-swipe-enemy-up
          "
          data-ninja-enemy="UP"
        >

          <div class="ninja-swipe-enemy-head">
            <i></i>
          </div>

          <div class="ninja-swipe-enemy-body"></div>

          <div class="ninja-swipe-enemy-arm"></div>

          <div class="ninja-swipe-enemy-sword"></div>

        </div>


        <!-- RIGHT ENEMY -->

        <div
          class="
            ninja-swipe-enemy
            ninja-swipe-enemy-right
          "
          data-ninja-enemy="RIGHT"
        >

          <div class="ninja-swipe-enemy-head">
            <i></i>
          </div>

          <div class="ninja-swipe-enemy-body"></div>

          <div class="ninja-swipe-enemy-arm"></div>

          <div class="ninja-swipe-enemy-sword"></div>

        </div>


        <!-- PLAYER -->

        <div
          class="ninja-swipe-player"
          data-ninja-player
        >

          <div class="ninja-swipe-player-head">
            <i></i>
          </div>

          <div class="ninja-swipe-player-body"></div>

          <div
            class="ninja-swipe-player-arm"
            data-ninja-arm
          ></div>

          <div
            class="ninja-swipe-player-sword"
            data-ninja-sword
          ></div>

        </div>


        <!-- SWIPE TRAIL -->

        <canvas
          class="ninja-swipe-canvas"
          data-ninja-canvas
        ></canvas>


        <!-- IMPACT -->

        <div
          class="ninja-swipe-sparks"
          data-ninja-sparks
        ></div>


        <div
          class="ninja-swipe-message"
          data-ninja-message
        ></div>


        <div
          class="ninja-swipe-combo-pop"
          data-ninja-combo-pop
        ></div>


        <div class="ninja-swipe-hint">
          SWIPE TO COUNTER
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

  const canvas =
    container.querySelector(
      "[data-ninja-canvas]"
    );

  const ctx =
    canvas.getContext("2d");

  const player =
    container.querySelector(
      "[data-ninja-player]"
    );

  const arm =
    container.querySelector(
      "[data-ninja-arm]"
    );

  const sword =
    container.querySelector(
      "[data-ninja-sword]"
    );

  const counterElement =
    container.querySelector(
      "[data-ninja-counter]"
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


  /* ==========================================
  CANVAS
  ========================================== */

  let canvasWidth = 0;
  let canvasHeight = 0;

  let drawing = false;

  let startX = 0;
  let startY = 0;

  let lastX = 0;
  let lastY = 0;

  let fadeFrame = null;


  function resizeCanvas() {
    const rect =
      stage.getBoundingClientRect();

    const dpr =
      Math.min(
        2,
        window.devicePixelRatio ||
        1
      );


    canvasWidth =
      rect.width;

    canvasHeight =
      rect.height;


    canvas.width =
      Math.max(
        1,
        Math.round(
          rect.width *
          dpr
        )
      );


    canvas.height =
      Math.max(
        1,
        Math.round(
          rect.height *
          dpr
        )
      );


    canvas.style.width =
      `${rect.width}px`;

    canvas.style.height =
      `${rect.height}px`;


    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );


    ctx.lineCap =
      "round";

    ctx.lineJoin =
      "round";
  }


  resizeCanvas();


  const resizeObserver =
    new ResizeObserver(
      resizeCanvas
    );


  resizeObserver.observe(
    stage
  );


  function clearCanvas() {
    ctx.clearRect(
      0,
      0,
      canvasWidth,
      canvasHeight
    );
  }


  function drawTrail(
    x1,
    y1,
    x2,
    y2
  ) {
    ctx.beginPath();

    ctx.moveTo(
      x1,
      y1
    );

    ctx.lineTo(
      x2,
      y2
    );


    ctx.strokeStyle =
      "rgba(220,255,235,.92)";

    ctx.lineWidth =
      7;

    ctx.shadowBlur =
      20;

    ctx.shadowColor =
      "rgba(105,255,155,.95)";

    ctx.stroke();


    ctx.beginPath();

    ctx.moveTo(
      x1,
      y1
    );

    ctx.lineTo(
      x2,
      y2
    );


    ctx.strokeStyle =
      "rgba(255,255,255,.98)";

    ctx.lineWidth =
      2.5;

    ctx.shadowBlur =
      5;

    ctx.shadowColor =
      "#ffffff";

    ctx.stroke();
  }


  function fadeTrail() {
    cancelAnimationFrame(
      fadeFrame
    );


    let opacity =
      1;


    function fade() {
      if (!active) {
        return;
      }


      opacity -=
        0.11;


      if (
        opacity <=
        0
      ) {
        clearCanvas();

        return;
      }


      ctx.save();


      ctx.globalCompositeOperation =
        "destination-out";


      ctx.fillStyle =
        "rgba(0,0,0,.22)";


      ctx.fillRect(
        0,
        0,
        canvasWidth,
        canvasHeight
      );


      ctx.restore();


      fadeFrame =
        requestAnimationFrame(
          fade
        );
    }


    fadeFrame =
      requestAnimationFrame(
        fade
      );
  }


  /* ==========================================
  POINTER
  ========================================== */

  function pointerDown(
    event
  ) {
    if (!active) {
      return;
    }


    const rect =
      stage.getBoundingClientRect();


    startX =
      event.clientX -
      rect.left;

    startY =
      event.clientY -
      rect.top;


    lastX =
      startX;

    lastY =
      startY;


    drawing =
      true;


    clearCanvas();


    canvas.setPointerCapture?.(
      event.pointerId
    );
  }


  function pointerMove(
    event
  ) {
    if (
      !active ||
      !drawing
    ) {
      return;
    }


    const rect =
      stage.getBoundingClientRect();


    const x =
      event.clientX -
      rect.left;

    const y =
      event.clientY -
      rect.top;


    drawTrail(
      lastX,
      lastY,
      x,
      y
    );


    lastX =
      x;

    lastY =
      y;
  }


  function pointerUp(
    event
  ) {
    if (
      !active ||
      !drawing
    ) {
      return;
    }


    drawing =
      false;


    const rect =
      stage.getBoundingClientRect();


    const endX =
      event.clientX -
      rect.left;

    const endY =
      event.clientY -
      rect.top;


    const dx =
      endX -
      startX;

    const dy =
      endY -
      startY;


    const distance =
      Math.hypot(
        dx,
        dy
      );


    fadeTrail();


    /*
     * 小さすぎる操作は無視
     */

    if (
      distance <
      38
    ) {
      return;
    }


    const direction =
      getSwipeDirection(
        dx,
        dy
      );


    choose(
      direction
    );
  }


  function pointerCancel() {
    drawing =
      false;

    fadeTrail();
  }


  function getSwipeDirection(
    dx,
    dy
  ) {
    /*
     * 上方向を優先判定
     */

    if (
      dy <
      -Math.abs(dx) *
      0.65
    ) {
      return "UP";
    }


    if (
      dx < 0
    ) {
      return "LEFT";
    }


    return "RIGHT";
  }


  canvas.addEventListener(
    "pointerdown",
    pointerDown
  );


  canvas.addEventListener(
    "pointermove",
    pointerMove
  );


  canvas.addEventListener(
    "pointerup",
    pointerUp
  );


  canvas.addEventListener(
    "pointercancel",
    pointerCancel
  );


  /* ==========================================
  KEYBOARD
  ========================================== */

  function keyDown(
    event
  ) {
    if (!active) {
      return;
    }


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


  window.addEventListener(
    "keydown",
    keyDown
  );


  /* ==========================================
  HELPERS
  ========================================== */

  function getEnemy(
    direction
  ) {
    return container.querySelector(
      `[data-ninja-enemy="${direction}"]`
    );
  }


  function clearTimers() {
    clearTimeout(
      attackTimer
    );

    clearTimeout(
      timeoutTimer
    );

    clearTimeout(
      nextTimer
    );
  }


  function clearEnemies() {
    enemies.forEach(
      enemy => {

        enemy.classList.remove(
          "attack",
          "fake",
          "countered",
          "retreat"
        );

      }
    );
  }


  function updateHud() {
    counterElement.textContent =
      counters;


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
  NEXT ROUND
  ========================================== */

  function nextRound() {
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


    const delay =
      Math.max(
        380,

        780 -
        counters *
        38
      ) +
      Math.random() *
      500;


    attackTimer =
      setTimeout(
        () => {

          if (!active) {
            return;
          }


          const useFake =
            counters >=
              2 &&
            Math.random() <
              0.22;


          if (
            useFake
          ) {
            fakeAttack();

          } else {
            realAttack();
          }

        },

        delay
      );
  }


  /* ==========================================
  FAKE
  ========================================== */

  function fakeAttack() {
    if (!active) {
      return;
    }


    fakeActive =
      true;


    const directions =
      [
        "LEFT",
        "UP",
        "RIGHT"
      ];


    const direction =
      directions[
        Math.floor(
          Math.random() *
          directions.length
        )
      ];


    const enemy =
      getEnemy(
        direction
      );


    enemy?.classList.add(
      "fake"
    );


    nextTimer =
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


          nextTimer =
            setTimeout(
              realAttack,

              170 +
              Math.random() *
              170
            );

        },

        300
      );
  }


  /* ==========================================
  REAL ATTACK
  ========================================== */

  function realAttack() {
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


    reactionStartedAt =
      performance.now();


    acceptingInput =
      true;


    const responseWindow =
      Math.max(
        470,

        720 -
        counters *
        28
      );


    timeoutTimer =
      setTimeout(
        () => {

          if (
            active &&
            acceptingInput
          ) {
            fail(
              "TOO SLOW"
            );
          }

        },

        responseWindow
      );
  }


  /* ==========================================
  ANSWER
  ========================================== */

  function choose(
    direction
  ) {
    if (!active) {
      return;
    }


    /*
     * フェイント中にスワイプ
     */

    if (
      fakeActive &&
      !acceptingInput
    ) {
      fail(
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
      success(
        direction,
        reaction
      );

    } else {

      fail(
        "MISS"
      );
    }
  }


  /* ==========================================
  SUCCESS
  ========================================== */

  function success(
    direction,
    reaction
  ) {
    counters++;


    combo++;


    maxCombo =
      Math.max(
        maxCombo,
        combo
      );


    reactionTimes.push(
      reaction
    );


    const enemy =
      getEnemy(
        answer
      );


    enemy?.classList.add(
      "countered"
    );


    /*
     * 主人公本体は傾けない。
     * 腕と刀だけ動かす。
     */

    player.classList.remove(
      "strike-left",
      "strike-up",
      "strike-right"
    );


    void player.offsetWidth;


    player.classList.add(
      `strike-${direction.toLowerCase()}`
    );


    createSparks(
      direction
    );


    showMessage(
      reaction <=
        250
        ? "PERFECT!"
        : "COUNTER!"
    );


    showCombo();


    stage.classList.remove(
      "ninja-swipe-hit"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "ninja-swipe-hit"
    );


    updateHud();


    nextTimer =
      setTimeout(
        () => {

          if (!active) {
            return;
          }


          enemy?.classList.add(
            "retreat"
          );


          player.classList.remove(
            "strike-left",
            "strike-up",
            "strike-right"
          );


          if (
            counters >=
            goal
          ) {
            finish(
              true
            );

            return;
          }


          nextTimer =
            setTimeout(
              nextRound,
              180
            );

        },

        220
      );
  }


  /* ==========================================
  FAIL
  ========================================== */

  function fail(
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
      "ninja-swipe-damage"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "ninja-swipe-damage"
    );


    updateHud();


    clearEnemies();


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

          420
        );

      return;
    }


    nextTimer =
      setTimeout(
        nextRound,
        500
      );
  }


  /* ==========================================
  MESSAGE
  ========================================== */

  function showMessage(
    text,
    failed = false
  ) {
    messageElement.textContent =
      text;


    messageElement.classList.remove(
      "show",
      "fail"
    );


    void messageElement.offsetWidth;


    if (
      failed
    ) {
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
      `
        ninja-swipe-sparks
        sparks-${direction.toLowerCase()}
      `;


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
        30 +
        Math.random() *
        65;


      spark.style.setProperty(
        "--x",

        `${Math.cos(angle) *
        distance}px`
      );


      spark.style.setProperty(
        "--y",

        `${Math.sin(angle) *
        distance}px`
      );


      sparks.appendChild(
        spark
      );
    }


    void sparks.offsetWidth;


    sparks.classList.add(
      "show"
    );
  }


  /* ==========================================
  FINISH
  ========================================== */

  function finish(
    successResult
  ) {
    if (!active) {
      return;
    }


    active =
      false;


    clearTimers();


    cancelAnimationFrame(
      fadeFrame
    );


    const elapsed =
      performance.now() -
      startedAt;


    const totalAttempts =
      counters +
      misses;


    const accuracy =
      counters /
      Math.max(
        1,
        totalAttempts
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
      clamp(
        counters /
        goal,

        0,

        1
      );


    const lifeScore =
      clamp(
        lives /
        3,

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
              finalScore
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
                  successResult
                    ? 10
                    : 0
                ),

                0,

                100
              )
            ),

          meta: {
            success:
              successResult,

            counters,

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


    cancelAnimationFrame(
      fadeFrame
    );


    resizeObserver.disconnect();


    canvas.removeEventListener(
      "pointerdown",
      pointerDown
    );


    canvas.removeEventListener(
      "pointermove",
      pointerMove
    );


    canvas.removeEventListener(
      "pointerup",
      pointerUp
    );


    canvas.removeEventListener(
      "pointercancel",
      pointerCancel
    );


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
