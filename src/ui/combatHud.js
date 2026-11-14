/**
 * Combat HUD — MEMORY THIEF v2 (docs/GAME-DESIGN.md §10, Phase 9).
 *
 * Everything the fight needs at a glance, change-driven like stealthHud:
 *   - vitals: HP / stamina / posture bars + style name (bottom-left)
 *   - target plate: locked enemy name + HP (top-centre, under the chip)
 *   - rank chip: ladder position + title (top-right)
 *   - floating damage numbers (world-projected, DOM)
 *   - centre events: COUNTER, GUARD BROKEN, stolen-style toasts
 *
 * DOM-only + one THREE.Vector3 scratch for projection — no scene access.
 */

import * as THREE from 'three';

const MAX_FLOATS = 24;

let els = null;
let cam = null; // camera used for damage-number projection
let sizeEl = null; // renderer dom element (clientWidth/Height)
const scratch = new THREE.Vector3();

function cache() {
  if (els) return els;
  els = {
    root: document.getElementById('combat'),
    hpFill: document.getElementById('combat-hp'),
    hpNum: document.getElementById('combat-hp-num'),
    stFill: document.getElementById('combat-st'),
    psFill: document.getElementById('combat-ps'),
    style: document.getElementById('combat-style'),
    weapon: document.getElementById('combat-weapon'),
    target: document.getElementById('combat-target'),
    targetName: document.getElementById('combat-target-name'),
    targetFill: document.getElementById('combat-target-fill'),
    targetSub: document.getElementById('combat-target-sub'),
    rank: document.getElementById('combat-rank'),
    boss: document.getElementById('combat-boss'),
    bossName: document.getElementById('combat-boss-name'),
    bossPhase: document.getElementById('combat-boss-phase'),
    bossFill: document.getElementById('combat-boss-fill'),
    bossPosture: document.getElementById('combat-boss-posture-fill'),
    floats: document.getElementById('combat-floats'),
    events: document.getElementById('combat-events'),
  };
  return els;
}

export function initCombatHud() {
  const e = cache();
  if (!e.root) return null;
  updateCombatHud(null);
  return e.root;
}

/** main.js binds the camera + canvas once after the renderer exists. */
export function setCombatProjector(camera, domElement) {
  cam = camera;
  sizeEl = domElement;
}

/** Play mode shows the bars; inspection / overlays hide them. */
export function setCombatHudVisible(on) {
  const e = cache();
  if (e.root) e.root.classList.toggle('hidden', !on);
}

/**
 * @param {object|null} view
 * @param {number} view.hp / view.maxHp / view.stamina / view.posture (0..100)
 * @param {string} view.style name · view.weapon name
 * @param {number} view.rank · view.rankTitle
 * @param {object|null} view.target { name, sub, hp, maxHp }
 * @param {object|null} view.boss { name, phase, phaseTitle, hp, maxHp, posture, maxPosture }
 */
export function updateCombatHud(view) {
  const e = cache();
  if (!e.root) return;
  if (!view) {
    if (!e.root.classList.contains('hidden')) e.root.classList.add('hidden');
    return;
  }
  if (e.root.classList.contains('hidden')) e.root.classList.remove('hidden');

  const pct = (v, max) => `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`;
  if (e.hpFill) {
    const w = pct(view.hp, view.maxHp);
    if (e.hpFill.style.width !== w) e.hpFill.style.width = w;
    e.hpFill.classList.toggle('low', view.hp / Math.max(1, view.maxHp) < 0.3);
  }
  if (e.hpNum) {
    const t = `${Math.max(0, Math.round(view.hp))}`;
    if (e.hpNum.textContent !== t) e.hpNum.textContent = t;
  }
  if (e.stFill) {
    const w = pct(view.stamina, 100);
    if (e.stFill.style.width !== w) e.stFill.style.width = w;
  }
  if (e.psFill) {
    const w = pct(view.posture, 100);
    if (e.psFill.style.width !== w) e.psFill.style.width = w;
    e.psFill.classList.toggle('full', view.posture >= 99);
  }
  if (e.style && view.style && e.style.textContent !== view.style) e.style.textContent = view.style;
  if (e.weapon && view.weapon && e.weapon.textContent !== view.weapon) e.weapon.textContent = view.weapon;
  if (e.rank) {
    const t = `RANK ${view.rank} · ${view.rankTitle}`;
    if (e.rank.textContent !== t) e.rank.textContent = t;
  }

  // ---- boss bar (Phase 13) ----------------------------------------------
  const boss = view.boss;
  if (boss) {
    if (e.boss?.classList.contains('hidden')) e.boss.classList.remove('hidden');
    const bt = `${boss.name.toUpperCase()}`;
    if (e.bossName && e.bossName.textContent !== bt) e.bossName.textContent = bt;
    const bp = `PHASE ${boss.phase} · ${boss.phaseTitle}`;
    if (e.bossPhase && e.bossPhase.textContent !== bp) e.bossPhase.textContent = bp;
    if (e.bossFill) {
      const w = pct(boss.hp, boss.maxHp);
      if (e.bossFill.style.width !== w) e.bossFill.style.width = w;
    }
    if (e.bossPosture) {
      const w = pct(boss.posture, boss.maxPosture);
      if (e.bossPosture.style.width !== w) e.bossPosture.style.width = w;
    }
  } else if (e.boss && !e.boss.classList.contains('hidden')) {
    e.boss.classList.add('hidden');
  }

  // ---- target plate ----------------------------------------------------
  const tgt = view.target;
  if (tgt) {
    if (e.target?.classList.contains('hidden')) e.target.classList.remove('hidden');
    if (e.targetName && e.targetName.textContent !== tgt.name) e.targetName.textContent = tgt.name;
    if (e.targetFill) {
      const w = pct(tgt.hp, tgt.maxHp);
      if (e.targetFill.style.width !== w) e.targetFill.style.width = w;
    }
    if (e.targetSub && e.targetSub.textContent !== (tgt.sub ?? '')) e.targetSub.textContent = tgt.sub ?? '';
  } else if (e.target && !e.target.classList.contains('hidden')) {
    e.target.classList.add('hidden');
  }
}

/* --------------------------------------------------------------------- *
 * Floating damage numbers
 * --------------------------------------------------------------------- */

/**
 * Spawn a world-anchored damage number that drifts up and fades.
 * @param {{x:number,y:number,z:number}} world
 * @param {string|number} text
 * @param {'hit'|'crit'|'taken'|'heal'|'steal'} kind
 */
export function spawnDamageNumber(world, text, kind = 'hit') {
  const e = cache();
  if (!e.floats || !cam || !sizeEl) return;
  if (e.floats.children.length >= MAX_FLOATS) e.floats.firstChild?.remove();

  scratch.set(world.x, world.y, world.z).project(cam);
  if (scratch.z > 1 || scratch.z < -1) return; // behind the camera
  const w = sizeEl.clientWidth || window.innerWidth;
  const h = sizeEl.clientHeight || window.innerHeight;
  const x = (scratch.x * 0.5 + 0.5) * w;
  const y = (-scratch.y * 0.5 + 0.5) * h;

  const el = document.createElement('div');
  el.className = `dmg-num dmg-${kind}`;
  el.textContent = String(text);
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  e.floats.appendChild(el);
  const kill = () => el.remove();
  el.addEventListener('animationend', kill, { once: true });
  setTimeout(kill, 1400); // belt & braces if animations are reduced
}

/**
 * Big centre cue (COUNTER!, GUARD BROKEN, style learned…). Stacks up to 3.
 * @param {string} text
 * @param {'good'|'bad'|'info'} kind
 */
export function spawnCombatEvent(text, kind = 'info') {
  const e = cache();
  if (!e.events) return;
  while (e.events.children.length >= 3) e.events.firstChild.remove();
  const el = document.createElement('div');
  el.className = `combat-event event-${kind}`;
  el.textContent = text;
  e.events.appendChild(el);
  const kill = () => el.remove();
  el.addEventListener('animationend', kill, { once: true });
  setTimeout(kill, 1800);
}

/** Clear transient visuals (world rebuild, load). */
export function clearCombatFx() {
  const e = cache();
  if (e.floats) e.floats.replaceChildren();
  if (e.events) e.events.replaceChildren();
}
