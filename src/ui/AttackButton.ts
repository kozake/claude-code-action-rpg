import { Graphics, Text, Container } from 'pixi.js';

const BTN_R = 46;
const SKILL_R = 34;

export class AttackButton {
  readonly container: Container;

  pressed = false;
  skillPressed = false;

  private attackGfx: Graphics;
  private skillGfx: Graphics;
  private attackLabel: Text;
  private skillLabel: Text;

  private attackTouchId: number | null = null;
  private skillTouchId: number | null = null;
  private screenW = 0;
  private screenH = 0;

  private attackX = 0;
  private attackY = 0;
  private skillX = 0;
  private skillY = 0;

  constructor(screenW: number, screenH: number) {
    this.container = new Container();

    this.attackGfx = new Graphics();
    this.skillGfx = new Graphics();

    this.attackLabel = new Text('⚔', {
      fontSize: 26, fill: 0xffffff,
      stroke: 0x000000, strokeThickness: 3,
    });
    this.attackLabel.anchor.set(0.5);

    this.skillLabel = new Text('💨', {
      fontSize: 19, fill: 0xffffff,
      stroke: 0x000000, strokeThickness: 2,
    });
    this.skillLabel.anchor.set(0.5);

    this.container.addChild(this.attackGfx);
    this.container.addChild(this.skillGfx);
    this.container.addChild(this.attackLabel);
    this.container.addChild(this.skillLabel);

    this.layout(screenW, screenH);

    window.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
  }

  private layout(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;

    this.attackX = screenW - 90;
    this.attackY = screenH - 100;

    this.skillX = screenW - 170;
    this.skillY = screenH - 155;

    this.drawAttack(false);
    this.drawSkill(false);

    this.attackLabel.x = this.attackX;
    this.attackLabel.y = this.attackY;
    this.skillLabel.x = this.skillX;
    this.skillLabel.y = this.skillY;
  }

  private drawAttack(active: boolean) {
    this.attackGfx.clear();
    const cx = this.attackX, cy = this.attackY;

    // Outer glow
    this.attackGfx.beginFill(active ? 0xff4444 : 0xaa1111, active ? 0.35 : 0.2);
    this.attackGfx.drawCircle(cx, cy, BTN_R + 8);
    this.attackGfx.endFill();

    // Main button body
    this.attackGfx.beginFill(active ? 0xee3333 : 0xbb1122, active ? 0.92 : 0.78);
    this.attackGfx.drawCircle(cx, cy, BTN_R);
    this.attackGfx.endFill();

    // Inner highlight arc (top)
    this.attackGfx.beginFill(0xffffff, active ? 0.2 : 0.28);
    this.attackGfx.drawEllipse(cx, cy - BTN_R * 0.32, BTN_R * 0.72, BTN_R * 0.3);
    this.attackGfx.endFill();

    // Border
    this.attackGfx.lineStyle(2, active ? 0xff9999 : 0xdd4444, active ? 0.7 : 0.5);
    this.attackGfx.drawCircle(cx, cy, BTN_R);
    this.attackGfx.lineStyle(0);
  }

  private drawSkill(active: boolean) {
    this.skillGfx.clear();
    const cx = this.skillX, cy = this.skillY;

    // Outer glow
    this.skillGfx.beginFill(active ? 0x4488ff : 0x2244aa, active ? 0.3 : 0.18);
    this.skillGfx.drawCircle(cx, cy, SKILL_R + 7);
    this.skillGfx.endFill();

    // Main button body
    this.skillGfx.beginFill(active ? 0x4477ee : 0x2255bb, active ? 0.9 : 0.75);
    this.skillGfx.drawCircle(cx, cy, SKILL_R);
    this.skillGfx.endFill();

    // Highlight
    this.skillGfx.beginFill(0xffffff, active ? 0.18 : 0.25);
    this.skillGfx.drawEllipse(cx, cy - SKILL_R * 0.3, SKILL_R * 0.65, SKILL_R * 0.28);
    this.skillGfx.endFill();

    // Border
    this.skillGfx.lineStyle(1.5, active ? 0x99ccff : 0x5577cc, active ? 0.7 : 0.5);
    this.skillGfx.drawCircle(cx, cy, SKILL_R);
    this.skillGfx.lineStyle(0);
  }

  private onTouchStart = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (this.attackTouchId === null) {
        const dx = t.clientX - this.attackX;
        const dy = t.clientY - this.attackY;
        if (Math.sqrt(dx * dx + dy * dy) < BTN_R + 12) {
          this.attackTouchId = t.identifier;
          this.pressed = true;
          this.drawAttack(true);
          continue;
        }
      }
      if (this.skillTouchId === null) {
        const dx = t.clientX - this.skillX;
        const dy = t.clientY - this.skillY;
        if (Math.sqrt(dx * dx + dy * dy) < SKILL_R + 12) {
          this.skillTouchId = t.identifier;
          this.skillPressed = true;
          this.drawSkill(true);
        }
      }
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.attackTouchId) {
        this.attackTouchId = null;
        this.pressed = false;
        this.drawAttack(false);
      }
      if (t.identifier === this.skillTouchId) {
        this.skillTouchId = null;
        this.skillPressed = false;
        this.drawSkill(false);
      }
    }
  };

  onResize(screenW: number, screenH: number) {
    this.layout(screenW, screenH);
    this.attackLabel.x = this.attackX;
    this.attackLabel.y = this.attackY;
    this.skillLabel.x = this.skillX;
    this.skillLabel.y = this.skillY;
  }
}
