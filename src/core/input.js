/**
 * Keyboard + pointer-lock mouse input for the development inspection camera.
 *
 * Deliberately independent of the future gameplay camera/character controller:
 * this is a debug tool first, so it grabs everything it needs and exposes a
 * very small API (`isDown`, `consumeMouse`, `consumeWheel`, `consumePressed`).
 */

export class Input {
  constructor(target) {
    this.target = target;
    this.down = new Set();
    this.pressed = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.wheel = 0;
    this.locked = false;
    this._enabled = true;
    // combat input: mouse buttons (0 LMB · 1 MMB · 2 RMB). Only recorded while
    // the pointer is locked, so the click that *captures* the mouse can never
    // double as the swing that starts a fight.
    this.mouseDown = new Set();
    this.mousePressed = [];

    this._onKeyDown = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      // Space on a focused <button> belongs to the button (a11y: the browser
      // activates it). Every other key keeps working with a button focused —
      // the player clicks a menu button, then walks away with WASD.
      if (t && t.tagName === 'BUTTON' && e.code === 'Space') return;
      if (KEYS_BLOCKED.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.push(e.code);
    };
    this._onKeyUp = (e) => this.down.delete(e.code);
    // A lost focus must release *every* input: a keyup outside the window is
    // never seen, and a click-drag released behind a modal never fires —
    // without this the player comes back to a character sprinting on their own.
    this._resetHeld = () => {
      this.down.clear();
      this.pressed.length = 0;
      this.mouseDown.clear();
      this.mousePressed.length = 0;
      this.mouseX = 0;
      this.mouseY = 0;
      this.wheel = 0;
    };
    this._onBlur = () => this._resetHeld();
    // Tab switches do not always blur the window — watch visibility too, or
    // alt-tabbing mid-walk leaves a ghost holding W until you press it again.
    this._onVisibility = () => {
      if (document.hidden) this._resetHeld();
    };
    this._onMouseMove = (e) => {
      if (!this.locked) return;
      this.mouseX += e.movementX || 0;
      this.mouseY += e.movementY || 0;
    };
    this._onMouseDown = (e) => {
      if (!this.locked) return; // an unlocked click belongs to pointer-lock
      if (!this.mouseDown.has(e.button)) {
        this.mouseDown.add(e.button);
        this.mousePressed.push(e.button);
      }
      // button 2 (RMB) is the guard: never let it select text behind the canvas
      if (e.button === 2) e.preventDefault();
    };
    this._onMouseUp = (e) => this.mouseDown.delete(e.button);
    this._onWheel = (e) => {
      if (!this.locked) return;
      this.wheel += e.deltaY;
      e.preventDefault();
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.target;
      this.onLockChange?.(this.locked);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onVisibility);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
    target.addEventListener('wheel', this._onWheel, { passive: false });
  }

  requestLock() {
    if (this.locked) return;
    const p = this.target.requestPointerLock?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  exitLock() {
    if (this.locked) document.exitPointerLock?.();
  }

  isDown(code) {
    return this.down.has(code);
  }

  consumeMouse() {
    const v = { x: this.mouseX, y: this.mouseY };
    this.mouseX = 0;
    this.mouseY = 0;
    return v;
  }

  consumeWheel() {
    const v = this.wheel;
    this.wheel = 0;
    return v;
  }

  consumePressed() {
    const v = this.pressed;
    this.pressed = [];
    return v;
  }

  /** Buttons pressed since the last call (0 LMB · 1 MMB · 2 RMB). */
  consumeMousePressed() {
    const v = this.mousePressed;
    this.mousePressed = [];
    return v;
  }

  /** Is a mouse button currently held? */
  isMouseDown(button) {
    return this.mouseDown.has(button);
  }

  /* ------------------------ test injection (headless) ------------------- *
   * Used by scripts/smoke.mjs: real pointer lock is unreliable in headless
   * Edge, so tests drive the same state the event handlers write to.
   */

  /** Hold or release a key programmatically. */
  setKey(code, down) {
    if (down) {
      if (!this.down.has(code)) {
        this.down.add(code);
        this.pressed.push(code);
      }
    } else {
      this.down.delete(code);
    }
  }

  /** Queue a single key press without holding it. */
  injectPress(code) {
    this.pressed.push(code);
  }

  /** Hold or release a mouse button programmatically (headless combat tests). */
  setMouseButton(button, down) {
    if (down) {
      if (!this.mouseDown.has(button)) {
        this.mouseDown.add(button);
        this.mousePressed.push(button);
      }
    } else {
      this.mouseDown.delete(button);
    }
  }

  /** Queue a single mouse-button press without holding it. */
  injectMousePress(button) {
    this.mousePressed.push(button);
  }

  /** Accumulate mouse delta as if the pointer were locked. */
  simulateMouse(dx, dy) {
    this.mouseX += dx;
    this.mouseY += dy;
  }

  clearAll() {
    this._resetHeld();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('visibilitychange', this._onVisibility);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    this.target.removeEventListener('wheel', this._onWheel);
  }
}

const KEYS_BLOCKED = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'F5', // camera-mode toggle, must not reload the page
]);
