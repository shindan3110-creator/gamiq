
import { GamiqThreeScene } from "./three-renderer.js";

export async function runRace3D({ container, onComplete }) {
  if (!container) return () => {};

  let active = true;
  let finished = false;

  const TOTAL_SECONDS = 60;
  const PLAYER_Z = 3;
  const LANES = [-2.65, 0, 2.65];

  let lane = 1;
  let jumpHeight = 0;
  let jumpVelocity = 0;
  let distance = 0;
  let avoided = 0;
  let crashes = 0;
  let boosts = 0;
  let streak = 0;
  let bestStreak = 0;
  let boostSeconds = 0;
  let boostLeft = 0;
  let slowLeft = 0;
  let invincibleLeft = 0;
  let spawnLeft = 1.25;
  let currentSpeed = 14;
  let startTime = 0;
  let endTimer = null;
  let messageTimer = null;
  let pointerStart = null;

  const obstacles = [];
  const laneMarks = [];
  const roadside = [];

  container.innerHTML = `
    <div class="rush-run">
      <div class="rush-hud">
        <div>
          <span>TIME</span>
          <strong data-rush-time>60</strong>
        </div>
        <div>
          <span>DISTANCE</span>
          <strong><b data-rush-distance>0</b> m</strong>
        </div>
        <div>
          <span>SPEED</span>
          <strong data-rush-speed>1.0×</strong>
        </div>
      </div>

      <div class="rush-stage" data-rush-stage>
        <div class="rush-world" data-rush-world></div>
        <div class="rush-flash" data-rush-flash></div>
        <div class="rush-message" data-rush-message></div>
        <div class="rush-instruction">
          ← → DODGE · ↑ JUMP · ⚡ BOOST
        </div>
      </div>

      <div class="rush-bottom">
        <div class="rush-progress">
          <span>AVOIDED <b data-rush-avoided>0</b></span>
          <span>STREAK <b data-rush-streak>0</b></span>
          <span>CRASH <b data-rush-crashes>0</b></span>
        </div>

        <div class="rush-controls">
          <button type="button" data-rush-left aria-label="Move left">←</button>
          <button type="button" class="rush-jump-button" data-rush-jump aria-label="Jump">
            ↑ <small>JUMP</small>
          </button>
          <button type="button" data-rush-right aria-label="Move right">→</button>
        </div>
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-rush-stage]");
  const worldElement = container.querySelector("[data-rush-world]");
  const timeEl = container.querySelector("[data-rush-time]");
  const distanceEl = container.querySelector("[data-rush-distance]");
  const speedEl = container.querySelector("[data-rush-speed]");
  const avoidedEl = container.querySelector("[data-rush-avoided]");
  const streakEl = container.querySelector("[data-rush-streak]");
  const crashesEl = container.querySelector("[data-rush-crashes]");
  const messageEl = container.querySelector("[data-rush-message]");
  const flashEl = container.querySelector("[data-rush-flash]");
  const leftBtn = container.querySelector("[data-rush-left]");
  const rightBtn = container.querySelector("[data-rush-right]");
  const jumpBtn = container.querySelector("[data-rush-jump]");

  const world = new GamiqThreeScene({
    container: worldElement,
    cameraZ: 8,
    background: 0x101a26
  });

  const initialized = await world.init();

  if (!initialized) {
    container.innerHTML = `
      <div class="race-3d-fallback">
        3Dの読み込みに失敗しました
      </div>
    `;
    return () => {};
  }

  const T = world.THREE;

  world.camera.position.set(0, 3.2, 8.4);
  world.camera.lookAt(0, -1.0, -14);

  world.scene.add(
    new T.HemisphereLight(0xa4ddff, 0x26301e, 2.0)
  );

  const sun = new T.DirectionalLight(0xffe6ac, 2.5);
  sun.position.set(-6, 12, 4);
  world.scene.add(sun);

  const mats = {
    road: new T.MeshStandardMaterial({
      color: 0x222d38,
      roughness: 0.95
    }),
    border: new T.MeshStandardMaterial({
      color: 0x87deef,
      emissive: 0x205364,
      emissiveIntensity: 0.3
    }),
    stripe: new T.MeshBasicMaterial({
      color: 0xe2edf1
    }),
    rock: new T.MeshStandardMaterial({
      color: 0x7b817f,
      roughness: 1
    }),
    wood: new T.MeshStandardMaterial({
      color: 0x94572e,
      roughness: 0.9
    }),
    barrier: new T.MeshStandardMaterial({
      color: 0xee754b
    }),
    dark: new T.MeshStandardMaterial({
      color: 0x1d2731,
      roughness: 0.7
    }),
    glass: new T.MeshStandardMaterial({
      color: 0x8ae9ff,
      metalness: 0.35,
      roughness: 0.12
    }),
    cyan: new T.MeshStandardMaterial({
      color: 0x42deff,
      emissive: 0x158bbb,
      emissiveIntensity: 0.8
    }),
    red: new T.MeshBasicMaterial({
      color: 0xff446b
    }),
    boost: new T.MeshStandardMaterial({
      color: 0xffe46b,
      emissive: 0xffb700,
      emissiveIntensity: 1.6
    })
  };

  const road = new T.Mesh(
    new T.BoxGeometry(9.7, 0.2, 115),
    mats.road
  );
  road.position.set(0, -2.13, -24);
  world.scene.add(road);

  const ground = new T.Mesh(
    new T.BoxGeometry(120, 0.15, 115),
    new T.MeshStandardMaterial({
      color: 0x183326,
      roughness: 1
    })
  );
  ground.position.set(0, -2.27, -24);
  world.scene.add(ground);

  function box(w, h, d, material, x, y, z, parent = world.scene) {
    const mesh = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      material
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  for (let z = -53; z < 9; z += 6.2) {
    for (const x of [-1.33, 1.33]) {
      laneMarks.push(
        box(0.09, 0.025, 2.6, mats.stripe, x, -1.99, z)
      );
    }

    for (const x of [-5.45, 5.45]) {
      roadside.push(
        box(0.18, 0.18, 2.4, mats.border, x, -1.92, z)
      );
    }
  }

  /* PLAYER CAR */

  const player = new T.Group();

  const paint = new T.MeshStandardMaterial({
    color: 0x27bfff,
    metalness: 0.48,
    roughness: 0.23
  });

  box(1.62, 0.43, 2.5, paint, 0, 0, 0, player);
  box(1.26, 0.43, 1.28, mats.glass, 0, 0.41, -0.24, player);

  for (const x of [-0.85, 0.85]) {
    for (const z of [-0.77, 0.77]) {
      const wheel = new T.Mesh(
        new T.CylinderGeometry(0.35, 0.35, 0.26, 12),
        mats.dark
      );

      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, -0.29, z);
      player.add(wheel);
    }

    box(
      0.34, 0.17, 0.12,
      mats.red,
      x * 0.65, 0.09, 1.27,
      player
    );
  }

  box(1.5, 0.10, 0.14, mats.cyan, 0, 0.22, 1.35, player);

  player.position.set(LANES[lane], -1.40, PLAYER_Z);
  world.scene.add(player);

  /* OBSTACLE MODELS */

  function makeObstacle(kind, idx) {
    const group = new T.Group();
    group.position.set(LANES[idx], -1.55, -46);

    if (kind === "rock") {
      const rock = new T.Mesh(
        new T.DodecahedronGeometry(0.77, 0),
        mats.rock
      );
      rock.scale.set(1.05, 0.75, 1.05);
      group.add(rock);

    } else if (kind === "log") {
      const log = new T.Mesh(
        new T.CylinderGeometry(0.35, 0.35, 1.9, 12),
        mats.wood
      );
      log.rotation.z = Math.PI / 2;
      group.add(log);

    } else if (kind === "truck") {
      box(2.1, 1.42, 2.55, mats.barrier, 0, 0.65, 0, group);
      box(1.72, 0.49, 0.12, mats.dark, 0, 0.73, 1.32, group);

      for (const side of [-1, 1]) {
        box(
          0.37, 0.25, 0.18,
          mats.red,
          side * 0.73, 0.27, 1.4,
          group
        );
      }

    } else if (kind === "barrier") {
      box(2.25, 1.48, 0.45, mats.barrier, 0, 0.65, 0, group);
      box(2.3, 0.18, 0.50, mats.stripe, 0, 0.65, 0.01, group);

    } else if (kind === "boost") {
      group.position.y = -0.65;

      const icon = new T.Mesh(
        new T.OctahedronGeometry(0.62),
        mats.boost
      );
      icon.rotation.z = 0.25;
      group.add(icon);

      const ring = new T.Mesh(
        new T.TorusGeometry(0.86, 0.09, 8, 24),
        mats.boost
      );
      group.add(ring);
    }

    world.scene.add(group);

    obstacles.push({
      group,
      kind,
      lane: idx,
      resolved: false
    });
  }

  function spawn() {
    const idx = Math.floor(Math.random() * 3);
    const r = Math.random();

    const kind =
      r < 0.22 ? "boost" :
      r < 0.46 ? "rock" :
      r < 0.69 ? "log" :
      r < 0.86 ? "barrier" :
      "truck";

    makeObstacle(kind, idx);
  }

  /* CONTROLS */

  function laneChange(amount) {
    if (!active || finished) return;
    lane = Math.max(0, Math.min(2, lane + amount));
  }

  function jump() {
    if (
      !active ||
      finished ||
      jumpHeight > 0.02 ||
      jumpVelocity > 0
    ) {
      return;
    }

    jumpVelocity = 8.7;
    flash("JUMP!", "good");
  }

  function left() {
    laneChange(-1);
  }

  function right() {
    laneChange(1);
  }

  function onKey(e) {
    if (!active || finished) return;

    if (
      e.key === "ArrowLeft" ||
      e.key.toLowerCase() === "a"
    ) {
      e.preventDefault();
      left();
    }

    if (
      e.key === "ArrowRight" ||
      e.key.toLowerCase() === "d"
    ) {
      e.preventDefault();
      right();
    }

    if (
      e.key === "ArrowUp" ||
      e.code === "Space" ||
      e.key.toLowerCase() === "w"
    ) {
      e.preventDefault();
      jump();
    }
  }

  function swipeStart(e) {
    if (
      !active ||
      finished ||
      e.target.closest("button")
    ) {
      return;
    }

    pointerStart = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId
    };
  }

  function swipeEnd(e) {
    if (
      !pointerStart ||
      e.pointerId !== pointerStart.id
    ) {
      return;
    }

    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;

    pointerStart = null;

    if (Math.hypot(dx, dy) < 36) return;

    if (dy < -Math.abs(dx) * 0.75) {
      jump();

    } else if (Math.abs(dx) > Math.abs(dy) * 0.7) {
      laneChange(dx > 0 ? 1 : -1);
    }
  }

  leftBtn.addEventListener("pointerdown", left);
  rightBtn.addEventListener("pointerdown", right);
  jumpBtn.addEventListener("pointerdown", jump);

  stage.addEventListener("pointerdown", swipeStart);
  stage.addEventListener("pointerup", swipeEnd);

  window.addEventListener("keydown", onKey);

  /* EFFECTS */

  function flash(text, type) {
    if (!active) return;

    messageEl.textContent = text;
    messageEl.className = "rush-message";
    flashEl.className = "rush-flash";

    void messageEl.offsetWidth;

    messageEl.className =
      `rush-message ${type || "good"} show`;

    flashEl.className =
      `rush-flash ${type || "good"} show`;

    clearTimeout(messageTimer);

    messageTimer = setTimeout(() => {
      messageEl.classList.remove("show");
      flashEl.classList.remove("show");
    }, 470);
  }

  function hit() {
    crashes++;
    streak = 0;
    slowLeft = 2.2;
    invincibleLeft = 1.4;
    boostLeft = 0;

    flash("CRASH!", "bad");
  }

  function collectBoost() {
    boosts++;
    boostLeft = Math.max(boostLeft, 3.4);

    flash("BOOST!", "boost");
  }

  function clearObstacle(obj) {
    world.scene.remove(obj.group);

    obj.group.traverse(child => {
      if (child.isMesh) {
        child.geometry.dispose();
      }
    });

    const idx = obstacles.indexOf(obj);

    if (idx !== -1) {
      obstacles.splice(idx, 1);
    }
  }

  /* FINISH */

  function finish() {
    if (finished || !active) return;

    finished = true;
    active = false;

    const accuracy =
      avoided / Math.max(1, avoided + crashes);

    const distanceScore =
      Math.min(1, distance / 1200);

    const finalScore = Math.round(
      Math.min(
        100,
        distanceScore * 80 +
        accuracy * 12 +
        Math.min(1, boostSeconds / 20) * 5 +
        Math.min(1, bestStreak / 12) * 3
      )
    );

    const adapt = Math.round(
      Math.min(
        100,
        35 +
        accuracy * 30 +
        Math.min(1, boosts / 7) * 20 +
        Math.min(1, bestStreak / 12) * 15
      )
    );

    timeEl.textContent = "0";

    endTimer = setTimeout(() => {
      onComplete?.({
        score: finalScore,
        adapt,
        meta: {
          distance: Math.round(distance),
          avoided,
          crashes,
          boosts,
          bestStreak,
          durationSeconds: 60
        }
      });
    }, 460);
  }

  /* GAME LOOP */

  world.addUpdate(delta => {
    if (!active || finished) return;

    const t = (performance.now() - startTime) / 1000;
    const remaining = Math.max(0, TOTAL_SECONDS - t);

    if (remaining <= 0) {
      finish();
      return;
    }

    boostLeft = Math.max(0, boostLeft - delta);
    slowLeft = Math.max(0, slowLeft - delta);

    invincibleLeft = Math.max(
      0,
      invincibleLeft - delta
    );

    const baseSpeed = 14 + Math.min(4, t / 15);

    const factor =
      slowLeft > 0 ? 0.65 :
      boostLeft > 0 ? 1.65 :
      1;

    currentSpeed = baseSpeed * factor;
    distance += currentSpeed * delta;

    if (boostLeft > 0 && slowLeft <= 0) {
      boostSeconds += delta;
    }

    timeEl.textContent = String(Math.ceil(remaining));
    distanceEl.textContent = Math.floor(distance);

    speedEl.textContent =
      `${(currentSpeed / 14).toFixed(1)}×`;

    avoidedEl.textContent = avoided;
    streakEl.textContent = streak;
    crashesEl.textContent = crashes;

    stage.classList.toggle(
      "boosting",
      boostLeft > 0
    );

    /* ROAD MOVEMENT */

    for (const line of laneMarks) {
      line.position.z += currentSpeed * delta;

      if (line.position.z > 10) {
        line.position.z -= 62;
      }
    }

    for (const curb of roadside) {
      curb.position.z += currentSpeed * delta;

      if (curb.position.z > 10) {
        curb.position.z -= 62;
      }
    }

    /* PLAYER */

    const targetX = LANES[lane];

    player.position.x +=
      (targetX - player.position.x) *
      Math.min(1, delta * 13);

    player.rotation.z =
      (targetX - player.position.x) * -0.055;

    /* JUMP PHYSICS */

    if (jumpVelocity !== 0 || jumpHeight > 0) {
      jumpHeight += jumpVelocity * delta;
      jumpVelocity -= 23 * delta;

      if (jumpHeight <= 0) {
        jumpHeight = 0;
        jumpVelocity = 0;
      }
    }

    player.position.y = -1.4 + jumpHeight;

    player.visible =
      invincibleLeft <= 0 ||
      Math.floor(t * 14) % 2 === 0;

    /* SPAWN */

    spawnLeft -= delta;

    if (spawnLeft <= 0) {
      spawn();

      spawnLeft =
        Math.max(0.82, 1.25 - t / 250) +
        Math.random() * 0.30;
    }

    /* OBSTACLES */

    for (const obj of [...obstacles]) {
      obj.group.position.z += currentSpeed * delta;

      if (obj.kind === "boost") {
        obj.group.rotation.y += delta * 2.1;
      }

      if (
        !obj.resolved &&
        obj.group.position.z >= PLAYER_Z - 0.15
      ) {
        obj.resolved = true;

        const inLane =
          Math.abs(
            obj.group.position.x -
            player.position.x
          ) < 1.2;

        if (obj.kind === "boost") {
          if (inLane) {
            collectBoost();
          }

        } else {
          const jumpable =
            obj.kind === "rock" ||
            obj.kind === "log";

          const safeJump =
            jumpable &&
            jumpHeight > 0.75;

          if (inLane && !safeJump) {
            if (invincibleLeft <= 0) {
              hit();
            }

          } else {
            avoided++;
            streak++;

            bestStreak = Math.max(
              bestStreak,
              streak
            );

            if (
              streak > 0 &&
              streak % 6 === 0
            ) {
              boostLeft = Math.max(
                boostLeft,
                2.2
              );

              flash("STREAK BOOST!", "boost");
            }
          }
        }
      }

      if (obj.group.position.z > PLAYER_Z + 8) {
        clearObstacle(obj);
      }
    }
  });

  /* START */

  startTime = performance.now();
  world.start();

  /* CLEANUP */

  return () => {
    active = false;

    clearTimeout(messageTimer);
    clearTimeout(endTimer);

    leftBtn.removeEventListener("pointerdown", left);
    rightBtn.removeEventListener("pointerdown", right);
    jumpBtn.removeEventListener("pointerdown", jump);

    stage.removeEventListener("pointerdown", swipeStart);
    stage.removeEventListener("pointerup", swipeEnd);

    window.removeEventListener("keydown", onKey);

    world.destroy();
  };
}
