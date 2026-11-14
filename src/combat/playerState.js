/**
 * Player combat state — MEMORY THIEF v2 (docs/GAME-DESIGN.md §3, §9).
 *
 * Owns everything the fight grants: vitals, the equipped style/weapon, the
 * hotbar, stolen powers, knowledge bonuses and the defeated-group ledger.
 * Pure data + methods: no DOM, no Three.js. `combat/combatSystem.js` mutates
 * the vitals; `powers/steal.js` grants; `progression/saveManager.js` persists
 * a snapshot under the `combat` key of the checkpoint.
 */

import { BASIC_STYLE_ID, STYLE_BY_ID } from './styles.js';
import { WEAPON_BY_ID, HOTBAR_SLOTS } from '../weapons/weapons.js';
import { POWER_BY_ID } from '../powers/powers.js';
import { GROUP_BY_ID } from '../enemies/groups.js';
import { deriveStats } from './stats.js';

/** Ceiling on the knowledge a Requital can bank — the T screen shows it. */
export const MAX_KNOWLEDGE = { hp: 220, atk: 30, def: 40 };

export class PlayerCombatState {
  constructor() {
    this.reset();
  }

  reset() {
    /** Vitals — re-clamped against deriveStats().maxHp after any grant. */
    this.hp = 100;
    this.stamina = 100;
    this.posture = 0; // stagger meter; 100 = staggered
    this.styleId = BASIC_STYLE_ID;
    this.weaponId = 'wrapped-fists';
    /** Weapon ids in hotbar order (index 0 = slot 1). */
    this.hotbar = ['wrapped-fists'];
    /** Stolen power ids (Set). */
    this.powers = new Set();
    /** Knowledge bonuses folded into maxHp / atk / def. */
    this.knowledge = { hp: 0, atk: 0, def: 0 };
    /** Group ids whose style/power/knowledge has already been stolen. */
    this.defeated = new Set();
    /** Style ids ever acquired (for the style ledger / journal). */
    this.stolenStyles = new Set([BASIC_STYLE_ID]);
    this.kills = 0; // enemies subdued
    this.steals = 0; // successful Requital channels
    this._stats = null;
  }

  /** Cached derived stats — invalidated by every mutation below. */
  stats() {
    if (!this._stats) this._stats = deriveStats(this);
    return this._stats;
  }

  _dirty() {
    this._stats = null;
    // vitals ride along with the new maxHp (a grant must never leave you
    // above the cap or below the floor after a load)
    const max = deriveStats(this).maxHp;
    this.hp = Math.min(max, Math.max(1, this.hp));
    this.stamina = Math.min(100, Math.max(0, this.stamina));
  }

  get maxHp() {
    return this.stats().maxHp;
  }

  get alive() {
    return this.hp > 0;
  }

  isDefeated(groupId) {
    return this.defeated.has(groupId);
  }

  hasPower(id) {
    return this.powers.has(id);
  }

  ownsStyle(id) {
    return this.stolenStyles.has(id);
  }

  /**
   * Grant everything a freshly subdued group teaches (style, weapon, powers,
   * knowledge). Repeat steals of the same group only deepen knowledge — the
   * anti-duplicate rule in docs/GAME-DESIGN.md §9.
   * @param {object} group entries from enemies/groups.js
   * @returns {{firstTime:boolean, style:?, weapon:?, powers:string[], knowledge:?}}
   */
  grantGroup(group) {
    const firstTime = !this.defeated.has(group.id);
    const g = group.grants ?? {};
    const out = { firstTime, style: null, weapon: null, powers: [], knowledge: null };

    if (g.style && STYLE_BY_ID[g.style]) {
      out.style = g.style;
      if (!this.stolenStyles.has(g.style)) this.stolenStyles.add(g.style);
      this.styleId = g.style; // the newest style becomes the equipped one
    }
    if (g.weapon && WEAPON_BY_ID[g.weapon]) {
      out.weapon = g.weapon;
      if (!this.hotbar.includes(g.weapon)) {
        if (this.hotbar.length < HOTBAR_SLOTS) this.hotbar.push(g.weapon);
        else this.hotbar[this.hotbar.length - 1] = g.weapon; // slot overflow replaces last
      }
      this.weaponId = g.weapon;
    }
    for (const pid of g.powers ?? []) {
      if (POWER_BY_ID[pid] && !this.powers.has(pid)) {
        this.powers.add(pid);
        out.powers.push(pid);
      }
    }
    const k = g.knowledge;
    if (k) {
      const before = { ...this.knowledge };
      this.knowledge.hp = Math.min(MAX_KNOWLEDGE.hp, this.knowledge.hp + (k.hp ?? 0));
      this.knowledge.atk = Math.min(MAX_KNOWLEDGE.atk, this.knowledge.atk + (k.atk ?? 0));
      this.knowledge.def = Math.min(MAX_KNOWLEDGE.def, this.knowledge.def + (k.def ?? 0));
      if (before.hp !== this.knowledge.hp || before.atk !== this.knowledge.atk || before.def !== this.knowledge.def) {
        out.knowledge = { ...this.knowledge };
      }
    }
    this.defeated.add(group.id);
    if (firstTime) this.steals++;
    this._dirty();
    // a steal tops you up: the Requital feeds on what it takes
    if (firstTime) this.hp = this.maxHp;
    return out;
  }

  /** Equip a hotbar slot (0-based). Returns the weapon id now equipped. */
  equipSlot(i) {
    const id = this.hotbar[i];
    if (id && WEAPON_BY_ID[id]) {
      this.weaponId = id;
      this._dirty();
      return id;
    }
    return null;
  }

  /** Set the active fighting style directly (tests + steal grants). */
  setStyle(id) {
    if (STYLE_BY_ID[id]) {
      this.styleId = id;
      this.stolenStyles.add(id);
      this._dirty();
      return true;
    }
    return false;
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - Math.max(0, amount));
    return this.hp;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + Math.max(0, amount));
    return this.hp;
  }

  snapshot() {
    return {
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      stamina: Math.round(this.stamina),
      posture: Math.round(this.posture),
      styleId: this.styleId,
      weaponId: this.weaponId,
      hotbar: [...this.hotbar],
      powers: [...this.powers],
      knowledge: { ...this.knowledge },
      defeated: [...this.defeated],
      stolenStyles: [...this.stolenStyles],
      kills: this.kills,
      steals: this.steals,
      rank: this.defeated.size, // groups cleared = rung on the 34-rung ladder
    };
  }

  /** Coerce a loaded snapshot back into live state (never throws). */
  applySnapshot(snap) {
    if (!snap || typeof snap !== 'object') return false;
    this.reset();
    const str = (v) => (typeof v === 'string' ? v : null);
    const style = str(snap.styleId);
    if (style && STYLE_BY_ID[style]) this.styleId = style;
    const wep = str(snap.weaponId);
    if (wep && WEAPON_BY_ID[wep]) this.weaponId = wep;
    if (Array.isArray(snap.hotbar)) {
      this.hotbar = snap.hotbar.filter((id) => WEAPON_BY_ID[id]).slice(0, HOTBAR_SLOTS);
      if (!this.hotbar.length) this.hotbar = ['wrapped-fists'];
    }
    if (Array.isArray(snap.powers)) {
      this.powers = new Set(snap.powers.filter((id) => POWER_BY_ID[id]));
    }
    const k = snap.knowledge;
    if (k && typeof k === 'object') {
      const n = (v, cap) => (Number.isFinite(v) ? Math.min(cap, Math.max(0, v | 0)) : 0);
      this.knowledge = {
        hp: n(k.hp, MAX_KNOWLEDGE.hp),
        atk: n(k.atk, MAX_KNOWLEDGE.atk),
        def: n(k.def, MAX_KNOWLEDGE.def),
      };
    }
    if (Array.isArray(snap.defeated)) {
      this.defeated = new Set(snap.defeated.filter((id) => GROUP_BY_ID[id]));
    }
    if (Array.isArray(snap.stolenStyles)) {
      this.stolenStyles = new Set(snap.stolenStyles.filter((id) => STYLE_BY_ID[id]));
      if (!this.stolenStyles.has(BASIC_STYLE_ID)) this.stolenStyles.add(BASIC_STYLE_ID);
    }
    this.kills = Number.isFinite(snap.kills) ? Math.max(0, snap.kills | 0) : 0;
    this.steals = Number.isFinite(snap.steals) ? Math.max(0, snap.steals | 0) : 0;
    this._dirty();
    this.hp = Math.min(this.maxHp, Math.max(1, Number.isFinite(snap.hp) ? snap.hp : this.maxHp));
    this.stamina = 100;
    this.posture = 0;
    return true;
  }
}
