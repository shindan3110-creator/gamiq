// GAMIQ（ゲーミック） v2
// SPACE BLASTER
// Approach -> Combat -> Retreat Edition

import {
  GamiqThreeScene
} from "./three-renderer.js";


export async function runSpace3D({
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

  let shots = 0;
  let hits = 0;

  let destroyed = 0;
  let escaped = 0;

  let combo = 0;
  let maxCombo = 0;

  const targetDestroyedGoal = 6;
  const maxEscapes = 3;

  const startedAt =
    performance.now();

  let enemy = null;
  let enemyDying = false;

  let spawnTimer = null;
  let messageTimer = null;

  let screenShake = 0;

  let crosshairLocalX = 0;
  let crosshairLocalY = 0;

  let joystickX = 0;
  let joystickY = 0;

  let joystickActive = false;

  let joystickPointerId = null;


  /* ==========================================
  HTML
  ========================================== */

  container.innerHTML = `
    <div class="space-blaster-wrap">

      <div class="space-blaster-hud">

        <div class="space-hud-item">
          <span>DESTROYED</span>

          <strong>
            <b data-space-destroyed>0</b>
            / ${targetDestroyedGoal}
          </strong>
        </div>


        <div class="space-hud-item">
          <span>COMBO</span>

          <strong data-space-combo>
            0
          </strong>
        </div>


        <div class="space-hud-item">
          <span>ACCURACY</span>

          <strong data-space-accuracy>
            0%
          </strong>
        </div>

      </div>


      <div
        class="space-blaster-stage"
        data-space-stage
      >

        <div
          class="space-blaster-world"
          data-space-world
        ></div>


        <div
          class="space-crosshair"
          data-space-crosshair
        >
          <span></span>
        </div>


        <div
          class="space-blaster-message"
          data-space-message
        ></div>


        <div
          class="space-blaster-combo"
          data-space-combo-pop
        ></div>


        <div class="space-blaster-hint">
          AIM & SHOOT
        </div>


        <div class="space-mobile-controls">

          <div
            class="space-joystick"
            data-space-joystick
          >
            <div
              class="space-joystick-knob"
              data-space-joystick-knob
            ></div>
          </div>


          <button
            type="button"
            class="space-mobile-fire"
            data-space-mobile-fire
            aria-label="Shoot"
          >
            <span>✦</span>
          </button>

        </div>

      </div>


      <div class="space-blaster-bottom">

        <div class="space-life">

          ESCAPE

          <strong data-space-escape>
            ○ ○ ○
          </strong>

        </div>

      </div>

    </div>
  `;


  /* ==========================================
  ELEMENTS
  ========================================== */

  const stage =
    container.querySelector(
      "[data-space-stage]"
    );

  const worldElement =
    container.querySelector(
      "[data-space-world]"
    );

  const crosshair =
    container.querySelector(
      "[data-space-crosshair]"
    );

  const destroyedElement =
    container.querySelector(
      "[data-space-destroyed]"
    );

  const comboElement =
    container.querySelector(
      "[data-space-combo]"
    );

  const accuracyElement =
    container.querySelector(
      "[data-space-accuracy]"
    );

  const escapeElement =
    container.querySelector(
      "[data-space-escape]"
    );

  const messageElement =
    container.querySelector(
      "[data-space-message]"
    );

  const comboPop =
    container.querySelector(
      "[data-space-combo-pop]"
    );

  const joystick =
    container.querySelector(
      "[data-space-joystick]"
    );

  const joystickKnob =
    container.querySelector(
      "[data-space-joystick-knob]"
    );

  const mobileFireButton =
    container.querySelector(
      "[data-space-mobile-fire]"
    );


  /* ==========================================
  THREE
  ========================================== */

  const world =
    new GamiqThreeScene({
      container:
        worldElement,

      cameraZ:
        8,

      background:
        0x01040b
    });


  const initialized =
    await world.init();


  if (!initialized) {
    container.innerHTML = `
      <div class="space-3d-fallback">
        3Dの読み込みに失敗しました
      </div>
    `;

    return () => {};
  }


  const T =
    world.THREE;


  world.camera.position.set(
    0,
    0.4,
    8
  );


  world.camera.lookAt(
    0,
    0,
    -8
  );


  /* ==========================================
  LIGHTS
  ========================================== */

  const blueLight =
    new T.PointLight(
      0x39eaff,
      4,
      22
    );


  blueLight.position.set(
    -5,
    5,
    3
  );


  world.scene.add(
    blueLight
  );


  const purpleLight =
    new T.PointLight(
      0x7655ff,
      3,
      20
    );


  purpleLight.position.set(
    5,
    -3,
    -3
  );


  world.scene.add(
    purpleLight
  );


  const redLight =
    new T.PointLight(
      0xff3159,
      2.4,
      15
    );


  redLight.position.set(
    0,
    1,
    -8
  );


  world.scene.add(
    redLight
  );


  /* ==========================================
  STAR FIELD
  ========================================== */

  const starCount = 650;

  const starGeometry =
    new T.BufferGeometry();

  const starPositions =
    new Float32Array(
      starCount * 3
    );


  for (
    let i = 0;
    i < starCount;
    i++
  ) {
    starPositions[
      i * 3
    ] =
      randomBetween(
        -18,
        18
      );


    starPositions[
      i * 3 + 1
    ] =
      randomBetween(
        -11,
        11
      );


    starPositions[
      i * 3 + 2
    ] =
      randomBetween(
        -45,
        2
      );
  }


  starGeometry.setAttribute(
    "position",

    new T.BufferAttribute(
      starPositions,
      3
    )
  );


  const starMaterial =
    new T.PointsMaterial({
      color:
        0xffffff,

      size:
        0.055,

      transparent:
        true,

      opacity:
        0.9
    });


  const stars =
    new T.Points(
      starGeometry,
      starMaterial
    );


  world.scene.add(
    stars
  );


  /* ==========================================
  ENEMY MODEL
  ========================================== */

  function buildEnemy() {
    const ship =
      new T.Group();


    const bodyMaterial =
      new T.MeshStandardMaterial({
        color:
          0x40556f,

        metalness:
          0.82,

        roughness:
          0.2
      });


    const glowMaterial =
      new T.MeshStandardMaterial({
        color:
          0x5ff0ff,

        emissive:
          0x32dfff,

        emissiveIntensity:
          3,

        metalness:
          0.25,

        roughness:
          0.2
      });


    const coreMaterial =
      new T.MeshStandardMaterial({
        color:
          0xff315d,

        emissive:
          0xff1744,

        emissiveIntensity:
          3.5
      });


    /* BODY */

    const body =
      new T.Mesh(
        new T.SphereGeometry(
          0.72,
          20,
          14
        ),

        bodyMaterial
      );


    body.scale.set(
      1.5,
      0.55,
      1
    );


    ship.add(
      body
    );


    /* COCKPIT */

    const cockpit =
      new T.Mesh(
        new T.SphereGeometry(
          0.31,
          16,
          12
        ),

        glowMaterial
      );


    cockpit.position.set(
      0,
      0.3,
      0.25
    );


    ship.add(
      cockpit
    );


    /* WINGS */

    const wingGeometry =
      new T.BoxGeometry(
        1.7,
        0.12,
        0.55
      );


    const leftWing =
      new T.Mesh(
        wingGeometry,
        bodyMaterial
      );


    leftWing.position.set(
      -1.05,
      -0.05,
      0
    );


    leftWing.rotation.z =
      0.15;


    ship.add(
      leftWing
    );


    const rightWing =
      leftWing.clone();


    rightWing.position.x =
      1.05;


    rightWing.rotation.z =
      -0.15;


    ship.add(
      rightWing
    );


    /* CORE */

    const core =
      new T.Mesh(
        new T.SphereGeometry(
          0.2,
          14,
          10
        ),

        coreMaterial
      );


    core.position.set(
      0,
      -0.03,
      0.75
    );


    core.userData.isCore =
      true;


    ship.add(
      core
    );


    /* ENGINES */

    const engineLeft =
      new T.Mesh(
        new T.SphereGeometry(
          0.15,
          12,
          8
        ),

        glowMaterial
      );


    engineLeft.position.set(
      -0.62,
      -0.08,
      -0.7
    );


    ship.add(
      engineLeft
    );


    const engineRight =
      engineLeft.clone();


    engineRight.position.x =
      0.62;


    ship.add(
      engineRight
    );


    ship.userData.hitTargets = [
      body,
      cockpit,
      leftWing,
      rightWing,
      core
    ];


    /*
     * 少し大きめ
     */

    ship.scale.set(
      1.25,
      1.25,
      1.25
    );


    return ship;
  }


  /* ==========================================
  SPAWN
  ========================================== */

  function spawnEnemy() {
    if (
      !active ||
      enemy
    ) {
      return;
    }


    enemyDying =
      false;


    enemy =
      buildEnemy();


    /*
     * 最初から完全な遠方には置かない。
     * 小さく見える位置から接近開始。
     */

    enemy.position.set(
      randomBetween(
        -2.0,
        2.0
      ),

      randomBetween(
        -1.3,
        1.5
      ),

      randomBetween(
        -5.5,
        -4.0
      )
    );


    /*
     * +Z側が機首。
     * cameraはz=8なので
     * rotation.y=0でプレイヤー側を向く。
     */

    enemy.rotation.set(
      0,
      0,
      0
    );


    enemy.userData.health =
      destroyed >= 4
        ? 120
        : 100;


    /*
     * 戦闘位置。
     *
     * camera z=8に対して
     * enemy z=1〜2なので
     * しっかり見える距離。
     */

    enemy.userData.combatZ =
      randomBetween(
        1.0,
        2.2
      );


    enemy.userData.approachSpeed =
      randomBetween(
        2.8,
        3.6
      );


    /*
     * 通常回避
     */

    enemy.userData.targetX =
      randomBetween(
        -2.2,
        2.2
      );


    enemy.userData.targetY =
      randomBetween(
        -1.4,
        1.4
      );


    enemy.userData.moveSpeed =
      randomBetween(
        1.25,
        1.7
      );


    enemy.userData.decisionTimer =
      randomBetween(
        0.9,
        1.5
      );


    /*
     * これは戦闘距離到達後から減らす
     */

    enemy.userData.escapeTimer =
      randomBetween(
        4.5,
        7
      );


    enemy.userData.isEscaping =
      false;


    enemy.userData.escapeSpeed =
      randomBetween(
        5.5,
        7
      );


    enemy.userData.escapeTurn =
      0;


    world.scene.add(
      enemy
    );


    showMessage(
      "TARGET!"
    );
  }


  /* ==========================================
  AIM
  ========================================== */

  const pointer =
    new T.Vector2(
      0,
      0
    );


  const raycaster =
    new T.Raycaster();


  function updateCrosshairFromLocal(
    x,
    y
  ) {
    const rect =
      stage
        .getBoundingClientRect();


    crosshairLocalX =
      clamp(
        x,
        0,
        rect.width
      );


    crosshairLocalY =
      clamp(
        y,
        0,
        rect.height
      );


    crosshair.style.left =
      `${crosshairLocalX}px`;


    crosshair.style.top =
      `${crosshairLocalY}px`;


    pointer.x =
      (
        crosshairLocalX /
        rect.width
      ) *
      2 -
      1;


    pointer.y =
      -(
        crosshairLocalY /
        rect.height
      ) *
      2 +
      1;
  }


  function updatePointer(
    clientX,
    clientY
  ) {
    const rect =
      stage
        .getBoundingClientRect();


    updateCrosshairFromLocal(
      clientX -
      rect.left,

      clientY -
      rect.top
    );
  }


  function stagePointerMove(
    event
  ) {
    if (
      !active ||
      isMobileLike()
    ) {
      return;
    }


    updatePointer(
      event.clientX,
      event.clientY
    );
  }


  /* ==========================================
  MAIN UPDATE
  ========================================== */

  world.addUpdate(
    delta => {

      if (!active) {
        return;
      }


      /* STAR MOVEMENT */

      stars.position.z +=
        delta *
        4.4;


      if (
        stars.position.z >
        8
      ) {
        stars.position.z =
          0;
      }


      /* CAMERA SHAKE */

      if (
        screenShake >
        0
      ) {
        screenShake -=
          delta;


        world.camera.position.x =
          randomBetween(
            -0.055,
            0.055
          );


        world.camera.position.y =
          0.4 +
          randomBetween(
            -0.055,
            0.055
          );

      } else {

        world.camera.position.x =
          0;


        world.camera.position.y =
          0.4;
      }


      /* MOBILE JOYSTICK */

      if (
        joystickActive
      ) {
        const rect =
          stage
            .getBoundingClientRect();


        const speed =
          390;


        crosshairLocalX +=
          joystickX *
          speed *
          delta;


        crosshairLocalY +=
          joystickY *
          speed *
          delta;


        crosshairLocalX =
          clamp(
            crosshairLocalX,
            15,
            rect.width - 15
          );


        crosshairLocalY =
          clamp(
            crosshairLocalY,
            15,
            rect.height - 15
          );


        updateCrosshairFromLocal(
          crosshairLocalX,
          crosshairLocalY
        );
      }


      if (
        !enemy ||
        enemyDying
      ) {
        return;
      }


      /* ======================================
      NORMAL COMBAT
      ====================================== */

      if (
        !enemy.userData.isEscaping
      ) {

        /*
         * 常にほぼ正面。
         */

        enemy.rotation.y +=
          (
            0 -
            enemy.rotation.y
          ) *
          Math.min(
            1,
            delta * 5
          );


        /*
         * 戦闘距離まで接近。
         *
         * 重要：
         * 逃走タイマーは
         * ここでは減らさない。
         */

        if (
          enemy.position.z <
          enemy.userData.combatZ
        ) {
          enemy.position.z +=
            enemy.userData
              .approachSpeed *
            delta;

        } else {

          /*
           * 戦闘距離まで来てから
           * 逃走タイマー開始。
           */

          enemy.userData
            .escapeTimer -=
            delta;
        }


        /*
         * 行動変更
         */

        enemy.userData
          .decisionTimer -=
          delta;


        if (
          enemy.userData
            .decisionTimer <=
          0
        ) {
          const behavior =
            Math.random();


          /*
           * 60%
           * ゆっくり左右
           */

          if (
            behavior <
            0.60
          ) {
            enemy.userData.targetX =
              clamp(
                enemy.position.x +
                randomBetween(
                  -1.7,
                  1.7
                ),

                -2.8,
                2.8
              );


            enemy.userData.targetY =
              clamp(
                enemy.position.y +
                randomBetween(
                  -0.4,
                  0.4
                ),

                -1.6,
                1.6
              );


            enemy.userData.moveSpeed =
              randomBetween(
                1.15,
                1.55
              );


          /*
           * 25%
           * 小さく上下
           */

          } else if (
            behavior <
            0.85
          ) {
            enemy.userData.targetX =
              clamp(
                enemy.position.x +
                randomBetween(
                  -0.5,
                  0.5
                ),

                -2.8,
                2.8
              );


            enemy.userData.targetY =
              clamp(
                enemy.position.y +
                randomBetween(
                  -1.0,
                  1.0
                ),

                -1.6,
                1.6
              );


            enemy.userData.moveSpeed =
              randomBetween(
                1.15,
                1.6
              );


          /*
           * 15%
           * 少し大きめ回避
           */

          } else {

            enemy.userData.targetX =
              enemy.position.x >=
              0

                ? randomBetween(
                    -2.6,
                    -1.1
                  )

                : randomBetween(
                    1.1,
                    2.6
                  );


            enemy.userData.targetY =
              clamp(
                enemy.position.y +
                randomBetween(
                  -0.7,
                  0.7
                ),

                -1.6,
                1.6
              );


            enemy.userData.moveSpeed =
              randomBetween(
                1.8,
                2.2
              );
          }


          enemy.userData
            .decisionTimer =
            randomBetween(
              0.9,
              1.5
            );
        }


        /*
         * XY MOVE
         */

        const dx =
          enemy.userData.targetX -
          enemy.position.x;


        const dy =
          enemy.userData.targetY -
          enemy.position.y;


        const distance =
          Math.hypot(
            dx,
            dy
          );


        if (
          distance >
          0.05
        ) {
          const step =
            Math.min(
              distance,

              enemy.userData
                .moveSpeed *
              delta
            );


          enemy.position.x +=
            (
              dx /
              distance
            ) *
            step;


          enemy.position.y +=
            (
              dy /
              distance
            ) *
            step;
        }


        /*
         * BANKのみ。
         * 機体をグルグル回転させない。
         */

        enemy.rotation.z +=
          (
            clamp(
              -dx * 0.08,
              -0.18,
              0.18
            ) -
            enemy.rotation.z
          ) *
          Math.min(
            1,
            delta * 6
          );


        enemy.rotation.x +=
          (
            clamp(
              dy * 0.04,
              -0.09,
              0.09
            ) -
            enemy.rotation.x
          ) *
          Math.min(
            1,
            delta * 6
          );


        /*
         * 戦闘後に本当の逃走開始
         */

        if (
          enemy.userData.escapeTimer <=
          0
        ) {
          enemy.userData.isEscaping =
            true;


          enemy.userData.escapeTurn =
            0;


          enemy.userData.targetX =
            clamp(
              enemy.position.x +
              (
                enemy.position.x >= 0
                  ? 1.8
                  : -1.8
              ),

              -4,
              4
            );


          showMessage(
            "RETREAT!"
          );
        }


      /* ======================================
      ESCAPING
      ====================================== */

      } else {

        /*
         * 逃走開始時だけ180度旋回。
         */

        enemy.userData.escapeTurn +=
          delta *
          4.5;


        const turnRatio =
          clamp(
            enemy.userData.escapeTurn,
            0,
            1
          );


        enemy.rotation.y =
          Math.PI *
          smoothStep(
            turnRatio
          );


        /*
         * 奥へ加速
         */

        const acceleration =
          1 +
          turnRatio *
          1.8;


        enemy.position.z -=
          enemy.userData
            .escapeSpeed *
          acceleration *
          delta;


        /*
         * 横にも少し逃げる
         */

        enemy.position.x +=
          (
            enemy.userData.targetX -
            enemy.position.x
          ) *
          Math.min(
            1,
            delta * 1.6
          );


        /*
         * BANKを戻す
         */

        enemy.rotation.z +=
          (
            0 -
            enemy.rotation.z
          ) *
          Math.min(
            1,
            delta * 4
          );


        enemy.rotation.x +=
          (
            0 -
            enemy.rotation.x
          ) *
          Math.min(
            1,
            delta * 4
          );


        /*
         * 本当に遠くへ逃げてから
         * ESCAPED判定。
         */

        if (
          enemy.position.z <
          -24
        ) {
          enemyEscaped();
        }
      }

    }
  );


  /* ==========================================
  SHOOT
  ========================================== */

  function shoot() {
    if (
      !active ||
      !enemy ||
      enemyDying
    ) {
      return;
    }


    shots++;


    createLaserEffect();


    raycaster.setFromCamera(
      pointer,
      world.camera
    );


    const intersections =
      raycaster.intersectObjects(
        enemy.userData.hitTargets ||
        [],
        true
      );


    if (
      intersections.length >
      0
    ) {
      hits++;


      const hit =
        intersections[0];


      let damage =
        randomBetween(
          36,
          48
        );


      if (
        hit.object
          .userData
          ?.isCore
      ) {
        damage *=
          1.8;


        showMessage(
          "CRITICAL!"
        );

      } else {

        showMessage(
          "HIT!"
        );
      }


      enemy.userData.health -=
        damage;


      combo++;


      maxCombo =
        Math.max(
          maxCombo,
          combo
        );


      createHitParticles(
        hit.point
      );


      flashEnemy();


      screenShake =
        0.15;


      /*
       * 被弾後は少しだけ回避。
       * ワープのような動きは禁止。
       */

      if (
        !enemy.userData.isEscaping
      ) {
        enemy.userData.targetX =
          clamp(
            enemy.position.x +
            (
              enemy.position.x >= 0

                ? randomBetween(
                    -1.3,
                    -0.6
                  )

                : randomBetween(
                    0.6,
                    1.3
                  )
            ),

            -2.8,
            2.8
          );


        enemy.userData.targetY =
          clamp(
            enemy.position.y +
            randomBetween(
              -0.55,
              0.55
            ),

            -1.6,
            1.6
          );


        enemy.userData.moveSpeed =
          randomBetween(
            1.6,
            2.1
          );


        enemy.userData.decisionTimer =
          randomBetween(
            0.7,
            1.1
          );
      }


      showCombo();


      if (
        enemy.userData.health <=
        0
      ) {
        destroyEnemy();
      }


    } else {

      combo = 0;


      stage.classList.remove(
        "space-stage-miss"
      );


      void stage.offsetWidth;


      stage.classList.add(
        "space-stage-miss"
      );
    }


    updateHud();
  }


  /* ==========================================
  PC INPUT
  ========================================== */

  function stagePointerDown(
    event
  ) {
    if (
      !active ||
      isMobileLike()
    ) {
      return;
    }


    if (
      event.target.closest?.(
        ".space-mobile-controls"
      )
    ) {
      return;
    }


    updatePointer(
      event.clientX,
      event.clientY
    );


    shoot();
  }


  /* ==========================================
  LASER
  ========================================== */

  function createLaserEffect() {
    const start =
      world.camera.position
        .clone();


    const point =
      new T.Vector3(
        pointer.x,
        pointer.y,
        0.5
      );


    point.unproject(
      world.camera
    );


    const direction =
      point
        .sub(
          world.camera.position
        )
        .normalize();


    const end =
      start
        .clone()
        .add(
          direction.multiplyScalar(
            25
          )
        );


    const geometry =
      new T.BufferGeometry()
        .setFromPoints([
          start,
          end
        ]);


    const material =
      new T.LineBasicMaterial({
        color:
          0x62f5ff,

        transparent:
          true,

        opacity:
          1
      });


    const laser =
      new T.Line(
        geometry,
        material
      );


    world.scene.add(
      laser
    );


    mobileFireButton
      .classList
      .remove(
        "shoot-kick"
      );


    void mobileFireButton.offsetWidth;


    mobileFireButton
      .classList
      .add(
        "shoot-kick"
      );


    setTimeout(
      () => {

        world.scene.remove(
          laser
        );


        geometry.dispose();

        material.dispose();

      },
      75
    );
  }


  /* ==========================================
  FLASH
  ========================================== */

  function flashEnemy() {
    if (!enemy) {
      return;
    }


    const materials = [];


    enemy.traverse(
      object => {

        if (
          !object.isMesh ||
          !object.material
        ) {
          return;
        }


        const original =
          object.material;


        const flash =
          original.clone();


        flash.emissive =
          new T.Color(
            0xffffff
          );


        flash.emissiveIntensity =
          3;


        object.material =
          flash;


        materials.push({
          object,
          original,
          flash
        });

      }
    );


    setTimeout(
      () => {

        materials.forEach(
          item => {

            if (
              item.object
            ) {
              item.object.material =
                item.original;
            }


            item.flash.dispose();

          }
        );

      },
      85
    );
  }


  /* ==========================================
  HIT PARTICLES
  ========================================== */

  function createHitParticles(
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


    const particles = [];


    for (
      let i = 0;
      i < 16;
      i++
    ) {
      const geometry =
        new T.BoxGeometry(
          0.06,
          0.06,
          0.06
        );


      const material =
        new T.MeshBasicMaterial({
          color:
            Math.random() <
            0.5
              ? 0x5ff1ff
              : 0xffffff
        });


      const mesh =
        new T.Mesh(
          geometry,
          material
        );


      const velocity =
        new T.Vector3(
          randomBetween(
            -3.5,
            3.5
          ),

          randomBetween(
            -3.5,
            3.5
          ),

          randomBetween(
            -1,
            3
          )
        );


      particles.push({
        mesh,
        velocity,
        geometry,
        material
      });


      group.add(
        mesh
      );
    }


    animateTemporaryGroup({
      group,
      duration:
        380,

      update:
        delta => {

          particles.forEach(
            item => {

              item.mesh.position
                .addScaledVector(
                  item.velocity,
                  delta
                );


              item.mesh.scale
                .multiplyScalar(
                  0.94
                );

            }
          );

        },

      dispose:
        () => {

          particles.forEach(
            item => {

              item.geometry.dispose();
              item.material.dispose();

            }
          );

        }
    });
  }


  /* ==========================================
  EXPLOSION
  ========================================== */

  function createExplosion(
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


    const pieces = [];


    for (
      let i = 0;
      i < 34;
      i++
    ) {
      const geometry =
        new T.BoxGeometry(
          randomBetween(
            0.05,
            0.15
          ),

          randomBetween(
            0.05,
            0.15
          ),

          randomBetween(
            0.05,
            0.15
          )
        );


      const colors = [
        0xff345e,
        0xffa53c,
        0x5ff0ff,
        0xffffff
      ];


      const material =
        new T.MeshBasicMaterial({
          color:
            colors[
              Math.floor(
                Math.random() *
                colors.length
              )
            ]
        });


      const mesh =
        new T.Mesh(
          geometry,
          material
        );


      const velocity =
        new T.Vector3(
          randomBetween(
            -6,
            6
          ),

          randomBetween(
            -6,
            6
          ),

          randomBetween(
            -3,
            6
          )
        );


      pieces.push({
        mesh,
        velocity,
        geometry,
        material
      });


      group.add(
        mesh
      );
    }


    const coreGeometry =
      new T.SphereGeometry(
        0.35,
        16,
        10
      );


    const coreMaterial =
      new T.MeshBasicMaterial({
        color:
          0xffffff,

        transparent:
          true,

        opacity:
          1
      });


    const core =
      new T.Mesh(
        coreGeometry,
        coreMaterial
      );


    group.add(
      core
    );


    let age = 0;


    animateTemporaryGroup({
      group,
      duration:
        550,

      update:
        delta => {

          age +=
            delta;


          pieces.forEach(
            item => {

              item.mesh.position
                .addScaledVector(
                  item.velocity,
                  delta
                );


              item.mesh.rotation.x +=
                delta *
                8;


              item.mesh.rotation.y +=
                delta *
                7;


              item.mesh.scale
                .multiplyScalar(
                  0.95
                );

            }
          );


          core.scale.multiplyScalar(
            1 +
            delta *
            8
          );


          core.material.opacity =
            Math.max(
              0,
              1 -
              age *
              3
            );

        },

      dispose:
        () => {

          pieces.forEach(
            item => {

              item.geometry.dispose();
              item.material.dispose();

            }
          );


          coreGeometry.dispose();
          coreMaterial.dispose();

        }
    });
  }


  /* ==========================================
  TEMPORARY THREE EFFECT
  ========================================== */

  function animateTemporaryGroup({
    group,
    duration,
    update,
    dispose
  }) {
    const start =
      performance.now();


    let last =
      start;


    function frame(
      now
    ) {
      if (!active) {
        cleanup();
        return;
      }


      const delta =
        Math.min(
          0.033,

          (
            now -
            last
          ) /
          1000
        );


      last =
        now;


      update?.(
        delta
      );


      if (
        now -
        start >=
        duration
      ) {
        cleanup();
        return;
      }


      requestAnimationFrame(
        frame
      );
    }


    function cleanup() {
      world.scene.remove(
        group
      );


      dispose?.();
    }


    requestAnimationFrame(
      frame
    );
  }


  /* ==========================================
  DESTROY ENEMY
  ========================================== */

  function destroyEnemy() {
    if (
      !enemy ||
      enemyDying
    ) {
      return;
    }


    enemyDying =
      true;


    destroyed++;


    const deadEnemy =
      enemy;


    enemy =
      null;


    createExplosion(
      deadEnemy.position
        .clone()
    );


    screenShake =
      0.3;


    stage.classList.remove(
      "space-stage-kill"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "space-stage-kill"
    );


    showMessage(
      destroyed >=
      targetDestroyedGoal

        ? "FINAL HIT!"

        : "DESTROYED!"
    );


    world.disposeObject(
      deadEnemy
    );


    updateHud();


    if (
      destroyed >=
      targetDestroyedGoal
    ) {
      setTimeout(
        () => {

          finish(
            true
          );

        },
        550
      );


      return;
    }


    spawnTimer =
      setTimeout(
        () => {

          enemyDying =
            false;


          spawnEnemy();

        },
        350
      );
  }


  /* ==========================================
  ESCAPE
  ========================================== */

  function enemyEscaped() {
    if (
      !enemy ||
      enemyDying
    ) {
      return;
    }


    enemyDying =
      true;


    const oldEnemy =
      enemy;


    enemy =
      null;


    escaped++;

    combo = 0;


    world.disposeObject(
      oldEnemy
    );


    showMessage(
      "ESCAPED!"
    );


    updateHud();


    if (
      escaped >=
      maxEscapes
    ) {
      finish(
        false
      );

      return;
    }


    spawnTimer =
      setTimeout(
        () => {

          enemyDying =
            false;


          spawnEnemy();

        },
        400
      );
  }


  /* ==========================================
  JOYSTICK
  ========================================== */

  function joystickPointerDown(
    event
  ) {
    if (!active) {
      return;
    }


    event.preventDefault();
    event.stopPropagation();


    joystickActive =
      true;


    joystickPointerId =
      event.pointerId;


    joystick.setPointerCapture?.(
      event.pointerId
    );


    updateJoystick(
      event
    );
  }


  function joystickPointerMove(
    event
  ) {
    if (
      !joystickActive ||
      event.pointerId !==
      joystickPointerId
    ) {
      return;
    }


    event.preventDefault();


    updateJoystick(
      event
    );
  }


  function joystickPointerUp(
    event
  ) {
    if (
      event.pointerId !==
      joystickPointerId
    ) {
      return;
    }


    joystickActive =
      false;


    joystickPointerId =
      null;


    joystickX = 0;
    joystickY = 0;


    joystickKnob.style.transform =
      "translate(-50%, -50%)";


    joystick.releasePointerCapture?.(
      event.pointerId
    );
  }


  function updateJoystick(
    event
  ) {
    const rect =
      joystick
        .getBoundingClientRect();


    const centerX =
      rect.left +
      rect.width /
      2;


    const centerY =
      rect.top +
      rect.height /
      2;


    let dx =
      event.clientX -
      centerX;


    let dy =
      event.clientY -
      centerY;


    const radius =
      rect.width *
      0.33;


    const distance =
      Math.hypot(
        dx,
        dy
      );


    if (
      distance >
      radius
    ) {
      dx =
        dx /
        distance *
        radius;


      dy =
        dy /
        distance *
        radius;
    }


    joystickX =
      dx /
      radius;


    joystickY =
      dy /
      radius;


    joystickKnob.style.transform =
      `
        translate(
          calc(-50% + ${dx}px),
          calc(-50% + ${dy}px)
        )
      `;
  }


  /* ==========================================
  MOBILE FIRE
  ========================================== */

  function mobileFire(
    event
  ) {
    event.preventDefault();
    event.stopPropagation();


    shoot();
  }


  /* ==========================================
  HUD
  ========================================== */

  function updateHud() {
    destroyedElement.textContent =
      destroyed;


    comboElement.textContent =
      combo;


    const accuracy =
      shots > 0
        ? hits /
          shots
        : 0;


    accuracyElement.textContent =
      `${Math.round(
        accuracy *
        100
      )}%`;


    escapeElement.textContent =
      Array.from(
        {
          length:
            maxEscapes
        },

        (
          _,
          index
        ) =>
          index <
          maxEscapes -
          escaped

            ? "○"

            : "×"
      )
        .join(
          " "
        );
  }


  /* ==========================================
  MESSAGE
  ========================================== */

  function showMessage(
    text
  ) {
    clearTimeout(
      messageTimer
    );


    messageElement.textContent =
      text;


    messageElement
      .classList
      .remove(
        "show"
      );


    void messageElement.offsetWidth;


    messageElement
      .classList
      .add(
        "show"
      );


    messageTimer =
      setTimeout(
        () => {

          messageElement
            .classList
            .remove(
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


    comboPop
      .classList
      .remove(
        "show"
      );


    void comboPop.offsetWidth;


    comboPop
      .classList
      .add(
        "show"
      );


    setTimeout(
      () => {

        comboPop
          .classList
          .remove(
            "show"
          );

      },
      360
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
      spawnTimer
    );


    clearTimeout(
      messageTimer
    );


    const elapsed =
      performance.now() -
      startedAt;


    const accuracy =
      shots > 0
        ? hits /
          shots
        : 0;


    const completion =
      clamp(
        destroyed /
        targetDestroyedGoal,

        0,
        1
      );


    const survival =
      Math.max(
        0,

        1 -
        escaped /
        maxEscapes
      );


    const speedScore =
      success
        ? clamp(
            100 -
            Math.max(
              0,

              elapsed -
              10000
            ) /
            150,

            0,
            100
          )

        : 0;


    const finalScore =
      clamp(
        completion *
          40 +

        accuracy *
          30 +

        survival *
          15 +

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

                maxCombo *
                  5 +

                survival *
                  20,

                0,
                100
              )
            ),

          meta: {
            success,

            destroyed,

            escaped,

            shots,

            hits,

            maxCombo,

            accuracy:
              Math.round(
                accuracy *
                100
              ),

            elapsed:
              Math.round(
                elapsed
              )
          }
        });

      },

      success
        ? 650
        : 250
    );
  }


  /* ==========================================
  DEVICE
  ========================================== */

  function isMobileLike() {
    return (
      window.matchMedia(
        "(pointer: coarse)"
      ).matches ||

      window.innerWidth <=
      700
    );
  }


  /* ==========================================
  EVENTS
  ========================================== */

  stage.addEventListener(
    "pointermove",
    stagePointerMove
  );


  stage.addEventListener(
    "pointerdown",
    stagePointerDown
  );


  joystick.addEventListener(
    "pointerdown",
    joystickPointerDown
  );


  joystick.addEventListener(
    "pointermove",
    joystickPointerMove
  );


  joystick.addEventListener(
    "pointerup",
    joystickPointerUp
  );


  joystick.addEventListener(
    "pointercancel",
    joystickPointerUp
  );


  mobileFireButton.addEventListener(
    "pointerdown",
    mobileFire
  );


  /* ==========================================
  INITIAL AIM
  ========================================== */

  requestAnimationFrame(
    () => {

      const rect =
        stage
          .getBoundingClientRect();


      updateCrosshairFromLocal(
        rect.width /
        2,

        rect.height /
        2
      );

    }
  );


  /* ==========================================
  START
  ========================================== */

  updateHud();

  spawnEnemy();

  world.start();


  /* ==========================================
  CLEANUP
  ========================================== */

  return () => {
    active =
      false;


    clearTimeout(
      spawnTimer
    );


    clearTimeout(
      messageTimer
    );


    stage.removeEventListener(
      "pointermove",
      stagePointerMove
    );


    stage.removeEventListener(
      "pointerdown",
      stagePointerDown
    );


    joystick.removeEventListener(
      "pointerdown",
      joystickPointerDown
    );


    joystick.removeEventListener(
      "pointermove",
      joystickPointerMove
    );


    joystick.removeEventListener(
      "pointerup",
      joystickPointerUp
    );


    joystick.removeEventListener(
      "pointercancel",
      joystickPointerUp
    );


    mobileFireButton.removeEventListener(
      "pointerdown",
      mobileFire
    );


    world.destroy();
  };
}


/* ==========================================
UTIL
========================================== */

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


function smoothStep(
  value
) {
  const t =
    clamp(
      value,
      0,
      1
    );


  return (
    t *
    t *
    (
      3 -
      2 *
      t
    )
  );
}
