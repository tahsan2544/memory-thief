/**
 * Enemy fighter — MEMORY THIEF v2 (docs/GAME-DESIGN.md §6–§8, Phase 4/5).
 *
 * One subdued-or-standing member of an encounter group. It owns:
 *   - a procedural body (createBystander figure) + its category weapon model
 *   - the behaviour brain from templates.js (archetype × tier stats × hook)
 *   - HP / posture / stagger / subdued state that the steal channel reads
 *
 * It never talks to the DOM. Presentation (damage numbers, cues) and the
 * player's retaliation arrive through `ctx` (see Spawner, Phase 5).
 *
 * Animation: locomotion rides the bystander clips; combat overlays a
 * post-update arm/torso override (strike envelope, guard, stagger, kneel)
 * so a fighter's swing always reads even at a distance.
 */

import * as THREE from 'three';
import { createBystander } from '../npc/bystander.js';
import { behaviourFor, bossTierStats, tierStats } from './templates.js';

/* --------------------------------------------------------------------- *
 * Weapon models — one procedural silhouette per category (one category
 * per group is the roster's hard rule, so a group reads at a glance).
 * --------------------------------------------------------------------- */

const STEEL = 0x9aa4b2;
const DARK = 0x3a3f47;
const WOOD = 0x6b5233;
const EMBER = 0xff7a3c;

function mat(hex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: opts.rough ?? 0.55,
    metalness: opts.metal ?? 0.35,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissive ? 0.9 : 0,
  });
}

/** Build a weapon for `category`; sized for a 1.78 m figure's right hand. */
export function makeWeaponModel(category) {
  const g = new THREE.Group();
  g.name = `weapon:${category}`;
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };

  switch (category) {
    case 'baton':
      add(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 8), mat(DARK, { metal: 0.6 }), 0, -0.34, 0);
      break;
    case 'knife':
      add(new THREE.BoxGeometry(0.035, 0.3, 0.012), mat(STEEL, { metal: 0.9, rough: 0.25 }), 0, -0.3, 0);
      add(new THREE.BoxGeometry(0.05, 0.1, 0.03), mat(WOOD, { rough: 0.9, metal: 0 }), 0, -0.08, 0);
      break;
    case 'sword':
      add(new THREE.BoxGeometry(0.05, 1.0, 0.016), mat(STEEL, { metal: 0.95, rough: 0.2 }), 0, -0.6, 0);
      add(new THREE.BoxGeometry(0.2, 0.035, 0.04), mat(0xc8a24a, { metal: 0.9 }), 0, -0.09, 0);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), mat(DARK, { rough: 0.9, metal: 0.1 }), 0, 0.02, 0);
      break;
    case 'staff':
      add(new THREE.CylinderGeometry(0.032, 0.032, 1.9, 8), mat(WOOD, { rough: 0.85, metal: 0.05 }), 0, -0.7, 0);
      add(new THREE.SphereGeometry(0.055, 10, 8), mat(STEEL, { metal: 0.9 }), 0, -1.65, 0);
      break;
    case 'hammer':
      add(new THREE.CylinderGeometry(0.035, 0.04, 1.0, 8), mat(WOOD, { rough: 0.9, metal: 0 }), 0, -0.5, 0);
      add(new THREE.BoxGeometry(0.3, 0.2, 0.2), mat(DARK, { metal: 0.75, rough: 0.4 }), 0, -1.0, 0);
      break;
    case 'axe':
      add(new THREE.CylinderGeometry(0.03, 0.035, 0.85, 8), mat(WOOD, { rough: 0.9, metal: 0 }), 0, -0.45, 0);
      add(new THREE.BoxGeometry(0.03, 0.26, 0.3), mat(STEEL, { metal: 0.9, rough: 0.3 }), 0, -0.86, 0.1);
      break;
    case 'chain': {
      // handle + a hanging run of links (cheap: torus rings on a pivot)
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 8), mat(DARK, { metal: 0.7 }), 0, -0.1, 0);
      const links = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 10), mat(STEEL, { metal: 0.9, rough: 0.35 }));
        ring.position.y = -0.24 - i * 0.075;
        ring.rotation.y = (i % 2) * Math.PI / 2;
        ring.castShadow = true;
        links.add(ring);
      }
      g.add(links);
      g.userData.chain = links;
      break;
    }
    case 'gauntlet':
      add(new THREE.BoxGeometry(0.17, 0.2, 0.2), mat(DARK, { metal: 0.85, rough: 0.35 }), 0, -0.12, 0.03);
      add(new THREE.BoxGeometry(0.19, 0.07, 0.06), mat(0xc8a24a, { metal: 0.9 }), 0, -0.04, 0.1);
      break;
    case 'focus': {
      const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), mat(EMBER, { emissive: EMBER, metal: 0.1, rough: 0.2 }));
      prism.position.y = -0.3;
      prism.castShadow = true;
      g.add(prism);
      g.userData.prism = prism;
      // a short baton the prism orbits
      add(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 8), mat(DARK, { metal: 0.5 }), 0, -0.16, 0);
      break;
    }
    default: // fists — nothing to hold
      break;
  }
  return g;
}

/* --------------------------------------------------------------------- *
 * Fighter
 * --------------------------------------------------------------------- */

const CLIP = {
  idle: 'idleShift',
  patrol: 'walk',
  chase: 'run',
  attack: 'standAttention',
  block: 'guardScan',
  stagger: 'startle',
};

export class Fighter {
  /**
   * @param {object} o
   * @param {object} o.group entries from enemies/groups.js
   * @param {number} o.index member index within the group (deterministic)
   * @param {number} o.x spawn x
   * @param {number} o.z spawn z
   * @param {object} o.ctx see Spawner (colliders, scene, hitPlayer, …)
   */
  constructor({ group, index, x, z, ctx }) {
    this.group = group;
    this.index = index;
    this.id = `${group.id}#${index}`;
    this.ctx = ctx;
    this.rank = group.rank;
    this.behaviour = behaviourFor(group);
    const tier = group.encounter === 'boss' || group.encounter === 'legendary'
      ? bossTierStats(this.rank)
      : tierStats(this.rank);

    const b = this.behaviour;
    this.maxHp = Math.round(tier.health * b.healthMul);
    this.hp = this.maxHp;
    this.maxPosture = Math.round(70 * b.postureMul);
    this.posture = 0;
    this.damage = Math.round(tier.damage * b.damageMul);
    this.attackInterval = tier.attackInterval / b.attackSpeedMul;
    this.moveSpeed = tier.moveSpeed * b.moveSpeedMul;
    this.attackRange = tier.attackRange;
    this.detectRange = tier.detectionRange * b.detectionMul;
    this.weapon = group.weapon;

    this.x = x;
    this.z = z;
    this.y = 0;
    this.yaw = (index * 2.4 + group.rank) % (Math.PI * 2);
    this.state = 'idle'; // idle | patrol | chase | attack | block | dodge | stagger | subdued
    this.stateT = 0; // seconds left in the current state
    this.attackPhase = null; // windup | active | recover
    this.cooldown = 0; // global attack cadence
    this.staggerT = 0;
    this.kbX = 0;
    this.kbZ = 0;
    this.kbT = 0;
    this.flashT = 0;
    this._patrolT = 0;
    this._homeX = x;
    this._homeZ = z;
    this._blinkCd = 0;
    this._aoeCd = 0;
    this._phase = 1; // boss phases
    this.dying = 0; // >0 while dissolving after a steal

    // ---- body ----------------------------------------------------------
    const seed = group.rank * 97 + index * 13 + 7;
    const palette = GROUP_COAT[group.district] ?? GROUP_COAT.default;
    this.figure = createBystander({
      seed,
      role: 'guard',
      coat: palette.coat,
      accent: palette.accent,
    });
    this.parts = this.figure.parts;
    this.height = this.figure.height;

    // weapon hangs from the forearm so it swings with the elbow
    this.weaponMesh = makeWeaponModel(this.weapon);
    if (this.weapon !== 'fists') {
      this.weaponMesh.position.set(0, -0.3, 0.03);
      this.parts.foreR.add(this.weaponMesh);
    }

    // boss/legendary silhouette: bigger, heavier read
    if (group.encounter === 'boss') this.figure.group.scale.multiplyScalar(1.55);
    else if (group.encounter === 'legendary') this.figure.group.scale.multiplyScalar(1.18);

    ctx.scene.add(this.figure.group);
    this._baseScale = {
      x: this.figure.group.scale.x,
      y: this.figure.group.scale.y,
      z: this.figure.group.scale.z,
    };
    this._applyPose(0);
  }

  get alive() {
    return this.hp > 0 && this.state !== 'subdued' && this.dying === 0;
  }

  get stealable() {
    return this.hp <= 0 && this.state === 'subdued';
  }

  /* ------------------------------------------------------------------ *
   * Damage in
   * ------------------------------------------------------------------ */

  /**
   * A player strike lands here.
   * @param {number} amount
   * @param {{posture?:number, kind?:string, breakGuard?:boolean, source?:string, dirX?:number, dirZ?:number}} info
   */
  takeDamage(amount, info = {}) {
    if (this.state === 'subdued' || this.dying > 0) return 0;
    const b = this.behaviour;

    // brutes shrug off light hits (weight-armor hook)
    let dmg = amount;
    if (this.group.specialHook === 'weight-armor' && info.kind === 'light') dmg = Math.max(1, Math.round(dmg * 0.35));

    const hpBefore = this.hp; // the guard's chip below is measured from THIS
    this.hp = Math.max(0, this.hp - dmg);
    this.flashT = 0.12;

    // blocking fighters eat guard-breaks, otherwise keep the guard up
    if (this.state === 'block') {
      if (info.breakGuard || this.group.specialHook === 'guard-break-openers') {
        this.state = 'stagger';
        this.staggerT = 0.7;
        this.posture = this.maxPosture;
      } else if (info.kind !== 'special') {
        dmg = Math.max(1, Math.round(dmg * 0.4));
        // Chip only — and measured from the PRE-hit hp. Adding `amount` back
        // onto the already-clamped hp used to heal a blocking fighter out of
        // a lethal hit (a 999999 nuke restored it to full); chip can now
        // only ever move hp toward 0, never above where it started.
        this.hp = Math.max(0, Math.min(this.maxHp, hpBefore - dmg));
      }
    }

    this.posture += info.posture ?? 0;
    if (this.posture >= this.maxPosture && this.state !== 'subdued') {
      this.posture = 0;
      this.state = 'stagger';
      this.staggerT = 1.1;
    } else if (this.state === 'idle' || this.state === 'patrol') {
      this.state = 'chase'; // getting hit always wakes the fight up
    }

    // knockback along the swing
    if (info.dirX || info.dirZ) {
      const k = info.kind === 'heavy' || info.kind === 'special' ? 0.34 : 0.18;
      this.kbX = info.dirX * k;
      this.kbZ = info.dirZ * k;
      this.kbT = 0.22;
    }

    if (this.hp <= 0) {
      this.state = 'subdued';
      this.stateT = 0;
      this.attackPhase = null;
      this.ctx.onSubdued?.(this);
    }
    this.ctx.onDamage?.(this, dmg, info);
    return dmg;
  }

  /** The steal finished — the group's memory is taken. Dissolve away. */
  dissolve() {
    this.dying = 0.9;
    this.state = 'subdued';
  }

  /* ------------------------------------------------------------------ *
   * Frame
   * ------------------------------------------------------------------ */

  /**
   * @param {number} dt
   * @param {number} t elapsed world seconds
   * @param {{x:number,z:number,y:number}} playerPos
   * @param {boolean} playerActive combat allowed (no overlay / extraction)
   */
  update(dt, t, playerPos, playerActive) {
    if (this.dying > 0) {
      this.dying = Math.max(0, this.dying - dt);
      const k = this.dying / 0.9;
      const b = this._baseScale ?? { x: 1, y: 1, z: 1 };
      this.figure.group.scale.set(b.x * k, b.y * k, b.z * k);
      this.figure.group.position.y = this.y + (1 - k) * 1.2;
      if (this.dying === 0) this.ctx.markDead?.(this);
      return;
    }

    // timers
    this.cooldown = Math.max(0, this.cooldown - dt);
    this._blinkCd = Math.max(0, this._blinkCd - dt);
    this._aoeCd = Math.max(0, this._aoeCd - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.kbT > 0) this.kbT = Math.max(0, this.kbT - dt);
    if (this.staggerT > 0) {
      this.staggerT = Math.max(0, this.staggerT - dt);
      if (this.staggerT === 0 && this.state === 'stagger') this.state = 'chase';
    }

    const ground = this.ctx.colliders?.groundAt?.(this.x, this.z, this.y) ?? 0;
    this.y = ground;

    if (this.state === 'subdued') {
      // kneeling: no brain, just the pose
      this._integrate(dt, 0);
      this._pose(dt, t, playerPos, 0);
      return;
    }

    const dx = playerPos.x - this.x;
    const dz = playerPos.z - this.z;
    const dist = Math.hypot(dx, dz);
    const b = this.behaviour;

    // ---- state machine --------------------------------------------------
    switch (this.state) {
      case 'stagger':
        this._integrate(dt, 0);
        break;

      case 'attack':
        this._tickAttack(dt, dist, dx, dz, playerPos);
        break;

      case 'block':
        this.stateT -= dt;
        if (this.stateT <= 0) this.state = 'chase';
        this._integrate(dt, 0);
        break;

      case 'dodge':
        this.stateT -= dt;
        this._integrate(dt, this.moveSpeed * 1.6);
        if (this.stateT <= 0) this.state = 'chase';
        break;

      default: {
        // idle | patrol | chase
        const awake = playerActive && dist < this.detectRange;
        if (awake && this.state !== 'chase') {
          this.state = 'chase';
          this.ctx.onAlert?.(this);
        }
        if (this.state === 'chase') {
          if (!playerActive || dist > this.detectRange * 1.7) {
            this.state = 'patrol'; // disengaged: back to the territory beat
            break;
          }
          // sorcerers hold their band; skirmishers keep a preferred range
          let want = 0;
          const pref = b.arch === 'sorcerer' ? 9 : b.arch === 'skirmisher' ? this.attackRange * 0.8 : 0;
          if (dist > this.attackRange * 0.9) want = 1;
          else if (pref && dist < pref - 1.5) want = -1;

          // reactions: block/dodge chance when the player is swinging
          if (this.cooldown <= 0 && playerPos.attacking) {
            if (Math.random() < b.dodgeChance && this.state !== 'dodge') {
              this.state = 'dodge';
              this.stateT = 0.32;
              const s = Math.sign(Math.random() < 0.5 ? 1 : -1) || 1;
              this.kbX = (-dz / (dist || 1)) * s * 1.6;
              this.kbZ = (dx / (dist || 1)) * s * 1.6;
              this.kbT = 0.32;
              break;
            }
            if (Math.random() < b.blockChance) {
              this.state = 'block';
              this.stateT = 0.7 + Math.random() * 0.6;
              break;
            }
          }

          if (dist <= this.attackRange && this.cooldown <= 0) {
            this._beginAttack(dist, dx, dz);
          } else {
            // group hooks that need space (blink approach, snare retreat…)
            this._hookMovement(dt, dist, dx, dz, playerPos);
            if (want > 0) this._integrate(dt, this.moveSpeed, 1);
            else if (want < 0) this._integrate(dt, this.moveSpeed * 0.7, -1);
            else this._integrate(dt, 0); // in range, waiting out the cadence
          }
        } else {
          // patrol around the territory anchor
          this._patrolT -= dt;
          if (this._patrolT <= 0) {
            this._patrolT = 2.5 + Math.random() * 3;
            const a = Math.random() * Math.PI * 2;
            const r = 1.5 + Math.random() * 3.5;
            this._patrolX = this._homeX + Math.cos(a) * r;
            this._patrolZ = this._homeZ + Math.sin(a) * r;
          }
          const pdx = this._patrolX ?? this._homeX;
          const pdz = this._patrolZ ?? this._homeZ;
          const pd = Math.hypot(pdx - this.x, pdz - this.z);
          if (pd > 0.4) this._integrate(dt, 1.4, undefined, pdx, pdz);
          else this._integrate(dt, 0);
        }
        break;
      }
    }

    // group special hook: ranged pressure (sorcerers & the bolt hooks)
    if (playerActive && this.state !== 'subdued' && this.cooldown <= 0) {
      this._hookRanged(dist, playerPos, dt);
    }

    this._pose(dt, t, playerPos, dist);
  }

  /* ---- brain pieces --------------------------------------------------- */

  _beginAttack(dist, dx, dz) {
    const b = this.behaviour;
    this.state = 'attack';
    this.attackPhase = 'windup';
    this.stateT = Math.max(0.18, b.reactionMs / 1000);
    this._attackDist = dist;
    // bosses telegraph longer and swing heavier in later phases
    if (this.group.encounter === 'boss') this.stateT = Math.max(0.3, this.stateT / this._phase);
  }

  _tickAttack(dt, dist, dx, dz, playerPos) {
    this.stateT -= dt;
    if (this.attackPhase === 'windup' && this.stateT <= 0) {
      this.attackPhase = 'active';
      this.stateT = 0.14;
      // hit test (arc + reach; aoe hooks ignore the arc)
      const reach = this.attackRange + 0.5;
      const isAoe = /smash|slam|ripples|ground/.test(this.group.specialHook ?? '');
      const inArc = isAoe || dist <= reach;
      if (inArc && dist <= reach + (isAoe ? 1.6 : 0.4)) {
        const kind = this.behaviour.arch === 'brute' ? 'heavy' : 'melee';
        const res = this.ctx.hitPlayer?.(this.damage, {
          posture: Math.round(this.damage * 0.5),
          kind,
          srcX: this.x,
          srcZ: this.z,
          source: this,
        });
        this.ctx.onEnemySwing?.(this, res);
      }
    } else if (this.attackPhase === 'active' && this.stateT <= 0) {
      this.attackPhase = 'recover';
      this.stateT = this.attackInterval * 0.55;
    } else if (this.attackPhase === 'recover' && this.stateT <= 0) {
      this.attackPhase = null;
      this.state = 'chase';
      this.cooldown = this.attackInterval;
      // counter archetypes step back after opening; brutes stay in
      if (this.behaviour.arch === 'counter' && Math.random() < 0.5) {
        this.state = 'block';
        this.stateT = 0.6;
      }
    }
    this._integrate(dt, 0);
  }

  /** Skirmisher spacing + chain snare + blink approaches. */
  _hookMovement(dt, dist, dx, dz, playerPos) {
    const hook = this.group.specialHook ?? '';
    if (hook === 'blink-behind' && this._blinkCd <= 0 && dist > 4 && dist < 16 && Math.random() < 0.01) {
      const a = Math.atan2(dx, dz) + Math.PI;
      const nx = playerPos.x + Math.sin(a) * 2.2;
      const nz = playerPos.z + Math.cos(a) * 2.2;
      if (!this.ctx.colliders?.hits?.(nx, nz, 0.6, 0.32)) {
        this.x = nx;
        this.z = nz;
        this._blinkCd = 6;
        this.ctx.onBlink?.(this);
      }
    }
    if (hook === 'snare-retreat' && dist < 3 && this.cooldown <= 0 && Math.random() < 0.01) {
      this.state = 'dodge';
      this.stateT = 0.4;
      const n = Math.hypot(dx, dz) || 1;
      this.kbX = (-dx / n) * 2.4;
      this.kbZ = (-dz / n) * 2.4;
      this.kbT = 0.4;
      this.cooldown = 2.5;
    }
  }

  /** Sorcerer / bolt-hook projectiles (handled by the Spawner's pool). */
  _hookRanged(dist, playerPos, dt) {
    const b = this.behaviour;
    const isBolt = b.arch === 'sorcerer' || /channel-bolts|aura-bolt/.test(this.group.specialHook ?? '');
    if (!isBolt) return;
    if (dist < 5 || dist > 20) return;
    if (Math.random() > 0.6 * dt) return; // ~0.6 attempts/second, frame-rate safe
    this.cooldown = this.attackInterval * 1.4;
    this.state = 'attack';
    this.attackPhase = 'windup';
    this.stateT = 0.45;
    this.ctx.spawnProjectile?.(this, playerPos, this.damage, {
      speed: 11,
      kind: 'magic',
      hue: 0xff7a3c,
      nova: this.group.specialHook === 'nova-rhythm' ? 3 : 1,
    });
  }

  /* ---- movement ------------------------------------------------------- */

  /**
   * Move along the facing yaw (toward the player while chasing), or toward an
   * explicit target (patrol). `forwardSign = -1` walks backwards (retreat).
   * Knockback rides on top for its short life; fighters never overlap.
   */
  _integrate(dt, speed, forwardSign, tgtX, tgtZ) {
    let vx = 0;
    let vz = 0;
    if (speed !== 0) {
      let dirX;
      let dirZ;
      if (tgtX !== undefined) {
        const n = Math.hypot(tgtX - this.x, tgtZ - this.z) || 1;
        dirX = (tgtX - this.x) / n;
        dirZ = (tgtZ - this.z) / n;
      } else {
        dirX = Math.sin(this.yaw);
        dirZ = Math.cos(this.yaw);
      }
      const sign = forwardSign !== undefined && forwardSign < 0 ? -1 : 1;
      vx = dirX * Math.abs(speed) * sign;
      vz = dirZ * Math.abs(speed) * sign;
    }
    // knockback rides on top for its short life
    if (this.kbT > 0) {
      vx += this.kbX * 6;
      vz += this.kbZ * 6;
    }

    const colliders = this.ctx.colliders;
    if ((vx || vz) && colliders?.moveAxis) {
      const feet = this.y;
      let [nx, nz] = colliders.moveAxis(this.x, this.z, vx * dt, 0, feet);
      [nx, nz] = colliders.moveAxis(nx, nz, 0, vz * dt, feet);
      // fighters never walk through each other
      const others = this.ctx.getFighters?.() ?? [];
      for (const o of others) {
        if (o === this || o.dying > 0) continue;
        const ox = nx - o.x;
        const oz = nz - o.z;
        const d2 = ox * ox + oz * oz;
        if (d2 < 1.1 * 1.1 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (1.1 - d) * 0.5;
          nx += (ox / d) * push;
          nz += (oz / d) * push;
        }
      }
      this.x = nx;
      this.z = nz;
    }
    // face the way we move (or the player while chasing)
    if (this.state === 'chase' && this.ctx.playerPos) {
      const p = this.ctx.playerPos;
      this.yaw = turnToward(this.yaw, Math.atan2(p.x - this.x, p.z - this.z), dt * 6);
    } else if (vx || vz) {
      this.yaw = turnToward(this.yaw, Math.atan2(vx, vz), dt * 6);
    }
  }

  /* ---- animation ------------------------------------------------------ */

  _pose(dt, t, playerPos, dist) {
    const f = this.figure;

    // locomotion clip + gait
    let clip = CLIP.idle;
    let gait = 0;
    if (this.state === 'chase' && dist > this.attackRange * 0.7) {
      clip = CLIP.chase;
      gait = 1;
    } else if (this.state === 'patrol') {
      clip = CLIP.patrol;
      gait = 0.6;
    } else if (this.state === 'attack' || this.state === 'block') {
      clip = this.state === 'block' ? CLIP.block : CLIP.attack;
      gait = 0;
    } else if (this.state === 'stagger') {
      clip = CLIP.stagger;
      gait = 0;
    }
    // placement first — the clip reads baseY/yaw from the group
    f.setPosition(this.x, this.y, this.z);
    f.setYaw(this.yaw);
    f.setAnim(clip);
    f.setGait(gait);
    f.update(dt, t, playerPos ?? null);
    this._applyPose(dt, t);
  }

  /**
   * Combat overlay: runs *after* the clip so a swing always wins the arm.
   * Mirrors the player animator's envelope conventions (negative x = forward).
   */
  _applyPose(dt, t = 0) {
    const p = this.parts;
    if (!p) return;

    // hit flash: a quick scale pop (materials are shared across figures —
    // never tint them, or every civilian in the city flashes with you)
    const pop = this.flashT > 0 ? 1 + this.flashT * 0.6 : 1;
    const b = this._baseScale ?? { x: 1, y: 1, z: 1 };
    this.figure.group.scale.set(b.x * pop, b.y * pop, b.z * pop);

    if (this.state === 'subdued') {
      // kneel: thighs forward-under, shins folded, head bowed, arms slack
      p.legL.rotation.x = 1.35;
      p.legR.rotation.x = 0.5;
      p.kneeL.rotation.x = 2.3;
      p.kneeR.rotation.x = 2.4;
      p.armL.rotation.x = 0.5;
      p.armR.rotation.x = 0.45;
      p.armL.rotation.z = -0.2;
      p.armR.rotation.z = 0.2;
      p.foreL.rotation.x = -0.6;
      p.foreR.rotation.x = -0.5;
      p.torso.rotation.x = 0.35;
      p.head.rotation.x = 0.5;
      this.figure.group.position.y = this.y - 0.42;
      return;
    }

    if (this.state === 'stagger') {
      const w = Math.min(1, this.staggerT);
      p.torso.rotation.x = -0.4 * w;
      p.head.rotation.x = -0.3 * w;
      p.armL.rotation.x = 0.6 * w;
      p.armR.rotation.x = 0.65 * w;
      p.armL.rotation.z = -0.35 * w;
      p.armR.rotation.z = 0.35 * w;
      return;
    }

    if (this.state === 'block') {
      p.armL.rotation.x = -1.2;
      p.armR.rotation.x = -1.15;
      p.armL.rotation.z = -0.25;
      p.armR.rotation.z = 0.25;
      p.foreL.rotation.x = -1.5;
      p.foreR.rotation.x = -1.45;
      p.torso.rotation.x = 0.08;
      return;
    }

    if (this.state === 'attack') {
      // envelope: windup (pull back) → snap forward → recover
      let w;
      if (this.attackPhase === 'windup') {
        const k = 1 - Math.max(0, this.stateT) / Math.max(0.01, this.behaviour.reactionMs / 1000);
        w = -0.5 * k;
      } else if (this.attackPhase === 'active') {
        w = 1;
      } else {
        w = 0.3;
      }
      const heavy = this.behaviour.arch === 'brute';
      p.armR.rotation.x = (heavy ? -1.9 : -1.6) * w + (1 - Math.abs(w)) * 0.2;
      p.armR.rotation.z = 0.15 + 0.25 * Math.max(0, w);
      p.foreR.rotation.x = -(heavy ? 0.4 : 0.8) * w - 0.3;
      p.torso.rotation.y = -0.4 * w;
      p.torso.rotation.x = 0.12 * w;
      // off-hand braces forward for balance
      p.armL.rotation.x = -0.7 * Math.max(0, w);
      p.foreL.rotation.x = -0.9 * Math.max(0, w);
      return;
    }

    // chase/idle: hands ready (a fighter never swings its arms like a civilian)
    if (this.state === 'chase') {
      p.armL.rotation.x = -0.5;
      p.armR.rotation.x = -0.55;
      p.foreL.rotation.x = -1.1;
      p.foreR.rotation.x = -1.15;
      p.torso.rotation.x = 0.1;
    }
  }

  /* ---- teardown ------------------------------------------------------- */

  dispose() {
    this.weaponMesh?.removeFromParent();
    this.figure.group.removeFromParent();
    this.figure.dispose();
    this.weaponMesh?.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) o.material.dispose?.();
    });
  }

  snapshot() {
    return {
      id: this.id,
      group: this.group.id,
      rank: this.rank,
      state: this.state,
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      posture: Math.round(this.posture),
      x: Math.round(this.x * 100) / 100,
      z: Math.round(this.z * 100) / 100,
      weapon: this.weapon,
      behaviour: this.behaviour.arch,
      hook: this.group.specialHook,
      stealable: this.stealable,
    };
  }
}

function turnToward(cur, target, k) {
  let d = (target - cur) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return cur + d * Math.min(1, k);
}

/** Per-district coat colours so a territory reads before the nameplate does. */
const GROUP_COAT = {
  oldquarter: { coat: 0x3f4654, accent: 0xb4653f },
  glassline: { coat: 0x2f4a5e, accent: 0x7fb4d6 },
  floodworks: { coat: 0x2f5050, accent: 0x6fe4d0 },
  verdant: { coat: 0x3b5140, accent: 0x8fbf7a },
  underarchive: { coat: 0x413a4f, accent: 0xa38fd6 },
  outskirts: { coat: 0x554b3f, accent: 0xd0a3ff },
  default: { coat: 0x444a55, accent: 0xc9a24a },
};
