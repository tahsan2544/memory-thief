/**
 * Story beats — MEMORY THIEF v2 (docs/TECH-PLAN.md Phase 12).
 *
 * Pure data + one pure function: every steal hands back a five-facet memory
 * choreography (background → organization → weakness → next lead → hidden
 * world fact), every rung of the ladder carries a beat type so no two
 * encounters play the same (duel, siege, trap, ambush, mirror), and the four
 * acts of the climb each keep one world fact locked until their rungs fall.
 *
 * DOM-free, Three-free — the card (ui/storyCard.js) and the K/T screens
 * render it; scripts/check-data.mjs proves coverage of all 34 groups.
 */

import { GROUPS } from '../enemies/groups.js';

/** The five encounter shapes — no two adjacent rungs share one. */
export const BEAT_TYPES = ['duel', 'siege', 'trap', 'ambush', 'mirror'];

export const BEAT_LABEL = {
  duel: 'DUEL',
  siege: 'SIEGE',
  trap: 'TRAP',
  ambush: 'AMBUSH',
  mirror: 'MIRROR',
};

/**
 * rank → beat type. The mirror beats sit on the two crews that fight like
 * the player (28 echoes your stolen powers, 33 mirrors every style).
 * Contract: all five types used, and no two adjacent rungs share one.
 */
const TYPE_BY_RANK = {
  1: 'ambush', 2: 'trap', 3: 'duel', 4: 'ambush', 5: 'duel',
  6: 'trap', 7: 'duel', 8: 'siege', 9: 'trap',
  10: 'siege', 11: 'ambush', 12: 'duel', 13: 'ambush', 14: 'trap',
  15: 'siege', 16: 'ambush', 17: 'trap', 18: 'ambush', 19: 'trap', 20: 'siege',
  21: 'duel', 22: 'ambush', 23: 'trap', 24: 'ambush', 25: 'trap',
  26: 'ambush', 27: 'siege', 28: 'mirror', 29: 'trap',
  30: 'duel', 31: 'siege', 32: 'duel', 33: 'mirror', 34: 'siege',
};

/** The four acts of the ladder (ranks mirror groups.js act sections). */
export const ACTS = [
  { n: 1, title: 'The Unschooled', from: 1, to: 9 },
  { n: 2, title: 'The Ladder', from: 10, to: 20 },
  { n: 3, title: 'The Elites', from: 21, to: 29 },
  { n: 4, title: 'The Finale', from: 30, to: 34 },
];

/** One hidden world fact per act — locked until every rung of the act falls. */
const ACT_FACT = {
  1: 'The Underarchive beneath the tower is where the city hides what it cannot delete — every trade below the ninth ran through its vents.',
  2: 'The ranking is not a sport, it is the Overlord’s accounting: every fight you win is a debt entered in his ledger.',
  3: 'The elites were never one organization — they are the surviving crews of failed rebellions, kept alive as proof that rebellion fails.',
  4: 'The Overlord was the first Memory Thief. He built the ladder so that the last fight would always come to him.',
};

/** How each fighting school is beaten — the weakness facet (archetypes). */
const WEAKNESS = {
  brawler: 'They swing wide and never guard the flank — sidestep the haymaker and answer from the side.',
  counter: 'They read the first move and punish it — feint, make them commit early, then strike the recovery.',
  skirmisher: 'They live on distance — never let them reset; close the gap the moment they leap back.',
  brute: 'They trade through pain — break their posture with heavies and let the guard break do the work.',
  assassin: 'They vanish when watched — keep them in front of you and deny the flank they circle for.',
  sorcerer: 'They cast from range and hate interruption — get inside the bolt and never give them space.',
  commander: 'They hold the crew together — cut the leader down first and the squad scatters.',
  boss: 'Three faces, one collector — weather each phase, break his posture, and take back what he took.',
};

/**
 * The memory scene per rung — one authored line each, the facet that makes
 * a steal read like a remembered moment instead of a loot drop.
 */
const BEAT_BY_ID = {
  'street-pickpockets': 'Four kids, one alley, and the first memory anyone ever tore out of you — a glove gone before you noticed the hand.',
  'alley-fighters': 'They boxed you in where the map goes thin and made an audience of the wall.',
  'iron-fists': 'Straight hands, straight posture — they met you in the middle of the road and did not move.',
  'shadow-kickers': 'They waited where the lamps were dead and kicked before you could turn.',
  'blade-runners': 'Steel first, names never — they ran you down the glassline before you learned their faces.',
  'venom-crew': 'They poisoned the well and watched you drink. Patience is their whole school.',
  'iron-staff': 'One staff, four hands, and a temple that answers to no district.',
  'heavy-crushers': 'They do not chase — they hold the door, and the door is a wall of shoulders.',
  'silent-guards': 'They were already behind you. That was the lesson.',
  'flame-order': 'Fire as doctrine — they burned the record of their first theft so only they could read it.',
  'chainbreakers': 'They broke their chains in the floodworks and decided the city owed them.',
  'crane-temple': 'Monks who kept their oath when the temple burned — the last honest guard left standing.',
  'twin-talons': 'Two of them, one rhythm — you cannot learn only half of a pair.',
  'knees-of-northgate': 'They dropped you at the gate with a single catch, and the crowd learned your name that night.',
  'gilded-axes': 'Paid steel in the market square — the axes swing for whoever holds the purse.',
  'market-reapers': 'They reap what the market owes, and they count the loss in teeth.',
  'ropesisters': 'Rope, anchor, and a market that never sees them land.',
  'ghostline-couriers': 'They deliver everything but witnesses — the courier route is a list of disappearances.',
  'pale-staff-choir': 'They sing the chapel spine in a key that stops the rain.',
  'smelter-hammers': 'The furnace never sleeps, and neither does the shift that feeds it.',
  'verdant-bearstyle': "A bear's patience under green leaves — they let you swing first, once.",
  'fencers-guild': 'Duelists of the mirror district — every riposte a copy of your own.',
  'the-undershine': 'They live under the light they stole and spend it like coin.',
  'ashknives': 'What is left of a fire with a grip on it.',
  'the-molded-ones': 'Poured, cooled and shaped into one mass — the light hits do not move them.',
  'rodbearers': 'They fight the air too — staff and sky, and no ground you can hold.',
  'hollow-crown-guard': "The Overlord's own line — armor with a hole where the oath should be.",
  'echoes-in-grey': 'They mirror the last two powers you stole — the fight is a rehearsal of you.',
  'seven-sirens': 'Seven voices, one command chain — the song is an order you cannot refuse.',
  'kael-the-unmoved': 'Kael has not stepped back in twenty years. The road wore out instead.',
  'sister-metera': 'She carries the flame that founded the Order, and she judges with it.',
  'warden-crucible': 'The last warden of the furnace that poured every weapon you hold.',
  'grandmaster-yuen': 'Yuen mirrors every style you know — your stolen school sits in his hands, complete.',
  'the-overlord': 'He keeps what he takes. Every style, every name, every memory on this list is his collection.',
};

export function typeOf(group) {
  return TYPE_BY_RANK[group?.rank] ?? 'duel';
}

export function actOf(rank) {
  return ACTS.find((a) => rank >= a.from && rank <= a.to) ?? ACTS[ACTS.length - 1];
}

/** Rungs that belong to an act + how many of them the player has cleared. */
export function actProgress(act, defeated) {
  const set = defeated instanceof Set ? defeated : new Set(defeated ?? []);
  const rungs = GROUPS.filter((g) => g.rank >= act.from && g.rank <= act.to);
  const done = rungs.filter((g) => set.has(g.id)).length;
  return { done, total: rungs.length, cleared: done >= rungs.length };
}

/**
 * The five-facet choreography for one steal.
 * @param {object} group a groups.js entry
 * @param {Set<string>|string[]} defeated the player's cleared ids
 * @returns {{id:string, rank:number, name:string, type:string,
 *   act:{n:number,title:string,fact:string,factLocked:boolean,done:number,total:number},
 *   lead:string, facets:Array<{k:string,label:string,text:string}>}}
 */
export function storyBeatsFor(group, defeated) {
  const act = actOf(group.rank);
  const prog = actProgress(act, defeated);
  const next = GROUPS.find((g) => g.rank === group.rank + 1) ?? null;
  const memberCount = group.members?.max ?? group.members?.min ?? 1;
  const leader = group.members?.leader;
  const type = typeOf(group);

  const facets = [
    { k: 'background', label: 'THE MEMORY', text: BEAT_BY_ID[group.id] ?? `${group.name} — ${group.identity}.` },
    {
      k: 'organization',
      label: 'HOW THEY STAND',
      text: `Hold ${group.territory} · ${group.identity} · crew of ${memberCount}` +
        `${leader ? ` led by ${leader}` : ''}.`,
    },
    { k: 'weakness', label: 'HOW IT BREAKS', text: WEAKNESS[group.behaviour] ?? WEAKNESS.brawler },
    {
      k: 'next',
      label: 'THE NEXT LEAD',
      text: next
        ? `The memory points at ${next.name} — ${group.memoryLead}.`
        : `The memory ends here — ${group.memoryLead}. The ladder has no next rung.`,
    },
    {
      k: 'fact',
      label: 'WHAT THE CITY HIDES',
      text: prog.cleared
        ? ACT_FACT[act.n]
        : `Locked — clear Act ${act.n} · ${act.title} (${prog.done}/${prog.total} rungs) to read it.`,
    },
  ];

  return {
    id: group.id,
    rank: group.rank,
    name: group.name,
    type,
    act: { n: act.n, title: act.title, fact: ACT_FACT[act.n], factLocked: !prog.cleared, done: prog.done, total: prog.total },
    lead: facets[3].text,
    facets,
  };
}

/** All authored beat ids — scripts/check-data.mjs proves 34/34 coverage. */
export function beatIds() {
  return Object.keys(BEAT_BY_ID);
}

export function beatCount() {
  return Object.keys(BEAT_BY_ID).length;
}
