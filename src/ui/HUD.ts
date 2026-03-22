import { Graphics, Text, Container } from 'pixi.js';
import type { Player } from '../game/entities/Player';
import type { Boss } from '../game/entities/Enemy';

export class HUD {
  readonly container: Container;

  private hpBg: Graphics;
  private hpBar: Graphics;
  private hpText: Text;
  private xpBg: Graphics;
  private xpBar: Graphics;
  private levelText: Text;

  private bossPanel: Container;
  private bossHpBg: Graphics;
  private bossHpBar: Graphics;
  private bossTitleText: Text;

  private msgText: Text;
  private msgTimer = 0;

  private flashGfx: Graphics;
  private flashAlpha = 0;

  private screenW: number;
  private screenH: number;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.container = new Container();

    // ── Player HP bar ──
    this.hpBg = new Graphics();
    this.hpBg.beginFill(0x000000, 0.5);
    this.hpBg.drawRoundedRect(0, 0, 180, 14, 4);
    this.hpBg.endFill();
    this.hpBg.x = 12;
    this.hpBg.y = 12;

    this.hpBar = new Graphics();
    this.hpBar.x = 12;
    this.hpBar.y = 12;

    this.hpText = new Text('HP 100/100', {
      fontSize: 11,
      fill: 0xffffff,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 2,
    });
    this.hpText.x = 14;
    this.hpText.y = 29;

    // ── XP bar ──
    this.xpBg = new Graphics();
    this.xpBg.beginFill(0x000000, 0.5);
    this.xpBg.drawRoundedRect(0, 0, 180, 8, 3);
    this.xpBg.endFill();
    this.xpBg.x = 12;
    this.xpBg.y = 44;

    this.xpBar = new Graphics();
    this.xpBar.x = 12;
    this.xpBar.y = 44;

    this.levelText = new Text('LV 1', {
      fontSize: 12,
      fill: 0xffdd44,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 2,
    });
    this.levelText.x = 14;
    this.levelText.y = 55;

    // ── Boss HP panel ──
    this.bossPanel = new Container();
    this.bossPanel.visible = false;

    this.bossTitleText = new Text('👹 BOSS', {
      fontSize: 13,
      fill: 0xff4444,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 3,
    });
    this.bossTitleText.anchor.set(0.5, 1);
    this.bossTitleText.x = 150;
    this.bossTitleText.y = 0;

    this.bossHpBg = new Graphics();
    this.bossHpBg.beginFill(0x000000, 0.6);
    this.bossHpBg.drawRoundedRect(0, 4, 300, 16, 5);
    this.bossHpBg.endFill();

    this.bossHpBar = new Graphics();

    this.bossPanel.addChild(this.bossTitleText);
    this.bossPanel.addChild(this.bossHpBg);
    this.bossPanel.addChild(this.bossHpBar);

    // ── Message text (center) ──
    this.msgText = new Text('', {
      fontSize: 26,
      fill: 0xffff00,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 5,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: screenW - 40,
    });
    this.msgText.anchor.set(0.5);
    this.msgText.visible = false;

    // ── Full-screen flash overlay ──
    this.flashGfx = new Graphics();
    this.flashGfx.beginFill(0xffffff);
    this.flashGfx.drawRect(0, 0, screenW, screenH);
    this.flashGfx.endFill();
    this.flashGfx.alpha = 0;

    this.container.addChild(this.hpBg);
    this.container.addChild(this.hpBar);
    this.container.addChild(this.hpText);
    this.container.addChild(this.xpBg);
    this.container.addChild(this.xpBar);
    this.container.addChild(this.levelText);
    this.container.addChild(this.bossPanel);
    this.container.addChild(this.msgText);
    this.container.addChild(this.flashGfx);

    this.layoutBossPanel();
    this.layoutMsg();
  }

  private layoutBossPanel() {
    this.bossPanel.x = this.screenW / 2 - 150;
    this.bossPanel.y = this.screenH - 60;
  }

  private layoutMsg() {
    this.msgText.x = this.screenW / 2;
    this.msgText.y = this.screenH / 3;
    this.msgText.style.wordWrapWidth = this.screenW - 40;
  }

  update(dt: number, player: Player, boss: Boss | null) {
    // HP bar
    const hpRatio = player.hp / player.maxHp;
    this.hpBar.clear();
    this.hpBar.beginFill(
      hpRatio > 0.5 ? 0x22cc44 : hpRatio > 0.25 ? 0xffaa00 : 0xff3333,
    );
    this.hpBar.drawRoundedRect(0, 0, 180 * hpRatio, 14, 4);
    this.hpBar.endFill();
    this.hpText.text = `HP  ${player.hp} / ${player.maxHp}`;

    // XP bar
    const xpNeeded = player.level * 50;
    const xpRatio = player.xp / xpNeeded;
    this.xpBar.clear();
    this.xpBar.beginFill(0x44aaff);
    this.xpBar.drawRoundedRect(0, 0, 180 * xpRatio, 8, 3);
    this.xpBar.endFill();
    this.levelText.text = `LV ${player.level}  XP ${player.xp}/${xpNeeded}`;

    // Boss HP
    if (boss && !boss.dead) {
      this.bossPanel.visible = true;
      const bossRatio = boss.hp / boss.maxHp;
      this.bossHpBar.clear();
      this.bossHpBar.beginFill(boss.isAngry ? 0xff2200 : 0xff5500);
      this.bossHpBar.drawRoundedRect(0, 4, 300 * bossRatio, 16, 5);
      this.bossHpBar.endFill();
      this.bossTitleText.text = boss.isAngry ? '👹 BOSS  [PHASE 2]' : '👹 BOSS';
    } else {
      this.bossPanel.visible = false;
    }

    // Message timer
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0 && !this.msgText.text.includes('GAME OVER') && !this.msgText.text.includes('YOU WIN')) {
        this.msgText.visible = false;
      }
    }

    // Flash fade
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3);
      this.flashGfx.alpha = this.flashAlpha;
    }
  }

  showMessage(text: string, duration = 3) {
    this.msgText.text = text;
    this.msgText.visible = true;
    this.msgTimer = duration;
  }

  triggerFlash(color = 0xff0000, intensity = 0.7) {
    this.flashGfx.clear();
    this.flashGfx.beginFill(color);
    this.flashGfx.drawRect(0, 0, this.screenW, this.screenH);
    this.flashGfx.endFill();
    this.flashAlpha = intensity;
    this.flashGfx.alpha = this.flashAlpha;
  }

  onResize(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.layoutBossPanel();
    this.layoutMsg();

    this.flashGfx.clear();
    this.flashGfx.beginFill(0xffffff);
    this.flashGfx.drawRect(0, 0, screenW, screenH);
    this.flashGfx.endFill();
    this.flashGfx.alpha = this.flashAlpha;
  }
}
