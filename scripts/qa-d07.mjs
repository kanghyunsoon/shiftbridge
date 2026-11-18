// Generates review artifacts from the supplied records; never writes input_data.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FIELDS, parseDataset } from '../src/data/csv.js';
import { buildHandover, buildSummary } from '../src/domain/handover.js';

const files = {}, hashes = {};
for (const kind of Object.keys(FIELDS)) {
  const file = kind + '.csv', bytes = await readFile(new URL('../input_data/' + file, import.meta.url));
  files[file] = bytes.toString('utf8'); hashes[file] = createHash('sha256').update(bytes).digest('hex');
}
const output = new URL('../deliverables/evidence/', import.meta.url);
await mkdir(output, { recursive: true });
const snapshots = [];
for (const cutoff of ['2026-10-25 20:00:00', '2026-10-26 08:00:00', '2026-10-26 20:00:00']) {
  const result = buildHandover(parseDataset(files), cutoff), compact = buildSummary(result), full = buildSummary(result, 'full');
  const name = cutoff.replace(/[-: ]/g, '');
  await writeFile(new URL(`d07-${name}-compact.txt`, output), compact);
  await writeFile(new URL(`d07-${name}-full.txt`, output), full);
  snapshots.push({ cutoff, stats: result.stats, quality: result.quality.length,
    compact: { characters: compact.length, bytes: Buffer.byteLength(compact), itemCount: (compact.match(/^- /gm) || []).length }, fullCharacters: full.length,
    alarmTop5: result.alarms.slice(0, 5).map(a => ({ id: a.instanceId, severity: a.severity, occurredAt: a.raisedAt })),
    workTop5: result.workItems.slice(0, 5).map(w => ({ id: w.target, priority: w.priority, availableAt: w.availableAt, reasons: w.reasons, highAlarmIds: w.highAlarmIds })),
    qualityTop5: result.quality.slice(0, 5).map(q => ({ id: q.target, priority: q.priority, availableAt: q.availableAt, reasons: q.reasons })) });
}
await writeFile(new URL('d07-results.json', output), JSON.stringify({ hashes, snapshots }, null, 2));
console.log(JSON.stringify(snapshots, null, 2));
