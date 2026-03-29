import { Container, Graphics, Text } from 'pixi.js';
import type { Application } from 'pixi.js';
import { WorldMap, TILE_SIZE } from './maps/WorldMap';
import { Player } from './entities/Player';
import { Enemy } from './entities/Enemy';
import { RangedEnemy } from './entities/RangedEnemy';
import { Boss } from './entities/Boss';
import { ChargerEnemy, BomberEnemy, ShieldEnemy, SummonerEnemy } from './entities/SpecialEnemies';
import { Companion } from './entities/Companion';
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
import { ScreenEffects } from './ScreenEffects';
import { createDefaultSkillStats, getRandomSkills } from './Skills';
import { buildFloorConfigs } from './DungeonConfig';
import type { Skill } from './Skills';
import type { FloorConfig, EnemyType } from './DungeonConfig';

type GameState = 'title' | 'playing' | 'skill_select' | 'gameover' | 'win' | 'floor_transition';

export class GameScene {
  readonly container: Container;
  private world: Container;
  private ui: Container;

  private app: Application;
  private map: WorldMap;
  private player: Player;
  private enemies: Enemy[] = [];
  private boss: Boss;
  private particles: ParticleSystem;
  private projectiles: ProjectileSystem;
  private items: ItemSystem;
  private screenEffects: ScreenEffects;

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

  private companion: Companion | null = null;
  private companionSpawned = false;
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
  private footstepTimer = 0;

  // Slow motion for boss kill
  private slowMoTime = 0;
  private slowMoScale = 1;

  // Results screen
  private resultsShown = false;

  // Dungeon floor system
  private floorConfigs: FloorConfig[];
  private currentFloor = 0; // index into floorConfigs
  private totalFloors: number;

  private titleOverlay: Container;

  constructor(app: Application) {
    this.app = app;
    this.screenW = app.screen.width;
    this.screenH = app.screen.height;

    // Build floor configs
    this.floorConfigs = buildFloorConfigs();
    this.totalFloors = this.floorConfigs.length;

    this.container = new Container();
    this.world = new Container();
    this.ui = new Container();
    this.container.addChild(this.world);
    this.container.addChild(this.ui);

    // Map (first floor)
    const firstFloor = this.floorConfigs[0];
    this.map = new WorldMap(app.renderer as import('pixi.js').Renderer, firstFloor);
    this.world.addChild(this.map.container);

    // Player
    const skillStats = createDefaultSkillStats();
    const spawn = this.map.getSpawnPosition();
    this.player = new Player(spawn.x, spawn.y, skillStats);
    this.world.addChild(this.player.container);

    // Boss (created but hidden until floor 5)
    this.boss = new Boss(TILE_SIZE * 15, TILE_SIZE * 15);
    this.boss.container.visible = false;
    this.world.addChild(this.boss.container);

    // Systems
    this.particles = new ParticleSystem();
    this.world.addChild(this.particles.container);
    this.projectiles = new ProjectileSystem();
    this.world.addChild(this.projectiles.container);
    this.items = new ItemSystem();
    this.world.addChild(this.items.container);

    // Screen effects
    this.screenEffects = new ScreenEffects(this.screenW, this.screenH);

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
    this.ui.addChild(this.screenEffects.container);

    // Title
    this.titleOverlay = this.buildTitleOverlay();
    this.ui.addChild(this.titleOverlay);

    const startGame = () => {
      if (this.state !== 'title') return;
      this.state = 'playing';
      this.titleOverlay.visible = false;
      this.audio.unlock();
      this.audio.playFloor(0);
      this.startFloorWave(0);
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
      '全10階のダンジョンを踏破し\n魔王を倒せ！\n\nスマホ: 左で移動 / 右⚔で攻撃 / 💨でスキル\nPC: WASD移動 / Space攻撃 / Xスキル\n\nタップまたはキーでスタート',
      { fontSize: 15, fill: 0xffffff, align: 'center', stroke: 0x000000, strokeThickness: 3, lineHeight: 22 },
    );
    sub.anchor.set(0.5);
    sub.x = this.screenW / 2; sub.y = this.screenH / 2 + 30;
    overlay.addChild(sub);
    return overlay;
  }

  private startFloorWave(index: number) {
    const config = this.floorConfigs[this.currentFloor];
    this.hud.showFloor(this.currentFloor + 1, this.totalFloors);
    if (index >= config.waves.length) {
      this.allWavesCleared = true;
      if (config.hasBoss) {
        // Boss floor - trigger boss directly
        this.triggerBoss();
      } else {
        // Show stairs
        this.map.showStairs();
        this.hud.showMessage('🚪 階段が現れた！\n次の階へ進め！', 3);
        this.audio.playSfxStairs();
        // Activate stairs navigation indicators
        const stairsX = this.map.stairsCol * TILE_SIZE + TILE_SIZE / 2;
        const stairsY = this.map.stairsRow * TILE_SIZE + TILE_SIZE / 2;
        this.hud.setStairsTarget(stairsX, stairsY);
        this.minimap.showStairs(this.map.stairsCol, this.map.stairsRow);
      }
      return;
    }
    this.currentWave = index;
    this.waveActive = true;
    const wave = config.waves[index];
    this.hud.showMessage(wave.message, 2);
    this.hud.showWave(index + 1, config.waves.length);

    // Spawn enemies from wave composition using room centers
    const centers = this.map.getRoomCenters();
    for (const comp of wave.composition) {
      const hp = Math.round(comp.hpBase * config.enemyHpMult);
      const spd = Math.round(comp.speedBase * config.enemySpeedMult);
      for (let i = 0; i < comp.count; i++) {
        // Pick a random room center (avoid spawn room = index 0)
        const roomIdx = centers.length > 1 ? 1 + Math.floor(Math.random() * (centers.length - 1)) : 0;
        const center = centers[roomIdx];
        const ox = (Math.random() - 0.5) * TILE_SIZE * 3;
        const oy = (Math.random() - 0.5) * TILE_SIZE * 3;
        const spawnCol = Math.floor((center.x + ox) / TILE_SIZE);
        const spawnRow = Math.floor((center.y + oy) / TILE_SIZE);
        const { x: px, y: py } = this.map.findSafeSpawn(spawnCol, spawnRow);
        const e = this.createEnemy(comp.type, px, py, hp, spd);
        this.enemies.push(e);
        this.world.addChild(e.container);
      }
    }
  }

  private triggerBoss() {
    this.bossTriggered = true;
    // Position boss in arena center
    const centers = this.map.getRoomCenters();
    const arena = centers.length > 1 ? centers[centers.length - 1] : centers[0];
    this.boss.x = arena.x;
    this.boss.y = arena.y;
    this.boss.container.x = arena.x;
    this.boss.container.y = arena.y;
    this.boss.container.visible = true;
    this.map.lockBossRoom();

    // Set roar animation on boss (wings spread)
    this.boss.roarAnimTimer = 2.5;

    // Long entrance timer — cinematic will call back to set it to 0
    this.bossEntranceTimer = 999;

    // Start boss BGM after a brief delay (0.8s into the darken phase)
    setTimeout(() => this.audio.playBoss(), 900);

    // Initial shake on room lock
    this.shake(10, 0.4);

    // Start cinematic intro
    this.screenEffects.startBossIntro(
      '「魔王ザルガン」降臨',
      '…ようやく辿り着いたか。\nこの城に踏み込んだ愚か者よ…\n貴様の命、ここで終わりだ！',
      () => {
        // Cinematic complete — begin battle
        this.bossEntranceTimer = 0;
        this.hud.triggerFlash(0x440000, 0.8);
        this.shake(18, 0.6);
        this.hud.showMessage('👹 BOSS: 魔王ザルガン', 2.5);
      },
    );
  }

  private transitionToNextFloor() {
    if (this.currentFloor >= this.totalFloors - 1) return;
    const nextFloor = this.currentFloor + 1;
    const nextConfig = this.floorConfigs[nextFloor];
    const floorLabel = `B${nextFloor + 1}F`;
    const themeName = nextConfig.theme.nameJa;

    this.state = 'floor_transition';
    this.audio.playSfxFloorTransition();
    this.screenEffects.startFloorTransition(
      `${floorLabel} ─ ${themeName}`,
      nextConfig.hasBoss ? '最終階 ─ ボスが待ち受ける' : `ダンジョン 第${nextFloor + 1}層`,
      // onMidpoint: rebuild the floor
      () => {
        // Cleanup current floor
        this.world.removeChild(this.map.container);
        this.map.destroy();
        for (const e of this.enemies) this.world.removeChild(e.container);
        this.enemies = [];
        this.projectiles.clear();
        this.items.clear();

        // Build new floor
        this.currentFloor = nextFloor;
        this.map = new WorldMap(this.app.renderer as import('pixi.js').Renderer, nextConfig);
        this.world.addChildAt(this.map.container, 0);

        // Reset player position and heal
        const spawn = this.map.getSpawnPosition();
        this.player.x = spawn.x;
        this.player.y = spawn.y;
        this.player.container.x = spawn.x;
        this.player.container.y = spawn.y;
        if (nextConfig.healPercent > 0) {
          const healAmt = Math.round(this.player.maxHp * nextConfig.healPercent);
          this.player.heal(healAmt);
        }

        // Reset wave state
        this.currentWave = 0;
        this.waveActive = false;
        this.waveDelay = 0;
        this.allWavesCleared = false;
        this.hud.clearStairsTarget();

        // Reset companion position
        if (this.companion) {
          this.companion.x = spawn.x - 40;
          this.companion.y = spawn.y;
          this.companion.container.x = this.companion.x;
          this.companion.container.y = this.companion.y;
          // Heal companion on floor transition
          if (this.companion.state === 'downed' || this.companion.state === 'reviving') {
            this.companion.state = 'follow';
            this.companion.dead = false;
          }
          this.companion.heal(Math.round(this.companion.maxHp * 0.3));
        }

        // Rebuild minimap
        this.minimap.rebuild(this.map);

        // Boss floor setup
        if (nextConfig.hasBoss) {
          const centers = this.map.getRoomCenters();
          const arena = centers.length > 1 ? centers[centers.length - 1] : centers[0];
          this.boss = new Boss(arena.x, arena.y);
          this.boss.container.visible = false;
          this.world.addChild(this.boss.container);
          this.bossTriggered = false;
          this.resultsShown = false;
        }
      },
      // onComplete: resume play
      () => {
        this.state = 'playing';
        if (this.floorConfigs[this.currentFloor].hasBoss) {
          // Boss floor: trigger boss immediately
          this.triggerBoss();
        } else {
          this.audio.playFloor(this.currentFloor);
          this.startFloorWave(0);
        }
      },
    );
  }

  private createEnemy(type: EnemyType, x: number, y: number, hp: number, spd: number): Enemy {
    switch (type) {
      case 'ranged': return new RangedEnemy(x, y, hp, spd);
      case 'charger': return new ChargerEnemy(x, y, hp, spd);
      case 'bomber': return new BomberEnemy(x, y, hp, spd);
      case 'shield': return new ShieldEnemy(x, y, hp, spd);
      case 'summoner': return new SummonerEnemy(x, y, hp, spd);
      default: {
        return new Enemy(x, y, hp, spd, 40, 38, 20, 36, 36);
      }
    }
  }

  private spawnCompanion() {
    const cx = this.player.x - this.player.facingX * 50;
    const cy = this.player.y - this.player.facingY * 50;
    this.companion = new Companion(cx, cy);
    this.companion.syncWithPlayer(this.player);
    this.world.addChild(this.companion.container);
    // Wire up magic shot callback
    this.companion.onFireMagic = (x, y, vx, vy, damage) => {
      this.projectiles.addCompanionProjectile(x, y, vx, vy, damage);
      this.audio.playSfxHit();
    };
    this.hud.showMessage('✨ 仲間が駆けつけた！', 2.5);
    this.particles.emit(cx, cy, 15, 0xff88cc, 120, 200, 0.5, 0.3, 4);
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

    // Floor transition animation
    if (this.state === 'floor_transition') {
      this.screenEffects.update(rawDt);
      return;
    }

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

    // Update screen effects (vignette etc.)
    this.screenEffects.update(rawDt);

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
      this.player.takeDamage(trapDmg, this.player.x, this.player.y + 10);
      this.particles.emitHit(this.player.x, this.player.y);
      this.particles.showDamage(this.player.x, this.player.y, trapDmg, false);
    }

    // Screen shake on damage
    const tookDamage = !wasInvincible && this.player.invincibleTime > 0;
    if (tookDamage) {
      this.shake(8, 0.3);
      this.particles.emitHit(this.player.x, this.player.y);
      this.audio.playSfxPlayerHurt();
    }

    // Companion update
    if (this.companion) {
      this.companion.syncWithPlayer(this.player);
      this.companion.update(dt, this.player, this.enemies, this.map);
      this.handleCompanionAttacks();
    }

    // Player attacks
    this.handlePlayerAttacks(dt);

    // Items pickup
    const collected = this.items.update(dt, this.player.x, this.player.y);
    for (const item of collected) {
      if (item === 'heart') {
        this.player.heal(25);
        this.particles.emit(this.player.x, this.player.y, 6, 0xff4488, 80, 150, 0.4, 0.2, 3);
        this.audio.playSfxPickup();
      } else if (item === 'xpGem') {
        this.player.addXp(15);
        this.particles.emit(this.player.x, this.player.y, 6, 0x44aaff, 80, 150, 0.4, 0.2, 3);
        this.audio.playSfxPickup();
      } else if (item === 'crystal') {
        this.player.crystalBuffTime = 10;
        this.particles.emit(this.player.x, this.player.y, 10, 0xffdd44, 120, 200, 0.5, 0.3, 4);
        this.audio.playSfxPickup();
      }
    }

    // Level up → skill selection
    if (this.player.justLeveledUp) {
      this.player.justLeveledUp = false;
      this.particles.showLevelUp(this.player.x, this.player.y - 20);
      this.hud.showMessage(`✨ LEVEL UP! Lv.${this.player.level}`, 2);
      this.audio.playSfxLevelUp();
      const skills = getRandomSkills(3, this.player.acquiredSkillIds);
      if (skills.length > 0) {
        this.state = 'skill_select';
        this.skillSelect.show(skills);
      }
    }

    // Enemy damage to companion (contact damage)
    if (this.companion && this.companion.state !== 'downed' && this.companion.state !== 'reviving') {
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        const dx = enemy.x - this.companion.x;
        const dy = enemy.y - this.companion.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < enemy.attackRange) {
          this.companion.takeDamage(Math.round(enemy.damage * 0.5), enemy.x, enemy.y);
          if (this.companion.dead) {
            this.particles.emitHit(this.companion.x, this.companion.y);
          }
        }
      }
    }

    // Enemy updates
    for (const enemy of this.enemies) {
      enemy.update(dt, this.player, this.map, this.fireFn);
      // Handle summoner spawning
      if (enemy instanceof SummonerEnemy && (enemy as SummonerEnemy).pendingSummon) {
        (enemy as SummonerEnemy).pendingSummon = false;
        const mc = Math.floor((enemy.x + 30) / TILE_SIZE), mr = Math.floor((enemy.y + 30) / TILE_SIZE);
        const { x: mx, y: my } = this.map.findSafeSpawn(mc, mr);
        const minion = this.createEnemy('basic', mx, my, 120, 104);
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
        // Still in cinematic — just update boss animations (no AI)
        this.boss.roarAnimTimer = Math.max(0, this.boss.roarAnimTimer - dt);
      } else {
        const prevCount = this.projectiles.count;
        this.boss.update(dt, this.player, this.map, this.fireFn);
        if (this.projectiles.count > prevCount) {
          this.audio.playSfxBossShoot();
        }
        // Ground slam explosion
        if (this.boss.groundSlamActive) {
          this.boss.groundSlamActive = false;
          const blastX = this.boss.groundSlamX;
          const blastY = this.boss.groundSlamY;
          const blastR = this.boss.groundSlamR;
          // Player hit check
          const pdx = this.player.x - blastX, pdy = this.player.y - blastY;
          if (pdx * pdx + pdy * pdy < blastR * blastR) {
            this.player.takeDamage(this.boss.damage, blastX, blastY);
          }
          // Companion hit check
          if (this.companion && !this.companion.dead) {
            const cdx = this.companion.x - blastX, cdy = this.companion.y - blastY;
            if (cdx * cdx + cdy * cdy < blastR * blastR) {
              this.companion.takeDamage(Math.round(this.boss.damage * 0.6), blastX, blastY);
            }
          }
          this.particles.emitDeath(blastX, blastY, 0xff4400);
          this.particles.emitDeath(blastX, blastY, 0xff8800);
          this.shake(10, 0.35);
          this.audio.playSfxBossShoot();
        }
      }
    }

    // Projectiles
    this.projectiles.update(dt);
    const projHit = this.projectiles.checkHitPlayer(this.player);
    if (projHit) {
      const wasInv = this.player.invincibleTime > (1.2 - 0.01);
      if (!wasInv) { this.shake(6, 0.25); this.particles.emitHit(this.player.x, this.player.y); this.audio.playSfxPlayerHurt(); }
    }
    // Player/companion projectile hits on enemies
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
    // Player/companion projectile hits on boss
    if (this.bossTriggered && !this.boss.dead && this.bossEntranceTimer <= 0) {
      const projBossHits = this.projectiles.checkHitEnemies([this.boss]);
      for (const { damage } of projBossHits) {
        this.boss.takeDamage(damage);
        this.particles.emitHit(this.boss.x, this.boss.y);
        this.particles.showDamage(this.boss.x, this.boss.y, damage, true);
        this.audio.playSfxHit();
      }
    }

    // Wave completion check
    if (this.waveActive) {
      const allDead = this.enemies.every(e => e.fullyDead);
      if (allDead) {
        this.waveActive = false;
        this.waveDelay = 1.5;

        // Spawn companion after first wave clear
        if (!this.companionSpawned) {
          this.companionSpawned = true;
          this.spawnCompanion();
        }
      }
    }
    if (!this.waveActive && !this.allWavesCleared && this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) {
        this.enemies = [];
        this.startFloorWave(this.currentWave + 1);
      }
    }

    // Stairs check (non-boss floors)
    if (this.allWavesCleared && !this.floorConfigs[this.currentFloor].hasBoss) {
      if (this.map.isOnStairs(this.player.x, this.player.y)) {
        this.transitionToNextFloor();
        return;
      }
    }

    // Boss phase transitions
    if (this.bossTriggered && !this.boss.dead) {
      if (this.boss.phaseTransitioned) {
        this.boss.phaseTransitioned = false;
        this.shake(15, 0.5);
        this.particles.emitBossRage(this.boss.x, this.boss.y);
        this.hud.triggerFlash(0xff0000, 0.8);
        this.hud.showMessage('⚠ PHASE 2 ⚠\n突進・弾幕強化！', 2.5);
        this.hitStop(0.15);
        this.audio.playSfxBossPhase();
      }
      if (this.boss.phase3Transitioned) {
        this.boss.phase3Transitioned = false;
        this.shake(20, 0.7);
        this.particles.emitBossRage(this.boss.x, this.boss.y);
        this.particles.emitBossRage(this.boss.x, this.boss.y);
        this.hud.triggerFlash(0xaa00ff, 1.0);
        this.hud.showMessage('💀 PHASE 3 💀\n弾幕・全力全開！', 3);
        this.hitStop(0.2);
        this.audio.playSfxBossPhase();
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
        this.audio.playSfxVictory();
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
      this.audio.playSfxGameOver();
      this.hud.showMessage('💀 GAME OVER\n\nリロードして再プレイ', 9999);
    }

    // Footstep particles
    const isMoving = this.input.moveX !== 0 || this.input.moveY !== 0;
    if (isMoving && !this.player.isDashing) {
      this.footstepTimer += dt;
      if (this.footstepTimer > 0.15) {
        this.footstepTimer -= 0.15;
        this.particles.emitFootstep(this.player.x, this.player.y);
      }
    } else {
      this.footstepTimer = 0;
    }

    // Ambient environment particles
    const floorCfg = this.floorConfigs[this.currentFloor];
    if (floorCfg) {
      const sw = this.app.screen.width;
      const sh = this.app.screen.height;
      this.particles.emitAmbient(dt, floorCfg.theme.name, this.cameraX + sw / 2, this.cameraY + sh / 2, sw, sh);
    }

    // Camera
    this.updateCamera(dt);
    this.particles.update(dt, this.cameraX, this.cameraY);

    // Minimap
    this.minimap.update(dt, this.player.x, this.player.y, this.enemies, this.boss, this.bossTriggered, this.companion);

    // HUD
    this.hud.update(dt, this.player, this.bossTriggered && !this.boss.dead ? this.boss : null);
    this.hud.updateStairsIndicator(dt, this.player.x, this.player.y, this.cameraX, this.cameraY);
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

          // SFX
          if (isCrit) this.audio.playSfxCrit();
          else this.audio.playSfxHit();

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
            this.audio.playSfxEnemyDeath();
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
          if (isCrit) this.audio.playSfxCrit();
          else this.audio.playSfxHit();
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

  private handleCompanionAttacks() {
    if (!this.companion) return;
    const hb = this.companion.getAttackHitbox();
    if (!hb) return;

    // Check enemies
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (!this.circleHit(hb, enemy)) continue;

      // Shield check
      if (enemy instanceof ShieldEnemy && (enemy as ShieldEnemy).isBlocked(hb.cx, hb.cy)) continue;

      const damage = this.companion.attackDamage;
      enemy.takeDamage(damage);
      enemy.applyKnockback(this.companion.x, this.companion.y, 150);
      this.particles.emitHit(hb.cx, hb.cy);
      this.particles.showDamage(enemy.x, enemy.y, damage, false);
      this.audio.playSfxHit();

      if (enemy.dead) {
        this.particles.emitDeath(enemy.x, enemy.y, 0x44cc44);
        this.player.addXp(enemy.xpReward);
        this.items.dropFromEnemy(enemy.x, enemy.y);
        this.audio.playSfxEnemyDeath();
      }
    }

    // Check boss
    if (!this.boss.dead && this.bossTriggered && this.circleHit(hb, this.boss)) {
      const damage = this.companion.attackDamage;
      this.boss.takeDamage(damage);
      this.boss.applyKnockback(this.companion.x, this.companion.y, 50);
      this.particles.emitHit(hb.cx, hb.cy);
      this.particles.showDamage(this.boss.x, this.boss.y, damage, true);
      this.audio.playSfxHit();
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
    this.screenEffects.resize(w, h);
    if (this.titleOverlay.children[0] instanceof Graphics) {
      const bg = this.titleOverlay.children[0] as Graphics;
      bg.clear(); bg.beginFill(0x000000, 0.78); bg.drawRect(0, 0, w, h); bg.endFill();
    }
  }
}
