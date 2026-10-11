
import { GamiqThreeScene } from "./three-renderer.js";

// GAMIQ V2 — ARMY GROW

export async function runFactory3D({ container, onComplete }) {
  if (!container) return () => {};

  let active = true;
  let complete = false;
  let phase = "gates";

  let lane = 0;
  let army = 8;
  let peakArmy = 8;
  let choices = 0;
  let bestChoices = 0;
  let wave = 0;

  let gateRow = null;
  let nextWaveIn = 0;
  let enemy = null;
  let enemyCount = 0;

  let fightAge = 0;
  let battleStartArmy = 0;
  let battleEnemy = 0;
  let elapsedTime = 0;

  let finishTimer = null;
  let popTimer = null;
  let pointerStart = null;

  const LANES = [-2.4, 2.4];
  const HIT_Z = 2;
  const ROAD_SPEED = 13.5;
  const MAX_VISIBLE = 100;

  // Five decisions. The better gate depends
  // on how many soldiers you already have.
  const rounds = [
    [{ op: "+", n: 10 }, { op: "x", n: 2 }],
    [{ op: "+", n: 35 }, { op: "x", n: 2 }],
    [{ op: "+", n: 25 }, { op: "x", n: 3 }],
    [{ op: "-", n: 20 }, { op: "+", n: 45 }],
    [{ op: "x", n: 2 }, { op: "+", n: 75 }]
  ].map(pair =>
    Math.random() < 0.5
      ? [...pair].reverse()
      : pair
  );

  container.innerHTML = `
    <div class="army-grow">
      <div class="army-hud">
        <div>
          <span>YOUR ARMY</span>
          <strong data-army-count>8</strong>
        </div>
        <div>
          <span>GATE</span>
          <strong data-army-wave>1 / 5</strong>
        </div>
        <div>
          <span>BEST CHOICES</span>
          <strong data-army-best>0</strong>
        </div>
      </div>

      <div class="army-stage" data-army-stage>
        <div class="army-world" data-army-world></div>
        <div class="army-pop" data-army-pop></div>
        <div class="army-instruction">
          PICK THE BETTER GATE!
        </div>
      </div>

      <div class="army-controls">
        <button type="button" data-army-left>
          ◀ LEFT
        </button>
        <button type="button" data-army-right>
          RIGHT ▶
        </button>
      </div>
    </div>
  `;

  const stage =
    container.querySelector("[data-army-stage]");

  const worldHost =
    container.querySelector("[data-army-world]");

  const countEl =
    container.querySelector("[data-army-count]");

  const waveEl =
    container.querySelector("[data-army-wave]");

  const bestEl =
    container.querySelector("[data-army-best]");

  const popEl =
    container.querySelector("[data-army-pop]");

  const leftButton =
    container.querySelector("[data-army-left]");

  const rightButton =
    container.querySelector("[data-army-right]");

  const world = new GamiqThreeScene({
    container: worldHost,
    cameraZ: 11,
    background: 0x0b1723
  });

  if (!(await world.init())) {
    container.innerHTML = `
      <div class="factory-3d-fallback">
        3D unavailable
      </div>
    `;
    return () => {};
  }

  const T = world.THREE;

  world.camera.position.set(0, 7.1, 11.5);
  world.camera.lookAt(0, 0.1, -9);

  world.scene.add(
    new T.HemisphereLight(
      0xb2ecff,
      0x303526,
      2.3
    )
  );

  const sun =
    new T.DirectionalLight(0xffe9b8, 2.2);

  sun.position.set(-6, 12, 4);
  world.scene.add(sun);

  const mat = {
    road: new T.MeshStandardMaterial({
      color: 0x26323d,
      roughness: 0.96
    }),

    line: new T.MeshBasicMaterial({
      color: 0xdce7ed
    }),

    edge: new T.MeshBasicMaterial({
      color: 0x4acee5
    }),

    grass: new T.MeshStandardMaterial({
      color: 0x183f32,
      roughness: 1
    }),

    blue: new T.MeshStandardMaterial({
      color: 0x35c9ff,
      roughness: 0.45
    }),

    blueHead: new T.MeshStandardMaterial({
      color: 0xffd8b1,
      roughness: 0.92
    }),

    blueLeg: new T.MeshStandardMaterial({
      color: 0x1e6eb0,
      roughness: 0.9
    }),

    red: new T.MeshStandardMaterial({
      color: 0xff576b,
      roughness: 0.55
    }),

    redHead: new T.MeshStandardMaterial({
      color: 0xffd0c0,
      roughness: 0.9
    }),

    redLeg: new T.MeshStandardMaterial({
      color: 0x9a253c,
      roughness: 0.85
    }),

    greenGate: new T.MeshBasicMaterial({
      color: 0x34f0a0
    }),

    redGate: new T.MeshBasicMaterial({
      color: 0xff6675
    })
  };

  function cube(
    w, h, d,
    material,
    x, y, z,
    parent = world.scene
  ) {
    const obj = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      material
    );

    obj.position.set(x, y, z);
    parent.add(obj);

    return obj;
  }

  // Road
  cube(
    12, 0.18, 100,
    mat.road,
    0, -2.02, -25
  );

  cube(
    70, 0.10, 100,
    mat.grass,
    0, -2.17, -25
  );

  const movingLines = [];

  for (let z = -48; z < 11; z += 5.5) {
    movingLines.push(
      cube(
        0.13, 0.025, 2.4,
        mat.line,
        0, -1.91, z
      )
    );

    movingLines.push(
      cube(
        0.12, 0.025, 2.4,
        mat.edge,
        -5.7, -1.91, z
      )
    );

    movingLines.push(
      cube(
        0.12, 0.025, 2.4,
        mat.edge,
        5.7, -1.91, z
      )
    );
  }

  /*
   * Draw many soldiers using InstancedMesh.
   * This is substantially lighter than
   * creating hundreds of independent meshes.
   */

  function makeCrowd(
    colorBody,
    colorHead,
    colorLegs,
    startX,
    startZ
  ) {
    const root = new T.Group();

    root.position.set(
      startX,
      -1.89,
      startZ
    );

    const body = new T.InstancedMesh(
      new T.BoxGeometry(
        0.25, 0.45, 0.24
      ),
      colorBody,
      MAX_VISIBLE
    );

    const heads = new T.InstancedMesh(
      new T.SphereGeometry(
        0.17, 8, 6
      ),
      colorHead,
      MAX_VISIBLE
    );

    const legs = new T.InstancedMesh(
      new T.BoxGeometry(
        0.21, 0.27, 0.17
      ),
      colorLegs,
      MAX_VISIBLE
    );

    [body, heads, legs].forEach(mesh => {
      mesh.instanceMatrix.setUsage(
        T.DynamicDrawUsage
      );

      mesh.frustumCulled = false;
      root.add(mesh);
    });

    world.scene.add(root);

    const temp = new T.Object3D();

    function draw(count, time) {
      const visible = Math.max(
        0,
        Math.min(
          MAX_VISIBLE,
          Math.round(count)
        )
      );

      const columns = Math.min(
        10,
        Math.max(
          3,
          Math.ceil(
            Math.sqrt(visible * 1.4)
          )
        )
      );

      body.count = visible;
      heads.count = visible;
      legs.count = visible;

      if (visible === 0) return;

      for (let i = 0; i < visible; i++) {
        const row =
          Math.floor(i / columns);

        const col =
          i % columns;

        const x =
          (
            col -
            (columns - 1) / 2
          ) * 0.33;

        const z =
          -row * 0.43;

        const bounce =
          Math.sin(
            time * 12 +
            i * 0.8
          ) * 0.045;

        temp.rotation.set(0, 0, 0);
        temp.scale.set(1, 1, 1);

        temp.position.set(
          x,
          0.53 + bounce,
          z
        );

        temp.updateMatrix();
        body.setMatrixAt(i, temp.matrix);

        temp.position.y =
          0.88 + bounce;

        temp.updateMatrix();
        heads.setMatrixAt(i, temp.matrix);

        temp.position.y =
          0.19 + bounce;

        temp.updateMatrix();
        legs.setMatrixAt(i, temp.matrix);
      }

      body.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      legs.instanceMatrix.needsUpdate = true;
    }

    return {
      root,
      draw
    };
  }

  const player = makeCrowd(
    mat.blue,
    mat.blueHead,
    mat.blueLeg,
    LANES[lane],
    HIT_Z
  );

  player.draw(army, 0);

  /*
   * Gate calculations
   */

  function applyGate(count, gate) {
    if (gate.op === "+") {
      return Math.min(
        999,
        count + gate.n
      );
    }

    if (gate.op === "-") {
      return Math.max(
        1,
        count - gate.n
      );
    }

    if (gate.op === "x") {
      return Math.min(
        999,
        count * gate.n
      );
    }

    return count;
  }

  function gateText(gate) {
    return (
      gate.op === "x"
        ? "×"
        : gate.op
    ) + gate.n;
  }

  /*
   * Large readable gate number
   */

  function makeLabel(value, good) {
    const canvas =
      document.createElement("canvas");

    canvas.width = 512;
    canvas.height = 256;

    const ctx =
      canvas.getContext("2d");

    ctx.clearRect(
      0, 0, 512, 256
    );

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    ctx.font =
      "bold 154px Arial, sans-serif";

    ctx.lineWidth = 16;
    ctx.strokeStyle =
      "rgba(0,0,0,.65)";

    ctx.strokeText(
      value,
      256,
      124
    );

    ctx.fillStyle = good
      ? "#f3fff8"
      : "#fff4f4";

    ctx.fillText(
      value,
      256,
      124
    );

    const texture =
      new T.CanvasTexture(canvas);

    texture.colorSpace =
      T.SRGBColorSpace;

    const material =
      new T.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide
      });

    return new T.Mesh(
      new T.PlaneGeometry(
        3.05, 1.55
      ),
      material
    );
  }

  function makeGate(gate, x, z) {
    const group = new T.Group();

    group.position.set(
      x,
      -1.86,
      z
    );

    const good =
      gate.op !== "-";

    const color = good
      ? mat.greenGate
      : mat.redGate;

    const panel = new T.Mesh(
      new T.PlaneGeometry(
        3.80, 2.50
      ),

      new T.MeshBasicMaterial({
        color: good
          ? 0x12ac78
          : 0xc73052,

        transparent: true,
        opacity: 0.28,
        side: T.DoubleSide,
        depthWrite: false
      })
    );

    panel.position.set(
      0, 1.42, 0
    );

    group.add(panel);

    cube(
      0.13, 2.85, 0.16,
      color,
      -1.93, 1.42, 0,
      group
    );

    cube(
      0.13, 2.85, 0.16,
      color,
      1.93, 1.42, 0,
      group
    );

    cube(
      4, 0.16, 0.16,
      color,
      0, 2.86, 0,
      group
    );

    const label =
      makeLabel(
        gateText(gate),
        good
      );

    label.position.set(
      0, 1.43, 0.1
    );

    group.add(label);
    world.scene.add(group);

    return {
      group,
      label,
      panel
    };
  }

  function removeGate(item) {
    world.scene.remove(
      item.group
    );

    item.label.material.map.dispose();
    item.label.material.dispose();
    item.label.geometry.dispose();

    item.panel.material.dispose();
    item.panel.geometry.dispose();

    item.group.children.forEach(obj => {
      if (
        obj.isMesh &&
        obj !== item.label &&
        obj !== item.panel
      ) {
        obj.geometry.dispose();
      }
    });
  }

  /*
   * Spawn two gates at a time
   */

  function spawnWave() {
    if (
      !active ||
      phase !== "gates" ||
      wave >= rounds.length
    ) {
      return;
    }

    const pair = rounds[wave];

    gateRow = {
      pair,

      objects: [
        makeGate(
          pair[0],
          LANES[0],
          -34
        ),

        makeGate(
          pair[1],
          LANES[1],
          -34
        )
      ],

      z: -34
    };

    updateHud();
  }

  function showPop(
    message,
    mode = "good"
  ) {
    clearTimeout(popTimer);

    popEl.className = "army-pop";
    popEl.textContent = message;

    void popEl.offsetWidth;

    popEl.className =
      "army-pop show " + mode;

    popTimer = setTimeout(() => {
      popEl.classList.remove(
        "show"
      );
    }, 750);
  }

  function updateHud() {
    countEl.textContent =
      String(army);

    waveEl.textContent =
      `${Math.min(
        wave + 1,
        rounds.length
      )} / ${rounds.length}`;

    bestEl.textContent =
      String(bestChoices);
  }

  /*
   * Lane controls
   */

  function selectLane(value) {
    if (
      !active ||
      phase !== "gates"
    ) {
      return;
    }

    lane = value;

    leftButton.classList.toggle(
      "active",
      lane === 0
    );

    rightButton.classList.toggle(
      "active",
      lane === 1
    );
  }

  function onKey(e) {
    if (
      !active ||
      phase !== "gates"
    ) {
      return;
    }

    if (
      e.key === "ArrowLeft" ||
      e.key.toLowerCase() === "a"
    ) {
      e.preventDefault();
      selectLane(0);
    }

    if (
      e.key === "ArrowRight" ||
      e.key.toLowerCase() === "d"
    ) {
      e.preventDefault();
      selectLane(1);
    }
  }

  function onPointerDown(e) {
    if (
      !active ||
      e.target.closest("button")
    ) {
      return;
    }

    pointerStart = {
      x: e.clientX,
      id: e.pointerId
    };

    const rect =
      stage.getBoundingClientRect();

    selectLane(
      e.clientX <
      rect.left + rect.width / 2
        ? 0
        : 1
    );
  }

  function onPointerUp(e) {
    if (
      !pointerStart ||
      pointerStart.id !== e.pointerId
    ) {
      return;
    }

    const dx =
      e.clientX - pointerStart.x;

    if (
      Math.abs(dx) > 38
    ) {
      selectLane(
        dx < 0 ? 0 : 1
      );
    }

    pointerStart = null;
  }

  function pressLeft() {
    selectLane(0);
  }

  function pressRight() {
    selectLane(1);
  }

  leftButton.addEventListener(
    "pointerdown",
    pressLeft
  );

  rightButton.addEventListener(
    "pointerdown",
    pressRight
  );

  stage.addEventListener(
    "pointerdown",
    onPointerDown
  );

  stage.addEventListener(
    "pointerup",
    onPointerUp
  );

  window.addEventListener(
    "keydown",
    onKey
  );

  selectLane(0);

  /*
   * Resolve gate selection
   */

  function chooseGate() {
    const selected =
      gateRow.pair[lane];

    const leftResult =
      applyGate(
        army,
        gateRow.pair[0]
      );

    const rightResult =
      applyGate(
        army,
        gateRow.pair[1]
      );

    const before = army;

    army =
      applyGate(
        army,
        selected
      );

    peakArmy =
      Math.max(
        peakArmy,
        army
      );

    choices++;

    if (
      army >= Math.max(
        leftResult,
        rightResult
      )
    ) {
      bestChoices++;
    }

    showPop(
      `${gateText(selected)} → ${army}`,
      army >= before
        ? "good"
        : "bad"
    );

    gateRow.objects.forEach(
      removeGate
    );

    gateRow = null;

    wave++;
    nextWaveIn = 0.55;

    updateHud();
  }

  /*
   * Final enemy army
   */

  function startBattle() {
    if (phase !== "gates") {
      return;
    }

    phase = "approach";

    enemyCount =
      150 +
      Math.floor(
        Math.random() * 31
      );

    enemy = makeCrowd(
      mat.red,
      mat.redHead,
      mat.redLeg,
      0,
      -27
    );

    enemy.draw(
      enemyCount,
      elapsedTime
    );

    showPop(
      "FINAL BATTLE!",
      "battle"
    );

    waveEl.textContent = "BATTLE";
  }

  /*
   * Final scoring
   */

  function finish() {
    if (
      !active ||
      complete
    ) {
      return;
    }

    complete = true;
    active = false;

    const survivors =
      Math.max(
        0,
        battleStartArmy -
        battleEnemy
      );

    const success =
      survivors > 0;

    const decisionRate =
      bestChoices /
      rounds.length;

    const strengthRate =
      Math.min(
        1,
        peakArmy / 250
      );

    const survivalRate =
      Math.min(
        1,
        survivors /
        Math.max(
          1,
          battleEnemy
        )
      );

    const score =
      Math.round(
        Math.min(
          100,

          decisionRate * 30 +
          strengthRate * 32 +
          survivalRate * 23 +
          (success ? 15 : 0)
        )
      );

    const adapt =
      Math.round(
        Math.min(
          100,

          30 +
          decisionRate * 45 +
          strengthRate * 15 +
          (success ? 10 : 0)
        )
      );

    showPop(
      success
        ? `VICTORY! ${survivors} LEFT`
        : "DEFEAT!",

      success
        ? "good"
        : "bad"
    );

    finishTimer =
      setTimeout(() => {
        onComplete?.({
          score,
          adapt,

          meta: {
            success,
            initialArmy: 8,
            peakArmy,
            finalArmy: survivors,
            enemyArmy: battleEnemy,
            gatesChosen: choices,
            bestChoices,
            elapsed:
              Math.round(
                elapsedTime * 1000
              )
          }
        });
      }, 900);
  }

  /*
   * Main 3D loop
   */

  world.addUpdate((delta) => {
    if (!active) return;

    const dt =
      Math.min(
        0.04,
        Math.max(
          0,
          delta
        )
      );

    elapsedTime += dt;

    const moveSpeed =
      phase === "gates"
        ? ROAD_SPEED
        : 11;

    for (const line of movingLines) {
      if (phase === "battle") {
        break;
      }

      line.position.z +=
        dt * moveSpeed;

      if (
        line.position.z > 10
      ) {
        line.position.z -= 60.5;
      }
    }

    // Move the crowd toward the selected lane.
    // In the final battle, both armies meet
    // in the center of the road.
    const playerTargetX =
      phase === "gates"
        ? LANES[lane]
        : 0;

    player.root.position.x +=
      (
        playerTargetX -
        player.root.position.x
      ) *
      Math.min(
        1,
        dt * 11
      );

    player.draw(
      army,
      elapsedTime
    );

    if (phase === "gates") {
      if (gateRow) {
        gateRow.z +=
          ROAD_SPEED * dt;

        gateRow.objects.forEach(g => {
          g.group.position.z =
            gateRow.z;
        });

        if (
          gateRow.z >= HIT_Z
        ) {
          chooseGate();
        }

      } else {
        nextWaveIn -= dt;

        if (
          nextWaveIn <= 0
        ) {
          if (
            wave <
            rounds.length
          ) {
            spawnWave();
          } else {
            startBattle();
          }
        }
      }
    }

    if (phase === "approach") {
      enemy.root.position.z +=
        11.5 * dt;

      enemy.draw(
        enemyCount,
        elapsedTime
      );

      if (
        enemy.root.position.z >=
        HIT_Z - 0.8
      ) {
        phase = "battle";

        fightAge = 0;
        battleStartArmy = army;
        battleEnemy = enemyCount;

        showPop(
          "FIGHT!",
          "battle"
        );
      }

    } else if (
      phase === "battle"
    ) {
      fightAge += dt;

      const fraction =
        Math.min(
          1,
          fightAge / 1.85
        );

      const casualties =
        Math.min(
          battleStartArmy,
          battleEnemy
        );

      army =
        Math.max(
          0,
          Math.round(
            battleStartArmy -
            casualties * fraction
          )
        );

      enemyCount =
        Math.max(
          0,
          Math.round(
            battleEnemy -
            casualties * fraction
          )
        );

      player.draw(
        army,
        elapsedTime
      );

      enemy.draw(
        enemyCount,
        elapsedTime
      );

      if (
        fraction >= 1
      ) {
        finish();
      }
    }

    countEl.textContent =
      String(army);
  });

  /*
   * START
   */

  spawnWave();
  world.start();

  /*
   * CLEANUP
   */

  return () => {
    active = false;

    clearTimeout(
      finishTimer
    );

    clearTimeout(
      popTimer
    );

    leftButton.removeEventListener(
      "pointerdown",
      pressLeft
    );

    rightButton.removeEventListener(
      "pointerdown",
      pressRight
    );

    stage.removeEventListener(
      "pointerdown",
      onPointerDown
    );

    stage.removeEventListener(
      "pointerup",
      onPointerUp
    );

    window.removeEventListener(
      "keydown",
      onKey
    );

    world.destroy();
  };
}
