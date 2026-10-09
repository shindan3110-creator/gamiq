// GAMIQ（ゲーミック） v2 - Results Overlay

export class GamiqResults {
  constructor({
    scoreEngine,
    onContinue = null
  }) {
    this.scoreEngine = scoreEngine;
    this.onContinue = onContinue;
    this.overlay = null;

    this.handleEscape =
      this.handleEscape.bind(this);
  }


  create() {
    if (this.overlay) {
      return this.overlay;
    }


    const overlay =
      document.createElement("div");


    overlay.className =
      "gamiq-results-overlay";


    overlay.setAttribute(
      "aria-hidden",
      "true"
    );


    overlay.innerHTML = `
      <div
        class="gamiq-results-card"
        role="dialog"
        aria-modal="true"
        aria-label="GAMIQ結果"
      >

        <div class="gamiq-results-label">
          CURRENT GAMIQ
        </div>

        <div
          class="gamiq-results-score"
          data-results-gamiq
        >
          ---
        </div>

        <div class="gamiq-results-confidence">

          <span>
            測定精度
          </span>

          <strong
            data-results-confidence
          >
            0%
          </strong>

        </div>

        <div class="gamiq-results-confidence-track">

          <div
            class="gamiq-results-confidence-fill"
            data-results-confidence-fill
          ></div>

        </div>


        <div class="gamiq-results-grid">

          <div class="gamiq-result-item">
            <span>REFLEX</span>
            <strong data-result-skill="REFLEX">
              --
            </strong>
          </div>

          <div class="gamiq-result-item">
            <span>SPEED</span>
            <strong data-result-skill="SPEED">
              --
            </strong>
          </div>

          <div class="gamiq-result-item">
            <span>AIM</span>
            <strong data-result-skill="AIM">
              --
            </strong>
          </div>

          <div class="gamiq-result-item">
            <span>LOGIC</span>
            <strong data-result-skill="LOGIC">
              --
            </strong>
          </div>

          <div class="gamiq-result-item">
            <span>MEMORY</span>
            <strong data-result-skill="MEMORY">
              --
            </strong>
          </div>

          <div class="gamiq-result-item">
            <span>ADAPT</span>
            <strong data-result-skill="ADAPT">
              --
            </strong>
          </div>

        </div>


        <div class="gamiq-results-played">

          <span>
            PLAYED
          </span>

          <strong
            data-results-played
          >
            0
          </strong>

        </div>


        <div
          class="gamiq-results-next"
          data-results-next
        ></div>


        <button
          type="button"
          class="gamiq-results-continue"
          data-results-continue
        >
          ゲームを続ける
        </button>

      </div>
    `;


    document.body.appendChild(
      overlay
    );


    const continueButton =
      overlay.querySelector(
        "[data-results-continue]"
      );


    continueButton.addEventListener(
      "click",
      () => {
        this.closeAndContinue();
      }
    );


    overlay.addEventListener(
      "pointerdown",
      event => {

        if (
          event.target === overlay
        ) {
          this.closeAndContinue();
        }

      }
    );


    this.overlay =
      overlay;


    return overlay;
  }


  update() {
    const overlay =
      this.create();


    const summary =
      this.scoreEngine.getSummary();


    const gamiqElement =
      overlay.querySelector(
        "[data-results-gamiq]"
      );


    const confidenceElement =
      overlay.querySelector(
        "[data-results-confidence]"
      );


    const confidenceFill =
      overlay.querySelector(
        "[data-results-confidence-fill]"
      );


    const playedElement =
      overlay.querySelector(
        "[data-results-played]"
      );


    const nextElement =
      overlay.querySelector(
        "[data-results-next]"
      );


    gamiqElement.textContent =
      summary.gamiq ?? "---";


    confidenceElement.textContent =
      `${summary.confidence}%`;


    confidenceFill.style.width =
      `${summary.confidence}%`;


    playedElement.textContent =
      summary.played;


    Object.entries(
      summary.abilities
    )
    .forEach(
      ([skill, value]) => {

        const element =
          overlay.querySelector(
            `[data-result-skill="${skill}"]`
          );


        if (!element) {
          return;
        }


        element.textContent =
          value === null
            ? "--"
            : value;
      }
    );


    if (
      summary.nextConfidenceTarget &&
      summary.gamesToNextTarget !== null
    ) {
      nextElement.textContent =
        `あと${summary.gamesToNextTarget}ゲームで測定精度${summary.nextConfidenceTarget}%目安`;
    } else {
      nextElement.textContent =
        "十分な測定データが集まっています";
    }
  }


  show() {
    const overlay =
      this.create();


    this.update();


    overlay.classList.add(
      "show"
    );


    overlay.setAttribute(
      "aria-hidden",
      "false"
    );


    document.addEventListener(
      "keydown",
      this.handleEscape
    );


    requestAnimationFrame(
      () => {

        overlay
          .querySelector(
            "[data-results-continue]"
          )
          ?.focus();

      }
    );
  }


  hide() {
    if (!this.overlay) {
      return;
    }


    this.overlay.classList.remove(
      "show"
    );


    this.overlay.setAttribute(
      "aria-hidden",
      "true"
    );


    document.removeEventListener(
      "keydown",
      this.handleEscape
    );
  }


  closeAndContinue() {
    this.hide();


    if (
      typeof this.onContinue ===
      "function"
    ) {
      this.onContinue();
    }
  }


  handleEscape(event) {
    if (
      event.key !== "Escape"
    ) {
      return;
    }


    this.closeAndContinue();
  }


  toggle() {
    const overlay =
      this.create();


    if (
      overlay.classList.contains(
        "show"
      )
    ) {
      this.closeAndContinue();
    } else {
      this.show();
    }
  }
}
