/**
 * Memory story card — MEMORY THIEF v2 (docs/TECH-PLAN.md Phase 12).
 *
 * The five-facet choreography a Requital hands back, as a transient panel:
 *   THE MEMORY → HOW THEY STAND → HOW IT BREAKS → THE NEXT LEAD →
 *   WHAT THE CITY HIDES (act-locked)
 *
 * Opens on steal completion, closes on the next key / click or by itself
 * after ten seconds. Capture-phase input so the closing key never leaks
 * into the world (the card eats exactly one input, then gets out).
 * DOM-only — main.js passes the pure storyBeatsFor() result in.
 */

let root = null;
let timer = 0;
let current = null; // last beats payload, kept for the test hook
let closing = false;

function ensure() {
  if (root) return root;
  root = document.getElementById('story');
  return root;
}

function onKeyDown(ev) {
  if (closing) return;
  ev.preventDefault();
  ev.stopPropagation();
  hideStoryCard();
}
function onPointer(ev) {
  if (closing) return;
  ev.preventDefault();
  ev.stopPropagation();
  hideStoryCard();
}

/**
 * @param {{id:string, rank:number, name:string, type:string,
 *   act:{n:number,title:string,done:number,total:number},
 *   facets:Array<{k:string,label:string,text:string}>}} beats
 */
export function showStoryCard(beats) {
  const el = ensure();
  if (!el || !beats) return;
  current = beats;
  closing = false;

  el.replaceChildren();
  const kicker = document.createElement('div');
  kicker.className = 'story-kicker';
  kicker.textContent =
    `RANK ${beats.rank} · ${beats.type.toUpperCase()} · ACT ${beats.act.n} — ${beats.act.title}`;
  const title = document.createElement('h3');
  title.className = 'story-title';
  title.textContent = beats.name;
  el.append(kicker, title);

  for (const f of beats.facets) {
    const row = document.createElement('div');
    row.className = `story-facet${f.k === 'fact' && /Locked/.test(f.text) ? ' story-locked' : ''}`;
    const label = document.createElement('span');
    label.className = 'story-label';
    label.textContent = f.label;
    const text = document.createElement('span');
    text.className = 'story-text';
    text.textContent = f.text;
    row.append(label, text);
    el.appendChild(row);
  }

  el.classList.remove('hidden');
  el.setAttribute('data-open', '1');

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pointerdown', onPointer, true);
  clearTimeout(timer);
  timer = window.setTimeout(hideStoryCard, 10000);
}

export function hideStoryCard() {
  const el = ensure();
  if (!el || el.classList.contains('hidden')) return;
  closing = true;
  el.classList.add('hidden');
  el.removeAttribute('data-open');
  clearTimeout(timer);
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('pointerdown', onPointer, true);
}

export function isStoryCardOpen() {
  const el = ensure();
  return !!el && !el.classList.contains('hidden');
}

/** Test/debug snapshot (window.__MT_STORY__). */
export function storyCardState() {
  const el = ensure();
  return {
    open: !!el && !el.classList.contains('hidden'),
    id: current?.id ?? null,
    rank: current?.rank ?? null,
    type: current?.type ?? null,
    act: current?.act ?? null,
    facets: current?.facets ?? [],
  };
}
