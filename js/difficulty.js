// GAMIQ（ゲーミック） v2 - Difficulty by Level
//
// Lv1  = the normal difficulty (same as before levels existed)
// Lv1-5 = goes up gently.
// Lv6-10 = "HELL ZONE": goes past the old Lv10 values
//          (Lv8 is about the old Lv10, Lv10 is 1.6x further).
//
// Usage in a game:
//   const d = levelFactor(level);            // 0 at Lv1 ... 1.6 at Lv10
//   const showMs = byLevel(level, 850, 560); // 850ms at Lv1 -> 560ms at "old Lv10"
//   Values can go past the Lv10 number, so games clamp where needed.

export const MAX_DIFFICULTY_LEVEL = 10;

export function safeLevel(level) {
  const number = Math.floor(Number(level));

  if (!Number.isFinite(number)) {
    return 1;
  }

  return Math.max(1, Math.min(MAX_DIFFICULTY_LEVEL, number));
}

// How far along the difficulty is at each level.
// 1.0 = the old Lv10. Lv6+ goes beyond it.
const LEVEL_CURVE = [0, 0.1, 0.2, 0.3, 0.42, 0.62, 0.85, 1.08, 1.32, 1.6];

export function levelFactor(level) {
  return LEVEL_CURVE[safeLevel(level) - 1];
}

// Value at Lv1 -> value at "old Lv10" (goes further at Lv8-10)
export function byLevel(level, atLevel1, atLevel10) {
  const t = levelFactor(level);

  return atLevel1 + (atLevel10 - atLevel1) * t;
}

// Same, rounded to a whole number
export function byLevelInt(level, atLevel1, atLevel10) {
  return Math.round(byLevel(level, atLevel1, atLevel10));
}
