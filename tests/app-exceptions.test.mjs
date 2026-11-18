import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FIELDS } from '../src/data/csv.js';

const files = Object.fromEntries(await Promise.all(Object.keys(FIELDS).map(async k => [k + '.csv', await readFile(new URL('../input_data/' + k + '.csv', import.meta.url), 'utf8')])));
const flush = () => new Promise(resolve => { setImmediate(resolve); });
let instance = 0;
async function setup(t, writeText) {
  const ids = [...(await readFile(new URL('../index.html', import.meta.url), 'utf8')).matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const elements = Object.fromEntries([...ids, 'record-search'].map(id => [id, { id, value: '', textContent: '', innerHTML: '', disabled: false, open: false, selected: false, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, close() { this.open = false; }, showModal() { this.open = true; }, setAttribute() {}, focus() {}, select() { this.selected = true; } }]));
  const descriptors = Object.fromEntries(['document', 'navigator', 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: id => elements[id], querySelectorAll: () => [elements['detail-dialog'], elements['summary-dialog']], addEventListener() {} } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText } } });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async url => ({ ok: true, text: async () => files[url.split('/').at(-1)] }) });
  t.after(() => { for (const [name, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } });
  await import(new URL(`../src/app.js?exception=${++instance}`, import.meta.url)); await flush();
  return elements;
}
test('App failure: invalid cutoff clears old results, closes summaries, and disables stale export', async t => {
  const e = await setup(t, async () => {});
  assert.notEqual(e.result.innerHTML, ''); e['open-summary'].listeners.click();
  e['shift-date'].value = 'invalid'; e['apply-shift'].listeners.click();
  assert.equal(e.result.innerHTML, ''); assert.equal(e['summary-dialog'].open, false); assert.equal(e['open-summary'].disabled, true); assert.match(e.status.textContent, /교대 기준 시각/);
});
test('App failure: rejected clipboard write selects visible original and shows manual-copy fallback', async t => {
  const e = await setup(t, async () => { throw new Error('clipboard denied'); });
  e['open-summary'].listeners.click(); const original = e['summary-text'].value;
  e['copy-summary'].listeners.click(); await flush();
  assert.equal(e['summary-text'].selected, true); assert.equal(e['summary-text'].value, original); assert.match(e['copy-status'].textContent, /자동 복사에 실패.*Ctrl\+C/);
});
test('App race: delayed clipboard success cannot claim the newly switched summary was copied', async t => {
  let done; const pending = new Promise(resolve => { done = resolve; });
  const e = await setup(t, () => pending);
  e['open-summary'].listeners.click(); e['copy-summary'].listeners.click();
  e['full-summary'].listeners.click(); done(); await flush();
  assert.equal(e['copy-status'].textContent, ''); assert.match(e['summary-text'].value, /전체 상세/);
});
