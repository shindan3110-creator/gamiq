// GAMIQ（ゲーミック） v2 - 3D Space Blaster

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


  let active = true;

  let shots = 0;
  let hits = 0;
  let destroyed = 0;

  let crosshairX = 0;
  let crosshairY = 0;

  const targetDestroyedGoal = 6;

  const startedAt =
    performance.now();


  container.innerHTML = `
    <div class="space-3d-wrap">

      <div class="space-3d-hud">

        <div>
          <span>DESTROYED</span>

          <strong
            data-space3d-destroyed
          >
            0 / ${targetDestroyedGoal}
          </strong>
        </div>

        <div>
          <span>ACCURACY</span>

          <strong
            data-space3d-accuracy
          >
            0%
          </strong>
        </div>

      </div>


      <div
        class="space-3d-world"
        data-space3d-world
      >

        <div
          class="space-3d-crosshair"
          data-space3d-crosshair
        >
          <span></span>
        </div>

      </div>


      <button
        type="button"
        class="space-3d-fire"
        data-space3d-fire
      >
        FIRE
      </button>

    </div>
  `;


  const worldElement =
    container.querySelector(
      "[data-space3d-world]"
    );


  const destroyedElement =
    container.querySelector(
      "[data-space3d-destroyed]"
    );


  const accuracyElement =
    container.querySelector(
      "[data-space3d-accuracy]"
    );


  const crosshairElement =
    container.querySelector(
      "[data-space3d-crosshair]"
    );


  const fireButton =
    container.querySelector(
      "[data-space3d-fire]"
    );


  const world =
    new GamiqThreeScene({
      container:
        worldElement,

      cameraZ:
        8,

      background:
        0x02050c
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


  /* ==========================================
  CAMERA
  ========================================== */

  world.camera.position.set(
    0,
    0.5,
    8
  );


  world.camera.lookAt(
    0,
    0,
    -8
  );


  /* ==========================================
  LIGHT
  ========================================== */

  const blueLight =
    new T.PointLight(
      0x4fdcff,
      4,
      18
    );


  blueLight.position.set(
    -5,
    4,
    2
  );


  world.scene.add(
    blueLight
  );


  const purpleLight =
    new T.PointLight(
      0x8566ff,
      3,
      18
    );


  purpleLight.position.set(
    5,
    -2,
    -4
  );


  world.scene.add(
    purpleLight
  );


  /* ==========================================
  STAR FIELD
  ========================================== */

  const starCount = 420;


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
      (
        Math.random() -
        0.5
      ) *
      34;


    starPositions[
      i * 3 + 1
    ] =
      (
        Math.random() -
        0.5
      ) *
      22;


    starPositions[
      i * 3 + 2
    ] =
      -Math.random() * 45;
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
        0.045,

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


  world.objects.push(
    stars
  );


  /* ==========================================
  TARGET SHIP
  ========================================== */

  let enemy =
    null;


  function createEnemy() {
    if (enemy) {
      world.disposeObject(
        enemy
      );
    }


    enemy =
      new T.Group();


    const bodyMaterial =
      new T.MeshStandardMaterial({
        color:
          0x556a82,

        metalness:
          0.7,

        roughness:
          0.25
      });


    const glowMaterial =
      new T.MeshStandardMaterial({
        color:
          0x61eaff,

        emissive:
          0x61eaff,

        emissiveIntensity:
          2.2,

        metalness:
          0.35,

        roughness:
          0.25
      });


    const dangerMaterial =
      new T.MeshStandardMaterial({
        color:
          0xff496c,

        emissive:
          0xff153d,

        emissiveIntensity:
          1.5
      });


    // Main body

    const body =
      new T.Mesh(
        new T.SphereGeometry(
          0.75,
          20,
          14
        ),

        bodyMaterial
      );


    body.scale.set(
      1.4,
      0.55,
      1
    );


    body.castShadow =
      true;


    enemy.add(
      body
    );


    // cockpit

    const cockpit =
      new T.Mesh(
        new T.SphereGeometry(
          0.32,
          16,
          12
        ),

        glowMaterial
      );


    cockpit.position.set(
      0,
      0.28,
      0.3
    );


    enemy.add(
      cockpit
    );


    // left wing

    const leftWing =
      new T.Mesh(
        new T.BoxGeometry(
          1.65,
          0.12,
          0.5
        ),

        bodyMaterial
      );


    leftWing.position.set(
      -1.05,
      -0.05,
      0
    );


    leftWing.rotation.z =
      0.12;


    enemy.add(
      leftWing
    );


    // right wing

    const rightWing =
      leftWing.clone();


    rightWing.position.x =
      1.05;


    rightWing.rotation.z =
      -0.12;


    enemy.add(
      rightWing
    );


    // core

    const core =
      new T.Mesh(
        new T.SphereGeometry(
          0.18,
          14,
          10
        ),

        dangerMaterial
      );


    core.position.set(
      0,
      -0.05,
      0.74
    );


    core.userData.isCore =
      true;


    enemy.add(
      core
    );


    // engines

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
      -0.6,
      -0.05,
      -0.7
    );


    enemy.add(
      engineLeft
    );


    const engineRight =
      engineLeft.clone();


    engineRight.position.x =
      0.6;


    enemy.add(
      engineRight
    );


    enemy.position.set(
      randomBetween(
        -3.2,
        3.2
      ),

      randomBetween(
        -2,
        2.2
      ),

      randomBetween(
        -13,
        -8
      )
    );


    enemy.userData = {
      health:
        100,

      vx:
        randomBetween(
          -1.5,
          1.5
        ),

      vy:
        randomBetween(
          -0.9,
          0.9
        ),

      speed:
        randomBetween(
          0.7,
          1.2
        )
    };


    world.scene.add(
      enemy
    );


    world.objects.push(
      enemy
    );
  }


  createEnemy();


  /* ==========================================
  MOVEMENT
  ========================================== */

  world.addUpdate(
    (delta, elapsed) => {

      if (
        !active ||
        !enemy
      ) {
        return;
      }


      enemy.position.x +=
        enemy.userData.vx *
        delta;


      enemy.position.y +=
        enemy.userData.vy *
        delta;


      enemy.position.z +=
        enemy.userData.speed *
        delta;


      enemy.rotation.y +=
        delta *
        0.8;


      enemy.rotation.z =
        Math.sin(
          elapsed * 2.2
        ) *
        0.14;


      if (
        enemy.position.x >
        4
      ) {
        enemy.userData.vx =
          -Math.abs(
            enemy.userData.vx
          );
      }


      if (
        enemy.position.x <
        -4
      ) {
        enemy.userData.vx =
          Math.abs(
            enemy.userData.vx
          );
      }


      if (
        enemy.position.y >
        2.6
      ) {
        enemy.userData.vy =
          -Math.abs(
            enemy.userData.vy
          );
      }


      if (
        enemy.position.y <
        -2.4
      ) {
        enemy.userData.vy =
          Math.abs(
            enemy.userData.vy
          );
      }


      if (
        enemy.position.z >
        4.5
      ) {
        finish(false);
      }


      stars.position.z +=
        delta *
        2;


      if (
        stars.position.z >
        8
      ) {
        stars.position.z =
          0;
      }

    }
  );


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


  function updatePointer(
    clientX,
    clientY
  ) {
    const rect =
      world.renderer
        .domElement
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
  FIRE
  ========================================== */

  function shoot(
    clientX = null,
    clientY = null
  ) {
    if (
      !active ||
      !enemy
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


    raycaster.setFromCamera(
      pointer,
      world.camera
    );


    const intersections =
      raycaster.intersectObjects(
        enemy.children,
        true
      );


    createLaserEffect();


    if (
      intersections.length > 0
    ) {
      hits++;


      const hitObject =
        intersections[0].object;


      let damage =
        randomBetween(
          34,
          50
        );


      if (
        hitObject.userData
          ?.isCore
      ) {
        damage *=
          1.8;
      }


      enemy.userData.health -=
        damage;


      enemy.scale.set(
        0.86,
        0.86,
        0.86
      );


      setTimeout(
        () => {
          if (
            active &&
            enemy
          ) {
            enemy.scale.set(
              1,
              1,
              1
            );
          }
        },
        100
      );


      if (
        enemy.userData.health <=
        0
      ) {
        destroyEnemy();
      }

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
  LASER EFFECT
  ========================================== */

  function createLaserEffect() {
    const geometry =
      new T.BufferGeometry();


    const material =
      new T.LineBasicMaterial({
        color:
          0x61eaff,

        transparent:
          true,

        opacity:
          1
      });


    const direction =
      new T.Vector3(
        pointer.x,
        pointer.y,
        -1
      );


    direction.unproject(
      world.camera
    );


    direction.sub(
      world.camera.position
    );


    direction.normalize();


    const start =
      world.camera.position
        .clone();


    const end =
      start
        .clone()
        .add(
          direction.multiplyScalar(
            18
          )
        );


    geometry.setFromPoints([
      start,
      end
    ]);


    const laser =
      new T.Line(
        geometry,
        material
      );


    world.scene.add(
      laser
    );


    setTimeout(
      () => {
        world.scene.remove(
          laser
        );

        geometry.dispose();
        material.dispose();
      },
      90
    );
  }


  /* ==========================================
  DESTROY ENEMY
  ========================================== */

  function destroyEnemy() {
    destroyed++;


    const destroyedEnemy =
      enemy;


    enemy =
      null;


    const startScale =
      destroyedEnemy.scale.x;


    let explosionTime =
      0;


    const explosionUpdate =
      delta => {

        explosionTime +=
          delta;


        destroyedEnemy.scale
          .multiplyScalar(
            1 +
            delta * 4
          );


        destroyedEnemy.rotation.x +=
          delta * 6;


        destroyedEnemy.rotation.z +=
          delta * 5;


        if (
          explosionTime >
          0.3
        ) {
          world.removeUpdate(
            explosionUpdate
          );


          world.disposeObject(
            destroyedEnemy
          );


          if (
            destroyed >=
            targetDestroyedGoal
          ) {
            finish(true);
          } else {
            createEnemy();
          }
        }

      };


    startScale;


    world.addUpdate(
      explosionUpdate
    );


    updateHud();
  }


  /* ==========================================
  HUD
  ========================================== */

  function updateHud() {
    destroyedElement.textContent =
      `${destroyed} / ${targetDestroyedGoal}`;


    const accuracy =
      shots > 0
        ? hits / shots
        : 0;


    accuracyElement.textContent =
      `${Math.round(
        accuracy *
        100
      )}%`;
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


    active = false;


    const elapsed =
      performance.now() -
      startedAt;


    const accuracy =
      shots > 0
        ? hits / shots
        : 0;


    const accuracyScore =
      accuracy *
      100;


    const speedScore =
      success
        ? clamp(
            100 -
            elapsed / 170,
            0,
            100
          )
        : 0;


    const completionScore =
      (
        destroyed /
        targetDestroyedGoal
      ) *
      100;


    const score =
      success
        ? (
            accuracyScore *
              0.55 +
            speedScore *
              0.30 +
            completionScore *
              0.15
          )

        :
          (
            accuracyScore *
              0.35 +
            completionScore *
              0.65
          );


    setTimeout(
      () => {

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
                45 +
                accuracyScore *
                0.35 +
                completionScore *
                0.20,
                0,
                100
              )
            ),

          meta: {
            success,

            shots,

            hits,

            destroyed,

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
        ? 450
        : 100
    );
  }


  /* ==========================================
  EVENTS
  ========================================== */

  world.renderer
    .domElement
    .addEventListener(
      "pointermove",
      pointerMove
    );


  world.renderer
    .domElement
    .addEventListener(
      "pointerdown",
      canvasShoot
    );


  fireButton.addEventListener(
    "pointerdown",
    () => {
      shoot(
        crosshairX || null,
        crosshairY || null
      );
    }
  );


  /* ==========================================
  START
  ========================================== */

  const rect =
    world.renderer
      .domElement
      .getBoundingClientRect();


  updatePointer(
    rect.left +
    rect.width / 2,

    rect.top +
    rect.height / 2
  );


  updateHud();


  world.start();


  /* ==========================================
  CLEANUP
  ========================================== */

  return () => {
    active = false;


    world.renderer
      ?.domElement
      ?.removeEventListener(
        "pointermove",
        pointerMove
      );


    world.renderer
      ?.domElement
      ?.removeEventListener(
        "pointerdown",
        canvasShoot
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
