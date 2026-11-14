/**
 * Stolen-power slots — MEMORY THIEF v2 (docs/GAME-DESIGN.md §13, Phase 11).
 *
 * Bottom-left strip of every power the Requital has handed you. All 44
 * powers are passive — the slots are a READ-OUT (monogram + name on
 * hover + a running count), never fake cooldown sweeps. Change-driven:
 * the DOM only moves when the set of powers actually changes, and a
 * newly stolen power flashes once as it lands.
 *
 * Data only: main.js feeds the live PlayerCombatState powers set.
 */

import { POWERS, POWER_BY_ID } from '../powers/powers.js';

let root = null;
let lastKey = '';

/** "Crowd misdirect" → "CM", "Perfect parry" → "PP". */
function monogram(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function initPowerSlots() {
  root = document.getElementById('powers');
  if (root) root.replaceChildren();
  lastKey = '';
}

/** Play mode + the H HUD toggle; an empty build shows nothing at all. */
export function setPowerSlotsVisible(on) {
  if (root) root.classList.toggle('hidden', !on);
}

/**
 * @param {Set<string>|string[]} powers ids in acquisition order
 */
export function updatePowerSlots(powers) {
  if (!root) return;
  const ids = [...(powers ?? [])].filter((id) => POWER_BY_ID[id]);
  const key = ids.join('|');
  if (key === lastKey) return;
  const prev = new Set(lastKey ? lastKey.split('|') : []);
  lastKey = key;

  root.replaceChildren();
  if (!ids.length) return;

  const head = document.createElement('span');
  head.className = 'pw-head';
  head.textContent = `STOLEN ${ids.length}/${POWERS.length}`;
  root.appendChild(head);

  const row = document.createElement('div');
  row.className = 'pw-row';
  for (const id of ids) {
    const p = POWER_BY_ID[id];
    const slot = document.createElement('div');
    slot.className = 'pw-slot';
    slot.title = p.name;
    slot.setAttribute('aria-label', p.name);
    const mono = document.createElement('span');
    mono.className = 'pw-mono';
    mono.textContent = monogram(p.name);
    slot.appendChild(mono);
    if (!prev.has(id)) slot.classList.add('pw-new'); // flash once on arrival
    row.appendChild(slot);
  }
  root.appendChild(row);

  // drop the flash class after the entrance animation (once per grant)
  if (prev.size !== ids.length || ids.some((id) => !prev.has(id))) {
    window.setTimeout(() => {
      for (const el of root.querySelectorAll('.pw-new')) el.classList.remove('pw-new');
    }, 2000);
  }
}
