/**
 * The Requital — MEMORY THIEF v2 (docs/GAME-DESIGN.md §3, §9).
 *
 * Hold E on a subdued enemy to rip out everything that group knows:
 * its style, its weapon, its powers, its knowledge. The channel takes
 * CHANNEL_TIME seconds of standing still with the key down; releasing
 * E cancels it. A completed channel:
 *
 *   1. `state.grantGroup(group)`  — anti-duplicate grant (style/weapon/
 *      powers/knowledge; tops HP on a first steal)
 *   2. `spawner.defeatGroup(id)`  — the territory ring goes gold, the
 *      figures dissolve, the group never spawns again
 *
 * A group is only *ready* when every one of its live members is subdued —
 * you clear the fight, then you take the memory. One fighter standing
 * means the Requital stays locked.
 *
 * DOM-free: the ring UI reads `progress`; main.js owns the prompt.
 */

import { STYLE_BY_ID } from '../combat/styles.js';

/** Seconds of held E the Requital needs. */
export const CHANNEL_TIME = 1.5;
/** Max distance from the player to the subdued body (metres). */
export const STEAL_REACH = 3.2;

export class StealChannel {
  /**
   * @param {object} o
   * @param {import('../combat/playerState.js').PlayerCombatState} o.state
   * @param {object} o.callbacks { onBegin, onProgress?, onComplete, onCancel }
   */
  constructor({ state, callbacks = {} }) {
    this.state = state;
    this.cb = callbacks;
    this.target = null; // Fighter currently being robbed
    this.progress = 0; // 0..1
    this.time = 0;
    this.active = false;
  }

  /**
   * The stealable fighter near (x, z), or null. Requires the whole group
   * to be down (see spawner.groupReady) — a half-standing gang stays locked.
   * @param {number} x
   * @param {number} z
   * @param {object} spawner
   */
  findTarget(x, z, spawner) {
    const f = spawner.nearestSubdued?.(x, z, STEAL_REACH);
    if (!f) return null;
    if (!spawner.groupReady?.(f.group.id)) return null;
    return f;
  }

  /**
   * One frame of the channel.
   * @param {number} dt seconds
   * @param {object|null} fighter the current target (null = nothing near)
   * @param {boolean} held E is held this frame
   * @param {boolean} inputOk false while an overlay owns the screen
   * @returns {boolean} true on the frame the channel COMPLETES
   */
  tick(dt, fighter, held, inputOk = true) {
    if (!inputOk || !held || !fighter) {
      if (this.active) this._cancel();
      return false;
    }
    if (this.target !== fighter) {
      // new body under the glove: restart the rip, progress carries a little
      this.target = fighter;
      this.progress = 0;
      this.time = 0;
    }
    if (!this.active) {
      this.active = true;
      this.cb.onBegin?.(fighter);
    }
    this.time += dt;
    this.progress = Math.min(1, this.time / CHANNEL_TIME);
    if (this.progress >= 1) {
      return this._complete(fighter);
    }
    return false;
  }

  _complete(fighter) {
    const group = fighter.group;
    const grant = this.state.grantGroup(group);
    const out = { fighter, group, grant };
    this._reset();
    this.cb.onComplete?.(out);
    return true;
  }

  _cancel() {
    const was = this.target;
    this._reset();
    this.cb.onCancel?.(was);
  }

  _reset() {
    this.target = null;
    this.progress = 0;
    this.time = 0;
    this.active = false;
  }

  /** The line the prompt shows: what you're about to take. */
  promptFor(fighter) {
    const style = STYLE_BY_ID[fighter.group.grants?.style];
    const what = style ? style.name : fighter.group.name;
    return `STEAL — ${what}`;
  }

  snapshot() {
    return {
      active: this.active,
      progress: Math.round(this.progress * 100) / 100,
      target: this.target?.id ?? null,
      group: this.target?.group.id ?? null,
    };
  }
}
