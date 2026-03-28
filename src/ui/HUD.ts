import { Graphics, Text, Container } from 'pixi.js';
import type { Player } from '../game/entities/Player';
import type { Boss } from '../game/entities/Boss';

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

  // Combo counter
  private comboText: Text;
  private comboScale = 1;

  // Wave indicator
  private waveText: Text;

  // Buff indicator
  private buffText: Text;

  private screenW: number;
  private screenH: number;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.container = new Container();

    // HP bar
    this.hpBg = new Graphics();
    this.hpBg.beginFill(0x000000, 0.5);
    this.hpBg.drawRoundedRect(0, 0, 180, 14, 4);
    this.hpBg.endFill();
    this.hpBg.x = 12; this.hpBg.y = 12;

    this.hpBar = new Graphics();
    this.hpBar.x = 12; this.hpBar.y = 12;

    this.hpText = new Text('HP 100/100', {
      fontSize: 11, fill: 0xffffff, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 2,
    });
    this.hpText.x = 14; this.hpText.y = 29;

    // XP bar
    this.xpBg = new Graphics();
    this.xpBg.beginFill(0x000000, 0.5);
    this.xpBg.drawRoundedRect(0, 0, 180, 8, 3);
    this.xpBg.endFill();
    this.xpBg.x = 12; this.xpBg.y = 44;

    this.xpBar = new Graphics();
    this.xpBar.x = 12; this.xpBar.y = 44;

    this.levelText = new Text('LV 1', {
      fontSize: 12, fill: 0xffdd44, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 2,
    });
    this.levelText.x = 14; this.levelText.y = 55;

    // Boss HP panel
    this.bossPanel = new Container();
    this.bossPanel.visible = false;

    this.bossTitleText = new Text('👹 BOSS', {
      fontSize: 13, fill: 0xff4444, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 3,
    });
    this.bossTitleText.anchor.set(0.5, 1);
    this.bossTitleText.x = 150; this.bossTitleText.y = 0;

    this.bossHpBg = new Graphics();
    this.bossHpBg.beginFill(0x000000, 0.6);
    this.bossHpBg.drawRoundedRect(0, 4, 300, 16, 5);
    this.bossHpBg.endFill();

    this.bossHpBar = new Graphics();

    this.bossPanel.addChild(this.bossTitleText);
    this.bossPanel.addChild(this.bossHpBg);
    this.bossPanel.addChild(this.bossHpBar);

    // Combo counter
    this.comboText = new Text('', {
      fontSize: 32, fill: 0xff8800, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 5,
    });
    this.comboText.anchor.set(0.5);
    this.comboText.visible = false;

    // Wave text
    this.waveText = new Text('', {
      fontSize: 14, fill: 0xaaddff, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 3,
    });
    this.waveText.x = 14; this.waveText.y = 72;

    // Buff indicator
    this.buffText = new Text('', {
      fontSize: 12, fill: 0xffdd44,
      stroke: 0x000000, strokeThickness: 2,
    });
    this.buffText.x = 14; this.buffText.y = 88;

    // Message text
    this.msgText = new Text('', {
      fontSize: 26, fill: 0xffff00, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 5,
      align: 'center', wordWrap: true, wordWrapWidth: screenW - 40,
    });
    this.msgText.anchor.set(0.5);
    this.msgText.visible = false;

    // Flash overlay
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
    this.container.addChild(this.waveText);
    this.container.addChild(this.buffText);
    this.container.addChild(this.bossPanel);
    this.container.addChild(this.comboText);
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

    // Combo counter
    if (player.comboCount >= 2) {
      this.comboText.visible = true;
      this.comboText.text = `${player.comboCount} COMBO!`;
      const mult = 1 + Math.min(player.comboCount * 0.1, 1.0);
      this.comboText.text += `\nx${mult.toFixed(1)}`;
      // Pulse on new hits
      this.comboScale = Math.max(1.0, this.comboScale - dt * 3);
      this.comboText.scale.set(this.comboScale);
      this.comboText.x = this.screenW - 80;
      this.comboText.y = this.screenH / 2 - 40;
      // Color based on combo
      if (player.comboCount >= 10) {
        this.comboText.style.fill = 0xff2222;
      } else if (player.comboCount >= 5) {
        this.comboText.style.fill = 0xff8800;
      } else {
        this.comboText.style.fill = 0xffcc00;
      }
    } else {
      this.comboText.visible = false;
    }

    // Buff indicator
    const buffs: string[] = [];
    if (player.crystalBuffTime > 0) buffs.push(`💎 パワーUP ${player.crystalBuffTime.toFixed(1)}s`);
    this.buffText.text = buffs.join('  ');

    // Boss HP
    if (boss && !boss.dead) {
      this.bossPanel.visible = true;
      const bossRatio = boss.hp / boss.maxHp;
      this.bossHpBar.clear();
      const bossColor = boss.isEnraged ? 0xaa00ff : boss.isAngry ? 0xff2200 : 0xff5500;
      this.bossHpBar.beginFill(bossColor);
      this.bossHpBar.drawRoundedRect(0, 4, 300 * bossRatio, 16, 5);
      this.bossHpBar.endFill();
      const phaseText = boss.isEnraged ? ' [PHASE 3]' : boss.isAngry ? ' [PHASE 2]' : '';
      this.bossTitleText.text = `👹 BOSS${phaseText}`;
    } else {
      this.bossPanel.visible = false;
    }

    // Message
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0 && !this.msgText.text.includes('GAME OVER') && !this.msgText.text.includes('YOU WIN')) {
        this.msgText.visible = false;
      }
    }

    // Flash
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3);
      this.flashGfx.alpha = this.flashAlpha;
    }
  }

  /** Pulse the combo counter (call on new hit) */
  pulseCombo() {
    this.comboScale = 1.4;
  }

  showWave(current: number, total: number) {
    this.waveText.text = `⚔ Wave ${current}/${total}`;
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
    this.screenW = screenW; this.screenH = screenH;
    this.layoutBossPanel();
    this.layoutMsg();
    this.flashGfx.clear();
    this.flashGfx.beginFill(0xffffff);
    this.flashGfx.drawRect(0, 0, screenW, screenH);
    this.flashGfx.endFill();
    this.flashGfx.alpha = this.flashAlpha;
  }
}
