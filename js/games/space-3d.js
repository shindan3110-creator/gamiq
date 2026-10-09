// GAMIQ（ゲーミック） v2
// SPACE BLASTER
//
// 操作:
// マウス / 指で照準を動かす
// タップ / クリック / FIREで射撃
//
// 終了:
// 敵機を6機撃破 → CLEAR
// 敵を3機逃す → GAME OVER

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

  let enemySpawnTimer = null;

  let messageTimer = null;

  let crosshairX = 0;
  let crosshairY = 0;

  let screenShake = 0;


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
          AIM + FIRE
        </div>

      </div>


      <div class="space-blaster-bottom">

        <div class="space-life">
          ESCAPE

          <strong data-space-escape>
            ○ ○ ○
          </strong>
        </div>


        <button
          type="button"
          class="space-blaster-fire"
          data-space-fire
        >
          FIRE
        </button>

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

  const crosshairElement =
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

  const fireButton =
    container.querySelector(
      "[data-space-fire]"
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
      0x3de8ff,
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
      0x7755ff,
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
      0xff345f,
      2,
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

  const starCount =
    600;


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
  ENEMY CREATOR
  ========================================== */

  function buildEnemy() {
    const ship =
      new T.Group();


    const bodyMaterial =
      new T.MeshStandardMaterial({
        color:
          0x40566f,

        metalness:
          0.82,

        roughness:
          0.2
      });


    const glowMaterial =
      new T.MeshStandardMaterial({
        color:
          0x66efff,

        emissive:
          0x3bdcff,

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
          0xff355d,

        emissive:
          0xff1744,

        emissiveIntensity:
          3.3,

        metalness:
          0.3,

        roughness:
          0.2
      });


    /* body */

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


    /* cockpit */

    const cockpit =
      new T.Mesh(
        new T.SphereGeometry(
          0.3,
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


    /* wings */

    const wingGeometry =
      new T.BoxGeometry(
        1.65,
        0.11,
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


    /* target core */

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


    /* engines */

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


    enemy.position.set(
      randomBetween(
        -3.4,
        3.4
      ),

      randomBetween(
        -2.1,
        2.3
      ),

      randomBetween(
        -14,
        -10
      )
    );


    enemy.userData.health =
      destroyed >= 4
        ? 115
        : 100;


    enemy.userData.vx =
      randomSigned(
        randomBetween(
          1.2,
          2.2
        )
      );


    enemy.userData.vy =
      randomSigned(
        randomBetween(
          0.8,
          1.7
        )
      );


    enemy.userData.forwardSpeed =
      randomBetween(
        0.5,
        0.9
      ) +
      destroyed *
        0.08;


    enemy.userData.turnTimer =
      randomBetween(
        0.35,
        0.9
      );


    enemy.userData.dashTimer =
      randomBetween(
        1.1,
        2.1
      );


    enemy.userData.dash =
      0;


    enemy.userData.age =
      0;


    world.scene.add(
      enemy
    );


    showMessage(
      "TARGET!"
    );
  }


  spawnEnemy();


  /* ==========================================
  ENEMY MOVEMENT
  ========================================== */

  world.addUpdate(
    (
      delta,
      elapsed
    ) => {

      if (!active) {
        return;
      }


      /* stars move toward player */

      stars.position.z +=
        delta *
        3.4;


      if (
        stars.position.z >
        8
      ) {
        stars.position.z =
          0;
      }


      /* camera shake */

      if (
        screenShake >
        0
      ) {
        screenShake -=
          delta;


        world.camera.position.x =
          randomBetween(
            -0.035,
            0.035
          );


        world.camera.position.y =
          0.4 +
          randomBetween(
            -0.035,
            0.035
          );
      } else {
        world.camera.position.x =
          0;


        world.camera.position.y =
          0.4;
      }


      if (
        !enemy ||
        enemyDying
      ) {
        return;
      }


      enemy.userData.age +=
        delta;


      enemy.userData.turnTimer -=
        delta;


      enemy.userData.dashTimer -=
        delta;


      /* ======================================
      RANDOM DIRECTION CHANGE
      ====================================== */

      if (
        enemy.userData.turnTimer <=
        0
      ) {
        enemy.userData.vx =
          randomSigned(
            randomBetween(
              1.3,
              2.8
            )
          );


        enemy.userData.vy =
          randomSigned(
            randomBetween(
              0.7,
              2
            )
          );


        enemy.userData.turnTimer =
          randomBetween(
            0.35,
            0.85
          );
      }


      /* ======================================
      DODGE / DASH
      ====================================== */

      if (
        enemy.userData.dashTimer <=
        0
      ) {
        enemy.userData.dash =
          randomBetween(
            2.2,
            4
          );


        enemy.userData.vx *=
          1.8;


        enemy.userData.vy *=
          1.35;


        enemy.userData.dashTimer =
          randomBetween(
            1,
            1.8
          );
      }


      if (
        enemy.userData.dash >
        0
      ) {
        enemy.userData.dash -=
          delta * 5;
      }


      /* ======================================
      MOVE
      ====================================== */

      enemy.position.x +=
        enemy.userData.vx *
        delta;


      enemy.position.y +=
        enemy.userData.vy *
        delta;


      enemy.position.z +=
        enemy.userData.forwardSpeed *
        delta;


      /* banking */

      enemy.rotation.z =
        clamp(
          -enemy.userData.vx *
          0.12,
          -0.38,
          0.38
        );


      enemy.rotation.x =
        Math.sin(
          elapsed * 2.2
        ) *
        0.08;


      enemy.rotation.y +=
        delta *
        0.55;


      /* ======================================
      BOUNDS
      ====================================== */

      if (
        enemy.position.x >
        4
      ) {
        enemy.position.x =
          4;


        enemy.userData.vx =
          -Math.abs(
            enemy.userData.vx
          );
      }


      if (
        enemy.position.x <
        -4
      ) {
        enemy.position.x =
          -4;


        enemy.userData.vx =
          Math.abs(
            enemy.userData.vx
          );
      }


      if (
        enemy.position.y >
        2.8
      ) {
        enemy.position.y =
          2.8;


        enemy.userData.vy =
          -Math.abs(
            enemy.userData.vy
          );
      }


      if (
        enemy.position.y <
        -2.5
      ) {
        enemy.position.y =
          -2.5;


        enemy.userData.vy =
          Math.abs(
            enemy.userData.vy
          );
      }


      /* escaped */

      if (
        enemy.position.z >
        4.3
      ) {
        enemyEscaped();
      }

    }
  );


  /* ==========================================
  POINTER / AIM
  ========================================== */

  const pointer =
    new T.Vector2(
      0,
      0
    );


  const raycaster =
    new T.Raycaster();


  function updatePointer(
    clientX,
    clientY
  ) {
    const rect =
      stage
        .getBoundingClientRect();


    const localX =
      clamp(
        clientX -
        rect.left,
        0,
        rect.width
      );


    const localY =
      clamp(
        clientY -
        rect.top,
        0,
        rect.height
      );


    crosshairElement.style.left =
      `${localX}px`;


    crosshairElement.style.top =
      `${localY}px`;


    pointer.x =
      (
        localX /
        rect.width
      ) *
      2 -
      1;


    pointer.y =
      -(
        localY /
        rect.height
      ) *
      2 +
      1;


    crosshairX =
      clientX;


    crosshairY =
      clientY;
  }


  function pointerMove(
    event
  ) {
    if (!active) {
      return;
    }


    updatePointer(
      event.clientX,
      event.clientY
    );
  }


  /* ==========================================
  SHOOT
  ========================================== */

  function shoot(
    clientX = null,
    clientY = null
  ) {
    if (
      !active ||
      !enemy ||
      enemyDying
    ) {
      return;
    }


    shots++;


    if (
      clientX !== null &&
      clientY !== null
    ) {
      updatePointer(
        clientX,
        clientY
      );
    }


    createLaserEffect();


    raycaster.setFromCamera(
      pointer,
      world.camera
    );


    const intersections =
      raycaster.intersectObjects(
        enemy.userData
          .hitTargets ||
        [],
        true
      );


    if (
      intersections.length >
      0
    ) {
      hits++;


      const hitObject =
        intersections[0]
          .object;


      let damage =
        randomBetween(
          38,
          50
        );


      if (
        hitObject.userData
          ?.isCore
      ) {
        damage *=
          1.75;


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
        intersections[0]
          .point
      );


      flashEnemy();


      screenShake =
        0.13;


      enemy.position.z -=
        0.45;


      enemy.userData.vx *=
        -0.8;


      showCombo();


      if (
        enemy.userData.health <=
        0
      ) {
        destroyEnemy();
      }

    } else {

      combo =
        0;


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


  function canvasShoot(
    event
  ) {
    shoot(
      event.clientX,
      event.clientY
    );
  }


  /* ==========================================
  LASER
  ========================================== */

  function createLaserEffect() {
    const origin =
      world.camera.position
        .clone();


    const destination =
      new T.Vector3(
        pointer.x,
        pointer.y,
        0.5
      );


    destination.unproject(
      world.camera
    );


    const direction =
      destination
        .sub(
          world.camera.position
        )
        .normalize();


    const end =
      origin
        .clone()
        .add(
          direction.multiplyScalar(
            22
          )
        );


    const geometry =
      new T.BufferGeometry()
        .setFromPoints([
          origin,
          end
        ]);


    const material =
      new T.LineBasicMaterial({
        color:
          0x5af4ff,

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


    fireButton.classList.remove(
      "fire-kick"
    );


    void fireButton.offsetWidth;


    fireButton.classList.add(
      "fire-kick"
    );


    setTimeout(
      () => {

        world.scene.remove(
          laser
        );


        geometry.dispose();

        material.dispose();

      },
      70
    );
  }


  /* ==========================================
  HIT FLASH
  ========================================== */

  function flashEnemy() {
    if (!enemy) {
      return;
    }


    const originals =
      [];


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


        originals.push({
          object,
          original,
          flash
        });

      }
    );


    setTimeout(
      () => {

        originals.forEach(
          item => {

            item.object.material =
              item.original;


            item.flash.dispose();

          }
        );

      },
      80
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


    const pieces =
      [];


    for (
      let i = 0;
      i < 16;
      i++
    ) {
      const piece =
        new T.Mesh(
          new T.BoxGeometry(
            0.055,
            0.055,
            0.055
          ),

          new T.MeshBasicMaterial({
            color:
              Math.random() <
              0.5
                ? 0x5ef2ff
                : 0xffffff
          })
        );


      const velocity =
        new T.Vector3(
          randomBetween(
            -3,
            3
          ),

          randomBetween(
            -3,
            3
          ),

          randomBetween(
            -1,
            3
          )
        );


      pieces.push({
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


        pieces.forEach(
          item => {

            item.piece.position
              .addScaledVector(
                item.velocity,
                delta
              );


            item.piece.scale
              .multiplyScalar(
                0.94
              );

          }
        );


        if (
          age >
          0.38
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


    const fragments =
      [];


    for (
      let i = 0;
      i < 28;
      i++
    ) {
      const material =
        new T.MeshBasicMaterial({
          color:
            [
              0xff365d,
              0xffa53d,
              0x66efff,
              0xffffff
            ][
              Math.floor(
                Math.random() *
                4
              )
            ]
        });


      const fragment =
        new T.Mesh(
          new T.BoxGeometry(
            randomBetween(
              0.05,
              0.13
            ),

            randomBetween(
              0.05,
              0.13
            ),

            randomBetween(
              0.05,
              0.13
            )
          ),

          material
        );


      const velocity =
        new T.Vector3(
          randomBetween(
            -5,
            5
          ),

          randomBetween(
            -5,
            5
          ),

          randomBetween(
            -3,
            5
          )
        );


      fragments.push({
        fragment,
        velocity
      });


      group.add(
        fragment
      );
    }


    /* expanding core */

    const core =
      new T.Mesh(
        new T.SphereGeometry(
          0.3,
          16,
          10
        ),

        new T.MeshBasicMaterial({
          color:
            0xffffff,

          transparent:
            true,

          opacity:
            0.95
        })
      );


    group.add(
      core
    );


    let age =
      0;


    const updater =
      delta => {

        age +=
          delta;


        fragments.forEach(
          item => {

            item.fragment.position
              .addScaledVector(
                item.velocity,
                delta
              );


            item.fragment.rotation.x +=
              delta * 8;


            item.fragment.rotation.y +=
              delta * 6;


            item.fragment.scale
              .multiplyScalar(
                0.96
              );

          }
        );


        core.scale
          .multiplyScalar(
            1 +
            delta * 7
          );


        core.material.opacity =
          Math.max(
            0,
            1 -
            age * 3
          );


        if (
          age >
          0.55
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
  DESTROY
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
      0.28;


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
        () => finish(true),
        500
      );

      return;
    }


    enemySpawnTimer =
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


    const escapedEnemy =
      enemy;


    enemy =
      null;


    combo =
      0;


    escaped++;


    world.disposeObject(
      escapedEnemy
    );


    showMessage(
      "ESCAPED!"
    );


    stage.classList.remove(
      "space-stage-miss"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "space-stage-miss"
    );


    updateHud();


    if (
      escaped >=
      maxEscapes
    ) {
      finish(false);

      return;
    }


    enemySpawnTimer =
      setTimeout(
        () => {

          enemyDying =
            false;


          spawnEnemy();

        },
        420
      );
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
        accuracy * 100
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
      ).join(
        " "
      );
  }


  /* ==========================================
  MESSAGE FX
  ========================================== */

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
      enemySpawnTimer
    );


    clearTimeout(
      messageTimer
    );


    const elapsed =
      performance.now() -
      startedAt;


    const accuracy =
      shots >
      0
        ? hits /
          shots
        : 0;


    const completion =
      destroyed /
      targetDestroyedGoal;


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
  EVENTS
  ========================================== */

  stage.addEventListener(
    "pointermove",
    pointerMove
  );


  stage.addEventListener(
    "pointerdown",
    canvasShoot
  );


  function fireButtonHandler(
    event
  ) {
    event.stopPropagation();


    shoot(
      crosshairX || null,
      crosshairY || null
    );
  }


  fireButton.addEventListener(
    "pointerdown",
    fireButtonHandler
  );


  /* ==========================================
  INITIAL CROSSHAIR
  ========================================== */

  requestAnimationFrame(
    () => {

      const rect =
        stage
          .getBoundingClientRect();


      updatePointer(
        rect.left +
        rect.width /
          2,

        rect.top +
        rect.height /
          2
      );

    }
  );


  updateHud();


  world.start();


  /* ==========================================
  CLEANUP
  ========================================== */

  return () => {
    active =
      false;


    clearTimeout(
      enemySpawnTimer
    );


    clearTimeout(
      messageTimer
    );


    stage.removeEventListener(
      "pointermove",
      pointerMove
    );


    stage.removeEventListener(
      "pointerdown",
      canvasShoot
    );


    fireButton.removeEventListener(
      "pointerdown",
      fireButtonHandler
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


function randomSigned(
  value
) {
  return (
    Math.random() <
    0.5
      ? -value
      : value
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
