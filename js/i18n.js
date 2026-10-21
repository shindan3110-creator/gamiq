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
    "header.level": "LV",

    /* ---------- START SCREEN ---------- */
    "start.title": "Unknown games.<br>Real gaming skill.",
    "start.text":
      "Random mini-games, one after another.<br>" +
      "The more you play, the more accurate your GAMIQ gets.",
    "start.play": "PLAY",
    "start.note": "You can't choose the game. Every game is random.",

    /* ---------- DAILY CHALLENGE ---------- */
    "daily.button": "📅 DAILY CHALLENGE #{n}",
    "daily.buttonResume": "📅 CONTINUE DAILY ({i}/{n})",
    "daily.buttonDone": "📅 TODAY'S DAILY: {total} pts — SEE RESULT",
    "daily.short": "DAILY",
    "daily.kicker": "DAILY CHALLENGE",
    "daily.title": "DAILY #{n}",
    "daily.text": "Today's 5 games are the same for everyone in the world. Same games, same layouts. How do you compare?",
    "daily.rule1": "One game from each genre. Difficulty: Lv{level} for everyone.",
    "daily.rule2": "One try per day. If you leave in the middle, that game is 0.",
    "daily.rule3": "Does not change your GAMIQ or level.",
    "daily.go": "START",
    "daily.resume": "CONTINUE (GAME {i} / {n})",
    "daily.next": "NEXT GAME ▶",
    "daily.finish": "SEE RESULT ▶",
    "daily.finishSwipe": "↑ SWIPE TO SEE YOUR RESULT",
    "daily.finishScroll": "🖱️ SCROLL TO SEE YOUR RESULT",
    "daily.quit": "QUIT?",
    "daily.total": "TOTAL SCORE",
    "daily.share": "SHARE RESULT",
    "daily.copied": "COPIED!",
    "daily.copyFailed": "COULD NOT COPY",
    "daily.back": "BACK",
    "daily.nextIn": "Next daily in {time}",
    "daily.newReady": "A new daily is ready! Close and open again.",
    "daily.rank": "Daily ranking: {rank}",
    "daily.rankSending": "Sending your result to the ranking...",
    "daily.rankFailed": "Couldn't reach the ranking. It will be sent next time you open this.",
    "daily.rankButton": "🏆 DAILY RANKING",
    "daily.shareText": "🎮 GAMIQ Daily #{n}\nScore: {total} / {max}\n\n{squares}\n\nSame 5 games for everyone today. What's your score?\n{url}",

    /* ---------- NICKNAME ---------- */
    "nick.label": "NICKNAME",
    "nick.placeholder": "Your name for the ranking",
    "nick.errorShort": "Use at least 2 characters.",
    "nick.errorLong": "Use 12 characters or less.",
    "nick.errorChars": "Only letters, numbers, space, _ - . can be used.",
    "nick.errorBlocked": "This nickname can't be used. Try another one.",

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
    "results.level": "LEVEL",
    "results.toLevelUp":
      "{games} more games to fix your Lv {level} GAMIQ",
    "results.history": "TODAY'S LEVELS",
    "results.resetNote": "Records reset every day at 0:00 UTC.",

    /* ---------- TITLES ---------- */
    "title.rookie": "ROOKIE",
    "title.player": "PLAYER",
    "title.skilled": "SKILLED",
    "title.pro": "PRO GAMER",
    "title.elite": "ELITE",
    "title.master": "MASTER",
    "title.legend": "LEGEND",

    /* ---------- SHARE ---------- */
    "share.button": "SHARE IMAGE",
    "share.today": "TODAY",
    "share.topPercent": "TOP {p}%",
    "share.rankOf": "#{rank} of {total} players",
    "share.noRank": "not ranked yet",
    "share.line1": "🎮 My GAMIQ is {gamiq} — {title}",
    "share.line1NoTitle": "🎮 My GAMIQ is {gamiq}",
    "share.line2": "Level {level} · Today's ranking: {rank}",
    "skillName.REFLEX": "REFLEX",
    "skillName.SPEED": "SPEED",
    "skillName.AIM": "AIM",
    "skillName.LOGIC": "LOGIC",
    "skillName.MEMORY": "MEMORY",
    "share.line3": "Can you beat me? Random mini-games measure your real gaming skill.",
    "share.footer": "Random mini-games. Real gaming skill.",
    "share.downloaded": "Image saved and text copied. Paste it anywhere!",
    "share.failed": "Couldn't share. Please try again.",
    "share.copy": "COPY",
    "share.copied": "COPIED!",
    "share.other": "OTHER",

    /* ---------- RANKING ---------- */
    "rank.title": "RANKING",
    "rank.close": "Close",
    "rank.today": "TODAY",
    "rank.allTime": "ALL-TIME",
    "rank.dailyNote": "Today's best scores. Resets in {time} (0:00 UTC).",
    "rank.allTimeNote": "Each player's best single day.",
    "rank.loading": "Loading...",
    "rank.error": "Couldn't load the ranking. Please try again later.",
    "rank.empty": "No scores yet. Be the first!",
    "rank.you": "YOU",
    "rank.notYet": "Play 5 games to get on today's ranking.",
    "rank.formula": "SCORE = GAMIQ × (1 + 0.15 × (Lv − 1))",
    "rank.challenge": "DAILY",
    "rank.challengeNote": "Today's Daily Challenge (first try only). Resets in {time}.",
    "rank.challengeFormula": "SCORE = total of the 5 games (max 500)",
    "rank.challengeNotYet": "Finish today's Daily Challenge to get on this ranking.",
    "rank.hoursMinutes": "{h}h {m}m",
    "rank.minutes": "{m}m",

    /* ---------- LEVEL UP ---------- */
    "levelup.title": "LEVEL {level} CLEAR!",
    "levelup.next": "NEXT: LV {level} — measuring starts again",
    "levelup.max": "MAX LEVEL! Measuring again at Lv 10",

    /* ---------- IN-GAME: MEMORY ---------- */
    "memory.watch": "WATCH",
    "memory.yourTurn": "YOUR TURN",
    "memory.remember": "REMEMBER",
    "memory.select": "SELECT",
    "memory.tapInOrder": "TAP 1 → 2 → 3...",
    "ghost.watch": "WHERE ARE THE GHOSTS?",
    "ghost.find": "FIND THE GHOSTS!",

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
    "rule.reflex_lane_panic": "SPIKES ARE FALLING! MOVE THE CAT TO THE SAFE LANE!",
    "rule.reflex_friend_foe": "SHOOT THE RED ENEMIES. DON'T HIT BLUE FRIENDS!",
    "rule.puzzle_block_escape": "SLIDE THE BLOCKS. GET THE RED ONE OUT!",
    "rule.puzzle_pipe_connect": "TAP TO ROTATE. CONNECT IN → OUT!",
    "rule.puzzle_laser_mirror": "TURN THE MIRROR TO HIT THE TARGET!",
    "rule.memory_sequence": "WATCH THE ORDER, THEN TAP IT BACK!",
    "rule.memory_positions": "REMEMBER WHERE THE GHOSTS HIDE, THEN FIND THEM ALL!",
    "rule.memory_numbers": "REMEMBER THE NUMBERS. TAP 1, 2, 3... IN ORDER!",
    "rule.three_zombie_assault": "SLASH THE ZOMBIES BEFORE THEY REACH YOU!",
    "rule.three_space_blaster": "AIM AND SHOOT DOWN 6 ENEMY SHIPS!",
    "rule.three_lane_dodge": "DODGE AND JUMP FOR 40 SECONDS!",
    "rule.three_factory_rush":
      "PICK THE BETTER GATES AND WIN ALL 3 BATTLES!",
    "rule.speed_color_switch":
      "MATCH THE COLOR OR THE WORD. WATCH FOR THE SWITCH!",
    "rule.rhythm_drum_duo":
      "LISTEN TO THE MASTER, THEN DRUM THE SAME RHYTHM!",
    "rule.spot_difference":
      "FIND ALL THE DIFFERENCES BEFORE TIME RUNS OUT!",
    "rule.memory_cup_shuffle": "FOLLOW THE CUP WITH THE BALL!",
    "rule.aim_tower_stack": "TAP TO DROP THE BLOCK. STACK 12 WITHOUT MISSING!",
    "rule.logic_odd_one_out": "ONE IS DIFFERENT. FIND IT FAST!",

    /* ---------- IN-GAME: ODD ONE OUT ---------- */
    "odd.hint": "TAP THE ONE THAT IS DIFFERENT",
    "odd.found": "FOUND IT!",
    "odd.wrong": "WRONG! -1.5s",
    "odd.timeUp": "TIME UP! {n} FOUND",

    /* ---------- IN-GAME: BLIND STOP ---------- */
    "rule.reflex_blind_stop": "STOP THE WATCH EXACTLY ON TIME. THE NUMBERS WILL VANISH!",
    "sw.wait": "WAIT...",
    "sw.ready": "READY...",
    "sw.next": "NEXT ROUND",
    "sw.done": "FINISH!",
    "sw.timeout": "TOO LATE!",

    /* ---------- IN-GAME: EGG SMASH ---------- */
    "rule.speed_egg_smash": "TAP LIKE CRAZY! SMASH AS MANY EGGS AS YOU CAN!",
    "egg.hint": "TAP TAP TAP!",
    "egg.timeUp": "TIME UP! {n} EGGS",

    /* ---------- IN-GAME: TOWER STACK ---------- */
    "tower.hint": "TAP ANYWHERE (or SPACE) TO DROP",
    "tower.great": "GREAT!",
    "tower.ok": "OK",
    "tower.miss": "MISSED!",
    "tower.tooSlow": "TOO SLOW!",
    "tower.clear": "TOWER COMPLETE!",

    /* ---------- IN-GAME: CUP SHUFFLE ---------- */
    "cups.watch": "WATCH THE BALL...",
    "cups.shuffle": "SHUFFLE!",
    "cups.pick": "WHERE IS THE BALL?",
    "cups.right": "FOUND IT!",
    "cups.wrong": "WRONG CUP!",
    "cups.tooSlow": "TOO SLOW!",

    /* ---------- IN-GAME: SPOT IT ---------- */
    "spot.hint": "Find {n} differences! Tap either picture.",
    "spot.wrong": "WRONG! -2s",
    "spot.clear": "ALL FOUND!",
    "spot.timeUp": "TIME UP",

    /* ---------- IN-GAME: DRUM DUO ---------- */
    "rhythm.ready": "READY...",
    "rhythm.listen": "LISTEN...",
    "rhythm.yourTurn": "YOUR TURN!",
    "rhythm.tap": "TAP! (or SPACE)",
    "rhythm.early": "EARLY",
    "rhythm.late": "LATE",
    "rhythm.extra": "WAIT!",

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
    "header.level": "LV",

    /* ---------- START SCREEN ---------- */
    "start.title": "未知のゲームで、<br>本当のゲーム力を測れ。",
    "start.text":
      "次々に現れるランダムゲームをプレイ。<br>" +
      "遊ぶほどGAMIQの測定精度が上がります。",
    "start.play": "PLAY",
    "start.note": "ゲームは選べません。何が出るかはランダムです。",

    /* ---------- DAILY CHALLENGE ---------- */
    "daily.button": "📅 デイリーチャレンジ #{n}",
    "daily.buttonResume": "📅 デイリーの続き（{i}/{n}）",
    "daily.buttonDone": "📅 今日のデイリー：{total}点（結果を見る）",
    "daily.short": "デイリー",
    "daily.kicker": "DAILY CHALLENGE",
    "daily.title": "デイリー #{n}",
    "daily.text": "今日の5ゲームは、世界中のみんなと同じ。同じゲーム・同じ配置で勝負！",
    "daily.rule1": "各ジャンルから1つずつ。難易度は全員 Lv{level}。",
    "daily.rule2": "挑戦は1日1回。途中でやめると、そのゲームは0点。",
    "daily.rule3": "いつものGAMIQやレベルには影響しません。",
    "daily.go": "スタート",
    "daily.resume": "続きから（{i} / {n} ゲーム目）",
    "daily.next": "次のゲームへ ▶",
    "daily.finish": "結果を見る ▶",
    "daily.finishSwipe": "↑ 上にスワイプで結果を見る",
    "daily.finishScroll": "🖱️ スクロールで結果を見る",
    "daily.quit": "やめる？",
    "daily.total": "合計スコア",
    "daily.share": "結果をシェア",
    "daily.copied": "コピーしました！",
    "daily.copyFailed": "コピーできませんでした",
    "daily.back": "もどる",
    "daily.nextIn": "次のデイリーまで {time}",
    "daily.newReady": "新しいデイリーが始まりました！閉じて開き直してね",
    "daily.rank": "デイリーランキング：{rank}",
    "daily.rankSending": "ランキングに結果を送っています…",
    "daily.rankFailed": "ランキングに送れませんでした。次に開いたときにもう一度送ります。",
    "daily.rankButton": "🏆 デイリーランキング",
    "daily.shareText": "🎮 GAMIQ デイリー #{n}\nスコア：{total}点 / {max}点\n\n{squares}\n\n今日の5ゲームは全員同じ。君は何点？\n{url}",

    /* ---------- NICKNAME ---------- */
    "nick.label": "ニックネーム",
    "nick.placeholder": "ランキングに表示される名前",
    "nick.errorShort": "2文字以上で入力してください。",
    "nick.errorLong": "12文字以内で入力してください。",
    "nick.errorChars": "文字・数字・スペース・_ - . のみ使えます。",
    "nick.errorBlocked": "このニックネームは使えません。別の名前にしてください。",

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
    "results.level": "レベル",
    "results.toLevelUp":
      "あと{games}ゲームで Lv{level} のGAMIQが確定",
    "results.history": "今日のレベル記録",
    "results.resetNote": "記録は毎日 日本時間9:00（UTC 0:00）にリセットされます。",

    /* ---------- TITLES ---------- */
    "title.rookie": "ROOKIE",
    "title.player": "PLAYER",
    "title.skilled": "SKILLED",
    "title.pro": "PRO GAMER",
    "title.elite": "ELITE",
    "title.master": "MASTER",
    "title.legend": "LEGEND",

    /* ---------- SHARE ---------- */
    "share.button": "画像でシェア",
    "share.today": "今日",
    "share.topPercent": "上位{p}%",
    "share.rankOf": "{total}人中 {rank}位",
    "share.noRank": "ランキング外",
    "share.line1": "🎮 私のGAMIQは {gamiq}（{title}）",
    "share.line1NoTitle": "🎮 私のGAMIQは {gamiq}",
    "share.line2": "レベル{level}・今日のランキング：{rank}",
    "skillName.REFLEX": "反射",
    "skillName.SPEED": "スピード",
    "skillName.AIM": "エイム",
    "skillName.LOGIC": "ロジック",
    "skillName.MEMORY": "記憶",
    "share.line3": "ランダムなミニゲームで本当のゲーム力を測定。君は超えられる？",
    "share.footer": "未知のゲームで、本当のゲーム力を測れ。",
    "share.downloaded": "画像を保存し、文章をコピーしました。好きな場所に貼り付けてください！",
    "share.failed": "シェアできませんでした。もう一度お試しください。",
    "share.copy": "コピー",
    "share.copied": "コピーしました！",
    "share.other": "その他",

    /* ---------- RANKING ---------- */
    "rank.title": "ランキング",
    "rank.close": "閉じる",
    "rank.today": "今日",
    "rank.allTime": "全期間",
    "rank.dailyNote": "今日の最高スコア。あと{time}でリセット（日本時間9:00）。",
    "rank.allTimeNote": "各プレイヤーの「1日の最高スコア」で比べています。",
    "rank.loading": "読み込み中…",
    "rank.error": "ランキングを読み込めませんでした。時間をおいて試してください。",
    "rank.empty": "まだ記録がありません。一番乗りを目指そう！",
    "rank.you": "あなた",
    "rank.notYet": "5ゲーム遊ぶと今日のランキングに載ります。",
    "rank.formula": "スコア = GAMIQ ×（1 + 0.15 ×（Lv − 1））",
    "rank.challenge": "デイリー",
    "rank.challengeNote": "今日のデイリーチャレンジ（1回目の結果のみ）。あと{time}でリセット。",
    "rank.challengeFormula": "スコア = 5ゲームの合計（500点満点）",
    "rank.challengeNotYet": "今日のデイリーチャレンジを最後まで遊ぶと載ります。",
    "rank.hoursMinutes": "{h}時間{m}分",
    "rank.minutes": "{m}分",

    /* ---------- LEVEL UP ---------- */
    "levelup.title": "LEVEL {level} クリア！",
    "levelup.next": "次は Lv{level}：測定精度0%から再スタート",
    "levelup.max": "最高レベル到達！Lv10で再測定します",

    /* ---------- IN-GAME: MEMORY ---------- */
    "memory.watch": "見て覚えろ",
    "memory.yourTurn": "あなたの番",
    "memory.remember": "覚えろ",
    "memory.select": "押せ！",
    "memory.tapInOrder": "1 → 2 → 3… の順に押せ",
    "ghost.watch": "おばけはどこ？",
    "ghost.find": "おばけを見つけろ！",

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
    "rule.reflex_lane_panic": "トゲが落ちてくる！ネコを安全なレーンへ逃がせ！",
    "rule.reflex_friend_foe": "赤い敵だけを撃て！青い味方は撃つな！",
    "rule.puzzle_block_escape": "ブロックを動かして、赤いブロックを出口へ！",
    "rule.puzzle_pipe_connect": "タップで回転。IN から OUT までつなげ！",
    "rule.puzzle_laser_mirror": "鏡を回してレーザーを標的に当てろ！",
    "rule.memory_sequence": "光った順番を覚えて、同じ順に押せ！",
    "rule.memory_positions": "おばけが隠れた場所を覚えて、全部見つけろ！",
    "rule.memory_numbers": "数字の位置を覚えて、1から順番に押せ！",
    "rule.three_zombie_assault": "迫ってくるゾンビを斬れ！",
    "rule.three_space_blaster": "狙いを定めて敵艦を6機撃ち落とせ！",
    "rule.three_lane_dodge": "40秒間、障害物を避けて走り続けろ！",
    "rule.three_factory_rush": "良いゲートを選んで軍団を増やし、3回の戦いに勝ち抜け！",
    "rule.speed_color_switch": "文字の「色」か「意味」に合わせて押せ！切り替えに注意！",
    "rule.rhythm_drum_duo": "師匠のリズムを聴いて、同じリズムで叩け！",
    "rule.spot_difference": "時間内に、まちがいを全部見つけろ！",
    "rule.memory_cup_shuffle": "ボールの入ったカップを目で追え！",
    "rule.aim_tower_stack": "タップでブロックを落とせ！ズレずに12段積み上げろ！",
    "rule.logic_odd_one_out": "1つだけ違うものがある。すばやく見つけろ！",

    /* ---------- IN-GAME: ODD ONE OUT ---------- */
    "odd.hint": "1つだけ違うものをタップ！",
    "odd.found": "見つけた！",
    "odd.wrong": "ちがう！ -1.5秒",
    "odd.timeUp": "タイムアップ！ {n}個 見つけた",

    /* ---------- IN-GAME: BLIND STOP ---------- */
    "rule.reflex_blind_stop": "目標の秒数ぴったりで止めろ！途中から数字が消えるぞ！",
    "sw.wait": "まって…",
    "sw.ready": "よーい…",
    "sw.next": "次のラウンド",
    "sw.done": "おわり！",
    "sw.timeout": "遅すぎ！",

    /* ---------- IN-GAME: EGG SMASH ---------- */
    "rule.speed_egg_smash": "とにかく連打！15秒で卵を何個割れるか！",
    "egg.hint": "連打！連打！",
    "egg.timeUp": "タイムアップ！ {n}個 割った",

    /* ---------- IN-GAME: TOWER STACK ---------- */
    "tower.hint": "どこでもタップ（スペースキーでもOK）で落とす",
    "tower.great": "GREAT!",
    "tower.ok": "OK",
    "tower.miss": "落ちた！",
    "tower.tooSlow": "時間切れ！",
    "tower.clear": "タワー完成！",

    /* ---------- IN-GAME: CUP SHUFFLE ---------- */
    "cups.watch": "ボールをよく見て…",
    "cups.shuffle": "シャッフル！",
    "cups.pick": "ボールはどこ？",
    "cups.right": "正解！",
    "cups.wrong": "ハズレ！",
    "cups.tooSlow": "時間切れ！",

    /* ---------- IN-GAME: SPOT IT ---------- */
    "spot.hint": "まちがいは{n}個！どちらの絵をタップしてもOK",
    "spot.wrong": "ちがう！ -2秒",
    "spot.clear": "ぜんぶ発見！",
    "spot.timeUp": "タイムアップ",

    /* ---------- IN-GAME: DRUM DUO ---------- */
    "rhythm.ready": "よーい…",
    "rhythm.listen": "よく聴いて…",
    "rhythm.yourTurn": "まねして叩け！",
    "rhythm.tap": "タップ！（スペースキーでもOK）",
    "rhythm.early": "はやい",
    "rhythm.late": "おそい",
    "rhythm.extra": "まだ！",

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
