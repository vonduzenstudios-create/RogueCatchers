export type Action = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'menu';

const KEY_MAP: Record<string, Action> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'confirm',
  Space: 'confirm',
  KeyZ: 'confirm',
  Escape: 'cancel',
  Backspace: 'cancel',
  KeyX: 'cancel',
  Tab: 'menu',
};

/**
 * Keyboard input mapped to game actions. `isDown` is for held keys
 * (walking), `wasPressed` fires once per press (menus, dialogue).
 */
export class Input {
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  /** Most recently pressed direction still held, so walking feels responsive. */
  private directionStack: Action[] = [];

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      e.preventDefault();
      if (!this.down.has(action)) {
        this.pressed.add(action);
        if (isDirection(action)) this.directionStack.push(action);
      }
      this.down.add(action);
    });
    target.addEventListener('keyup', (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      this.down.delete(action);
      this.directionStack = this.directionStack.filter((a) => a !== action);
    });
    target.addEventListener('blur', () => {
      this.down.clear();
      this.directionStack = [];
    });
  }

  isDown(action: Action): boolean {
    return this.down.has(action);
  }

  wasPressed(action: Action): boolean {
    return this.pressed.has(action);
  }

  /** The direction the player most recently pressed and is still holding. */
  heldDirection(): Action | null {
    return this.directionStack.at(-1) ?? null;
  }

  /** Call once at the end of every frame. */
  endFrame(): void {
    this.pressed.clear();
  }
}

function isDirection(action: Action): boolean {
  return action === 'up' || action === 'down' || action === 'left' || action === 'right';
}
