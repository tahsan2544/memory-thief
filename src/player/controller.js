import * as THREE from 'three';
import { CharacterAnimator } from '../character/animator.js';
import { createRivenVale } from '../character/rivenVale.js';

/**
 * Third-person character controller for Riven Vale.
 *
 * Deliberately small and readable: camera-relative intent → smoothed velocity
 * → per-axis sweep against the collision world → ground probe. No physics
 * engine, no slippery drift.
 *
 * Feel targets (tuned for a 16 m wide street grid):
 *   walk 3.4 m/s · sprint 6.7 m/s · jump ≈ 1.4 m · turn ~12 rad/s smoothing
 *   acceleration 14 / deceleration 18 (ground) so stops are crisp
 */

const TWO_PI = Math.PI * 2;

function angleLerp(from, to, k) {
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return from + d * k;
}

export class PlayerController {
  constructor({ input, getColliders, cameraRig, settings }) {
    this.input = input;
    this.getColliders = getColliders;
    this.cameraRig = cameraRig;
    this.settings = settings;

    this.rig = createRivenVale();
    this.animator = new CharacterAnimator(this.rig);

    this.position = new THREE.Vector3(0, 0, 0); // logical feet position
    this.renderY = 0; // smoothed height for the mesh/camera (hides step pops)
    this.velocity = new THREE.Vector3();
    this.grounded = true;
    this.coyote = 0; // seconds since leaving the ground
    this.facing = 0;
    this.active = false;
    this.frozen = false;
    this.crouching = false;

    this.walkSpeed = 3.4;
    this.runSpeed = 6.7;
    this.jumpSpeed = 7.7;
    this.gravity = 21;
    this.maxFall = 48;

    this._wishX = 0;
    this._wishZ = 0;

    // Combat hooks (Phase 2) — kept inert by default so movement is
    // byte-identical to the pre-combat controller:
    //   speedScale  attack/dodge slow-down applied to the movement cap
    //   faceTarget  lock-on heading the body holds while engaged
    //   impulse     driven dodge roll / hit knockback (dir × speed × duration)
    this.speedScale = 1;
    this.faceTarget = null;
    this.impulseX = 0;
    this.impulseZ = 0;
    this.impulseSpeed = 0;
    this.impulseT = 0;
    this.impulseDur = 0;

    // Phase 7 — presentation callbacks wired from main.js:
    //   onStep(isRun)  fires on each stride heel-strike (footstep audio)
    //   onLand()       fires when a fall touches down (landing thud)
    this.onStep = null;
    this.onLand = null;
    this._lastPhase = 0;
    // total simulated seconds (wall-clock-paced; smoke compares it to real time
    // to prove the game never drops into slow motion at low frame rates)
    this.simSeconds = 0;
    // highest y reached during this frame's substeps — a jump can rise and
    // land inside a single slow frame, and the snapshot must still show it
    this.apexY = 0;
  }

  get speed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /** Drop the character at a road point (used at boot and by tests). */
  spawn(x, z, yaw = 0) {
    const colliders = this.getColliders();
    const y = colliders ? colliders.groundAt(x, z, 0.18) : 0;
    this.position.set(x, y, z);
    this.renderY = y;
    this.apexY = y; // a stale apex from the previous spot would fake a jump
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.coyote = 0;
    this.facing = yaw;
    this.speedScale = 1;
    this.faceTarget = null;
    this.impulseT = 0;
    this.animator.reset();
    this.rig.group.position.set(x, y, z);
    this.rig.group.rotation.y = yaw;
    this.cameraRig.setYaw(yaw + Math.PI); // camera starts behind the character
    this.cameraRig.reset();
    this.cameraRig.snapPivot?.(x, y, z);
    return this.position;
  }

  /**
   * @param {number} dt clamped simulation step (the pacing fallback)
   * @param {string[]} pressed key codes consumed this frame
   * @param {{frozen?: boolean, rawDt?: number}} opts rawDt is the frame's real
   *   wall-clock span — see the pacing note below
   */
  update(dt, pressed, opts = {}) {
    if (!this.active) return;
    const colliders = this.getColliders();
    if (!colliders) return;

    const input = this.input;
    const frozen = opts.frozen || this.frozen;

    // ---- frame pacing: physics substeps ------------------------------------
    // A rendered frame can be far longer than one safe physics step (a
    // crawling GPU, a background stall). One big step would tunnel through
    // walls; integrating on the clamped dt alone makes the whole game run in
    // slow motion below ~10 fps. So the physics advances in fixed ≤33 ms
    // substeps that together cover the frame's real span (capped at 1 s so a
    // long stall cannot freeze the sim in a catch-up spiral). At 60 fps this
    // is exactly one step — identical behaviour, negligible overhead. Each
    // step stays far below the 0.75 m sweep-safety threshold.
    const budget = Math.min(opts.rawDt ?? dt, 1.0);
    const SUB = 1 / 30;
    const steps = Math.max(1, Math.min(30, Math.ceil(budget / SUB - 1e-6)));
    const h = budget / steps;
    this.simSeconds += budget;
    let apex = this.position.y; // per-frame peak, tracked across the substeps

    // ---- intent (camera-relative), read once per frame --------------------
    let ix = 0;
    let iz = 0;
    if (!frozen) {
      if (input.isDown('KeyW')) iz += 1;
      if (input.isDown('KeyS')) iz -= 1;
      if (input.isDown('KeyD')) ix += 1;
      if (input.isDown('KeyA')) ix -= 1;
    }
    const mag = Math.hypot(ix, iz);
    if (mag > 1e-4) {
      ix /= mag;
      iz /= mag;
    }

    const sprinting =
      !frozen && (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && mag > 1e-4;
    // Phase 8: hold Ctrl to crouch / sneak — slower, lower profile, and you
    // cannot sprint out of a crouch.
    const crouching = !frozen && !sprinting &&
      (input.isDown('ControlLeft') || input.isDown('ControlRight'));
    this.crouching = crouching;
    const walkNow = crouching ? this.walkSpeed * 0.45 : this.walkSpeed;
    // combat swings/dodges scale the cap (setSpeedScale); 1 = untouched
    const maxSpeed = (sprinting ? this.runSpeed : walkNow) * this.speedScale;

    const b = this.cameraRig.basis;
    const wishX = (b.fx * iz + b.rx * ix) * maxSpeed;
    const wishZ = (b.fz * iz + b.rz * ix) * maxSpeed;
    this._wishX = wishX;
    this._wishZ = wishZ;
    const moving = mag > 1e-4;

    for (let step = 0; step < steps; step++) {
      if (this.impulseT > 0) {
        // driven dodge roll / hit knockback: the impulse owns the velocity
        // (a gentle ease-out so the roll decelerates instead of stopping dead)
        const k = 1 - Math.min(1, this.impulseT / this.impulseDur);
        const s = this.impulseSpeed * (1 - k * (this._impulseEase ?? 0.6));
        this.velocity.x = this.impulseX * s;
        this.velocity.z = this.impulseZ * s;
      } else {
        // ---- acceleration ---------------------------------------------------
        let rate;
        if (!this.grounded) rate = 5;
        else if (moving) rate = 14;
        else rate = 18;
        const k = 1 - Math.exp(-rate * h);
        this.velocity.x += (wishX - this.velocity.x) * k;
        this.velocity.z += (wishZ - this.velocity.z) * k;
      }

      // ---- jump / gravity (the Space press fires on the first substep) ----
      if (!frozen && step === 0 && pressed?.includes('Space') && (this.grounded || this.coyote > 0)) {
        this.velocity.y = this.jumpSpeed;
        this.grounded = false;
        this.coyote = 0;
      }
      if (!this.grounded) {
        this.velocity.y = Math.max(-this.maxFall, this.velocity.y - this.gravity * h);
        this.coyote = Math.max(0, this.coyote - h);
      }

      // ---- horizontal sweep (per axis -> natural wall sliding) ------------
      const feet = this.position.y;
      const dx = this.velocity.x * h;
      const dz = this.velocity.z * h;
      let [px, pz] = colliders.moveAxis(this.position.x, this.position.z, dx, 0, feet);
      [px, pz] = colliders.moveAxis(px, pz, 0, dz, feet);
      this.position.x = px;
      this.position.z = pz;

      // ---- vertical -------------------------------------------------------
      this.position.y += this.velocity.y * h;
      const ground = colliders.groundAt(this.position.x, this.position.z, this.position.y);

      if (this.grounded) {
        const rise = ground - this.position.y;
        if (rise < -0.08) {
          // walked off a ledge — brief coyote window to still catch a jump
          this.grounded = false;
          this.coyote = 0.14;
        } else {
          this.position.y = ground;
          if (this.velocity.y < 0) this.velocity.y = 0;
        }
      } else if (this.velocity.y <= 0 && this.position.y <= ground) {
        this.position.y = ground;
        this.velocity.y = 0;
        this.grounded = true;
        this.animator.onLand();
        this.onLand?.();
      }
      if (this.position.y > apex) apex = this.position.y;
    }
    this.apexY = apex;
    if (this.impulseT > 0) this.impulseT = Math.max(0, this.impulseT - budget);

    // ---- facing + presentation (one pass per frame, on the real span) ----
    const speed = this.speed;
    if (this.faceTarget != null) {
      // lock-on: the body holds the target's heading while engaged
      this.facing = angleLerp(this.facing, this.faceTarget, 1 - Math.exp(-11 * budget));
    } else if (speed > 0.6) {
      this.facing = angleLerp(this.facing, Math.atan2(this.velocity.x, this.velocity.z), 1 - Math.exp(-12 * budget));
    } else if (moving) {
      this.facing = angleLerp(this.facing, Math.atan2(wishX, wishZ), 1 - Math.exp(-14 * budget));
    }

    this.renderY += (this.position.y - this.renderY) * (1 - Math.exp(-18 * budget));
    if (Math.abs(this.position.y - this.renderY) > 0.6) this.renderY = this.position.y;

    this.rig.group.position.set(this.position.x, this.renderY, this.position.z);
    this.rig.group.rotation.y = this.facing;

    this.animator.update(budget, {
      speed,
      maxSpeed: this.runSpeed,
      walkSpeed: this.walkSpeed,
      grounded: this.grounded,
      vy: this.velocity.y,
      crouch: crouching,
    });

    // ---- footstep events (Phase 7) --------------------------------------
    // The animator's stride phase advances 0..2π per full cycle; each half
    // cycle is one footfall, so we fire onStep at every π crossing while the
    // character is actually striding on the ground.
    if (this.grounded && speed > 0.7 && this.animator.blend > 0.15) {
      const ph = this.animator.phase;
      const half = Math.PI;
      const crossed = Math.floor(ph / half) !== Math.floor(this._lastPhase / half) || ph < this._lastPhase;
      if (crossed) this.onStep?.(speed > this.walkSpeed * 1.15);
    }
    this._lastPhase = this.animator.phase;
  }

  /** Head-height point the camera orbits around. */
  cameraTarget(out) {
    out.set(this.position.x, this.renderY + 0.05, this.position.z);
    return out;
  }

  /** Sustain the extraction (glove raised) pose while channeling. */
  setChannel(on) {
    this.animator.setChannel(on);
  }

  /** Fire a one-shot arm gesture (reach / point) when interacting. */
  gesture(name = 'reach') {
    this.animator.fireGesture(name);
  }

  /* ---- combat hooks (Phase 2) ---------------------------------------- */

  /** Scale the movement cap (1 = untouched). Attacks swing at 0.4, etc. */
  setSpeedScale(k) {
    this.speedScale = Math.max(0, Number.isFinite(k) ? k : 1);
  }

  /** Lock-on heading (radians) the body holds, or null to hand back to velocity. */
  setFaceTarget(yaw) {
    this.faceTarget = Number.isFinite(yaw) ? yaw : null;
  }

  /**
   * Driven dodge roll / knockback: velocity becomes `dir × speed` for
   * `dur` seconds with a soft ease-out. Grounded motion only.
   */
  impulse(dirX, dirZ, speed, dur, easeOut = 0.6) {
    const m = Math.hypot(dirX, dirZ) || 1;
    this.impulseX = dirX / m;
    this.impulseZ = dirZ / m;
    this.impulseSpeed = speed;
    this.impulseDur = Math.max(0.05, dur);
    this.impulseT = this.impulseDur;
    this._impulseEase = easeOut;
  }

  /** Hold (or release) the current style's guard stance. */
  setGuard(on, pose = null) {
    this.animator.setGuard(on, pose);
  }

  /** Fire a one-shot combat strike envelope (see CharacterAnimator.strike). */
  strike(kind = 'jab', dur = 0.42) {
    this.animator.strike(kind, dur);
  }

  snapshot() {
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const c = this.animator.c;
    return {
      pos: [this.position.x, this.position.y, this.position.z],
      renderY: this.renderY,
      vel: [this.velocity.x, this.velocity.y, this.velocity.z],
      speed: this.speed,
      grounded: this.grounded,
      // peak height this frame's substeps reached — the jump's honest record
      apex: this.apexY,
      crouch: this.crouching,
      facing: this.facing,
      state: this.animator.state,
      active: this.active,
      // live combat posture — smoke reads this instead of inferring swings
      combat: {
        speedScale: Math.round(this.speedScale * 100) / 100,
        guard: this.animator.guard > 0.5,
        guardPose: this.animator.guardPose,
        strike: this.animator.strikeKind,
        locked: this.faceTarget != null,
        impulse: this.impulseT > 0,
      },
      // simulated seconds so far — Δsim ÷ Δwall is the pacing ratio smoke watches
      sim: this.simSeconds,
      // live gait channels — proof the rig is actually articulating
      gait: {
        knees: [r3(c.kneeL), r3(c.kneeR)],
        elbows: [r3(c.elbowL), r3(c.elbowR)],
        torso: [r3(c.torsoX), r3(c.torsoY)],
        turn: r3(this.animator.turn),
      },
    };
  }

  dispose() {
    this.rig.dispose();
    this.rig.group.removeFromParent();
  }
}
