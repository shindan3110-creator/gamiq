// GAMIQ（ゲーミック） v2 - Tiptoe (3D, first person)
//
// TIPTOE (SPEED)
// - Night. Grandpa sleeps on a futon in the room. He gets VERY angry if he wakes up.
// - Sneak past him to the pudding at the end of the room.
// - HOLD to walk. The longer you hold, the faster you go.
//   Too fast = loud steps (noise). Let go = you slow down.
//   "Slow, but as fast as you can."
// - Slide your finger left / right to move sideways (PC: arrow keys).
// - Toys on the floor make a big noise. Being close to grandpa is louder.
// - While grandpa SNORES you can walk faster without him hearing.
// - Points = fast (time) + quiet (how close he came to waking up).
// - Higher level: lower safe speed, more toys, shorter snores, louder noises.

import { GamiqThreeScene } from "./three-renderer.js";
import { t } from "../i18n.js";
import { byLevel, byLevelInt } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createTiptoeGames() {
  return [
    {
      id: "speed_tiptoe",
      type: "tiptoe",
      title: "TIPTOE",
      rule: "HOLD TO SNEAK. TOO FAST = LOUD STEPS! SLIP PAST GRANDPA TO THE PUDDING.",
      skill: "SPEED",
      theme: "night",
      duration: 20000,
      // 3D games run slower on weak phones; the safety timer gets extra room.
      maxDuration: 150000
    }
  ];
}

export function runTiptoeGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "tiptoe") {
    return runTiptoe({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const ROOM_LEN = 22;         // start z = 0, pudding at z = -ROOM_LEN
const HALF_W = 2.2;          // room half width
const EYE_Y = 1.45;
const MAX_SPEED = 3.6;
const ACCEL = 1.25;          // m/s² while holding
const BRAKE = 5.5;           // m/s² after letting go
const SIDE_SPEED = 2.4;      // m/s with arrow keys
const WAKE = 100;
const TIME_LIMIT = 40;       // seconds

async function runTiptoe({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   safe speed: 1.65 m/s (Lv1) -> 1.25 (old Lv10), min 1.05
   *   snore bonus: +0.8 m/s, snores 2.6s -> 1.6s
   *   toys: 3 -> 6 (max 7)
   *   noise when too fast: x1 -> x1.5
   *   Lv6+ (hell zone): toys are louder
   */
  const quietSpeed = Math.max(1.05, byLevel(level, 1.65, 1.25));
  const snoreBonus = 0.8;
  const snoreLen = Math.max(1.3, byLevel(level, 2.6, 1.6));
  const calmLen = Math.min(4.6, byLevel(level, 2.6, 3.6));
  const toyCount = Math.min(7, byLevelInt(level, 3, 6));
  const overNoise = Math.min(110, byLevel(level, 55, 82));
  const toyNoise = level >= 6 ? 62 : 48;

  let active = true;
  let finished = false;
  let phase = "ready";        // ready / walk / got / angry
  let phaseAt = 0;
  let startAt = 0;
  let simTime = 0;
  let px = 0;
  let pz = 0;
  let speed = 0;
  let holding = false;
  let keyLeft = false;
  let keyRight = false;
  let noise = 0;
  let maxNoise = 0;
  let stepDist = 0;
  let bobT = 0;
  let snoring = false;
  let snoreLeft = calmLen * 0.6;
  let toysHit = 0;
  let stompCount = 0;
  let resultScore = 0;
  let pointer = null;
  let timers = [];
  let shake = 0;
  let faceTo = Math.PI;

  container.innerHTML = `
    <div class="be-game tp-game">
      <div class="be-hud">
        <div>
          <span>TIME</span>
          <strong data-tp-time>0.0</strong>
        </div>
        <div>
          <span>LEFT</span>
          <strong data-tp-left>${ROOM_LEN}m</strong>
        </div>
        <div>
          <span>NOISE</span>
          <strong data-tp-noise-num>0%</strong>
        </div>
      </div>

      <div class="tp-stage" data-tp-stage>
        <div class="tp-world" data-tp-world></div>
        <div class="tp-noise"><span>${t("tp.noise")}</span><b><i data-tp-noise></i></b></div>
        <div class="tp-bubble" data-tp-bubble></div>
        <div class="tp-state" data-tp-state></div>
        <div class="tp-speed">
          <span>${t("tp.speed")}</span>
          <b><em data-tp-safe></em><i data-tp-needle></i></b>
        </div>
        <div class="tp-hint" data-tp-hint></div>
        <div class="tp-pop" data-tp-pop></div>
        <div class="tp-msg" data-tp-msg></div>
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-tp-stage]");
  const worldEl = container.querySelector("[data-tp-world]");
  const timeEl = container.querySelector("[data-tp-time]");
  const leftEl = container.querySelector("[data-tp-left]");
  const noiseNumEl = container.querySelector("[data-tp-noise-num]");
  const noiseEl = container.querySelector("[data-tp-noise]");
  const bubbleEl = container.querySelector("[data-tp-bubble]");
  const stateEl = container.querySelector("[data-tp-state]");
  const safeEl = container.querySelector("[data-tp-safe]");
  const needleEl = container.querySelector("[data-tp-needle]");
  const hintEl = container.querySelector("[data-tp-hint]");
  const popEl = container.querySelector("[data-tp-pop]");
  const msgEl = container.querySelector("[data-tp-msg]");

  const finePointer = window.matchMedia?.("(pointer: fine)")?.matches;
  hintEl.textContent = finePointer ? t("tp.hintPc") : t("tp.hint");

  const world = new GamiqThreeScene({ container: worldEl, cameraZ: 0, background: 0x1a1830 });
  const ok = await world.init();
  if (!ok) {
    throw new Error("3D unavailable");
  }
  if (!active) {
    world.destroy();
    return () => {};
  }

  const T = world.THREE;
  const scene = world.scene;
  const camera = world.camera;
  camera.fov = 68;
  camera.far = 60;
  camera.updateProjectionMatrix();
  world.renderer.shadowMap.enabled = false;

  // our own night lights (bright enough to see everything)
  scene.children.filter(o => o.isLight).forEach(o => scene.remove(o));
  scene.add(new T.HemisphereLight(0xb8c8ff, 0x4a3426, 1.9));
  scene.add(new T.AmbientLight(0xffffff, 0.35));
  const moon = new T.DirectionalLight(0xc4d4ff, 1.1);
  moon.position.set(-4, 6, 2);
  scene.add(moon);
  const lamp = new T.PointLight(0xffc27a, 7, 9, 1.6);
  lamp.position.set(0, 1.6, -ROOM_LEN + 0.4);
  scene.add(lamp);
  scene.fog = new T.Fog(0x1a1830, 16, 34);

  const keep = [];
  function add(obj) {
    scene.add(obj);
    keep.push(obj);
    return obj;
  }


  /* ---------- TEXTURES ---------- */

  function canvasTex(w, h, draw, rx, ry) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = T.RepeatWrapping;
    tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(rx, ry);
    return tex;
  }

  const floorTex = canvasTex(256, 256, (g, w, h) => {
    const cols = ["#b98250", "#ad7745", "#c08a58", "#a87244"];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = cols[i];
      g.fillRect((i * w) / 4, 0, w / 4, h);
      g.fillStyle = "rgba(60,30,10,.5)";
      g.fillRect((i * w) / 4, 0, 2, h);
      g.fillRect((i * w) / 4, ((i * 97) % h), w / 4, 2);
      g.strokeStyle = "rgba(80,40,15,.18)";
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.moveTo((i * w) / 4 + 8 + k * 14, 0);
        g.lineTo((i * w) / 4 + 12 + k * 14, h);
        g.stroke();
      }
    }
  }, 2.2, ROOM_LEN / 2);

  const shojiTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#e9dfc6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#6b4a2c";
    for (let i = 0; i <= 4; i++) g.fillRect((i * w) / 4 - 3, 0, 6, h);
    for (let i = 0; i <= 5; i++) g.fillRect(0, (i * h) / 5 - 3, w, 6);
    g.fillRect(0, 0, 10, h);
    g.fillRect(w - 10, 0, 10, h);
  }, ROOM_LEN / 2, 1);

  const fusumaTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#d9cfae";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(120,140,110,.55)";
    g.lineWidth = 6;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(0, 170 + k * 18);
      g.quadraticCurveTo(w / 2, 120 + k * 18, w, 175 + k * 18);
      g.stroke();
    }
    g.fillStyle = "#4a3220";
    g.fillRect(0, 0, w, 10);
    g.fillRect(0, h - 10, w, 10);
    g.fillRect(w / 2 - 3, 0, 6, h);
  }, 2, 1);


  /* ---------- ROOM ---------- */

  const floor = add(new T.Mesh(
    new T.PlaneGeometry(HALF_W * 2, ROOM_LEN + 6),
    new T.MeshStandardMaterial({ map: floorTex, roughness: 0.85 })
  ));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -ROOM_LEN / 2 + 1);

  const ceil = add(new T.Mesh(
    new T.PlaneGeometry(HALF_W * 2, ROOM_LEN + 6),
    new T.MeshStandardMaterial({ color: 0x3a2a20, roughness: 1 })
  ));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 2.7, -ROOM_LEN / 2 + 1);

  for (const s of [-1, 1]) {
    const wall = add(new T.Mesh(
      new T.PlaneGeometry(ROOM_LEN + 6, 2.7),
      new T.MeshStandardMaterial({ map: shojiTex, roughness: 0.95, side: T.DoubleSide })
    ));
    wall.rotation.y = -s * Math.PI / 2;
    wall.position.set(s * HALF_W, 1.35, -ROOM_LEN / 2 + 1);

    // baseboard
    const base = add(new T.Mesh(
      new T.BoxGeometry(0.08, 0.18, ROOM_LEN + 6),
      new T.MeshStandardMaterial({ color: 0x4a3220 })
    ));
    base.position.set(s * (HALF_W - 0.04), 0.09, -ROOM_LEN / 2 + 1);
  }

  const back = add(new T.Mesh(
    new T.PlaneGeometry(HALF_W * 2, 2.7),
    new T.MeshStandardMaterial({ map: fusumaTex, roughness: 0.95 })
  ));
  back.position.set(0, 1.35, -ROOM_LEN - 1.3);

  const behind = add(new T.Mesh(
    new T.PlaneGeometry(HALF_W * 2, 2.7),
    new T.MeshStandardMaterial({ color: 0x2a2030 })
  ));
  behind.rotation.y = Math.PI;
  behind.position.set(0, 1.35, 3.5);

  // pudding on a low table at the end
  const table = add(new T.Group());
  const top = new T.Mesh(
    new T.CylinderGeometry(0.62, 0.62, 0.06, 28),
    new T.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.6 })
  );
  top.position.y = 0.38;
  table.add(top);
  for (const [lx, lz] of [[0.35, 0.35], [-0.35, 0.35], [0.35, -0.35], [-0.35, -0.35]]) {
    const leg = new T.Mesh(
      new T.BoxGeometry(0.06, 0.36, 0.06),
      new T.MeshStandardMaterial({ color: 0x5a3418 })
    );
    leg.position.set(lx, 0.18, lz);
    table.add(leg);
  }
  const plate = new T.Mesh(
    new T.CylinderGeometry(0.2, 0.2, 0.02, 24),
    new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
  );
  plate.position.y = 0.42;
  table.add(plate);
  const pud = new T.Mesh(
    new T.CylinderGeometry(0.1, 0.14, 0.16, 24),
    new T.MeshStandardMaterial({ color: 0xffcc55, roughness: 0.35, emissive: 0x553300, emissiveIntensity: 0.5 })
  );
  pud.position.y = 0.51;
  table.add(pud);
  const caramel = new T.Mesh(
    new T.CylinderGeometry(0.1, 0.1, 0.03, 24),
    new T.MeshStandardMaterial({ color: 0x7a3a12, roughness: 0.3 })
  );
  caramel.position.y = 0.6;
  table.add(caramel);
  table.position.set(0, 0, -ROOM_LEN);


  /* ---------- GRANDPA ---------- */

  const side = Math.random() < 0.5 ? -1 : 1;     // which side the futon is on
  const FUTON = { x: side * 0.5, z: -11, w: 1.35, len: 2.5 };
  const futonBox = {
    x0: FUTON.x - FUTON.w / 2,
    x1: FUTON.x + FUTON.w / 2,
    z0: FUTON.z - FUTON.len / 2,
    z1: FUTON.z + FUTON.len / 2
  };

  const gp = add(new T.Group());
  gp.position.set(FUTON.x, 0, FUTON.z);

  const mat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

  const mattress = new T.Mesh(new T.BoxGeometry(FUTON.w, 0.12, FUTON.len), mat(0xf2eee4));
  mattress.position.y = 0.06;
  gp.add(mattress);

  const pillow = new T.Mesh(new T.BoxGeometry(0.62, 0.12, 0.36), mat(0x8fb8ff));
  pillow.position.set(0, 0.17, FUTON.len / 2 - 0.3);
  gp.add(pillow);

  const blanket = new T.Mesh(new T.BoxGeometry(FUTON.w - 0.1, 0.24, FUTON.len - 0.72), mat(0xd6577a));
  blanket.position.set(0, 0.22, -0.32);
  gp.add(blanket);
  for (let k = 0; k < 3; k++) {
    const stripe = new T.Mesh(new T.BoxGeometry(FUTON.w - 0.08, 0.245, 0.05), mat(0xf6b3c6));
    stripe.position.set(0, 0, -0.5 + k * 0.5);
    blanket.add(stripe);
  }

  // upper body pivots up when he wakes
  const turn = new T.Group();
  turn.position.set(0, 0.2, FUTON.len / 2 - 0.9);
  gp.add(turn);
  const upper = new T.Group();
  turn.add(upper);

  const body = new T.Mesh(new T.BoxGeometry(0.62, 0.22, 0.5), mat(0x6d8fd8));
  body.position.set(0, 0, 0.18);
  upper.add(body);

  const R = 0.27;
  const skin = mat(0xffd3b0);
  const head = new T.Mesh(new T.SphereGeometry(R, 28, 20), skin);
  head.position.set(0, 0.1, 0.62);
  upper.add(head);

  const white = mat(0xffffff);
  const dark = mat(0x3a2418);

  // face looks up (+y). top of head = +z, chin = -z
  for (const s of [-1, 1]) {
    const hair = new T.Mesh(new T.SphereGeometry(0.1, 12, 10), white);
    hair.scale.set(0.8, 1.1, 1.3);
    hair.position.set(s * 0.25, 0.02, 0.02);
    head.add(hair);

    const brow = new T.Mesh(new T.BoxGeometry(0.12, 0.04, 0.035), white);
    brow.position.set(s * 0.1, 0.235, 0.09);
    brow.userData.s = s;
    head.add(brow);
    brow.name = "brow";

    const eye = new T.Mesh(new T.BoxGeometry(0.08, 0.015, 0.018), dark);
    eye.position.set(s * 0.1, 0.255, 0.035);
    eye.name = "eyeClosed";
    head.add(eye);

    const eyeW = new T.Mesh(new T.SphereGeometry(0.045, 12, 10), white);
    eyeW.position.set(s * 0.1, 0.24, 0.035);
    eyeW.visible = false;
    eyeW.name = "eyeOpen";
    const pupil = new T.Mesh(new T.SphereGeometry(0.022, 10, 8), mat(0x111111));
    pupil.position.set(0, 0.03, -0.005);
    eyeW.add(pupil);
    head.add(eyeW);

    const must = new T.Mesh(new T.SphereGeometry(0.08, 12, 10), white);
    must.scale.set(1.3, 0.55, 0.6);
    must.position.set(s * 0.07, 0.235, -0.09);
    must.rotation.y = s * 0.3;
    head.add(must);

    const horn = new T.Mesh(new T.ConeGeometry(0.05, 0.16, 12), mat(0xffd23a));
    horn.rotation.x = Math.PI / 2;
    horn.position.set(s * 0.12, 0.12, 0.27);
    horn.visible = false;
    horn.name = "horn";
    head.add(horn);
  }
  const nose = new T.Mesh(new T.SphereGeometry(0.045, 12, 10), mat(0xffb48a));
  nose.position.set(0, 0.27, -0.02);
  head.add(nose);
  const mouth = new T.Mesh(new T.SphereGeometry(0.06, 12, 10), mat(0x5a0f14));
  mouth.scale.set(1, 0.4, 0.8);
  mouth.position.set(0, 0.22, -0.16);
  mouth.visible = false;
  head.add(mouth);

  const steam = [];
  for (let k = 0; k < 6; k++) {
    const puff = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    puff.visible = false;
    head.add(puff);
    steam.push(puff);
  }

  const headWorld = new T.Vector3();


  /* ---------- TOYS ---------- */

  const toys = [];
  const toyKinds = [
    () => {
      const g = new T.Group();
      const colors = [0xff5a5a, 0x3d8bff, 0xffd23a];
      for (let k = 0; k < 3; k++) {
        const b = new T.Mesh(new T.BoxGeometry(0.16, 0.16, 0.16), mat(colors[k]));
        b.position.set((k - 1) * 0.12, 0.08 + (k === 1 ? 0.16 : 0), (k % 2) * 0.05);
        b.rotation.y = k * 0.4;
        g.add(b);
      }
      return g;
    },
    () => {
      const g = new T.Group();
      const can = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.24, 18), mat(0xc7d2dc, { metalness: 0.6, roughness: 0.3 }));
      can.position.y = 0.12;
      g.add(can);
      const can2 = can.clone();
      can2.rotation.z = Math.PI / 2;
      can2.position.set(0.18, 0.07, 0.08);
      g.add(can2);
      return g;
    },
    () => {
      const g = new T.Group();
      const car = new T.Mesh(new T.BoxGeometry(0.34, 0.1, 0.18), mat(0x2fd66b));
      car.position.y = 0.09;
      g.add(car);
      const cab = new T.Mesh(new T.BoxGeometry(0.16, 0.08, 0.15), mat(0x2fd66b));
      cab.position.set(-0.03, 0.17, 0);
      g.add(cab);
      for (const [wx, wz] of [[0.11, 0.1], [-0.11, 0.1], [0.11, -0.1], [-0.11, -0.1]]) {
        const w = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.03, 12), mat(0x222222));
        w.rotation.x = Math.PI / 2;
        w.position.set(wx, 0.045, wz);
        g.add(w);
      }
      return g;
    }
  ];

  function placeToys() {
    const zs = [];
    for (let tries = 0; tries < 400 && toys.length < toyCount; tries++) {
      const z = -2.6 - Math.random() * (ROOM_LEN - 5);
      const x = (Math.random() * 2 - 1) * (HALF_W - 0.45);
      // not on / right next to the futon
      // keep the way past grandpa clear (the tension there is the noise)
      if (z < futonBox.z1 + 1.1 && z > futonBox.z0 - 1.1) continue;
      if (zs.some(o => Math.abs(o - z) < 1.7)) continue;
      zs.push(z);
      const g = toyKinds[toys.length % toyKinds.length]();
      g.position.set(x, 0, z);
      g.rotation.y = Math.random() * Math.PI;
      add(g);
      toys.push({ x, z, g, hit: false });
    }
  }
  placeToys();


  /* ---------- HELPERS ---------- */

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (active) fn();
    }, ms);
    timers.push(id);
  }

  let popTimer = null;
  function pop(text, kind) {
    popEl.textContent = text;
    popEl.className = `tp-pop show ${kind || ""}`;
    clearTimeout(popTimer);
    popTimer = setTimeout(() => {
      popEl.className = "tp-pop";
    }, 650);
  }

  function showMsg(text, kind = "") {
    msgEl.textContent = text;
    msgEl.className = `tp-msg show ${kind}`;
  }

  function limitNow() {
    return quietSpeed + (snoring ? snoreBonus : 0);
  }

  function setPhase(p) {
    phase = p;
    phaseAt = performance.now();
  }

  function begin() {
    if (phase !== "ready") return;
    setPhase("walk");
    startAt = performance.now();
    hintEl.classList.add("hide");
  }


  /* ---------- INPUT ---------- */

  function onDown(event) {
    if (phase !== "walk" && phase !== "ready") return;
    event.preventDefault();
    stage.setPointerCapture?.(event.pointerId);
    pointer = { id: event.pointerId, x: event.clientX, px };
    holding = true;
    begin();
  }

  function onMove(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const w = stage.clientWidth || 360;
    // slide the finger: half the screen width = the whole room width
    const target = pointer.px + ((event.clientX - pointer.x) / w) * HALF_W * 4;
    moveSideTo(target);
  }

  function onUp(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    pointer = null;
    holding = false;
  }

  const WALK_KEYS = ["ArrowUp", "KeyW", "Space"];

  function onKey(event) {
    const down = event.type === "keydown";
    if (WALK_KEYS.includes(event.code)) {
      event.preventDefault();
      holding = down;
      if (down) begin();
    } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
      event.preventDefault();
      keyLeft = down;
      if (down) begin();
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      event.preventDefault();
      keyRight = down;
      if (down) begin();
    }
  }

  function blockedAt(x, z) {
    const m = 0.28;
    return x > futonBox.x0 - m && x < futonBox.x1 + m && z > futonBox.z0 - m && z < futonBox.z1 + m;
  }

  function moveSideTo(target) {
    const lim = HALF_W - 0.32;
    const x = Math.max(-lim, Math.min(lim, target));
    if (!blockedAt(x, pz)) px = x;
    else {
      // slide up to the edge of the futon
      const m = 0.29;
      px = px < FUTON.x ? Math.min(x, futonBox.x0 - m) : Math.max(x, futonBox.x1 + m);
    }
  }


  /* ---------- GAME LOOP ---------- */

  world.addUpdate((dt, elapsed) => {
    if (!active) return;
    const now = performance.now();

    // grandpa breathing / snoring
    if (phase === "walk" || phase === "ready") {
      snoreLeft -= dt;
      if (snoreLeft <= 0) {
        snoring = !snoring;
        snoreLeft = snoring ? snoreLen * (0.8 + Math.random() * 0.4) : calmLen * (0.7 + Math.random() * 0.6);
      }
      blanket.scale.y = 1 + Math.sin(elapsed * (snoring ? 3.2 : 1.6)) * 0.08;
    }

    if (phase === "walk") {
      // speed
      if (holding) speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
      else speed = Math.max(0, speed - BRAKE * dt);

      if (keyLeft || keyRight) moveSideTo(px + (keyRight - keyLeft) * SIDE_SPEED * dt);

      const nz = pz - speed * dt;
      if (blockedAt(px, nz)) {
        speed = 0;
        if (now - (stage.__bumpAt || 0) > 900) {
          stage.__bumpAt = now;
          pop(t("tp.side"), "warn");
        }
      } else {
        pz = nz;
      }

      // noise
      head.getWorldPosition(headWorld);
      const d = Math.hypot(px - headWorld.x, pz - headWorld.z);
      const near = 1 + 1.3 * Math.max(0, Math.min(1, 1 - (d - 1) / 4));
      const over = speed - limitNow();
      if (over > 0) {
        noise += over * overNoise * near * dt;
      } else {
        noise = Math.max(0, noise - 9 * dt);
      }

      // footsteps
      stepDist += speed * dt;
      if (stepDist > 0.62) {
        stepDist = 0;
        if (over > 0.05) {
          stompCount++;
          pop(t("tp.stomp"), "warn");
          sfx("thud");
        } else {
          sfx("click");
        }
      }

      // toys
      for (const toy of toys) {
        if (toy.hit) continue;
        if (Math.abs(toy.z - pz) < 0.3 && Math.abs(toy.x - px) < 0.42) {
          toy.hit = true;
          toysHit++;
          noise += toyNoise * near;
          shake = 0.6;
          toy.g.rotation.z = 1.2;
          toy.g.position.y = 0.05;
          pop(t("tp.toy"), "bad");
          sfx("crash");
        }
      }

      maxNoise = Math.max(maxNoise, Math.min(WAKE, noise));

      simTime += dt;
      const used = simTime;
      timeEl.textContent = used.toFixed(1);
      leftEl.textContent = `${Math.max(0, Math.ceil(ROOM_LEN - 0.6 + pz))}m`;

      if (noise >= WAKE) {
        wake(false);
      } else if (pz <= -ROOM_LEN + 0.75) {
        gotPudding(used);
      } else if (used >= TIME_LIMIT) {
        wake(true);
      }
    }

    // uneasy grandpa
    const uneasy = phase !== "angry" && noise >= 45;
    if (phase !== "angry") {
      head.rotation.z = uneasy ? Math.sin(elapsed * 9) * 0.12 : 0;
      skin.color.setHex(uneasy ? 0xffbf98 : 0xffd3b0);
    }

    // wake animation
    if (phase === "angry") {
      const k = Math.min(1, (now - phaseAt) / 520);
      // sit up, then turn around to face you
      upper.rotation.x = -1.3 * Math.min(1, k * 1.6);
      turn.rotation.y = faceTo * Math.max(0, Math.min(1, (k - 0.35) / 0.65));
      head.rotation.z = Math.sin(elapsed * 30) * 0.05;
      steam.forEach((p, i) => {
        const q = ((elapsed * 1.4) + i / steam.length) % 1;
        const s = i % 2 ? 1 : -1;
        p.position.set(s * (0.3 + q * 0.2), 0.1 + q * 0.1, 0.25 + q * 0.4);
        p.scale.setScalar(0.6 + q * 1.4);
        p.material.opacity = 0.85 * (1 - q);
      });
    }

    // camera
    bobT += speed * dt * 5.2;
    shake = Math.max(0, shake - dt * 2);
    const angryShake = phase === "angry" ? 0.035 : 0;
    const sk = shake * 0.05 + angryShake;
    camera.position.set(
      px + Math.sin(bobT * 0.5) * 0.03 * Math.min(1, speed) + (Math.random() - 0.5) * sk,
      EYE_Y + Math.abs(Math.sin(bobT)) * 0.045 * Math.min(1.5, speed) + (Math.random() - 0.5) * sk,
      pz
    );
    let lookY = EYE_Y - 0.55;
    let lookX = px * 0.6;
    let lookZ = pz - 4;
    if (phase === "angry") {
      head.getWorldPosition(headWorld);
      lookX = headWorld.x;
      lookY = headWorld.y;
      lookZ = headWorld.z;
    } else if (phase === "got") {
      lookX = 0;
      lookY = 0.4;
      lookZ = -ROOM_LEN;
    }
    camera.lookAt(lookX, lookY, lookZ);

    // HUD
    noiseEl.style.transform = `scaleX(${Math.min(1, noise / WAKE)})`;
    noiseEl.className = noise > 70 ? "hot" : noise > 35 ? "warm" : "";
    noiseNumEl.textContent = `${Math.round(Math.min(100, noise))}%`;
    safeEl.style.width = `${(limitNow() / MAX_SPEED) * 100}%`;
    needleEl.style.left = `${(speed / MAX_SPEED) * 100}%`;
    needleEl.className = speed > limitNow() ? "over" : "";
    stateEl.textContent = snoring ? t("tp.snore") : t("tp.calm");
    stateEl.className = `tp-state ${snoring ? "snore" : ""} ${phase === "angry" || phase === "got" ? "hide" : ""}`;

    // bubble over grandpa
    head.getWorldPosition(headWorld);
    const v = headWorld.clone();
    v.y += 0.45;
    v.project(camera);
    const behind = v.z > 1;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    bubbleEl.style.left = `${(v.x + 1) * 0.5 * w}px`;
    bubbleEl.style.top = `${(1 - v.y) * 0.5 * h}px`;
    let bubble = "";
    if (phase === "angry") bubble = "";
    else if (uneasy) bubble = t("tp.hmm");
    else bubble = snoring ? t("tp.snoreSound") : "Zzz";
    bubbleEl.textContent = bubble;
    bubbleEl.className = `tp-bubble ${behind || !bubble ? "hide" : ""} ${uneasy ? "uneasy" : snoring ? "snore" : ""}`;
  });


  /* ---------- END ---------- */

  function gotPudding(used) {
    setPhase("got");
    holding = false;
    speed = 0;

    // fast: the best time is about walking at the safe speed with snores
    const best = ROOM_LEN / (quietSpeed + snoreBonus * 0.35);
    const slow = best * 2.2;
    const fast = Math.max(0, Math.min(1, (slow - used) / (slow - best)));
    const quiet = 1 - maxNoise / WAKE;
    resultScore = Math.round(Math.max(10, Math.min(100, fast * 60 + quiet * 40)));

    showMsg(`${t("tp.got")}`, "good");
    sfx("good");
    later(() => finish(true, used), 1300);
  }

  function wake(timeUp) {
    setPhase("angry");
    holding = false;
    speed = 0;
    noise = WAKE;
    const progress = Math.max(0, Math.min(1, -pz / ROOM_LEN));

    // turn around toward you (after sitting up he faces his feet)
    const tw = new T.Vector3();
    turn.getWorldPosition(tw);
    faceTo = Math.atan2(-(px - tw.x), -(pz - tw.z));
    resultScore = Math.round(progress * 30);

    skin.color.setHex(0xff4a3a);
    head.traverse(o => {
      if (o.name === "horn" || o.name === "eyeOpen") o.visible = true;
      if (o.name === "eyeClosed") o.visible = false;
      if (o.name === "brow") o.rotation.z = o.userData.s * 0.45;
    });
    mouth.visible = true;
    steam.forEach(p => (p.visible = true));

    showMsg(timeUp ? t("tp.timeUp") : t("tp.angry"), "angry");
    sfx("crash");
    later(() => sfx("bad"), 200);
    later(() => finish(false, simTime), 2300);
  }

  function finish(success, used) {
    if (finished) return;
    finished = true;
    sfx(success && resultScore >= 60 ? "clear" : "fail");

    later(() => {
      onComplete?.({
        score: resultScore,
        adapt: Math.round(Math.max(0, Math.min(100, 30 + (success ? 40 : 0) + (1 - maxNoise / WAKE) * 30))),
        meta: {
          success: success && resultScore >= 60,
          reached: success,
          seconds: Math.round(used * 10) / 10,
          maxNoise: Math.round(maxNoise),
          toys: toysHit,
          stomps: stompCount
        }
      });
    }, 300);
  }


  /* ---------- START ---------- */

  // For automatic tests only (not used by the game)
  stage.__tp = {
    get phase() { return phase; },
    get x() { return px; },
    get z() { return pz; },
    get speed() { return speed; },
    get limit() { return limitNow(); },
    get noise() { return noise; },
    get maxNoise() { return maxNoise; },
    get time() { return simTime; },
    get toysHit() { return toysHit; },
    toys: toys.map(o => ({ x: o.x, z: o.z })),
    futon: futonBox,
    roomLen: ROOM_LEN
  };

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  world.start();

  return () => {
    active = false;
    timers.forEach(clearTimeout);
    clearTimeout(popTimer);
    stage.removeEventListener("pointerdown", onDown);
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerup", onUp);
    stage.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    keep.forEach(o => world.disposeObject(o));
    [floorTex, shojiTex, fusumaTex].forEach(tex => tex.dispose());
    world.destroy();
  };
}
