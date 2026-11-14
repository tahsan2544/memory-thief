/**
 * THE OVERLORD — MEMORY THIEF v2 (docs/GAME-DESIGN.md §9, TECH-PLAN Phase 13).
 *
 * The final fighter, built on top of the regular Fighter brain so streaming,
 * damage, subdue and the Requital all keep working unchanged:
 *
 *   Phase 1 "The Wall"         — heavy punches, grabs, wide sweeps.
 *   Phase 2 "The Collector"    — longer combos, charge dashes, and bolts
 *                                tinted by the powers YOU have stolen
 *                                (his `getPowerHues` ctx hook reads them).
 *   Phase 3 "Requital of all"  — arena impacts, radial nova, chain snare,
 *                                weapon projections.
 *
 * Contracts honoured here:
 *   - every attack has a ≥0.5 s wind-up with a ground ring: red = strike,
 *     amber = AOE, violet = memory/magic;
 *   - every attack ends in a RECOVERY WINDOW (heavy exhale) where he drops
 *     guard: damage ×1.5, posture damage ×2 — the player's real damage
 *     phase (announced once per window through ctx.onBossWindow);
 *   - very high posture; stance-breaks only through recovery punishes;
 *   - phases switch at 66% / 33% hp and announce through ctx.onBossPhase.
 */

import * as THREE from 'three';
import { Fighter } from './fighter.js';

const RING_RED = 0xff3b4e; // strike
const RING_AMBER = 0xffb13c; // AOE
const RING_VIOLET = 0xb45cff; // memory / magic
const RING_BASE_R = 3.0; // ring geometry outer radius (scale maps danger)

/** kind → { color, windup (s), recover (s), dmg, radius, mode } — all ≥0.5 s. */
const MOVES = {
  // ---- Phase 1 — The Wall ---------------------------------------------
  punch: { color: RING_RED, windup: 0.55, recover: 0.9, dmg: 1.0, radius: 2.6, mode: 'melee' },
  sweep: { color: RING_AMBER, windup: 0.7, recover: 1.1, dmg: 0.85, radius: 3.6, mode: 'aoe' },
  grab: { color: RING_RED, windup: 0.8, recover: 1.2, dmg: 1.4, radius: 2.8, mode: 'melee' },
  // ---- Phase 2 — The Collector -----------------------------------------
  combo: { color: RING_RED, windup: 0.5, recover: 1.0, dmg: 0.9, radius: 2.8, mode: 'combo' },
  dash: { color: RING_RED, windup: 0.6, recover: 1.0, dmg: 1.2, radius: 3.0, mode: 'dash' },
  bolt: { color: RING_VIOLET, windup: 0.6, recover: 0.9, dmg: 1.0, radius: 3.4, mode: 'bolt' },
  // ---- Phase 3 — The Requital of all -----------------------------------
  impact: { color: RING_AMBER, windup: 0.9, recover: 1.4, dmg: 1.3, radius: 4.6, mode: 'aoe' },
  nova: { color: RING_VIOLET, windup: 0.8, recover: 1.2, dmg: 0.9, radius: 4.2, mode: 'nova' },
  snare: { color: RING_VIOLET, windup: 0.6, recover: 0.9, dmg: 0.8, radius: 3.2, mode: 'snare' },
  projection: { color: RING_RED, windup: 0.6, recover: 0.8, dmg: 0.7, radius: 3.4, mode: 'projection' },
};

const PHASE_MOVES = {
  1: ['punch', 'punch', 'sweep', 'grab'],
  2: ['combo', 'dash', 'bolt', 'punch', 'sweep'],
  3: ['impact', 'nova', 'snare', 'projection', 'sweep', 'grab'],
};

const PHASE_TITLE = { 1: 'THE WALL', 2: 'THE COLLECTOR', 3: 'REQUIITAL OF ALL' };

export class Overlord extends Fighter {
  constructor(opts) {
    super(opts);
    this.isOverlord = true;
    this._atkN = 0; // rotates reflected-power hues
    this._comboLeft = 0; // remaining strikes of a Phase-2 combo
    this._exhaleT = 0; // seconds left in the recovery (damage) window
    this._windowAnnounced = false;
    this._dashT = 0;
    this._dashX = 0;
    this._dashZ = 0;

    // ground telegraph ring — one mesh, recoloured per move
    const geo = new THREE.RingGeometry(RING_BASE_R * 0.82, RING_BASE_R, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: RING_RED,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this._ring = new THREE.Mesh(geo, mat);
    this._ring.rotation.x = -Math.PI / 2;
    this._ring.renderOrder = 3;
    this._ring.visible = false;
    this.ctx.scene?.add(this._ring);
    this._ringR = 0;
    this._windupT = 0; // counts up during windup so the ring can grow
    this._windupDur = 0.5;
  }

  /* ---- phases ---------------------------------------------------------- */

  _syncPhase() {
    if (this.state === 'subdued' || this.dying > 0) return;
    const r = this.hp / this.maxHp;
    const p = r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
    if (p === this._phase) return;
    const prev = this._phase;
    this._phase = p;
    this._exhaleT = 1.6; // he drops guard to exhale at the transition
    this._windowAnnounced = false;
    this.ctx.onBossPhase?.(this, p, prev, PHASE_TITLE[p]);
  }

  get phaseTitle() {
    return PHASE_TITLE[this._phase] ?? PHASE_TITLE[1];
  }

  /** True while the heavy-exhale recovery window is open (HUD + tests). */
  get inRecovery() {
    return this._exhaleT > 0;
  }

  /* ---- attacks --------------------------------------------------------- */

  _beginAttack(dist) {
    const list = PHASE_MOVES[this._phase] ?? PHASE_MOVES[1];
    const kind = list[this._atkN++ % list.length];
    const m = MOVES[kind];
    this.state = 'attack';
    this.attackPhase = 'windup';
    this._move = kind;
    this._windupDur = m.windup; // ≥ 0.5 s on every move
    this._windupT = 0;
    this.stateT = m.windup;
    this._attackDist = dist;
    this._ringR = m.radius;
    this._ring.material.color.setHex(m.color);
    this._ring.visible = true;
    this._ring.material.opacity = 0.35;
    this._ring.scale.setScalar(0.6);
    this._comboLeft = kind === 'combo' ? 3 : 0;
  }

  /** Phase 2/3 ranged openers fire outside melee reach (bodies keep the cadence). */
  _maybeRanged(dist) {
    if (this._phase === 1 || this.cooldown > 0 || this.attackPhase) return;
    if (dist <= this.attackRange || dist > 20) return;
    const ranged = this._phase === 2 ? ['bolt'] : ['nova', 'snare', 'projection'];
    if (Math.random() > 0.05) return; // deliberate, not machine-gun
    const kind = ranged[this._atkN++ % ranged.length];
    const m = MOVES[kind];
    this.state = 'attack';
    this.attackPhase = 'windup';
    this._move = kind;
    this._windupDur = m.windup;
    this._windupT = 0;
    this.stateT = m.windup;
    this._attackDist = dist;
    this._ringR = m.radius;
    this._ring.material.color.setHex(m.color);
    this._ring.visible = true;
    this._ring.material.opacity = 0.35;
    this._ring.scale.setScalar(0.6);
  }

  _fireProjectile(m, opts) {
    const hues = this.ctx.getPowerHues?.() ?? [];
    const hue = hues.length ? hues[this._atkN % hues.length] : m.color;
    this.ctx.spawnProjectile?.(this, this._lastPlayer ?? { x: this.x, z: this.z }, Math.round(this.damage * m.dmg), {
      speed: opts.speed ?? 12,
      kind: 'magic',
      hue,
      nova: opts.nova ?? 1,
    });
  }

  _tickAttack(dt, dist, dx, dz, playerPos) {
    this._lastPlayer = playerPos;
    const m = MOVES[this._move] ?? MOVES.punch;
    this.stateT -= dt;

    if (this.attackPhase === 'windup') {
      // ring grows into its danger radius across the whole lead-in
      this._windupT += dt;
      const k = Math.min(1, this._windupT / this._windupDur);
      this._ring.scale.setScalar(0.6 + 0.4 * k);
      this._ring.material.opacity = 0.35 + 0.35 * k;
      this._integrate(dt, 0);
      if (this.stateT > 0) return;
      // ---- strike ------------------------------------------------------
      this.attackPhase = 'active';
      this.stateT = m.mode === 'combo' ? 0.14 : m.mode === 'dash' ? 0.4 : 0.14;
      this._ring.material.opacity = 0.9;
      const reach = this.attackRange + 0.5;
      if (m.mode === 'melee' || m.mode === 'combo') {
        if (dist <= reach + 0.4) {
          const res = this.ctx.hitPlayer?.(Math.round(this.damage * m.dmg), {
            posture: Math.round(this.damage * 0.5),
            kind: 'heavy',
            srcX: this.x,
            srcZ: this.z,
            source: this,
          });
          this.ctx.onEnemySwing?.(this, res);
        }
      } else if (m.mode === 'aoe') {
        if (dist <= m.radius) {
          const res = this.ctx.hitPlayer?.(Math.round(this.damage * m.dmg), {
            posture: Math.round(this.damage * 0.7),
            kind: 'heavy',
            srcX: this.x,
            srcZ: this.z,
            source: this,
          });
          this.ctx.onEnemySwing?.(this, res);
        }
      } else if (m.mode === 'dash') {
        const n = Math.hypot(dx, dz) || 1;
        this._dashX = (dx / n) * 11;
        this._dashZ = (dz / n) * 11;
        this._dashT = 0.4;
        this._dashHit = false;
      } else if (m.mode === 'bolt') {
        this._fireProjectile(m, { speed: 13 });
      } else if (m.mode === 'nova') {
        this._fireProjectile(m, { speed: 10, nova: 3 }); // three beats, 0.35 s apart
      } else if (m.mode === 'snare') {
        this._fireProjectile(m, { speed: 17 });
      } else if (m.mode === 'projection') {
        this._fireProjectile(m, { speed: 14, nova: 2 });
      }
      return;
    }

    if (this.attackPhase === 'active') {
      if (m.mode === 'dash' && this._dashT > 0) {
        this._dashT -= dt;
        const nx = this.x + this._dashX * dt;
        const nz = this.z + this._dashZ * dt;
        if (!this.ctx.colliders?.hits?.(nx, nz, 0.8, 0.4)) {
          this.x = nx;
          this.z = nz;
        }
        if (!this._dashHit && Math.hypot(playerPos.x - this.x, playerPos.z - this.z) <= 2.4) {
          this._dashHit = true;
          const res = this.ctx.hitPlayer?.(Math.round(this.damage * m.dmg), {
            posture: Math.round(this.damage * 0.6),
            kind: 'heavy',
            srcX: this.x,
            srcZ: this.z,
            source: this,
          });
          this.ctx.onEnemySwing?.(this, res);
        }
        if (this._dashT > 0) return;
      } else if (this.stateT > 0) {
        this._integrate(dt, 0);
        return;
      }
      if (m.mode === 'combo' && this._comboLeft > 1) {
        // chain: next strike winds up again (still ≥0.5 s of telegraph)
        this._comboLeft--;
        this.attackPhase = 'windup';
        this.stateT = m.windup;
        this._windupT = 0;
        return;
      }
      // ---- recovery window: the heavy exhale, guard dropped -------------
      this.attackPhase = 'recover';
      this.stateT = m.recover;
      this._exhaleT = m.recover;
      this._windowAnnounced = false;
      this._ring.visible = false;
      return;
    }

    // recover
    if (this.stateT <= 0) {
      this.attackPhase = null;
      this._move = null;
      this.state = 'chase';
      this.cooldown = Math.max(0.35, this.attackInterval * (this._phase === 1 ? 1.15 : 0.8));
    }
    this._integrate(dt, 0);
  }

  /* ---- damage in (recovery-window punish) ------------------------------ */

  takeDamage(amount, info = {}) {
    if (this._exhaleT > 0 && this.state !== 'subdued') {
      amount = Math.round(amount * 1.5);
      info = { ...info, posture: Math.round((info.posture ?? 0) * 2) };
      if (!this._windowAnnounced) {
        this._windowAnnounced = true;
        this.ctx.onBossWindow?.(this);
      }
    }
    return super.takeDamage(amount, info);
  }

  /* ---- frame ----------------------------------------------------------- */

  update(dt, t, playerPos, playerActive) {
    this._syncPhase();
    if (playerActive && this.state === 'chase') {
      const dist = Math.hypot(playerPos.x - this.x, playerPos.z - this.z);
      this._maybeRanged(dist);
    }
    if (this._exhaleT > 0) this._exhaleT = Math.max(0, this._exhaleT - dt);
    super.update(dt, t, playerPos, playerActive);
    // telegraph ring rides the boss's feet while it lives — `?.` because
    // super.update() can dissolve him mid-frame (defeat → dying → markDead
    // → dispose nulls the ring before control returns here)
    if (this._ring?.visible) {
      this._ring.position.set(this.x, (this.y ?? 0) + 0.06, this.z);
      if (this.attackPhase !== 'windup') this._ring.material.opacity = Math.max(0, this._ring.material.opacity - dt * 4);
      if (this.attackPhase == null) this._ring.visible = false;
    }
  }

  /** Kill the telegraph ring with the body. */
  dispose() {
    this._ring?.removeFromParent();
    this._ring?.geometry?.dispose();
    this._ring?.material?.dispose();
    this._ring = null;
    super.dispose();
  }

  /** HUD/test read-out for the boss bar (window.__MT_BOSS__). */
  bossSnapshot() {
    return {
      name: this.group.name,
      x: this.x,
      z: this.z,
      phase: this._phase,
      phaseTitle: this.phaseTitle,
      hp: this.hp,
      maxHp: this.maxHp,
      posture: this.posture,
      maxPosture: this.maxPosture,
      state: this.state,
      attack: this.attackPhase,
      move: this._move,
      recovery: this.inRecovery,
      alive: this.alive,
    };
  }
}
