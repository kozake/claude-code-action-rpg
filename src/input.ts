import type { VirtualJoystick } from './ui/VirtualJoystick';
import type { AttackButton } from './ui/AttackButton';

export class InputManager {
  moveX = 0;
  moveY = 0;
  attack = false;
  attackPressed = false;
  skill = false;
  skillPressed = false;

  private keys = new Set<string>();
  private prevAttack = false;
  private prevSkill = false;

  constructor(
    private joystick: VirtualJoystick,
    private attackButton: AttackButton,
  ) {}

  init() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      // Prevent arrow keys from scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  update() {
    // Keyboard movement
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;

    // Joystick takes priority when active
    if (this.joystick.active) {
      this.moveX = this.joystick.x;
      this.moveY = this.joystick.y;
    } else {
      this.moveX = kx;
      this.moveY = ky;
      // Normalize diagonal
      const len = Math.sqrt(this.moveX ** 2 + this.moveY ** 2);
      if (len > 1) {
        this.moveX /= len;
        this.moveY /= len;
      }
    }

    // Attack
    this.prevAttack = this.attack;
    this.attack =
      this.keys.has('Space') ||
      this.keys.has('KeyZ') ||
      this.keys.has('KeyJ') ||
      this.attackButton.pressed;
    this.attackPressed = this.attack && !this.prevAttack;

    // Skill (dash) - X key or shift
    this.prevSkill = this.skill;
    this.skill =
      this.keys.has('KeyX') ||
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.attackButton.skillPressed;
    this.skillPressed = this.skill && !this.prevSkill;
  }
}
