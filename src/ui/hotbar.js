/**
 * Combat hotbar — MEMORY THIEF v2 (docs/GAME-DESIGN.md §10).
 *
 * Nine slots (digits 1–9). Slots fill as steals grant weapons; the
 * equipped slot is highlighted. Change-driven: labels and the active
 * marker only touch the DOM when they actually move.
 */

import { HOTBAR_SLOTS, WEAPON_BY_ID } from '../weapons/weapons.js';

let built = false;
let slotEls = [];
let root = null;
let lastKey = '';

function ensure() {
  if (built && root && document.body.contains(root)) return true;
  root = document.getElementById('hotbar');
  if (!root) return false;
  root.replaceChildren();
  slotEls = [];
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className = 'hot-slot';
    const key = document.createElement('span');
    key.className = 'hot-key';
    key.textContent = String(i + 1);
    const name = document.createElement('span');
    name.className = 'hot-name';
    slot.append(key, name);
    root.appendChild(slot);
    slotEls.push({ slot, name });
  }
  built = true;
  lastKey = '';
  return true;
}

export function initHotbar() {
  return ensure() ? root : null;
}

/** Play mode shows the bar; overlays tuck it away. */
export function setHotbarVisible(on) {
  if (!ensure()) return;
  root.classList.toggle('hidden', !on);
}

/**
 * @param {object} view
 * @param {string[]} view.hotbar weapon ids in slot order
 * @param {string} view.weaponId currently equipped weapon
 */
export function updateHotbar(view) {
  if (!ensure() || !view) return;
  const sig = `${view.hotbar?.join(',') ?? ''}|${view.weaponId ?? ''}`;
  if (sig === lastKey) return;
  lastKey = sig;
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const id = view.hotbar?.[i];
    const { slot, name } = slotEls[i];
    const weapon = id ? WEAPON_BY_ID[id] : null;
    const label = weapon ? weapon.name : '';
    if (name.textContent !== label) name.textContent = label;
    slot.classList.toggle('owned', !!weapon);
    slot.classList.toggle('active', !!weapon && id === view.weaponId);
  }
}

/** Pulse a slot when a steal fills it (or a digit swaps the weapon). */
export function flashHotbarSlot(index) {
  if (!ensure()) return;
  const s = slotEls[index];
  if (!s) return;
  s.slot.classList.remove('flash');
  // reflow so the animation can restart
  void s.slot.offsetWidth;
  s.slot.classList.add('flash');
  setTimeout(() => s.slot.classList.remove('flash'), 450);
}
