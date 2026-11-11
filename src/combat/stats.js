/**
 * Derived combat statistics — MEMORY THIEF v2 (docs/GAME-DESIGN.md §12).
 *
 * Pure functions: style + weapon + knowledge + stolen powers → the numbers
 * the attack FSM, the enemy brain and the HUD consume. No DOM, no Three.js.
 *
 * Anti-uniformity contract: every style changes *how* the numbers behave
 * (combo length, rhythm, reach, posture, guard cut, parry window) — never
 * just raw damage — so stealing a new style always changes the fight.
 */

import { BASIC_STYLE_ID, STYLE_BY_ID } from './styles.js';
import { WEAPON_BY_ID } from '../weapons/weapons.js';
import { KNOWLEDGE_CAPS } from '../powers/powers.js';

/** damageTier → damage multiplier (styles.js damageTier strings). */
export const TIER_MUL = {
  low: 0.9,
  med: 1.0,
  high: 1.15,
  'very high': 1.35,
};

export function styleOf(state) {
  return STYLE_BY_ID[state.styleId] ?? STYLE_BY_ID[BASIC_STYLE_ID];
}

export function weaponOf(state) {
  return WEAPON_BY_ID[state.weaponId] ?? WEAPON_BY_ID['wrapped-fists'];
}

/**
 * Passive flags granted by stolen powers that change combat math directly.
 * Powers whose effects live in other systems (stealth, traversal) are still
 * owned and displayed, but deliberately absent here — never claim a bonus
 * the fight does not actually give.
 */
export function powerFlags(state) {
  const has = (id) => state.powers.has(id);
  return {
    pressurePoints: has('pressure-points'), // +3 posture per strike
    perfectParry: has('perfect-parry'), // +0.06 s parry window
    wardStance: has('ward-stance'), // held block eats the first combo hit
    longGuard: has('long-guard'), // perfect block returns stamina
    impactAbsorb: has('impact-absorb'), // first heavy hit each fight −50% stagger
    heatGuard: has('heat-guard'), // first magic hit each fight absorbed
    rimeWard: has('rime-ward'), // ice shell: one hit per 12 s
    pairedCover: has('paired-cover'), // standing still absorbs one stagger
    unbroken: has('unbroken-counter'), // no stagger below 25% hp
    heatHaze: has('heat-haze'), // 20% enemy miss chance
    bodyCocoon: has('body-cocoon'), // crouched −30% damage
    guardShatter: has('guard-shatter'), // heavies break blocks outright
    twinDraws: has('twin-draws'), // combo finisher hits a second target
    poisonFlurry: has('poison-flurry'), // full string coats the last hit
  };
}

/**
 * The full stat block for the player's current loadout.
 * @param {object} state PlayerCombatState
 */
export function deriveStats(state) {
  const style = styleOf(state);
  const weapon = weaponOf(state);
  const flags = powerFlags(state);

  const knowledge = state.knowledge ?? { hp: 0, atk: 0, def: 0 };
  const maxHp = Math.min(KNOWLEDGE_CAPS.hp, 100 + Math.max(0, knowledge.hp | 0));
  const atk = Math.max(0, knowledge.atk | 0);
  const def = Math.max(0, knowledge.def | 0);
  const tier = TIER_MUL[style.damageTier] ?? 1;

  // weapon contributes ~55% of a hit; the rest comes from knowledge + style
  const lightDamage = Math.max(1, Math.round((6 + weapon.damage * 0.55 + atk) * tier));
  const heavyDamage = Math.max(2, Math.round(lightDamage * 1.9));
  const specialDamage = Math.max(3, Math.round(lightDamage * 2.4));

  return {
    maxHp,
    maxStamina: 100,
    maxPosture: 100,
    atk,
    def,
    // incoming damage multiplier after armour (never below 0.45)
    damageTakenMul: 1 - Math.min(0.55, def / (def + 70)),
    lightDamage,
    heavyDamage,
    specialDamage,
    posturePerHit: (flags.pressurePoints ? 3 : 0) + Math.round(style.postureDamage * 0.6),
    staminaPerHit: style.staminaPerHit,
    staminaRegen: 24, // per second, out of block
    blockDamageCut: style.blockDamageCut,
    parryWindow: style.parryWindow + (flags.perfectParry ? 0.06 : 0),
    reach: style.reach + Math.min(1.4, weapon.range * 0.35),
    comboLength: style.comboLength,
    // seconds between light attacks — style rhythm × weapon speed
    swingInterval: Math.max(0.26, Math.min(1.1, (2.4 / style.rhythm) * (2.2 / weapon.attackSpeed))),
    dodgeCost: 22,
    heavyCost: 18,
    specialCost: style.special?.cost ?? 24,
    moveMul: 1,
    style,
    weapon,
    flags,
  };
}

/** Enemy-side derived stats are computed in enemies/templates.js (tierStats). */
export function enemyDamageTakenMul(defense = 0) {
  return 1 - Math.min(0.5, defense / (defense + 60));
}
