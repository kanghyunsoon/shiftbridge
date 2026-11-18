import test from 'node:test';
import assert from 'node:assert/strict';
import { createInputLoader } from '../src/data/input-loader.js';

function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function observe(read) {
  const commits = [], finishes = [], errors = [];
  const loader = createInputLoader(read, { onStart() {}, onCommit(files, meta) { commits.push({ files, meta }); }, onError(error) { errors.push(error); }, onFinish(committed) { finishes.push(committed); } });
  return { loader, commits, finishes, errors };
}
test('Input race: delayed default batch cannot overwrite newer selected CSV', async () => {
  const old = deferred(); let reads = 0;
  const { loader, commits, finishes } = observe(() => ++reads <= 5 ? old.promise : Promise.resolve('fresh base'));
  const first = loader.loadDefaults();
  await loader.replaceFiles([{ name: 'operator_notes.csv', text: async () => 'selected' }]);
  old.resolve('late default'); await first;
  assert.equal(commits.length, 1); assert.equal(commits[0].files['operator_notes.csv'], 'selected');
  assert.equal(commits[0].files['equipment.csv'], 'fresh base'); assert.deepEqual(finishes, [true]);
});
test('Input race: two selections commit only the newest complete batch; other files preserved', async () => {
  const old = deferred(); const o = observe(async () => 'base'); await o.loader.loadDefaults();
  const first = o.loader.replaceFiles([{ name: 'operator_notes.csv', text: () => old.promise }]);
  await o.loader.replaceFiles([{ name: 'operator_notes.csv', text: async () => 'latest' }]);
  old.reject(new Error('old read failed')); await first;
  assert.equal(o.commits.length, 2); assert.equal(o.commits.at(-1).files['operator_notes.csv'], 'latest');
  assert.equal(o.commits.at(-1).files['equipment.csv'], 'base'); assert.equal(o.errors.length, 0); assert.deepEqual(o.finishes, [true, true]);
});
test('Unreadable CSV is null coverage without dropping the other four readable files', async () => {
  const o = observe(async name => { if (name === 'alarm_events.csv') throw new Error('denied'); return 'readable'; });
  await o.loader.loadDefaults();
  assert.equal(Object.keys(o.commits[0].files).length, 5); assert.equal(o.commits[0].files['alarm_events.csv'], null);
  assert.equal(o.commits[0].files['equipment.csv'], 'readable');
  await o.loader.replaceFiles([{ name: 'operator_notes.csv', text: async () => { throw new Error('broken'); } }]);
  assert.equal(o.commits.at(-1).files['operator_notes.csv'], null);
});
test('Unexpected commit failure reports error and always releases the active loading state', async () => {
  const errors = [], finishes = []; let failed = true;
  const loader = createInputLoader(async () => 'data', { onStart() {}, onCommit() { if (failed) throw new Error('unexpected'); }, onError(error) { errors.push(error.message); }, onFinish(ok) { finishes.push(ok); } });
  await loader.loadDefaults(); failed = false; await loader.loadDefaults();
  assert.deepEqual(errors, ['unexpected']); assert.deepEqual(finishes, [false, true]);
});
