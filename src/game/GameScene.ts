import { Container, Graphics, Text } from 'pixi.js';
import type { Application } from 'pixi.js';
import { WorldMap, TILE_SIZE } from './maps/WorldMap';
import { Player } from './entities/Player';
import { Enemy } from './entities/Enemy';
import { RangedEnemy } from './entities/RangedEnemy';
import { Boss } from './entities/Boss';
import { ChargerEnemy, BomberEnemy, ShieldEnemy, SummonerEnemy } from './entities/SpecialEnemies';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { AttackButton } from '../ui/AttackButton';
import { HUD } from '../ui/HUD';
import { Minimap } from '../ui/Minimap';
import { SkillSelectUI } from '../ui/SkillSelect';
import { InputManager } from '../input';
import { AudioManager } from '../audio';
import { ParticleSystem } from './Particles';
import { ProjectileSystem } from './Projectile';
import { ItemSystem } from './Items';
import { createDefaultSkillStats, getRandomSkills } from './Skills';
import type { Skill } from './Skills';

type GameState = 'title' | 'playing' | 'skill_select' | 'gameover' | 'win';

// Enemy sprite URLs no longer used (procedural rendering)

// Wave definitions: [tileCol, tileRow, type, hp, speed]
type EnemyType = 'basic' | 'ranged' | 'charger' | 'bomber' | 'shield' | 'summoner';
interface WaveDef {
  enemies: [number, number, EnemyType, number, number][];
  message: string;
}

const WAVES: WaveDef[] = [
  {
    message: '⚔ Wave 1: 前哨戦',
    enemies: [
      [14, 5, 'basic', 120, 82], [22, 8, 'basic', 115, 88],
      [9, 14, 'basic', 130, 82], [34, 4, 'basic', 120, 92],
      [27, 17, 'basic', 125, 78], [5, 8, 'basic', 110, 88],
      [40, 12, 'basic', 120, 84], [18, 20, 'basic', 115, 88],
      [45, 5, 'basic', 110, 92], [30, 25, 'basic', 130, 82],
    ],
  },
  {
    message: '⚔ Wave 2: 遠距離の脅威',
    enemies: [
      [38, 13, 'ranged', 145, 62], [42, 7, 'ranged', 145, 62],
      [30, 10, 'ranged', 155, 67], [7, 10, 'ranged', 140, 62],
      [15, 22, 'ranged', 148, 62], [35, 20, 'ranged', 142, 60],
      [18, 22, 'basic', 158, 92], [7, 20, 'basic', 165, 88],
      [46, 18, 'basic', 148, 98], [25, 6, 'basic', 155, 90],
      [40, 22, 'basic', 150, 92], [12, 6, 'basic', 152, 88],
    ],
  },
  {
    message: '⚔ Wave 3: 突撃部隊',
    enemies: [
      [15, 6, 'charger', 185, 78], [35, 10, 'charger', 185, 78],
      [8, 20, 'charger', 178, 82], [42, 18, 'charger', 180, 80],
      [25, 20, 'bomber', 105, 98], [10, 15, 'bomber', 105, 98],
      [40, 8, 'bomber', 100, 102], [20, 5, 'bomber', 105, 98],
      [40, 15, 'ranged', 165, 68], [28, 25, 'ranged', 160, 65],
    ],
  },
  {
    message: '⚔ Wave 4: 精鋭部隊',
    enemies: [
      [20, 10, 'shield', 230, 60], [30, 15, 'shield', 230, 60],
      [10, 6, 'shield', 220, 58], [44, 12, 'shield', 225, 62],
      [12, 20, 'summoner', 260, 44], [38, 20, 'summoner', 250, 42],
      [38, 8, 'charger', 205, 82], [14, 14, 'charger', 200, 80],
      [25, 5, 'ranged', 180, 68], [45, 20, 'bomber', 120, 102],
      [6, 14, 'bomber', 115, 100], [30, 22, 'ranged', 175, 65],
    ],
  },
  {
    message: '💀 Final Wave: 総攻撃',
    enemies: [
      [10, 8, 'charger', 220, 88], [40, 8, 'charger', 220, 88],
      [8, 20, 'charger', 215, 90], [42, 20, 'charger', 218, 88],
      [25, 12, 'summoner', 290, 50], [15, 25, 'summoner', 280, 48],
      [38, 25, 'summoner', 285, 48], [15, 18, 'shield', 260, 65],
      [35, 18, 'shield', 260, 65], [8, 12, 'shield', 250, 62],
      [44, 14, 'shield', 255, 64], [20, 24, 'bomber', 135, 108],
      [30, 24, 'bomber', 135, 108], [8, 5, 'bomber', 128, 110],
      [44, 5, 'bomber', 130, 108], [42, 22, 'ranged', 205, 70],
      [12, 22, 'ranged', 200, 70], [28, 8, 'ranged', 200, 70],
    ],
  },
];

export class GameScene {
  readonly container: Container;
  private world: Container;
  private ui: Container;

  private map: WorldMap;
  private player: Player;
  private enemies: Enemy[] = [];
  private boss: Boss;
  private particles: ParticleSystem;
  private projectiles: ProjectileSystem;
  private items: ItemSystem;

  private joystick: VirtualJoystick;
  private attackButton: AttackButton;
  private hud: HUD;
  private minimap: Minimap;
  private skillSelect: SkillSelectUI;
  private input: InputManager;
  private audio: AudioManager;

  private cameraX = 0;
  private cameraY = 0;
  private screenW: number;
  private screenH: number;

  private bossTriggered = false;
  private state: GameState = 'title';

  // Screen shake
  private shakeTime = 0;
  private shakeIntensity = 0;

  // Hit stop (freeze frame)
  private hitStopTime = 0;

  // Wave system
  private currentWave = 0;
  private waveActive = false;
  private waveDelay = 0;
  private allWavesCleared = false;

  // Boss entrance
  private bossEntranceTimer = 0;

  // Slow motion for boss kill
  private slowMoTime = 0;
  private slowMoScale = 1;

  // Results screen
  private resultsShown = false;

  private titleOverlay: Container;

  constructor(app: Application) {
    this.screenW = app.screen.width;
    this.screenH = app.screen.height;

    this.container = new Container();
    this.world = new Container();
    this.ui = new Container();
    this.container.addChild(this.world);
    this.container.addChild(this.ui);

    // Map
    this.map = new WorldMap(app.renderer as import('pixi.js').Renderer);
    this.world.addChild(this.map.container);

    // Player
    const skillStats = createDefaultSkillStats();
    const spawn = this.map.findSafeSpawn(3, 2);
    this.player = new Player(spawn.x, spawn.y, skillStats);
    this.world.addChild(this.player.container);

    // Boss
    this.boss = new Boss(TILE_SIZE * 25, TILE_SIZE * 35);
    this.boss.container.visible = false;
    this.world.addChild(this.boss.container);

    // Systems
    this.particles = new ParticleSystem();
    this.world.addChild(this.particles.container);
    this.projectiles = new ProjectileSystem();
    this.world.addChild(this.projectiles.container);
    this.items = new ItemSystem();
    this.world.addChild(this.items.container);

    // UI
    this.joystick = new VirtualJoystick(this.screenW, this.screenH);
    this.attackButton = new AttackButton(this.screenW, this.screenH);
    this.hud = new HUD(this.screenW, this.screenH);
    this.minimap = new Minimap(this.screenW, this.screenH, this.map);
    this.skillSelect = new SkillSelectUI(this.screenW, this.screenH);
    this.input = new InputManager(this.joystick, this.attackButton);
    this.audio = new AudioManager();

    this.input.init();

    this.ui.addChild(this.hud.container);
    this.ui.addChild(this.minimap.container);
    this.ui.addChild(this.joystick.container);
    this.ui.addChild(this.attackButton.container);
    this.ui.addChild(this.skillSelect.container);

    // Title
    this.titleOverlay = this.buildTitleOverlay();
    this.ui.addChild(this.titleOverlay);

    const startGame = () => {
      if (this.state !== 'title') return;
      this.state = 'playing';
      this.titleOverlay.visible = false;
      this.audio.unlock();
      this.audio.playField();
      this.startWave(0);
    };
    window.addEventListener('touchstart', startGame, { once: true });
    window.addEventListener('keydown', startGame, { once: true });
    window.addEventListener('click', startGame, { once: true });
  }

  private buildTitleOverlay(): Container {
    const overlay = new Container();
    const bg = new Graphics();
    bg.beginFill(0x000000, 0.78);
    bg.drawRect(0, 0, this.screenW, this.screenH);
    bg.endFill();
    overlay.addChild(bg);

    const title = new Text('⚔ Action RPG ⚔', {
      fontSize: 36, fill: 0xffdd44, fontWeight: 'bold',
      stroke: 0x000000, strokeThickness: 6, align: 'center',
    });
    title.anchor.set(0.5);
    title.x = this.screenW / 2; title.y = this.screenH / 2 - 80;
    overlay.addChild(title);

    const sub = new Text(
      'ウェーブを突破してボスを倒せ！\n\nスマホ: 左で移動 / 右⚔で攻撃 / 💨でスキル\nPC: WASD移動 / Space攻撃 / Xスキル\n\nタップまたはキーでスタート',
      { fontSize: 15, fill: 0xffffff, align: 'center', stroke: 0x000000, strokeThickness: 3, lineHeight: 22 },
    );
    sub.anchor.set(0.5);
    sub.x = this.screenW / 2; sub.y = this.screenH / 2 + 30;
    overlay.addChild(sub);
    return overlay;
  }

  private startWave(index: number) {
    if (index >= WAVES.length) {
      this.allWavesCleared = true;
      this.hud.showMessage('🚪 ボス部屋が開いた！\n奥へ進め！', 3);
      return;
    }
    this.currentWave = index;
    this.waveActive = true;
    const wave = WAVES[index];
    this.hud.showMessage(wave.message, 2);
    this.hud.showWave(index + 1, WAVES.length);

    for (const [tc, tr, type, hp, spd] of wave.enemies) {
      const px = tc * TILE_SIZE + TILE_SIZE / 2;
      const py = tr * TILE_SIZE + TILE_SIZE / 2;
      const e = this.createEnemy(type, px, py, hp, spd);
      this.enemies.push(e);
      this.world.addChild(e.container);
    }
  }

  private createEnemy(type: EnemyType, x: number, y: number, hp: number, spd: number): Enemy {
    switch (type) {
      case 'ranged': return new RangedEnemy(x, y, hp, spd);
      case 'charger': return new ChargerEnemy(x, y, hp, spd);
      case 'bomber': return new BomberEnemy(x, y, hp, spd);
      case 'shield': return new ShieldEnemy(x, y, hp, spd);
      case 'summoner': return new SummonerEnemy(x, y, hp, spd);
      default: {
        return new Enemy(x, y, hp, spd, 20, 38, 20, 36, 36);
      }
    }
  }

  private shake(intensity: number, duration = 0.25) {
    this.shakeIntensity = intensity; this.shakeTime = duration;
  }

  private hitStop(duration = 0.05) {
    this.hitStopTime = duration;
  }

  private readonly fireFn = (
    x: number, y: number, vx: number, vy: number,
    dmg: number, color?: number, radius?: number,
  ) => { this.projectiles.add(x, y, vx, vy, dmg, color, radius); };

  update(delta: number) {
    const rawDt = delta / 60;
    if (this.state === 'title') return;

    // Skill select pauses game
    if (this.state === 'skill_select') {
      this.skillSelect.update(rawDt);
      if (this.skillSelect.selectedSkill) {
        this.applySkill(this.skillSelect.selectedSkill);
        this.skillSelect.hide();
        this.state = 'playing';
      }
      return;
    }

    if (this.state === 'gameover' || this.state === 'win') return;

    // Hit stop freeze
    if (this.hitStopTime > 0) {
      this.hitStopTime -= rawDt;
      return;
    }

    // Slow motion
    const slowMult = this.slowMoTime > 0 ? this.slowMoScale : 1;
    this.slowMoTime = Math.max(0, this.slowMoTime - rawDt);
    const dt = rawDt * slowMult;

    this.input.update();
    this.map.updateAnimations(dt);

    // Player update
    const wasInvincible = this.player.invincibleTime > 0;
    this.player.update(dt, this.input, this.map);

    // Trap damage
    const trapDmg = this.map.checkTrap(this.player.x, this.player.y, dt);
    if (trapDmg > 0) {
      this.player.takeDamage(trapDmg);
      this.particles.emitHit(this.player.x, this.player.y);
      this.particles.showDamage(this.player.x, this.player.y, trapDmg, false);
    }

    // Screen shake on damage
    const tookDamage = !wasInvincible && this.player.invincibleTime > 0;
    if (tookDamage) {
      this.shake(8, 0.3);
      this.particles.emitHit(this.player.x, this.player.y);
    }

    // Player attacks
    this.handlePlayerAttacks(dt);

    // Items pickup
    const collected = this.items.update(dt, this.player.x, this.player.y);
    for (const item of collected) {
      if (item === 'heart') {
        this.player.heal(25);
        this.particles.emit(this.player.x, this.player.y, 6, 0xff4488, 80, 150, 0.4, 0.2, 3);
      } else if (item === 'xpGem') {
        this.player.addXp(15);
        this.particles.emit(this.player.x, this.player.y, 6, 0x44aaff, 80, 150, 0.4, 0.2, 3);
      } else if (item === 'crystal') {
        this.player.crystalBuffTime = 10;
        this.particles.emit(this.player.x, this.player.y, 10, 0xffdd44, 120, 200, 0.5, 0.3, 4);
      }
    }

    // Level up → skill selection
    if (this.player.justLeveledUp) {
      this.player.justLeveledUp = false;
      this.particles.showLevelUp(this.player.x, this.player.y - 20);
      this.hud.showMessage(`✨ LEVEL UP! Lv.${this.player.level}`, 2);
      const skills = getRandomSkills(3, this.player.acquiredSkillIds);
      if (skills.length > 0) {
        this.state = 'skill_select';
        this.skillSelect.show(skills);
      }
    }

    // Enemy updates
    for (const enemy of this.enemies) {
      enemy.update(dt, this.player, this.map, this.fireFn);
      // Handle summoner spawning
      if (enemy instanceof SummonerEnemy && (enemy as SummonerEnemy).pendingSummon) {
        (enemy as SummonerEnemy).pendingSummon = false;
        const minion = this.createEnemy('basic', enemy.x + 30, enemy.y + 30, 60, 90);
        this.enemies.push(minion);
        this.world.addChild(minion.container);
        this.particles.emit(enemy.x, enemy.y, 8, 0xcc44ff, 100, 200, 0.3, 0.2, 3);
      }
      // Bomber explosion particles
      if (enemy instanceof BomberEnemy && (enemy as BomberEnemy).exploded) {
        (enemy as BomberEnemy).exploded = false;
        this.particles.emitDeath(enemy.x, enemy.y, 0xff6600);
        this.particles.emitDeath(enemy.x, enemy.y, 0xffaa00);
        this.shake(10, 0.4);
      }
    }

    // Boss
    if (!this.boss.dead && this.bossTriggered) {
      if (this.bossEntranceTimer > 0) {
        this.bossEntranceTimer -= dt;
      } else {
        this.boss.update(dt, this.player, this.map, this.fireFn);
      }
    }

    // Projectiles
    this.projectiles.update(dt);
    const projHit = this.projectiles.checkHitPlayer(this.player);
    if (projHit) {
      const wasInv = this.player.invincibleTime > (1.2 - 0.01);
      if (!wasInv) { this.shake(6, 0.25); this.particles.emitHit(this.player.x, this.player.y); }
    }
    // Player projectile hits on enemies
    const projEnemyHits = this.projectiles.checkHitEnemies(this.enemies);
    for (const { enemy, damage } of projEnemyHits) {
      enemy.takeDamage(damage);
      this.particles.emitHit(enemy.x, enemy.y);
      this.particles.showDamage(enemy.x, enemy.y, damage, false);
      if (enemy.dead) {
        this.particles.emitDeath(enemy.x, enemy.y, 0x44cc44);
        this.player.addXp(enemy.xpReward);
        this.items.dropFromEnemy(enemy.x, enemy.y);
      }
    }

    // Wave completion check
    if (this.waveActive) {
      const allDead = this.enemies.every(e => e.dead);
      if (allDead) {
        this.waveActive = false;
        this.waveDelay = 1.5;
      }
    }
    if (!this.waveActive && !this.allWavesCleared && this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) {
        this.enemies = [];
        this.startWave(this.currentWave + 1);
      }
    }

    // Boss room entry
    const playerRow = Math.floor(this.player.y / TILE_SIZE);
    if (!this.bossTriggered && this.allWavesCleared && playerRow >= this.map.bossRowStart) {
      this.bossTriggered = true;
      this.audio.playBoss();
      this.shake(15, 0.5);
      this.hud.triggerFlash(0x440000, 0.8);
      this.map.lockBossRoom();
      this.boss.container.visible = true;
      // Boss entrance cinematic
      this.bossEntranceTimer = 1.5;
      this.hud.showMessage('👹 BOSS: 魔王降臨\n覚悟しろ！', 3);
    }

    // Boss phase transitions
    if (this.bossTriggered && !this.boss.dead) {
      if (this.boss.phaseTransitioned) {
        this.boss.phaseTransitioned = false;
        this.shake(15, 0.5);
        this.particles.emitBossRage(this.boss.x, this.boss.y);
        this.hud.triggerFlash(0xff0000, 0.8);
        this.hud.showMessage('⚠ PHASE 2 ⚠\n速度・ダメージ増加！', 2.5);
        this.hitStop(0.15);
      }
      if (this.boss.phase3Transitioned) {
        this.boss.phase3Transitioned = false;
        this.shake(20, 0.7);
        this.particles.emitBossRage(this.boss.x, this.boss.y);
        this.particles.emitBossRage(this.boss.x, this.boss.y);
        this.hud.triggerFlash(0xaa00ff, 1.0);
        this.hud.showMessage('💀 PHASE 3 💀\n弾幕・全力全開！', 3);
        this.hitStop(0.2);
      }
    }

    // Boss defeat
    if (this.boss.dead && this.bossTriggered && !this.resultsShown) {
      this.resultsShown = true;
      this.projectiles.clear();
      this.particles.emitDeath(this.boss.x, this.boss.y, 0x9900aa);
      this.particles.emitDeath(this.boss.x, this.boss.y, 0xff4400);
      this.particles.emitBossRage(this.boss.x, this.boss.y);
      this.map.unlockBossRoom();
      this.shake(20, 0.8);
      // Slow motion death
      this.slowMoTime = 1.5;
      this.slowMoScale = 0.2;
      setTimeout(() => {
        this.state = 'win';
        this.audio.stop();
        this.hud.showMessage(
          `🎉 YOU WIN!\nボスを倒した！\n\nLv.${this.player.level}  コンボ最大: ${this.player.comboCount}\n\nリロードして再プレイ`,
          9999,
        );
      }, 1500);
    }

    // Game over
    if (this.player.dead) {
      this.state = 'gameover';
      this.audio.stop();
      this.hud.showMessage('💀 GAME OVER\n\nリロードして再プレイ', 9999);
    }

    // Camera
    this.updateCamera(dt);
    this.particles.update(dt, this.cameraX, this.cameraY);

    // Minimap
    this.minimap.update(this.player.x, this.player.y, this.enemies, this.boss, this.bossTriggered);

    // HUD
    this.hud.update(dt, this.player, this.bossTriggered && !this.boss.dead ? this.boss : null);
  }

  private handlePlayerAttacks(dt: number) {
    const hitbox = this.player.getAttackHitbox();
    const fireSpinHb = this.player.getFireSpinHitbox();
    const dashStrikeHb = this.player.getDashStrikeHitbox();
    const hitboxes = [hitbox, fireSpinHb, dashStrikeHb].filter(Boolean) as { cx: number; cy: number; r: number }[];

    if (hitboxes.length === 0) return;

    // Destructible objects
    if (hitbox) {
      const broken = this.map.hitDestructible(hitbox.cx, hitbox.cy, hitbox.r);
      if (broken) {
        this.particles.emitDeath(broken.col * TILE_SIZE + TILE_SIZE / 2, broken.row * TILE_SIZE + TILE_SIZE / 2, 0x885533);
        this.items.dropFromDestructible(broken.col * TILE_SIZE + TILE_SIZE / 2, broken.row * TILE_SIZE + TILE_SIZE / 2);
      }
    }

    for (const hb of hitboxes) {
      // Check enemies
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (!this.circleHit(hb, enemy)) continue;

        // Shield check
        if (enemy instanceof ShieldEnemy && (enemy as ShieldEnemy).isBlocked(hb.cx, hb.cy)) {
          this.particles.emit(enemy.x, enemy.y, 3, 0x4488ff, 60, 100, 0.2, 0.1, 2);
          continue;
        }

        const { damage, isCrit } = this.player.getEffectiveDamage();
        const wasDead = enemy.dead;
        enemy.takeDamage(damage);

        if (!wasDead) {
          this.player.registerHit();
          this.hud.pulseCombo();

          // Knockback
          enemy.applyKnockback(this.player.x, this.player.y, 300 * this.player.skills.knockbackMult);

          this.particles.emitHit(hb.cx, hb.cy);
          this.particles.showDamage(enemy.x, enemy.y, damage, false, isCrit);

          // Vampiric heal
          if (this.player.skills.hasVampiric) {
            const heal = Math.round(damage * this.player.skills.vampiricRatio);
            if (heal > 0) this.player.heal(heal);
          }

          // Chain lightning
          if (this.player.skills.hasChainLightning) {
            for (const other of this.enemies) {
              if (other === enemy || other.dead) continue;
              const edx = other.x - enemy.x, edy = other.y - enemy.y;
              if (edx * edx + edy * edy < 120 * 120) {
                other.takeDamage(this.player.skills.chainLightningDamage);
                this.particles.emit(other.x, other.y, 4, 0x44aaff, 80, 150, 0.2, 0.1, 2);
              }
            }
          }

          // Hit stop on kill
          if (enemy.dead) {
            this.particles.emitDeath(enemy.x, enemy.y, 0x44cc44);
            this.player.addXp(enemy.xpReward);
            this.items.dropFromEnemy(enemy.x, enemy.y);
            this.hitStop(0.06);
          }
        }
      }

      // Boss
      if (!this.boss.dead && this.bossTriggered && this.circleHit(hb, this.boss)) {
        const { damage, isCrit } = this.player.getEffectiveDamage();
        const wasDeadBoss = this.boss.dead;
        this.boss.takeDamage(damage);
        if (!wasDeadBoss) {
          this.player.registerHit();
          this.hud.pulseCombo();
          this.boss.applyKnockback(this.player.x, this.player.y, 100 * this.player.skills.knockbackMult);
          this.particles.emitHit(hb.cx, hb.cy);
          this.particles.showDamage(this.boss.x, this.boss.y, damage, true, isCrit);
          if (this.player.skills.hasVampiric) {
            const heal = Math.round(damage * this.player.skills.vampiricRatio);
            if (heal > 0) this.player.heal(heal);
          }
        }
      }
    }

    // Ranged slash projectile
    if (hitbox && this.player.skills.hasRangedSlash && this.player.attackDuration > 0.13) {
      const speed = 300;
      this.projectiles.addPlayerProjectile(
        this.player.x, this.player.y,
        this.player.facingX * speed, this.player.facingY * speed,
        this.player.skills.rangedSlashDamage,
      );
    }
  }

  private applySkill(skill: Skill) {
    skill.apply(this.player.skills);
    this.player.acquiredSkillIds.add(skill.id);
    this.player.syncSkills();
    this.particles.emit(this.player.x, this.player.y, 15, 0xffdd44, 150, 200, 0.6, 0.3, 4);
    this.hud.showMessage(`${skill.icon} ${skill.name} 獲得！`, 2);
  }

  private circleHit(
    hb: { cx: number; cy: number; r: number },
    entity: { x: number; y: number; w: number; h: number },
  ): boolean {
    const closestX = Math.max(entity.x - entity.w / 2, Math.min(hb.cx, entity.x + entity.w / 2));
    const closestY = Math.max(entity.y - entity.h / 2, Math.min(hb.cy, entity.y + entity.h / 2));
    const dx = hb.cx - closestX, dy = hb.cy - closestY;
    return dx * dx + dy * dy <= hb.r * hb.r;
  }

  private updateCamera(dt: number) {
    const targetX = this.player.x - this.screenW / 2;
    const targetY = this.player.y - this.screenH / 2;
    const maxX = this.map.pixelWidth - this.screenW;
    const maxY = this.map.pixelHeight - this.screenH;
    this.cameraX = Math.max(0, Math.min(maxX, targetX));
    this.cameraY = Math.max(0, Math.min(maxY, targetY));

    let shakeOffX = 0, shakeOffY = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const intensity = this.shakeIntensity * (this.shakeTime / 0.25);
      shakeOffX = (Math.random() - 0.5) * intensity * 2;
      shakeOffY = (Math.random() - 0.5) * intensity * 2;
    }
    this.world.x = -this.cameraX + shakeOffX;
    this.world.y = -this.cameraY + shakeOffY;
  }

  onResize(w: number, h: number) {
    this.screenW = w; this.screenH = h;
    this.hud.onResize(w, h);
    this.minimap.onResize(w, h);
    this.joystick.onResize(w, h);
    this.attackButton.onResize(w, h);
    this.skillSelect.onResize(w, h);
    if (this.titleOverlay.children[0] instanceof Graphics) {
      const bg = this.titleOverlay.children[0] as Graphics;
      bg.clear(); bg.beginFill(0x000000, 0.78); bg.drawRect(0, 0, w, h); bg.endFill();
    }
  }
}
