/**
 * Enemy behaviour archetypes & stat tiers — MEMORY THIEF v2
 * (docs/GAME-DESIGN.md §6, docs/TECH-PLAN.md §4).
 *
 * Pure data + pure functions. Phase 4 (`enemyFight.js`) applies these onto
 * the NpcAgent combat layer; Phase 5 (`spawner.js`) uses tierStats() to seat
 * member stats by rank.
 *
 * Design contract: archetypes differ in MORE than numbers — each carries a
 * combat logic signature (blockChance/dodgeChance/reaction/aggro shape), and
 * every GROUP adds one unique `specialHook` on top (see groups.js), so late
 * fights change patterns, not just health.
 */

export const BEHAVIOURS = {
  brawler: {
    arch: 'brawler',
    healthMul: 1.0,
    damageMul: 1.0,
    attackSpeedMul: 1.05,
    moveSpeedMul: 1.0,
    blockChance: 0.1,
    dodgeChance: 0.15,
    reactionMs: 320,
    postureMul: 1.0,
    aggro: 0.85, // rushes early and often
    detectionMul: 1.0,
    signature: 'Rush in, abuse light strings, retreat only when exhausted.',
  },
  counter: {
    arch: 'counter',
    healthMul: 0.95,
    damageMul: 1.1,
    attackSpeedMul: 0.9,
    moveSpeedMul: 0.95,
    blockChance: 0.45,
    dodgeChance: 0.2,
    reactionMs: 260,
    postureMul: 1.2,
    aggro: 0.5,
    detectionMul: 1.1,
    signature: 'Holds guard, punishes player recovery, opens rarely but hard.',
  },
  skirmisher: {
    arch: 'skirmisher',
    healthMul: 0.85,
    damageMul: 1.0,
    attackSpeedMul: 1.1,
    moveSpeedMul: 1.15,
    blockChance: 0.1,
    dodgeChance: 0.4,
    reactionMs: 300,
    postureMul: 0.8,
    aggro: 0.55,
    detectionMul: 1.0,
    signature: 'Hit-and-run arcs, dodges often, baits heavies to punish.',
  },
  sorcerer: {
    arch: 'sorcerer',
    healthMul: 0.8,
    damageMul: 1.15,
    attackSpeedMul: 0.75,
    moveSpeedMul: 0.9,
    blockChance: 0.05,
    dodgeChance: 0.25,
    reactionMs: 280,
    postureMul: 0.7,
    aggro: 0.45,
    detectionMul: 1.2,
    signature: 'Keeps 8–14 m, channels spells, relocates when approached.',
  },
  brute: {
    arch: 'brute',
    healthMul: 1.4,
    damageMul: 1.3,
    attackSpeedMul: 0.65,
    moveSpeedMul: 0.8,
    blockChance: 0.25,
    dodgeChance: 0.03,
    reactionMs: 450,
    postureMul: 1.8,
    aggro: 1.0,
    detectionMul: 0.9,
    signature: 'Slow, posture-heavy, area smashes; shrugs off light stagger.',
  },
  assassin: {
    arch: 'assassin',
    healthMul: 0.8,
    damageMul: 1.25,
    attackSpeedMul: 1.2,
    moveSpeedMul: 1.2,
    blockChance: 0.1,
    dodgeChance: 0.35,
    reactionMs: 240,
    postureMul: 0.7,
    aggro: 0.65,
    detectionMul: 1.0,
    signature: 'Prefers stealth approaches, punishes the player’s blind side.',
  },
  commander: {
    arch: 'commander',
    healthMul: 1.1,
    damageMul: 1.0,
    attackSpeedMul: 0.95,
    moveSpeedMul: 1.0,
    blockChance: 0.3,
    dodgeChance: 0.2,
    reactionMs: 280,
    postureMul: 1.1,
    aggro: 0.6,
    detectionMul: 1.3,
    signature: 'Buffs allies (+speed/+defence), orders focused attacks, joins late.',
  },
  boss: {
    arch: 'boss',
    healthMul: 3.2, // ×bossTier(2.4) ≈ 19k — sized so all three phases land
    damageMul: 1.5,
    attackSpeedMul: 0.6,
    moveSpeedMul: 0.75,
    blockChance: 0.2,
    dodgeChance: 0.05,
    reactionMs: 500,
    postureMul: 3.0,
    aggro: 1.0,
    detectionMul: 1.0,
    signature: 'Phase FSM with telegraphed heavy attacks and recovery windows.',
  },
};

/**
 * Expected group stats by rank (docs/GAME-DESIGN.md §12 balance rule:
 * serial growth, never inflationary). Tuned in Phase 5 against playtests.
 */
export function tierStats(rank) {
  const r = Math.max(1, Math.min(34, rank | 0));
  const health = Math.round(48 + r * 24 + r * r * 1.4);
  const damage = Math.round(6 + r * 1.35 + r * r * 0.06);
  return {
    health,
    damage,
    // Seconds per attack — shrinks with rank (1.9 s → 1.0 s at the top).
    attackInterval: 1.9 - Math.min(0.9, r * 0.028),
    moveSpeed: Math.min(6.4, 3.1 + r * 0.075),
    attackRange: 1.6 + Math.min(2.2, r * 0.07),
    detectionRange: Math.min(24, 11 + r * 0.45),
  };
}

/** Boss tier: after Warden Crucible (rank 32) enemies jump a size bracket. */
export function bossTierStats(rank) {
  const base = tierStats(rank);
  return {
    ...base,
    health: Math.round(base.health * 2.4),
    damage: Math.round(base.damage * 1.6),
    postureMul: (base.postureMul || 1) * 2,
  };
}

/** Merge a group's behaviour archetype into one agent config snapshot. */
export function behaviourFor(group) {
  const b = BEHAVIOURS[group.behaviour] || BEHAVIOURS.brawler;
  return { ...b, specialHook: group.specialHook || null };
}
