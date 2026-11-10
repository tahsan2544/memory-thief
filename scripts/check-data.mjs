/**
 * Data integrity checks for the MEMORY THIEF v2 concept foundation
 * (docs/TECH-PLAN.md Phase 1). Pure Node — no browser, no build step.
 *
 *   node scripts/check-data.mjs
 *
 * Fails with a non-zero exit code when any contract of docs/GAME-DESIGN.md
 * is violated, listing every failure with a reason (no silent truncation).
 */

import { STYLES, STYLE_BY_ID, BASIC_STYLE_ID } from '../src/combat/styles.js';
import {
  WEAPONS,
  WEAPON_BY_ID,
  WEAPON_CATEGORIES,
  CATEGORY_LIST,
  HOTBAR_SLOTS,
} from '../src/weapons/weapons.js';
import { POWERS, POWER_BY_ID, CHANNELS, RARITIES } from '../src/powers/powers.js';
import {
  GROUPS,
  GROUP_BY_ID,
  GROUP_COUNT,
  MAX_RANK,
  BOSS_ID,
} from '../src/enemies/groups.js';
import { BEHAVIOURS, tierStats, behaviourFor } from '../src/enemies/templates.js';
import {
  groupsInRankOrder,
  nextTarget,
  playerRank,
  rankTitle,
  difficultyColor,
} from '../src/enemies/ranking.js';

const problems = [];
function check(cond, message) {
  if (!cond) problems.push(message);
}

// ---- 1. styles ------------------------------------------------------------
check(STYLES.length >= 15, `at least 15 styles expected, found ${STYLES.length}`);
check(STYLE_BY_ID[BASIC_STYLE_ID] != null, 'basic style missing');

const styleIds = new Set(STYLES.map((s) => [s.id][0]));
check(styleIds.size === STYLES.length, 'duplicate style ids');
for (const s of STYLES) {
  for (const field of ['rhythm', 'comboLength', 'reach', 'postureDamage']) {
    check(Number.isFinite(s[field]), `style ${s.id}: ${field} must be a number`);
  }
  check(STYLE_BY_ID[s.id].clips && STYLE_BY_ID[s.id].clips.jab, `style ${s.id}: clips.jab`);
}

// Anti-uniformity contract: any two styles differ in >= 3 axes.
const axesFor = (s) => [
  s.comboLength,
  Math.round(s.rhythm * 10),
  Math.round(s.reach * 10),
  s.postureDamage,
  s.guardPose,
  s.special.kind,
];
for (let i = 0; i < STYLES.length; i++) {
  for (let j = i + 1; j < STYLES.length; j++) {
    const a = axesFor(STYLES[i]);
    const b = axesFor(STYLES[j]);
    const diff = a.filter((v, k) => v !== b[k]).length;
    check(
      diff >= 3,
      `styles ${STYLES[i].id} vs ${STYLES[j].id} differ in only ${diff} axes (< 3)`,
    );
  }
}

// ---- 2. weapons -----------------------------------------------------------
const cats = new Set(CATEGORY_LIST);
check(cats.size === CATEGORY_LIST.length, 'duplicate weapon categories');
check(cats.size === Object.keys(WEAPON_CATEGORIES).length, 'category map mismatch');
const weaponIds = new Set(WEAPONS.map((w) => w.id));
check(weaponIds.size === WEAPONS.length, 'duplicate weapon ids');
for (const w of WEAPONS) {
  check(cats.has(w.category), `weapon ${w.id}: unknown category ${w.category}`);
  check(Number.isFinite(w.damage) && w.damage > 0, `weapon ${w.id}: damage`);
  check(Number.isFinite(w.range) && w.range > 0, `weapon ${w.id}: range`);
}
check(HOTBAR_SLOTS === 9, 'hotbar is 9 slots');

// ---- 3. powers ------------------------------------------------------------
const powerIds = new Set(POWERS.map((p) => p.id));
check(powerIds.size === POWERS.length, 'duplicate power ids');
for (const p of POWERS) {
  check(CHANNELS[p.channel] != null, `power ${p.id}: unknown channel ${p.channel}`);
  check(RARITIES.includes(p.rarity), `power ${p.id}: unknown rarity ${p.rarity}`);
  check(Number.isFinite(p.hue), `power ${p.id}: hue must be numeric`);
  check(p.effect && typeof p.effect.desc === 'string', `power ${p.id}: effect desc`);
}

// ---- 4. groups ------------------------------------------------------------
check(GROUP_COUNT >= 30, `expected ≥ 30 encounters, found ${GROUP_COUNT}`);
check(GROUPS.length === MAX_RANK, 'MAX_RANK must equal roster length');

const ids = new Set(GROUPS.map((g) => g.id));
check(ids.size === GROUPS.length, 'duplicate group ids');

const ranks = GROUPS.map((g) => g.rank);
for (let i = 0; i < ranks.length; i++) {
  check(ranks[i] === i + 1, `rank ${i + 1} expected at index ${i}, found ${ranks[i]}`);
}

const VALID_DISTRICTS = new Set([
  'oldquarter',
  'glassline',
  'floodworks',
  'verdant',
  'underarchive',
  'outskirts',
]);
const VALID_BEHAVIOURS = new Set(Object.keys(BEHAVIOURS));

for (const g of GROUPS) {
  check(VALID_DISTRICTS.has(g.district), `${g.id}: unknown district ${g.district}`);
  check(VALID_BEHAVIOURS.has(g.behaviour), `${g.id}: unknown behaviour ${g.behaviour}`);
  check(cats.has(g.weapon), `${g.id}: unknown weapon category ${g.weapon}`);
  check(
    !g.style || styleIds.has(g.style),
    `${g.id}: unknown style ${g.style}`,
  );
  check(g.difficulty >= 1 && g.difficulty <= 5, `${g.id}: difficulty 1..5`);
  check(g.members.leader && g.members.leader.length > 0, `${g.id}: leader name`);
  check(g.members.min <= g.members.max, `${g.id}: member range`);
  check(Number.isFinite(g.members.min) && g.members.min >= 1, `${g.id}: member min`);
  check(typeof g.memoryLead === 'string' && g.memoryLead.length > 0, `${g.id}: memoryLead`);
  for (const pid of g.grants.powers || []) {
    check(powerIds.has(pid), `${g.id}: unknown power ${pid}`);
  }
  if (g.grants.weapon) {
    check(weaponIds.has(g.grants.weapon), `${g.id}: unknown weapon ${g.grants.weapon}`);
    check(
      WEAPON_BY_ID[g.grants.weapon].category === g.weapon,
      `${g.id}: grant weapon category mismatch`,
    );
  }
  if (g.grants.style) {
    check(
      Array.isArray(STYLE_BY_ID[g.grants.style].teachers) &&
        STYLE_BY_ID[g.grants.style].teachers.includes(g.id),
      `${g.id}: style teachers mismatch`,
    );
  }
  check(GROUP_BY_ID[g.id] === g, 'GROUP_BY_ID mapping broken');
  const b = behaviourFor(g);
  check(b.arch != null && b.signature, `${g.id}: behaviourFor() incomplete`);
}

// ---- 5. tier curves -------------------------------------------------------
check(tierStats(1).health < tierStats(34).health, 'tierStats health must increase');
check(tierStats(1).damage < tierStats(34).damage, 'tierStats damage must increase');
check(
  tierStats(33).attackInterval < tierStats(3).attackInterval,
  'warriors attack faster with rank (interval shrinks)',
);

// ---- 6. ranking helpers ---------------------------------------------------
const ordered = groupsInRankOrder();
check(ordered[0].rank === 1 && ordered[ordered.length - 1].rank === MAX_RANK, 'ranking order');
check(nextTarget(new Set())?.id === 'street-pickpockets', 'empty progression → rank 1');
check(playerRank(new Set(['street-pickpockets', 'alley-fighters'])) === 2, 'playerRank');
check(nextTarget(ordered.map((g) => g.id)) === null, 'full clear → no target');
check(rankTitle(0) === 'NOBODY', 'rank title start');
check(rankTitle(34).length > 0, 'rank title end');
check(difficultyColor(GROUP_BY_ID[BOSS_ID]) != null, 'boss difficulty colour');

// ---- report ---------------------------------------------------------------
if (problems.length) {
  console.error(`check-data: ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exitCode = 1;
} else {
  console.log(
    `check-data OK — ${STYLES.length} styles · ${WEAPONS.length} weapons · ` +
      `${POWERS.length} powers · ${GROUP_COUNT} encounters (ranks 1–${MAX_RANK})`,
  );
}

