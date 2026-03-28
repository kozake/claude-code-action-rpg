import { Graphics, Text, Container } from 'pixi.js';
import type { Player } from '../game/entities/Player';
import type { Boss } from '../game/entities/Boss';

export class HUD {
  readonly container: Container;

  private hpBar: Graphics;
  private hpText: Text;
  private xpBar: Graphics;
  private levelText: Text;

  private bossPanel: Container;
  private bossHpBar: Graphics;
  private bossTitleText: Text;

  private msgText: Text;
  private msgTimer = 0;

  private flashGfx: Graphics;
  private flashAlpha = 0;
  private flashColor = 0xff0000;

  private comboText: Text;
  private comboScale = 1;

  private waveText: Text;
  private floorText: Text;
  private buffText: Text;

  private screenW: number;
  private screenH: number;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.container = new Container();

    // ── HP Bar ────────────────────────────────────────────────────────────────
    this.hpBar = new Graphics();
    this.hpText = new Text('HP 100/100', {
      fontSize: 11, fill: 0xeeeeff, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 3,
      fontFamily: 'Arial, sans-serif',
    });
    this.hpText.x = 14; this.hpText.y = 30;

    // ── XP Bar ────────────────────────────────────────────────────────────────
    this.xpBar = new Graphics();
    this.levelText = new Text('LV 1', {
      fontSize: 11, fill: 0xaaddff, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 3,
      fontFamily: 'Arial, sans-serif',
    });
    this.levelText.x = 14; this.levelText.y = 57;

    // ── Boss HP panel ─────────────────────────────────────────────────────────
    this.bossPanel = new Container();
    this.bossPanel.visible = false;

    this.bossTitleText = new Text('BOSS', {
      fontSize: 12, fill: 0xff5533, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 3,
      fontFamily: 'Arial, sans-serif',
    });
    this.bossTitleText.anchor.set(0.5, 1);
    this.bossTitleText.x = 160; this.bossTitleText.y = 2;

    this.bossHpBar = new Graphics();
    this.bossPanel.addChild(this.bossTitleText);
    this.bossPanel.addChild(this.bossHpBar);

    // ── Combo counter ─────────────────────────────────────────────────────────
    this.comboText = new Text('', {
      fontSize: 28, fill: 0xff8800, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 5,
      fontFamily: 'Arial, sans-serif',
    });
    this.comboText.anchor.set(0.5);
    this.comboText.visible = false;

    // ── Wave text ─────────────────────────────────────────────────────────────
    this.waveText = new Text('', {
      fontSize: 13, fill: 0x99ccff, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 3,
      fontFamily: 'Arial, sans-serif',
    });
    this.waveText.x = 14; this.waveText.y = 72;

    // ── Floor indicator ────────────────────────────────────────────────────────
    this.floorText = new Text('B1F', {
      fontSize: 13, fill: 0xffcc66, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 3,
      fontFamily: 'Arial, sans-serif',
    });
    this.floorText.x = 14; this.floorText.y = 88;

    // ── Buff indicator ────────────────────────────────────────────────────────
    this.buffText = new Text('', {
      fontSize: 11, fill: 0xffdd44,
      stroke: 0x000000, strokeThickness: 2,
      fontFamily: 'Arial, sans-serif',
    });
    this.buffText.x = 14; this.buffText.y = 104;

    // ── Message text ──────────────────────────────────────────────────────────
    this.msgText = new Text('', {
      fontSize: 28, fill: 0xffff88, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 6,
      align: 'center', wordWrap: true, wordWrapWidth: screenW - 40,
      fontFamily: 'Arial, sans-serif',
    });
    this.msgText.anchor.set(0.5);
    this.msgText.visible = false;

    // ── Flash overlay ─────────────────────────────────────────────────────────
    this.flashGfx = new Graphics();
    this.flashGfx.alpha = 0;

    // Add to container
    this.container.addChild(this.hpBar);
    this.container.addChild(this.hpText);
    this.container.addChild(this.xpBar);
    this.container.addChild(this.levelText);
    this.container.addChild(this.waveText);
    this.container.addChild(this.floorText);
    this.container.addChild(this.buffText);
    this.container.addChild(this.bossPanel);
    this.container.addChild(this.comboText);
    this.container.addChild(this.msgText);
    this.container.addChild(this.flashGfx);

    this.layoutBossPanel();
    this.layoutMsg();
  }

  private drawHpBar(hpRatio: number, maxHp: number, currentHp: number) {
    const bw = 200, bh = 16, bx = 12, by = 12;
    this.hpBar.clear();

    // Backing track (dark glass)
    this.hpBar.beginFill(0x000000, 0.5);
    this.hpBar.drawRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 5);
    this.hpBar.endFill();
    this.hpBar.beginFill(0x111122, 0.7);
    this.hpBar.drawRoundedRect(bx, by, bw, bh, 4);
    this.hpBar.endFill();

    if (hpRatio > 0) {
      // HP color
      const fc = hpRatio > 0.5 ? 0x22ee55 : hpRatio > 0.25 ? 0xffaa00 : 0xff2222;
      // Fill
      this.hpBar.beginFill(fc);
      this.hpBar.drawRoundedRect(bx, by, bw * hpRatio, bh, 4);
      this.hpBar.endFill();
      // Sheen
      this.hpBar.beginFill(0xffffff, 0.22);
      this.hpBar.drawRoundedRect(bx + 1, by + 1, bw * hpRatio - 2, 5, 3);
      this.hpBar.endFill();
      // Pulse edge glow
      this.hpBar.beginFill(fc, 0.35);
      this.hpBar.drawRoundedRect(bx + bw * hpRatio - 4, by, 4, bh, 2);
      this.hpBar.endFill();
    }

    // Outer border
    this.hpBar.lineStyle(1, 0xffffff, 0.18);
    this.hpBar.drawRoundedRect(bx, by, bw, bh, 4);
    this.hpBar.lineStyle(0);

    this.hpText.text = `HP  ${currentHp} / ${maxHp}`;
  }

  private drawXpBar(xpRatio: number, level: number, xp: number, xpNeeded: number) {
    const bw = 200, bh = 8, bx = 12, by = 44;
    this.xpBar.clear();

    // Background
    this.xpBar.beginFill(0x000000, 0.45);
    this.xpBar.drawRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 4);
    this.xpBar.endFill();
    this.xpBar.beginFill(0x0a1122, 0.65);
    this.xpBar.drawRoundedRect(bx, by, bw, bh, 3);
    this.xpBar.endFill();

    // XP fill
    if (xpRatio > 0) {
      this.xpBar.beginFill(0x2299ff);
      this.xpBar.drawRoundedRect(bx, by, bw * xpRatio, bh, 3);
      this.xpBar.endFill();
      this.xpBar.beginFill(0xaaddff, 0.35);
      this.xpBar.drawRoundedRect(bx + 1, by + 1, bw * xpRatio - 2, 3, 2);
      this.xpBar.endFill();
    }

    this.xpBar.lineStyle(1, 0xffffff, 0.12);
    this.xpBar.drawRoundedRect(bx, by, bw, bh, 3);
    this.xpBar.lineStyle(0);

    this.levelText.text = `LV ${level}   XP ${xp}/${xpNeeded}`;
  }

  private layoutBossPanel() {
    this.bossPanel.x = this.screenW / 2 - 160;
    this.bossPanel.y = this.screenH - 56;
  }

  private layoutMsg() {
    this.msgText.x = this.screenW / 2;
    this.msgText.y = this.screenH / 3;
    this.msgText.style.wordWrapWidth = this.screenW - 40;
  }

  update(dt: number, player: Player, boss: Boss | null) {
    // HP bar
    const hpRatio = player.hp / player.maxHp;
    this.drawHpBar(hpRatio, player.maxHp, player.hp);

    // XP bar
    const xpNeeded = player.level * 50;
    const xpRatio = player.xp / xpNeeded;
    this.drawXpBar(xpRatio, player.level, player.xp, xpNeeded);

    // Combo counter
    if (player.comboCount >= 2) {
      this.comboText.visible = true;
      const mult = 1 + Math.min(player.comboCount * 0.1, 1.0);
      this.comboText.text = `${player.comboCount} COMBO!\nx${mult.toFixed(1)}`;
      this.comboScale = Math.max(1.0, this.comboScale - dt * 3);
      this.comboText.scale.set(this.comboScale);
      this.comboText.x = this.screenW - 80;
      this.comboText.y = this.screenH / 2 - 40;
      if (player.comboCount >= 10) {
        (this.comboText.style as any).fill = 0xff2222;
      } else if (player.comboCount >= 5) {
        (this.comboText.style as any).fill = 0xff8800;
      } else {
        (this.comboText.style as any).fill = 0xffcc00;
      }
    } else {
      this.comboText.visible = false;
    }

    // Buff indicator
    const buffs: string[] = [];
    if (player.crystalBuffTime > 0) buffs.push(`+PWR ${player.crystalBuffTime.toFixed(1)}s`);
    this.buffText.text = buffs.join('  ');

    // Boss HP
    if (boss && !boss.dead) {
      this.bossPanel.visible = true;
      const bossRatio = boss.hp / boss.maxHp;
      this.bossHpBar.clear();

      const bw = 320, bh = 14, bx = 0, by = 4;
      // Background
      this.bossHpBar.beginFill(0x000000, 0.55);
      this.bossHpBar.drawRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 5);
      this.bossHpBar.endFill();
      this.bossHpBar.beginFill(0x1a0000, 0.75);
      this.bossHpBar.drawRoundedRect(bx, by, bw, bh, 4);
      this.bossHpBar.endFill();

      if (bossRatio > 0) {
        const bossColor = boss.isEnraged ? 0xaa00ff : boss.isAngry ? 0xff2200 : 0xff5500;
        this.bossHpBar.beginFill(bossColor);
        this.bossHpBar.drawRoundedRect(bx, by, bw * bossRatio, bh, 4);
        this.bossHpBar.endFill();
        // Sheen
        this.bossHpBar.beginFill(0xffffff, 0.18);
        this.bossHpBar.drawRoundedRect(bx + 1, by + 1, bw * bossRatio - 2, 4, 3);
        this.bossHpBar.endFill();
      }

      // Phase markers
      this.bossHpBar.lineStyle(1.5, 0xffffff, 0.55);
      this.bossHpBar.moveTo(bx + bw * 0.5, by); this.bossHpBar.lineTo(bx + bw * 0.5, by + bh);
      this.bossHpBar.moveTo(bx + bw * 0.25, by); this.bossHpBar.lineTo(bx + bw * 0.25, by + bh);
      this.bossHpBar.lineStyle(0);
      // Border
      this.bossHpBar.lineStyle(1, 0xffffff, 0.22);
      this.bossHpBar.drawRoundedRect(bx, by, bw, bh, 4);
      this.bossHpBar.lineStyle(0);

      const phaseText = boss.isEnraged ? ' [PHASE 3]' : boss.isAngry ? ' [PHASE 2]' : '';
      this.bossTitleText.text = `BOSS${phaseText}`;
      if (boss.isEnraged) (this.bossTitleText.style as any).fill = 0xcc44ff;
      else if (boss.isAngry) (this.bossTitleText.style as any).fill = 0xff4422;
      else (this.bossTitleText.style as any).fill = 0xff8844;
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
      this.flashGfx.clear();
      this.flashGfx.beginFill(this.flashColor);
      this.flashGfx.drawRect(0, 0, this.screenW, this.screenH);
      this.flashGfx.endFill();
      this.flashGfx.alpha = this.flashAlpha;
    }
  }

  /** Pulse the combo counter (call on new hit) */
  pulseCombo() {
    this.comboScale = 1.4;
  }

  showWave(current: number, total: number) {
    this.waveText.text = `Wave ${current}/${total}`;
  }

  showFloor(floorNumber: number, totalFloors: number) {
    this.floorText.text = `B${floorNumber}F / ${totalFloors}F`;
  }

  showMessage(text: string, duration = 3) {
    this.msgText.text = text;
    this.msgText.visible = true;
    this.msgTimer = duration;
  }

  triggerFlash(color = 0xff0000, intensity = 0.7) {
    this.flashColor = color;
    this.flashAlpha = intensity;
  }

  onResize(screenW: number, screenH: number) {
    this.screenW = screenW; this.screenH = screenH;
    this.layoutBossPanel();
    this.layoutMsg();
    this.flashGfx.alpha = this.flashAlpha;
  }
}
