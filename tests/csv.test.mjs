import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseDataset, FIELDS } from '../src/data/csv.js';

test('CSV: BOM·CRLF·quoted comma·escaped quote', () => {
  const { rows, errors } = parseCsv('\uFEFFid,text\r\na,"x,y"\r\nb,"say ""yes"""\r\n');
  assert.deepEqual(rows.map(r => r.values), [['id', 'text'], ['a', 'x,y'], ['b', 'say "yes"']]);
  assert.equal(errors.length, 0);
});
test('CSV: multiline field retains physical starting lines', () => {
  const { rows } = parseCsv('id,text\na,"x\ny"\nb,z\n');
  assert.equal(rows[1].values[1], 'x\ny');
  assert.deepEqual(rows.map(r => r.line), [1, 2, 4]);
});
test('CSV: unclosed quote keeps earlier readable rows and reports remainder', () => {
  const r = parseCsv('id,text\na,ok\nb,"broken');
  assert.equal(r.rows.length, 2);
  assert.equal(r.errors[0].line, 3);
});
test('CSV: malformed closing quote is excluded instead of silently repaired', () => {
  const r = parseCsv('id,text\na,"ok"bad\nb,good');
  assert.equal(r.errors.length, 1);
  assert.equal(r.rows.at(-1).values[0], 'b');
});
test('CSV: missing columns isolates one file without dropping other files', () => {
  const files = Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k + '.csv', v.join(',') + '\n']));
  files['equipment.csv'] = 'equipment_id\nEQ-1';
  const dataset = parseDataset(files);
  assert.equal(dataset.inputIssues.length, 1);
  assert.deepEqual(dataset.operator_notes, []);
  assert.match(dataset.inputIssues[0].message, /필수 열/);
});
test('CSV: wrong width excludes one row with its original line', () => {
  const d = parseDataset({ 'equipment.csv': 'equipment_id,area,equipment_name,location\nEQ-1,A,T,L\nbad,short\nEQ-2,B,U,M' });
  assert.equal(d.equipment.length, 2);
  assert.equal(d.inputIssues.find(x => x.file === 'equipment.csv').line, 3);
  assert.equal(d.equipment[1]._sources[0].line, 4);
});
test('CSV: duplicate headers cannot create an ambiguous record', () => {
  const d = parseDataset({ 'equipment.csv': 'equipment_id,area,equipment_name,location,area\nx,A,T,L,B' });
  assert.equal(d.equipment.length, 0);
  assert.match(d.inputIssues.find(x => x.file === 'equipment.csv').message, /중복/);
});
test('CSV: reserved provenance header cannot overwrite the original source positions', () => {
  const d = parseDataset({ 'equipment.csv': 'equipment_id,area,equipment_name,location,_sources\nEQ-1,A,T,L,fake' });
  assert.equal(d.equipment.length, 0);
  assert.match(d.inputIssues.find(x => x.file === 'equipment.csv').message, /예약 열 _sources/);
});
