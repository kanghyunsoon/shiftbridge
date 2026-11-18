import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveStaticPath, isAllowedStaticPath } from './static-path.mjs';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.csv': 'text/csv' };
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT는 0~65535 범위의 정수여야 합니다.');
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const requested = resolveStaticPath(root, req.url);
    if (!requested) { res.writeHead(404).end(); return; }
    const filename = await realpath(requested);
    if (!isAllowedStaticPath(root, filename)) { res.writeHead(404).end(); return; }
    const data = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404).end('파일을 읽을 수 없습니다.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`ShiftBridge: http://127.0.0.1:${server.address().port}\n종료: Ctrl+C`));
server.on('error', err => { console.error(err.message); process.exitCode = 1; });
