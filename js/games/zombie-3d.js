// GAMIQ（ゲーミック） v2 - 3D Zombie Assault

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

  let active = true;

  let hp = 100;
  let shots = 0;
  let hits = 0;

  const startedAt =
    performance.now();


  container.innerHTML = `
    <div class="zombie-3d-wrap">

      <div class="zombie-3d-hud">

        <div>
          <span>ZOMBIE HP</span>

          <strong
            data-zombie3d-hp
          >
            100
          </strong>
        </div>

        <div>
          <span>SHOTS</span>

          <strong
            data-zombie3d-shots
          >
            0
          </strong>
        </div>

      </div>

      <div
        class="zombie-3d-world"
        data-zombie3d-world
      ></div>

      <button
        type="button"
        class="zombie-3d-fire"
        data-zombie3d-fire
      >
        FIRE
      </button>

    </div>
  `;


  const worldElement =
    container.querySelector(
      "[data-zombie3d-world]"
    );

  const hpElement =
    container.querySelector(
      "[data-zombie3d-hp]"
    );

  const shotsElement =
    container.querySelector(
      "[data-zombie3d-shots]"
    );

  const fireButton =
    container.querySelector(
      "[data-zombie3d-fire]"
    );


  const world =
    new GamiqThreeScene({
      container:
        worldElement,

      cameraZ:
        8,

      background:
        0x050806
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
  ENVIRONMENT
  ========================================== */

  world.addFloor({
    width: 18,
    depth: 30,
    color: 0x101510,
    y: -2
  });


  const fog =
    new T.Fog(
      0x050806,
      7,
      24
    );

  world.scene.fog =
    fog;


  const redLight =
    new T.PointLight(
      0xff3344,
      3.5,
      10
    );

  redLight.position.set(
    0,
    3,
    3
  );

  world.scene.add(
    redLight
  );


  const greenLight =
    new T.PointLight(
      0x65ff88,
      2,
      10
    );

  greenLight.position.set(
    -3,
    1,
    -5
  );

  world.scene.add(
    greenLight
  );


  /* ==========================================
  ZOMBIE MODEL
  ========================================== */

  const zombie =
    world.addGroup();


  zombie.position.set(
    0,
    -0.5,
    -15
  );


  const skinMaterial =
    new T.MeshStandardMaterial({
      color:
        0x78a76e,

      roughness:
        0.9
    });


  const shirtMaterial =
    new T.MeshStandardMaterial({
      color:
        0x374249,

      roughness:
        0.85
    });


  const pantsMaterial =
    new T.MeshStandardMaterial({
      color:
        0x22262c,

      roughness:
        0.9
    });


  const eyeMaterial =
    new T.MeshStandardMaterial({
      color:
        0xff3344,

      emissive:
        0xff0011,

      emissiveIntensity:
        2.5
    });


  // torso

  const torso =
    new T.Mesh(
      new T.BoxGeometry(
        1.5,
        2,
        0.8
      ),
      shirtMaterial
    );

  torso.position.y =
    0.4;

  torso.castShadow =
    true;

  zombie.add(
    torso
  );


  // head

  const head =
    new T.Mesh(
      new T.BoxGeometry(
        1.1,
        1.1,
        1
      ),
      skinMaterial
    );

  head.position.y =
    2;

  head.castShadow =
    true;

  zombie.add(
    head
  );


  // eyes

  const leftEye =
    new T.Mesh(
      new T.SphereGeometry(
        0.09,
        12,
        8
      ),
      eyeMaterial
    );

  leftEye.position.set(
    -0.22,
    2.1,
    0.52
  );

  zombie.add(
    leftEye
  );


  const rightEye =
    leftEye.clone();

  rightEye.position.x =
    0.22;

  zombie.add(
    rightEye
  );


  // arms

  const leftArm =
    new T.Mesh(
      new T.BoxGeometry(
        0.45,
        2,
        0.45
      ),
      skinMaterial
    );

  leftArm.position.set(
    -1,
    0.6,
    0
  );

  leftArm.rotation.z =
    -0.25;

  zombie.add(
    leftArm
  );


  const rightArm =
    leftArm.clone();

  rightArm.position.x =
    1;

  rightArm.rotation.z =
    0.25;

  zombie.add(
    rightArm
  );


  // legs

  const leftLeg =
    new T.Mesh(
      new T.BoxGeometry(
        0.55,
        2,
        0.55
      ),
      pantsMaterial
    );

  leftLeg.position.set(
    -0.4,
    -1.6,
    0
  );

  zombie.add(
    leftLeg
  );


  const rightLeg =
    leftLeg.clone();

  rightLeg.position.x =
    0.4;

  zombie.add(
    rightLeg
  );


  /* ==========================================
  MOVEMENT
  ========================================== */

  let zombieSpeed =
    1.8 +
    Math.random() * 0.8;


  world.addUpdate(
    (delta, elapsed) => {

      if (!active) {
        return;
      }

      zombie.position.z +=
        zombieSpeed *
        delta;


      zombie.position.x =
        Math.sin(
          elapsed * 1.7
        ) * 0.9;


      torso.rotation.z =
        Math.sin(
          elapsed * 4
        ) * 0.05;


      leftArm.rotation.x =
        Math.sin(
          elapsed * 5
        ) * 0.35;


      rightArm.rotation.x =
        Math.sin(
          elapsed * 5 +
          Math.PI
        ) * 0.35;


      leftLeg.rotation.x =
        Math.sin(
          elapsed * 5
        ) * 0.24;


      rightLeg.rotation.x =
        Math.sin(
          elapsed * 5 +
          Math.PI
        ) * 0.24;


      if (
        zombie.position.z >
        4.5
      ) {
        finish(false);
      }

    }
  );


  /* ==========================================
  SHOOTING
  ========================================== */

  const raycaster =
    new T.Raycaster();


  const pointer =
    new T.Vector2(
      0,
      0
    );


  function shoot(
    clientX = null,
    clientY = null
  ) {
    if (!active) {
      return;
    }


    shots++;

    shotsElement.textContent =
      shots;


    const rect =
      world.renderer
        .domElement
        .getBoundingClientRect();


    if (
      clientX !== null &&
      clientY !== null
    ) {
      pointer.x =
        (
          (
            clientX -
            rect.left
          ) /
          rect.width
        ) *
        2 -
        1;


      pointer.y =
        -(
          (
            clientY -
            rect.top
          ) /
          rect.height
        ) *
        2 +
        1;
    } else {
      pointer.x = 0;
      pointer.y = 0;
    }


    raycaster.setFromCamera(
      pointer,
      world.camera
    );


    const intersections =
      raycaster.intersectObjects(
        zombie.children,
        true
      );


    if (
      intersections.length > 0
    ) {
      hits++;


      const hitObject =
        intersections[0].object;


      let damage =
        14 +
        Math.random() * 9;


      if (
        hitObject === head ||
        hitObject === leftEye ||
        hitObject === rightEye
      ) {
        damage *= 1.8;
      }


      hp -=
        damage;


      hpElement.textContent =
        Math.max(
          0,
          Math.round(hp)
        );


      zombie.position.z -=
        0.45;


      zombie.rotation.z =
        (
          Math.random() -
          0.5
        ) *
        0.2;


      setTimeout(
        () => {
          if (active) {
            zombie.rotation.z =
              0;
          }
        },
        100
      );


      if (hp <= 0) {
        finish(true);
      }

    }

  }


  function canvasShoot(
    event
  ) {
    shoot(
      event.clientX,
      event.clientY
    );
  }


  world.renderer
    .domElement
    .addEventListener(
      "pointerdown",
      canvasShoot
    );


  fireButton.addEventListener(
    "pointerdown",
    () => shoot()
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


    if (success) {
      zombie.rotation.z =
        Math.PI / 2;

      zombie.position.y =
        -1.2;
    }


    const accuracy =
      shots > 0
        ? hits / shots
        : 0;


    const accuracyScore =
      accuracy * 100;


    const speedScore =
      success
        ? Math.max(
            0,
            100 -
            elapsed / 120
          )
        : 0;


    const score =
      success
        ? (
            accuracyScore *
              0.45 +
            speedScore *
              0.55
          )
        : Math.max(
            0,
            hp < 40
              ? 35
              : 15
          );


    setTimeout(
      () => {

        onComplete?.({
          score:
            Math.round(score),

          adapt:
            Math.round(
              success
                ? 70 +
                  accuracy * 25
                : 30
            ),

          meta: {
            success,

            shots,

            hits,

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
        ? 500
        : 100
    );
  }


  world.start();


  return () => {
    active = false;

    world.renderer
      ?.domElement
      ?.removeEventListener(
        "pointerdown",
        canvasShoot
      );

    world.destroy();
  };
}
