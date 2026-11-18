import test from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import { fileURLToPath } from 'node:url';
import plugin from '../scripts/static-rules.mjs';

function check(code, rule, filename = 'src/app.js') {
  return new Linter().verify(code, [{ files: ['**/*.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module' }, plugins: { shiftbridge: plugin }, rules: { [`shiftbridge/${rule}`]: 'error' } }], { filename: fileURLToPath(new URL('../' + filename, import.meta.url)) });
}
test('Static guard: domain boundary catches wrong imports and accepts domain helpers', () => {
  assert.equal(check("import x from '../view/render.js';", 'layer-boundaries', 'src/domain/example.js')[0].ruleId, 'shiftbridge/layer-boundaries');
  assert.equal(check("import x from './time.js';", 'layer-boundaries', 'src/domain/example.js').length, 0);
  assert.equal(check("import x from 'node:fs';", 'layer-boundaries', 'src/data/example.js').length, 1);
});
test('Static guard: implicit clocks rejected; explicit timestamps accepted', () => {
  assert.equal(check('Date.now(); new Date();', 'explicit-clock').length, 2);
  assert.equal(check('new Date(cutoff);', 'explicit-clock').length, 0);
});
test('Static guard: HTML sinks verify imported renderer, not a similarly named function', () => {
  assert.equal(check('el.innerHTML = csv.note;', 'trusted-html').length, 1);
  assert.equal(check('function renderDetail(x) { return x; } el.innerHTML = renderDetail(csv.note);', 'trusted-html').length, 1);
  assert.equal(check("import { renderDetail as draw } from './view/render.js'; el.innerHTML = draw(result);", 'trusted-html').length, 0);
  assert.equal(check("el.innerHTML = ''; el.textContent = csv.note;", 'trusted-html').length, 0);
});
test('Static guard: large variadic extrema rejected; bounded iteration accepted', () => {
  assert.equal(check('Math.max(...rows);', 'bounded-call-arguments').length, 1);
  assert.equal(check('rows.reduce((a,b) => Math.max(a,b), 0);', 'bounded-call-arguments').length, 0);
});
test('Static guard: asynchronous events need explicit rejection boundaries', () => {
  assert.equal(check("async function load() {} el.addEventListener('click', load);", 'event-error-boundary').length, 1);
  assert.equal(check("el.addEventListener('click', async () => load());", 'event-error-boundary').length, 1);
  assert.equal(check("el.addEventListener('click', () => load().catch(report));", 'event-error-boundary').length, 0);
});
