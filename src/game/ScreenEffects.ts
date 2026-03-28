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
  }

  private drawVignette() {
    const g = this.vignette;
    g.clear();
    // Draw concentric rectangles with increasing alpha at edges
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const alpha = t * t * 0.2;
      const inset = (1 - t) * Math.min(this.screenW, this.screenH) * 0.35;
      g.beginFill(0x000000, alpha);
      g.drawRect(0, 0, this.screenW, inset); // top
      g.drawRect(0, this.screenH - inset, this.screenW, inset); // bottom
      g.drawRect(0, inset, inset, this.screenH - inset * 2); // left
      g.drawRect(this.screenW - inset, inset, inset, this.screenH - inset * 2); // right
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

  get isTransitioning(): boolean {
    return this.transitionPhase !== 'none';
  }

  update(dt: number) {
    if (this.transitionPhase === 'none') return;

    this.transitionTimer += dt;

    switch (this.transitionPhase) {
      case 'fade_out': {
        this.transitionAlpha = Math.min(1, this.transitionTimer / 0.5);
        if (this.transitionTimer >= 0.5) {
          this.transitionPhase = 'show_title';
          this.transitionTimer = 0;
          this.transitionText.visible = true;
          this.transitionSubText.visible = true;
          if (this.onMidpoint) {
            this.onMidpoint();
            this.onMidpoint = null;
          }
        }
        break;
      }
      case 'show_title': {
        this.transitionAlpha = 1;
        // Text pulse effect
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
          if (this.onComplete) {
            this.onComplete();
            this.onComplete = null;
          }
        }
        break;
      }
    }

    // Draw overlay
    this.transitionOverlay.clear();
    this.transitionOverlay.beginFill(0x000000, this.transitionAlpha);
    this.transitionOverlay.drawRect(0, 0, this.screenW, this.screenH);
    this.transitionOverlay.endFill();
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
  }
}
