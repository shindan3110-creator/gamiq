// GAMIQ（ゲーミック） v2 - Tower Stack
//
// TOWER STACK
// - A block slides left and right above the tower.
// - Tap to drop it. The part that hangs over the edge is cut off.
// - Drop it right on top = PERFECT (no cut).
// - Miss the tower completely = it falls, game over.
// - Stack 12 blocks to clear.
// - Level: faster slide, narrower start, stricter PERFECT.

import { t } from "../i18n.js";
import { byLevel } from "../difficulty.js";
import { sfx } from "../sound.js";

export function createTowerGames() {
  return [
    {
      id: "aim_tower_stack",
      type: "tower_stack",
      title: "TOWER STACK",
      rule: "TAP TO DROP THE BLOCK. STACK 12 WITHOUT MISSING!",
      skill: "AIM",
      theme: "tower",
      duration: 25000
    }
  ];
}

export function runTowerGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  if (game.type === "tower_stack") {
    return runTowerStack({
      container,
      onComplete,
      level: game.level
    });
  }

  return () => {};
}


const TARGET_BLOCKS = 12;
const IDLE_DROP_MS = 4000;

function runTowerStack({
  container,
  onComplete,
  level = 1
}) {
  /*
   * DIFFICULTY BY LEVEL (all in "share of the stage width")
   *   slide speed:  0.55 -> 0.85 width per second (+ a bit per block)
   *   first block:  60% -> 48% of the width
   *   PERFECT zone: 1.6% -> 1.0% of the width
   */
  const speedStart = byLevel(level, 0.55, 0.85);
  const speedStep = byLevel(level, 0.035, 0.06);
  const startWidth = byLevel(level, 0.6, 0.48);
  const perfectZone = byLevel(level, 0.016, 0.01);

  let active = true;
  let frameId = null;
  let finishTimer = null;
  let lastTime = performance.now();

  let placed = 0;
  let perfects = 0;
  let combo = 0;
  let movingSince = 0;

  // Everything in "share of width" (0..1), drawn in %.
  const stack = [{ x: (1 - startWidth) / 2, w: startWidth }];

  let moving = null; // { x, w, dir }


  container.innerHTML = `
    <div class="tw-game">

      <div class="tw-hud">
        <div>
          <span>BLOCKS</span>
          <strong data-tw-count>0 / ${TARGET_BLOCKS}</strong>
        </div>

        <div>
          <span>PERFECT</span>
          <strong data-tw-perfect>0</strong>
        </div>
      </div>

      <div class="tw-stage" data-tw-stage>
        <div class="tw-sky" data-tw-sky></div>

        <div class="tw-world" data-tw-world>
          <div class="tw-ground"></div>
        </div>

        <div class="tw-pop" data-tw-pop></div>
        <div class="tw-hint">${t("tower.hint")}</div>
      </div>

    </div>
  `;

  const stage = container.querySelector("[data-tw-stage]");
  const world = container.querySelector("[data-tw-world]");
  const sky = container.querySelector("[data-tw-sky]");
  const popEl = container.querySelector("[data-tw-pop]");
  const countEl = container.querySelector("[data-tw-count]");
  const perfectEl = container.querySelector("[data-tw-perfect]");


  /* ---------- DRAWING ---------- */

  function blockHeight() {
    // A block is about 1/11 of the stage height.
    return Math.max(18, Math.min(34, stage.clientHeight / 11));
  }

  function colorFor(index) {
    const hue = (200 + index * 17) % 360;
    return `hsl(${hue} 80% 60%)`;
  }

  function makeBlockElement(block, index) {
    const el = document.createElement("div");

    el.className = "tw-block";
    el.style.left = `${block.x * 100}%`;
    el.style.width = `${block.w * 100}%`;
    el.style.bottom = `${index * blockHeight()}px`;
    el.style.height = `${blockHeight()}px`;
    el.style.setProperty("--c", colorFor(index));

    world.appendChild(el);

    return el;
  }

  function updateCamera() {
    const h = blockHeight();
    const top = (stack.length + 1) * h;

    // Keep the moving block at about 55% height.
    const shift = Math.max(0, top - stage.clientHeight * 0.55);

    world.style.transform = `translateY(${shift}px)`;

    // Sky gets darker / more colorful as you go up.
    sky.style.setProperty("--height", String(Math.min(1, stack.length / TARGET_BLOCKS)));
  }

  stack.forEach((block, i) => {
    block.el = makeBlockElement(block, i);
    block.el.classList.add("base");
  });


  /* ---------- MOVING BLOCK ---------- */

  function spawnMoving() {
    const top = stack[stack.length - 1];

    const fromLeft = stack.length % 2 === 0;

    moving = {
      x: fromLeft ? 0 : 1 - top.w,
      w: top.w,
      dir: fromLeft ? 1 : -1
    };

    moving.el = makeBlockElement(moving, stack.length);
    moving.el.classList.add("moving");

    movingSince = performance.now();

    updateCamera();
  }

  function frame(now) {
    if (!active) {
      return;
    }

    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (moving) {
      advance(dt);

      moving.el.style.left = `${moving.x * 100}%`;

      // Waiting too long: it falls by itself.
      if (now - movingSince > IDLE_DROP_MS) {
        drop(true);
      }
    }

    frameId = requestAnimationFrame(frame);
  }


  // Move the block by dt seconds (bounces at both sides).
  function advance(dt) {
    const speed = speedStart + placed * speedStep;

    moving.x += moving.dir * speed * dt;

    if (moving.x <= 0) {
      moving.x = 0;
      moving.dir = 1;
    }

    if (moving.x >= 1 - moving.w) {
      moving.x = 1 - moving.w;
      moving.dir = -1;
    }
  }


  /* ---------- DROP ---------- */

  function pop(text, type) {
    popEl.textContent = text;
    popEl.className = `tw-pop ${type}`;

    void popEl.offsetWidth;

    popEl.classList.add("show");
  }

  function fallingPiece(x, w, index, side) {
    const piece = makeBlockElement({ x, w }, index);

    piece.classList.add("falling", side);

    setTimeout(() => piece.remove(), 900);
  }

  function drop(tooSlow = false) {
    if (!active || !moving) {
      return;
    }

    const top = stack[stack.length - 1];
    const index = stack.length;

    // Exact position at the moment of the tap (not the last frame),
    // so fast blocks are still fair.
    const now = performance.now();
    advance(Math.min(0.05, (now - lastTime) / 1000));
    lastTime = now;

    const x = moving.x;
    const w = moving.w;

    const offset = x - top.x;

    const left = Math.max(x, top.x);
    const right = Math.min(x + w, top.x + top.w);
    const overlap = right - left;

    moving.el.remove();
    moving = null;

    // Missed completely: it falls, game over.
    if (overlap <= 0 || tooSlow) {
      fallingPiece(x, w, index, offset >= 0 ? "right" : "left");

      sfx("bad");
      pop(tooSlow ? t("tower.tooSlow") : t("tower.miss"), "bad");
      stage.classList.add("shake");

      finish(false);
      return;
    }

    let block;

    if (Math.abs(offset) <= perfectZone) {
      // PERFECT: snaps right on top, nothing is cut.
      block = { x: top.x, w: top.w };

      perfects++;
      combo++;

      sfx("perfect");
      pop(combo >= 2 ? `PERFECT x${combo}` : "PERFECT!", "perfect");
    } else {
      block = { x: left, w: overlap };

      combo = 0;

      // The part that hung over the edge falls off.
      if (offset > 0) {
        fallingPiece(right, x + w - right, index, "right");
      } else {
        fallingPiece(x, left - x, index, "left");
      }

      sfx("wood");

      const kept = overlap / w;
      pop(kept > 0.85 ? t("tower.great") : t("tower.ok"), "good");
    }

    block.el = makeBlockElement(block, index);
    block.el.classList.add("landed");

    stack.push(block);
    placed++;

    countEl.textContent = `${placed} / ${TARGET_BLOCKS}`;
    perfectEl.textContent = String(perfects);

    if (placed >= TARGET_BLOCKS) {
      updateCamera();
      pop(t("tower.clear"), "perfect");
      finish(true);
      return;
    }

    spawnMoving();
  }

  function onTap(event) {
    event.preventDefault();
    drop(false);
  }

  function onKey(event) {
    if ((event.code === "Space" || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      drop(false);
    }
  }


  /* ---------- FINISH ---------- */

  function finish(cleared) {
    if (!active) {
      return;
    }

    active = false;

    cancelAnimationFrame(frameId);

    const heightRate = placed / TARGET_BLOCKS;

    // How wide is the top compared to the start? (keeping width = precision)
    const widthRate = stack[stack.length - 1].w / startWidth;

    const perfectRate = placed > 0 ? perfects / placed : 0;

    const score = clamp(
      heightRate * 55 +
      (placed > 0 ? widthRate * 30 : 0) +
      perfectRate * 15,
      0,
      100
    );

    finishTimer = setTimeout(() => {
      onComplete?.({
        score: Math.round(score),

        adapt: Math.round(
          clamp(35 + heightRate * 35 + widthRate * 20 + perfectRate * 10, 0, 100)
        ),

        meta: {
          success: cleared,
          placed,
          perfects,
          topWidth: Math.round(stack[stack.length - 1].w * 1000) / 10
        }
      });
    }, cleared ? 900 : 1100);
  }


  /* ---------- START ---------- */

  stage.addEventListener("pointerdown", onTap);
  window.addEventListener("keydown", onKey);

  // Wait one frame so the stage has its real size.
  requestAnimationFrame(() => {
    if (!active) return;

    // Re-place the base now that the height is known.
    stack[0].el.style.height = `${blockHeight()}px`;

    spawnMoving();

    lastTime = performance.now();
    frameId = requestAnimationFrame(frame);
  });


  return () => {
    active = false;

    cancelAnimationFrame(frameId);
    clearTimeout(finishTimer);

    stage.removeEventListener("pointerdown", onTap);
    window.removeEventListener("keydown", onKey);
  };
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
