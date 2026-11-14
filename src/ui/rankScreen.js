/**
 * RankScreen — the 34-rung ladder (Phase 14, key K).
 *
 * The whole climb on one page, grouped by act:
 *   ACT I — THE UNSCHOOLED            ✓ 1/9
 *     01  Street Pickpockets          AMBUSH      ✓
 *     02  Alley Fighters              DUEL        → NEXT
 *     …
 *     34  The Overlord                SIEGE       ·
 *
 * Rows read in strict rank order; a cleared rung is ticked, the single
 * next target carries the arrow, and the Overlord row is tagged `boss`.
 * Presentation only — `cbs.data()` hands over the ledger, this module
 * only draws it.
 */

import { groupsInRankOrder, nextTarget } from '../enemies/ranking.js';
import { ACTS, actProgress, typeOf } from '../story/storyBeats.js';

const $ = (id) => document.getElementById(id);

const ROMAN = ['I', 'II', 'III', 'IV'];

let cbs = null;
let open = false;

/** The ladder as drawn: act blocks, each with its rungs in rank order. */
function ladder(data) {
  const defeated = data?.defeated instanceof Set ? data.defeated : new Set(data?.defeated ?? []);
  const next = nextTarget(defeated);
  const ordered = groupsInRankOrder();
  return ACTS.map((act) => {
    const prog = actProgress(act, defeated);
    const rungs = ordered
      .filter((g) => g.rank >= act.from && g.rank <= act.to)
      .map((g) => {
        const cleared = defeated.has(g.id);
        const isNext = next?.id === g.id;
        const boss = g.rank === 34;
        return {
          id: g.id,
          rank: g.rank,
          name: g.name,
          type: typeOf(g),
          mark: cleared ? '✓' : isNext ? '→ NEXT' : '·',
          cls: cleared ? 'defeated' : isNext ? 'next' : boss ? 'boss' : '',
        };
      });
    return {
      n: act.n,
      roman: ROMAN[act.n - 1] ?? String(act.n),
      title: act.title,
      done: prog.done,
      total: prog.total,
      cleared: prog.cleared,
      rungs,
    };
  });
}

function render() {
  const root = $('rank');
  const data = cbs?.data?.();
  if (!root || !data) return;

  const acts = ladder(data);
  const cleared = acts.reduce((n, a) => n + a.done, 0);
  const total = acts.reduce((n, a) => n + a.total, 0);

  const count = $('rank-count');
  if (count) {
    count.innerHTML =
      `<b>${cleared}</b>/${total} CLEARED` +
      `<span class="gear-motes-earned">${data.rankTitle ?? ''}</span>`;
  }
  const how = $('rank-how');
  if (how) how.textContent = 'One territory, one steal — clear the rung, take the memory.';

  const wrap = $('rank-acts');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const act of acts) {
    const block = document.createElement('section');
    block.className = `rank-act${act.cleared ? ' done' : ''}`;
    block.dataset.act = String(act.n);

    const head = document.createElement('div');
    head.className = 'rank-act-head';
    head.innerHTML =
      `<span class="rank-act-num">ACT ${act.roman} — ${act.title.toUpperCase()}</span>` +
      `<span class="rank-act-prog">${act.cleared ? '✓ ' : ''}${act.done}/${act.total}</span>`;
    block.appendChild(head);

    for (const r of act.rungs) {
      const row = document.createElement('div');
      row.className = `rank-row${r.cls ? ` ${r.cls}` : ''}`;
      row.dataset.id = r.id;
      row.dataset.rank = String(r.rank);
      row.innerHTML =
        `<span class="rank-row-num">${String(r.rank).padStart(2, '0')}</span>` +
        `<span class="rank-row-name">${r.name}</span>` +
        `<span class="rank-row-type">${r.type.toUpperCase()}</span>` +
        `<span class="rank-row-mark">${r.mark}</span>`;
      block.appendChild(row);
    }
    wrap.appendChild(block);
  }
}

/* --------------------------------- api --------------------------------- */

export function initRankScreen(callbacks) {
  cbs = callbacks;
  $('rank-close')?.addEventListener('click', () => cbs?.onClose?.());
  return { open: openRank, close: closeRank };
}

export function openRank() {
  if (open) return false;
  const root = $('rank');
  if (!root) return false;
  open = true;
  root.classList.remove('hidden');
  render();
  return true;
}

export function closeRank() {
  if (!open) return false;
  open = false;
  $('rank')?.classList.add('hidden');
  return true;
}

export function isRankOpen() {
  return open;
}

/** K / Esc close; while open no other key falls through. */
export function rankHandleKey(code) {
  if (!open) return false;
  if (code === 'KeyK' || code === 'Escape') {
    closeRank();
    cbs?.onClose?.();
    return true;
  }
  return true;
}

export function rankScreenSnapshot() {
  const acts = ladder(cbs?.data?.());
  const rows = acts.flatMap((a) => a.rungs);
  const next = rows.find((r) => r.mark === '→ NEXT');
  return {
    open,
    visible: !$('rank')?.classList.contains('hidden'),
    rows: rows.length,
    ranks: rows.map((r) => r.rank),
    cleared: rows.filter((r) => r.mark === '✓').length,
    nextRank: next?.rank ?? null,
    nextId: next?.id ?? null,
    acts: acts.map((a) => ({ n: a.n, title: a.title, done: a.done, total: a.total })),
    bossRow: rows.find((r) => r.cls === 'boss')?.id ?? null,
  };
}
