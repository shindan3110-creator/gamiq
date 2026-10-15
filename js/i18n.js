// GAMIQ（ゲーミック） v2 - Language / Translations
//
// How it works:
// 1. ?lang=ja or ?lang=en in the URL wins (handy for testing).
// 2. Otherwise the browser language is used.
//    Japanese browsers -> "ja", everything else -> "en".
//
// To add a new text:
//   add the same key to BOTH "en" and "ja" below,
//   then use t("your.key") in the code.
//
// To add a new language later (e.g. "ko"):
//   copy the "en" block, rename it to "ko", translate it,
//   and add "ko" to SUPPORTED.

const SUPPORTED = ["en", "ja"];

const STRINGS = {
  en: {
    /* ---------- HEADER ---------- */
    "header.viewResults": "VIEW RESULTS",

    /* ---------- START SCREEN ---------- */
    "start.title": "Unknown games.<br>Real gaming skill.",
    "start.text":
      "Random mini-games, one after another.<br>" +
      "The more you play, the more accurate your GAMIQ gets.",
    "start.play": "PLAY",
    "start.note": "You can't choose the game. Every game is random.",

    /* ---------- GAME CARD ---------- */
    "card.rule": "RULE",
    "card.complete": "COMPLETE",
    "card.nextSwipe": "↑ SWIPE FOR NEXT GAME",
    "card.nextScroll": "🖱️ SCROLL FOR NEXT GAME",
    "card.error": "GAME ERROR",
    "card.errorSwipe": "Swipe to the next game",
    "card.errorScroll": "Scroll to the next game",

    /* ---------- RESULTS ---------- */
    "results.aria": "GAMIQ results",
    "results.current": "CURRENT GAMIQ",
    "results.confidence": "CONFIDENCE",
    "results.played": "PLAYED",
    "results.continue": "KEEP PLAYING",
    "results.next":
      "About {games} more games to reach {target}% confidence",
    "results.enough":
      "Your GAMIQ is well measured. Keep playing to improve it!",

    /* ---------- GAME RULES (key = game id) ---------- */
    "rule.reflex_ninja_counter":
      "HIT THE ENEMY NINJAS. DON'T HIT FRIENDS!",
    "rule.reflex_quick_draw": "WAIT FOR \"DRAW!\" THEN SHOOT FAST!",
    "rule.reflex_lane_panic": "MOVE AWAY FROM THE ⚠ LANE!",
    "rule.reflex_friend_foe": "TAP ONLY THE ENEMY 👾",
    "rule.puzzle_block_escape": "SLIDE THE BLOCKS. GET THE RED ONE OUT!",
    "rule.puzzle_pipe_connect": "ROTATE THE PIPES TO CONNECT THEM!",
    "rule.puzzle_laser_mirror": "TURN THE MIRROR TO HIT THE TARGET!",
    "rule.memory_sequence": "WATCH THE ORDER, THEN TAP IT BACK!",
    "rule.memory_positions": "REMEMBER THE LIT TILES, THEN TAP THEM ALL!",
    "rule.memory_numbers": "REMEMBER THE NUMBERS. TAP 1, 2, 3... IN ORDER!",
    "rule.three_zombie_assault": "SLASH THE ZOMBIES BEFORE THEY REACH YOU!",
    "rule.three_space_blaster": "AIM AND SHOOT DOWN 6 ENEMY SHIPS!",
    "rule.three_lane_dodge": "DODGE AND JUMP FOR 60 SECONDS!",
    "rule.three_factory_rush":
      "Choose gates, grow your army, defeat the enemy!"
  },

  ja: {
    /* ---------- HEADER ---------- */
    "header.viewResults": "結果を見る",

    /* ---------- START SCREEN ---------- */
    "start.title": "未知のゲームで、<br>本当のゲーム力を測れ。",
    "start.text":
      "次々に現れるランダムゲームをプレイ。<br>" +
      "遊ぶほどGAMIQの測定精度が上がります。",
    "start.play": "PLAY",
    "start.note": "ゲームは選べません。何が出るかはランダムです。",

    /* ---------- GAME CARD ---------- */
    "card.rule": "RULE",
    "card.complete": "COMPLETE",
    "card.nextSwipe": "↑ 上にスワイプで次のゲーム",
    "card.nextScroll": "🖱️ スクロールで次のゲーム",
    "card.error": "GAME ERROR",
    "card.errorSwipe": "スワイプして次のゲームへ",
    "card.errorScroll": "スクロールして次のゲームへ",

    /* ---------- RESULTS ---------- */
    "results.aria": "GAMIQの結果",
    "results.current": "CURRENT GAMIQ",
    "results.confidence": "測定精度",
    "results.played": "プレイ数",
    "results.continue": "ゲームを続ける",
    "results.next":
      "あと約{games}ゲームで測定精度{target}%",
    "results.enough":
      "十分な測定データが集まっています。遊ぶほど更新されます！",

    /* ---------- GAME RULES (key = game id) ---------- */
    "rule.reflex_ninja_counter": "敵の忍者だけを叩け！味方は叩くな！",
    "rule.reflex_quick_draw": "「DRAW!」が出た瞬間に撃て！",
    "rule.reflex_lane_panic": "⚠ のレーンから逃げろ！",
    "rule.reflex_friend_foe": "敵 👾 だけをタップしろ！",
    "rule.puzzle_block_escape": "ブロックを動かして、赤いブロックを出口へ！",
    "rule.puzzle_pipe_connect": "パイプを回してつなげろ！",
    "rule.puzzle_laser_mirror": "鏡を回してレーザーを標的に当てろ！",
    "rule.memory_sequence": "光った順番を覚えて、同じ順に押せ！",
    "rule.memory_positions": "光った場所を覚えて、すべて押せ！",
    "rule.memory_numbers": "数字の位置を覚えて、1から順番に押せ！",
    "rule.three_zombie_assault": "迫ってくるゾンビを斬れ！",
    "rule.three_space_blaster": "狙いを定めて敵艦を6機撃ち落とせ！",
    "rule.three_lane_dodge": "60秒間、障害物を避けて走り続けろ！",
    "rule.three_factory_rush": "ゲートを選んで軍団を増やし、敵を倒せ！"
  }
};


function detectLanguage() {
  try {
    const fromUrl =
      new URLSearchParams(window.location.search).get("lang");

    if (SUPPORTED.includes(fromUrl)) {
      return fromUrl;
    }
  } catch (error) {
    // Ignore and fall back to the browser language.
  }

  const browserLanguages =
    navigator.languages?.length
      ? navigator.languages
      : [navigator.language || "en"];

  for (const language of browserLanguages) {
    const short =
      String(language).toLowerCase().split("-")[0];

    if (SUPPORTED.includes(short)) {
      return short;
    }
  }

  return "en";
}


export const LANG = detectLanguage();

document.documentElement.lang = LANG;


/**
 * Get a translated text.
 *
 * t("results.next", { games: 3, target: 60 })
 *   -> "About 3 more games to reach 60% confidence"
 *
 * If a key is missing, English is used.
 * If English is missing too, `fallback` (or the key) is returned.
 */
export function t(key, vars = null, fallback = null) {
  let text =
    STRINGS[LANG]?.[key] ??
    STRINGS.en[key] ??
    fallback ??
    key;

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }

  return text;
}
