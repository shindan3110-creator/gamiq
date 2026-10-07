// GAMIQ（ゲーミック） v2 - 3D Factory Rush

import {
  GamiqThreeScene
} from "./three-renderer.js";


export async function runFactory3D({
  container,
  onComplete
}) {
  if (!container) {
    return () => {};
  }


  let active = true;

  let processed = 0;
  let mistakes = 0;

  const goal = 8;

  const startedAt =
    performance.now();


  container.innerHTML = `
    <div class="factory-3d-wrap">

      <div class="factory-3d-hud">

        <div>
          <span>PROCESSED</span>

          <strong
            data-factory3d-processed
          >
            0 / ${goal}
          </strong>
        </div>

        <div>
          <span>MISTAKES</span>

          <strong
            data-factory3d-mistakes
          >
            0
          </strong>
        </div>

      </div>


      <div
        class="factory-3d-world"
        data-factory3d-world
      ></div>


      <button
        type="button"
        class="factory-3d-action"
        data-factory3d-action
      >
        PROCESS
      </button>

    </div>
  `;


  const worldElement =
    container.querySelector(
      "[data-factory3d-world]"
    );


  const processedElement =
    container.querySelector(
      "[data-factory3d-processed]"
    );


  const mistakesElement =
    container.querySelector(
      "[data-factory3d-mistakes]"
    );


  const actionButton =
    container.querySelector(
      "[data-factory3d-action]"
    );


  const world =
    new GamiqThreeScene({
      container:
        worldElement,

      cameraZ:
        9,

      background:
        0x070707
    });


  const initialized =
    await world.init();


  if (!initialized) {
    container.innerHTML = `
      <div class="factory-3d-fallback">
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
    4,
    9
  );


  world.camera.lookAt(
    0,
    0,
    -6
  );


  /* ==========================================
  LIGHTS
  ========================================== */

  const warmLight =
    new T.PointLight(
      0xffa947,
      4,
      20
    );


  warmLight.position.set(
    -4,
    5,
    2
  );


  world.scene.add(
    warmLight
  );


  const coolLight =
    new T.PointLight(
      0x61eaff,
      2.5,
      18
    );


  coolLight.position.set(
    5,
    2,
    -5
  );


  world.scene.add(
    coolLight
  );


  /* ==========================================
  FACTORY FLOOR
  ========================================== */

  world.addFloor({
    width:
      16,

    depth:
      30,

    color:
      0x151515,

    y:
      -2
  });


  /* ==========================================
  CONVEYOR BELT
  ========================================== */

  const beltGroup =
    world.addGroup();


  beltGroup.position.set(
    0,
    -1.2,
    -6
  );


  const beltMaterial =
    new T.MeshStandardMaterial({
      color:
        0x20262d,

      metalness:
        0.7,

      roughness:
        0.35
    });


  const rollerMaterial =
    new T.MeshStandardMaterial({
      color:
        0x59616b,

      metalness:
        0.85,

      roughness:
        0.25
    });


  const beltBase =
    new T.Mesh(
      new T.BoxGeometry(
        7,
        0.5,
        16
      ),

      beltMaterial
    );


  beltBase.receiveShadow =
    true;


  beltGroup.add(
    beltBase
  );


  for (
    let z = -7;
    z <= 7;
    z += 1.2
  ) {
    const roller =
      new T.Mesh(
        new T.CylinderGeometry(
          0.22,
          0.22,
          6.6,
          16
        ),

        rollerMaterial
      );


    roller.rotation.z =
      Math.PI / 2;


    roller.position.set(
      0,
      0.3,
      z
    );


    beltGroup.add(
      roller
    );
  }


  /* ==========================================
  PROCESS ZONE
  ========================================== */

  const processZone =
    new T.Mesh(
      new T.BoxGeometry(
        4.8,
        0.05,
        1.6
      ),

      new T.MeshStandardMaterial({
        color:
          0x5fff91,

        emissive:
          0x1cff58,

        emissiveIntensity:
          1.2,

        transparent:
          true,

        opacity:
          0.35
      })
    );


  processZone.position.set(
    0,
    -0.9,
    2
  );


  beltGroup.add(
    processZone
  );


  /* ==========================================
  BOX
  ========================================== */

  let currentBox =
    null;


  let boxSpeed =
    5;


  function spawnBox() {
    if (!active) {
      return;
    }


    const colors =
      [
        0xffbd66,
        0x61eaff,
        0x9d7cff,
        0x76f5a5
      ];


    const material =
      new T.MeshStandardMaterial({
        color:
          colors[
            Math.floor(
              Math.random() *
              colors.length
            )
          ],

        roughness:
          0.55,

        metalness:
          0.15
      });


    const box =
      new T.Mesh(
        new T.BoxGeometry(
          1.5,
          1.5,
          1.5
        ),

        material
      );


    box.castShadow =
      true;


    box.position.set(
      0,
      -0.15,
      -13
    );


    beltGroup.add(
      box
    );


    currentBox =
      box;
  }


  spawnBox();


  /* ==========================================
  GAME LOOP
  ========================================== */

  world.addUpdate(
    (delta, elapsed) => {

      if (
        !active ||
        !currentBox
      ) {
        return;
      }


      boxSpeed =
        5 +
        Math.min(
          processed * 0.45,
          3.2
        );


      currentBox.position.z +=
        boxSpeed *
        delta;


      currentBox.rotation.y +=
        delta *
        0.9;


      currentBox.position.y =
        -0.15 +
        Math.sin(
          elapsed * 4
        ) *
        0.05;


      if (
        currentBox.position.z >
        8
      ) {
        mistakes++;


        updateHud();


        beltGroup.remove(
          currentBox
        );


        currentBox.geometry
          ?.dispose?.();


        currentBox.material
          ?.dispose?.();


        currentBox =
          null;


        if (
          mistakes >= 3
        ) {
          finish(false);

          return;
        }


        setTimeout(
          spawnBox,
          250
        );
      }

    }
  );


  /* ==========================================
  PROCESS
  ========================================== */

  function processBox() {
    if (
      !active ||
      !currentBox
    ) {
      return;
    }


    const z =
      currentBox.position.z;


    const inPerfectZone =
      z >= 1.2 &&
      z <= 2.8;


    const inNearZone =
      z >= 0.4 &&
      z <= 3.6;


    if (
      inPerfectZone
    ) {
      processed++;


      currentBox.scale.set(
        1.15,
        1.15,
        1.15
      );


      setTimeout(
        () => {
          if (
            active &&
            currentBox
          ) {
            beltGroup.remove(
              currentBox
            );


            currentBox.geometry
              ?.dispose?.();


            currentBox.material
              ?.dispose?.();


            currentBox =
              null;


            if (
              processed >= goal
            ) {
              finish(true);
            } else {
              spawnBox();
            }
          }
        },
        120
      );

    } else if (
      inNearZone
    ) {
      processed++;


      mistakes++;


      beltGroup.remove(
        currentBox
      );


      currentBox.geometry
        ?.dispose?.();


      currentBox.material
        ?.dispose?.();


      currentBox =
        null;


      if (
        processed >= goal
      ) {
        finish(true);
      } else {
        spawnBox();
      }

    } else {
      mistakes++;


      if (
        mistakes >= 3
      ) {
        finish(false);
      }
    }


    updateHud();
  }


  /* ==========================================
  HUD
  ========================================== */

  function updateHud() {
    processedElement.textContent =
      `${processed} / ${goal}`;


    mistakesElement.textContent =
      mistakes;
  }


  /* ==========================================
  CONTROLS
  ========================================== */

  function keyDown(
    event
  ) {
    if (
      event.code ===
      "Space" ||
      event.key ===
      "Enter"
    ) {
      event.preventDefault();

      processBox();
    }
  }


  actionButton.addEventListener(
    "pointerdown",
    processBox
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


    active = false;


    const elapsed =
      performance.now() -
      startedAt;


    const completion =
      processed /
      goal;


    const precisionScore =
      clamp(
        100 -
        mistakes * 20,
        0,
        100
      );


    const speedScore =
      success
        ? clamp(
            100 -
            elapsed / 220,
            20,
            100
          )
        : 20;


    const score =
      success
        ? (
            precisionScore *
              0.6 +
            speedScore *
              0.4
          )

        :
          (
            precisionScore *
              0.35 +
            completion *
              65
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
                40 +
                completion *
                40 -
                mistakes *
                6,
                0,
                100
              )
            ),

          meta: {
            success,

            processed,

            mistakes,

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

  world.start();


  /* ==========================================
  CLEANUP
  ========================================== */

  return () => {
    active = false;


    actionButton.removeEventListener(
      "pointerdown",
      processBox
    );


    window.removeEventListener(
      "keydown",
      keyDown
    );


    world.destroy();
  };
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
