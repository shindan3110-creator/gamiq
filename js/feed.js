// GAMIQ（ゲーミック） v2 - Infinite Feed

export class GamiqFeed {
  constructor({
    feed,
    currentCard,
    nextCard,
    getNextGame,
    renderCard,
    onGameEnter,
    canAdvance
  }) {
    this.feed = feed;
    this.currentCard = currentCard;
    this.nextCard = nextCard;

    this.getNextGame = getNextGame;
    this.renderCard = renderCard;
    this.onGameEnter = onGameEnter;

    this.canAdvance =
      canAdvance || (() => true);

    this.currentGame = null;
    this.nextGame = null;

    this.dragging = false;
    this.transitioning = false;

    this.startY = 0;
    this.currentY = 0;

    this.minSwipeDistance = 75;

    this.pointerId = null;

    this.boundPointerDown =
      this.handlePointerDown.bind(this);

    this.boundPointerMove =
      this.handlePointerMove.bind(this);

    this.boundPointerUp =
      this.handlePointerUp.bind(this);

    this.boundWheel =
      this.handleWheel.bind(this);

    this.boundKeyDown =
      this.handleKeyDown.bind(this);
  }

  start() {
    this.currentGame =
      this.getNextGame();

    this.nextGame =
      this.getNextGame();

    this.renderCard(
      this.currentCard,
      this.currentGame,
      false
    );

    this.renderCard(
      this.nextCard,
      this.nextGame,
      true
    );

    this.resetCards();

    this.attach();

    if (
      typeof this.onGameEnter ===
      "function"
    ) {
      this.onGameEnter(
        this.currentGame,
        this.currentCard
      );
    }
  }

  attach() {
    this.feed.addEventListener(
      "pointerdown",
      this.boundPointerDown
    );

    window.addEventListener(
      "pointermove",
      this.boundPointerMove,
      { passive: false }
    );

    window.addEventListener(
      "pointerup",
      this.boundPointerUp
    );

    window.addEventListener(
      "pointercancel",
      this.boundPointerUp
    );

    this.feed.addEventListener(
      "wheel",
      this.boundWheel,
      { passive: false }
    );

    window.addEventListener(
      "keydown",
      this.boundKeyDown
    );
  }

  detach() {
    this.feed.removeEventListener(
      "pointerdown",
      this.boundPointerDown
    );

    window.removeEventListener(
      "pointermove",
      this.boundPointerMove
    );

    window.removeEventListener(
      "pointerup",
      this.boundPointerUp
    );

    window.removeEventListener(
      "pointercancel",
      this.boundPointerUp
    );

    this.feed.removeEventListener(
      "wheel",
      this.boundWheel
    );

    window.removeEventListener(
      "keydown",
      this.boundKeyDown
    );
  }

  resetCards() {
    this.currentCard.classList.remove(
      "animating"
    );

    this.nextCard.classList.remove(
      "animating"
    );

    this.currentCard.classList.add(
      "current"
    );

    this.currentCard.classList.remove(
      "next"
    );

    this.nextCard.classList.add(
      "next"
    );

    this.nextCard.classList.remove(
      "current"
    );

    this.currentCard.style.transform =
      "translateY(0%)";

    this.nextCard.style.transform =
      "translateY(100%)";

    this.currentCard.style.opacity = "1";
    this.nextCard.style.opacity = "1";
  }

  handlePointerDown(event) {
    if (
      this.transitioning ||
      !this.canAdvance()
    ) {
      return;
    }

    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    this.dragging = true;

    this.pointerId =
      event.pointerId;

    this.startY =
      event.clientY;

    this.currentY =
      event.clientY;
  }

  handlePointerMove(event) {
    if (
      !this.dragging ||
      event.pointerId !== this.pointerId
    ) {
      return;
    }

    const delta =
      event.clientY -
      this.startY;

    if (delta >= 0) {
      return;
    }

    event.preventDefault();

    this.currentY =
      event.clientY;

    const feedHeight =
      this.feed.clientHeight || 1;

    const progress =
      Math.min(
        1,
        Math.abs(delta) /
          feedHeight
      );

    const currentPercent =
      progress * -100;

    const nextPercent =
      100 -
      progress * 100;

    this.currentCard.style.transform =
      `translateY(${currentPercent}%)`;

    this.nextCard.style.transform =
      `translateY(${nextPercent}%)`;

    this.currentCard.style.opacity =
      String(
        Math.max(
          0.55,
          1 - progress * 0.35
        )
      );
  }

  handlePointerUp(event) {
    if (
      !this.dragging ||
      event.pointerId !== this.pointerId
    ) {
      return;
    }

    const delta =
      this.currentY -
      this.startY;

    this.dragging = false;
    this.pointerId = null;

    if (
      delta <=
      -this.minSwipeDistance
    ) {
      this.advance();
    } else {
      this.snapBack();
    }
  }

  snapBack() {
    if (this.transitioning) {
      return;
    }

    this.currentCard.classList.add(
      "animating"
    );

    this.nextCard.classList.add(
      "animating"
    );

    this.currentCard.style.transform =
      "translateY(0%)";

    this.nextCard.style.transform =
      "translateY(100%)";

    this.currentCard.style.opacity = "1";

    setTimeout(
      () => {
        this.currentCard.classList.remove(
          "animating"
        );

        this.nextCard.classList.remove(
          "animating"
        );
      },
      360
    );
  }

  handleWheel(event) {
    if (
      this.transitioning ||
      !this.canAdvance()
    ) {
      return;
    }

    if (event.deltaY < 45) {
      return;
    }

    event.preventDefault();

    this.advance();
  }

  handleKeyDown(event) {
    if (
      this.transitioning ||
      !this.canAdvance()
    ) {
      return;
    }

    const tag =
      document.activeElement
        ?.tagName
        ?.toLowerCase();

    if (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select"
    ) {
      return;
    }

    if (
      event.key === "ArrowDown" ||
      event.key === "PageDown"
    ) {
      event.preventDefault();
      this.advance();
    }
  }

  advance() {
    if (
      this.transitioning ||
      !this.canAdvance()
    ) {
      return;
    }

    this.transitioning = true;
    this.dragging = false;

    this.currentCard.classList.add(
      "animating"
    );

    this.nextCard.classList.add(
      "animating"
    );

    this.currentCard.style.transform =
      "translateY(-100%)";

    this.nextCard.style.transform =
      "translateY(0%)";

    this.currentCard.style.opacity =
      "0.45";

    setTimeout(
      () => {
        this.swapCards();
      },
      350
    );
  }

  swapCards() {
    const oldCurrent =
      this.currentCard;

    this.currentCard =
      this.nextCard;

    this.nextCard =
      oldCurrent;

    this.currentGame =
      this.nextGame;

    this.nextGame =
      this.getNextGame();

    this.renderCard(
      this.nextCard,
      this.nextGame,
      true
    );

    this.resetCards();

    this.transitioning = false;

    if (
      typeof this.onGameEnter ===
      "function"
    ) {
      this.onGameEnter(
        this.currentGame,
        this.currentCard
      );
    }
  }

  forceAdvance() {
    if (this.transitioning) {
      return;
    }

    this.advance();
  }

  getCurrentGame() {
    return this.currentGame;
  }

  getNextPreparedGame() {
    return this.nextGame;
  }

  destroy() {
    this.detach();

    this.dragging = false;
    this.transitioning = false;
    this.pointerId = null;
  }
}
