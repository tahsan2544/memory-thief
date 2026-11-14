/**
 * Encounter spawner — MEMORY THIEF v2 (docs/GAME-DESIGN.md §7, Phase 5).
 *
 * Seats all 34 roster groups onto the generated city (one territory anchor
 * per group, inside its district), then runs the streaming rule:
 *
 *   - the 3 nearest non-defeated groups within ACTIVATE_RANGE become active
 *   - an active group spawns members.min..members.max fighters
 *   - the live-fighter budget is HARD-CAPPED at MAX_FIGHTERS (8)
 *   - leaving DESPAWN_RANGE streams a group's figures back out
 *   - a defeated group never spawns again (its ring turns gold)
 *
 * Owns the projectile pool (sorcerer bolts) and the territory rings.
 * DOM-free: the HUD reads snapshots, presentation arrives via callbacks.
 */

import * as THREE from 'three';
import { GROUPS, GROUP_BY_ID } from './groups.js';
import { DIFFICULTY_COLORS, rankTitle } from './ranking.js';
import { Fighter } from './fighter.js';
import { Overlord } from './boss_overlord.js';

export const ACTIVATE_RANGE = 46;
export const DESPAWN_RANGE = 70;
export const MAX_FIGHTERS = 8;
export const ACTIVE_GROUPS = 3;

/** Deterministic 0..1 hash from a string (stable anchors across rebuilds). */
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export class Spawner {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {() => object|null} o.getColliders
   * @param {object} o.callbacks { hitPlayer, onDamage, onSubdued, onAlert, onBlink, onEnemySwing, onProjectileHit }
   */
  constructor({ scene, getColliders, callbacks = {} }) {
    this.scene = scene;
    this.getColliders = getColliders;
    this.cb = callbacks;

    this.anchors = []; // { group, x, z, ring, active, defeated }
    this.fighters = [];
    this.projectiles = [];
    this.time = 0;
    this.ctx = {
      scene,
      get colliders() {
        return getColliders?.() ?? null;
      },
      playerPos: null,
      getFighters: () => this.fighters,
      hitPlayer: (dmg, info) => this.cb.hitPlayer?.(dmg, info) ?? { result: 'hit' },
      onDamage: (f, amount, info) => this.cb.onDamage?.(f, amount, info),
      onSubdued: (f) => this.cb.onSubdued?.(f),
      onAlert: (f) => this.cb.onAlert?.(f),
      onBlink: (f) => this.cb.onBlink?.(f),
      onEnemySwing: (f, res) => this.cb.onEnemySwing?.(f, res),
      // Phase 13 — the Overlord's phase machine + recovery windows
      onBossPhase: (f, phase, prev, title) => this.cb.onBossPhase?.(f, phase, prev, title),
      onBossWindow: (f) => this.cb.onBossWindow?.(f),
      getPowerHues: () => this.cb.getPowerHues?.() ?? [],
      markDead: (f) => this._remove(f),
      spawnProjectile: (f, target, dmg, opts) => this._spawnProjectile(f, target, dmg, opts),
    };

    this._projGeo = new THREE.SphereGeometry(0.16, 10, 8);
    this._ringGeo = new THREE.RingGeometry(3.1, 3.5, 56);
    this._groundGroup = new THREE.Group();
    this._groundGroup.name = 'territories';
    scene.add(this._groundGroup);
  }

  /* ------------------------------------------------------------------ *
   * World rebuild
   * ------------------------------------------------------------------ */

  /**
   * Seat every group on the fresh layout (called from generate()).
   * Idempotent: rebuilds anchors, drops live fighters from the old world.
   */
  rebuild(layout) {
    this._clearFighters();
    this._clearProjectiles();
    for (const a of this.anchors) a.ring?.removeFromParent();
    this.anchors = [];
    if (!layout) return;

    for (const group of GROUPS) {
      const anchor = this._seat(group, layout);
      const color = new THREE.Color(DIFFICULTY_COLORS[group.difficulty] ?? 0x888888);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(this._ringGeo, mat);
      ring.rotation.x = -Math.PI / 2;
      const y = this.getColliders()?.groundAt?.(anchor.x, anchor.z, 0) ?? 0;
      ring.position.set(anchor.x, y + 0.03, anchor.z);
      ring.renderOrder = 2;
      this._groundGroup.add(ring);
      this.anchors.push({
        group,
        x: anchor.x,
        z: anchor.z,
        ring,
        mat,
        active: false,
        defeated: false,
        pulse: hash01(group.id),
      });
    }
  }

  /** Pick a walkable seat for a group inside its own district. */
  _seat(group, layout) {
    const cells = layout.cells.filter((c) => c.district === group.district);
    const pool = cells.length ? cells : layout.cells;
    const pick = pool[Math.floor(hash01(group.id) * pool.length) % pool.length] ?? layout.cells[0];
    const jx = (hash01(group.id + 'x') - 0.5) * (pick.x1 - pick.x0) * 0.5;
    const jz = (hash01(group.id + 'z') - 0.5) * (pick.z1 - pick.z0) * 0.5;
    let x = pick.cx + jx;
    let z = pick.cz + jz;
    // nudge off anything solid (a doorway or a kiosk can sit on the centre)
    const colliders = this.getColliders();
    if (colliders?.hits) {
      for (let i = 0; i < 8; i++) {
        if (!colliders.hits(x, z, 0.6, 0.4)) break;
        x = pick.cx + (hash01(group.id + i) - 0.5) * (pick.x1 - pick.x0) * 0.8;
        z = pick.cz + (hash01(group.id + 'i' + i) - 0.5) * (pick.z1 - pick.z0) * 0.8;
      }
    }
    return { x, z };
  }

  /* ------------------------------------------------------------------ *
   * Frame
   * ------------------------------------------------------------------ */

  /**
   * @param {number} dt
   * @param {number} t world seconds
   * @param {{x:number,y:number,z:number, attacking?:boolean}} playerPos
   * @param {{enabled:boolean, defeatedSet:Set<string>}} opts
   */
  update(dt, t, playerPos, opts = {}) {
    this.time += dt;
    this.ctx.playerPos = playerPos;
    this.ctx._enabled = !!opts.enabled;
    const defeated = opts.defeatedSet ?? null;

    // ---- streaming: which groups are live? -------------------------------
    const cands = [];
    for (const a of this.anchors) {
      const gone = defeated?.has(a.group.id);
      if (gone && !a.defeated) this._markDefeated(a);
      if (a.defeated) continue;
      const d = Math.hypot(a.x - playerPos.x, a.z - playerPos.z);
      if (d <= ACTIVATE_RANGE) cands.push({ a, d });
    }
    cands.sort((p, q) => p.d - q.d);
    const wanted = cands.slice(0, ACTIVE_GROUPS).map((c) => c.a);
    for (const a of this.anchors) a.active = wanted.includes(a);

    // despawn groups that fell out of range — but never a subdued body:
    // the Requital is the ladder's whole economy, and a body that streamed
    // out from under the glove (death → respawn across the city) would take
    // the steal with it, soft-locking the climb. Downed waits for its thief.
    for (const f of [...this.fighters]) {
      if (f.stealable) continue;
      const a = this.anchors.find((an) => an.group === f.group);
      if (!a || !a.active) {
        const d = Math.hypot(f.x - playerPos.x, f.z - playerPos.z);
        if (d > DESPAWN_RANGE || !a) this._remove(f, true);
      }
    }

    // ---- spawn members for active groups (budgeted) ----------------------
    if (opts.enabled !== false) {
      for (const a of wanted) {
        const live = this.fighters.filter((f) => f.group === a.group && f.dying === 0);
        const need = this._memberCount(a.group) - live.length;
        if (need <= 0) continue;
        if (this.fighters.filter((f) => f.dying === 0).length >= MAX_FIGHTERS) break;
        for (let i = 0; i < need; i++) this._spawnMember(a, i);
      }
    }

    // ---- fighters ---------------------------------------------------------
    for (const f of [...this.fighters]) {
      f.update(dt, t, playerPos, !!opts.enabled);
    }

    // ---- territory rings (pulse + state colour) --------------------------
    for (const a of this.anchors) {
      if (!a.ring) continue;
      const near = Math.hypot(a.x - playerPos.x, a.z - playerPos.z) < ACTIVATE_RANGE;
      a.ring.visible = near && !a.defeated;
      if (a.ring.visible) {
        const s = 1 + Math.sin(t * 1.7 + a.pulse * 6.28) * 0.05;
        a.ring.scale.set(s, s, 1);
        a.mat.opacity = a.active ? 0.62 : 0.3;
      }
    }

    this._updateProjectiles(dt, playerPos);
  }

  _memberCount(group) {
    const { min, max } = group.members ?? { min: 3, max: 5 };
    const live = this.fighters.filter((f) => f.dying === 0).length;
    const room = MAX_FIGHTERS - live;
    if (room <= 0) return 0;
    const base = Math.min(min, room); // core squad first
    const trickle = room > min + 1 ? 1 : 0; // one extra while there's slack
    return Math.min(max, base + trickle);
  }

  _spawnMember(anchor, i) {
    const group = anchor.group;
    const n = this.fighters.filter((f) => f.group === group).length;
    const a = (i / Math.max(1, group.members?.max ?? 4)) * Math.PI * 2 + hash01(group.id + i);
    const r = 3.4 + hash01(group.id + 'r' + i) * 2.6;
    const x = anchor.x + Math.cos(a) * r;
    const z = anchor.z + Math.sin(a) * r;
    const colliders = this.getColliders();
    let sx = x;
    let sz = z;
    if (colliders?.hits) {
      for (let k = 0; k < 6 && colliders.hits(sx, sz, 0.6, 0.32); k++) {
        sx = anchor.x + Math.cos(a + k) * (r * 0.6);
        sz = anchor.z + Math.sin(a + k) * (r * 0.6);
      }
    }
    // Phase 13: the Overlord is his own class (3-phase FSM, telegraph rings)
    const Kind = group.encounter === 'boss' ? Overlord : Fighter;
    const f = new Kind({ group, index: n + i, x: sx, z: sz, ctx: this.ctx });
    this.fighters.push(f);
    return f;
  }

  /* ------------------------------------------------------------------ *
   * Projectiles (sorcerer bolts / nova chorus)
   * ------------------------------------------------------------------ */

  _spawnProjectile(fighter, target, dmg, opts = {}) {
    const nova = Math.max(1, Math.min(3, opts.nova ?? 1));
    for (let i = 0; i < nova; i++) {
      const mesh = new THREE.Mesh(
        this._projGeo,
        new THREE.MeshBasicMaterial({ color: opts.hue ?? 0xff7a3c, transparent: true, opacity: 0.95 }),
      );
      const y = fighter.y + 1.35;
      mesh.position.set(fighter.x, y, fighter.z);
      this.scene.add(mesh);
      this.projectiles.push({
        mesh,
        x: fighter.x,
        y,
        z: fighter.z,
        vx: 0,
        vy: 0,
        vz: 0,
        speed: opts.speed ?? 11,
        dmg,
        kind: opts.kind ?? 'magic',
        delay: i * 0.35, // nova rhythm: three beats, 0.35 s apart
        life: 3.2,
        srcX: fighter.x,
        srcZ: fighter.z,
        target,
      });
    }
  }

  _updateProjectiles(dt, playerPos) {
    for (const p of [...this.projectiles]) {
      if (p.delay > 0) {
        p.delay -= dt;
        p.mesh.visible = false;
        continue;
      }
      p.mesh.visible = true;
      p.life -= dt;
      // steer toward the player's current position (homing-lite)
      const tx = playerPos.x - p.x;
      const ty = playerPos.y + 1.0 - p.y;
      const tz = playerPos.z - p.z;
      const d = Math.hypot(tx, ty, tz) || 1;
      p.vx += (tx / d) * p.speed * 3 * dt;
      p.vy += (ty / d) * p.speed * 3 * dt;
      p.vz += (tz / d) * p.speed * 3 * dt;
      const vm = Math.hypot(p.vx, p.vy, p.vz) || 1;
      const k = Math.min(1, (p.speed * dt) / vm);
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.z += p.vz * k;
      p.mesh.position.set(p.x, p.y, p.z);

      const hitD = Math.hypot(p.x - playerPos.x, p.y - (playerPos.y + 1.0), p.z - playerPos.z);
      if (hitD < 0.85) {
        const res = this.ctx.hitPlayer(p.dmg, {
          posture: Math.round(p.dmg * 0.4),
          kind: p.kind,
          srcX: p.srcX,
          srcZ: p.srcZ,
        });
        this.cb.onProjectileHit?.(p, res);
        this._killProjectile(p);
        continue;
      }
      if (p.life <= 0 || p.y < -2) this._killProjectile(p);
    }
  }

  _killProjectile(p) {
    p.mesh.removeFromParent();
    p.mesh.material.dispose();
    const i = this.projectiles.indexOf(p);
    if (i >= 0) this.projectiles.splice(i, 1);
  }

  /* ------------------------------------------------------------------ *
   * State changes
   * ------------------------------------------------------------------ */

  /** The steal landed: this group's memory is taken — dissolve its figures. */
  defeatGroup(groupId) {
    const a = this.anchors.find((an) => an.group.id === groupId);
    if (a) this._markDefeated(a);
    for (const f of [...this.fighters]) {
      if (f.group.id === groupId) f.dissolve();
    }
  }

  _markDefeated(a) {
    a.defeated = true;
    a.active = false;
    if (a.mat) {
      a.mat.color.set(0xc8a24a); // gold: cleared territory
      a.mat.opacity = 0.22;
    }
  }

  _remove(f) {
    const i = this.fighters.indexOf(f);
    if (i >= 0) this.fighters.splice(i, 1);
    f.dispose();
  }

  _clearFighters() {
    for (const f of [...this.fighters]) f.dispose();
    this.fighters.length = 0;
  }

  _clearProjectiles() {
    for (const p of [...this.projectiles]) this._killProjectile(p);
  }

  /* ------------------------------------------------------------------ *
   * Queries (hooks + HUD)
   * ------------------------------------------------------------------ */

  /** Nearest stealable (subdued) fighter within `range` of a point. */
  nearestSubdued(x, z, range = 3.0) {
    let best = null;
    let bd = range;
    for (const f of this.fighters) {
      if (!f.stealable) continue;
      const d = Math.hypot(f.x - x, f.z - z);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  /**
   * The Requital gate: at least one member subdued and nobody left standing.
   * A half-alive gang keeps its memory — finish the fight first.
   */
  groupReady(groupId) {
    let down = 0;
    for (const f of this.fighters) {
      if (f.group.id !== groupId || f.dying > 0) continue;
      if (f.alive) return false;
      down++;
    }
    return down > 0;
  }

  /** Every fighter within `range` of a point (HUD nameplates, lock-on). */
  fightersNear(x, z, range = 30) {
    const out = [];
    for (const f of this.fighters) {
      const d = Math.hypot(f.x - x, f.z - z);
      if (d <= range) out.push({ f, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  }

  groupStatus() {
    return this.anchors.map((a) => ({
      id: a.group.id,
      rank: a.group.rank,
      name: a.group.name,
      title: rankTitle(a.group.rank),
      district: a.group.district,
      territory: a.group.territory,
      difficulty: a.group.difficulty, // map pins colour by it (Phase 10)
      x: Math.round(a.x),
      z: Math.round(a.z),
      active: a.active,
      defeated: a.defeated,
      members: this.fighters.filter((f) => f.group === a.group && f.dying === 0).length,
    }));
  }

  snapshot() {
    return {
      fighters: this.fighters.map((f) => f.snapshot()),
      projectiles: this.projectiles.length,
      anchors: this.anchors.length,
      active: this.anchors.filter((a) => a.active).map((a) => a.group.id),
      budget: MAX_FIGHTERS,
    };
  }

  dispose() {
    this._clearFighters();
    this._clearProjectiles();
    for (const a of this.anchors) a.ring?.removeFromParent();
    this.anchors = [];
    this._groundGroup.removeFromParent();
    this._ringGeo.dispose();
    this._projGeo.dispose();
  }
}

export { GROUP_BY_ID };
