import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolveStaticPath, isAllowedStaticPath } from '../scripts/static-path.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
test('Static server paths: allow only index, browser assets, and the five named CSV inputs', () => {
  assert.equal(resolveStaticPath(root, '/'), path.resolve(root, 'index.html'));
  assert.equal(resolveStaticPath(root, '/src/app.js?v=1'), path.resolve(root, 'src/app.js'));
  assert.equal(resolveStaticPath(root, '/input_data/alarm_events.csv'), path.resolve(root, 'input_data/alarm_events.csv'));
  assert.equal(resolveStaticPath(root, '/input_data/unexpected.csv'), null);
  assert.equal(resolveStaticPath(root, '/scripts/static-check.mjs'), null);
});
test('Static server paths: encoded traversal, backslashes, invalid encoding, and sibling roots fail closed', () => {
  for (const url of ['/src/..%2fscripts/hidden.js', '/src/%2e%2e%5cpackage.json', '/src/%2e%2e%2f%2e%2e%2fother/file.js', '/src/%ZZ.js']) assert.equal(resolveStaticPath(root, url), null, url);
  assert.equal(isAllowedStaticPath(root, path.resolve(root, '../No.10/src/app.js')), false);
  assert.equal(isAllowedStaticPath(root, path.resolve(root, 'scripts/hidden.js')), false);
});

test('Actual local HTTP server serves allowed files and rejects malformed paths and writes', async t => {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } });
  const address = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('HTTP startup timed out')), 5000);
    let output = '';
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.stdout.on('data', chunk => { output += chunk.toString(); const match = /http:\/\/127\.0\.0\.1:\d+/.exec(output); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    child.once('exit', code => { clearTimeout(timeout); if (!output.includes('http://')) reject(new Error(`HTTP server exited ${code}`)); });
  });
  assert.equal((await fetch(address + '/')).status, 200);
  assert.equal((await fetch(address + '/src/app.js')).status, 200);
  assert.equal((await fetch(address + '/input_data/unknown.csv')).status, 404);
  assert.equal((await fetch(address + '/src/%ZZ.js')).status, 404);
  assert.equal((await fetch(address + '/src/..%2fscripts/private.js')).status, 404);
  assert.equal((await fetch(address + '/', { method: 'POST' })).status, 405);
});
