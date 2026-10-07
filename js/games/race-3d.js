// GAMIQ（ゲーミック） v2 - 3D Highway Dodge

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


  let active = true;

  let lane = 1;
  let avoided = 0;
  let crashes = 0;

  const goal = 10;

  const startedAt =
    performance.now();


  container.innerHTML = `
    <div class="race-3d-wrap">

      <div class="race-3d-hud">

        <div>
          <span>DODGED</span>

          <strong
            data-race3d-dodged
          >
            0 / ${goal}
          </strong>
        </div>

        <div>
          <span>SPEED</span>

          <strong
            data-race3d-speed
          >
            1.0x
          </strong>
        </div>

      </div>


      <div
        class="race-3d-world"
        data-race3d-world
      ></div>


      <div class="race-3d-controls">

        <button
          type="button"
          data-race3d-left
        >
          ←
        </button>

        <button
          type="button"
          data-race3d-right
        >
          →
        </button>

      </div>

    </div>
  `;


  const worldElement =
    container.querySelector(
      "[data-race3d-world]"
    );


  const dodgedElement =
    container.querySelector(
      "[data-race3d-dodged]"
    );


  const speedElement =
    container.querySelector(
      "[data-race3d-speed]"
    );


  const leftButton =
    container.querySelector(
      "[data-race3d-left]"
    );


  const rightButton =
    container.querySelector(
      "[data-race3d-right]"
    );


  const world =
    new GamiqThreeScene({
      container:
        worldElement,

      cameraZ:
        8,

      background:
        0x05070a
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
    3.4,
    8
  );


  world.camera.lookAt(
    0,
    -0.5,
    -12
  );


  /* ==========================================
  LIGHTS
  ========================================== */

  const streetLight =
    new T.DirectionalLight(
      0xffffff,
      2.4
    );


  streetLight.position.set(
    0,
    8,
    5
  );


  world.scene.add(
    streetLight
  );


  const blueLight =
    new T.PointLight(
      0x61eaff,
      2.5,
      20
    );


  blueLight.position.set(
    -5,
    2,
    2
  );


  world.scene.add(
    blueLight
  );


  /* ==========================================
  ROAD
  ========================================== */

  const road =
    world.addFloor({
      width:
        9,

      depth:
        60,

      color:
        0x151922,

      y:
        -2
    });


  road.position.z =
    -18;


  const laneMaterial =
    new T.MeshStandardMaterial({
      color:
        0xf4f4f4,

      emissive:
        0x222222,

      emissiveIntensity:
        0.2
    });


  const laneMarks = [];


  for (
    let z = -42;
    z < 8;
    z += 5
  ) {
    for (
      const x of
      [-1.5, 1.5]
    ) {
      const line =
        new T.Mesh(
          new T.BoxGeometry(
            0.08,
            0.03,
            2.4
          ),

          laneMaterial
        );


      line.position.set(
        x,
        -1.96,
        z
      );


      world.scene.add(
        line
      );


      laneMarks.push(
        line
      );


      world.objects.push(
        line
      );
    }
  }


  /* ==========================================
  PLAYER CAR
  ========================================== */

  const player =
    createCar({
      T,
      color:
        0x39d9ff
    });


  player.position.set(
    0,
    -1.45,
    3
  );


  player.rotation.y =
    Math.PI;


  world.scene.add(
    player
  );


  world.objects.push(
    player
  );


  /* ==========================================
  OBSTACLES
  ========================================== */

  const obstacles = [];


  const lanePositions =
    [
      -3,
      0,
      3
    ];


  let spawnTimer =
    0;


  let spawnInterval =
    1.25;


  let worldSpeed =
    11;


  function spawnObstacle() {
    const obstacleLane =
      Math.floor(
        Math.random() * 3
      );


    const colors =
      [
        0xff496c,
        0xffb347,
        0x9b7cff,
        0x72f5a1
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

      -1.45,

      -35
    );


    world.scene.add(
      obstacle
    );


    obstacles.push({
      mesh:
        obstacle,

      passed:
        false
    });


    world.objects.push(
      obstacle
    );
  }


  /* ==========================================
  CONTROLS
  ========================================== */

  function changeLane(
    direction
  ) {
    if (!active) {
      return;
    }


    lane =
      clamp(
        lane +
        direction,

        0,

        2
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


  /* ==========================================
  GAME LOOP
  ========================================== */

  world.addUpdate(
    (delta, elapsed) => {

      if (!active) {
        return;
      }


      /* player movement */

      const targetX =
        lanePositions[
          lane
        ];


      player.position.x +=
        (
          targetX -
          player.position.x
        ) *
        Math.min(
          1,
          delta * 12
        );


      player.rotation.z =
        (
          targetX -
          player.position.x
        ) *
        -0.05;


      /* increasing difficulty */

      worldSpeed =
        11 +
        Math.min(
          avoided * 0.55,
          6
        );


      spawnInterval =
        Math.max(
          0.65,
          1.25 -
          avoided * 0.035
        );


      speedElement.textContent =
        (
          worldSpeed /
          11
        ).toFixed(1) +
        "x";


      /* road movement */

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
            50;
        }
      }


      /* spawning */

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


      /* obstacles */

      for (
        let i =
          obstacles.length - 1;
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


        obstacle.rotation.y =
          Math.PI;


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
          dx < 1.15 &&
          dz < 1.8
        ) {
          crashes++;

          finish(false);

          return;
        }


        if (
          !item.passed &&
          obstacle.position.z >
          player.position.z +
          1.8
        ) {
          item.passed =
            true;


          avoided++;


          updateHud();


          if (
            avoided >=
            goal
          ) {
            finish(true);

            return;
          }
        }


        if (
          obstacle.position.z >
          12
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


      /* subtle camera movement */

      world.camera.position.x =
        Math.sin(
          elapsed * 0.7
        ) *
        0.08;

    }
  );


  /* ==========================================
  HUD
  ========================================== */

  function updateHud() {
    dodgedElement.textContent =
      `${avoided} / ${goal}`;
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


    const completion =
      avoided /
      goal;


    const reactionScore =
      success
        ? clamp(
            75 +
            avoided * 2.5,

            0,

            100
          )

        :
          clamp(
            avoided *
            7,

            0,

            70
          );


    const speedScore =
      success
        ? clamp(
            100 -
            elapsed / 220,

            20,

            100
          )

        :
          20;


    const score =
      (
        reactionScore *
        0.65
      ) +
      (
        speedScore *
        0.35
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
                35 +
                completion *
                60,

                0,

                100
              )
            ),

          meta: {
            success,

            avoided,

            crashes,

            elapsed:
              Math.round(
                elapsed
              )
          }
        });

      },

      success
        ? 350
        : 100
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
    active = false;


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
  color
}) {
  const car =
    new T.Group();


  const bodyMaterial =
    new T.MeshStandardMaterial({
      color,

      metalness:
        0.55,

      roughness:
        0.35
    });


  const darkMaterial =
    new T.MeshStandardMaterial({
      color:
        0x0b1018,

      metalness:
        0.3,

      roughness:
        0.45
    });


  const glowMaterial =
    new T.MeshStandardMaterial({
      color:
        0xff405f,

      emissive:
        0xff183c,

      emissiveIntensity:
        2
    });


  const body =
    new T.Mesh(
      new T.BoxGeometry(
        1.7,
        0.55,
        3
      ),

      bodyMaterial
    );


  body.castShadow =
    true;


  car.add(
    body
  );


  const cabin =
    new T.Mesh(
      new T.BoxGeometry(
        1.25,
        0.55,
        1.3
      ),

      darkMaterial
    );


  cabin.position.set(
    0,
    0.5,
    -0.15
  );


  car.add(
    cabin
  );


  const rearLightLeft =
    new T.Mesh(
      new T.BoxGeometry(
        0.32,
        0.15,
        0.08
      ),

      glowMaterial
    );


  rearLightLeft.position.set(
    -0.48,
    0,
    1.54
  );


  car.add(
    rearLightLeft
  );


  const rearLightRight =
    rearLightLeft.clone();


  rearLightRight.position.x =
    0.48;


  car.add(
    rearLightRight
  );


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
