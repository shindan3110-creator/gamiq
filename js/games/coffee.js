// GAMIQ（ゲーミック） v2 - Hand Drip Coffee (3D)
//
// HAND DRIP (AIM)
// - A dripper with coffee grounds, a glass server below, a kettle above.
// - HOLD to pour hot water. The kettle follows your finger (a little slowly).
// - The kettle tilts by itself from how you move:
//   slow = thin, steady water (good). Fast = the kettle tips, water gushes out
//   (the dripper fills up and can overflow).
// - A glowing dot shows where to pour: it starts in the CENTER and goes
//   round and round slowly (like the letter "の"). The dot only moves
//   while you pour. Follow it!
// - At the end the server reaches the line and "STOP!" appears: let go.
//   Pour too long = the dripper overflows.
// - Score: following the dot (70) + stopping in time (30).
// - Higher level: the dot moves faster with more turns, smaller "good" area,
//   less time to stop. Lv6+: the path is hidden (only the dot).

import { GamiqThreeScene } from "./three-renderer.js";
import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createCoffeeGames() {
  return [
    {
      id: "aim_hand_drip",
      type: "hand_drip",
      title: "HAND DRIP",
      rule: "HOLD TO POUR. FOLLOW THE GLOWING DOT FROM THE CENTER. LET GO AT STOP!",
      skill: "AIM",
      theme: "cafe",
      duration: 30000,
      // 3D games run slower on weak phones; the safety timer gets extra room.
      maxDuration: 150000
    }
  ];
}

export function runCoffeeGame({ game, container, onComplete }) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "hand_drip") {
    return runHandDrip({ container, onComplete, level: game.level });
  }

  return () => {};
}


/* ==========================================
GAME
========================================== */

const BED_Y = 0.0;           // coffee bed height
const BED_R = 0.8;           // coffee bed radius
const FILTER_R = 0.72;       // pouring further out hits the filter paper
const RIM_Y = 0.28;          // dripper rim
const SERVER_BOTTOM = -2.12;
const SERVER_H = 1.25;       // liquid height when full
const TARGET = 0.78;         // the line on the server (part of SERVER_H)
const TIME_LIMIT = 35;       // seconds
const TOUCH_LIFT = 70;       // px: on phones the water lands above your finger

async function runHandDrip({ container, onComplete, level = 1 }) {
  /*
   * DIFFICULTY BY LEVEL
   *   pouring time (dot speed): 12s (Lv1) -> 8.5s (old Lv10), min 7s
   *   turns of the "の": 2 -> 3.2 (max 4)
   *   "good" area: 0.13 -> 0.08 (min 0.06)
   *   time to stop after STOP: 1.6s -> 1.0s (min 0.7s)
   *   Lv6+ (hell zone): the path is hidden, only the dot
   */
  const pathSec = Math.max(7, byLevel(level, 12, 8.5));
  const turns = Math.min(4, byLevel(level, 2, 3.2));
  const tolGood = Math.max(0.06, byLevel(level, 0.13, 0.08));
  const overflowSec = Math.max(0.7, byLevel(level, 1.6, 1.0));
  const showPath = level < 6;
  const bufferCap = Math.max(0.24, byLevel(level, 0.42, 0.3));
  const pathR = 0.52;
  // the dot's speed; moving much faster than this tips the kettle
  const okSpeed = ((pathR * Math.PI * 2 * turns) / pathSec) * 1.5 + 0.2;

  let active = true;
  let finished = false;
  let phase = "ready";       // ready / pour / stop / done / overflow
  let s = 0;                 // how far along the path (0..1) = how much poured
  let over = 0;              // seconds poured after STOP
  let drained = 0;           // what has dripped into the server (0..1)
  let poured = 0;            // water poured (thick water = more)
  let tilt = 0;              // 0 = thin stream, 1 = gushing
  let moveSpeed = 0;
  let lastAimX = 0;
  let lastAimZ = 0;
  let thickTime = 0;
  let pouring = false;
  let holding = false;
  let accSum = 0;
  let accTime = 0;
  let goodTime = 0;
  let elapsed = 0;
  let stopScore = 0;
  let resultScore = 0;
  let statusKey = "";
  let timers = [];
  let aimX = 0;
  let aimZ = 0;
  let tipX = 0;
  let tipZ = 0;
  let hasAim = false;

  container.innerHTML = `
    <div class="be-game cf-game">
      <div class="be-hud">
        <div>
          <span>TIME</span>
          <strong data-cf-time>0.0</strong>
        </div>
        <div>
          <span>POUR</span>
          <strong data-cf-pour>0%</strong>
        </div>
        <div>
          <span>ACCURACY</span>
          <strong data-cf-acc>—</strong>
        </div>
      </div>

      <div class="cf-stage" data-cf-stage>
        <div class="cf-world" data-cf-world></div>
        <div class="cf-tip" data-cf-tip>${t("cf.hint")}</div>
        <div class="cf-line-label" data-cf-line>${t("cf.target")}</div>
        <div class="cf-done" data-cf-done></div>
      </div>
    </div>
  `;

  const stage = container.querySelector("[data-cf-stage]");
  const worldEl = container.querySelector("[data-cf-world]");
  const timeEl = container.querySelector("[data-cf-time]");
  const pourEl = container.querySelector("[data-cf-pour]");
  const accEl = container.querySelector("[data-cf-acc]");
  const tipEl = container.querySelector("[data-cf-tip]");
  const lineEl = container.querySelector("[data-cf-line]");
  const doneEl = container.querySelector("[data-cf-done]");

  const world = new GamiqThreeScene({ container: worldEl, cameraZ: 4, background: 0x2a1d16 });
  const ok = await world.init();
  if (!ok) {
    throw new Error("3D unavailable");
  }

  const T = world.THREE;
  const scene = world.scene;
  const camera = world.camera;
  camera.fov = 42;
  camera.near = 0.1;
  camera.far = 40;
  world.renderer.shadowMap.enabled = false;

  const keep = [];
  function add(obj, parent = scene) {
    parent.add(obj);
    if (parent === scene) keep.push(obj);
    return obj;
  }
  const mat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: 0.6, ...extra });


  /* ---------- TEXTURES ---------- */

  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    draw(g, w, h);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return { tex, g, c };
  }

  const tableTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#6b4426";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(40,20,8,${0.12 + Math.random() * 0.15})`;
      g.lineWidth = 1 + Math.random() * 2;
      const y = Math.random() * h;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 3);
      g.stroke();
    }
  });
  tableTex.tex.wrapS = tableTex.tex.wrapT = T.RepeatWrapping;
  tableTex.tex.repeat.set(3, 3);

  // coffee grounds; wet spots are painted where the water lands
  const bed = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#8a5a33";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(60,35,18,.55)" : "rgba(170,120,75,.45)";
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  let bedDirty = 0;

  function wetAt(x, z, strength) {
    const u = (x / BED_R) * 0.5 + 0.5;
    const v = (z / BED_R) * 0.5 + 0.5;
    const px = u * 256;
    const py = v * 256;
    const grad = bed.g.createRadialGradient(px, py, 0, px, py, 26);
    grad.addColorStop(0, `rgba(40,20,8,${0.16 * strength})`);
    grad.addColorStop(1, "rgba(40,20,8,0)");
    bed.g.fillStyle = grad;
    bed.g.fillRect(px - 28, py - 28, 56, 56);
    bedDirty++;
  }


  /* ---------- SCENE ---------- */

  const table = add(new T.Mesh(new T.PlaneGeometry(14, 14), mat(0xffffff, { map: tableTex.tex, roughness: 0.8 })));
  table.rotation.x = -Math.PI / 2;
  table.position.y = SERVER_BOTTOM - 0.06;

  // glass server
  const glass = add(new T.Mesh(
    new T.CylinderGeometry(0.86, 0.8, SERVER_H + 0.25, 40, 1, true),
    new T.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.14, roughness: 0.05, side: T.DoubleSide, depthWrite: false })
  ));
  glass.position.y = SERVER_BOTTOM + (SERVER_H + 0.25) / 2;
  const glassRim = add(new T.Mesh(new T.TorusGeometry(0.86, 0.025, 8, 40), mat(0xe8f6ff, { transparent: true, opacity: 0.6 })));
  glassRim.rotation.x = Math.PI / 2;
  glassRim.position.y = SERVER_BOTTOM + SERVER_H + 0.25;
  const glassBase = add(new T.Mesh(new T.CylinderGeometry(0.82, 0.82, 0.05, 40), mat(0xdff4ff, { transparent: true, opacity: 0.35 })));
  glassBase.position.y = SERVER_BOTTOM + 0.02;

  const liquid = add(new T.Mesh(
    new T.CylinderGeometry(0.79, 0.77, 1, 40),
    new T.MeshStandardMaterial({ color: 0x5a2c12, roughness: 0.2, emissive: 0x2a1006, emissiveIntensity: 0.6 })
  ));
  liquid.visible = false;

  const lineY = SERVER_BOTTOM + 0.05 + SERVER_H * TARGET;
  const targetRing = add(new T.Mesh(new T.TorusGeometry(0.865, 0.018, 8, 48), new T.MeshBasicMaterial({ color: 0xff4d6d })));
  targetRing.rotation.x = Math.PI / 2;
  targetRing.position.y = lineY;

  // dripper (ceramic cone) + filter paper
  const dripper = add(new T.Mesh(
    new T.CylinderGeometry(1.06, 0.4, 0.95, 48, 1, true),
    mat(0xf7f5f0, { side: T.DoubleSide, roughness: 0.35 })
  ));
  dripper.position.y = RIM_Y - 0.475;
  const rim = add(new T.Mesh(new T.TorusGeometry(1.06, 0.045, 10, 48), mat(0xf7f5f0, { roughness: 0.35 })));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = RIM_Y;
  const plate = add(new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 0.06, 48), mat(0xf0ede6, { roughness: 0.35 })));
  plate.position.y = RIM_Y - 0.97;

  const filter = add(new T.Mesh(
    new T.CylinderGeometry(1.0, 0.38, 0.98, 48, 1, true),
    mat(0xf2e6cc, { side: T.DoubleSide, roughness: 0.9 })
  ));
  filter.position.y = RIM_Y - 0.43;

  const bedMesh = add(new T.Mesh(new T.CircleGeometry(BED_R, 48), mat(0xffffff, { map: bed.tex, roughness: 0.95 })));
  bedMesh.rotation.x = -Math.PI / 2;
  bedMesh.position.y = BED_Y;

  // water pooling in the dripper (rises when you pour too much)
  const pool = add(new T.Mesh(
    new T.CircleGeometry(1, 48),
    new T.MeshStandardMaterial({ color: 0x6b3a1a, transparent: true, opacity: 0.0, roughness: 0.1 })
  ));
  pool.rotation.x = -Math.PI / 2;

  const spill = add(new T.Mesh(new T.TorusGeometry(1.08, 0.06, 8, 48), mat(0x6b3a1a, { transparent: true, opacity: 0.9 })));
  spill.rotation.x = Math.PI / 2;
  spill.position.y = RIM_Y + 0.02;
  spill.visible = false;


  /* ---------- GUIDE ("の") ---------- */

  function pathAt(u) {
    // from the center, out and back in, round and round
    const r = pathR * Math.sin(Math.PI * Math.min(1, u) * 0.92 + 0.0) * (u < 0.04 ? u / 0.04 : 1);
    const a = -Math.PI / 2 + turns * Math.PI * 2 * u;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  }

  const dots = [];
  if (showPath) {
    const dotGeo = new T.CircleGeometry(0.022, 10);
    const n = Math.round(70 * turns);
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = pathAt(u);
      const d = new T.Mesh(dotGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
      d.rotation.x = -Math.PI / 2;
      d.position.set(p.x, BED_Y + 0.008, p.z);
      add(d);
      dots.push({ u, d });
    }
  }

  const guide = add(new T.Mesh(new T.SphereGeometry(0.06, 18, 12), new T.MeshBasicMaterial({ color: 0x5fefff })));
  const guideRing = add(new T.Mesh(new T.RingGeometry(0.09, 0.12, 32), new T.MeshBasicMaterial({ color: 0x5fefff, transparent: true, opacity: 0.8, side: T.DoubleSide })));
  guideRing.rotation.x = -Math.PI / 2;

  const aimRing = add(new T.Mesh(new T.RingGeometry(0.05, 0.075, 28), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: T.DoubleSide })));
  aimRing.rotation.x = -Math.PI / 2;
  aimRing.visible = false;


  /* ---------- KETTLE + WATER ---------- */

  const kettle = add(new T.Group());
  const steel = mat(0x2e2f33, { metalness: 0.6, roughness: 0.35 });
  const body = new T.Mesh(new T.CylinderGeometry(0.34, 0.42, 0.55, 32), steel);
  body.position.set(0.95, 0.45, -0.2);
  kettle.add(body);
  const lid = new T.Mesh(new T.CylinderGeometry(0.2, 0.26, 0.08, 24), steel);
  lid.position.set(0.95, 0.76, -0.2);
  kettle.add(lid);
  const knob = new T.Mesh(new T.SphereGeometry(0.06, 12, 10), mat(0x8a5a33));
  knob.position.set(0.95, 0.83, -0.2);
  kettle.add(knob);
  const handle = new T.Mesh(new T.TorusGeometry(0.26, 0.04, 8, 24, Math.PI * 1.2), mat(0x8a5a33));
  handle.position.set(1.4, 0.5, -0.2);
  handle.rotation.z = -Math.PI * 0.6;
  kettle.add(handle);
  const spoutCurve = new T.CatmullRomCurve3([
    new T.Vector3(0.65, 0.3, -0.12),
    new T.Vector3(0.38, 0.42, -0.05),
    new T.Vector3(0.15, 0.3, 0.0),
    new T.Vector3(0.0, 0.0, 0.0)
  ]);
  const spout = new T.Mesh(new T.TubeGeometry(spoutCurve, 24, 0.035, 10), steel);
  kettle.add(spout);

  const stream = add(new T.Mesh(
    new T.CylinderGeometry(0.022, 0.016, 1, 10, 1, true),
    new T.MeshStandardMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.75, roughness: 0.05, emissive: 0x335566, emissiveIntensity: 0.4 })
  ));
  stream.visible = false;

  const ripples = [];
  for (let i = 0; i < 6; i++) {
    const r = add(new T.Mesh(new T.RingGeometry(0.05, 0.07, 28), new T.MeshBasicMaterial({ color: 0xf0d6b0, transparent: true, opacity: 0, side: T.DoubleSide })));
    r.rotation.x = -Math.PI / 2;
    ripples.push({ m: r, t: 1 });
  }
  let rippleTimer = 0;

  const drops = [];
  for (let i = 0; i < 5; i++) {
    const d = add(new T.Mesh(new T.SphereGeometry(0.03, 8, 6), mat(0x3b1f0f)));
    d.visible = false;
    drops.push({ m: d, y: 0, on: false });
  }
  let dropTimer = 0;

  const steamPuffs = [];
  for (let i = 0; i < 8; i++) {
    const p = add(new T.Mesh(new T.SphereGeometry(0.09, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })));
    steamPuffs.push({ m: p, t: Math.random() });
  }


  /* ---------- CAMERA ---------- */

  const camTarget = new T.Vector3(0, -0.55, 0);
  const camDir = new T.Vector3(0, 0.66, 0.75).normalize();

  function placeCamera() {
    const w = stage.clientWidth || 360;
    const h = stage.clientHeight || 480;
    const aspect = w / h;
    const vf = T.MathUtils.degToRad(camera.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * aspect);
    const dist = Math.max(2.45 / Math.tan(hf) * 0.5 + 1.1, 3.6 / Math.tan(vf) * 0.5 + 0.6);
    camera.position.copy(camTarget).addScaledVector(camDir, dist);
    camera.lookAt(camTarget);
  }


  /* ---------- HELPERS ---------- */

  function later(fn, ms) {
    const id = setTimeout(() => {
      if (active) fn();
    }, ms);
    timers.push(id);
  }

  function setStatus(key, kind = "") {
    if (statusKey === key + kind) return;
    statusKey = key + kind;
    tipEl.textContent = t(key);
    tipEl.className = `cf-tip ${kind}`;
  }

  const raycaster = new T.Raycaster();
  const bedPlane = new T.Plane(new T.Vector3(0, 1, 0), -BED_Y);
  const hitVec = new T.Vector3();
  const ndc = new T.Vector2();

  function aimFromEvent(event) {
    const rect = stage.getBoundingClientRect();
    const lift = event.pointerType === "touch" ? TOUCH_LIFT : 0;
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - lift - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(bedPlane, hitVec)) return;
    const r = Math.hypot(hitVec.x, hitVec.z);
    const max = 1.0;
    const k = r > max ? max / r : 1;
    aimX = hitVec.x * k;
    aimZ = hitVec.z * k;
    if (!hasAim) {
      tipX = aimX;
      tipZ = aimZ;
      hasAim = true;
    }
  }

  function toScreen(x, y, z) {
    const v = new T.Vector3(x, y, z).project(camera);
    const rect = stage.getBoundingClientRect();
    return { x: rect.left + (v.x + 1) * 0.5 * rect.width, y: rect.top + (1 - v.y) * 0.5 * rect.height };
  }


  /* ---------- INPUT ---------- */

  let pointerId = null;

  function onDown(event) {
    if (phase === "done" || phase === "overflow") return;
    event.preventDefault();
    pointerId = event.pointerId;
    stage.setPointerCapture?.(event.pointerId);
    aimFromEvent(event);
    holding = true;
    if (phase === "ready") phase = "pour";
  }

  function onMove(event) {
    if (pointerId !== null && event.pointerId !== pointerId) return;
    aimFromEvent(event);
  }

  function onUp(event) {
    if (pointerId !== null && event.pointerId !== pointerId) return;
    pointerId = null;
    holding = false;
    if (phase === "stop") finishPour(false);
  }


  /* ---------- LOOP ---------- */

  world.addUpdate((dt, time) => {
    if (!active) return;
    placeCamera();

    // the kettle follows a bit slowly: moving fast spills off the dot
    const follow = 1 - Math.exp(-dt * 7);
    tipX += (aimX - tipX) * follow;
    tipZ += (aimZ - tipZ) * follow;

    // how fast you move -> how much the kettle tips (automatic)
    if (dt > 0) {
      const v = Math.hypot(aimX - lastAimX, aimZ - lastAimZ) / dt;
      moveSpeed += (v - moveSpeed) * Math.min(1, dt * 6);
    }
    lastAimX = aimX;
    lastAimZ = aimZ;
    const want = Math.max(0, Math.min(1, (moveSpeed - okSpeed) / (okSpeed * 1.6)));
    tilt += (want - tilt) * Math.min(1, dt * (want > tilt ? 5 : 2.5));
    const flow = 1 + tilt * 2.2;

    pouring = holding && (phase === "pour" || phase === "stop");

    if (phase === "pour" || phase === "stop") {
      elapsed += dt;
      timeEl.textContent = elapsed.toFixed(1);
    }

    const g = pathAt(s);

    if (pouring) {
      const d = Math.hypot(tipX - g.x, tipZ - g.z);
      const r = Math.hypot(tipX, tipZ);

      if (phase === "pour") {
        s = Math.min(1, s + dt / pathSec);

        let close = d < tolGood ? 1 : Math.max(0, 1 - (d - tolGood) / 0.3);
        if (tilt > 0.35) close *= 0.5;
        if (r > FILTER_R) {
          close = 0;
          setStatus("cf.filter", "bad");
        } else if (tilt > 0.35) {
          thickTime += dt;
          setStatus("cf.thick", "bad");
        } else if (d < tolGood * 1.4) {
          setStatus("cf.good", "good");
        } else {
          setStatus("cf.follow", "warn");
        }
        accSum += close * dt;
        accTime += dt;
        if (d < tolGood) goodTime += dt;

        if (s >= 1) {
          phase = "stop";
          setStatus("cf.stop", "stop");
          sfx("tick");
        }
      } else {
        over += dt;
        if (over >= overflowSec) overflow();
      }

      poured += (flow * dt) / pathSec;
      if (r <= BED_R) wetAt(tipX, tipZ, flow);
    }

    if (elapsed >= TIME_LIMIT && phase === "pour") finishPour(true);

    // HUD
    pourEl.textContent = `${Math.round(s * 100)}%`;
    accEl.textContent = accTime > 0.3 ? `${Math.round((accSum / accTime) * 100)}%` : "—";

    // guide dot
    const gp = pathAt(s);
    guide.position.set(gp.x, BED_Y + 0.06, gp.z);
    guideRing.position.set(gp.x, BED_Y + 0.01, gp.z);
    const pulse = 1 + Math.sin(time * 6) * 0.15;
    guideRing.scale.setScalar(pulse);
    const stopNow = phase === "stop" || phase === "overflow";
    guide.material.color.setHex(stopNow ? 0xff4d6d : 0x5fefff);
    guideRing.material.color.setHex(stopNow ? 0xff4d6d : 0x5fefff);
    guide.visible = guideRing.visible = phase !== "done";
    for (const o of dots) {
      o.d.material.opacity = o.u < s ? 0.12 : 0.75;
    }

    // kettle + stream
    const lift = pouring ? 0.95 : 1.25;
    kettle.position.x += (tipX - kettle.position.x) * 0.5;
    kettle.position.z += (tipZ - kettle.position.z) * 0.5;
    kettle.position.y += (BED_Y + lift - kettle.position.y) * Math.min(1, dt * 8);
    kettle.rotation.z += ((pouring ? 0.2 + tilt * 0.35 : 0) - kettle.rotation.z) * Math.min(1, dt * 8);
    kettle.visible = hasAim || phase !== "ready";
    if (!hasAim) {
      kettle.position.set(0.25, BED_Y + 1.25, 0.25);
    }

    aimRing.visible = hasAim && !pouring && phase !== "done" && phase !== "overflow";
    aimRing.position.set(tipX, BED_Y + 0.012, tipZ);

    stream.visible = pouring;
    if (pouring) {
      const top = kettle.position.y - 0.02;
      const len = top - BED_Y;
      const thick = 1 + tilt * 2.2;
      stream.scale.set(thick * (1 + Math.sin(time * 40) * 0.08), len, thick);
      stream.position.set(kettle.position.x, BED_Y + len / 2, kettle.position.z);

      rippleTimer -= dt;
      if (rippleTimer <= 0) {
        rippleTimer = 0.12 / (1 + tilt * 2);
        const rp = ripples.find(o => o.t >= 1);
        if (rp) {
          rp.t = 0;
          rp.m.position.set(tipX, BED_Y + 0.014, tipZ);
        }
      }
    }
    for (const rp of ripples) {
      if (rp.t >= 1) {
        rp.m.material.opacity = 0;
        continue;
      }
      rp.t = Math.min(1, rp.t + dt * 1.8);
      rp.m.scale.setScalar((1 + rp.t * 3) * (1 + tilt));
      rp.m.material.opacity = 0.7 * (1 - rp.t);
    }

    // drip into the server
    const drainSpeed = 0.85 / pathSec;
    drained = Math.min(poured, drained + drainSpeed * dt);
    const buffer = Math.max(0, poured - drained);

    const level = Math.min(1.12, drained) * SERVER_H * TARGET;
    liquid.visible = level > 0.01;
    liquid.scale.y = Math.max(0.001, level);
    liquid.position.y = SERVER_BOTTOM + 0.05 + level / 2;

    dropTimer -= dt;
    if (buffer > 0.01 && dropTimer <= 0) {
      dropTimer = 0.18;
      const dr = drops.find(o => !o.on);
      if (dr) {
        dr.on = true;
        dr.y = RIM_Y - 1.0;
        dr.m.visible = true;
      }
    }
    for (const dr of drops) {
      if (!dr.on) continue;
      dr.y -= dt * 3.2;
      dr.m.position.set(0, dr.y, 0);
      if (dr.y < SERVER_BOTTOM + 0.05 + level) {
        dr.on = false;
        dr.m.visible = false;
      }
    }

    // water pooling in the dripper
    const extra = over / overflowSec;
    const fill = buffer / bufferCap + extra;
    const poolY = BED_Y + 0.02 + Math.min(1, fill) * (RIM_Y - BED_Y);
    if (fill >= 1 && (phase === "pour" || phase === "stop")) overflow();
    const coneR = 0.4 + ((poolY - (RIM_Y - 0.95)) / 0.95) * 0.64;
    pool.position.y = poolY;
    pool.scale.setScalar(Math.max(0.1, coneR));
    pool.material.opacity = Math.min(0.85, 0.15 + fill * 0.8) * (buffer > 0.005 || extra > 0 ? 1 : 0);

    // steam
    for (const p of steamPuffs) {
      p.t += dt * 0.5;
      if (p.t > 1) {
        p.t = 0;
        p.m.position.set((Math.random() - 0.5) * 0.8, BED_Y + 0.1, (Math.random() - 0.5) * 0.8);
      }
      p.m.position.y += dt * 0.5;
      p.m.scale.setScalar(0.6 + p.t * 1.4);
      p.m.material.opacity = (pouring || buffer > 0.02 ? 0.22 : 0.08) * Math.sin(Math.PI * p.t);
    }

    if (bedDirty > 3) {
      bed.tex.needsUpdate = true;
      bedDirty = 0;
    }

    // "LINE" label next to the line on the server
    const lp = toScreen(0.9, lineY, 0.2);
    const rect = stage.getBoundingClientRect();
    lineEl.style.left = `${lp.x - rect.left}px`;
    lineEl.style.top = `${lp.y - rect.top}px`;
  });


  /* ---------- END ---------- */

  function finishPour(timeUp) {
    if (phase === "done" || phase === "overflow") return;
    const wasStop = phase === "stop";
    phase = "done";
    holding = false;
    setStatus("cf.done", "good");

    // stopping: let go within 0.3s after STOP = full points
    if (wasStop && !timeUp) {
      stopScore = Math.round(30 * Math.max(0, Math.min(1, 1 - (over - 0.3) / (overflowSec - 0.3))));
    } else {
      stopScore = 0;
    }

    const acc = accTime > 0 ? accSum / accTime : 0;
    resultScore = Math.round(Math.max(0, Math.min(100, acc * 70 * s + stopScore)));

    const perfect = resultScore >= 90;
    doneEl.textContent = timeUp ? t("cf.finish") : perfect ? t("cf.perfect") : t("cf.done");
    doneEl.className = `cf-done show ${perfect ? "perfect" : ""}`;
    sfx(resultScore >= 60 ? "good" : "thud");

    later(() => finish(), 1600);
  }

  function overflow() {
    if (phase === "overflow") return;
    phase = "overflow";
    holding = false;
    spill.visible = true;
    stopScore = 0;
    const acc = accTime > 0 ? accSum / accTime : 0;
    resultScore = Math.round(Math.max(0, acc * 70 * s - 15));
    setStatus("cf.overflow", "bad");
    doneEl.textContent = t("cf.overflow");
    doneEl.className = "cf-done show bad";
    sfx("bad");
    later(() => finish(), 1700);
  }

  function finish() {
    if (finished) return;
    finished = true;
    const acc = accTime > 0 ? accSum / accTime : 0;
    sfx(resultScore >= 60 ? "clear" : "fail");
    later(() => {
      onComplete?.({
        score: resultScore,
        adapt: Math.round(Math.max(0, Math.min(100, 30 + acc * 50 + (stopScore / 30) * 20))),
        meta: {
          success: resultScore >= 60 && phase !== "overflow",
          accuracy: Math.round(acc * 100),
          good: Math.round(accTime > 0 ? (goodTime / accTime) * 100 : 0),
          stop: stopScore,
          overflow: phase === "overflow",
          thick: Math.round(thickTime * 10) / 10,
          elapsed: Math.round(elapsed * 10) / 10
        }
      });
    }, 300);
  }


  /* ---------- START ---------- */

  // For automatic tests only (not used by the game)
  stage.__cf = {
    get phase() { return phase; },
    get s() { return s; },
    get score() { return resultScore; },
    get tilt() { return tilt; },
    guideScreen() {
      const p = pathAt(s);
      return toScreen(p.x, BED_Y, p.z);
    }
  };

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);

  placeCamera();
  world.start();

  return () => {
    active = false;
    timers.forEach(clearTimeout);
    stage.removeEventListener("pointerdown", onDown);
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerup", onUp);
    stage.removeEventListener("pointercancel", onUp);
    keep.forEach(o => world.disposeObject(o));
    [tableTex.tex, bed.tex].forEach(tex => tex.dispose());
    world.destroy();
  };
}
