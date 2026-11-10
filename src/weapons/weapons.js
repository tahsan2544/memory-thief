/**
 * Weapon catalogue — MEMORY THIEF v2 concept (docs/GAME-DESIGN.md §5).
 *
 * Pure data. The hotbar (Phase 8), weapon models (Phase 8) and enemy configs
 * (Phase 4/5) consume this module.
 *
 * HARD RULE (docs/GAME-DESIGN.md §6): every enemy GROUP fights with exactly
 * ONE weapon category — members may vary in rank/health/damage/abilities, but
 * never in weapon category. `scripts/check-data.mjs` asserts the roster obeys.
 */

export const WEAPON_CATEGORIES = {
  fists: 'FISTS',
  baton: 'BATON',
  knife: 'KNIFE',
  sword: 'SWORD',
  staff: 'STAFF',
  hammer: 'HAMMER',
  axe: 'AXE',
  chain: 'CHAIN',
  gauntlet: 'GAUNTLET',
  focus: 'FOCUS',
};

export const CATEGORY_LIST = [
  'fists',
  'baton',
  'knife',
  'sword',
  'staff',
  'hammer',
  'axe',
  'chain',
  'gauntlet',
  'focus',
];

export const WEAPONS = [
  {
    id: 'wrapped-fists',
    name: 'Wrapped fists',
    category: 'fists',
    damage: 8,
    attackSpeed: 3.0,
    range: 1.3,
    specials: [],
    animationSet: 'unarmed',
    unlock: { kind: 'default' },
    model: 'fists',
  },
  {
    id: 'composite-baton',
    name: 'Composite baton',
    category: 'baton',
    damage: 14,
    attackSpeed: 2.4,
    range: 1.7,
    specials: ['guard-break'],
    animationSet: 'baton',
    unlock: { kind: 'group', group: 'alley-fighters' },
    model: 'baton',
  },
  {
    id: 'willow-knife',
    name: 'Willow knife',
    category: 'knife',
    damage: 10,
    attackSpeed: 3.4,
    range: 1.2,
    specials: ['bleed'],
    animationSet: 'knife',
    unlock: { kind: 'group', group: 'venom-crew' },
    model: 'knife',
  },
  {
    id: 'runner-sabre',
    name: 'Blade Runner sabre',
    category: 'sword',
    damage: 22,
    attackSpeed: 1.9,
    range: 2.6,
    specials: ['parry-stance'],
    animationSet: 'sword',
    unlock: { kind: 'group', group: 'blade-runners' },
    model: 'sabre',
  },
  {
    id: 'iron-staff',
    name: 'Iron Staff',
    category: 'staff',
    damage: 16,
    attackSpeed: 2.1,
    range: 3.2,
    specials: ['storm-star'],
    animationSet: 'staff',
    unlock: { kind: 'group', group: 'iron-staff' },
    model: 'staff',
  },
  {
    id: 'crusher-maul',
    name: 'Crusher maul',
    category: 'hammer',
    damage: 38,
    attackSpeed: 0.9,
    range: 2.2,
    specials: ['ground-shock'],
    animationSet: 'hammer',
    unlock: { kind: 'group', group: 'heavy-crushers' },
    model: 'maul',
  },
  {
    id: 'glass-hatchet',
    name: 'Glassline hatchet',
    category: 'axe',
    damage: 27,
    attackSpeed: 1.4,
    range: 2.0,
    specials: ['armor-shred'],
    animationSet: 'axe',
    unlock: { kind: 'group', group: 'gilded-axes' },
    model: 'hatchet',
  },
  {
    id: 'salvage-chain',
    name: 'Salvage chain',
    category: 'chain',
    damage: 15,
    attackSpeed: 2.2,
    range: 3.8,
    specials: ['snare-pull'],
    animationSet: 'chain',
    unlock: { kind: 'group', group: 'chainbreakers' },
    model: 'chain',
  },
  {
    id: 'anvil-gauntlets',
    name: 'Anvil gauntlets',
    category: 'gauntlet',
    damage: 30,
    attackSpeed: 1.6,
    range: 1.3,
    specials: ['brace-slam'],
    animationSet: 'gauntlet',
    unlock: { kind: 'group', group: 'the-molded-ones' },
    model: 'gauntlets',
  },
  {
    id: 'ember-prism',
    name: 'Ember prism',
    category: 'focus',
    damage: 12,
    attackSpeed: 1.3,
    range: 18,
    specials: ['bolt', 'nova', 'ward'],
    animationSet: 'magic',
    unlock: { kind: 'group', group: 'flame-order' },
    model: 'prism',
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

/** Hotbar rules (docs/GAME-DESIGN.md §5). */
export const HOTBAR_SLOTS = 9;
