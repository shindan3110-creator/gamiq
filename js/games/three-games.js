// GAMIQ（ゲーミック） v2 - 3D / Action Games

import {
  runZombie3D
} from "./zombie-3d.js";

import {
  runSpace3D
} from "./space-3d.js";

import {
  runRace3D
} from "./race-3d.js";

import {
  runFactory3D
} from "./factory-3d.js";

export function createThreeGames() {
  return [
    {
      id: "three_zombie_assault",
      type: "zombie_assault",
      title: "ZOMBIE ASSAULT",
      rule: "迫ってくるゾンビを倒せ",
      skill: "SPEED",
      theme: "zombie",
      duration: 10000
    },

    {
      id: "three_space_blaster",
      type: "space_blaster",
      title: "SPACE BLASTER",
      rule: "敵艦を狙って撃ち落とせ",
      skill: "AIM",
      theme: "space",
      duration: 10000
    },

    {
      id: "three_lane_dodge",
      type: "lane_dodge",
      title: "HIGHWAY DODGE",
      rule: "障害物を避け続けろ",
      skill: "REFLEX",
      theme: "race",
      duration: 10000
    },

    {
      id: "three_factory_rush",
      type: "factory_rush",
      title: "FACTORY RUSH",
      rule: "ラインを止めずに処理しろ",
      skill: "SPEED",
      theme: "factory",
      duration: 10000
    }
  ];
}


export function runThreeGame({
  game,
  container,
  onComplete
}) {
  if (!game || !container) {
    return () => {};
  }

  switch (game.type) {
    case "zombie_assault":
  return runZombie3D({
    container,
    onComplete
  });

    case "space_blaster":
  return runSpace3D({
    container,
    onComplete
  });

    case "lane_dodge":
  return runRace3D({
    container,
    onComplete
  });

    case "factory_rush":
  return runFactory3D({
    container,
    onComplete
  });

    default:
      return () => {};
  }
}





/* ==========================================
UTIL
========================================== */

function randomLane() {
  return Math.floor(
    Math.random() * 3
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
