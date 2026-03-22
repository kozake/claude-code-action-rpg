import { Graphics, Container } from 'pixi.js';

const BASE_R = 52;
const THUMB_R = 28;
const MAX_DIST = 42;

export class VirtualJoystick {
  readonly container: Container;
  private baseGfx: Graphics;
  private thumbGfx: Graphics;

  active = false;
  x = 0;
  y = 0;

  private touchId: number | null = null;
  private baseX = 0;
  private baseY = 0;

  constructor(screenW: number, screenH: number) {
    this.container = new Container();

    this.baseGfx = new Graphics();
    this.thumbGfx = new Graphics();

    this.drawBase();
    this.drawThumb(0, 0);

    this.container.addChild(this.baseGfx);
    this.container.addChild(this.thumbGfx);

    this.setDefaultPos(screenW, screenH);

    window.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
  }

  private drawBase() {
    this.baseGfx.clear();
    this.baseGfx.lineStyle(3, 0xffffff, 0.3);
    this.baseGfx.beginFill(0x000000, 0.3);
    this.baseGfx.drawCircle(0, 0, BASE_R);
    this.baseGfx.endFill();
  }

  private drawThumb(ox: number, oy: number) {
    this.thumbGfx.clear();
    this.thumbGfx.beginFill(0xffffff, 0.7);
    this.thumbGfx.drawCircle(ox, oy, THUMB_R);
    this.thumbGfx.endFill();
    this.thumbGfx.lineStyle(2, 0xaaaaaa, 0.5);
    this.thumbGfx.drawCircle(ox, oy, THUMB_R);
  }

  private setDefaultPos(screenW: number, screenH: number) {
    this.baseX = 90;
    this.baseY = screenH - 110;
    this.container.x = this.baseX;
    this.container.y = this.baseY;
    this.drawThumb(0, 0);
  }

  private onTouchStart = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (this.touchId !== null) continue;
      // Only left-half touches
      if (t.clientX < window.innerWidth * 0.5) {
        this.touchId = t.identifier;
        this.baseX = t.clientX;
        this.baseY = t.clientY;
        this.container.x = this.baseX;
        this.container.y = this.baseY;
        this.active = true;
        this.drawThumb(0, 0);
      }
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.touchId) continue;
      const dx = t.clientX - this.baseX;
      const dy = t.clientY - this.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        this.x = dx / dist;
        this.y = dy / dist;
      } else {
        this.x = 0;
        this.y = 0;
      }
      const clamped = Math.min(dist, MAX_DIST);
      const ox = (this.x) * clamped;
      const oy = (this.y) * clamped;
      this.drawThumb(ox, oy);
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.touchId) continue;
      this.touchId = null;
      this.active = false;
      this.x = 0;
      this.y = 0;
      this.drawThumb(0, 0);
    }
  };

  onResize(screenW: number, screenH: number) {
    if (!this.active) {
      this.setDefaultPos(screenW, screenH);
    }
  }
}
