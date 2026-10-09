// GAMIQ（ゲーミック） v2
// HIGHWAY DODGE
//
// 操作:
// PC   : ← →
// Mobile: 左右ボタン
//
// 終了:
// 10台回避 → CLEAR
// LIFE 0 → GAME OVER

import {
  GamiqThreeScene
} from "./three-renderer.js";


export async function runRace3D({
  container,
  onComplete
}) {
  if (!container) {
    return () => {};
  }


  /* ==========================================
  STATE
  ========================================== */

  let active = true;

  let lane = 1;

  let avoided = 0;
  let crashes = 0;

  let combo = 0;
  let maxCombo = 0;

  let lives = 3;

  let invincible = false;

  let screenShake = 0;

  const goal = 10;

  const startedAt =
    performance.now();


  /* ==========================================
  HTML
  ========================================== */

  container.innerHTML = `
    <div class="highway-dodge-wrap">

      <div class="highway-dodge-hud">

        <div class="highway-hud-item">
          <span>DODGED</span>

          <strong>
            <b data-highway-dodged>
              0
            </b>
            / ${goal}
          </strong>
        </div>


        <div class="highway-hud-item">
          <span>COMBO</span>

          <strong data-highway-combo>
            0
          </strong>
        </div>


        <div class="highway-hud-item">
          <span>SPEED</span>

          <strong data-highway-speed>
            1.0x
          </strong>
        </div>

      </div>


      <div
        class="highway-dodge-stage"
        data-highway-stage
      >

        <div
          class="highway-dodge-world"
          data-highway-world
        ></div>


        <div
          class="highway-message"
          data-highway-message
        ></div>


        <div
          class="highway-combo-pop"
          data-highway-combo-pop
        ></div>


        <div class="highway-life-panel">

          <span>
            LIFE
          </span>

          <strong data-highway-lives>
            ♥ ♥ ♥
          </strong>

        </div>


        <div class="highway-hint">
          ← DODGE →
        </div>

      </div>


      <div class="highway-controls">

        <button
          type="button"
          class="highway-control-button"
          data-highway-left
          aria-label="Move left"
        >
          ←
        </button>

        <button
          type="button"
          class="highway-control-button"
          data-highway-right
          aria-label="Move right"
        >
          →
        </button>

      </div>

    </div>
  `;


  /* ==========================================
  ELEMENTS
  ========================================== */

  const worldElement =
    container.querySelector(
      "[data-highway-world]"
    );

  const stage =
    container.querySelector(
      "[data-highway-stage]"
    );

  const dodgedElement =
    container.querySelector(
      "[data-highway-dodged]"
    );

  const comboElement =
    container.querySelector(
      "[data-highway-combo]"
    );

  const speedElement =
    container.querySelector(
      "[data-highway-speed]"
    );

  const livesElement =
    container.querySelector(
      "[data-highway-lives]"
    );

  const messageElement =
    container.querySelector(
      "[data-highway-message]"
    );

  const comboPop =
    container.querySelector(
      "[data-highway-combo-pop]"
    );

  const leftButton =
    container.querySelector(
      "[data-highway-left]"
    );

  const rightButton =
    container.querySelector(
      "[data-highway-right]"
    );


  /* ==========================================
  WORLD
  ========================================== */

  const world =
    new GamiqThreeScene({
      container:
        worldElement,

      cameraZ:
        8,

      background:
        0x03060a
    });


  const initialized =
    await world.init();


  if (!initialized) {
    container.innerHTML = `
      <div class="race-3d-fallback">
        3Dの読み込みに失敗しました
      </div>
    `;

    return () => {};
  }


  const T =
    world.THREE;


  /* ==========================================
  CAMERA
  ========================================== */

  world.camera.position.set(
    0,
    3.7,
    8
  );


  world.camera.lookAt(
    0,
    -0.6,
    -13
  );


  /* ==========================================
  LIGHTS
  ========================================== */

  const mainLight =
    new T.DirectionalLight(
      0xffffff,
      2.5
    );


  mainLight.position.set(
    0,
    8,
    6
  );


  world.scene.add(
    mainLight
  );


  const blueLight =
    new T.PointLight(
      0x49ddff,
      3,
      20
    );


  blueLight.position.set(
    -5,
    2,
    1
  );


  world.scene.add(
    blueLight
  );


  const pinkLight =
    new T.PointLight(
      0xff3e72,
      2.4,
      20
    );


  pinkLight.position.set(
    5,
    1,
    -8
  );


  world.scene.add(
    pinkLight
  );


  /* ==========================================
  ROAD
  ========================================== */

  const road =
    world.addFloor({
      width:
        10,

      depth:
        70,

      color:
        0x111722,

      y:
        -2
    });


  road.position.z =
    -20;


  /*
   * ROAD SIDE
   */

  const shoulderMaterial =
    new T.MeshStandardMaterial({
      color:
        0x202733,

      roughness:
        0.95
    });


  const leftShoulder =
    new T.Mesh(
      new T.BoxGeometry(
        1.1,
        0.05,
        70
      ),

      shoulderMaterial
    );


  leftShoulder.position.set(
    -5.5,
    -1.97,
    -20
  );


  world.scene.add(
    leftShoulder
  );


  const rightShoulder =
    leftShoulder.clone();


  rightShoulder.position.x =
    5.5;


  world.scene.add(
    rightShoulder
  );


  /* ==========================================
  LANE MARKERS
  ========================================== */

  const laneMaterial =
    new T.MeshStandardMaterial({
      color:
        0xf4f4f4,

      emissive:
        0x555555,

      emissiveIntensity:
        0.45
    });


  const laneMarks = [];


  for (
    let z = -48;
    z < 10;
    z += 4.2
  ) {
    for (
      const x of
      [-1.5, 1.5]
    ) {
      const line =
        new T.Mesh(
          new T.BoxGeometry(
            0.09,
            0.035,
            2.2
          ),

          laneMaterial
        );


      line.position.set(
        x,
        -1.95,
        z
      );


      world.scene.add(
        line
      );


      laneMarks.push(
        line
      );
    }
  }


  /* ==========================================
  ROAD LIGHTS
  ========================================== */

  const roadLights = [];


  for (
    let z = -45;
    z < 6;
    z += 5
  ) {
    for (
      const x of
      [-4.7, 4.7]
    ) {
      const light =
        new T.Mesh(
          new T.BoxGeometry(
            0.12,
            0.08,
            0.35
          ),

          new T.MeshStandardMaterial({
            color:
              x < 0
                ? 0x51ddff
                : 0xff4c74,

            emissive:
              x < 0
                ? 0x35c6ff
                : 0xff315d,

            emissiveIntensity:
              2.5
          })
        );


      light.position.set(
        x,
        -1.88,
        z
      );


      world.scene.add(
        light
      );


      roadLights.push(
        light
      );
    }
  }


  /* ==========================================
  PLAYER
  ========================================== */

  const player =
    createCar({
      T,

      color:
        0x38ddff,

      player:
        true
    });


  player.position.set(
    0,
    -1.43,
    3
  );


  player.rotation.y =
    Math.PI;


  world.scene.add(
    player
  );


  /* ==========================================
  PLAYER UNDERGLOW
  ========================================== */

  const underGlow =
    new T.PointLight(
      0x34dfff,
      2.2,
      5
    );


  underGlow.position.set(
    0,
    -1.3,
    3
  );


  world.scene.add(
    underGlow
  );


  /* ==========================================
  OBSTACLES
  ========================================== */

  const lanePositions =
    [
      -3,
      0,
      3
    ];


  const obstacles = [];


  let spawnTimer =
    0;


  let spawnInterval =
    1.2;


  let worldSpeed =
    12;


  function spawnObstacle() {
    if (!active) {
      return;
    }


    const obstacleLane =
      Math.floor(
        Math.random() *
        3
      );


    const colors =
      [
        0xff486c,
        0xffad45,
        0x9c7cff,
        0x72f5a1,
        0xffffff
      ];


    const obstacle =
      createCar({
        T,

        color:
          colors[
            Math.floor(
              Math.random() *
              colors.length
            )
          ]
      });


    obstacle.position.set(
      lanePositions[
        obstacleLane
      ],

      -1.43,

      -38 -
      Math.random() *
      3
    );


    obstacle.rotation.y =
      Math.PI;


    world.scene.add(
      obstacle
    );


    obstacles.push({
      mesh:
        obstacle,

      lane:
        obstacleLane,

      targetLane:
        obstacleLane,

      passed:
        false,

      nearMiss:
        false,

      laneChangeTimer:
        randomBetween(
          0.6,
          2
        ),

      laneChangeSpeed:
        randomBetween(
          2.8,
          4.2
        )
    });
  }


  /* ==========================================
  CONTROL
  ========================================== */

  let laneInputLocked =
    false;


  function changeLane(
    direction
  ) {
    if (
      !active ||
      laneInputLocked
    ) {
      return;
    }


    const oldLane =
      lane;


    lane =
      clamp(
        lane +
        direction,

        0,

        2
      );


    if (
      lane === oldLane
    ) {
      return;
    }


    laneInputLocked =
      true;


    stage.classList.remove(
      "highway-lane-shift"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "highway-lane-shift"
    );


    setTimeout(
      () => {
        laneInputLocked =
          false;
      },
      120
    );
  }


  function left() {
    changeLane(
      -1
    );
  }


  function right() {
    changeLane(
      1
    );
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


  /* ==========================================
  LOOP
  ========================================== */

  world.addUpdate(
    (
      delta,
      elapsed
    ) => {

      if (!active) {
        return;
      }


      /* ======================================
      SPEED
      ====================================== */

      worldSpeed =
        12 +
        Math.min(
          avoided *
          0.75,

          8
        );


      spawnInterval =
        Math.max(
          0.58,

          1.2 -
          avoided *
          0.045
        );


      speedElement.textContent =
        (
          worldSpeed /
          12
        )
        .toFixed(
          1
        ) +
        "x";


      /* ======================================
      PLAYER MOVEMENT
      ====================================== */

      const targetX =
        lanePositions[
          lane
        ];


      const difference =
        targetX -
        player.position.x;


      /*
       * 少し慣性を残した車線変更
       */

      player.position.x +=
        difference *
        Math.min(
          1,
          delta *
          8.5
        );


      /*
       * 車体を傾ける
       */

      player.rotation.z =
        clamp(
          difference *
          -0.10,

          -0.28,

          0.28
        );


      player.rotation.x =
        Math.sin(
          elapsed *
          9
        ) *
        0.006;


      underGlow.position.x =
        player.position.x;


      /* ======================================
      CAMERA SHAKE
      ====================================== */

      if (
        screenShake >
        0
      ) {
        screenShake -=
          delta;


        world.camera.position.x =
          randomBetween(
            -0.09,
            0.09
          );


        world.camera.position.y =
          3.7 +
          randomBetween(
            -0.07,
            0.07
          );

      } else {

        world.camera.position.x =
          Math.sin(
            elapsed *
            0.9
          ) *
          0.045;


        world.camera.position.y =
          3.7;
      }


      /* ======================================
      ROAD
      ====================================== */

      for (
        const line of
        laneMarks
      ) {
        line.position.z +=
          worldSpeed *
          delta;


        if (
          line.position.z >
          8
        ) {
          line.position.z -=
            58;
        }
      }


      for (
        const light of
        roadLights
      ) {
        light.position.z +=
          worldSpeed *
          delta;


        if (
          light.position.z >
          8
        ) {
          light.position.z -=
            55;
        }
      }


      /* ======================================
      SPAWN
      ====================================== */

      spawnTimer +=
        delta;


      if (
        spawnTimer >=
        spawnInterval
      ) {
        spawnTimer =
          0;


        spawnObstacle();
      }


      /* ======================================
      OBSTACLES
      ====================================== */

      for (
        let i =
          obstacles.length -
          1;

        i >= 0;

        i--
      ) {
        const item =
          obstacles[i];


        const obstacle =
          item.mesh;


        obstacle.position.z +=
          worldSpeed *
          delta;


        /*
         * 敵車がたまに車線変更
         */

        item.laneChangeTimer -=
          delta;


        if (
          item.laneChangeTimer <=
          0 &&
          obstacle.position.z <
          -4
        ) {
          item.laneChangeTimer =
            randomBetween(
              1.2,
              2.6
            );


          if (
            Math.random() <
            0.45
          ) {
            const direction =
              Math.random() <
              0.5
                ? -1
                : 1;


            item.targetLane =
              clamp(
                item.targetLane +
                direction,

                0,

                2
              );
          }
        }


        const targetObstacleX =
          lanePositions[
            item.targetLane
          ];


        const obstacleDifference =
          targetObstacleX -
          obstacle.position.x;


        obstacle.position.x +=
          obstacleDifference *
          Math.min(
            1,

            delta *
            item.laneChangeSpeed
          );


        obstacle.rotation.z =
          clamp(
            obstacleDifference *
            -0.07,

            -0.18,

            0.18
          );


        /* ======================================
        COLLISION
        ====================================== */

        const dx =
          Math.abs(
            obstacle.position.x -
            player.position.x
          );


        const dz =
          Math.abs(
            obstacle.position.z -
            player.position.z
          );


        if (
          !invincible &&
          dx <
          1.25 &&
          dz <
          1.65
        ) {
          crash(
            item
          );


          obstacles.splice(
            i,
            1
          );


          continue;
        }


        /* ======================================
        NEAR MISS
        ====================================== */

        if (
          !item.nearMiss &&
          !item.passed &&
          obstacle.position.z >
          player.position.z -
          0.6 &&
          obstacle.position.z <
          player.position.z +
          1.3
        ) {
          if (
            dx >=
            1.25 &&
            dx <
            1.85
          ) {
            item.nearMiss =
              true;


            combo +=
              2;


            maxCombo =
              Math.max(
                maxCombo,
                combo
              );


            showMessage(
              "NEAR MISS!"
            );


            showCombo();


            stage.classList.remove(
              "highway-near-miss"
            );


            void stage.offsetWidth;


            stage.classList.add(
              "highway-near-miss"
            );
          }
        }


        /* ======================================
        PASSED
        ====================================== */

        if (
          !item.passed &&
          obstacle.position.z >
          player.position.z +
          1.9
        ) {
          item.passed =
            true;


          avoided++;


          combo++;


          maxCombo =
            Math.max(
              maxCombo,
              combo
            );


          updateHud();


          showCombo();


          if (
            avoided >=
            goal
          ) {
            finish(
              true
            );


            return;
          }
        }


        /* ======================================
        REMOVE
        ====================================== */

        if (
          obstacle.position.z >
          13
        ) {
          world.disposeObject(
            obstacle
          );


          obstacles.splice(
            i,
            1
          );
        }
      }

    }
  );


  /* ==========================================
  CRASH
  ========================================== */

  function crash(
    item
  ) {
    if (
      !active ||
      invincible
    ) {
      return;
    }


    crashes++;


    lives--;


    combo =
      0;


    invincible =
      true;


    screenShake =
      0.45;


    createCrashParticles(
      item.mesh.position
        .clone()
    );


    world.disposeObject(
      item.mesh
    );


    stage.classList.remove(
      "highway-crash"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "highway-crash"
    );


    showMessage(
      "CRASH!"
    );


    updateHud();


    /*
     * 一瞬点滅して無敵
     */

    let blinkCount =
      0;


    const blink =
      setInterval(
        () => {

          if (
            !active
          ) {
            clearInterval(
              blink
            );

            return;
          }


          player.visible =
            !player.visible;


          blinkCount++;


          if (
            blinkCount >=
            8
          ) {
            clearInterval(
              blink
            );


            player.visible =
              true;


            invincible =
              false;
          }

        },
        90
      );


    if (
      lives <=
      0
    ) {
      clearInterval(
        blink
      );


      player.visible =
        true;


      setTimeout(
        () => {
          finish(
            false
          );
        },
        450
      );
    }
  }


  /* ==========================================
  PARTICLES
  ========================================== */

  function createCrashParticles(
    position
  ) {
    const group =
      new T.Group();


    group.position.copy(
      position
    );


    world.scene.add(
      group
    );


    const particles =
      [];


    for (
      let i = 0;
      i < 28;
      i++
    ) {
      const piece =
        new T.Mesh(
          new T.BoxGeometry(
            randomBetween(
              0.04,
              0.12
            ),

            randomBetween(
              0.04,
              0.12
            ),

            randomBetween(
              0.04,
              0.12
            )
          ),

          new T.MeshBasicMaterial({
            color:
              [
                0xff4d67,
                0xffb347,
                0xffffff,
                0x58eaff
              ][
                Math.floor(
                  Math.random() *
                  4
                )
              ]
          })
        );


      const velocity =
        new T.Vector3(
          randomBetween(
            -5,
            5
          ),

          randomBetween(
            1,
            6
          ),

          randomBetween(
            -3,
            5
          )
        );


      particles.push({
        piece,
        velocity
      });


      group.add(
        piece
      );
    }


    let age =
      0;


    const updater =
      delta => {

        age +=
          delta;


        particles.forEach(
          item => {

            item.piece.position
              .addScaledVector(
                item.velocity,
                delta
              );


            item.velocity.y -=
              7 *
              delta;


            item.piece.rotation.x +=
              delta *
              8;


            item.piece.rotation.y +=
              delta *
              7;


            item.piece.scale
              .multiplyScalar(
                0.96
              );

          }
        );


        if (
          age >
          0.6
        ) {
          world.removeUpdate?.(
            updater
          );


          world.disposeObject?.(
            group
          );
        }
      };


    world.addUpdate(
      updater
    );
  }


  /* ==========================================
  HUD
  ========================================== */

  function updateHud() {
    dodgedElement.textContent =
      avoided;


    comboElement.textContent =
      combo;


    livesElement.textContent =
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
  MESSAGE
  ========================================== */

  let messageTimer =
    null;


  function showMessage(
    text
  ) {
    clearTimeout(
      messageTimer
    );


    messageElement.textContent =
      text;


    messageElement.classList.remove(
      "show"
    );


    void messageElement.offsetWidth;


    messageElement.classList.add(
      "show"
    );


    messageTimer =
      setTimeout(
        () => {

          messageElement.classList.remove(
            "show"
          );

        },
        420
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


    setTimeout(
      () => {

        comboPop.classList.remove(
          "show"
        );

      },
      340
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


    clearTimeout(
      messageTimer
    );


    const elapsed =
      performance.now() -
      startedAt;


    const completion =
      clamp(
        avoided /
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


    const speedScore =
      success
        ? clamp(
            100 -
            Math.max(
              0,

              elapsed -
              11000
            ) /
            170,

            0,

            100
          )
        : 0;


    const comboScore =
      clamp(
        maxCombo /
        12,

        0,

        1
      );


    const finalScore =
      clamp(
        completion *
        40 +

        lifeScore *
        25 +

        comboScore *
        20 +

        speedScore /
        100 *
        15,

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
                45 +
                completion *
                30 +
                comboScore *
                25,

                0,

                100
              )
            ),

          meta: {
            success,

            avoided,

            crashes,

            lives,

            maxCombo,

            elapsed:
              Math.round(
                elapsed
              )
          }
        });

      },
      success
        ? 550
        : 300
    );
  }


  /* ==========================================
  START
  ========================================== */

  updateHud();


  spawnObstacle();


  world.start();


  /* ==========================================
  CLEANUP
  ========================================== */

  return () => {
    active =
      false;


    clearTimeout(
      messageTimer
    );


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


    world.destroy();
  };
}


/* ==========================================
CAR MODEL
========================================== */

function createCar({
  T,
  color,
  player = false
}) {
  const car =
    new T.Group();


  const bodyMaterial =
    new T.MeshStandardMaterial({
      color,

      metalness:
        0.62,

      roughness:
        0.3
    });


  const glassMaterial =
    new T.MeshStandardMaterial({
      color:
        0x07111c,

      metalness:
        0.5,

      roughness:
        0.2
    });


  const tireMaterial =
    new T.MeshStandardMaterial({
      color:
        0x050608,

      roughness:
        0.95
    });


  const rearLightMaterial =
    new T.MeshStandardMaterial({
      color:
        0xff3155,

      emissive:
        0xff1738,

      emissiveIntensity:
        2.8
    });


  const frontLightMaterial =
    new T.MeshStandardMaterial({
      color:
        0xd8faff,

      emissive:
        0x7befff,

      emissiveIntensity:
        2.5
    });


  /*
   * BODY
   */

  const body =
    new T.Mesh(
      new T.BoxGeometry(
        1.7,
        0.48,
        3
      ),

      bodyMaterial
    );


  body.castShadow =
    true;


  car.add(
    body
  );


  /*
   * CABIN
   */

  const cabin =
    new T.Mesh(
      new T.BoxGeometry(
        1.22,
        0.58,
        1.35
      ),

      glassMaterial
    );


  cabin.position.set(
    0,
    0.48,
    -0.18
  );


  car.add(
    cabin
  );


  /*
   * HOOD STRIPE FOR PLAYER
   */

  if (player) {
    const stripe =
      new T.Mesh(
        new T.BoxGeometry(
          0.22,
          0.03,
          2.75
        ),

        new T.MeshStandardMaterial({
          color:
            0xffffff,

          emissive:
            0x5aeaff,

          emissiveIntensity:
            1.2
        })
      );


    stripe.position.y =
      0.265;


    car.add(
      stripe
    );
  }


  /*
   * LIGHTS
   */

  for (
    const x of
    [-0.48, 0.48]
  ) {
    const rearLight =
      new T.Mesh(
        new T.BoxGeometry(
          0.3,
          0.13,
          0.08
        ),

        rearLightMaterial
      );


    rearLight.position.set(
      x,
      0,
      1.54
    );


    car.add(
      rearLight
    );


    const frontLight =
      new T.Mesh(
        new T.BoxGeometry(
          0.3,
          0.13,
          0.08
        ),

        frontLightMaterial
      );


    frontLight.position.set(
      x,
      0,
      -1.54
    );


    car.add(
      frontLight
    );
  }


  /*
   * TIRES
   */

  for (
    const x of
    [-0.9, 0.9]
  ) {
    for (
      const z of
      [-0.9, 0.9]
    ) {
      const tire =
        new T.Mesh(
          new T.BoxGeometry(
            0.18,
            0.28,
            0.55
          ),

          tireMaterial
        );


      tire.position.set(
        x,
        -0.25,
        z
      );


      car.add(
        tire
      );
    }
  }


  return car;
}


/* ==========================================
UTIL
========================================== */

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


function randomBetween(
  min,
  max
) {
  return (
    min +
    Math.random() *
    (
      max -
      min
    )
  );
}
