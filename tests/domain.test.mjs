import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseDataset, FIELDS } from '../src/data/csv.js';
import { buildHandover, buildSummary, uniqueRows, HISTORY_LIMIT } from '../src/domain/handover.js';
import { classifyNote } from '../src/domain/notes.js';
import { parseKst, formatKst, latestShift, recent } from '../src/domain/time.js';
import { renderDetail, renderDashboard } from '../src/view/render.js';

const T = '2026-10-26 08:00:00';
const source = (row, kind, line = 2) => ({ ...row, _sources: [{ file: kind + '.csv', line }] });
const event = (override = {}) => source({ event_id: 'E1', equipment_id: 'EQ-1', alarm_instance_id: 'A1', alarm_code: 'HIGH1', event_type: 'RAISED', occurred_at: '2026-10-26 07:00:00', received_at: '2026-10-26 07:01:00', detail: '발생', ...override }, 'alarm_events');
const lot = (override = {}) => source({ lot_id: 'L1', revision: '1', equipment_id: 'EQ-1', started_at: '2026-10-26 05:00:00', ended_at: '', status: 'IN_PROGRESS', input_qty: '100', good_qty: '20', reject_qty: '0', hold_qty: '', updated_at: '2026-10-26 07:00:00', ...override }, 'lot_snapshots');
const note = (override = {}) => source({ note_id: 'N1', created_at: '2026-10-26 07:30:00', equipment_id: 'EQ-1', lot_id: 'L1', author: 'operator', note: '장비 상태 추이 확인 요청', ...override }, 'operator_notes');
function data(overrides = {}) {
  return { equipment: [source({ equipment_id: 'EQ-1', area: 'A', equipment_name: 'TOOL', location: 'L' }, 'equipment'), source({ equipment_id: 'EQ-2', area: 'A', equipment_name: 'TOOL2', location: 'L' }, 'equipment')], alarm_catalog: [source({ alarm_code: 'HIGH1', display_name: '심각 알람', severity: 'HIGH' }, 'alarm_catalog'), source({ alarm_code: 'LOW1', display_name: '낮음 알람', severity: 'LOW' }, 'alarm_catalog')], alarm_events: [], lot_snapshots: [], operator_notes: [], inputIssues: [], ...overrides };
}
const run = (d, t = T) => buildHandover(d, t);
const clear = override => event({ event_id: 'E2', event_type: 'CLEARED', occurred_at: '2026-10-26 07:30:00', received_at: '2026-10-26 07:31:00', detail: '해제', ...override });
const realFiles = Object.fromEntries(await Promise.all(Object.keys(FIELDS).map(async k => [k + '.csv', await readFile(new URL('../input_data/' + k + '.csv', import.meta.url), 'utf8')])));
const realData = parseDataset(realFiles);

test('AC-001: source values and duplicate locations survive without mutating input', () => {
  const a = event(), b = { ...a, _sources: [{ file: 'alarm_events.csv', line: 9 }] };
  const before = JSON.stringify([a, b]);
  const records = uniqueRows([a, b]);
  assert.equal(records.length, 1); assert.equal(records[0]._sources.length, 2); assert.equal(JSON.stringify([a, b]), before);
});
test('AC-002: most recent shift is KST and changes exactly at boundary', () => {
  assert.equal(latestShift(parseKst('2026-10-26 07:59:59')), '2026-10-25 20:00:00');
  assert.equal(latestShift(parseKst(T)), T);
  assert.equal(latestShift(parseKst('2026-10-26 20:00:00')), '2026-10-26 20:00:00');
  assert.equal(parseKst('2026-02-30 08:00:00'), NaN); assert.equal(formatKst(parseKst(T)), T);
});
test('AC-003: late clear is not used in historical evidence or summary', () => {
  const d = data({ alarm_events: [event(), clear({ received_at: '2026-10-26 08:01:00' })] });
  const r = run(d); assert.equal(r.alarms.length, 1); assert.ok(!JSON.stringify(r.alarms[0].evidence).includes('E2'));
  assert.ok(!buildSummary(r).includes('E2'));
});
test('AC-004/005: only available revisions and first snapshots are visible', () => {
  const d = data({ lot_snapshots: [lot(), lot({ revision: '2', updated_at: '2026-10-26 08:10:00', hold_qty: '4' }), lot({ lot_id: 'FUTURE', updated_at: '2026-10-26 09:00:00' })] });
  assert.equal(run(d).allLots.length, 1); assert.equal(run(d).lots[0].revision, 1);
});
test('AC-006: old unresolved alarms/progress/hold survive 24h period', () => {
  const r = run(data({ alarm_events: [event({ occurred_at: '2026-10-19 10:00:00', received_at: '2026-10-19 10:01:00' })], lot_snapshots: [lot({ updated_at: '2026-10-24 07:00:00', started_at: '2026-10-24 05:00:00' })] }));
  assert.equal(r.alarms.length, 1); assert.equal(r.lots.length, 1);
});
test('AC-007: event and snapshot row order cannot change business states', () => {
  const d = data({ alarm_events: [event(), clear()], lot_snapshots: [lot(), lot({ revision: '2', hold_qty: '5' })] });
  const a = run(d), b = run({ ...d, alarm_events: [...d.alarm_events].reverse(), lot_snapshots: [...d.lot_snapshots].reverse() });
  assert.deepEqual(a.stats, b.stats); assert.deepEqual(a.allLots, b.allLots);
});
test('AC-008: real CSV complete duplicates do not add events or LOT snapshots', () => {
  assert.equal(uniqueRows(realData.alarm_events).length, 1445);
  assert.equal(uniqueRows(realData.lot_snapshots).length, 518);
});
test('AC-009: conflicting event ID poisons involved instance instead of choosing clear', () => {
  const r = run(data({ alarm_events: [event(), clear({ event_id: 'E1' })] }));
  assert.equal(r.alarms.length, 0); assert.equal(r.resolvedAlarms.length, 0); assert.equal(r.uncertainAlarms.length, 1);
});
test('AC-010: recurrence counts instances, not retransmissions, without severity promotion', () => {
  const a = event({ alarm_code: 'LOW1' });
  const r = run(data({ alarm_events: [a, a, event({ event_id: 'E3', alarm_instance_id: 'A2', alarm_code: 'LOW1' })] }));
  assert.equal(r.alarms.length, 2); assert.equal(r.alarms[0].recurrence.count, 2); assert.equal(r.alarms[0].severity, 'LOW');
});
test('AC-011: heartbeat does not create unknown alarms and valid clear resolves', () => {
  const r = run(data({ alarm_events: [event(), clear(), event({ event_id: 'H1', event_type: 'HEARTBEAT', alarm_instance_id: '', alarm_code: '' })] }));
  assert.equal(r.alarms.length, 0); assert.equal(r.uncertainAlarms.length, 0); assert.equal(r.resolvedAlarms.length, 1);
});
test('AC-012: orphan, equal timestamps, missing instance, inverted chronology are uncertain', () => {
  for (const events of [[clear()], [event(), clear({ occurred_at: '2026-10-26 07:00:00' })], [event({ alarm_instance_id: '' })], [event(), clear({ occurred_at: '2026-10-26 06:00:00' })]]) {
    const r = run(data({ alarm_events: events })); assert.equal(r.alarms.length, 0); assert.equal(r.uncertainAlarms.length, 1);
  }
});
test('AC-013: severity precedes duration and durations order same severity', () => {
  const r = run(data({ alarm_events: [event({ event_id: 'EL', alarm_instance_id: 'LOW', alarm_code: 'LOW1', occurred_at: '2026-10-25 20:00:00', received_at: '2026-10-25 20:01:00' }), event({ event_id: 'EH1', alarm_instance_id: 'H1', occurred_at: '2026-10-26 07:50:00', received_at: '2026-10-26 07:51:00' }), event({ event_id: 'EH2', alarm_instance_id: 'H2' })] }));
  assert.deepEqual(r.alarms.map(a => a.instanceId), ['H2', 'H1', 'LOW']);
});
test('AC-014: related LOT remains relationship evidence, not damage', () => {
  const r = run(data({ alarm_events: [event()], lot_snapshots: [lot({ hold_qty: '5' })] }));
  assert.equal(r.alarms[0].linkedLots.length, 1); assert.equal(r.alarms[0].severity, 'HIGH');
});
test('AC-015: conflicting top revision and highest error cannot fall back', () => {
  const conflict = run(data({ lot_snapshots: [lot(), lot({ revision: '2', hold_qty: '2' }), lot({ revision: '2', hold_qty: '3' })] }));
  assert.equal(conflict.lots.length, 0); assert.equal(conflict.allLots[0].status, 'UNKNOWN');
  const bad = run(data({ lot_snapshots: [lot(), lot({ revision: '2', good_qty: '115' })] }));
  assert.equal(bad.lots[0].revision, 2); assert.ok(bad.lots[0].issues.some(s => s.includes('양품')));
});
test('AC-016: progress, COMPLETE hold, COMPLETE zero, CANCELLED null differ', () => {
  const r = run(data({ lot_snapshots: [lot({ lot_id: 'P' }), lot({ lot_id: 'H', status: 'COMPLETE', hold_qty: '4' }), lot({ lot_id: 'C', status: 'COMPLETE', hold_qty: '0' }), lot({ lot_id: 'X', status: 'CANCELLED' })] }));
  assert.deepEqual(new Set(r.lots.map(l => l.lotId)), new Set(['P', 'H']));
  assert.equal(r.allLots.find(l => l.lotId === 'X').holdQty, null);
});
test('AC-017: obvious good>input is quality issue but arbitrary sum inequality is not', () => {
  const r = run(data({ lot_snapshots: [lot({ lot_id: 'BAD', status: 'COMPLETE', hold_qty: '0', good_qty: '115' }), lot({ lot_id: 'SUM', status: 'COMPLETE', hold_qty: '0', good_qty: '50' })] }));
  assert.ok(r.quality.some(q => q.target === 'BAD')); assert.ok(!r.quality.some(q => q.target === 'SUM'));
});
test('AC-018: mismatched equipment preserves both records but cannot introduce LOT', () => {
  const r = run(data({ lot_snapshots: [lot({ status: 'COMPLETE', hold_qty: '0' })], operator_notes: [note({ equipment_id: 'EQ-2' })] }));
  assert.equal(r.lots.length, 0); assert.equal(r.notes[0].relationship, '연결 관계 확인 필요');
  assert.equal(r.quality.find(q => q.kind === '현장 메모 확인').evidence.length, 2);
});
test('AC-019: recent approved request and observation each introduce completed zero-hold LOT', () => {
  for (const text of ['현장 확인 요청 접수', '장비 상태 추이 확인 요청']) {
    const r = run(data({ lot_snapshots: [lot({ status: 'COMPLETE', hold_qty: '0' })], operator_notes: [note({ note: text })] }));
    assert.equal(r.lots.length, 1); assert.equal(r.lots[0].followupWork, '있음');
  }
});
test('AC-020: old note remains accessible for active LOT but cannot reactivate complete LOT', () => {
  const n = note({ created_at: '2026-10-24 23:00:00' });
  const active = run(data({ lot_snapshots: [lot()], operator_notes: [n] }));
  assert.equal(active.recentNotes.length, 0); assert.equal(active.lots[0].linkedNotes.length, 1); assert.match(renderDetail(active, 'note', active.allNotes[0].key), /장비 상태/);
  assert.match(buildSummary(active, 'full'), /과거 관련 근거 \/ 지속 관찰 \/ 장비 상태 추이 확인 요청 \/ 확인: 장비 상태 변화 추이 \/.*완료 미확정 \/ 설비 일치/);
  assert.equal(run(data({ lot_snapshots: [lot({ status: 'COMPLETE', hold_qty: '0' })], operator_notes: [n] })).lots.length, 0);
});
test('AC-021/022: all 90 real notes have approved classifications; completion is never inferred', () => {
  const counts = {};
  for (const n of realData.operator_notes) { const c = classifyNote(n.note); counts[c.classification] = (counts[c.classification] || 0) + 1; assert.equal(c.completion, '미확정'); }
  assert.deepEqual(counts, { '후속 확인': 53, '지속 관찰': 23, '참고 정보': 4, '분류 확인 필요': 10 });
});
test('AC-023: quality does not hide independent progress handover', () => {
  const r = run(data({ lot_snapshots: [lot({ good_qty: '115' })] }));
  assert.equal(r.lots.length, 1); assert.ok(r.quality.some(q => q.key === r.lots[0].key));
});
test('AC-024: lower 24h boundary excluded, next second and cutoff included', () => {
  const t = parseKst(T); assert.equal(recent(t - 86400000, t), false); assert.equal(recent(t - 86400000 + 1000, t), true); assert.equal(recent(t, t), true);
  const r = run(data({ operator_notes: [note({ note_id: 'OLD', created_at: '2026-10-25 08:00:00' }), note({ note_id: 'IN', created_at: '2026-10-25 08:00:01' }), note({ note_id: 'AT', created_at: T })] }));
  assert.equal(r.recentNotes.length, 2);
});
test('AC-025: empty data retains history limitations and no plant-wide guarantee', () => { assert.ok(buildSummary(run(data())).includes(HISTORY_LIMIT)); });
test('AC-026: missing file/invalid availability produces partial result rather than normal zero guarantee', () => {
  const d = parseDataset({ 'operator_notes.csv': realFiles['operator_notes.csv'] });
  const r = run(d); assert.equal(r.partial, true); assert.equal(r.recentNotes.length, 9); assert.match(buildSummary(r), /불완전 결과/);
});
test('AC-027: summary retains cutoff, evidence, partial state and independent D06 facts', () => {
  const r = run(data({ lot_snapshots: [lot({ status: 'CANCELLED' })], operator_notes: [note()], inputIssues: [{ file: 'x.csv', line: 1, message: '누락' }] }));
  const s = buildSummary(r); for (const term of [T, 'L1@rev1', 'N1', '불완전', '보류 수량 미확인', '후속 업무 있음', '조치 완료 미확정', HISTORY_LIMIT]) assert.ok(s.includes(term), term);
});
test('AC-028: future conflict cannot poison past snapshot or event', () => {
  const base = data({ alarm_events: [event()], lot_snapshots: [lot()] });
  const future = { ...base, alarm_events: [...base.alarm_events, event({ detail: 'conflict', received_at: '2026-10-26 09:00:00' })], lot_snapshots: [...base.lot_snapshots, lot({ hold_qty: '5', updated_at: '2026-10-26 09:00:00' })] };
  assert.deepEqual(run(base).stats, run(future).stats);
});
test('AC-031/032: known ambiguous and explicit approved example are not keyword-equivalent', () => {
  assert.equal(classifyNote('정비 결과 기록 확인').classification, '분류 확인 필요');
  assert.equal(classifyNote('정기 보전 일정 확인').classification, '분류 확인 필요');
  assert.equal(classifyNote('정비 결과 확인 요청').classification, '후속 확인');
  assert.equal(classifyNote('정비 결과 확인 완료').classification, '분류 확인 필요');
});
test('AC-033: suspected missing input is a task, not proven loss', () => {
  const c = classifyNote('자료 입력 누락 의심'); assert.equal(c.classification, '후속 확인'); assert.equal(c.nextAction, '자료 누락 여부 확인 필요');
});
test('AC-034: reference note cannot introduce completed zero-hold LOT', () => {
  const r = run(data({ lot_snapshots: [lot({ status: 'COMPLETE', hold_qty: '0' })], operator_notes: [note({ note: '작업자 교대 시 특이사항 인계' })] }));
  assert.equal(r.lots.length, 0); assert.equal(r.notes[0].classification, '참고 정보'); assert.equal(r.notes[0].completion, '미확정');
});
test('AC-035: D06 CANCELLED hold-null is definite memo handover with independent unknown hold', () => {
  const r = run(data({ lot_snapshots: [lot({ status: 'CANCELLED' })], operator_notes: [note()] }));
  const l = r.lots[0]; assert.equal(l.followupWork, '있음'); assert.equal(l.holdQty, null); assert.equal(l.holdFollowup, '미확정'); assert.equal(l.completion, '미확정');
  assert.ok(!l.issues.some(s => s.includes('후속 업무 근거'))); assert.equal(l.evidence.length, 2);
});
test('AC-036: invalid available revision prevents silently reverting to older valid one', () => {
  const r = run(data({ lot_snapshots: [lot(), lot({ revision: 'broken' })] }));
  assert.equal(r.allLots[0].status, 'UNKNOWN'); assert.equal(r.lots.length, 0); assert.match(r.quality[0].reasons.join(' '), /revision/);
});
test('AC-037: missing alarm catalog cannot synthesize HIGH or LOW', () => {
  const r = run(data({ alarm_catalog: [], alarm_events: [event()], inputIssues: [{ file: 'alarm_catalog.csv', message: '누락' }] }));
  assert.equal(r.partial, true); assert.equal(r.alarms.length, 0); assert.equal(r.uncertainAlarms[0].severity, '미확인');
});
test('AC-038: hold-zero later removes hold unknown but not valid memo handover', () => {
  const d = data({ lot_snapshots: [lot({ status: 'CANCELLED' }), lot({ status: 'CANCELLED', revision: '2', hold_qty: '0', updated_at: '2026-10-26 08:10:00' })], operator_notes: [note()] });
  const before = run(d); assert.equal(before.lots[0].holdQty, null);
  const after = run(d, '2026-10-26 20:00:00'); assert.equal(after.lots.length, 1); assert.equal(after.lots[0].holdQty, 0); assert.equal(after.lots[0].followupWork, '있음'); assert.equal(after.lots[0].completion, '미확정');
});
test('AC-039: detail and summary preserve distinct D06 states and one unique LOT', () => {
  const r = run(data({ lot_snapshots: [lot({ status: 'CANCELLED' })], operator_notes: [note()] }));
  assert.equal(r.stats.handoverLots, 1); const html = renderDetail(r, 'lot', 'lot:L1');
  for (const term of ['인계 대상 확정', '메모 후속 업무 존재', '보류 관련 확인 필요성', '조치 완료 여부', '메모 연결만으로 긴급 확정 안 함']) assert.ok(html.includes(term), term);
});
test('DOM strings from CSV are escaped in list and raw evidence', () => {
  const n = note({ note: '<img src=x onerror=alert(1)>' });
  const r = run(data({ operator_notes: [n] }));
  const detail = renderDetail(r, 'note', r.notes[0].key); const ui = renderDashboard(r, { tab: 'work', equipment: '', query: '' });
  assert.ok(!detail.includes('<img')); assert.ok(detail.includes('&lt;img')); assert.ok(!ui.includes('<img'));
});
test('Real CSV: both historical shifts match independently specified baseline counts', () => {
  const before = JSON.stringify(realData);
  const a = run(realData, '2026-10-25 20:00:00'), b = run(realData);
  assert.deepEqual([a.stats.open, a.stats.high, a.stats.uncertain, a.stats.availableLots, a.stats.progress, a.stats.held, a.stats.recentNotes, a.stats.handoverLots], [43, 13, 7, 402, 53, 174, 11, 227]);
  assert.deepEqual([b.stats.open, b.stats.high, b.stats.uncertain, b.stats.availableLots, b.stats.progress, b.stats.held, b.stats.recentNotes, b.stats.handoverLots], [42, 18, 7, 431, 58, 181, 9, 239]);
  assert.equal(JSON.stringify(realData), before);
  assert.ok(b.quality.some(q => q.target === 'LOT-XBAD'));
  assert.equal(b.partial, false);
});

test('AC-040/044: compact is default, max 5 per section; full retains omitted IDs and file locations', () => {
  const r = run(realData), compact = buildSummary(r), full = buildSummary(r, 'full');
  assert.match(compact, /간결 요약/); assert.equal((compact.match(/^- /gm) || []).length, 15);
  for (const items of [r.alarms, r.workItems, r.quality]) assert.ok(compact.includes(`그 외 ${items.length - 5}건 — 전체 상세 화면에서 확인`));
  assert.ok(!compact.includes(r.alarms.at(-1).instanceId)); assert.ok(full.includes(r.alarms.at(-1).instanceId));
  for (const l of r.lots) assert.ok(full.includes(l.lotId));
  for (const q of r.quality) assert.ok(full.includes(q.target));
  for (const n of r.notes) assert.ok(full.includes(n.noteId));
  for (const file of ['alarm_events.csv:', 'lot_snapshots.csv:', 'operator_notes.csv:']) assert.ok(full.includes(file));
  assert.ok(compact.length < full.length / 5); assert.ok(compact.includes(T)); assert.ok(compact.includes(HISTORY_LIMIT));
});

test('AC-041/042: hold then progress then memo LOT then field work; oldest latest-availability wins; no duplicate LOT or memo work', () => {
  const r = run(data({
    alarm_events: [event()],
    lot_snapshots: [lot({ lot_id: 'H1', hold_qty: '5', updated_at: '2026-10-26 06:00:00' }), lot({ lot_id: 'H2', status: 'COMPLETE', hold_qty: '2', updated_at: '2026-10-26 05:30:00' }), lot({ lot_id: 'P1', hold_qty: '0', updated_at: '2026-10-26 05:10:00' }), lot({ lot_id: 'M1', status: 'COMPLETE', hold_qty: '0', updated_at: '2026-10-26 06:30:00' })],
    operator_notes: [note({ lot_id: 'M1' }), note({ note_id: 'N2', lot_id: '', created_at: '2026-10-26 06:00:00' })]
  }));
  assert.deepEqual(r.workItems.map(w => w.target), ['H2', 'H1', 'P1', 'M1', 'N2']);
  assert.deepEqual(r.workItems.map(w => w.priority), [1, 1, 2, 3, 4]);
  assert.equal(r.workItems.find(w => w.target === 'M1').availableAt, '2026-10-26 07:30:00');
  assert.equal(r.workItems.filter(w => w.kind === 'note').length, 1);
  assert.equal(r.lots.find(l => l.lotId === 'H1').handoverReasons.length, 2);
  assert.ok(r.lots.every(l => l.highAlarmIds.includes('A1')));
  assert.equal(r.stats.handoverLots, 4); assert.equal(r.stats.handoverWork, 5);
});

test('AC-043: quality taxonomy precedes newest availability and revision conflict is one confirmation item', () => {
  const r = run(data({
    alarm_events: [event(), clear({ event_id: 'E1' }), clear({ event_id: 'ORPHAN', alarm_instance_id: 'ORPHAN' }), event({ event_id: 'MSTATE', alarm_instance_id: 'MSTATE', event_type: '' })],
    lot_snapshots: [lot({ lot_id: 'BAD', status: 'COMPLETE', hold_qty: '0', good_qty: '115', updated_at: '2026-10-26 07:20:00' }), lot({ lot_id: 'MISSING1', status: 'COMPLETE', updated_at: '2026-10-26 06:00:00' }), lot({ lot_id: 'MISSING2', status: 'COMPLETE', updated_at: '2026-10-26 07:00:00' }), lot({ lot_id: 'REL', status: 'COMPLETE', hold_qty: '0' }), lot({ lot_id: 'REV', revision: '2', hold_qty: '2' }), lot({ lot_id: 'REV', revision: '2', hold_qty: '3' })],
    operator_notes: [note({ equipment_id: 'EQ-2', lot_id: 'REL' })]
  }));
  const ranks = r.quality.map(q => q.priority);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b)); assert.deepEqual(new Set(ranks), new Set([1, 2, 3, 4, 5]));
  assert.deepEqual(r.quality.filter(q => q.target.startsWith('MISSING')).map(q => q.target), ['MISSING2', 'MISSING1']);
  assert.equal(r.quality.find(q => q.target === 'MSTATE').priority, 3);
  assert.ok(!r.quality.find(q => q.target === 'MSTATE').reasons.join(' ').includes('해제만'));
  assert.equal(r.quality.filter(q => q.target === 'REV').length, 1);
  assert.equal(r.quality.find(q => q.target === 'BAD').priority, 2);
  assert.equal(r.quality.find(q => q.target === 'N1').priority, 4);
  assert.equal(r.quality.find(q => q.target === 'ORPHAN').priority, 5);
});

test('AC-045/047: compact/full share cutoff, show partial coverage, and never fill another section above five', () => {
  const r = run(data({ operator_notes: [note({ lot_id: '' })], inputIssues: [{ file: 'alarm_events.csv', line: null, message: '미확인' }] }));
  const compact = buildSummary(r), full = buildSummary(r, 'full');
  assert.equal((compact.match(/^- /gm) || []).length, 1);
  for (const s of [compact, full]) { assert.ok(s.includes(T)); assert.ok(s.includes('불완전 결과')); assert.ok(s.includes(HISTORY_LIMIT)); }
  assert.match(compact, /우선 확인 알람 — 전체 0건 \/ 표시 0건/); assert.ok(full.includes('alarm_events.csv'));
  assert.ok(!buildSummary(run(data())).includes('그 외'));
});

test('Extra underscore CSV fields remain distinct source content and are safely displayed', () => {
  const a = lot({ _annotation: 'first' }), b = lot({ _annotation: '<unsafe>' });
  assert.equal(uniqueRows([a, b]).length, 2);
  const r = run(data({ lot_snapshots: [b] }));
  const html = renderDetail(r, 'lot', r.lots[0].key);
  assert.ok(html.includes('_annotation')); assert.ok(html.includes('&lt;unsafe&gt;')); assert.ok(!html.includes('<unsafe>'));
});

test('Large revision history avoids variadic call limits while keeping the highest available version', { timeout: 30000 }, () => {
  const count = 150000;
  const rows = Array.from({ length: count }, (_, i) => ({ lot_id: 'LARGE', revision: String(i + 1), updated_at: T }));
  rows[count - 1] = lot({ lot_id: 'LARGE', revision: String(count), hold_qty: '0', status: 'COMPLETE', updated_at: T });
  const r = run(data({ lot_snapshots: rows }));
  assert.equal(r.allLots.length, 1); assert.equal(r.allLots[0].revision, count); assert.equal(r.allLots[0].status, 'COMPLETE');
});
