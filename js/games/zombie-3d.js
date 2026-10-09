// GAMIQ（ゲーミック） v2
// ZOMBIE SLASH
//
// 操作:
// ゾンビの上をスワイプして斬る
//
// 終了:
// 5体撃破 → CLEAR
// 3回突破される → GAME OVER

import {
  GamiqThreeScene
} from "./three-renderer.js";


export async function runZombie3D({
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

  let kills = 0;
  let lives = 3;

  let combo = 0;
  let maxCombo = 0;

  let totalSlashes = 0;
  let hitSlashes = 0;

  const targetKills = 5;

  const startedAt =
    performance.now();

  let currentZombie = null;

  let currentZombieHP = 0;

  let zombieSpeed = 0;

  let spawning = false;

  let zombieIsDying = false;

  let hitLocked = false;


  /* ==========================================
  HTML
  ========================================== */

  container.innerHTML = `
    <div class="zombie-slash-wrap">

      <div class="zombie-slash-hud">

        <div class="zombie-hud-item">
          <span>KILLS</span>

          <strong>
            <b data-zombie-kills>0</b>
            / ${targetKills}
          </strong>
        </div>


        <div class="zombie-hud-item zombie-combo-item">
          <span>COMBO</span>

          <strong data-zombie-combo>
            0
          </strong>
        </div>


        <div class="zombie-hud-item zombie-life-item">
          <span>LIFE</span>

          <strong data-zombie-lives>
            ♥ ♥ ♥
          </strong>
        </div>

      </div>


      <div
        class="zombie-slash-stage"
        data-zombie-stage
      >

        <div
          class="zombie-3d-world"
          data-zombie-world
        ></div>


        <canvas
          class="zombie-slash-canvas"
          data-zombie-slash-canvas
        ></canvas>


        <div
          class="zombie-slash-message"
          data-zombie-message
        >
        </div>


        <div
          class="zombie-slash-combo-pop"
          data-zombie-combo-pop
        >
        </div>


        <div class="zombie-slash-hint">
          SWIPE TO SLASH
        </div>

      </div>

    </div>
  `;


  /* ==========================================
  ELEMENTS
  ========================================== */

  const worldElement =
    container.querySelector(
      "[data-zombie-world]"
    );

  const stage =
    container.querySelector(
      "[data-zombie-stage]"
    );

  const slashCanvas =
    container.querySelector(
      "[data-zombie-slash-canvas]"
    );

  const killsElement =
    container.querySelector(
      "[data-zombie-kills]"
    );

  const comboElement =
    container.querySelector(
      "[data-zombie-combo]"
    );

  const livesElement =
    container.querySelector(
      "[data-zombie-lives]"
    );

  const messageElement =
    container.querySelector(
      "[data-zombie-message]"
    );

  const comboPop =
    container.querySelector(
      "[data-zombie-combo-pop]"
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
        0x030706
    });


  const initialized =
    await world.init();


  if (!initialized) {
    container.innerHTML = `
      <div class="zombie-3d-fallback">
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
    1.2,
    8
  );

  world.camera.lookAt(
    0,
    0,
    -4
  );


  /* ==========================================
  ENVIRONMENT
  ========================================== */

  world.addFloor({
    width: 20,
    depth: 42,
    color: 0x0c120e,
    y: -2
  });


  world.scene.fog =
    new T.Fog(
      0x030706,
      7,
      28
    );


  /* green side light */

  const greenLight =
    new T.PointLight(
      0x55ff88,
      3,
      18
    );

  greenLight.position.set(
    -5,
    4,
    2
  );

  world.scene.add(
    greenLight
  );


  /* red side light */

  const redLight =
    new T.PointLight(
      0xff284f,
      2.4,
      18
    );

  redLight.position.set(
    5,
    2,
    -1
  );

  world.scene.add(
    redLight
  );


  /* distant lights */

  for (
    let i = 0;
    i < 8;
    i++
  ) {
    const lamp =
      new T.Mesh(
        new T.BoxGeometry(
          0.12,
          0.12,
          0.12
        ),

        new T.MeshBasicMaterial({
          color:
            i % 2 === 0
              ? 0x44ff88
              : 0xff3355
        })
      );


    lamp.position.set(
      i % 2 === 0
        ? -4.5
        : 4.5,

      0.5 +
        Math.random() * 2,

      -4 -
        i * 3
    );


    world.scene.add(
      lamp
    );
  }


  /* ==========================================
  MATERIALS
  ========================================== */

  const skinMaterial =
    new T.MeshStandardMaterial({
      color:
        0x76a969,

      roughness:
        0.82
    });


  const shirtMaterial =
    new T.MeshStandardMaterial({
      color:
        0x33413b,

      roughness:
        0.9
    });


  const pantsMaterial =
    new T.MeshStandardMaterial({
      color:
        0x181d20,

      roughness:
        0.92
    });


  const eyeMaterial =
    new T.MeshStandardMaterial({
      color:
        0xff2244,

      emissive:
        0xff001f,

      emissiveIntensity:
        3
    });


  /* ==========================================
  ZOMBIE CREATOR
  ========================================== */

  function createZombie() {
    const zombie =
      new T.Group();


    zombie.userData.hitTargets =
      [];


    /* torso */

    const torso =
      new T.Mesh(
        new T.BoxGeometry(
          1.45,
          1.9,
          0.72
        ),

        shirtMaterial.clone()
      );


    torso.position.y =
      0.35;


    torso.castShadow =
      true;


    torso.userData.zombiePart =
      true;


    zombie.add(
      torso
    );


    zombie.userData.hitTargets.push(
      torso
    );


    /* head */

    const head =
      new T.Mesh(
        new T.BoxGeometry(
          1.03,
          1.03,
          0.9
        ),

        skinMaterial.clone()
      );


    head.position.y =
      1.85;


    head.castShadow =
      true;


    head.userData.zombiePart =
      true;


    zombie.add(
      head
    );


    zombie.userData.hitTargets.push(
      head
    );


    /* eyes */

    const leftEye =
      new T.Mesh(
        new T.SphereGeometry(
          0.085,
          10,
          7
        ),

        eyeMaterial
      );


    leftEye.position.set(
      -0.2,
      1.96,
      0.47
    );


    zombie.add(
      leftEye
    );


    const rightEye =
      leftEye.clone();


    rightEye.position.x =
      0.2;


    zombie.add(
      rightEye
    );


    /* arms */

    const leftArm =
      new T.Mesh(
        new T.BoxGeometry(
          0.4,
          1.8,
          0.4
        ),

        skinMaterial.clone()
      );


    leftArm.position.set(
      -0.95,
      0.55,
      0
    );


    leftArm.rotation.z =
      -0.28;


    leftArm.userData.zombiePart =
      true;


    zombie.add(
      leftArm
    );


    zombie.userData.hitTargets.push(
      leftArm
    );


    const rightArm =
      leftArm.clone();


    rightArm.position.x =
      0.95;


    rightArm.rotation.z =
      0.28;


    rightArm.userData.zombiePart =
      true;


    zombie.add(
      rightArm
    );


    zombie.userData.hitTargets.push(
      rightArm
    );


    /* legs */

    const leftLeg =
      new T.Mesh(
        new T.BoxGeometry(
          0.5,
          1.9,
          0.5
        ),

        pantsMaterial.clone()
      );


    leftLeg.position.set(
      -0.38,
      -1.48,
      0
    );


    leftLeg.userData.zombiePart =
      true;


    zombie.add(
      leftLeg
    );


    zombie.userData.hitTargets.push(
      leftLeg
    );


    const rightLeg =
      leftLeg.clone();


    rightLeg.position.x =
      0.38;


    rightLeg.userData.zombiePart =
      true;


    zombie.add(
      rightLeg
    );


    zombie.userData.hitTargets.push(
      rightLeg
    );


    zombie.userData.parts = {
      torso,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg
    };


    return zombie;
  }


  /* ==========================================
  SPAWN
  ========================================== */

  function spawnZombie() {
    if (
      !active ||
      spawning
    ) {
      return;
    }


    spawning =
      true;


    zombieIsDying =
      false;


    hitLocked =
      false;


    const zombie =
      createZombie();


    const lane =
      [
        -2.5,
        -1.2,
        0,
        1.2,
        2.5
      ][
        Math.floor(
          Math.random() * 5
        )
      ];


    zombie.position.set(
      lane,
      -0.35,
      -17
    );


    zombie.rotation.y =
      (
        Math.random() -
        0.5
      ) *
      0.18;


    world.scene.add(
      zombie
    );


    currentZombie =
      zombie;


    /*
     * 最初は2発
     * 後半は3発必要な場合あり
     */

    currentZombieHP =
      kills >= 3
        ? (
            Math.random() <
            0.45
              ? 3
              : 2
          )
        : 2;


    /*
     * 徐々に速くなる
     */

    zombieSpeed =
      2.45 +
      kills * 0.22 +
      Math.random() *
        0.35;


    spawning =
      false;
  }


  /* ==========================================
  ZOMBIE ANIMATION
  ========================================== */

  world.addUpdate(
    (
      delta,
      elapsed
    ) => {

      if (
        !active ||
        !currentZombie ||
        zombieIsDying
      ) {
        return;
      }


      const zombie =
        currentZombie;


      zombie.position.z +=
        zombieSpeed *
        delta;


      /*
       * 左右に少し揺れる
       */

      zombie.position.x +=
        Math.sin(
          elapsed * 3.1
        ) *
        delta *
        0.18;


      /*
       * 歩行
       */

      const parts =
        zombie.userData.parts;


      if (parts) {
        parts.leftArm.rotation.x =
          Math.sin(
            elapsed * 7
          ) *
          0.42;


        parts.rightArm.rotation.x =
          Math.sin(
            elapsed * 7 +
            Math.PI
          ) *
          0.42;


        parts.leftLeg.rotation.x =
          Math.sin(
            elapsed * 7 +
            Math.PI
          ) *
          0.28;


        parts.rightLeg.rotation.x =
          Math.sin(
            elapsed * 7
          ) *
          0.28;


        parts.torso.rotation.z =
          Math.sin(
            elapsed * 3.5
          ) *
          0.045;
      }


      /*
       * プレイヤーまで来た
       */

      if (
        zombie.position.z >
        4.1
      ) {
        zombieReachedPlayer();
      }

    }
  );


  /* ==========================================
  SLASH CANVAS
  ========================================== */

  const slashContext =
    slashCanvas.getContext(
      "2d"
    );


  function resizeSlashCanvas() {
    const rect =
      stage.getBoundingClientRect();


    const dpr =
      Math.min(
        window.devicePixelRatio ||
        1,
        2
      );


    slashCanvas.width =
      Math.max(
        1,
        Math.floor(
          rect.width *
          dpr
        )
      );


    slashCanvas.height =
      Math.max(
        1,
        Math.floor(
          rect.height *
          dpr
        )
      );


    slashCanvas.style.width =
      `${rect.width}px`;


    slashCanvas.style.height =
      `${rect.height}px`;


    slashContext.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );
  }


  resizeSlashCanvas();


  window.addEventListener(
    "resize",
    resizeSlashCanvas
  );


  /* ==========================================
  SWIPE INPUT
  ========================================== */

  let dragging = false;

  let startX = 0;
  let startY = 0;

  let lastX = 0;
  let lastY = 0;

  let startTime = 0;

  let slashPoints = [];


  function pointerDown(
    event
  ) {
    if (!active) {
      return;
    }


    dragging =
      true;


    const rect =
      slashCanvas
        .getBoundingClientRect();


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


    startTime =
      performance.now();


    slashPoints = [
      {
        x:
          startX,

        y:
          startY
      }
    ];


    slashCanvas.setPointerCapture?.(
      event.pointerId
    );
  }


  function pointerMove(
    event
  ) {
    if (
      !active ||
      !dragging
    ) {
      return;
    }


    const rect =
      slashCanvas
        .getBoundingClientRect();


    const x =
      event.clientX -
      rect.left;


    const y =
      event.clientY -
      rect.top;


    const dx =
      x -
      lastX;


    const dy =
      y -
      lastY;


    const distance =
      Math.hypot(
        dx,
        dy
      );


    if (
      distance <
      2
    ) {
      return;
    }


    drawSlashSegment(
      lastX,
      lastY,
      x,
      y
    );


    slashPoints.push({
      x,
      y
    });


    /*
     * 軌跡上を毎回ヒット判定
     */

    testSlashSegment(
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
      !dragging
    ) {
      return;
    }


    dragging =
      false;


    totalSlashes++;


    const elapsed =
      Math.max(
        1,
        performance.now() -
        startTime
      );


    const distance =
      Math.hypot(
        lastX -
          startX,

        lastY -
          startY
      );


    const speed =
      distance /
      elapsed;


    /*
     * タップだけは斬撃として扱わない
     */

    if (
      distance <
      35 ||
      speed <
      0.15
    ) {
      fadeSlashCanvas();
      return;
    }


    fadeSlashCanvas();


    slashCanvas.releasePointerCapture?.(
      event.pointerId
    );
  }


  slashCanvas.addEventListener(
    "pointerdown",
    pointerDown
  );


  slashCanvas.addEventListener(
    "pointermove",
    pointerMove
  );


  slashCanvas.addEventListener(
    "pointerup",
    pointerUp
  );


  slashCanvas.addEventListener(
    "pointercancel",
    pointerUp
  );


  /* ==========================================
  SLASH DRAWING
  ========================================== */

  function drawSlashSegment(
    x1,
    y1,
    x2,
    y2
  ) {
    slashContext.save();


    slashContext.lineCap =
      "round";


    slashContext.lineJoin =
      "round";


    /*
     * outer glow
     */

    slashContext.beginPath();

    slashContext.moveTo(
      x1,
      y1
    );

    slashContext.lineTo(
      x2,
      y2
    );


    slashContext.strokeStyle =
      "rgba(85,255,150,.28)";


    slashContext.lineWidth =
      18;


    slashContext.shadowColor =
      "rgba(70,255,140,.95)";


    slashContext.shadowBlur =
      22;


    slashContext.stroke();


    /*
     * sword core
     */

    slashContext.beginPath();

    slashContext.moveTo(
      x1,
      y1
    );

    slashContext.lineTo(
      x2,
      y2
    );


    slashContext.strokeStyle =
      "rgba(235,255,245,.98)";


    slashContext.lineWidth =
      4;


    slashContext.shadowBlur =
      9;


    slashContext.stroke();


    slashContext.restore();
  }


  function fadeSlashCanvas() {
    let opacity =
      1;


    function fade() {
      if (!slashContext) {
        return;
      }


      opacity -=
        0.15;


      slashContext.save();


      slashContext.globalCompositeOperation =
        "destination-out";


      slashContext.fillStyle =
        `rgba(0,0,0,${
          1 - opacity
        })`;


      slashContext.fillRect(
        0,
        0,
        slashCanvas.width,
        slashCanvas.height
      );


      slashContext.restore();


      if (
        opacity >
        0
      ) {
        requestAnimationFrame(
          fade
        );
      } else {
        slashContext.clearRect(
          0,
          0,
          slashCanvas.width,
          slashCanvas.height
        );
      }
    }


    requestAnimationFrame(
      fade
    );
  }


  /* ==========================================
  HIT TEST
  ========================================== */

  const raycaster =
    new T.Raycaster();


  const pointer =
    new T.Vector2();


  function testSlashSegment(
    x1,
    y1,
    x2,
    y2
  ) {
    if (
      !currentZombie ||
      zombieIsDying ||
      hitLocked
    ) {
      return;
    }


    const length =
      Math.hypot(
        x2 - x1,
        y2 - y1
      );


    const samples =
      Math.max(
        2,
        Math.ceil(
          length / 14
        )
      );


    for (
      let i = 0;
      i <= samples;
      i++
    ) {
      const t =
        i / samples;


      const x =
        x1 +
        (
          x2 - x1
        ) *
        t;


      const y =
        y1 +
        (
          y2 - y1
        ) *
        t;


      if (
        hitTestPoint(
          x,
          y
        )
      ) {
        registerHit();

        return;
      }
    }
  }


  function hitTestPoint(
    x,
    y
  ) {
    if (!currentZombie) {
      return false;
    }


    const rect =
      slashCanvas
        .getBoundingClientRect();


    pointer.x =
      (
        x /
        rect.width
      ) *
      2 -
      1;


    pointer.y =
      -(
        y /
        rect.height
      ) *
      2 +
      1;


    raycaster.setFromCamera(
      pointer,
      world.camera
    );


    const intersections =
      raycaster.intersectObjects(
        currentZombie
          .userData
          .hitTargets ||
        [],
        true
      );


    return (
      intersections.length >
      0
    );
  }


  /* ==========================================
  HIT
  ========================================== */

  function registerHit() {
    if (
      !active ||
      !currentZombie ||
      zombieIsDying ||
      hitLocked
    ) {
      return;
    }


    hitLocked =
      true;


    hitSlashes++;


    currentZombieHP--;


    combo++;


    maxCombo =
      Math.max(
        maxCombo,
        combo
      );


    updateHUD();


    /*
     * HIT STOP
     */

    zombieSpeed *=
      0.22;


    /*
     * knockback
     */

    currentZombie.position.z -=
      1.1;


    currentZombie.rotation.z =
      (
        Math.random() <
        0.5
          ? -1
          : 1
      ) *
      0.18;


    /*
     * flash
     */

    flashZombie();


    /*
     * sparks
     */

    createHitParticles(
      currentZombie.position
    );


    /*
     * screen feedback
     */

    stage.classList.remove(
      "zombie-stage-hit"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "zombie-stage-hit"
    );


    showMessage(
      currentZombieHP <=
      0
        ? "SLASH!"
        : "HIT!"
    );


    showCombo();


    if (
      currentZombieHP <=
      0
    ) {
      killZombie();

      return;
    }


    setTimeout(
      () => {

        if (
          !active ||
          !currentZombie
        ) {
          return;
        }


        currentZombie.rotation.z =
          0;


        zombieSpeed =
          2.45 +
          kills * 0.22 +
          Math.random() *
            0.35;


        hitLocked =
          false;

      },
      170
    );
  }


  /* ==========================================
  FLASH
  ========================================== */

  function flashZombie() {
    if (!currentZombie) {
      return;
    }


    const changed =
      [];


    currentZombie.traverse(
      object => {

        if (
          !object.isMesh ||
          !object.material
        ) {
          return;
        }


        const original =
          object.material;


        object.material =
          original.clone();


        object.material.emissive =
          new T.Color(
            0xffffff
          );


        object.material.emissiveIntensity =
          2.5;


        changed.push({
          object,
          original
        });

      }
    );


    setTimeout(
      () => {

        changed.forEach(
          item => {

            item.object.material =
              item.original;

          }
        );

      },
      90
    );
  }


  /* ==========================================
  PARTICLES
  ========================================== */

  function createHitParticles(
    sourcePosition
  ) {
    const group =
      new T.Group();


    group.position.copy(
      sourcePosition
    );


    world.scene.add(
      group
    );


    const particles =
      [];


    for (
      let i = 0;
      i < 12;
      i++
    ) {
      const particle =
        new T.Mesh(
          new T.BoxGeometry(
            0.07,
            0.07,
            0.07
          ),

          new T.MeshBasicMaterial({
            color:
              Math.random() <
              0.5
                ? 0x7aff9d
                : 0xffffff
          })
        );


      particle.position.set(
        (
          Math.random() -
          0.5
        ) *
        1.4,

        0.5 +
          Math.random() *
          2.2,

        0.5
      );


      const velocity = {
        x:
          (
            Math.random() -
            0.5
          ) *
          4,

        y:
          1 +
          Math.random() *
          3,

        z:
          Math.random() *
          2
      };


      particles.push({
        mesh:
          particle,

        velocity
      });


      group.add(
        particle
      );
    }


    let age =
      0;


    const removeUpdate =
      world.addUpdate?.(
        delta => {

          age +=
            delta;


          particles.forEach(
            item => {

              item.mesh.position.x +=
                item.velocity.x *
                delta;


              item.mesh.position.y +=
                item.velocity.y *
                delta;


              item.mesh.position.z +=
                item.velocity.z *
                delta;


              item.velocity.y -=
                6 *
                delta;


              item.mesh.scale.multiplyScalar(
                0.96
              );

            }
          );


          if (
            age >
            0.45
          ) {
            world.scene.remove(
              group
            );


            if (
              typeof removeUpdate ===
              "function"
            ) {
              removeUpdate();
            }
          }

        }
      );
  }


  /* ==========================================
  KILL
  ========================================== */

  function killZombie() {
    if (
      !currentZombie ||
      zombieIsDying
    ) {
      return;
    }


    zombieIsDying =
      true;


    hitLocked =
      true;


    const deadZombie =
      currentZombie;


    kills++;


    updateHUD();


    showMessage(
      kills >=
      targetKills
        ? "FINAL SLASH!"
        : "ZOMBIE DOWN"
    );


    /*
     * death animation
     */

    const start =
      performance.now();


    const startY =
      deadZombie.position.y;


    const startRotation =
      deadZombie.rotation.z;


    function animateDeath(
      now
    ) {
      if (!active) {
        return;
      }


      const t =
        Math.min(
          1,
          (
            now -
            start
          ) /
          420
        );


      deadZombie.rotation.z =
        startRotation +
        (
          Math.PI /
          2 -
          startRotation
        ) *
        t;


      deadZombie.position.y =
        startY -
        t *
        1.3;


      deadZombie.position.z -=
        t *
        0.018;


      if (
        t <
        1
      ) {
        requestAnimationFrame(
          animateDeath
        );
      } else {

        world.scene.remove(
          deadZombie
        );


        if (
          currentZombie ===
          deadZombie
        ) {
          currentZombie =
            null;
        }


        if (
          kills >=
          targetKills
        ) {
          finish(
            true
          );
        } else {

          setTimeout(
            spawnZombie,
            260
          );

        }
      }
    }


    requestAnimationFrame(
      animateDeath
    );
  }


  /* ==========================================
  ZOMBIE REACHES PLAYER
  ========================================== */

  function zombieReachedPlayer() {
    if (
      !active ||
      !currentZombie ||
      zombieIsDying
    ) {
      return;
    }


    zombieIsDying =
      true;


    combo =
      0;


    lives--;


    updateHUD();


    stage.classList.remove(
      "zombie-stage-damage"
    );


    void stage.offsetWidth;


    stage.classList.add(
      "zombie-stage-damage"
    );


    showMessage(
      "OUCH!"
    );


    const escapedZombie =
      currentZombie;


    currentZombie =
      null;


    world.scene.remove(
      escapedZombie
    );


    if (
      lives <=
      0
    ) {
      finish(
        false
      );

      return;
    }


    setTimeout(
      spawnZombie,
      450
    );
  }


  /* ==========================================
  HUD
  ========================================== */

  function updateHUD() {
    killsElement.textContent =
      kills;


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
      ).join(
        " "
      );
  }


  /* ==========================================
  TEXT FX
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
        400
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


    const elapsed =
      performance.now() -
      startedAt;


    const slashAccuracy =
      totalSlashes >
      0
        ? Math.min(
            1,
            hitSlashes /
            totalSlashes
          )
        : 0;


    const clearRate =
      kills /
      targetKills;


    const lifeRate =
      lives /
      3;


    const speedScore =
      success
        ? Math.max(
            0,
            100 -
            Math.max(
              0,
              elapsed -
              9000
            ) /
            160
          )
        : clearRate *
          50;


    const score =
      success
        ? (
            clearRate *
              35 +
            slashAccuracy *
              100 *
              25 /
              100 +
            lifeRate *
              20 +
            speedScore *
              20 /
              100
          ) *
          100 /
          100
        : (
            clearRate *
            55
          );


    const finalScore =
      Math.max(
        0,
        Math.min(
          100,

          success
            ? (
                clearRate *
                  35 +

                slashAccuracy *
                  25 +

                lifeRate *
                  20 +

                speedScore /
                  100 *
                  20
              )
            : (
                clearRate *
                45
              )
        )
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
              Math.max(
                0,
                Math.min(
                  100,
                  50 +
                  maxCombo *
                    6 +
                  lifeRate *
                    20
                )
              )
            ),

          meta: {
            success,

            kills,

            lives,

            combo:
              maxCombo,

            totalSlashes,

            hitSlashes,

            slashAccuracy:
              Math.round(
                slashAccuracy *
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
        : 300
    );
  }


  /* ==========================================
  START
  ========================================== */

  updateHUD();


  spawnZombie();


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


    window.removeEventListener(
      "resize",
      resizeSlashCanvas
    );


    slashCanvas.removeEventListener(
      "pointerdown",
      pointerDown
    );


    slashCanvas.removeEventListener(
      "pointermove",
      pointerMove
    );


    slashCanvas.removeEventListener(
      "pointerup",
      pointerUp
    );


    slashCanvas.removeEventListener(
      "pointercancel",
      pointerUp
    );


    world.destroy();
  };
}
