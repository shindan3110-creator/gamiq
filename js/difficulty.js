// GAMIQ（ゲーミック） v2 - Difficulty by Level
//
// Lv1  = the normal difficulty (same as before levels existed)
// Lv10 = the hardest
// In between it goes up evenly.
//
// Usage in a game:
//   const d = levelFactor(level);          // 0 at Lv1 ... 1 at Lv10
//   const showMs = byLevel(level, 850, 560); // 850ms at Lv1 -> 560ms at Lv10

export const MAX_DIFFICULTY_LEVEL = 10;

export function safeLevel(level) {
  const number = Math.floor(Number(level));

  if (!Number.isFinite(number)) {
    return 1;
  }

  return Math.max(1, Math.min(MAX_DIFFICULTY_LEVEL, number));
}

// 0 at Lv1, 1 at Lv10
export function levelFactor(level) {
  return (safeLevel(level) - 1) / (MAX_DIFFICULTY_LEVEL - 1);
}

// Value at Lv1 -> value at Lv10 (straight line)
export function byLevel(level, atLevel1, atLevel10) {
  const t = levelFactor(level);

  return atLevel1 + (atLevel10 - atLevel1) * t;
}

// Same, rounded to a whole number
export function byLevelInt(level, atLevel1, atLevel10) {
  return Math.round(byLevel(level, atLevel1, atLevel10));
}
