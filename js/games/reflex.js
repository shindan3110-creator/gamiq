// GAMIQ（ゲーミック） v2 - Advanced Reflex Games

import { byLevel, byLevelInt } from "../difficulty.js";

export function createReflexGames() {
  return [
    {
      id: "reflex_ninja_counter",
      type: "ninja_counter",
      title: "NINJA COUNTER",
      rule: "HIT THE ENEMY NINJAS. DON'T HIT FRIENDS!",
      skill: "REFLEX",
      theme: "ninja",
      duration: 12000
    },

    {
      id: "reflex_quick_draw",
      type: "quick_draw",
      title: "QUICK DRAW",
      rule: "WAIT FOR \"DRAW!\" THEN SHOOT FAST!",
      skill: "REFLEX",
      theme: "western",
      duration: 12000
    },

    {
      id: "reflex_lane_panic",
      type: "lane_panic",
      title: "LANE PANIC",
      rule: "MOVE AWAY FROM THE ⚠ LANE!",
      skill: "REFLEX",
      theme: "cyber",
      duration: 12000
    },

    {
      id: "reflex_friend_foe",
      type: "friend_foe",
      title: "FRIEND OR FOE",
      rule: "SHOOT THE RED ENEMIES. DON'T HIT BLUE FRIENDS!",
      skill: "AIM",
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
        onComplete,
        level: game.level
      });

    case "quick_draw":
      return runQuickDraw({
        container,
        onComplete,
        level: game.level
      });

    case "lane_panic":
      return runLanePanic({
        container,
        onComplete,
        level: game.level
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
  onComplete,
  level = 1
}) {
  let active = true;

  let score = 0;
  let misses = 0;

  let combo = 0;
  let maxCombo = 0;

  let lives = 3;

  const goal = 12;


  /*
   * DIFFICULTY BY LEVEL (Lv1 = same as before)
   * - Ninjas pop out faster and stay a shorter time.
   * - Friends / fakes / bamboo feints come earlier and more often.
   */
  const waitBase = byLevel(level, 650, 430);
  const showBase = byLevel(level, 850, 560);
  const showMin = byLevel(level, 460, 340);

  const friendFrom = byLevelInt(level, 3, 1);
  const friendRate = byLevel(level, 0.18, 0.26);

  const fakeFrom = byLevelInt(level, 6, 3);
  const fakeRate = byLevel(level, 0.11, 0.17);

  const feintFrom = byLevelInt(level, 2, 0);
  const feintRate = byLevel(level, 0.35, 0.55);

  let round = 0;

  let currentTarget = null;
  let currentType = null;

  let spawnTimer = null;
  let hideTimer = null;
  let nextTimer = null;
  let feintTimer = null;
  let feintClearTimer = null;

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

    clearTimeout(
      feintTimer
    );

    clearTimeout(
      feintClearTimer
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

        waitBase -
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


    /*
     * FEINT: while you wait, the bamboo at another gap
     * rustles, but nobody comes out.
     * Tapping it breaks your combo.
     */

    if (
      score >= feintFrom &&
      Math.random() < feintRate
    ) {
      feintTimer =
        setTimeout(
          rustleDecoy,
          delay * 0.45
        );
    }
  }


  function rustleDecoy() {
    if (!active) {
      return;
    }

    const free =
      holes.filter(
        hole => hole !== currentTarget
      );

    const decoy =
      free[
        Math.floor(
          Math.random() *
          free.length
        )
      ];

    if (!decoy) {
      return;
    }

    decoy.classList.remove("rustle-decoy");
    void decoy.offsetWidth;
    decoy.classList.add("rustle-decoy");

    feintClearTimer =
      setTimeout(
        () => decoy.classList.remove("rustle-decoy"),
        420
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
      score >= friendFrom &&
      roll <
      friendRate
    ) {
      type =
        "friend";
    }


    if (
      score >= fakeFrom &&
      roll >=
        friendRate &&
      roll <
        friendRate + fakeRate
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
        showMin,

        showBase -
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

      // Tapped a rustling gap with nobody in it.
      if (
        hole.classList.contains(
          "rustle-decoy"
        )
      ) {
        hole.classList.remove(
          "rustle-decoy"
        );

        combo = 0;

        showMessage(
          "FEINT!",
          true
        );

        updateHud();
      }

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
          "fake",
          "rustle-decoy"
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
  onComplete,
  level = 1
}) {
  let active = true;
  let round = 0;

  let canShoot = false;
  let falseStarts = 0;
  let hits = 0;

  const rounds = 5;
  const reactions = [];


  /*
   * DIFFICULTY BY LEVEL (Lv1 = same as before)
   * - Less time to shoot after DRAW!
   * - More fake-outs (the opponent twitches before drawing).
   */
  const shootWindow = byLevelInt(level, 720, 520);
  const fakeOutRate = byLevel(level, 0.45, 0.7);

  let timer = null;
  let signalTime = 0;

  // Effect timers are kept separately so they never block the game flow.
  const fxTimers = new Set();

  function later(fn, ms) {
    const id = setTimeout(() => {
      fxTimers.delete(id);
      fn();
    }, ms);

    fxTimers.add(id);
  }


  container.innerHTML = `
    <div class="reflex-game duel-game qd-game">

      <div class="duel-arena qd-arena" data-duel-arena>

        <!-- SKY / FAR -->
        <div class="qd-sky"></div>
        <div class="qd-sun"></div>
        <div class="qd-mesa"></div>

        <!-- TOWN (perspective walls) -->
        <div class="qd-street">
          <div class="qd-town qd-town-left">
            <i></i><i></i><i></i>
          </div>
          <div class="qd-town qd-town-right">
            <i></i><i></i><i></i>
          </div>
          <div class="qd-ground"></div>
        </div>

        <div class="qd-tumbleweed"></div>

        <!-- OPPONENT -->
        <div class="qd-opponent" data-duel-opponent>
          <div class="qd-shadow"></div>

          <div class="qd-body">
            <svg viewBox="0 0 120 200" aria-hidden="true">
              <!-- legs -->
              <rect x="40" y="128" width="15" height="62" rx="5" fill="#2b2320"/>
              <rect x="65" y="128" width="15" height="62" rx="5" fill="#2b2320"/>
              <rect x="36" y="184" width="22" height="10" rx="4" fill="#120d0b"/>
              <rect x="62" y="184" width="22" height="10" rx="4" fill="#120d0b"/>

              <!-- body / poncho -->
              <path d="M30 72 Q60 58 90 72 L98 136 Q60 146 22 136 Z" fill="#8a3b25"/>
              <path d="M30 96 L90 96 M28 112 L92 112" stroke="#d9a35b" stroke-width="4" opacity=".75"/>
              <rect x="34" y="124" width="52" height="7" rx="3" fill="#3a2a1f"/>
              <rect x="77" y="122" width="10" height="20" rx="3" fill="#4a3424"/>

              <!-- head + bandana -->
              <circle cx="60" cy="46" r="17" fill="#d6a17a"/>
              <path d="M43 50 Q60 66 77 50 L77 58 Q60 72 43 58 Z" fill="#b8323a"/>
              <rect x="49" y="40" width="7" height="3" rx="1.5" fill="#1b1210"/>
              <rect x="64" y="40" width="7" height="3" rx="1.5" fill="#1b1210"/>

              <!-- left arm -->
              <rect x="18" y="76" width="13" height="50" rx="6" fill="#7a3220" transform="rotate(8 24 78)"/>
            </svg>

            <!-- gun arm (rotates up on DRAW) -->
            <div class="qd-arm">
              <svg viewBox="0 0 40 80" aria-hidden="true">
                <rect x="13" y="0" width="13" height="50" rx="6" fill="#7a3220"/>
                <circle cx="19.5" cy="52" r="7" fill="#d6a17a"/>
                <rect x="15" y="54" width="9" height="24" rx="2" fill="#2d2f33"/>
                <rect x="17" y="54" width="5" height="10" fill="#6d4a2e"/>
              </svg>
              <div class="qd-enemy-flash"></div>
            </div>

          </div>

          <div class="qd-impact" data-qd-impact></div>

          <!-- hat (separate, flies off on hit) -->
          <div class="qd-hat">
            <svg viewBox="0 0 80 34" aria-hidden="true">
              <ellipse cx="40" cy="27" rx="38" ry="6" fill="#3b2617"/>
              <path d="M20 27 Q20 4 40 4 Q60 4 60 27 Z" fill="#5a3a22"/>
              <rect x="20" y="20" width="40" height="5" fill="#1e140c"/>
            </svg>
          </div>
        </div>

        <div class="qd-ground-dust" data-qd-dust></div>

        <!-- PLAYER GUN -->
        <div class="qd-gun" data-qd-gun>
          <svg viewBox="0 0 160 120" aria-hidden="true">
            <!-- hand / sleeve -->
            <path d="M118 120 L104 70 Q112 58 130 62 L160 92 L160 120 Z" fill="#5b3b28"/>
            <ellipse cx="108" cy="74" rx="20" ry="16" fill="#d6a17a"/>
            <!-- revolver -->
            <rect x="18" y="38" width="80" height="13" rx="3" fill="#8d949c"/>
            <rect x="18" y="38" width="80" height="4" rx="2" fill="#c9d0d6"/>
            <rect x="74" y="34" width="36" height="28" rx="6" fill="#6c737b"/>
            <circle cx="88" cy="48" r="9" fill="#4c5258"/>
            <circle cx="88" cy="48" r="3" fill="#2b2f33"/>
            <path d="M96 58 L112 58 L118 96 L100 98 Z" fill="#6d4a2e"/>
            <rect x="12" y="40" width="8" height="9" rx="2" fill="#5d646b"/>
          </svg>
          <div class="qd-muzzle"></div>
          <div class="qd-smoke"></div>
        </div>

        <div class="qd-tracer" data-qd-tracer></div>

        <div class="qd-hurt"></div>

        <!-- ROUNDS -->
        <div class="qd-chambers" data-qd-chambers>
          ${Array.from({ length: rounds }, () => "<i></i>").join("")}
        </div>

        <div class="duel-message qd-message" data-duel-message>
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


  const arena = container.querySelector("[data-duel-arena]");
  const opponent = container.querySelector("[data-duel-opponent]");
  const message = container.querySelector("[data-duel-message]");
  const shootButton = container.querySelector("[data-duel-shoot]");
  const gun = container.querySelector("[data-qd-gun]");
  const tracer = container.querySelector("[data-qd-tracer]");
  const dust = container.querySelector("[data-qd-dust]");
  const chambers = [...container.querySelectorAll("[data-qd-chambers] i")];


  /* ---------- EFFECT HELPERS ---------- */

  function restartClass(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  function markChamber(type, text = "") {
    const chamber = chambers[round];

    if (!chamber) {
      return;
    }

    chamber.className = type;
    chamber.textContent = text;
  }

  // Player gun: recoil + muzzle flash + smoke
  function fireGun() {
    restartClass(gun, "qd-fire");
    later(() => gun.classList.remove("qd-fire"), 600);
  }

  // A bullet line from the gun to a point in the arena
  function shootTracer(toX, toY) {
    const arenaRect = arena.getBoundingClientRect();
    const gunRect = gun.getBoundingClientRect();

    // muzzle = left end of the barrel
    const fromX = gunRect.left - arenaRect.left + gunRect.width * 0.1;
    const fromY = gunRect.top - arenaRect.top + gunRect.height * 0.37;

    const dx = toX - fromX;
    const dy = toY - fromY;

    tracer.style.left = `${fromX}px`;
    tracer.style.top = `${fromY}px`;
    tracer.style.width = `${Math.hypot(dx, dy)}px`;
    tracer.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;

    restartClass(tracer, "show");
    later(() => tracer.classList.remove("show"), 260);
  }

  function chestPoint() {
    const arenaRect = arena.getBoundingClientRect();
    const rect = opponent.getBoundingClientRect();

    return {
      x: rect.left - arenaRect.left + rect.width * 0.5,
      y: rect.top - arenaRect.top + rect.height * 0.5
    };
  }


  /* ---------- ROUND ---------- */

  function startRound() {
    canShoot = false;

    message.textContent = "WAIT...";

    opponent.classList.remove("duel-hit", "qd-hit", "qd-draw", "qd-shoot", "duel-fake");
    arena.classList.remove("duel-draw", "qd-hurt-on");

    const fakeOut = Math.random() < fakeOutRate;

    const firstDelay = 700 + Math.random() * 900;

    timer = setTimeout(() => {
      if (!active) {
        return;
      }

      if (fakeOut) {
        message.textContent = "...";

        opponent.classList.add("duel-fake");

        timer = setTimeout(() => {
          opponent.classList.remove("duel-fake");
          showDraw();
        }, 500 + Math.random() * 500);
      } else {
        showDraw();
      }
    }, firstDelay);
  }

  function showDraw() {
    if (!active) {
      return;
    }

    canShoot = true;
    signalTime = performance.now();

    message.textContent = "DRAW!";

    arena.classList.add("duel-draw");
    opponent.classList.add("qd-draw");

    timer = setTimeout(() => {
      if (active && canShoot) {
        canShoot = false;

        // The opponent shoots you.
        message.textContent = "TOO SLOW";

        opponent.classList.add("qd-shoot");
        restartClass(arena, "qd-hurt-on");
        restartClass(arena, "reflex-screen-fail");

        markChamber("slow", "✕");

        round++;

        timer = setTimeout(() => {
          arena.classList.remove("reflex-screen-fail");
          nextOrFinish();
        }, 650);
      }
    }, shootWindow);
  }

  function shoot() {
    if (!active) {
      return;
    }

    if (!canShoot) {
      // Fired too early: the bullet hits the ground.
      falseStarts++;

      message.textContent = "TOO EARLY";

      fireGun();

      const arenaRect = arena.getBoundingClientRect();
      const x = arenaRect.width * (0.3 + Math.random() * 0.4);
      const y = arenaRect.height * (0.74 + Math.random() * 0.08);

      shootTracer(x, y);

      dust.style.left = `${x}px`;
      dust.style.top = `${y}px`;
      restartClass(dust, "show");

      restartClass(arena, "reflex-screen-fail");

      later(() => arena.classList.remove("reflex-screen-fail"), 220);

      return;
    }

    clearTimeout(timer);

    canShoot = false;

    hits++;

    const reaction = performance.now() - signalTime;

    reactions.push(reaction);

    message.textContent = `${Math.round(reaction)} ms`;

    fireGun();

    const chest = chestPoint();
    shootTracer(chest.x, chest.y);

    // Hit: impact flash, hat flies, opponent falls back
    opponent.classList.add("duel-hit", "qd-hit");

    restartClass(arena, "reflex-screen-hit");

    markChamber(reaction <= 300 ? "fast" : "hit", String(Math.round(reaction)));

    round++;

    timer = setTimeout(() => {
      arena.classList.remove("reflex-screen-hit");
      nextOrFinish();
    }, 900);
  }

  function nextOrFinish() {
    if (round >= rounds) {
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
        ? average(reactions)
        : 900;

    const speed =
      clamp(100 - (avgReaction - 180) / 5, 0, 100);

    const accuracy =
      hits / rounds;

    const score =
      speed * 0.55 +
      accuracy * 100 * 0.45 -
      falseStarts * 8;

    onComplete?.({
      score: Math.round(clamp(score, 0, 100)),

      adapt: Math.round(
        clamp(50 + accuracy * 35 - falseStarts * 5, 0, 100)
      ),

      meta: {
        hits,
        falseStarts,
        avgReaction: Math.round(avgReaction)
      }
    });
  }


  shootButton.addEventListener("pointerdown", shoot);

  startRound();


  return () => {
    active = false;

    clearTimeout(timer);

    fxTimers.forEach(id => clearTimeout(id));
    fxTimers.clear();

    shootButton.removeEventListener("pointerdown", shoot);
  };
}

/* ==========================================
LANE PANIC (v2: no free points for standing still)
- Each round, 2 of the 3 lanes are dangerous.
- YOUR lane is always one of them, so you must move.
- The safe lane can be 2 lanes away (2 taps needed).
- Rounds get faster as you go.
========================================== */

function runLanePanic({
  container,
  onComplete,
  level = 1
}) {
  let active = true;

  let lane = 1;
  let round = 0;
  let survived = 0;

  const rounds = 8;


  /*
   * DIFFICULTY BY LEVEL (Lv1 = same as before)
   * Less time to reach the safe lane.
   *   Lv1 : 1.00s -> 0.65s
   *   Lv10: 0.75s -> 0.45s
   */
  const windowStart = byLevel(level, 1000, 750);
  const windowEnd = byLevel(level, 650, 450);

  let safeLane = null;
  let reachedSafeAt = null;

  const reactions = [];

  let signalTime = 0;
  let timer = null;
  let nextTimer = null;

  const startedAt =
    performance.now();


  container.innerHTML = `
    <div class="reflex-game lane-panic-game">

      <div
        class="lane-panic-arena"
        data-lane-arena
      >

        <div class="lane-panic-road">

          <div
            class="lane-panic-round"
            data-lane-round
          >
            1 / ${rounds}
          </div>

          <div
            class="lane-warning"
            data-lane-warning
          >
            ⚠
          </div>

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

  const warnings =
    [
      ...container.querySelectorAll(
        "[data-lane-warning]"
      )
    ];

  const roundLabel =
    container.querySelector(
      "[data-lane-round]"
    );

  const leftButton =
    container.querySelector(
      "[data-lane-left]"
    );

  const rightButton =
    container.querySelector(
      "[data-lane-right]"
    );


  function laneLeft(index) {
    return `${16.5 + index * 33.5}%`;
  }


  function updatePlayer() {
    player.style.left =
      laneLeft(lane);
  }


  function roundWindow() {
    // windowStart at the first round -> windowEnd in the last round
    return Math.round(
      windowStart -
      (round / Math.max(1, rounds - 1)) * (windowStart - windowEnd)
    );
  }


  function nextRound() {
    if (!active) {
      return;
    }

    roundLabel.textContent =
      `${round + 1} / ${rounds}`;

    // The safe lane is never the lane you are in now.
    const options =
      [0, 1, 2].filter(
        index => index !== lane
      );

    safeLane =
      options[
        Math.floor(
          Math.random() *
          options.length
        )
      ];

    reachedSafeAt = null;

    const dangerLanes =
      [0, 1, 2].filter(
        index => index !== safeLane
      );

    const windowMs =
      roundWindow();

    warnings.forEach(
      (warning, i) => {
        warning.style.left =
          laneLeft(dangerLanes[i]);

        warning.style.animationDuration =
          `${windowMs}ms`;

        warning.classList.remove(
          "show"
        );

        void warning.offsetWidth;

        warning.classList.add(
          "show"
        );
      }
    );

    signalTime =
      performance.now();

    timer =
      setTimeout(
        resolveRound,
        windowMs
      );
  }


  function changeLane(
    direction
  ) {
    if (
      !active ||
      safeLane === null
    ) {
      return;
    }

    lane =
      clamp(
        lane + direction,
        0,
        2
      );

    updatePlayer();

    // Reaction = time until you first reach the safe lane.
    if (
      lane === safeLane &&
      reachedSafeAt === null
    ) {
      reachedSafeAt =
        performance.now();
    }
  }


  function resolveRound() {
    if (!active) {
      return;
    }

    const safe =
      lane === safeLane;

    if (safe) {
      survived++;

      reactions.push(
        (reachedSafeAt ?? performance.now()) -
        signalTime
      );

      player.classList.add(
        "lane-safe"
      );
    } else {
      player.classList.add(
        "lane-crash"
      );
    }

    safeLane = null;

    round++;

    nextTimer =
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
        320
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
      event.preventDefault();
      left();
    }

    if (
      event.key ===
      "ArrowRight"
    ) {
      event.preventDefault();
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
    if (!active) {
      return;
    }

    active = false;

    clearTimeout(timer);
    clearTimeout(nextTimer);

    const successRate =
      survived / rounds;

    // Only successful rounds have a reaction time.
    const avgReaction =
      reactions.length
        ? average(
            reactions
          )
        : 1000;

    // 200ms -> 100, 700ms -> 0
    const reactionScore =
      clamp(
        100 -
        (
          avgReaction -
          200
        ) / 5,
        0,
        100
      );

    // Reaction only counts as much as you actually survived.
    const score =
      successRate * 70 +
      reactionScore * 0.30 * successRate;

    onComplete?.({
      score:
        Math.round(
          clamp(score, 0, 100)
        ),

      adapt:
        Math.round(
          clamp(
            40 +
            successRate * 50,
            0,
            100
          )
        ),

      meta: {
        success:
          survived >= 6,
        survived,
        rounds,
        avgReaction:
          Math.round(avgReaction),
        elapsed:
          Math.round(
            performance.now() -
            startedAt
          )
      }
    });
  }


  updatePlayer();

  // Short pause so the first round is not a surprise.
  nextTimer =
    setTimeout(
      nextRound,
      400
    );


  return () => {
    active = false;

    clearTimeout(timer);
    clearTimeout(nextTimer);

    leftButton.removeEventListener(
      "pointerdown",
      left
    );

    rightButton.removeEventListener(
      "pointerdown",
      right
    );

    window.removeEventListener(
      "keydown",
      keyDown
    );
  };
}


/* ==========================================
FRIEND OR FOE (v2: AIM game with moving targets)
- Red enemies and blue friends fly around the arena.
- Tap / click the red enemies before they escape.
- Hitting a blue friend is a big penalty.
- Missed shots lower your accuracy.
- 10 enemies in total. Hit 7 or more to clear.
========================================== */

const FOE_ENEMY_TOTAL = 10;
const FOE_CLEAR_HITS = 7;

const FOE_ENEMY_SVG = `
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="#ff3b5c"/>
    <circle cx="50" cy="50" r="46" fill="none" stroke="#ffd0d8" stroke-width="5"/>
    <path d="M24 38 L44 46" stroke="#2a0710" stroke-width="8" stroke-linecap="round"/>
    <path d="M76 38 L56 46" stroke="#2a0710" stroke-width="8" stroke-linecap="round"/>
    <circle cx="36" cy="55" r="6" fill="#2a0710"/>
    <circle cx="64" cy="55" r="6" fill="#2a0710"/>
    <path d="M36 74 Q50 64 64 74" stroke="#2a0710" stroke-width="7" fill="none" stroke-linecap="round"/>
  </svg>
`;

const FOE_FRIEND_SVG = `
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="#3fb8ff"/>
    <circle cx="50" cy="50" r="46" fill="none" stroke="#d8f1ff" stroke-width="5"/>
    <circle cx="36" cy="44" r="6" fill="#06263a"/>
    <circle cx="64" cy="44" r="6" fill="#06263a"/>
    <path d="M32 62 Q50 80 68 62" stroke="#06263a" stroke-width="7" fill="none" stroke-linecap="round"/>
  </svg>
`;


function runFriendOrFoe({
  container,
  onComplete
}) {
  let active = true;

  let enemiesSpawned = 0;
  let enemiesResolved = 0;

  let hits = 0;
  let escaped = 0;
  let friendHits = 0;

  let shots = 0;
  let missedShots = 0;

  const reactions = [];

  const targets = [];

  let spawnTimer = null;
  let finishTimer = null;
  let frameId = null;
  let lastFrame = performance.now();

  const startedAt = performance.now();


  container.innerHTML = `
    <div class="reflex-game foe2-game">

      <div class="foe2-hud">
        <div>
          <span>HITS</span>
          <strong data-foe-hits>0 / ${FOE_ENEMY_TOTAL}</strong>
        </div>

        <div>
          <span>ACCURACY</span>
          <strong data-foe-accuracy>--</strong>
        </div>

        <div>
          <span>FRIEND HIT</span>
          <strong data-foe-friend>0</strong>
        </div>
      </div>

      <div class="foe2-arena" data-foe-arena>
        <div class="foe2-message" data-foe-message></div>
      </div>

    </div>
  `;

  const arena =
    container.querySelector("[data-foe-arena]");

  const hitsElement =
    container.querySelector("[data-foe-hits]");

  const accuracyElement =
    container.querySelector("[data-foe-accuracy]");

  const friendElement =
    container.querySelector("[data-foe-friend]");

  const messageElement =
    container.querySelector("[data-foe-message]");


  /* ---------- HELPERS ---------- */

  function targetSize() {
    // Smaller targets on small screens are still easy to tap.
    return arena.clientWidth < 480 ? 54 : 62;
  }

  function progress() {
    return enemiesSpawned / FOE_ENEMY_TOTAL;
  }

  function updateHud() {
    hitsElement.textContent =
      `${hits} / ${FOE_ENEMY_TOTAL}`;

    accuracyElement.textContent =
      shots > 0
        ? `${Math.round(100 * (shots - missedShots - friendHits) / shots)}%`
        : "--";

    friendElement.textContent =
      String(friendHits);
  }

  let messageTimer = null;

  function showMessage(text, type = "good") {
    clearTimeout(messageTimer);

    messageElement.textContent = text;
    messageElement.className = `foe2-message ${type}`;

    void messageElement.offsetWidth;

    messageElement.classList.add("show");

    messageTimer = setTimeout(() => {
      messageElement.classList.remove("show");
    }, 450);
  }


  /* ---------- SPAWN ---------- */

  function spawn(kind) {
    const size = targetSize();
    const width = arena.clientWidth;
    const height = arena.clientHeight;

    if (width < size * 2 || height < size * 2) {
      return;
    }

    const element = document.createElement("div");

    element.className = `foe2-target ${kind}`;
    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    element.innerHTML =
      kind === "enemy"
        ? FOE_ENEMY_SVG
        : FOE_FRIEND_SVG;

    arena.appendChild(element);

    // Speed rises as the game goes on (px per second).
    const speed =
      (kind === "enemy" ? 120 : 100) +
      progress() * 110 +
      Math.random() * 40;

    const angle = Math.random() * Math.PI * 2;

    const target = {
      element,
      kind,
      size,
      x: size / 2 + Math.random() * (width - size),
      y: size / 2 + Math.random() * (height - size),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      born: performance.now(),
      life:
        kind === "enemy"
          ? 2500 - progress() * 800
          : 2800,
      done: false
    };

    placeTarget(target);

    targets.push(target);

    if (kind === "enemy") {
      enemiesSpawned++;
    }
  }

  function scheduleSpawn() {
    if (!active) {
      return;
    }

    const enemiesOnScreen =
      targets.filter(t => t.kind === "enemy" && !t.done).length;

    const friendsOnScreen =
      targets.filter(t => t.kind === "friend" && !t.done).length;

    if (
      enemiesSpawned < FOE_ENEMY_TOTAL &&
      enemiesOnScreen < 2 &&
      (Math.random() < 0.72 || friendsOnScreen >= 2)
    ) {
      spawn("enemy");
    } else if (friendsOnScreen < 2) {
      spawn("friend");
    }

    if (enemiesSpawned < FOE_ENEMY_TOTAL) {
      spawnTimer = setTimeout(
        scheduleSpawn,
        650 + Math.random() * 450 - progress() * 200
      );
    }
  }


  /* ---------- MOVE ---------- */

  function placeTarget(target) {
    target.element.style.transform =
      `translate(${target.x - target.size / 2}px, ${target.y - target.size / 2}px)`;
  }

  function frame(now) {
    if (!active) {
      return;
    }

    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    const width = arena.clientWidth;
    const height = arena.clientHeight;

    for (const target of [...targets]) {
      if (target.done) {
        continue;
      }

      target.x += target.vx * dt;
      target.y += target.vy * dt;

      const half = target.size / 2;

      // Bounce off the walls.
      if (target.x < half) {
        target.x = half;
        target.vx = Math.abs(target.vx);
      }

      if (target.x > width - half) {
        target.x = width - half;
        target.vx = -Math.abs(target.vx);
      }

      if (target.y < half) {
        target.y = half;
        target.vy = Math.abs(target.vy);
      }

      if (target.y > height - half) {
        target.y = height - half;
        target.vy = -Math.abs(target.vy);
      }

      placeTarget(target);

      const age = now - target.born;

      // Warn just before an enemy escapes.
      target.element.classList.toggle(
        "leaving",
        age > target.life - 450
      );

      if (age >= target.life) {
        removeTarget(target, "escape");

        if (target.kind === "enemy") {
          escaped++;
          enemiesResolved++;
          showMessage("ESCAPED", "bad");
          checkEnd();
        }
      }
    }

    frameId = requestAnimationFrame(frame);
  }

  function removeTarget(target, reason) {
    target.done = true;

    target.element.classList.add(
      reason === "hit" ? "hit" : "gone"
    );

    setTimeout(() => {
      target.element.remove();

      const index = targets.indexOf(target);

      if (index !== -1) {
        targets.splice(index, 1);
      }
    }, 260);
  }


  /* ---------- SHOOT ---------- */

  function shoot(event) {
    if (!active) {
      return;
    }

    event.preventDefault();

    shots++;

    const element =
      event.target.closest?.(".foe2-target");

    const target =
      element &&
      targets.find(t => t.element === element && !t.done);

    if (!target) {
      missedShots++;

      showShotMark(event, "miss");
      updateHud();
      return;
    }

    if (target.kind === "enemy") {
      hits++;
      enemiesResolved++;

      reactions.push(performance.now() - target.born);

      removeTarget(target, "hit");
      showShotMark(event, "hit");
      showMessage("HIT!");

      updateHud();
      checkEnd();
      return;
    }

    // Friend hit
    friendHits++;

    removeTarget(target, "hit");
    showShotMark(event, "miss");
    showMessage("FRIEND!", "bad");

    arena.classList.remove("foe2-damage");
    void arena.offsetWidth;
    arena.classList.add("foe2-damage");

    updateHud();
  }

  function showShotMark(event, type) {
    const rect = arena.getBoundingClientRect();

    const mark = document.createElement("div");

    mark.className = `foe2-shot ${type}`;
    mark.style.left = `${event.clientX - rect.left}px`;
    mark.style.top = `${event.clientY - rect.top}px`;

    arena.appendChild(mark);

    setTimeout(() => mark.remove(), 350);
  }


  /* ---------- FINISH ---------- */

  function checkEnd() {
    if (enemiesResolved >= FOE_ENEMY_TOTAL) {
      finish();
    }
  }

  function finish() {
    if (!active) {
      return;
    }

    active = false;

    clearTimeout(spawnTimer);
    cancelAnimationFrame(frameId);

    targets.forEach(t => {
      if (!t.done) {
        removeTarget(t, "escape");
      }
    });

    const hitRate = hits / FOE_ENEMY_TOTAL;

    const accuracy =
      shots > 0
        ? Math.max(0, shots - missedShots - friendHits) / shots
        : 0;

    const avgReaction =
      reactions.length
        ? average(reactions)
        : 2500;

    // 500ms -> 100, 2000ms -> 0
    const reactionScore =
      clamp(100 - (avgReaction - 500) / 15, 0, 100);

    const score =
      hitRate * 55 +
      accuracy * 25 * hitRate +
      reactionScore * 0.2 * hitRate -
      friendHits * 10;

    const success =
      hits >= FOE_CLEAR_HITS &&
      friendHits === 0;

    showMessage(
      success ? "CLEAR!" : "FAILED",
      success ? "good" : "bad"
    );

    finishTimer = setTimeout(() => {
      onComplete?.({
        score: Math.round(clamp(score, 0, 100)),

        adapt: Math.round(
          clamp(
            35 + hitRate * 45 + accuracy * 20 - friendHits * 8,
            0,
            100
          )
        ),

        meta: {
          success,
          hits,
          escaped,
          friendHits,
          shots,
          missedShots,
          avgReaction: Math.round(avgReaction),
          elapsed: Math.round(performance.now() - startedAt)
        }
      });
    }, 500);
  }


  /* ---------- START ---------- */

  arena.addEventListener("pointerdown", shoot);

  updateHud();

  spawnTimer = setTimeout(scheduleSpawn, 350);
  frameId = requestAnimationFrame(frame);


  return () => {
    active = false;

    clearTimeout(spawnTimer);
    clearTimeout(finishTimer);
    clearTimeout(messageTimer);
    cancelAnimationFrame(frameId);

    arena.removeEventListener("pointerdown", shoot);
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
