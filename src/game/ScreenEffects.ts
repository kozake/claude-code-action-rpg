import { Graphics, Text, Container } from 'pixi.js';

export class ScreenEffects {
  readonly container: Container;
  private vignette: Graphics;
  private transitionOverlay: Graphics;
  private transitionText: Text;
  private transitionSubText: Text;
  private screenW: number;
  private screenH: number;

  // Transition state
  private transitionAlpha = 0;
  private transitionPhase: 'none' | 'fade_out' | 'show_title' | 'fade_in' = 'none';
  private transitionTimer = 0;
  private onMidpoint: (() => void) | null = null;
  private onComplete: (() => void) | null = null;

  // Letterbox
  private letterboxTop: Graphics;
  private letterboxBottom: Graphics;
  private letterboxAlpha = 0;

  // ── Boss intro cinematic ───────────────────────────────────────────────────
  private bossIntroPhase: 'none' | 'darken' | 'hold' | 'typewriter' | 'brighten' = 'none';
  private bossIntroTimer = 0;
  private bossIntroAlpha = 0;
  private bossIntroOverlay: Graphics;
  private bossNameText: Text;
  private bossDialogueText: Text;
  private typewriterFull = '';
  private typewriterIndex = 0;
  private typewriterTimer = 0;
  private readonly typewriterDelay = 0.055; // seconds per character
  private onBossIntroComplete: (() => void) | null = null;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.container = new Container();

    // Vignette (always visible, subtle)
    this.vignette = new Graphics();
    this.drawVignette();
    this.container.addChild(this.vignette);

    // Letterbox bars
    this.letterboxTop = new Graphics();
    this.letterboxBottom = new Graphics();
    this.letterboxTop.visible = false;
    this.letterboxBottom.visible = false;
    this.container.addChild(this.letterboxTop);
    this.container.addChild(this.letterboxBottom);

    // Transition overlay
    this.transitionOverlay = new Graphics();
    this.transitionOverlay.visible = false;
    this.container.addChild(this.transitionOverlay);

    // Floor title text
    this.transitionText = new Text('', {
      fontSize: 32, fill: 0xffdd44, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 6, align: 'center',
      fontFamily: 'Arial, sans-serif',
    });
    this.transitionText.anchor.set(0.5);
    this.transitionText.x = screenW / 2;
    this.transitionText.y = screenH / 2 - 20;
    this.transitionText.visible = false;
    this.container.addChild(this.transitionText);

    this.transitionSubText = new Text('', {
      fontSize: 16, fill: 0xcccccc,
      stroke: 0x000000, strokeThickness: 3, align: 'center',
      fontFamily: 'Arial, sans-serif',
    });
    this.transitionSubText.anchor.set(0.5);
    this.transitionSubText.x = screenW / 2;
    this.transitionSubText.y = screenH / 2 + 20;
    this.transitionSubText.visible = false;
    this.container.addChild(this.transitionSubText);

    // ── Boss intro layers ──────────────────────────────────────────────────
    this.bossIntroOverlay = new Graphics();
    this.bossIntroOverlay.visible = false;
    this.container.addChild(this.bossIntroOverlay);

    this.bossNameText = new Text('', {
      fontSize: 38, fill: 0xff4400, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 8, align: 'center',
      fontFamily: 'Arial, sans-serif',
    });
    this.bossNameText.anchor.set(0.5);
    this.bossNameText.x = screenW / 2;
    this.bossNameText.y = screenH * 0.28;
    this.bossNameText.visible = false;
    this.container.addChild(this.bossNameText);

    this.bossDialogueText = new Text('', {
      fontSize: 21, fill: 0xfff0cc, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 5, align: 'center',
      wordWrap: true, wordWrapWidth: screenW * 0.78,
      fontFamily: 'Arial, sans-serif',
      lineHeight: 32,
    });
    this.bossDialogueText.anchor.set(0.5);
    this.bossDialogueText.x = screenW / 2;
    this.bossDialogueText.y = screenH * 0.72;
    this.bossDialogueText.visible = false;
    this.container.addChild(this.bossDialogueText);
  }

  private drawVignette() {
    const g = this.vignette;
    g.clear();
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const alpha = t * t * 0.2;
      const inset = (1 - t) * Math.min(this.screenW, this.screenH) * 0.35;
      g.beginFill(0x000000, alpha);
      g.drawRect(0, 0, this.screenW, inset);
      g.drawRect(0, this.screenH - inset, this.screenW, inset);
      g.drawRect(0, inset, inset, this.screenH - inset * 2);
      g.drawRect(this.screenW - inset, inset, inset, this.screenH - inset * 2);
      g.endFill();
    }
  }

  /** Start floor transition animation */
  startFloorTransition(
    floorName: string,
    themeName: string,
    onMidpoint: () => void,
    onComplete: () => void,
  ) {
    this.transitionPhase = 'fade_out';
    this.transitionTimer = 0;
    this.transitionAlpha = 0;
    this.onMidpoint = onMidpoint;
    this.onComplete = onComplete;
    this.transitionText.text = floorName;
    this.transitionSubText.text = themeName;
    this.transitionOverlay.visible = true;
  }

  /** Show letterbox bars (for boss entrance) */
  showLetterbox() {
    this.letterboxTop.visible = true;
    this.letterboxBottom.visible = true;
    this.letterboxAlpha = 1;
    this.drawLetterbox();
  }

  hideLetterbox() {
    this.letterboxAlpha = 0;
    this.letterboxTop.visible = false;
    this.letterboxBottom.visible = false;
  }

  private drawLetterbox() {
    const barH = Math.floor(this.screenH * 0.08);
    this.letterboxTop.clear();
    this.letterboxTop.beginFill(0x000000, this.letterboxAlpha);
    this.letterboxTop.drawRect(0, 0, this.screenW, barH);
    this.letterboxTop.endFill();
    this.letterboxBottom.clear();
    this.letterboxBottom.beginFill(0x000000, this.letterboxAlpha);
    this.letterboxBottom.drawRect(0, this.screenH - barH, this.screenW, barH);
    this.letterboxBottom.endFill();
  }

  /**
   * Start the boss intro cinematic.
   * @param bossName  Large title shown after darken (e.g. "「魔王」降臨")
   * @param dialogue  Dialogue lines shown with typewriter effect
   * @param onComplete Called when the cinematic finishes
   */
  startBossIntro(bossName: string, dialogue: string, onComplete: () => void) {
    this.bossIntroPhase = 'darken';
    this.bossIntroTimer = 0;
    this.bossIntroAlpha = 0;
    this.typewriterFull = dialogue;
    this.typewriterIndex = 0;
    this.typewriterTimer = 0;
    this.onBossIntroComplete = onComplete;
    this.bossNameText.text = bossName;
    this.bossDialogueText.text = '';
    this.bossIntroOverlay.visible = true;
    // Show letterbox slowly
    this.letterboxTop.visible = true;
    this.letterboxBottom.visible = true;
    this.letterboxAlpha = 0;
  }

  get isTransitioning(): boolean {
    return this.transitionPhase !== 'none';
  }

  get isBossIntroPlaying(): boolean {
    return this.bossIntroPhase !== 'none';
  }

  update(dt: number) {
    // ── Floor transition ──
    if (this.transitionPhase !== 'none') {
      this.transitionTimer += dt;
      switch (this.transitionPhase) {
        case 'fade_out': {
          this.transitionAlpha = Math.min(1, this.transitionTimer / 0.5);
          if (this.transitionTimer >= 0.5) {
            this.transitionPhase = 'show_title';
            this.transitionTimer = 0;
            this.transitionText.visible = true;
            this.transitionSubText.visible = true;
            if (this.onMidpoint) { this.onMidpoint(); this.onMidpoint = null; }
          }
          break;
        }
        case 'show_title': {
          this.transitionAlpha = 1;
          const pulse = 1 + Math.sin(this.transitionTimer * 3) * 0.05;
          this.transitionText.scale.set(pulse);
          if (this.transitionTimer >= 1.5) {
            this.transitionPhase = 'fade_in';
            this.transitionTimer = 0;
            this.transitionText.visible = false;
            this.transitionSubText.visible = false;
          }
          break;
        }
        case 'fade_in': {
          this.transitionAlpha = Math.max(0, 1 - this.transitionTimer / 0.5);
          if (this.transitionTimer >= 0.5) {
            this.transitionPhase = 'none';
            this.transitionOverlay.visible = false;
            if (this.onComplete) { this.onComplete(); this.onComplete = null; }
          }
          break;
        }
      }
      this.transitionOverlay.clear();
      this.transitionOverlay.beginFill(0x000000, this.transitionAlpha);
      this.transitionOverlay.drawRect(0, 0, this.screenW, this.screenH);
      this.transitionOverlay.endFill();
    }

    // ── Boss intro cinematic ──
    if (this.bossIntroPhase !== 'none') {
      this.bossIntroTimer += dt;

      switch (this.bossIntroPhase) {
        case 'darken': {
          // 0 → 1.2s: fade to dark + letterbox slide in
          this.bossIntroAlpha = Math.min(0.82, this.bossIntroTimer / 1.2 * 0.82);
          this.letterboxAlpha = Math.min(1, this.bossIntroTimer / 0.8);
          this.drawLetterbox();
          if (this.bossIntroTimer >= 1.4) {
            this.bossIntroPhase = 'hold';
            this.bossIntroTimer = 0;
            // Show boss name with pulse
            this.bossNameText.visible = true;
            this.bossNameText.alpha = 0;
          }
          break;
        }
        case 'hold': {
          // 0 → 1.5s: boss name fades in, roar animation plays
          this.bossNameText.alpha = Math.min(1, this.bossIntroTimer / 0.5);
          // Subtle pulse on name
          const pulse = 1 + Math.sin(this.bossIntroTimer * 5) * 0.03;
          this.bossNameText.scale.set(pulse);
          if (this.bossIntroTimer >= 1.6) {
            this.bossIntroPhase = 'typewriter';
            this.bossIntroTimer = 0;
            this.typewriterTimer = 0;
            this.typewriterIndex = 0;
            this.bossDialogueText.text = '';
            this.bossDialogueText.visible = true;
            this.bossDialogueText.alpha = 1;
          }
          break;
        }
        case 'typewriter': {
          // Typewriter effect on dialogue
          this.typewriterTimer += dt;
          const charsToShow = Math.floor(this.typewriterTimer / this.typewriterDelay);
          if (charsToShow > this.typewriterIndex) {
            this.typewriterIndex = Math.min(charsToShow, this.typewriterFull.length);
            this.bossDialogueText.text = this.typewriterFull.slice(0, this.typewriterIndex);
          }
          // Wait 2 extra seconds after full text is shown before brightening
          const allShown = this.typewriterIndex >= this.typewriterFull.length;
          if (allShown && this.typewriterTimer >= this.typewriterFull.length * this.typewriterDelay + 2.2) {
            this.bossIntroPhase = 'brighten';
            this.bossIntroTimer = 0;
          }
          break;
        }
        case 'brighten': {
          // 0 → 0.8s: fade out overlay + hide texts
          const t = Math.min(1, this.bossIntroTimer / 0.8);
          this.bossIntroAlpha = 0.82 * (1 - t);
          this.bossNameText.alpha = 1 - t;
          this.bossDialogueText.alpha = 1 - t;
          if (this.bossIntroTimer >= 0.8) {
            this.bossIntroPhase = 'none';
            this.bossIntroOverlay.visible = false;
            this.bossNameText.visible = false;
            this.bossDialogueText.visible = false;
            // Keep letterbox for a moment then hide
            setTimeout(() => this.hideLetterbox(), 1000);
            if (this.onBossIntroComplete) {
              this.onBossIntroComplete();
              this.onBossIntroComplete = null;
            }
          }
          break;
        }
      }

      // Draw dark overlay
      this.bossIntroOverlay.clear();
      this.bossIntroOverlay.beginFill(0x000000, this.bossIntroAlpha);
      this.bossIntroOverlay.drawRect(0, 0, this.screenW, this.screenH);
      this.bossIntroOverlay.endFill();
    }
  }

  resize(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.vignette.clear();
    this.drawVignette();
    this.transitionText.x = screenW / 2;
    this.transitionText.y = screenH / 2 - 20;
    this.transitionSubText.x = screenW / 2;
    this.transitionSubText.y = screenH / 2 + 20;
    this.bossNameText.x = screenW / 2;
    this.bossNameText.y = screenH * 0.28;
    this.bossDialogueText.x = screenW / 2;
    this.bossDialogueText.y = screenH * 0.72;
    this.bossDialogueText.style.wordWrapWidth = screenW * 0.78;
  }
}
