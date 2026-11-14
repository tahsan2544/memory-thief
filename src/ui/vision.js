/**
 * Resonance Sight markers — MEMORY THIEF v2 (docs/TECH-PLAN.md Phase 11).
 *
 * While the ability burns (V), every live fighter in the city gets a
 * screen-projected marker over its head:
 *   - rank numeral in the crew's difficulty colour (the ladder at a glance)
 *   - a gold crown on the squad leader (lowest index still standing)
 *   - a crimson aura on the Overlord's arena
 *   - a star flash on elite crews (difficulty 4+)
 *   - a gold pulse on subdued bodies — ready for the Requital
 *
 * DOM-only + one THREE.Vector3 scratch for projection — no scene access
 * (the same contract as combatHud). The marker pool grows on demand and
 * is reused; per frame this only moves existing nodes.
 */

import * as THREE from 'three';

let els = null;
let cam = null; // camera used for marker projection
let sizeEl = null; // renderer dom element (clientWidth/Height)
let pool = []; // { el, key } — skin is change-driven per marker
const scratch = new THREE.Vector3();

function ensure() {
  if (els) return els;
  els = { root: document.getElementById('vision') };
  return els;
}

/** main.js binds the camera + canvas once after the renderer exists. */
export function setVisionProjector(camera, domElement) {
  cam = camera;
  sizeEl = domElement;
}

export function initVision() {
  ensure();
}

function hex(color) {
  const n = (color ?? 0x6f9fd8) >>> 0;
  return `#${n.toString(16).padStart(6, '0').slice(-6)}`;
}

/**
 * Project the marker set for this frame.
 * @param {{active:boolean, targets:Array<{x:number,y:number,z:number,
 *   rank:number,color:number,boss?:boolean,elite?:boolean,leader?:boolean,
 *   subdued?:boolean}>}|null} view null / inactive clears the overlay
 */
export function updateVision(view) {
  const e = ensure();
  if (!e.root) return;
  const targets = view?.active && Array.isArray(view.targets) ? view.targets : null;
  if (!targets || !cam || !sizeEl) {
    if (!e.root.classList.contains('hidden')) e.root.classList.add('hidden');
    return;
  }

  const w = sizeEl.clientWidth || window.innerWidth;
  const h = sizeEl.clientHeight || window.innerHeight;

  while (pool.length < targets.length) {
    const el = document.createElement('div');
    el.className = 'vis-mark vis-off';
    el.innerHTML = '<i class="vis-crown">♛</i><b class="vis-rank">0</b><i class="vis-star">★</i>';
    e.root.appendChild(el);
    pool.push({ el, key: '' });
  }

  let shown = 0;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const m = pool[i];
    scratch.set(t.x, t.y, t.z).project(cam);
    const behind = scratch.z > 1 || scratch.z < -1;
    const x = (scratch.x * 0.5 + 0.5) * w;
    const y = (-scratch.y * 0.5 + 0.5) * h;
    const outside = behind || x < 10 || y < 10 || x > w - 10 || y > h - 10;
    if (outside) {
      if (!m.el.classList.contains('vis-off')) m.el.classList.add('vis-off');
      continue;
    }
    shown++;
    if (m.el.classList.contains('vis-off')) m.el.classList.remove('vis-off');
    const px = `${Math.round(x)}px`;
    const py = `${Math.round(y)}px`;
    if (m.el.style.left !== px) m.el.style.left = px;
    if (m.el.style.top !== py) m.el.style.top = py;

    // change-driven skin: colours, crowns and auras only touch the DOM
    // when the marker's story actually changes
    const key = `${t.rank}|${t.color}|${t.boss ? 1 : 0}|${t.elite ? 1 : 0}|${t.leader ? 1 : 0}|${t.subdued ? 1 : 0}`;
    if (m.key !== key) {
      m.key = key;
      const rank = m.el.querySelector('.vis-rank');
      const rt = String(t.rank);
      if (rank.textContent !== rt) rank.textContent = rt;
      m.el.style.setProperty('--vis-color', hex(t.color));
      m.el.classList.toggle('vis-boss', !!t.boss);
      m.el.classList.toggle('vis-elite', !!t.elite);
      m.el.classList.toggle('vis-leader', !!t.leader);
      m.el.classList.toggle('vis-subdued', !!t.subdued);
    }
  }
  // pool slots beyond this frame's targets stay dark
  for (let i = targets.length; i < pool.length; i++) {
    if (!pool[i].el.classList.contains('vis-off')) pool[i].el.classList.add('vis-off');
  }

  const wantHidden = shown === 0;
  if (wantHidden !== e.root.classList.contains('hidden')) {
    e.root.classList.toggle('hidden', wantHidden);
  }
}

/** Test/debug snapshot (window.__MT_VISION__). */
export function visionState() {
  const e = ensure();
  const active = !!(e.root && !e.root.classList.contains('hidden'));
  let shown = 0;
  if (active) for (const m of pool) if (!m.el.classList.contains('vis-off')) shown++;
  return { active, shown, pooled: pool.length };
}
