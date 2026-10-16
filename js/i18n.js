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
    /* ---------- PAGE (browser tab / search results) ---------- */
    "meta.title": "GAMIQ | Random Mini-Games That Measure Your Gaming Skill",
    "meta.description":
      "GAMIQ is a free browser game. Play random mini-games one after another " +
      "and measure your gaming skill across REFLEX, SPEED, AIM, LOGIC, MEMORY and ADAPT.",

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
    "results.clears": "CLEARS",
    "results.clearRate": "CLEAR RATE",
    "results.bestStreak": "BEST STREAK",
    "results.playTime": "PLAY TIME",
    "time.seconds": "{s}s",
    "time.minutes": "{m}m",
    "time.hours": "{h}h {m}m",
    "results.next":
      "About {games} more games to reach {target}% confidence",
    "results.enough":
      "Your GAMIQ is well measured. Keep playing to improve it!",

    /* ---------- IN-GAME: MEMORY ---------- */
    "memory.watch": "WATCH",
    "memory.yourTurn": "YOUR TURN",
    "memory.remember": "REMEMBER",
    "memory.select": "SELECT",
    "memory.tapInOrder": "TAP 1 → 2 → 3...",

    /* ---------- IN-GAME: BLOCK ESCAPE ---------- */
    "block.hintClick": "Click a block, then click an arrow to move it",
    "block.hintSwipe": "Swipe the blocks. Get the red one out to the right!",
    "block.moveLeft": "Move left",
    "block.moveRight": "Move right",
    "block.moveUp": "Move up",
    "block.moveDown": "Move down",
    "block.targetLabel": "Red escape block",
    "block.blockLabel": "Block {id}",

    /* ---------- GAME RULES (key = game id) ---------- */
    "rule.reflex_ninja_counter":
      "HIT THE ENEMY NINJAS. DON'T HIT FRIENDS!",
    "rule.reflex_quick_draw": "WAIT FOR \"DRAW!\" THEN SHOOT FAST!",
    "rule.reflex_lane_panic": "GET TO THE ONLY LANE WITHOUT ⚠!",
    "rule.reflex_friend_foe": "SHOOT THE RED ENEMIES. DON'T HIT BLUE FRIENDS!",
    "rule.puzzle_block_escape": "SLIDE THE BLOCKS. GET THE RED ONE OUT!",
    "rule.puzzle_pipe_connect": "TAP TO ROTATE. CONNECT IN → OUT!",
    "rule.puzzle_laser_mirror": "TURN THE MIRROR TO HIT THE TARGET!",
    "rule.memory_sequence": "WATCH THE ORDER, THEN TAP IT BACK!",
    "rule.memory_positions": "REMEMBER THE LIT TILES, THEN TAP THEM ALL!",
    "rule.memory_numbers": "REMEMBER THE NUMBERS. TAP 1, 2, 3... IN ORDER!",
    "rule.three_zombie_assault": "SLASH THE ZOMBIES BEFORE THEY REACH YOU!",
    "rule.three_space_blaster": "AIM AND SHOOT DOWN 6 ENEMY SHIPS!",
    "rule.three_lane_dodge": "DODGE AND JUMP FOR 60 SECONDS!",
    "rule.three_factory_rush":
      "Choose gates, grow your army, defeat the enemy!",
    "rule.speed_color_switch":
      "MATCH THE COLOR OR THE WORD. WATCH FOR THE SWITCH!",

    /* ---------- IN-GAME: COLOR SWITCH ---------- */
    "cs.modeColor": "TAP THE INK COLOR",
    "cs.modeWord": "TAP WHAT THE WORD SAYS",
    "color.red": "RED",
    "color.blue": "BLUE",
    "color.green": "GREEN",
    "color.yellow": "YELLOW",

    /* ---------- BULLSEYE ---------- */
    "rule.aim_bullseye":
      "HIT THE CENTER BEFORE THE TARGET SHRINKS AWAY!",
    "be.tooSlow": "TOO SLOW"
  },

  ja: {
    /* ---------- PAGE (browser tab / search results) ---------- */
    "meta.title": "GAMIQ（ゲーミック）｜未知のゲームで本当のゲーム力を測る",
    "meta.description":
      "GAMIQ（ゲーミック）は、次々に現れるランダムなミニゲームをプレイして、" +
      "REFLEX・SPEED・AIM・LOGIC・MEMORY・ADAPTからゲーム力を測る無料ゲームです。",

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
    "results.clears": "クリア数",
    "results.clearRate": "クリア率",
    "results.bestStreak": "最長連続クリア",
    "results.playTime": "プレイ時間",
    "time.seconds": "{s}秒",
    "time.minutes": "{m}分",
    "time.hours": "{h}時間{m}分",
    "results.next":
      "あと約{games}ゲームで測定精度{target}%",
    "results.enough":
      "十分な測定データが集まっています。遊ぶほど更新されます！",

    /* ---------- IN-GAME: MEMORY ---------- */
    "memory.watch": "見て覚えろ",
    "memory.yourTurn": "あなたの番",
    "memory.remember": "覚えろ",
    "memory.select": "押せ！",
    "memory.tapInOrder": "1 → 2 → 3… の順に押せ",

    /* ---------- IN-GAME: BLOCK ESCAPE ---------- */
    "block.hintClick": "ブロックをクリック → 矢印をクリックして移動",
    "block.hintSwipe": "ブロックをスワイプして、赤いブロックを右へ",
    "block.moveLeft": "左へ移動",
    "block.moveRight": "右へ移動",
    "block.moveUp": "上へ移動",
    "block.moveDown": "下へ移動",
    "block.targetLabel": "赤い脱出ブロック",
    "block.blockLabel": "ブロック {id}",

    /* ---------- GAME RULES (key = game id) ---------- */
    "rule.reflex_ninja_counter": "敵の忍者だけを叩け！味方は叩くな！",
    "rule.reflex_quick_draw": "「DRAW!」が出た瞬間に撃て！",
    "rule.reflex_lane_panic": "⚠ のない、ただ1つの安全なレーンへ逃げろ！",
    "rule.reflex_friend_foe": "赤い敵だけを撃て！青い味方は撃つな！",
    "rule.puzzle_block_escape": "ブロックを動かして、赤いブロックを出口へ！",
    "rule.puzzle_pipe_connect": "タップで回転。IN から OUT までつなげ！",
    "rule.puzzle_laser_mirror": "鏡を回してレーザーを標的に当てろ！",
    "rule.memory_sequence": "光った順番を覚えて、同じ順に押せ！",
    "rule.memory_positions": "光った場所を覚えて、すべて押せ！",
    "rule.memory_numbers": "数字の位置を覚えて、1から順番に押せ！",
    "rule.three_zombie_assault": "迫ってくるゾンビを斬れ！",
    "rule.three_space_blaster": "狙いを定めて敵艦を6機撃ち落とせ！",
    "rule.three_lane_dodge": "60秒間、障害物を避けて走り続けろ！",
    "rule.three_factory_rush": "ゲートを選んで軍団を増やし、敵を倒せ！",
    "rule.speed_color_switch": "文字の「色」か「意味」に合わせて押せ！切り替えに注意！",

    /* ---------- IN-GAME: COLOR SWITCH ---------- */
    "cs.modeColor": "文字の「色」を押せ",
    "cs.modeWord": "文字の「意味」を押せ",
    "color.red": "あか",
    "color.blue": "あお",
    "color.green": "みどり",
    "color.yellow": "きいろ",

    /* ---------- BULLSEYE ---------- */
    "rule.aim_bullseye": "的が小さくなって消える前に、ど真ん中を撃ち抜け！",
    "be.tooSlow": "おそい！"
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


/* ==========================================
PAGE TITLE / DESCRIPTION
(index.html has English by default; switch for other languages)
========================================== */

try {
  document.title = t("meta.title");

  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", t("meta.description"));
} catch (error) {
  // Never stop the game because of the page title.
}
