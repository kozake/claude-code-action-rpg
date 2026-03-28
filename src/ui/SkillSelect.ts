import { Container, Graphics, Text } from 'pixi.js';
import type { Skill } from '../game/Skills';

/**
 * Full-screen overlay for choosing a skill on level-up.
 * Shows 3 cards; player taps/clicks one to select.
 */
export class SkillSelectUI {
  readonly container: Container;
  private bg: Graphics;
  private cards: Container[] = [];
  private screenW: number;
  private screenH: number;

  /** Set when the player selects a skill */
  selectedSkill: Skill | null = null;
  /** Whether the UI is currently showing */
  active = false;

  private skills: Skill[] = [];
  private animTimer = 0;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.container = new Container();
    this.container.visible = false;

    this.bg = new Graphics();
    this.container.addChild(this.bg);

    // Touch/click handler
    window.addEventListener('touchstart', this.onTouch, { passive: false });
    window.addEventListener('click', this.onClick);
  }

  show(skills: Skill[]) {
    this.skills = skills;
    this.selectedSkill = null;
    this.active = true;
    this.animTimer = 0;
    this.container.visible = true;
    this.buildCards();
  }

  hide() {
    this.active = false;
    this.container.visible = false;
    for (const c of this.cards) {
      this.container.removeChild(c);
    }
    this.cards = [];
  }

  update(dt: number) {
    if (!this.active) return;
    this.animTimer += dt;

    // Animate cards sliding in
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const targetY = this.screenH / 2;
      const startY = this.screenH + 150;
      const delay = i * 0.1;
      const t = Math.max(0, Math.min(1, (this.animTimer - delay) / 0.3));
      const ease = 1 - Math.pow(1 - t, 3); // ease out cubic
      card.y = startY + (targetY - startY) * ease;

      // Gentle float
      if (t >= 1) {
        card.y = targetY + Math.sin(this.animTimer * 2 + i) * 3;
      }
    }
  }

  private buildCards() {
    // Clear old
    for (const c of this.cards) this.container.removeChild(c);
    this.cards = [];

    // Background
    this.bg.clear();
    this.bg.beginFill(0x000000, 0.75);
    this.bg.drawRect(0, 0, this.screenW, this.screenH);
    this.bg.endFill();

    // Title
    const title = new Text('スキルを選べ！', {
      fontSize: 28,
      fill: 0xffdd44,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 5,
      align: 'center',
    });
    title.anchor.set(0.5);
    title.x = this.screenW / 2;
    title.y = this.screenH / 2 - 150;
    this.container.addChild(title);
    // We'll track it with cards for cleanup
    const titleContainer = new Container();
    titleContainer.addChild(title);
    titleContainer.y = 0; // static
    // Actually, add title separately
    this.container.removeChild(title);

    const titleC = new Container();
    titleC.addChild(title);
    this.container.addChild(titleC);
    this.cards.push(titleC);

    const cardW = Math.min(140, (this.screenW - 60) / 3);
    const cardH = 200;
    const totalW = this.skills.length * cardW + (this.skills.length - 1) * 16;
    const startX = (this.screenW - totalW) / 2 + cardW / 2;

    for (let i = 0; i < this.skills.length; i++) {
      const skill = this.skills[i];
      const card = new Container();

      // Card background
      const bg = new Graphics();
      const colors = [0x2244aa, 0xaa2244, 0x22aa44];
      bg.beginFill(colors[i % 3], 0.9);
      bg.lineStyle(3, 0xffdd44, 0.8);
      bg.drawRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
      bg.endFill();

      // Inner glow
      bg.beginFill(0xffffff, 0.08);
      bg.drawRoundedRect(-cardW / 2 + 4, -cardH / 2 + 4, cardW - 8, cardH / 3, 8);
      bg.endFill();

      card.addChild(bg);

      // Icon
      const icon = new Text(skill.icon, {
        fontSize: 40,
        fill: 0xffffff,
      });
      icon.anchor.set(0.5);
      icon.y = -cardH / 2 + 48;
      card.addChild(icon);

      // Name
      const name = new Text(skill.name, {
        fontSize: 16,
        fill: 0xffffff,
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 3,
        align: 'center',
      });
      name.anchor.set(0.5);
      name.y = -cardH / 2 + 95;
      card.addChild(name);

      // Description
      const desc = new Text(skill.description, {
        fontSize: 11,
        fill: 0xdddddd,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: cardW - 20,
        lineHeight: 16,
      });
      desc.anchor.set(0.5);
      desc.y = -cardH / 2 + 145;
      card.addChild(desc);

      card.x = startX + i * (cardW + 16);
      card.y = this.screenH + 150; // start off-screen
      (card as any).__skillIndex = i;

      this.container.addChild(card);
      this.cards.push(card);
    }
  }

  private hitTest(clientX: number, clientY: number) {
    if (!this.active) return;
    for (const card of this.cards) {
      const idx = (card as any).__skillIndex;
      if (idx === undefined) continue;
      const bounds = card.getBounds();
      if (clientX >= bounds.x && clientX <= bounds.x + bounds.width &&
          clientY >= bounds.y && clientY <= bounds.y + bounds.height) {
        this.selectedSkill = this.skills[idx];
        return;
      }
    }
  }

  private onTouch = (e: TouchEvent) => {
    if (!this.active) return;
    for (const t of Array.from(e.changedTouches)) {
      this.hitTest(t.clientX, t.clientY);
    }
  };

  private onClick = (e: MouseEvent) => {
    this.hitTest(e.clientX, e.clientY);
  };

  onResize(w: number, h: number) {
    this.screenW = w;
    this.screenH = h;
    if (this.active) {
      this.buildCards();
    }
  }
}
