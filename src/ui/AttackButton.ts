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

  // Positions relative to screen
  private attackX = 0;
  private attackY = 0;
  private skillX = 0;
  private skillY = 0;

  constructor(screenW: number, screenH: number) {
    this.container = new Container();

    this.attackGfx = new Graphics();
    this.skillGfx = new Graphics();

    this.attackLabel = new Text('⚔', {
      fontSize: 28,
      fill: 0xffffff,
    });
    this.attackLabel.anchor.set(0.5);

    this.skillLabel = new Text('💨', {
      fontSize: 20,
      fill: 0xffffff,
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

    // Attack button: bottom-right
    this.attackX = screenW - 90;
    this.attackY = screenH - 100;

    // Skill button: above and left of attack button
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
    this.attackGfx.beginFill(active ? 0xff6666 : 0xcc2222, active ? 0.95 : 0.75);
    this.attackGfx.drawCircle(this.attackX, this.attackY, BTN_R);
    this.attackGfx.endFill();
    this.attackGfx.lineStyle(3, 0xff9999, 0.6);
    this.attackGfx.drawCircle(this.attackX, this.attackY, BTN_R);
  }

  private drawSkill(active: boolean) {
    this.skillGfx.clear();
    this.skillGfx.beginFill(active ? 0x88aaff : 0x3355aa, active ? 0.95 : 0.75);
    this.skillGfx.drawCircle(this.skillX, this.skillY, SKILL_R);
    this.skillGfx.endFill();
    this.skillGfx.lineStyle(2, 0xaabbff, 0.6);
    this.skillGfx.drawCircle(this.skillX, this.skillY, SKILL_R);
  }

  private onTouchStart = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      // Attack button
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
      // Skill button
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
