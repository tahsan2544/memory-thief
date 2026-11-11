/**
 * Player attack / defence finite-state machine — MEMORY THIEF v2
 * (docs/GAME-DESIGN.md §2–§4, docs/TECH-PLAN.md §4 Phase 2/3).
 *
 * Drives one frame of combat from raw input to resolved hits:
 *   light combo (LMB) · heavy (F) · style special (G) · block (RMB hold)
 *   parry (block timed into a hit) · dodge roll (C, i-frames) · lock-on (Q)
 *
 * It never touches the DOM or the scene: animation goes through the
 * controller's combat hooks, damage goes through `Fighter.takeDamage`,
 * presentation callbacks arrive via `callbacks` (VFX, audio, floating numbers).
 */

import { COMBAT_BASE } from './styles.js';
import { styleOf } from './stats.js';

export const MOUSE = { LMB: 0, MMB: 1, RMB: 2 };

const KEY = {
  lock: 'KeyQ',
  heavy: 'KeyF',
  special: 'KeyG',
  dodge: 'KeyC',
};

/** Light-attack swing names cycle through the combo (animator kinds). */
const SWING_KINDS = ['jab', 'cross', 'hook', 'heavy'];

export class CombatSystem {
  constructor({ state, callbacks = {} }) {
    this.state = state;
    this.cb = callbacks;
    this.time = 0; // combat clock (seconds, dt-accumulated)

    this.action = 'idle'; // idle | attack | dodge | stagger
    this.actionT = 0;
    this.attack = null; // { kind, index, dur, windup, activeEnd, resolved }
    this.comboIndex = 0;
    this.comboWindow = 0; // seconds left to chain the next swing
    this.blockHeld = false;
    this.blockTime = 0; // seconds the guard has been up (parry timing)
    this.staggerT = 0;
    this.iframes = 0;
    this.dodgeCd = 0;
    this.lastStaminaUse = -99;
    this.counterUntil = 0; // parry → punish window
    this.lockOn = null; // Fighter or null

    // per-fight power flags (reset when combat resets)
    this.fightFlags = { heavyAbsorbed: false, magicAbsorbed: false, rimeReadyAt: 0, coverUsed: false };
    this.enabled = false;
    this._defeated = false; // true once this life's hp hit 0 (until revive)
    this._lastDmgDealt = 0;
  }

  /* ------------------------------------------------------------------ *
   * Frame
   * ------------------------------------------------------------------ */

  /**
   * @param {number} dt seconds
   * @param {object} o
   * @param {string[]} o.pressed key codes this frame
   * @param {number[]} o.mousePressed mouse buttons pressed this frame
   * @param {object} o.player PlayerController
   * @param {Array} o.fighters live Fighter list
   * @param {boolean} o.inputOk false while any overlay owns the screen
   */
  update(dt, o) {
    const st = this.state;
    this.time += dt;
    const player = o.player;
    if (!player || !o.inputOk) {
      this._release();
      this._tickPassive(dt);
      return;
    }

    // ---- timers -------------------------------------------------------
    this.actionT -= dt;
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (this.staggerT > 0) {
      this.staggerT = Math.max(0, this.staggerT - dt);
      if (this.staggerT === 0 && this.action === 'stagger') this.action = 'idle';
    }

    // ---- lock-on ------------------------------------------------------
    this._updateLock(dt, o);

    // ---- input --------------------------------------------------------
    const pressed = o.pressed ?? [];
    const mouse = o.mousePressed ?? [];
    const canAct = this.action === 'idle' || (this.action === 'attack' && this.attack?.phase === 'recover');

    // lock-on toggle
    if (pressed.includes(KEY.lock)) {
      if (this.lockOn) this._setLock(null, o);
      else this._setLock(this._pickLock(o), o);
    }

    // guard: RMB held, only while free to hold it
    const wantBlock = o.inputOk && this._mouseHeld(o, MOUSE.RMB) &&
      (this.action === 'idle') && st.stamina > 0;
    if (wantBlock && !this.blockHeld) this.blockTime = 0;
    this.blockHeld = wantBlock;
    if (this.blockHeld) this.blockTime += dt;
    player.setGuard(this.blockHeld, styleOf(st).guardPose);

    // dodge (C) — beats everything except stagger
    if (pressed.includes(KEY.dodge) && this.action !== 'stagger' && this.dodgeCd <= 0 &&
        st.stamina >= st.stats().dodgeCost) {
      this._startDodge(player, o);
    } else if (canAct) {
      if (mouse.includes(MOUSE.LMB)) this._startAttack('light', player, o);
      else if (pressed.includes(KEY.heavy)) this._startAttack('heavy', player, o);
      else if (pressed.includes(KEY.special)) this._startAttack('special', player, o);
    }

    // ---- advance the current action ------------------------------------
    if (this.action === 'attack') this._tickAttack(dt, player, o);
    else if (this.action === 'dodge' && this.actionT <= 0) this._endAction(player);
    else if (this.action === 'idle') player.setSpeedScale(1);

    // while free and locked on, hold the target's heading
    if (this.action === 'idle') {
      player.setFaceTarget(this.lockOn && this.lockOn.alive ? this._yawTo(this.lockOn, player) : null);
    }

    this._tickPassive(dt);
    this.enabled = true;
  }

  /** Stamina regen + guard release, always. */
  _tickPassive(dt) {
    const st = this.state;
    const stats = st.stats();
    st.stamina = Math.min(stats.maxStamina, Math.max(0, st.stamina));
    const idle = this.time - this.lastStaminaUse;
    if (!this.blockHeld && idle > 0.7) {
      st.stamina = Math.min(stats.maxStamina, st.stamina + stats.staminaRegen * dt);
    }
    // posture recovers when you are not being hit
    if (this.time - (this._lastPostureHit ?? -99) > 1.4) {
      st.posture = Math.max(0, st.posture - 14 * dt);
    }
  }

  _release() {
    const was = this.blockHeld;
    this.blockHeld = false;
    this.blockTime = 0;
    if (was) this._player?.setGuard(false);
    this.enabled = false;
  }

  _mouseHeld(o, button) {
    // main.js passes a held-state probe; fall back to injected state
    if (typeof o.mouseHeld === 'function') return o.mouseHeld(button);
    return false;
  }

  /* ------------------------------------------------------------------ *
   * Offence
   * ------------------------------------------------------------------ */

  _startAttack(kind, player, o) {
    const st = this.state;
    const stats = st.stats();
    if (this.action === 'dodge' || this.action === 'stagger') return;

    const cost = kind === 'heavy' ? stats.heavyCost : kind === 'special' ? stats.specialCost : 0;
    if (cost > 0 && st.stamina < cost) {
      if (kind !== 'light') this.cb.onEvent?.('Not enough stamina');
      return;
    }
    if (kind === 'special' && !stats.style.special) return;

    // chain: a press during recovery continues the string instead of restarting
    if (kind === 'light' && this.attack && this.attack.kind === 'light' &&
        this.attack.phase === 'recover' && this.comboWindow > 0) {
      this._continueCombo(player, o);
      return;
    }

    const dur = kind === 'light'
      ? stats.swingInterval
      : kind === 'heavy' ? 0.78 : 0.92;
    const windup = kind === 'light' ? dur * 0.38 : dur * 0.46;

    this.action = 'attack';
    this.attack = {
      kind,
      index: kind === 'light' ? (this.attack?.kind === 'light' && this.attack.phase === 'recover'
        ? (this.comboIndex + 1) % stats.comboLength : 0) : 0,
      dur,
      windup,
      activeEnd: windup + dur * 0.2,
      resolved: false,
      phase: 'windup',
      t: dur,
    };
    if (kind === 'light') this.comboIndex = this.attack.index;
    else this.comboIndex = 0;

    if (cost > 0) {
      st.stamina -= cost;
      this.lastStaminaUse = this.time;
    }

    const swingKind = kind === 'light'
      ? SWING_KINDS[this.comboIndex % SWING_KINDS.length]
      : kind === 'heavy' ? 'heavy' : 'special';
    player.strike(swingKind, dur);
    player.setSpeedScale(kind === 'light' ? 0.45 : 0.3);
    player.setGuard(false);
    this.cb.onSwing?.(kind, this.comboIndex);
  }

  _continueCombo(player, o) {
    const st = this.state;
    const stats = st.stats();
    const dur = stats.swingInterval;
    this.attack = {
      kind: 'light',
      index: (this.comboIndex + 1) % stats.comboLength,
      dur,
      windup: dur * 0.34,
      activeEnd: dur * 0.34 + dur * 0.2,
      resolved: false,
      phase: 'windup',
      t: dur,
    };
    this.comboIndex = this.attack.index;
    this.comboWindow = 0;
    const swingKind = SWING_KINDS[this.comboIndex % SWING_KINDS.length];
    player.strike(swingKind, dur);
    player.setSpeedScale(0.45);
    this.cb.onSwing?.('light', this.comboIndex);
  }

  _tickAttack(dt, player, o) {
    const a = this.attack;
    if (!a) {
      this.action = 'idle';
      return;
    }
    a.t -= dt;
    const elapsed = a.dur - a.t;
    const prev = a.phase;
    a.phase = elapsed < a.windup ? 'windup' : elapsed < a.activeEnd ? 'active' : 'recover';

    if (a.phase === 'active' && !a.resolved) {
      a.resolved = true;
      this._resolveHit(a, player, o);
    }
    if (prev === 'active' && a.phase === 'recover') {
      // opening for the chain input (light only)
      this.comboWindow = a.kind === 'light' ? Math.max(0.18, a.dur * 0.6) : 0;
      this.attack = a;
    }

    if (a.t <= 0) this._endAction(player);
  }

  _endAction(player) {
    this.action = 'idle';
    this.attack = null;
    this.comboIndex = 0;
    this.comboWindow = 0;
    player?.setSpeedScale(1);
    if (!this.lockOn) player?.setFaceTarget(null);
  }

  /** One active-frame hit resolution against the fighters in reach. */
  _resolveHit(a, player, o) {
    const st = this.state;
    const stats = st.stats();
    const fighters = o.fighters ?? [];
    const p = player.position;
    const fx = Math.sin(player.facing);
    const fz = Math.cos(player.facing);
    const reach = stats.reach + (a.kind === 'heavy' ? 0.4 : 0);

    // candidates: in front, in reach — the lock-on target always counts if close
    const cands = [];
    for (const f of fighters) {
      if (!f.alive || f.state === 'subdued') continue;
      const dx = f.x - p.x;
      const dz = f.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + 0.7) continue;
      const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      const isLock = f === this.lockOn;
      if (dot > 0.2 || (isLock && d <= reach + 0.8)) cands.push({ f, d, dot });
    }
    if (!cands.length) {
      this.cb.onWhiff?.(a.kind);
      return;
    }
    cands.sort((x, y) => x.d - y.d);

    const isArea = a.kind === 'special' && stats.style.special?.kind === 'area';
    const primary = cands[0];
    const targets = [primary];
    if (isArea) {
      for (const c of cands.slice(1)) if (c.d <= reach + 1.6) targets.push(c);
    } else if (stats.flags.twinDraws && a.kind === 'light' &&
               this.comboIndex === stats.comboLength - 1 && cands[1]) {
      targets.push(cands[1]); // the finisher cuts through a second body
    }

    let dmg = a.kind === 'light' ? stats.lightDamage
      : a.kind === 'heavy' ? stats.heavyDamage : stats.specialDamage;
    // parry punish: a counter landed inside the window hits twice as hard
    const isCounter = this.time < this.counterUntil;
    if (isCounter) {
      dmg *= 2;
      this.counterUntil = 0;
      this.cb.onEvent?.('COUNTER');
    }
    const posture = stats.posturePerHit * (a.kind === 'heavy' ? 2 : a.kind === 'special' ? 1.5 : 1);

    for (const t of targets) {
      const breakGuard = a.kind === 'heavy' || (a.kind === 'special' && stats.flags.guardShatter);
      t.f.takeDamage(Math.round(dmg), {
        posture: Math.round(posture),
        kind: a.kind,
        breakGuard,
        source: 'player',
        dirX: fx,
        dirZ: fz,
      });
    }
    this._lastDmgDealt = Math.round(dmg);
    this.cb.onHit?.(primary.f, Math.round(dmg), {
      kind: a.kind,
      counter: isCounter,
      multi: targets.length,
      position: { x: primary.f.x, y: 1.2, z: primary.f.z },
    });
  }

  /* ------------------------------------------------------------------ *
   * Defence
   * ------------------------------------------------------------------ */

  _startDodge(player, o) {
    const st = this.state;
    const stats = st.stats();
    st.stamina -= stats.dodgeCost;
    this.lastStaminaUse = this.time;

    // direction from held movement keys, relative to the camera basis
    const input = o.input;
    let ix = 0;
    let iz = 0;
    if (input) {
      if (input.isDown?.('KeyW')) iz += 1;
      if (input.isDown?.('KeyS')) iz -= 1;
      if (input.isDown?.('KeyD')) ix += 1;
      if (input.isDown?.('KeyA')) ix -= 1;
    }
    const basis = o.cameraRig?.basis;
    let dx;
    let dz;
    if (basis && (ix || iz)) {
      dx = basis.fx * iz + basis.rx * ix;
      dz = basis.fz * iz + basis.rz * ix;
    } else {
      // no input: roll away from the lock-on target, else straight back
      if (this.lockOn) {
        dx = player.position.x - this.lockOn.x;
        dz = player.position.z - this.lockOn.z;
      } else {
        dx = -Math.sin(player.facing);
        dz = -Math.cos(player.facing);
      }
    }

    const dist = ix === 0 && iz === 0 ? COMBAT_BASE.dodgeDistanceRoll : COMBAT_BASE.dodgeDistanceDash;
    const dur = 0.34;
    this.action = 'dodge';
    this.actionT = dur;
    this.iframes = COMBAT_BASE.iframeWindow;
    this.dodgeCd = COMBAT_BASE.dodgeCooldown;
    this.blockHeld = false;
    player.impulse(dx, dz, dist / dur, dur, 0.55);
    player.strike('dodge', dur);
    player.setSpeedScale(1);
    this.cb.onDodge?.();
  }

  /**
   * An enemy strike lands here.
   * @param {number} raw base damage
   * @param {{posture?:number, kind?:'melee'|'magic'|'heavy', srcX:number, srcZ:number, source?:object}} info
   * @returns {{result:'dodged'|'parried'|'blocked'|'hit'|'staggered'|'killed', amount:number}}
   */
  receiveHit(raw, info = {}) {
    const st = this.state;
    const stats = st.stats();
    const player = this._player;
    const res = { result: 'hit', amount: 0 };
    if (this._defeated) return res; // already down — never double-fire the defeat

    if (this.iframes > 0) {
      res.result = 'dodged';
      this.cb.onDodged?.();
      return res;
    }
    // heat haze misleads distance — a flat miss chance
    if (stats.flags.heatHaze && Math.random() < 0.2) {
      res.result = 'dodged';
      return res;
    }
    // rime ward: one free hit every 12 s
    if (stats.flags.rimeWard && this.time >= this.fightFlags.rimeReadyAt) {
      this.fightFlags.rimeReadyAt = this.time + 12;
      res.result = 'blocked';
      this.cb.onEvent?.('Rime ward absorbs the blow');
      return res;
    }

    let amount = raw;
    let posture = info.posture ?? 0;
    const kind = info.kind ?? 'melee';

    // guard: face the attacker and eat it (or time it into a parry)
    if (this.blockHeld && player) {
      const dx = (info.srcX ?? player.position.x) - player.position.x;
      const dz = (info.srcZ ?? player.position.z) - player.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const facing = { x: Math.sin(player.facing), z: Math.cos(player.facing) };
      const dot = (dx * facing.x + dz * facing.z) / d;
      if (dot > 0.05) {
        if (this.blockTime <= stats.parryWindow) {
          // perfect parry: no damage, stamina back, counter window opens
          res.result = 'parried';
          st.stamina = Math.min(stats.maxStamina, st.stamina + (stats.flags.longGuard ? 24 : 14));
          this.counterUntil = this.time + COMBAT_BASE.counterWindow + 0.35;
          this.cb.onParry?.(info.source);
          return res;
        }
        if (stats.flags.wardStance && (this._blockHits ?? 0) < 1 && kind !== 'heavy') {
          this._blockHits = (this._blockHits ?? 0) + 1;
          res.result = 'blocked';
          this.cb.onBlocked?.();
          return res;
        }
        const cut = stats.blockDamageCut;
        amount = Math.max(1, Math.round(amount * (1 - cut)));
        posture = Math.round(posture * (1 - cut * 0.5));
        st.stamina -= amount; // the guard pays in stamina, not blood
        this.lastStaminaUse = this.time;
        res.result = 'blocked';
        res.amount = amount;
        if (st.stamina <= 0) {
          st.stamina = 0;
          this._stagger(0.9);
          res.result = 'staggered';
          this.cb.onEvent?.('Guard broken!');
        } else {
          this.cb.onBlocked?.();
        }
        st.damage(amount);
        this._posture(posture);
        this._checkDefeat(res);
        return res;
      }
    }

    // armour powers (each per-fight where the design says so)
    if (stats.flags.impactAbsorb && !this.fightFlags.heavyAbsorbed && kind === 'heavy') {
      this.fightFlags.heavyAbsorbed = true;
      amount *= 0.5;
      posture *= 0.5;
      this.cb.onEvent?.('Impact absorb');
    }
    if (stats.flags.heatGuard && !this.fightFlags.magicAbsorbed && kind === 'magic') {
      this.fightFlags.magicAbsorbed = true;
      amount = 0;
      posture = 0;
      this.cb.onEvent?.('Heat guard');
    }
    if (stats.flags.bodyCocoon && player?.crouching) amount *= 0.7;

    amount = Math.round(amount * stats.damageTakenMul);
    res.amount = amount;
    st.damage(amount);
    this._posture(Math.round(posture));

    // knockback — only when not guarding
    if (player && amount > 0) {
      const dx = player.position.x - (info.srcX ?? player.position.x);
      const dz = player.position.z - (info.srcZ ?? player.position.z);
      if (dx || dz) player.impulse(dx, dz, 4.2, 0.16, 0.9);
      player.strike('stagger', 0.3);
    }

    if (st.hp <= 0) {
      res.result = 'killed';
    } else if (this.action !== 'stagger' && this._postureFull()) {
      res.result = 'staggered';
    }
    this.cb.onPlayerDamaged?.(amount, info);
    this._checkDefeat(res);
    return res;
  }

  _posture(amount) {
    if (amount <= 0) return;
    const st = this.state;
    const stats = st.stats();
    if (stats.flags.unbroken && st.hp < stats.maxHp * 0.25) return; // holds to the bone
    st.posture = Math.min(stats.maxPosture, st.posture + amount);
    this._lastPostureHit = this.time;
    if (this._postureFull()) {
      const standing = this._player && this._player.speed < 0.2;
      if (stats.flags.pairedCover && standing && !this.fightFlags.coverUsed) {
        this.fightFlags.coverUsed = true;
        st.posture = 0;
        this.cb.onEvent?.('Paired cover holds');
        return;
      }
      st.posture = 0;
      this._stagger(COMBAT_BASE.staggerRecovery);
    }
  }

  _postureFull() {
    return this.state.posture >= this.state.stats().maxPosture;
  }

  _stagger(dur) {
    this.action = 'stagger';
    this.staggerT = dur;
    this.attack = null;
    this.comboWindow = 0;
    this.blockHeld = false;
    const p = this._player;
    if (p) {
      p.setSpeedScale(0);
      p.setGuard(false);
      p.strike('stagger', Math.min(dur, 0.6));
    }
  }

  _checkDefeat(res) {
    if (this.state.hp <= 0 && res.result !== 'killed') res.result = 'killed';
    if (res.result === 'killed' && !this._defeated) {
      this._defeated = true;
      this.cb.onDefeat?.();
    }
  }

  /** Player got back up (respawn): the life gate reopens at full health. */
  revive() {
    this._defeated = false;
    this.state.hp = this.state.maxHp;
    this.state.stamina = 100;
    this.state.posture = 0;
    this.reset();
  }

  /* ------------------------------------------------------------------ *
   * Lock-on
   * ------------------------------------------------------------------ */

  _pickLock(o) {
    const p = o.player;
    if (!p) return null;
    let best = null;
    let bestD = 18;
    for (const f of o.fighters ?? []) {
      if (!f.alive || f.state === 'subdued') continue;
      const d = Math.hypot(f.x - p.position.x, f.z - p.position.z);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  _setLock(f, o) {
    this.lockOn = f;
    if (f) this.cb.onLock?.(f);
    else this.cb.onLock?.(null);
  }

  _updateLock(dt, o) {
    const f = this.lockOn;
    if (!f) return;
    if (!f.alive || f.state === 'subdued') {
      // a subdued target stays locked so the steal prompt can find it
      if (f.state === 'subdued') return;
      this._setLock(null, o);
      return;
    }
    const p = o.player;
    if (!p) return;
    const d = Math.hypot(f.x - p.position.x, f.z - p.position.z);
    if (d > 26) {
      this._setLock(null, o);
      return;
    }
    if (this.action === 'idle') p.setFaceTarget(this._yawTo(f, p));
  }

  _yawTo(f, player) {
    return Math.atan2(f.x - player.position.x, f.z - player.position.z);
  }

  /** Called by main each frame so receiveHit can knock the right body. */
  bindPlayer(player) {
    this._player = player;
  }

  /* ------------------------------------------------------------------ *
   * Lifecycle + hooks
   * ------------------------------------------------------------------ */

  /** New fight: per-fight power flags and posture reset (hp persists). */
  startFight() {
    this.fightFlags = { heavyAbsorbed: false, magicAbsorbed: false, rimeReadyAt: 0, coverUsed: false };
    this.state.posture = 0;
    this._blockHits = 0;
  }

  reset() {
    this.action = 'idle';
    this.actionT = 0;
    this.attack = null;
    this.comboIndex = 0;
    this.comboWindow = 0;
    this.blockHeld = false;
    this.blockTime = 0;
    this.staggerT = 0;
    this.iframes = 0;
    this.dodgeCd = 0;
    this.counterUntil = 0;
    this.lockOn = null;
    this.time = 0;
    this.startFight();
  }

  snapshot() {
    const st = this.state;
    return {
      action: this.action,
      kind: this.attack?.kind ?? null,
      phase: this.attack?.phase ?? null,
      combo: this.comboIndex,
      comboWindow: Math.round(this.comboWindow * 100) / 100,
      blocking: this.blockHeld,
      blockTime: Math.round(this.blockTime * 100) / 100,
      parryWindow: st.stats().parryWindow,
      iframes: Math.round(this.iframes * 100) / 100,
      dodgeCd: Math.round(this.dodgeCd * 100) / 100,
      counter: this.time < this.counterUntil,
      stagger: this.staggerT,
      lockOn: this.lockOn?.id ?? null,
      hp: Math.round(st.hp),
      maxHp: st.maxHp,
      stamina: Math.round(st.stamina),
      posture: Math.round(st.posture),
      lastDamage: this._lastDmgDealt,
      style: st.styleId,
      weapon: st.weaponId,
      flags: { ...this.fightFlags },
    };
  }
}
