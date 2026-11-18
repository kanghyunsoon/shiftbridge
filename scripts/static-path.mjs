import path from 'node:path';
import { FIELDS } from '../src/data/csv.js';

const inputs = new Set(Object.keys(FIELDS).map(name => `input_data/${name}.csv`));
export function isAllowedStaticPath(root, filename) {
  const relative = path.relative(root, filename);
  if (!relative || path.isAbsolute(relative) || relative.split(path.sep).includes('..')) return false;
  const name = relative.split(path.sep).join('/');
  return name === 'index.html' || inputs.has(name) || /^src\/.+\.(js|css)$/.test(name);
}
export function resolveStaticPath(root, requestUrl) {
  try {
    const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
    if (pathname.includes('\\') || pathname.split('/').includes('..')) return null;
    const filename = path.resolve(root, pathname.replace(/^\/+/, '') || 'index.html');
    return isAllowedStaticPath(root, filename) ? filename : null;
  } catch { return null; }
}
