/**
 * Ranking ladder helpers — MEMORY THIEF v2 (docs/GAME-DESIGN.md §7, §15).
 *
 * Pure functions over src/enemies/groups.js. Phase 9 (HUD rank, next target)
 * and Phase 10 (map pins) consume this module.
 */

import { GROUPS, MAX_RANK } from './groups.js';

/**
 * Player rank titles, by number of territories cleared. Tiers are checked
 * top-down; between bands the player holds the lower title.
 */
const RANK_BANDS = [
  [0, 'NOBODY'],
  [1, 'GLOVED'],
  [3, 'SCRAPPER'],
  [5, 'ALLEY-BRED'],
  [7, 'KNUCKLE-FORGED'],
  [9, 'TEMPLE-DABBLED'],
  [12, 'BLADE-SEASONED'],
  [15, 'SPARK-TROD'],
  [18, 'GHOST-CERTIFIED'],
  [21, 'FOUNDRY-STEEL'],
  [24, 'ELITE-KNOWN'],
  [28, 'CROWN-BANE'],
  [31, 'LEGEND-CALLED'],
  [33, 'THIEF OF EIDOLON'],
  [34, 'OVERLORD-ESTEEMED'], // only with the starting defeat of rank 34 itself
];

export function rankTitle(clearedCount) {
  let title = RANK_BANDS[0][1];
  for (const [count, name] of RANK_BANDS) {
    if (clearedCount >= count) title = name;
  }
  return title;
}

/** Groups in strict rank order (rank 1 → 34). */
export function groupsInRankOrder() {
  return [...GROUPS].sort((a, b) => a.rank - b.rank);
}

/**
 * The player's current target: the lowest-rank group not yet cleared.
 * GROUPS is authored in ascending rank order, so the first uncleared entry
 * is both the next story beat and the next assignable fight.
 * Solo legends (30–33) open only after the groups beneath them fall; the
 * ordering in groups.js already enforces that gate.
 * Returns null when the ladder is finished.
 */
export function nextTarget(clearedSet) {
  const cleared = clearedSet instanceof Set ? clearedSet : new Set(clearedSet || []);
  for (const g of GROUPS) {
    if (!cleared.has(g.id)) return g;
  }
  return null;
}

/** Difficulty → map/HUD colour ramp (docs/GAME-DESIGN.md §11). */
export const DIFFICULTY_COLORS = {
  1: 0x6f9fd8, // blue — weak
  2: 0x59a06a, // green
  3: 0xd8a35f, // amber
  4: 0xd8673f, // strong orange-red
  5: 0xb13541, // crimson — elite / boss
};

export function difficultyColor(group) {
  return DIFFICULTY_COLORS[group.difficulty] || DIFFICULTY_COLORS[1];
}

/** Player world rank = highest cleared group's rank (0 at start). */
export function playerRank(clearedSet) {
  const cleared = clearedSet instanceof Set ? clearedSet : new Set(clearedSet || []);
  let rank = 0;
  for (const g of GROUPS) if (cleared.has(g.id)) rank = Math.max(rank, g.rank);
  return rank; // capped by MAX_RANK (34)
}

export { GROUPS, MAX_RANK };
