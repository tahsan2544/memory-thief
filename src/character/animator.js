/**
 * Locomotion animator for Riven Vale.
 *
 * Procedural, code-driven keyframes — no animation clips. The rig is
 * articulated (hip / knee / shoulder / elbow pivots), and this class drives
 * every pivot toward a target pose, then smooths toward it so state changes
 * blend instead of snapping.
 *
 * Locomotion:
 *   idle  — breathing, slow glance, weight settle
 *   walk  — stride + knee bend through the swing + opposite arm swing
 *   run   — longer stride, forward lean, folded elbows, coat flare
 *   jump/fall — tucked takeoff, extended drop, coat reacting to airflow
 *
 * Everything else is additive on top, so it can never break the base pose:
 *   crouch   — hips sink, knees fold deep (crouch-walk keeps a short stride)
 *   turn     — in-place shuffle steps whenever you spin on the spot
 *   fidget   — a rotating set of idle beats (glove check, collar adjust,
 *              look behind, weight stamp) so standing still stays alive
 *   channel  — the sustained extraction pose (glove raised, head down)
 *   gesture  — one-shot named arm poses (reach / point / brace / adjust /
 *              wave) fired by interactions
 */

const TWO_PI = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** One-shot gesture table: pose deltas applied for the gesture's duration. */
const GESTURES = {
  reach: { armR: -0.95, elbowR: 0.45, torsoY: 0.14, headX: 0.06, dur: 0.9 },
  point: { armR: -1.3, elbowR: 0.06, torsoY: 0.22, headX: -0.05, dur: 1.1 },
  brace: { armR: -0.85, armL: -0.75, elbowR: 1.0, elbowL: 0.9, torsoX: -0.14, dur: 1.0 },
  adjust: { armR: -0.7, elbowR: 1.3, torsoY: -0.1, headX: 0.2, dur: 1.2 },
  wave: { armR: -1.55, elbowR: 0.15, armOutR: 0.45, torsoY: 0.1, dur: 1.4 },
};

/**
 * Combat guard stances — one per style `guardPose` (docs/GAME-DESIGN.md §4).
 * Sustained and additive, exactly like the channel pose: they sit on top of
 * locomotion and can never break it. Negative armX = raised forward.
 */
const GUARD_POSES = {
  square: { armR: -0.9, armL: -0.8, elbowR: 1.15, elbowL: 1.15, torsoY: -0.12, headX: 0.06 },
  boxer: { armR: -1.15, armL: -1.05, elbowR: 1.5, elbowL: 1.5, torsoY: -0.16, torsoX: 0.06, headX: 0.08 },
  'open-hand': { armR: -1.0, armL: -1.1, elbowR: 0.9, elbowL: 1.0, armOutR: 0.22, armOutL: 0.2, torsoY: -0.2 },
  crane: { armR: -1.25, armL: -1.2, elbowR: 0.6, elbowL: 0.6, armOutR: 0.35, armOutL: 0.33, torsoY: -0.1 },
  'side-on': { armR: -1.0, armL: -1.25, elbowR: 1.2, elbowL: 0.7, torsoY: -0.35, hipsRotY: -0.18 },
  'high-guard': { armR: -1.4, armL: -1.35, elbowR: 1.7, elbowL: 1.7, torsoX: 0.08, headX: 0.12 },
  'low-crouch': { armR: -0.7, armL: -0.65, elbowR: 1.0, elbowL: 1.0, torsoX: 0.28, headX: -0.1 },
  loose: { armR: -0.7, armL: -0.6, elbowR: 0.9, elbowL: 0.85, armOutR: 0.16, torsoY: -0.08 },
  'blade-forward': { armR: -1.2, armL: -0.5, elbowR: 0.5, elbowL: 1.3, armOutR: 0.1, torsoY: -0.26 },
  'staff-vertical': { armR: -0.95, armL: -1.05, elbowR: 0.85, elbowL: 0.8, armOutR: 0.28, armOutL: 0.24, torsoY: -0.14 },
  'bladed-low': { armR: -0.8, armL: -0.7, elbowR: 1.05, elbowL: 1.35, torsoY: -0.2, torsoX: 0.1 },
  'armed-channel': { armR: -1.1, armL: -0.85, elbowR: 1.0, elbowL: 1.2, torsoY: -0.18, headX: 0.05 },
  brace: { armR: -1.0, armL: -0.95, elbowR: 1.3, elbowL: 1.25, torsoX: -0.1, hipsY: -0.05 },
  'bladed-lean': { armR: -1.05, armL: -0.75, elbowR: 0.95, elbowL: 1.1, torsoY: -0.3, torsoX: 0.12, hipsRotY: -0.14 },
};

/**
 * One-shot strike envelopes. Each kind shapes the arms, torso and head over
 * the swing: `w` runs 0 → 1 (peak extension, ~60% through) → 0.
 * Negative armX reaches forward — the same sign convention as GESTURES.
 */
function applyStrike(t, kind, w) {
  switch (kind) {
    case 'jab':
      t.armR += -1.6 * w;
      t.elbowR += -0.9 * w;
      t.torsoY += -0.3 * w;
      t.hipsRotY += -0.12 * w;
      t.headX += 0.05 * w;
      break;
    case 'cross':
      t.armR += -1.75 * w;
      t.elbowR += -0.85 * w;
      t.torsoY += -0.5 * w;
      t.hipsRotY += -0.22 * w;
      t.torsoX += 0.1 * w;
      break;
    case 'hook':
      t.armR += -1.35 * w;
      t.elbowR += 0.9 * w;
      t.armOutR += 0.55 * w;
      t.torsoY += 0.35 * w;
      t.hipsRotY += 0.2 * w;
      break;
    case 'heavy':
      t.armR += -1.95 * w;
      t.elbowR += 1.25 - 1.6 * w;
      t.torsoX += 0.22 * w;
      t.torsoY += -0.45 * w;
      t.armOutR += 0.3 * w;
      break;
    case 'special':
      t.armR += -1.7 * w;
      t.armL += -1.1 * w;
      t.elbowR += -0.6 * w;
      t.elbowL += -0.4 * w;
      t.torsoX += 0.16 * w;
      t.torsoY += -0.35 * w;
      break;
    case 'kick':
      t.legR += -1.15 * w;
      t.kneeR += -0.85 * w;
      t.torsoX += -0.3 * w;
      t.armL += 0.5 * w;
      t.armR += 0.35 * w;
      break;
    case 'dodge':
      t.hipsY += -0.22 * w;
      t.kneeL += 1.1 * w;
      t.kneeR += 0.9 * w;
      t.legL += 0.5 * w;
      t.legR += 0.35 * w;
      t.torsoX += 0.42 * w;
      t.headX += 0.18 * w;
      t.armL += -0.6 * w;
      t.armR += -0.55 * w;
      break;
    case 'stagger':
      t.torsoX += -0.55 * w;
      t.headX += -0.35 * w;
      t.armR += 0.7 * w;
      t.armL += 0.55 * w;
      t.armOutR += 0.35 * w;
      t.armOutL += 0.3 * w;
      t.kneeL += 0.5 * w;
      t.kneeR += 0.4 * w;
      break;
    case 'block':
      t.torsoX += -0.16 * w;
      t.armR += -0.3 * w;
      t.armL += -0.28 * w;
      t.headX += -0.08 * w;
      break;
    default:
      t.armR += -1.4 * w;
      t.elbowR += -0.7 * w;
      t.torsoY += -0.2 * w;
  }
}

export class CharacterAnimator {
  constructor(rig) {
    this.rig = rig;
    this.phase = 0; // stride cycle (radians)
    this.shuffle = 0; // in-place turn cycle (radians)
    this.idleTime = 0;
    this.blend = 0; // 0 = stand, 1 = full stride
    this.air = 0; // 0 = grounded, 1 = airborne
    this.land = 0; // landing dip timer
    this.state = 'idle';
    this.turn = 0; // 0 = settled, 1 = spinning on the spot
    this._lastYaw = rig.group.rotation.y;

    // extra states (all additive on top of locomotion)
    this.crouch = 0; // 0 stand .. 1 sneak
    this.channel = 0; // 0 idle .. 1 mid-extraction (glove raised)
    this.channelOn = false; // extraction sustained-pose flag
    this.gesture = null; // one-shot arm gesture name
    this.gestureT = 0; // seconds left on the one-shot

    // combat states (also additive): a sustained guard stance and one-shot
    // strike envelopes — see GUARD_POSES / applyStrike above
    this.guard = 0; // smoothed 0..1
    this.guardOn = false;
    this.guardPose = 'square';
    this.strikeT = 0; // seconds left on the current strike
    this.strikeDur = 0.4;
    this.strikeKind = null;

    // smoothed channels
    this.c = {
      legL: 0,
      legR: 0,
      kneeL: 0.1,
      kneeR: 0.1,
      armL: 0,
      armR: 0,
      elbowL: 0.3,
      elbowR: 0.3,
      armOutL: 0.07,
      armOutR: 0.07,
      torsoX: 0,
      torsoY: 0,
      headX: 0,
      headY: 0,
      hipsY: 0,
      hipsRotY: 0,
      coatL: 0.06,
      coatR: 0.06,
    };
  }

  /**
   * @param {number} dt seconds
   * @param {{speed:number, maxSpeed:number, walkSpeed:number, grounded:boolean, vy:number, crouch?:boolean}} info
   */
  update(dt, info) {
    const { speed, maxSpeed, walkSpeed, grounded, vy } = info;

    // ---- classify ------------------------------------------------------
    if (!grounded) this.state = vy > 0.6 ? 'jump' : 'fall';
    else if (speed < 0.45) this.state = 'idle';
    else if (speed > walkSpeed * 1.3) this.state = 'run';
    else this.state = 'walk';

    const strideTarget = speed > 0.45 ? 1 : 0;
    this.blend = smooth(this.blend, strideTarget, 9, dt);
    this.air = smooth(this.air, grounded ? 0 : 1, 12, dt);
    if (this.land > 0) this.land = Math.max(0, this.land - dt);
    this.idleTime += dt;
    this.crouch = smooth(this.crouch, info.crouch ? 1 : 0, 8, dt);
    this.channel = smooth(this.channel, this.channelOn ? 1 : 0, 6, dt);
    if (this.gestureT > 0) this.gestureT = Math.max(0, this.gestureT - dt);
    this.guard = smooth(this.guard, this.guardOn ? 1 : 0, 14, dt);
    if (this.strikeT > 0) {
      this.strikeT = Math.max(0, this.strikeT - dt);
      if (this.strikeT === 0) this.strikeKind = null;
    }

    // ---- turn-on-the-spot detection ------------------------------------
    // Read off the rig's own yaw: when the body spins while the feet stay
    // put, the character shuffles instead of statue-pivoting.
    const yaw = this.rig.group.rotation.y;
    let dYaw = yaw - this._lastYaw;
    while (dYaw > Math.PI) dYaw -= TWO_PI;
    while (dYaw < -Math.PI) dYaw += TWO_PI;
    this._lastYaw = yaw;
    const yawRate = dt > 1e-4 ? dYaw / dt : 0;
    const turning = grounded && speed < 1.0 && Math.abs(yawRate) > 1.3;
    this.turn = smooth(this.turn, turning ? 1 : 0, 8, dt);
    if (turning) this.shuffle = (this.shuffle + dt * (3.4 + Math.min(6, Math.abs(yawRate)))) % TWO_PI;

    const runK = clamp((speed - walkSpeed) / Math.max(0.5, maxSpeed - walkSpeed), 0, 1);

    // ---- stride phase --------------------------------------------------
    if (speed > 0.45) {
      const stride = 1.35 + 0.75 * runK; // metres per full cycle
      this.phase = (this.phase + (speed / stride) * dt * TWO_PI) % TWO_PI;
    }
    const phaseR = (this.phase + Math.PI) % TWO_PI;
    const swing = Math.sin(this.phase) * this.blend;
    const bob = Math.abs(Math.sin(this.phase * 2)) * this.blend;

    // knee bend shape: near-straight through stance, folded at mid-swing
    const bendL = Math.sin(clamp((this.phase - Math.PI) / Math.PI, 0, 1) * Math.PI);
    const bendR = Math.sin(clamp((phaseR - Math.PI) / Math.PI, 0, 1) * Math.PI);

    // ---- targets -------------------------------------------------------
    const airT = this.air;
    const legAmp = 0.5 + 0.34 * runK;
    const armAmp = 0.42 + 0.3 * runK;

    // reused across frames — every key below is written before applyPose, so
    // the object never carries a stale value (and never churns the GC)
    const t = this._targets || (this._targets = {});
    // legs: thigh stride, overridden by the airborne pose
    t.legL = swing * legAmp + airT * (vy > 0 ? 0.45 : -0.28);
    t.legR = -swing * legAmp + airT * (vy > 0 ? 0.2 : -0.5);
    // knees: fold through the swing, tuck on takeoff, reach for the ground
    const kneeFold = 1.15 * this.blend;
    t.kneeL = 0.1 + bendL * kneeFold + airT * (vy > 0 ? 1.15 - bendL * 0.6 : 0.3 + bendL * 0.5);
    t.kneeR = 0.1 + bendR * kneeFold + airT * (vy > 0 ? 0.9 - bendR * 0.5 : 0.55 + bendR * 0.4);
    // arms counter-swing; airborne arms come up/out
    t.armL = -swing * armAmp + airT * (vy > 0 ? -0.55 : 0.3);
    t.armR = swing * armAmp + airT * (vy > 0 ? -0.4 : 0.35);
    t.armOutL = 0.07 + airT * 0.22;
    t.armOutR = 0.07 + airT * 0.22;
    // elbows: rest bend, folded hard at a sprint, pumping with the stride
    const elbowBase = 0.3 + 0.55 * runK + airT * 0.35;
    t.elbowL = elbowBase + Math.max(0, Math.sin(this.phase)) * 0.3 * this.blend;
    t.elbowR = elbowBase + Math.max(0, Math.sin(phaseR)) * 0.3 * this.blend;
    // torso: forward lean with speed, upright in the air
    t.torsoX = this.blend * (0.05 + 0.2 * runK) + airT * (vy > 0 ? 0.14 : -0.05);
    t.torsoY = -swing * 0.07 * this.blend;
    // pelvis counter-rotates against the chest (real gait, not a board)
    t.hipsRotY = swing * 0.09 * this.blend;
    // head: counter-lean, level gaze, plus an idle glance when standing
    const glance = Math.sin(this.idleTime * 0.27) * 0.38 * (1 - this.blend);
    t.headX = -t.torsoX * 0.55 + Math.sin(this.idleTime * 1.7) * 0.014 * (1 - this.blend);
    t.headY = glance - t.torsoY * 0.55;
    // hips: bob on the stride, dip on landing
    const landDip = this.land > 0 ? (this.land / 0.16) * 0.09 : 0;
    t.hipsY = bob * 0.035 - this.blend * 0.012 - landDip;
    // coat: swings back with speed, flares with airflow
    const flare = grounded ? 0 : clamp(Math.max(0, -vy) * 0.045, 0, 0.7);
    t.coatL = 0.06 + this.blend * (0.18 + 0.5 * runK) + flare + airT * 0.1;
    t.coatR = 0.06 + this.blend * (0.18 + 0.5 * runK) + flare + airT * 0.1;

    // ---- extra states, applied additively -------------------------------
    // sneak / crouch: sink the hips, fold the knees deep, hunch the torso
    const cr = this.crouch;
    if (cr > 0.001) {
      t.hipsY -= cr * 0.26;
      t.legL += cr * 0.42;
      t.legR += cr * 0.42;
      t.kneeL += cr * 1.25;
      t.kneeR += cr * 1.25;
      t.torsoX += cr * 0.34;
      t.headX += cr * 0.2;
      t.elbowL += cr * 0.35;
      t.elbowR += cr * 0.35;
      t.coatL += cr * 0.22;
      t.coatR += cr * 0.22;
    }

    // landing: knees absorb, hips dip, arms drop
    if (this.land > 0) {
      const lk = this.land / 0.16;
      t.kneeL += lk * 0.85;
      t.kneeR += lk * 0.85;
      t.torsoX += lk * 0.22;
    }

    // in-place shuffle when spinning on the spot
    if (this.turn > 0.001) {
      const tn = this.turn;
      const sh = Math.sin(this.shuffle);
      t.legL += sh * 0.2 * tn;
      t.legR += -sh * 0.2 * tn;
      t.kneeL += Math.abs(sh) * 0.5 * tn;
      t.kneeR += Math.abs(sh) * 0.5 * tn;
      t.torsoY += clamp(yawRate, -2.5, 2.5) * 0.055 * tn;
      t.headY += clamp(yawRate, -2.5, 2.5) * 0.09 * tn;
      t.hipsY += -Math.abs(sh) * 0.02 * tn;
      t.elbowL += 0.25 * tn;
      t.elbowR += 0.25 * tn;
    }

    // extraction channel: the glove hand comes up and stays there
    const ch = this.channel;
    if (ch > 0.001) {
      t.armL = -1.15 * ch;
      t.elbowL = 0.8 * ch + t.elbowL * (1 - ch);
      t.armOutL = 0.1 + 0.2 * ch;
      t.armR = t.armR * (1 - ch) - 0.35 * ch; // brace hand across the chest
      t.elbowR = t.elbowR * (1 - ch) + 1.0 * ch;
      t.headX += -0.16 * ch;
      t.headY += -0.25 * ch; // eyes drop to the emitter
      t.torsoX += -0.06 * ch;
    }

    // guard stance: the style's own guard pose, held while blocking. Applied
    // before strikes so an active swing can always override the stance.
    const gd = this.guard;
    if (gd > 0.001) {
      const g = GUARD_POSES[this.guardPose] ?? GUARD_POSES.square;
      const live = 1 - ch; // never fight the extraction pose
      t.armR += (g.armR ?? 0) * gd * live;
      t.armL += (g.armL ?? 0) * gd * live;
      t.elbowR += (g.elbowR ?? 0) * gd * live;
      t.elbowL += (g.elbowL ?? 0) * gd * live;
      if (g.armOutR !== undefined) t.armOutR += g.armOutR * gd * live;
      if (g.armOutL !== undefined) t.armOutL += g.armOutL * gd * live;
      t.torsoX += (g.torsoX ?? 0) * gd * live;
      t.torsoY += (g.torsoY ?? 0) * gd * live;
      t.headX += (g.headX ?? 0) * gd * live;
      if (g.hipsY !== undefined) t.hipsY += g.hipsY * gd * live;
      if (g.hipsRotY !== undefined) t.hipsRotY += g.hipsRotY * gd * live;
      // a guarded stance stills the idle micro-beats (handled below) and
      // damps the arm swing so the guard reads as held, not flailing
      if (this.blend > 0.05) {
        t.armR *= 1 - 0.55 * gd * live;
        t.armL *= 1 - 0.55 * gd * live;
      }
    }

    // one-shot strike envelope (jab / cross / hook / heavy / special / dodge /
    // stagger …) — a bell curve over the swing so wind-up, snap and recovery
    // all happen inside one call
    if (this.strikeT > 0 && this.strikeKind && ch < 0.3) {
      const p = 1 - this.strikeT / this.strikeDur; // 0..1 through the swing
      let w;
      if (p < 0.35) w = -(p / 0.35) * 0.45; // wind-up: pull back
      else if (p < 0.62) w = -0.45 + 1.45 * ((p - 0.35) / 0.27); // snap: 0 → 1
      else w = 1 - (p - 0.62) / 0.38; // recovery: 1 → 0
      applyStrike(t, this.strikeKind, w * (1 - ch));
    }

    // one-shot gestures (talking / inspecting / starting an action)
    // suppressed while fighting: a stance or a swing owns the arms first
    if (this.gestureT > 0 && GESTURES[this.gesture] && this.strikeT === 0 && gd < 0.5) {
      const g = GESTURES[this.gesture];
      const gk = Math.sin(clamp(this.gestureT / g.dur, 0, 1) * Math.PI);
      const live = 1 - ch; // never fight the extraction pose
      t.armR += (g.armR ?? 0) * gk * live;
      if (g.armL !== undefined) t.armL += g.armL * gk * live;
      t.elbowR += (g.elbowR ?? 0) * gk * live;
      if (g.elbowL !== undefined) t.elbowL += g.elbowL * gk * live;
      if (g.armOutR !== undefined) t.armOutR += g.armOutR * gk * live;
      t.torsoY += (g.torsoY ?? 0) * gk * live;
      t.torsoX += (g.torsoX ?? 0) * gk * live;
      t.headX += (g.headX ?? 0) * gk * live;
      if (this.gesture === 'wave') t.armR += Math.sin(this.gestureT * 11) * 0.28 * gk * live;
    }

    // idle micro-life: a rotating set of beats so standing still stays alive
    const idleK = 1 - this.blend;
    if (idleK > 0.01 && ch < 0.2 && airT < 0.05 && gd < 0.3) {
      const shift = Math.sin(this.idleTime * 0.13);
      t.torsoY += shift * 0.05 * idleK;
      t.hipsY += -Math.abs(shift) * 0.012 * idleK;

      const beat = this.idleTime % 13.4; // 0..13.4 s cycle of six beats
      const window = (a, len) => clamp((beat - a) / len, 0, 1);
      if (beat < 1.4) {
        // glance down at the extraction glove
        const k = Math.sin(window(0, 1.4) * Math.PI) * idleK;
        t.armL = -0.5 * k;
        t.elbowL = 0.6 * k;
        t.headX += 0.25 * k;
      } else if (beat >= 2.6 && beat < 4.2) {
        // adjust the collar / recorder strap with the right hand
        const k = Math.sin(window(2.6, 1.6) * Math.PI) * idleK;
        t.armR += -0.62 * k;
        t.elbowR += 1.25 * k;
        t.torsoY += -0.08 * k;
        t.headX += 0.16 * k;
      } else if (beat >= 5.2 && beat < 7.6) {
        // check behind: a proper over-the-shoulder look
        const k = Math.sin(window(5.2, 2.4) * Math.PI) * idleK;
        t.headY += 0.95 * k;
        t.torsoY += 0.22 * k;
        t.armOutL += 0.03 * k;
      } else if (beat >= 8.2 && beat < 9.6) {
        // settle the weight: a small stamp through the knees
        const k = Math.sin(window(8.2, 1.3) * Math.PI) * idleK;
        t.kneeL += 0.22 * k;
        t.kneeR += 0.12 * k;
        t.hipsY += -0.02 * k;
        t.torsoX += 0.03 * k;
      } else if (beat >= 10.1 && beat < 11.5) {
        // roll the shoulders back — one slow circuit, hands coming up
        const k = Math.sin(window(10.1, 1.4) * Math.PI) * idleK;
        t.torsoY += Math.sin(this.idleTime * 4.4) * 0.05 * k;
        t.torsoX += -0.03 * k;
        t.armOutL += 0.05 * k;
        t.armOutR += 0.05 * k;
        t.armL += -0.12 * k;
        t.armR += -0.12 * k;
        t.headX += 0.1 * k;
      } else if (beat >= 11.9) {
        // deep breath + neck roll: look down, sweep up and around
        const w = window(11.9, 1.5);
        const k = Math.sin(w * Math.PI) * idleK;
        t.headY += Math.sin(w * Math.PI * 2) * 0.6 * k;
        t.headX += (w < 0.5 ? 0.28 : -0.12) * k;
        t.torsoX += -0.025 * k;
        t.hipsY += -0.008 * k;
      }
    }

    // ---- apply with smoothing -----------------------------------------
    const p = this.rig.parts;
    const c = this.c;
    const limbRate = 17;
    const bodyRate = 11;

    c.legL = smooth(c.legL, t.legL, limbRate, dt);
    c.legR = smooth(c.legR, t.legR, limbRate, dt);
    c.kneeL = smooth(c.kneeL, t.kneeL, limbRate, dt);
    c.kneeR = smooth(c.kneeR, t.kneeR, limbRate, dt);
    c.armL = smooth(c.armL, t.armL, limbRate, dt);
    c.armR = smooth(c.armR, t.armR, limbRate, dt);
    c.elbowL = smooth(c.elbowL, t.elbowL, limbRate, dt);
    c.elbowR = smooth(c.elbowR, t.elbowR, limbRate, dt);
    c.armOutL = smooth(c.armOutL, t.armOutL, limbRate, dt);
    c.armOutR = smooth(c.armOutR, t.armOutR, limbRate, dt);
    c.torsoX = smooth(c.torsoX, t.torsoX, bodyRate, dt);
    c.torsoY = smooth(c.torsoY, t.torsoY, bodyRate, dt);
    c.headX = smooth(c.headX, t.headX, bodyRate, dt);
    c.headY = smooth(c.headY, t.headY, bodyRate * 0.6, dt);
    c.hipsY = smooth(c.hipsY, t.hipsY, 20, dt);
    c.hipsRotY = smooth(c.hipsRotY, t.hipsRotY, 12, dt);
    c.coatL = smooth(c.coatL, t.coatL, 10, dt);
    c.coatR = smooth(c.coatR, t.coatR, 10, dt);

    p.legL.rotation.x = c.legL;
    p.legR.rotation.x = c.legR;
    p.kneeL.rotation.x = c.kneeL; // knee folds backwards (positive x)
    p.kneeR.rotation.x = c.kneeR;
    p.armL.rotation.x = c.armL;
    p.armL.rotation.z = -c.armOutL;
    p.armR.rotation.x = c.armR;
    p.armR.rotation.z = c.armOutR;
    p.elbowL.rotation.x = -c.elbowL; // elbow folds forwards (negative x)
    p.elbowR.rotation.x = -c.elbowR;
    p.torso.rotation.x = c.torsoX;
    p.torso.rotation.y = c.torsoY;
    p.head.rotation.x = c.headX;
    p.head.rotation.y = c.headY;
    p.hips.position.y = c.hipsY;
    p.hips.rotation.y = c.hipsRotY;
    p.coatL.rotation.x = c.coatL;
    p.coatR.rotation.x = c.coatR;
  }

  /** Call when the controller detects a grounded landing. */
  onLand() {
    this.land = 0.16;
  }

  /**
   * Fire a one-shot arm gesture (reach / point / brace / adjust / wave).
   * Unknown names fall back to `reach`.
   */
  fireGesture(name = 'reach', dur = null) {
    const g = GESTURES[name] ?? GESTURES.reach;
    this.gesture = GESTURES[name] ? name : 'reach';
    this.gestureT = dur ?? g.dur;
  }

  /** Sustain the extraction pose (glove hand raised) while channeling. */
  setChannel(on) {
    this.channelOn = !!on;
  }

  /**
   * Hold (or release) the current style's guard stance.
   * @param {boolean} on
   * @param {string} pose style guardPose name (see GUARD_POSES)
   */
  setGuard(on, pose = null) {
    this.guardOn = !!on;
    if (pose) this.guardPose = GUARD_POSES[pose] ? pose : 'square';
  }

  /**
   * Fire a one-shot combat strike. The envelope runs wind-up → snap →
   * recovery inside `dur` seconds and layers over locomotion.
   * @param {string} kind jab|cross|hook|heavy|special|kick|dodge|stagger|block
   * @param {number} dur seconds
   */
  strike(kind = 'jab', dur = 0.42) {
    this.strikeKind = kind;
    this.strikeDur = Math.max(0.12, dur);
    this.strikeT = this.strikeDur;
  }

  /** True while a strike envelope is still running (attacks time off it). */
  get striking() {
    return this.strikeT > 0;
  }

  reset() {
    this.phase = 0;
    this.shuffle = 0;
    this.blend = 0;
    this.air = 0;
    this.land = 0;
    this.state = 'idle';
    this.turn = 0;
    this._lastYaw = this.rig.group.rotation.y;
    this.crouch = 0;
    this.channel = 0;
    this.channelOn = false;
    this.gesture = null;
    this.gestureT = 0;
    this.guard = 0;
    this.guardOn = false;
    this.guardPose = 'square';
    this.strikeT = 0;
    this.strikeDur = 0.4;
    this.strikeKind = null;
    for (const k of Object.keys(this.c)) {
      this.c[k] = k.startsWith('armOut') || k.startsWith('coat') ? 0.06 : 0;
    }
    this.c.armOutL = 0.07;
    this.c.armOutR = 0.07;
    this.c.kneeL = 0.1;
    this.c.kneeR = 0.1;
    this.c.elbowL = 0.3;
    this.c.elbowR = 0.3;
  }
}
