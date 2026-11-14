/**
 * Ending — KEEP or RELEASE (docs/GAME-DESIGN.md §14b, TECH-PLAN Phase 13).
 *
 * Opens the moment the Overlord's memory is stolen: his beg, the final act
 * fact, and the two hands it ends in.
 *   KEEP    — become the new rank-zero power (the city keeps its pyramid).
 *   RELEASE — every stolen power unspools back into the city.
 *
 * The choice is required: no Esc-out, no click-away. main.js reads
 * endingChoice() to apply the mechanical half (RELEASE empties the powers)
 * and persists it in the save.
 */

let choice = null; // null | 'keep' | 'release'
let hooks = { onChoose: null };
let bound = false;

function el(id) {
  return document.getElementById(id);
}

function onKeep() {
  choose('keep');
}
function onRelease() {
  choose('release');
}

function choose(c) {
  if (choice || !isEndingOpen()) return;
  choice = c;
  const root = el('ending');
  if (root) root.classList.add('hidden');
  hooks.onChoose?.(c);
}

function bind() {
  if (bound) return;
  bound = true;
  el('ending-keep')?.addEventListener('click', onKeep);
  el('ending-release')?.addEventListener('click', onRelease);
}

/**
 * @param {{fact?: string, onChoose?: (c:'keep'|'release')=>void}} opts
 */
export function showEnding(opts = {}) {
  bind();
  hooks.onChoose = opts.onChoose ?? null;
  const fact = el('ending-fact');
  if (fact) {
    fact.textContent = opts.fact
      ? `WHAT THE CITY HIDES — ${opts.fact}`
      : '';
    fact.classList.toggle('hidden', !opts.fact);
  }
  el('ending')?.classList.remove('hidden');
}

export function isEndingOpen() {
  const root = el('ending');
  return !!root && !root.classList.contains('hidden');
}

export function endingChoice() {
  return choice;
}

/** New game / test reset — forget the verdict. */
export function resetEnding() {
  choice = null;
  el('ending')?.classList.add('hidden');
}

/** Restores a persisted verdict from a checkpoint (load path). */
export function setEndingChoice(c) {
  choice = c === 'keep' || c === 'release' ? c : null;
}

/** Test/debug snapshot (window.__MT_ENDING__). */
export function endingState() {
  return { open: isEndingOpen(), choice };
}
