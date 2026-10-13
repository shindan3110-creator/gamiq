
// GAMIQ V2 — ARMY GROW / CINEMATIC BATTLE
import { GamiqThreeScene } from "./three-renderer.js";

export async function runFactory3D({ container, onComplete }) {
  if (!container) return () => {};

  const TURNS = 5;
  const LANES = [-2.4, 2.4];
  const MAX_VISIBLE = 110;
  const ROAD_SPEED = 13.5;
  const HIT_Z = 2;
  const BATTLE_LENGTH = 5.6;
  const startTime = performance.now();

  let active = true;
  let phase = "gates";
  let lane = 0;
  let army = 8;
  let peakArmy = army;
  let bestChoices = 0;
  let turns = 0;
  let gateRow = null;
  let nextRowIn = 0;
  let enemy = null;
  let enemyCount = 0;
  let originalArmy = 0;
  let originalEnemy = 0;
  let battleAge = 0;
  let approachAge = 0;
  let celebrationAge = 0;
  let combatTick = 0;
  let lastLoss = 0;
  let battleLine = -2.1;
  let finishTimeout = null;
  let popTimeout = null;
  let downPointer = null;
  let delivered = false;

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

  /* ==========================================
  HTML
  ========================================== */

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

        <div class="army-battle-hud" data-army-battle>
          <div class="army-battle-numbers">
            <strong class="army-blue-number" data-army-blue>
              BLUE 0
            </strong>

            <span>VS</span>

            <strong class="army-red-number" data-army-red>
              RED 0
            </strong>
          </div>

          <div class="army-battle-bars">
            <div class="army-blue-bar" data-army-blue-bar></div>
            <div class="army-red-bar" data-army-red-bar></div>
          </div>
        </div>

        <div class="army-impact-flash" data-army-flash></div>
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

  const el = selector =>
    container.querySelector(selector);

  const stage = el("[data-army-stage]");
  const host = el("[data-army-world]");
  const countEl = el("[data-army-count]");
  const waveEl = el("[data-army-wave]");
  const bestEl = el("[data-army-best]");
  const popEl = el("[data-army-pop]");
  const flashEl = el("[data-army-flash]");
  const battleHUD = el("[data-army-battle]");
  const blueEl = el("[data-army-blue]");
  const redEl = el("[data-army-red]");
  const blueBar = el("[data-army-blue-bar]");
  const redBar = el("[data-army-red-bar]");
  const leftBtn = el("[data-army-left]");
  const rightBtn = el("[data-army-right]");

  /* ==========================================
  THREE.JS
  ========================================== */

  const world = new GamiqThreeScene({
    container: host,
    cameraZ: 11,
    background: 0x0b1723
  });

    if (!(await world.init())) {
    throw new Error("3D unavailable");
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

  const sun = new T.DirectionalLight(
    0xffe9b8,
    2.2
  );

  sun.position.set(-6, 12, 4);
  world.scene.add(sun);

  /* ==========================================
  MATERIALS
  ========================================== */

  const mat = {
    road: new T.MeshStandardMaterial({
      color: 0x273440,
      roughness: 0.94
    }),

    grass: new T.MeshStandardMaterial({
      color: 0x164032,
      roughness: 1
    }),

    line: new T.MeshBasicMaterial({
      color: 0xdcecf5
    }),

    edge: new T.MeshBasicMaterial({
      color: 0x48cce7
    }),

    blue: new T.MeshStandardMaterial({
      color: 0x28c5ff,
      roughness: 0.46
    }),

    blueLeg: new T.MeshStandardMaterial({
      color: 0x145baf
    }),

    red: new T.MeshStandardMaterial({
      color: 0xff4c67,
      roughness: 0.48
    }),

    redLeg: new T.MeshStandardMaterial({
      color: 0xa52944
    }),

    skin: new T.MeshStandardMaterial({
      color: 0xffd2b1,
      roughness: 0.85
    }),

    positive: new T.MeshBasicMaterial({
      color: 0x33efa3
    }),

    negative: new T.MeshBasicMaterial({
      color: 0xff697a
    })
  };

  function box(
    w, h, d,
    material,
    x, y, z,
    parent = world.scene
  ) {
    const mesh = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      material
    );

    mesh.position.set(x, y, z);
    parent.add(mesh);

    return mesh;
  }

  /* ==========================================
  ROAD
  ========================================== */

  box(
    12, 0.18, 100,
    mat.road,
    0, -2.02, -25
  );

  box(
    70, 0.10, 100,
    mat.grass,
    0, -2.17, -25
  );

  const stripes = [];

  for (let z = -48; z < 11; z += 5.5) {
    stripes.push(
      box(
        0.13, 0.025, 2.4,
        mat.line,
        0, -1.91, z
      )
    );

    stripes.push(
      box(
        0.12, 0.025, 2.4,
        mat.edge,
        -5.7, -1.91, z
      )
    );

    stripes.push(
      box(
        0.12, 0.025, 2.4,
        mat.edge,
        5.7, -1.91, z
      )
    );
  }

  /* ==========================================
  SOLDIER CROWD
  ========================================== */

  function makeCrowd(
    bodyMaterial,
    legMaterial,
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
      new T.BoxGeometry(0.26, 0.46, 0.24),
      bodyMaterial,
      MAX_VISIBLE
    );

    const head = new T.InstancedMesh(
      new T.SphereGeometry(0.17, 8, 6),
      mat.skin,
      MAX_VISIBLE
    );

    const legs = new T.InstancedMesh(
      new T.BoxGeometry(0.20, 0.27, 0.16),
      legMaterial,
      MAX_VISIBLE
    );

    const arms = new T.InstancedMesh(
      new T.BoxGeometry(0.46, 0.12, 0.15),
      bodyMaterial,
      MAX_VISIBLE
    );

    const parts = [
      body,
      head,
      legs,
      arms
    ];

    parts.forEach(part => {
      part.instanceMatrix.setUsage(
        T.DynamicDrawUsage
      );

      part.frustumCulled = false;
      root.add(part);
    });

    world.scene.add(root);

    const dummy = new T.Object3D();

    function draw(count, t, fighting = false) {
      const visible = Math.min(
        MAX_VISIBLE,
        Math.max(0, Math.round(count))
      );

      const columns = Math.min(
        10,
        Math.max(
          3,
          Math.ceil(Math.sqrt(visible * 1.4))
        )
      );

      parts.forEach(part => {
        part.count = visible;
      });

      for (let i = 0; i < visible; i++) {
        const row = Math.floor(i / columns);
        const col = i % columns;

        const x =
          (col - (columns - 1) / 2) * 0.34;

        const z = -row * 0.43;

        const randomPhase = i * 1.37;

        const bounce = Math.sin(
          t * (fighting ? 17 : 12) + randomPhase
        ) * 0.052;

        const swing = fighting
          ? Math.sin(t * 18 + randomPhase) * 0.16
          : 0;

        const rush = fighting
          ? Math.sin(t * 9 + i * 2.1) * 0.09
          : 0;

        dummy.scale.set(1, 1, 1);

        // BODY
        dummy.rotation.set(
          0,
          swing,
          fighting
            ? Math.sin(t * 12 + i) * 0.10
            : 0
        );

        dummy.position.set(
          x + rush,
          0.55 + bounce,
          z
        );

        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);

        // HEAD
        dummy.rotation.set(0, 0, 0);
        dummy.position.y = 0.92 + bounce;

        dummy.updateMatrix();
        head.setMatrixAt(i, dummy.matrix);

        // LEGS
        dummy.position.y = 0.18 + bounce;

        dummy.rotation.x =
          Math.sin(t * 12 + randomPhase) * 0.55;

        dummy.updateMatrix();
        legs.setMatrixAt(i, dummy.matrix);

        // ARMS
        dummy.position.y = 0.64 + bounce;

        dummy.rotation.x = fighting
          ? Math.sin(t * 21 + randomPhase) * 0.9
          : 0.16;

        dummy.updateMatrix();
        arms.setMatrixAt(i, dummy.matrix);
      }

      parts.forEach(part => {
        part.instanceMatrix.needsUpdate = true;
      });
    }

    return { root, draw };
  }

  const blue = makeCrowd(
    mat.blue,
    mat.blueLeg,
    LANES[0],
    HIT_Z
  );

  blue.draw(army, 0);

  /* ==========================================
  GATES
  ========================================== */

  function resultOf(count, choice) {
    if (choice.op === "+") {
      return Math.min(999, count + choice.n);
    }

    if (choice.op === "-") {
      return Math.max(1, count - choice.n);
    }

    return Math.min(999, count * choice.n);
  }

  const gateText = choice =>
    `${choice.op === "x" ? "×" : choice.op}${choice.n}`;

  function labelFor(text) {
    const canvas = document.createElement("canvas");

    canvas.width = 512;
    canvas.height = 256;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, 512, 256);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.font = "bold 150px Arial, sans-serif";

    ctx.lineWidth = 16;
    ctx.strokeStyle = "rgba(0,0,0,.68)";

    ctx.strokeText(text, 256, 124);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, 256, 124);

    const texture = new T.CanvasTexture(canvas);

    if (T.SRGBColorSpace) {
      texture.colorSpace = T.SRGBColorSpace;
    }

    const material = new T.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide
    });

    return new T.Mesh(
      new T.PlaneGeometry(3.1, 1.55),
      material
    );
  }

  function makeGate(choice, x) {
    const group = new T.Group();

    group.position.set(
      x,
      -1.86,
      -34
    );

    const good = choice.op !== "-";

    const color = good
      ? mat.positive
      : mat.negative;

    const panel = new T.Mesh(
      new T.PlaneGeometry(3.8, 2.5),

      new T.MeshBasicMaterial({
        color: good ? 0x14a677 : 0xc73559,
        transparent: true,
        opacity: 0.29,
        side: T.DoubleSide,
        depthWrite: false
      })
    );

    panel.position.y = 1.42;
    group.add(panel);

    box(
      0.13, 2.85, 0.16,
      color,
      -1.93, 1.42, 0,
      group
    );

    box(
      0.13, 2.85, 0.16,
      color,
      1.93, 1.42, 0,
      group
    );

    box(
      4, 0.16, 0.16,
      color,
      0, 2.86, 0,
      group
    );

    const label = labelFor(
      gateText(choice)
    );

    label.position.set(0, 1.43, 0.1);
    group.add(label);

    world.scene.add(group);

    return { group, label, panel };
  }

  function removeGate(g) {
    world.scene.remove(g.group);

    g.label.material.map.dispose();
    g.label.material.dispose();
    g.label.geometry.dispose();

    g.panel.material.dispose();
    g.panel.geometry.dispose();

    g.group.children.forEach(obj => {
      if (
        obj.isMesh &&
        obj !== g.label &&
        obj !== g.panel
      ) {
        obj.geometry.dispose();
      }
    });
  }

  function spawnRow() {
    if (
      !active ||
      phase !== "gates" ||
      turns >= TURNS
    ) {
      return;
    }

    const pair = rounds[turns];

    gateRow = {
      pair,
      z: -34,

      objects: [
        makeGate(pair[0], LANES[0]),
        makeGate(pair[1], LANES[1])
      ]
    };

    updateHUD();
  }

  /* ==========================================
  HUD & INPUT
  ========================================== */

  function showPop(
    text,
    mode = "good",
    duration = 820
  ) {
    clearTimeout(popTimeout);

    popEl.textContent = text;
    popEl.className = "army-pop";

    void popEl.offsetWidth;

    popEl.className =
      `army-pop show ${mode}`;

    popTimeout = setTimeout(() => {
      popEl.classList.remove("show");
    }, duration);
  }

  function updateHUD() {
    countEl.textContent = String(army);

    if (phase === "gates") {
      waveEl.textContent =
        `${Math.min(turns + 1, TURNS)} / ${TURNS}`;
    }

    bestEl.textContent = String(bestChoices);
  }

  function setLane(value) {
    if (!active || phase !== "gates") {
      return;
    }

    lane = value;

    leftBtn.classList.toggle(
      "active",
      lane === 0
    );

    rightBtn.classList.toggle(
      "active",
      lane === 1
    );
  }

  const pressLeft = () => setLane(0);
  const pressRight = () => setLane(1);

  function keyDown(e) {
    if (
      e.key === "ArrowLeft" ||
      e.key.toLowerCase() === "a"
    ) {
      if (phase === "gates") {
        e.preventDefault();
      }

      setLane(0);

    } else if (
      e.key === "ArrowRight" ||
      e.key.toLowerCase() === "d"
    ) {
      if (phase === "gates") {
        e.preventDefault();
      }

      setLane(1);
    }
  }

  function pointerDown(e) {
    if (e.target.closest("button")) {
      return;
    }

    downPointer = {
      id: e.pointerId,
      x: e.clientX
    };

    const rect = stage.getBoundingClientRect();

    setLane(
      e.clientX < rect.left + rect.width / 2
        ? 0
        : 1
    );
  }

  function pointerUp(e) {
    if (
      !downPointer ||
      e.pointerId !== downPointer.id
    ) {
      return;
    }

    const dx = e.clientX - downPointer.x;

    if (Math.abs(dx) > 38) {
      setLane(dx < 0 ? 0 : 1);
    }

    downPointer = null;
  }

  leftBtn.addEventListener(
    "pointerdown",
    pressLeft
  );

  rightBtn.addEventListener(
    "pointerdown",
    pressRight
  );

  stage.addEventListener(
    "pointerdown",
    pointerDown
  );

  stage.addEventListener(
    "pointerup",
    pointerUp
  );

  window.addEventListener(
    "keydown",
    keyDown
  );

  setLane(0);

  function chooseGate() {
    const before = army;

    const selected = gateRow.pair[lane];

    const candidates = gateRow.pair.map(
      gate => resultOf(army, gate)
    );

    army = resultOf(army, selected);

    peakArmy = Math.max(
      peakArmy,
      army
    );

    if (army >= Math.max(...candidates)) {
      bestChoices++;
    }

    showPop(
      `${gateText(selected)} → ${army}`,
      army >= before ? "good" : "bad"
    );

    gateRow.objects.forEach(removeGate);

    gateRow = null;
    turns++;
    nextRowIn = 0.55;

    updateHUD();
  }

  /* ==========================================
  KNOCKOUT SOLDIERS
  ========================================== */

  const knocked = [];

  const knockGeo = new T.BoxGeometry(
    0.24, 0.50, 0.22
  );

  const knockHeadGeo =
    new T.SphereGeometry(0.15, 7, 5);

  for (let i = 0; i < 20; i++) {
    const group = new T.Group();

    const torso = new T.Mesh(
      knockGeo,
      i % 2 ? mat.red : mat.blue
    );

    torso.position.y = 0.36;

    const head = new T.Mesh(
      knockHeadGeo,
      mat.skin
    );

    head.position.y = 0.72;

    group.add(torso, head);
    group.visible = false;

    world.scene.add(group);

    knocked.push({
      group,
      alive: false,
      age: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rotation: 0
    });
  }

  let knockCursor = 0;

  function knockOut(colorIsRed) {
    const item =
      knocked[knockCursor++ % knocked.length];

    item.group.children[0].material =
      colorIsRed ? mat.red : mat.blue;

    item.group.visible = true;
    item.group.scale.setScalar(1);

    item.group.position.set(
      (Math.random() - 0.5) * 5,
      -1.82,
      battleLine +
        (Math.random() - 0.5) * 2
    );

    item.group.rotation.set(0, 0, 0);

    item.age = 0;
    item.alive = true;

    item.vx =
      (Math.random() - 0.5) * 7;

    item.vy =
      3 + Math.random() * 2.8;

    item.vz =
      (Math.random() - 0.5) * 5;

    item.rotation =
      (Math.random() < 0.5 ? -1 : 1) *
      (4 + Math.random() * 7);
  }

  /* ==========================================
  SPARK PARTICLES
  ========================================== */

  const sparks = [];

  const sparkGeo =
    new T.BoxGeometry(0.11, 0.11, 0.11);

  const sparkMats = [
    new T.MeshBasicMaterial({
      color: 0xffffff
    }),

    new T.MeshBasicMaterial({
      color: 0xffe079
    }),

    new T.MeshBasicMaterial({
      color: 0x74eeff
    })
  ];

  for (let i = 0; i < 32; i++) {
    const mesh = new T.Mesh(
      sparkGeo,
      sparkMats[i % sparkMats.length]
    );

    mesh.visible = false;
    world.scene.add(mesh);

    sparks.push({
      mesh,
      life: 0,
      vx: 0,
      vy: 0,
      vz: 0
    });
  }

  let sparkCursor = 0;

  function impact() {
    for (let i = 0; i < 9; i++) {
      const particle =
        sparks[sparkCursor++ % sparks.length];

      particle.mesh.visible = true;

      particle.mesh.position.set(
        (Math.random() - 0.5) * 3.2,
        -0.95 + Math.random() * 0.65,
        battleLine +
          (Math.random() - 0.5) * 0.9
      );

      particle.mesh.scale.setScalar(1);

      particle.vx =
        (Math.random() - 0.5) * 7;

      particle.vy =
        2 + Math.random() * 4;

      particle.vz =
        (Math.random() - 0.5) * 6;

      particle.life =
        0.35 + Math.random() * 0.25;
    }

    flashEl.classList.remove("hit");

    void flashEl.offsetWidth;

    flashEl.classList.add("hit");
  }

  function updateEffects(dt) {
    for (const item of knocked) {
      if (!item.alive) {
        continue;
      }

      item.age += dt;
      item.vy -= dt * 12;

      item.group.position.x += item.vx * dt;
      item.group.position.y += item.vy * dt;
      item.group.position.z += item.vz * dt;

      item.group.rotation.z +=
        item.rotation * dt;

      if (
        item.group.position.y < -2 ||
        item.age > 0.9
      ) {
        item.alive = false;
        item.group.visible = false;
      }
    }

    for (const particle of sparks) {
      if (particle.life <= 0) {
        continue;
      }

      particle.life -= dt;
      particle.vy -= dt * 8;

      particle.mesh.position.x +=
        particle.vx * dt;

      particle.mesh.position.y +=
        particle.vy * dt;

      particle.mesh.position.z +=
        particle.vz * dt;

      particle.mesh.scale.setScalar(
        Math.max(
          0.05,
          Math.min(1, particle.life * 3)
        )
      );

      if (particle.life <= 0) {
        particle.mesh.visible = false;
      }
    }
  }

  /* ==========================================
  BATTLE HUD
  ========================================== */

  function setBattleHUD() {
    blueEl.textContent = `BLUE ${army}`;
    redEl.textContent = `RED ${enemyCount}`;

    const total = Math.max(
      1,
      army + enemyCount
    );

    blueBar.style.width =
      `${100 * army / total}%`;

    redBar.style.width =
      `${100 * enemyCount / total}%`;
  }

  /* ==========================================
  BATTLE START
  ========================================== */

  function startApproach() {
    phase = "approach";
    approachAge = 0;

    enemyCount =
      150 + Math.floor(Math.random() * 31);

    enemy = makeCrowd(
      mat.red,
      mat.redLeg,
      0,
      -31
    );

    enemy.draw(enemyCount, 0);

    battleHUD.classList.add("active");

    waveEl.textContent = "BATTLE";

    showPop(
      "ENEMY INCOMING!",
      "battle",
      1100
    );

    setBattleHUD();
  }

  function startBattle() {
    phase = "battle";

    battleAge = 0;
    combatTick = 0;
    lastLoss = 0;

    originalArmy = army;
    originalEnemy = enemyCount;

    battleLine = -2.1;

    showPop(
      "FIGHT!",
      "battle",
      700
    );

    impact();
  }

  /* ==========================================
  VICTORY / DEFEAT
  ========================================== */

  function startCelebration() {
    phase = "celebration";
    celebrationAge = 0;

    const success = army > 0;

    showPop(
      success
        ? `VICTORY! ${army} LEFT`
        : "DEFEAT!",

      success ? "good" : "bad",
      1500
    );

    battleHUD.classList.add(
      success ? "victory" : "defeat"
    );
  }

  function finalize() {
    if (delivered) {
      return;
    }

    delivered = true;
    active = false;

    const success = army > 0;

    const decisionRate =
      bestChoices / TURNS;

    const armyStrength =
      Math.min(1, peakArmy / 350);

    const remaining =
      success
        ? Math.min(1, army / 230)
        : 0;

    const score = Math.round(
      Math.min(
        100,
        decisionRate * 25 +
        armyStrength * 25 +
        remaining * 35 +
        (success ? 15 : 0)
      )
    );

    const adapt = Math.round(
      Math.min(
        100,
        25 +
        decisionRate * 45 +
        armyStrength * 20 +
        (success ? 10 : 0)
      )
    );

    finishTimeout = setTimeout(() => {
      onComplete?.({
        score,
        adapt,

        meta: {
          success,
          initialArmy: 8,
          peakArmy,
          finalArmy: army,
          enemyArmy: originalEnemy,
          gatesChosen: turns,
          bestChoices,
          elapsed: Math.round(
            performance.now() - startTime
          )
        }
      });
    }, 200);
  }

  /* ==========================================
  CAMERA
  ========================================== */

  const cameraTarget = new T.Vector3();

  /* ==========================================
  GAME LOOP
  ========================================== */

  let time = 0;

  world.addUpdate(delta => {
    if (!active) {
      return;
    }

    const dt = Math.max(
      0,
      Math.min(0.04, delta)
    );

    time += dt;

    const inBattle =
      phase === "battle" ||
      phase === "celebration";

    const speed =
      phase === "gates"
        ? ROAD_SPEED
        : phase === "approach"
          ? 8
          : 0;

    /* ROAD MOVEMENT */

    for (const line of stripes) {
      line.position.z += speed * dt;

      if (line.position.z > 10) {
        line.position.z -= 60.5;
      }
    }

    /* PLAYER MOVEMENT */

    const targetX =
      phase === "gates"
        ? LANES[lane]
        : 0;

    blue.root.position.x +=
      (targetX - blue.root.position.x) *
      Math.min(1, dt * 11);

    /* GATE PHASE */

    if (phase === "gates") {
      if (gateRow) {
        gateRow.z += ROAD_SPEED * dt;

        gateRow.objects.forEach(item => {
          item.group.position.z = gateRow.z;
        });

        if (gateRow.z >= HIT_Z) {
          chooseGate();
        }

      } else {
        nextRowIn -= dt;

        if (nextRowIn <= 0) {
          if (turns < TURNS) {
            spawnRow();
          } else {
            startApproach();
          }
        }
      }

    /* ENEMY APPROACH */

    } else if (phase === "approach") {
      approachAge += dt;

      blue.root.position.z +=
        (-1.2 - blue.root.position.z) *
        Math.min(1, dt * 2.1);

      enemy.root.position.z +=
        17.5 * dt;

      enemy.draw(
        enemyCount,
        time
      );

      if (enemy.root.position.z >= -3.6) {
        enemy.root.position.z = -3.6;
        startBattle();
      }

    /* MAIN BATTLE */

    } else if (phase === "battle") {
      battleAge = Math.min(
        BATTLE_LENGTH,
        battleAge + dt
      );

      const progress =
        battleAge / BATTLE_LENGTH;

      const easing =
        progress * progress *
        (3 - 2 * progress);

      const casualties =
        Math.min(
          originalArmy,
          originalEnemy
        );

      const losses =
        Math.floor(casualties * easing);

      army = Math.max(
        0,
        originalArmy - losses
      );

      enemyCount = Math.max(
        0,
        originalEnemy - losses
      );

      /*
       * More soldiers = stronger push.
       * Frontline moves toward the losing side.
       */

      const advantage =
        (originalArmy - originalEnemy) /
        Math.max(
          1,
          originalArmy + originalEnemy
        );

      const push =
        Math.max(
          -1.8,
          Math.min(1.8, advantage * 3)
        ) * easing;

      battleLine = -2.1 - push;

      blue.root.position.z =
        -1.1 - push * 0.70;

      enemy.root.position.z =
        -3.5 - push * 0.70;

      enemy.draw(
        enemyCount,
        time,
        true
      );

      /* IMPACT EFFECTS */

      combatTick += dt;

      if (combatTick >= 0.14) {
        combatTick = 0;

        impact();

        const newLosses =
          losses - lastLoss;

        for (
          let i = 0;
          i < Math.min(3, newLosses);
          i++
        ) {
          knockOut(i % 2 === 0);
        }

        lastLoss = losses;
      }

      setBattleHUD();

      if (battleAge >= BATTLE_LENGTH) {
        startCelebration();
      }

    /* CELEBRATION */

    } else if (phase === "celebration") {
      celebrationAge += dt;

      if (army > 0) {
        blue.root.position.z +=
          3.8 * dt;

        blue.root.position.y =
          -1.89 +
          Math.sin(time * 16) * 0.04;

        blue.root.rotation.y =
          Math.sin(time * 5) * 0.06;

      } else if (enemy) {
        enemy.root.position.z +=
          2 * dt;
      }

      if (celebrationAge >= 1.5) {
        finalize();
      }
    }

    /* CHARACTER ANIMATION */

    blue.draw(
      army,
      time,
      inBattle
    );

    if (enemy) {
      enemy.draw(
        enemyCount,
        time,
        inBattle
      );
    }

    updateEffects(dt);

    /* CINEMATIC CAMERA */

    if (phase === "gates") {
      cameraTarget.set(
        0,
        7.1,
        11.5
      );

    } else if (phase === "approach") {
      cameraTarget.set(
        0,
        9.4,
        11.1
      );

    } else {
      cameraTarget.set(
        0,
        8.5,
        9.5
      );
    }

    world.camera.position.lerp(
      cameraTarget,
      Math.min(1, dt * 2.5)
    );

    const shake =
      phase === "battle"
        ? 0.065
        : 0;

    world.camera.position.x +=
      (Math.random() - 0.5) * shake;

    world.camera.position.y +=
      (Math.random() - 0.5) * shake;

    world.camera.lookAt(
      0,
      -0.3,
      phase === "gates"
        ? -9
        : -3.4
    );

    countEl.textContent =
      String(army);
  });

  /* ==========================================
  START
  ========================================== */

  spawnRow();
  world.start();

  /* ==========================================
  CLEANUP
  ========================================== */

  return () => {
    active = false;

    clearTimeout(finishTimeout);
    clearTimeout(popTimeout);

    leftBtn.removeEventListener(
      "pointerdown",
      pressLeft
    );

    rightBtn.removeEventListener(
      "pointerdown",
      pressRight
    );

    stage.removeEventListener(
      "pointerdown",
      pointerDown
    );

    stage.removeEventListener(
      "pointerup",
      pointerUp
    );

    window.removeEventListener(
      "keydown",
      keyDown
    );

    world.destroy();
  };
}
