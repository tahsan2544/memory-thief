/**
 * Power definitions — MEMORY THIEF v2 concept (docs/GAME-DESIGN.md §3, §10).
 *
 * Pure data. `powers/steal.js` (Phase 6) grants these; `combat/stats.js`
 * (Phase 3) folds knowledge effects; `combat/combatSystem.js` executes
 * strike/grab/area/defense specials; `ui/vision.js` (Phase 11) may smooth the
 * detection boost.
 *
 * Channels = the 8 acquisition channels of the Requital:
 *   style | special | magic | weapon | defense | movement | knowledge | memory
 */

export const CHANNELS = {
  style: 'Fighting style',
  special: 'Special attack',
  magic: 'Magical ability',
  weapon: 'Weapon skill',
  defense: 'Defensive ability',
  movement: 'Movement ability',
  knowledge: 'Combat knowledge',
  memory: 'Memory',
};

export const RARITIES = ['common', 'warrior', 'elite', 'legendary'];

export const POWERS = [
  // -- rank 1–5 ------------------------------------------------------------
  {
    id: 'crowd-misdirect', name: 'Crowd misdirect',
    channel: 'movement', rarity: 'common', hue: 0x8fb6ff,
    effect: { kind: 'detection', desc: 'Bump into strangers to spoil a guard’s prediction.' },
  },
  {
    id: 'guard-shatter', name: 'Guard shatter',
    channel: 'special', rarity: 'warrior', hue: 0xffb066,
    effect: { kind: 'guardBreak', desc: 'Break a blocking enemy’s stance with a full-swing baton jab.' },
  },
  {
    id: 'ward-stance', name: 'Ward stance',
    channel: 'defense', rarity: 'warrior', hue: 0x6fe4d0,
    effect: { kind: 'block', desc: 'Held block also shrugs off the first strike of a combo entirely.' },
  },
  {
    id: 'parry-stance', name: 'Parry stance',
    channel: 'defense', rarity: 'elite', hue: 0x9fd0ff,
    effect: { kind: 'parry', desc: 'Parry opens counter-lunge automatically for 0.6 s.' },
  },
  {
    id: 'twin-draws', name: 'Twin draws',
    channel: 'special', rarity: 'warrior', hue: 0x8fff9f,
    effect: { kind: 'aoe', desc: 'Knife combo may pass behind targets as a two-cut slice.' },
  },

  // -- rank 6–10 -----------------------------------------------------------
  {
    id: 'long-guard', name: 'Long guard',
    channel: 'defense', rarity: 'warrior', hue: 0x6fe4d0,
    effect: { kind: 'posture', desc: 'Blocking staff sweeps returns stamina on perfect blocks.' },
  },
  {
    id: 'impact-absorb', name: 'Impact absorb',
    channel: 'defense', rarity: 'warrior', hue: 0xffd493,
    effect: { kind: 'armor', desc: 'First heavy hit each fight loses 50% of its stagger.' },
  },
  {
    id: 'cover-loop', name: 'Cover loop',
    channel: 'movement', rarity: 'elite', hue: 0xa3a7c1,
    effect: { kind: 'stealth', desc: 'Dodge-roll between hard cover extends the stealth meter band.' },
  },
  {
    id: 'body-cocoon', name: 'Body cocoon',
    channel: 'defense', rarity: 'elite', hue: 0xff9a9a,
    effect: { kind: 'aoe', desc: 'While crouched, damage taken falls by 30% (stealth opener anim).' },
  },
  {
    id: 'ember-bolt', name: 'Ember bolt',
    channel: 'magic', rarity: 'elite', hue: 0xff7a3c,
    effect: { kind: 'projectile', desc: 'Fire a burning bolt without a focus weapon (magic style clip).' },
  },
  {
    id: 'heat-guard', name: 'Heat guard',
    channel: 'defense', rarity: 'elite', hue: 0xffb066,
    effect: { kind: 'armor', desc: 'Sanctifying aura absorbs the first magic hit of each fight.' },

  // -- rank 11–20 ----------------------------------------------------------
  },
  {
    id: 'snare-pull', name: 'Snare pull',
    channel: 'special', rarity: 'elite', hue: 0x9fd0ff,
    effect: { kind: 'grab', desc: 'Chain-yank pulls a fleeing fighter into attack range.' },
  },
  {
    id: 'bridge-swing', name: 'Bridge swing',
    channel: 'movement', rarity: 'elite', hue: 0x6fe4d0,
    effect: { kind: 'traversal', desc: 'Chain swing vaults over barricades and gaps.' },
  },
  {
    id: 'pressure-points', name: 'Pressure points',
    channel: 'knowledge', rarity: 'elite', hue: 0xd0a3ff,
    effect: { kind: 'stat', posture: 3, desc: '+3 posture damage on every strike.' },
  },
  {
    id: 'air-sense', name: 'Air sense',
    channel: 'movement', rarity: 'elite', hue: 0xffd493,
    effect: { kind: 'movement', desc: 'Taekwondo aerial gains a small extra kick on descent.' },
  },
  {
    id: 'instant-snare', name: 'Instant snare',
    channel: 'special', rarity: 'elite', hue: 0x9fd0ff,
    effect: { kind: 'instant', desc: 'First chain hit of a fight binds enemy movement for 1.2 s.' },
  },
  {
    id: 'tether-line', name: 'Tether line',
    channel: 'movement', rarity: 'elite', hue: 0x8fd4ff,
    effect: { kind: 'traversal', desc: 'Retreat dash re-traces at double speed.' },
  },
  {
    id: 'vanish-step', name: 'Vanish step',
    channel: 'movement', rarity: 'legendary', hue: 0xbfbfff,
    effect: { kind: 'blink', desc: 'Dodge briefly flickers behind the target.' },
  },
  {
    id: 'aura-bolt', name: 'Aura bolt',
    channel: 'magic', rarity: 'legendary', hue: 0xa3ffd4,
    effect: { kind: 'projectile', desc: 'Staff strikes emit a slowing aura-shockwave.' },
  },
  {
    id: 'banner-sweep', name: 'Banner sweep',
    channel: 'magic', rarity: 'legendary', hue: 0xa3ffd4,
    effect: { kind: 'aoe', desc: 'Wide staff arc pushes and staggers every nearby fighter.' },
  },
  {
    id: 'molten-slam', name: 'Molten slam',
    channel: 'special', rarity: 'legendary', hue: 0xff5a30,
    effect: { kind: 'aoe', desc: 'Hammer slam leaves a burning patch for 4 s.' },
  },
  {
    id: 'heat-haze', name: 'Heat haze',
    channel: 'defense', rarity: 'legendary', hue: 0xff7a3c,
    effect: { kind: 'armor', desc: 'Projected heat misleads distance — a 20% dodge-miss for enemies.' },
  },

  // -- rank 21–29 ----------------------------------------------------------
  {
    id: 'vault-slam', name: 'Vault slam',
    channel: 'special', rarity: 'elite', hue: 0xff5a30,
    effect: { kind: 'grab', desc: 'Slam the grappled target into the ground (or the nearest fighter).' },
  },
  {
    id: 'choke-grip', name: 'Choke grip',
    channel: 'special', rarity: 'elite', hue: 0xd0a3ff,
    effect: { kind: 'grab', desc: 'Sustained grapple drains stamina and posture steadily.' },
  },
  {
    id: 'perfect-parry', name: 'Perfect parry',
    channel: 'defense', rarity: 'legendary', hue: 0x9fd0ff,
    effect: { kind: 'parry', desc: 'Parry window widens by 0.06 s; success opens a full punish.' },
  },
  {
    id: 'riposte-lunge', name: 'Riposte lunge',
    channel: 'special', rarity: 'legendary', hue: 0x9fd0ff,
    effect: { kind: 'strike', desc: 'After a parry, close distance and pierce.' },
  },
  {
    id: 'rime-ward', name: 'Rime ward',
    channel: 'defense', rarity: 'legendary', hue: 0x8fd4ff,
    effect: { kind: 'armor', desc: 'Ice shell absorbs one hit per 12 s and chills the attacker.' },
  },
  {
    id: 'bolt-chain', name: 'Bolt chain',
    channel: 'magic', rarity: 'legendary', hue: 0xa3c1ff,
    effect: { kind: 'projectile', desc: 'Each bolt hit jumps to one more enemy within 4 m.' },
  },
  {
    id: 'smoke-vanish', name: 'Smoke vanish',
    channel: 'movement', rarity: 'legendary', hue: 0xa3a7c1,
    effect: { kind: 'stealth', desc: 'Gains brief stealth after a backward dodge.' },
  },
  {
    id: 'poison-flurry', name: 'Poison flurry',
    channel: 'special', rarity: 'legendary', hue: 0x8fff9f,
    effect: { kind: 'status', desc: 'Full light-string coats the last hit in toxin.' },
  },
  {
    id: 'brace-slam', name: 'Brace slam',
    channel: 'special', rarity: 'legendary', hue: 0xffb066,
    effect: { kind: 'aoe', desc: 'Both-fist downward slam rings the ground nearby.' },
  },
  {
    id: 'sky-leap', name: 'Sky leap',
    channel: 'movement', rarity: 'legendary', hue: 0x8fd4ff,
    effect: { kind: 'jump', desc: 'Strike jump reaches 2× height with a small hang.' },
  },
  {
    id: 'skyfall-sweep', name: 'Skyfall sweep',
    channel: 'special', rarity: 'legendary', hue: 0x8fd4ff,
    effect: { kind: 'aoe', desc: 'Landing staff slam strikes everyone near the feet.' },
  },
  {
    id: 'counter-lunge', name: 'Counter-lunge',
    channel: 'special', rarity: 'legendary', hue: 0x9fd0ff,
    effect: { kind: 'strike', desc: 'Punish a whiffed heavy with a forward piercing stab.' },
  },
  {
    id: 'paired-cover', name: 'Paired cover',
    channel: 'defense', rarity: 'legendary', hue: 0xff9a9a,
    effect: { kind: 'armor', desc: 'Recovery stance absorbs one stagger while standing still.' },
  },
  {
    id: 'mind-echo', name: 'Mind echo',
    channel: 'special', rarity: 'legendary', hue: 0xd0a3ff,
    effect: { kind: 'mirror', desc: 'Echo the player’s last two stolen specials back as grey shades.' },
  },
  {
    id: 'group-snare', name: 'Group snare',
    channel: 'special', rarity: 'legendary', hue: 0x9fd0ff,
    effect: { kind: 'aoe', desc: 'A coordinated chain weave snares all surrounding fighters.' },
  },
  {
    id: 'cross-pull', name: 'Cross-pull',
    channel: 'special', rarity: 'legendary', hue: 0x8fd4ff,
    effect: { kind: 'grab', desc: 'Two chains pull an enemy into the partner’s strike.' },
  },

  // -- rank 30+ legends ----------------------------------------------------
  {
    id: 'unbroken-counter', name: 'Unbroken counter',
    channel: 'defense', rarity: 'legendary', hue: 0xff5a30,
    effect: { kind: 'armor', desc: 'Never staggered while at 25% health — posture holds to the bone.' },
  },
  {
    id: 'nova-chorus', name: 'Nova chorus',
    channel: 'magic', rarity: 'legendary', hue: 0xff7a3c,
    effect: { kind: 'aoe', desc: 'Three sequential ring novas with 0.8 s gaps — dodge to a beat.' },
  },
  {
    id: 'serpent-flame', name: 'Serpent flame',
    channel: 'magic', rarity: 'legendary', hue: 0xff5a30,
    effect: { kind: 'projectile', desc: 'Homing flame serpent across wide distance.' },
  },
  {
    id: 'chain-cage', name: 'Chain cage',
    channel: 'special', rarity: 'legendary', hue: 0x9fd0ff,
    effect: { kind: 'crowd', desc: 'Walls of chains limit 1.5 m — break a face or a wall.' },
  },
  {
    id: 'ground-ripples', name: 'Ground ripples',
    channel: 'special', rarity: 'legendary', hue: 0xffb066,
    effect: { kind: 'aoe', desc: 'Ground-wide slam ripples stagger everything standing.' },
  },
  {
    id: 'mirror-kit', name: 'Mirror kit',
    channel: 'memory', rarity: 'legendary', hue: 0xd0a3ff,
    effect: { kind: 'mirror', desc: 'Adopt the player’s three strongest styles automatically.' },
  },
];

export const POWER_BY_ID = Object.fromEntries(POWERS.map((p) => [p.id, p]));

/** Player stat carry from knowledge powers (folded by combat/stats.js). */
export const KNOWLEDGE_CAPS = { hp: 220, atk: 30, def: 40 };
