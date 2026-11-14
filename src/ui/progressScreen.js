/**
 * ProgressScreen — rank, knowledge, powers, the climb (Phase 14, key T).
 *
 * Four columns, one glance:
 *   RANK          the numeral + title the ledger currently grants
 *   KNOWLEDGE     hp / atk / def banked by Requitals, against their caps
 *   STOLEN POWERS every power taken, as chips (n/44)
 *   THE CLIMB     rungs cleared, territory charted, acts fallen, the record
 *
 * The KEEP/RELEASE verdict (Phase 13) rides the head once the ladder ends.
 * Presentation only — `cbs.data()` supplies every number.
 */

import { POWERS } from '../powers/powers.js';

const $ = (id) => document.getElementById(id);

let cbs = null;
let open = false;

function statRow(label, now, max) {
  const pct = max > 0 ? Math.round((now / max) * 100) : 0;
  const full = now >= max;
  return (
    `<div class="progress-stat${full ? ' up' : ''}">` +
    `<span>${label}</span><b>${now} / ${max}</b>` +
    `<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>` +
    `</div>`
  );
}

function render() {
  const root = $('progress');
  const data = cbs?.data?.();
  if (!root || !data) return;

  const verdict = $('progress-verdict');
  if (verdict) {
    verdict.innerHTML = data.verdict
      ? `<b>${data.verdict === 'keep' ? 'KEPT' : 'RELEASED'}</b> VERDICT`
      : `<b>${data.rank ?? 0}</b> RANK`;
  }
  const how = $('progress-how');
  if (how) how.textContent = 'Knowledge deepens with every Requital — up to the archive’s cap.';

  /* ---- 1 — rank ------------------------------------------------------ */
  const rankCol = $('progress-rank');
  if (rankCol) {
    rankCol.innerHTML =
      `<div class="progress-num">${data.rank ?? 0}</div>` +
      `<div class="progress-title">${data.rankTitle ?? 'NOBODY'}</div>` +
      `<div class="progress-sub">${data.cleared ?? 0}/34 rungs cleared</div>` +
      `<div class="progress-sub">${data.charted?.territories ?? 0}/${data.charted?.territoriesTotal ?? 34} territories charted</div>`;
  }

  /* ---- 2 — knowledge ------------------------------------------------ */
  const knowCol = $('progress-knowledge');
  if (knowCol) {
    const k = data.knowledge ?? { hp: 0, atk: 0, def: 0 };
    const m = data.knowledgeMax ?? { hp: 220, atk: 30, def: 40 };
    knowCol.innerHTML =
      statRow('HP', k.hp ?? 0, m.hp) +
      statRow('ATK', k.atk ?? 0, m.atk) +
      statRow('DEF', k.def ?? 0, m.def);
  }

  /* ---- 3 — stolen powers -------------------------------------------- */
  const powCol = $('progress-powers');
  if (powCol) {
    const owned = new Set(data.powers ?? []);
    const head =
      `<div class="progress-sub">STOLEN ${owned.size}/${POWERS.length}</div>`;
    const chips = POWERS.map((p) => {
      const has = owned.has(p.id);
      return `<span class="progress-chip${has ? ' on' : ''}">${p.name}</span>`;
    }).join('');
    powCol.innerHTML = head + `<div class="progress-chips">${chips}</div>`;
  }

  /* ---- 4 — the climb ------------------------------------------------ */
  const climbCol = $('progress-climb');
  if (climbCol) {
    const acts = data.acts ?? [];
    const actLines = acts
      .map(
        (a) =>
          `<div class="progress-act${a.cleared ? ' done' : ''}">` +
          `<span>ACT ${a.roman}</span><b>${a.done}/${a.total}</b></div>`,
      )
      .join('');
    climbCol.innerHTML =
      `<div class="progress-stat"><span>Rungs</span><b>${data.cleared ?? 0}/34</b></div>` +
      `<div class="progress-stat"><span>Record</span><b>${data.kills ?? 0} down · ${data.steals ?? 0} stolen</b></div>` +
      actLines;
  }
}

/* --------------------------------- api --------------------------------- */

export function initProgressScreen(callbacks) {
  cbs = callbacks;
  $('progress-close')?.addEventListener('click', () => cbs?.onClose?.());
  return { open: openProgress, close: closeProgress };
}

export function openProgress() {
  if (open) return false;
  const root = $('progress');
  if (!root) return false;
  open = true;
  root.classList.remove('hidden');
  render();
  return true;
}

export function closeProgress() {
  if (!open) return false;
  open = false;
  $('progress')?.classList.add('hidden');
  return true;
}

export function isProgressOpen() {
  return open;
}

/** T / Esc close; while open no other key falls through. */
export function progressHandleKey(code) {
  if (!open) return false;
  if (code === 'KeyT' || code === 'Escape') {
    closeProgress();
    cbs?.onClose?.();
    return true;
  }
  return true;
}

export function progressScreenSnapshot() {
  const data = cbs?.data?.();
  const owned = new Set(data?.powers ?? []);
  return {
    open,
    visible: !$('progress')?.classList.contains('hidden'),
    rank: data?.rank ?? 0,
    rankTitle: data?.rankTitle ?? 'NOBODY',
    cleared: data?.cleared ?? 0,
    charted: data?.charted ?? null,
    knowledge: data?.knowledge ?? null,
    knowledgeMax: data?.knowledgeMax ?? null,
    powersCount: owned.size,
    powersMax: POWERS.length,
    kills: data?.kills ?? 0,
    steals: data?.steals ?? 0,
    verdict: data?.verdict ?? null,
    acts: (data?.acts ?? []).map((a) => ({ n: a.n, done: a.done, total: a.total })),
  };
}
