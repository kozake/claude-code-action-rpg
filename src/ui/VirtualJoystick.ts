import { Graphics, Container } from 'pixi.js';

const BASE_R = 52;
const THUMB_R = 26;
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
    // Outer ring
    this.baseGfx.lineStyle(2, 0xffffff, 0.22);
    this.baseGfx.beginFill(0x000000, 0.28);
    this.baseGfx.drawCircle(0, 0, BASE_R);
    this.baseGfx.endFill();
    // Inner ring
    this.baseGfx.lineStyle(1, 0xaaddff, 0.15);
    this.baseGfx.drawCircle(0, 0, BASE_R * 0.62);
    this.baseGfx.lineStyle(0);
    // Cardinal direction dots
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      const r = BASE_R * 0.82;
      this.baseGfx.beginFill(0xffffff, 0.18);
      this.baseGfx.drawCircle(Math.cos(a) * r, Math.sin(a) * r, 3);
      this.baseGfx.endFill();
    }
  }

  private drawThumb(ox: number, oy: number) {
    this.thumbGfx.clear();
    const active = ox !== 0 || oy !== 0;
    // Outer glow when active
    if (active) {
      this.thumbGfx.beginFill(0x44aaff, 0.18);
      this.thumbGfx.drawCircle(ox, oy, THUMB_R + 8);
      this.thumbGfx.endFill();
    }
    // Thumb body
    this.thumbGfx.beginFill(active ? 0x5599ee : 0xccddff, active ? 0.82 : 0.65);
    this.thumbGfx.drawCircle(ox, oy, THUMB_R);
    this.thumbGfx.endFill();
    // Inner highlight
    this.thumbGfx.beginFill(0xffffff, active ? 0.35 : 0.45);
    this.thumbGfx.drawCircle(ox - THUMB_R * 0.25, oy - THUMB_R * 0.25, THUMB_R * 0.42);
    this.thumbGfx.endFill();
    // Border
    this.thumbGfx.lineStyle(1.5, 0xffffff, active ? 0.55 : 0.35);
    this.thumbGfx.drawCircle(ox, oy, THUMB_R);
    this.thumbGfx.lineStyle(0);
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
      this.drawThumb(this.x * clamped, this.y * clamped);
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
