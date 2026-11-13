/** Plain ESM mirror of progress.ts for the Node server / npm test (no build step). */
export function effectiveCompleted(wikiSyncCompleted, manualAdd, manualRemove) {
  const s = new Set((wikiSyncCompleted || []).map(String));
  for (const id of manualAdd || []) s.add(String(id));
  for (const id of manualRemove || []) s.delete(String(id));
  return s;
}

export function toggleCompleted(id, wikiSyncCompleted, manualAdd, manualRemove) {
  id = String(id);
  const done = effectiveCompleted(wikiSyncCompleted, manualAdd, manualRemove).has(id);
  const sync = new Set((wikiSyncCompleted || []).map(String));
  let add = (manualAdd || []).map(String).filter(x => x !== id);
  let remove = (manualRemove || []).map(String).filter(x => x !== id);
  if (done) {
    if (sync.has(id)) remove = [...remove, id];
  } else if (!sync.has(id)) {
    add = [...add, id];
  }
  return {manualAdd: add, manualRemove: remove};
}

export function selfCheck() {
  const assert = (c, m) => { if (!c) throw Error(m); };
  const sample = effectiveCompleted(['1', '2'], ['3'], ['2']);
  assert(sample.has('1') && !sample.has('2') && sample.has('3'), 'merge');
  assert(toggleCompleted('1', ['1'], [], []).manualRemove.includes('1'), 'override off');
  assert(toggleCompleted('9', [], [], []).manualAdd.includes('9'), 'manual on');
  assert(!toggleCompleted('1', ['1'], [], ['1']).manualRemove.includes('1'), 'restore synced');
  assert(!toggleCompleted('9', [], ['9'], []).manualAdd.includes('9'), 'manual off');
  return true;
}
