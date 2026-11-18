import { parseKst, recent, duration } from './time.js';
import { classifyNote } from './notes.js';

export const HISTORY_LIMIT = '제공 이력 이전 상태는 확인 불가';
const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const signature = row => JSON.stringify(Object.keys(row).filter(k => k !== '_sources').sort().map(k => [k, row[k]]));
const compareId = (a, b) => String(a).localeCompare(String(b), 'en');
const qualityTypes = { 1: '알람 기록 충돌', 2: 'LOT 수량·버전 모순', 3: '필수값 미확인', 4: '연결 관계 불일치', 5: '기타 확인 필요' };
const availabilityOf = row => row.received_at ?? row.updated_at ?? row.created_at;
const latestAvailableAt = records => records.map(availabilityOf).filter(t => Number.isFinite(parseKst(t))).sort().at(-1) || null;
const workOrder = (a, b) => a.priority - b.priority || (a.availableAt || '9999').localeCompare(b.availableAt || '9999') || compareId(a.key, b.key);
function group(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const id = typeof key === 'function' ? key(row) : row[key];
    if (!result.has(id)) result.set(id, []);
    result.get(id).push(row);
  }
  return result;
}
export function uniqueRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = signature(row);
    const sources = row._sources || [];
    if (map.has(key)) map.get(key)._sources.push(...sources);
    else map.set(key, { ...row, _sources: [...sources] });
  }
  return [...map.values()].sort((a, b) => compareId(signature(a), signature(b)));
}
export function quantity(value) {
  if (value === '' || value == null) return null;
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
}

export function buildHandover(dataset, cutoff) {
  const T = parseKst(cutoff);
  if (!Number.isFinite(T)) throw new Error('교대 기준 시각을 KST 형식으로 입력해주세요.');
  if (!/ (08|20):00:00$/.test(cutoff)) throw new Error('교대는 08:00 또는 20:00을 선택해주세요.');
  const inputIssues = [...(dataset.inputIssues || [])];
  const quality = [];
  const addQuality = (key, kind, target, reasons, evidence = [], priority = 5) => {
    const item = { key, kind, target, reasons: [...new Set(reasons)], evidence: uniqueRows(evidence), priority, displayType: qualityTypes[priority], availableAt: latestAvailableAt(evidence) };
    quality.push(item); return item;
  };
  function available(kind, field) {
    const result = [];
    for (const row of dataset[kind] || []) {
      const time = parseKst(row[field]);
      if (!Number.isFinite(time)) {
        inputIssues.push({ file: row._sources?.[0]?.file || `${kind}.csv`, line: row._sources?.[0]?.line, message: `${field} 해석 불가. 이 기록은 특정 교대의 사실로 반영하지 않았습니다.` });
      } else if (time <= T) result.push(row);
    }
    return uniqueRows(result);
  }
  function staticMap(kind, id) {
    const result = new Map();
    for (const [key, rows] of group(uniqueRows(dataset[kind] || []), id)) {
      if (key && rows.length === 1) result.set(key, rows[0]);
      else addQuality(`${kind}:${key || 'missing'}`, '기본 정보 확인', key || '식별자 없음', ['기본 정보 식별자 누락 또는 동일 ID 충돌'], rows);
    }
    return result;
  }
  const equipment = staticMap('equipment', 'equipment_id');
  const catalog = staticMap('alarm_catalog', 'alarm_code');
  const events = available('alarm_events', 'received_at');
  const snapshots = available('lot_snapshots', 'updated_at');
  const rawNotes = available('operator_notes', 'created_at');
  const eventConflict = new Set();
  for (const [eventId, rows] of group(events, 'event_id')) {
    if (!eventId || rows.length > 1) {
      for (const row of rows) eventConflict.add(signature(row));
      addQuality(`event:${eventId || signature(rows[0])}`, '이벤트 기록 충돌', eventId || 'event_id 미확인', [eventId ? '동일 event_id의 내용이 다릅니다.' : 'event_id가 없어 이벤트를 식별할 수 없습니다.'], rows, eventId && rows.length > 1 && rows.some(r => r.event_type !== 'HEARTBEAT') ? 1 : 5);
    }
  }
  const alarms = [], resolvedAlarms = [], uncertainAlarms = [];
  const recurrenceCandidates = [];
  for (const [instanceId, rows] of group(events.filter(r => r.alarm_instance_id), 'alarm_instance_id')) {
    const transitions = rows.filter(r => r.event_type !== 'HEARTBEAT');
    if (!transitions.length) continue;
    const raised = transitions.filter(r => r.event_type === 'RAISED');
    const cleared = transitions.filter(r => r.event_type === 'CLEARED');
    const reasons = [];
    const ids = [...new Set(transitions.map(r => r.equipment_id))];
    const codes = [...new Set(transitions.map(r => r.alarm_code))];
    if (ids.length !== 1 || !ids[0] || codes.length !== 1 || !codes[0]) reasons.push('사건의 설비 또는 알람 코드가 누락·충돌합니다.');
    if (rows.some(r => eventConflict.has(signature(r)))) reasons.push('사건에 동일 event_id 충돌이 포함돼 있습니다.');
    if (raised.length !== 1) reasons.push(raised.length ? '동일 사건에 서로 다른 발생 기록이 있습니다.' : cleared.length ? '대응되는 발생 기록 없이 해제만 확인됐습니다.' : '유효한 발생 기록과 이벤트 상태를 확인할 수 없습니다.');
    if (cleared.length > 1) reasons.push('동일 사건에 서로 다른 해제 기록이 있습니다.');
    for (const row of transitions) {
      const happened = parseKst(row.occurred_at);
      if (!Number.isFinite(happened) || happened > T || happened > parseKst(row.received_at)) reasons.push('발생 시각과 수신 시각 관계를 확인할 수 없습니다.');
      if (!['RAISED', 'CLEARED'].includes(row.event_type)) reasons.push('알 수 없는 상태 전환 유형입니다.');
    }
    if (raised.length === 1 && cleared.length === 1 && parseKst(cleared[0].occurred_at) <= parseKst(raised[0].occurred_at)) reasons.push('발생·해제 시각이 같거나 해제가 먼저 발생했습니다.');
    const code = catalog.get(codes[0]);
    const severity = code?.severity;
    if (!Object.hasOwn(severityOrder, severity)) reasons.push('알람 심각도 기본 정보를 확인할 수 없습니다.');
    if (!equipment.has(ids[0])) reasons.push('설비 기본 정보를 확인할 수 없습니다.');
    const evidence = [...rows, ...(code ? [code] : []), ...(equipment.has(ids[0]) ? [equipment.get(ids[0])] : [])];
    const item = {
      key: `alarm:${instanceId}`, instanceId, equipmentId: ids.length === 1 ? ids[0] : ids.join(' / '),
      alarmCode: codes.length === 1 ? codes[0] : codes.join(' / '), displayName: code?.display_name || '알람 정보 확인 필요',
      severity: severity || '미확인', status: reasons.length ? 'UNCERTAIN' : cleared.length ? 'RESOLVED' : 'OPEN',
      raisedAt: raised.length === 1 ? raised[0].occurred_at : null,
      durationMs: raised.length === 1 && !reasons.length ? T - parseKst(raised[0].occurred_at) : null,
      reasons: reasons.length ? [...new Set(reasons)] : cleared.length ? ['대응하는 발생 이후 유효 해제 기록이 확인됐습니다.'] : ['발생 이후 기준 시각까지 유효한 해제가 확인되지 않았습니다.'],
      evidence: uniqueRows(evidence), recurrence: null, linkedLots: []
    };
    if (item.status === 'UNCERTAIN') {
      uncertainAlarms.push(item);
      const contradictory = ids.length > 1 || codes.length > 1 || rows.some(r => r.event_id && eventConflict.has(signature(r))) || raised.length > 1 || cleared.length > 1 || (raised.length === 1 && cleared.length === 1 && parseKst(cleared[0].occurred_at) <= parseKst(raised[0].occurred_at));
      addQuality(item.key, '알람 상태 확인', instanceId, item.reasons, evidence, contradictory ? 1 : transitions.some(r => !r.event_type) ? 3 : 5);
    } else {
      (item.status === 'OPEN' ? alarms : resolvedAlarms).push(item);
      if (recent(parseKst(item.raisedAt), T)) recurrenceCandidates.push(item);
    }
  }
  for (const row of events.filter(r => !r.alarm_instance_id && r.event_type !== 'HEARTBEAT')) {
    const reasons = ['alarm_instance_id가 없어 다른 사건에 임의 연결하지 않았습니다.'];
    const item = { key: `alarm-missing:${row.event_id || signature(row)}`, instanceId: '(사건 ID 없음)', equipmentId: row.equipment_id, alarmCode: row.alarm_code, displayName: '사건 식별 필요', severity: catalog.get(row.alarm_code)?.severity || '미확인', status: 'UNCERTAIN', reasons, evidence: [row], recurrence: null, linkedLots: [] };
    uncertainAlarms.push(item); addQuality(item.key, '알람 식별자 확인', row.event_id || '식별자 없음', reasons, [row]);
  }
  for (const rows of group(recurrenceCandidates, a => `${a.equipmentId}|${a.alarmCode}`).values()) {
    if (rows.length < 2) continue;
    const occurrence = { count: rows.length, lastRaisedAt: rows.map(a => a.raisedAt).sort().at(-1) };
    for (const item of [...alarms, ...resolvedAlarms]) {
      if (item.equipmentId === rows[0].equipmentId && item.alarmCode === rows[0].alarmCode) item.recurrence = occurrence;
    }
  }
  alarms.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.durationMs - a.durationMs || compareId(a.raisedAt, b.raisedAt) || compareId(a.instanceId, b.instanceId));
  const allLots = [];
  for (const [lotId, rows] of group(snapshots, 'lot_id')) {
    const badRevision = rows.some(r => !/^[1-9]\d*$/.test(r.revision) || !Number.isSafeInteger(Number(r.revision)));
    const max = rows.reduce((highest, row) => Math.max(highest, Number(row.revision)), -Infinity);
    const top = badRevision ? rows : rows.filter(r => Number(r.revision) === max);
    const conflict = !lotId || badRevision || top.length !== 1;
    if (conflict) {
      const reasons = [badRevision ? 'revision 해석 불가로 최신 상태를 확정할 수 없습니다.' : 'LOT 식별자 누락 또는 최고 동일 revision의 기록이 충돌합니다.'];
      const item = { key: `lot:${lotId || signature(rows[0])}`, lotId: lotId || '(ID 없음)', equipmentId: [...new Set(rows.map(r => r.equipment_id))].join(' / '), revision: badRevision ? '미확인' : max, status: 'UNKNOWN', conflict: true, handoverReasons: [], evidence: top, issues: reasons, holdQty: null, followupWork: '미확정', holdFollowup: '미확정', completion: '미확정', linkedNotes: [] };
      allLots.push(item); addQuality(item.key, 'LOT 버전 확인', item.lotId, reasons, top, lotId && !badRevision && top.length > 1 ? 2 : 5); continue;
    }
    const row = top[0];
    const issues = [];
    const qty = Object.fromEntries(['input_qty', 'good_qty', 'reject_qty', 'hold_qty'].map(k => [k, quantity(row[k])]));
    const start = parseKst(row.started_at), end = row.ended_at ? parseKst(row.ended_at) : null;
    const invalidTimeline = !Number.isFinite(start) || start > parseKst(row.updated_at) || (end !== null && (!Number.isFinite(end) || end < start || end > parseKst(row.updated_at)));
    const unknownState = !['COMPLETE', 'IN_PROGRESS', 'CANCELLED'].includes(row.status) || invalidTimeline || !row.equipment_id;
    if (unknownState) issues.push('LOT 상태 또는 생산/갱신 시각 관계를 확인할 수 없습니다.');
    if (!equipment.has(row.equipment_id)) issues.push('설비 기본 정보가 미확인입니다.');
    for (const [key, value] of Object.entries(qty)) {
      if (value === null || !Number.isFinite(value)) issues.push(`${key === 'hold_qty' ? '보류 수량' : key} 미확인`);
    }
    if (Number.isFinite(qty.good_qty) && Number.isFinite(qty.input_qty) && qty.good_qty > qty.input_qty) issues.push('양품 수량이 투입 수량보다 큽니다. 원본 수량을 확인해주세요.');
    const reasons = [];
    if (!unknownState && row.status === 'IN_PROGRESS') reasons.push('생산 진행 중');
    if (!unknownState && Number.isFinite(qty.hold_qty) && qty.hold_qty > 0) reasons.push(`보류 수량 ${qty.hold_qty}개`);
    allLots.push({ key: `lot:${lotId}`, lotId, equipmentId: row.equipment_id, revision: Number(row.revision), status: unknownState ? 'UNKNOWN' : row.status, conflict: unknownState, holdQty: Number.isFinite(qty.hold_qty) ? qty.hold_qty : null, quantities: qty, handoverReasons: reasons, issues, evidence: [row], linkedNotes: [], followupWork: '미확정', holdFollowup: qty.hold_qty === null || !Number.isFinite(qty.hold_qty) ? '미확정' : qty.hold_qty > 0 ? '확인 필요' : '보류 수량 없음', completion: '미확정' });
  }
  const lotMap = new Map(allLots.filter(l => l.lotId !== '(ID 없음)').map(l => [l.lotId, l]));
  const notes = [];
  for (const [noteId, rows] of group(rawNotes, 'note_id')) {
    const conflict = !noteId || rows.length !== 1;
    for (const row of rows) {
      const classified = conflict ? { classification: '분류 확인 필요', nextAction: '메모 식별자 누락·충돌을 확인해주세요.', approval: '식별자 확인 필요', actionable: false, completion: '미확정' } : classifyNote(row.note);
      const lot = lotMap.get(row.lot_id);
      const relationship = !row.lot_id ? '설비 관련 메모' : !lot || lot.conflict ? '해당 시점 LOT 정보 미확인' : lot.equipmentId !== row.equipment_id ? '연결 관계 확인 필요' : '설비 일치';
      const item = { key: `note:${noteId || signature(row)}${conflict ? ':' + signature(row) : ''}`, noteId: noteId || '(ID 없음)', equipmentId: row.equipment_id, lotId: row.lot_id, text: row.note, createdAt: row.created_at, ...classified, relationship, isRecent: recent(parseKst(row.created_at), T), evidence: [row], conflict };
      notes.push(item);
      if (lot) lot.linkedNotes.push(item);
      if (lot && !lot.conflict && item.actionable && item.isRecent && relationship === '설비 일치') {
        lot.handoverReasons.push(`메모 기반 ${item.classification}: ${item.text}`);
        lot.followupWork = '있음';
        lot.evidence.push(row);
      }
    }
  }
  for (const lot of allLots) {
    if (!lot.conflict && lot.status === 'CANCELLED' && lot.followupWork !== '있음') lot.issues.push('취소 관련 후속 업무 근거 미확인');
    lot.availableAt = latestAvailableAt(lot.evidence);
    lot.priority = lot.holdQty > 0 ? 1 : lot.status === 'IN_PROGRESS' ? 2 : 3;
    lot.highAlarmIds = alarms.filter(a => a.severity === 'HIGH' && a.equipmentId === lot.equipmentId).map(a => a.instanceId);
    if (lot.issues.length && lot.quantities) {
      const q = lot.quantities;
      const contradiction = q && Number.isFinite(q.good_qty) && Number.isFinite(q.input_qty) && q.good_qty > q.input_qty;
      const missing = q && (Object.values(q).some(v => v === null || !Number.isFinite(v)) || !['IN_PROGRESS', 'COMPLETE', 'CANCELLED'].includes(lot.evidence[0].status));
      addQuality(lot.key, 'LOT 데이터 확인', lot.lotId, lot.issues, lot.evidence, contradiction ? 2 : missing ? 3 : 5);
    }
  }
  const lots = allLots.filter(l => l.handoverReasons.length).sort(workOrder);
  const openEquipment = new Set(alarms.map(a => a.equipmentId));
  const activeLots = new Set(lots.map(l => l.lotId));
  const visibleNotes = notes.filter(n => n.isRecent || openEquipment.has(n.equipmentId) || activeLots.has(n.lotId));
  for (const note of visibleNotes) {
    const lot = lotMap.get(note.lotId);
    const reasons = [];
    if (note.relationship === '연결 관계 확인 필요' || note.relationship === '해당 시점 LOT 정보 미확인') reasons.push(note.relationship);
    if (note.classification === '분류 확인 필요') reasons.push('후속 요청 여부 확인 필요');
    if (note.conflict) reasons.push('동일 note_id 누락·충돌');
    if (reasons.length) addQuality(note.key, '현장 메모 확인', note.noteId, reasons, [...note.evidence, ...(lot?.evidence || []).filter(r => r.revision !== undefined)], note.relationship === '연결 관계 확인 필요' ? 4 : 5);
  }
  for (const alarm of [...alarms, ...resolvedAlarms, ...uncertainAlarms]) alarm.linkedLots = lots.filter(l => l.equipmentId === alarm.equipmentId);
  const sourceStats = Object.fromEntries([['alarm_events', 'received_at'], ['lot_snapshots', 'updated_at'], ['operator_notes', 'created_at']].map(([kind, field]) => {
    const rows = kind === 'alarm_events' ? events : kind === 'lot_snapshots' ? snapshots : rawNotes;
    return [kind, { available: rows.length, latest: rows.length ? rows.map(r => r[field]).sort().at(-1) : null }];
  }));
  const uniqueQuality = [...new Map(quality.map(q => [q.key + ':' + q.kind, q])).values()].sort((a, b) => a.priority - b.priority || (b.availableAt || '').localeCompare(a.availableAt || '') || compareId(a.key, b.key) || compareId(a.kind, b.kind));
  const workItems = [
    ...lots.map(l => ({ ...l, kind: 'lot', target: l.lotId, reasons: l.handoverReasons, nextAction: [l.holdQty > 0 ? '보류 수량과 처리 상태 확인' : '', l.status === 'IN_PROGRESS' ? '생산 진행 상황 확인' : '', ...l.linkedNotes.filter(n => n.isRecent && n.actionable && n.relationship === '설비 일치').map(n => n.nextAction)].filter(Boolean).join('; ') })),
    ...notes.filter(n => n.isRecent && n.actionable && !(lotMap.get(n.lotId)?.followupWork === '있음' && n.relationship === '설비 일치')).map(n => ({ ...n, kind: 'note', target: n.noteId, status: n.classification, priority: 4, availableAt: n.createdAt, reasons: [n.text], highAlarmIds: [], nextAction: n.nextAction }))
  ].sort(workOrder);
  const noteSort = (a, b) => b.createdAt.localeCompare(a.createdAt) || compareId(a.noteId, b.noteId);
  return {
    cutoff, cutoffMs: T, equipment: Object.fromEntries(equipment), alarms, resolvedAlarms, uncertainAlarms,
    lots, workItems, allLots, allNotes: notes, notes: visibleNotes.sort(noteSort), recentNotes: notes.filter(n => n.isRecent).sort(noteSort),
    quality: uniqueQuality, inputIssues, partial: inputIssues.length > 0, sourceStats,
    limitations: [HISTORY_LIMIT, 'LOT updated_at·메모 created_at은 확인 가능 시각으로 간주한 업무상 가정입니다.', '표시 건수는 제공 기록 기준이며 실제 전체 공장 상태·수집 완료를 보장하지 않습니다.'],
    stats: { open: alarms.length, high: alarms.filter(a => a.severity === 'HIGH').length, uncertain: uncertainAlarms.length, resolved: resolvedAlarms.length, availableLots: allLots.length, progress: allLots.filter(l => l.status === 'IN_PROGRESS').length, held: allLots.filter(l => l.holdQty > 0).length, handoverLots: lots.length, handoverWork: workItems.length, recentNotes: notes.filter(n => n.isRecent).length }
  };
}

const evidenceIds = records => [...new Set(records.flatMap(r => [r.event_id, r.alarm_instance_id, r.lot_id && `${r.lot_id}${r.revision ? '@rev' + r.revision : ''}`, r.note_id].filter(Boolean)))].join(', ');
const sourceLocations = records => [...new Set(records.flatMap(r => (r._sources || []).map(s => `${s.file}:${s.line}`)))].join(', ');
export function buildSummary(result, mode = 'compact') {
  return mode === 'full' ? buildFullSummary(result) : buildCompactSummary(result);
}
function buildFullSummary(result) {
  const evidenceIds = records => `${[...new Set(records.flatMap(r => [r.event_id, r.alarm_instance_id, r.lot_id && `${r.lot_id}${r.revision ? '@rev' + r.revision : ''}`, r.note_id].filter(Boolean)))].join(', ')} | 원본 ${sourceLocations(records)}`;
  const lines = [`교대 인수인계 전체 상세 · ${result.cutoff} KST`, '제공 기록에서 확인된 상태 · 표시 순서는 위험 등급이 아닙니다.', result.partial ? '불완전 결과: 일부 입력을 읽지 못했습니다. 확인 불가 범위를 0건/정상으로 보장하지 않습니다.' : '입력 파일 읽기 완료 (이력 완전성·업무 완료 보장 아님)', '', `1. 우선 확인 알람 ${result.alarms.length}건 (HIGH ${result.stats.high}건)`];
  for (const a of result.alarms) lines.push(`- ${a.equipmentId} / ${a.instanceId} / ${a.severity} / ${a.displayName} / 지속 ${duration(a.durationMs)} / ${a.reasons.join('; ')}${a.recurrence ? ` / 최근24시간 ${a.recurrence.count}회, 마지막 ${a.recurrence.lastRaisedAt}` : ''}\n  근거: ${evidenceIds(a.evidence)}`);
  lines.push('', `2. 생산·현장 인계 업무 ${result.workItems.length}건 (고유 LOT ${result.lots.length}개)`);
  for (const l of result.workItems) lines.push(`- ${l.target} / ${l.status} / ${l.reasons.join('; ')} / 다음 조: ${l.nextAction} / 가용 ${l.availableAt} / 보류 수량 ${l.kind === 'lot' ? l.holdQty ?? '미확인' : 'LOT 판정과 별개'} / 메모 후속 업무 ${l.followupWork || '있음'} / 보류 관련 확인 필요성 ${l.holdFollowup || '해당 없음'} / 조치 완료 ${l.completion} / 메모만으로 긴급 확정 안 함${l.highAlarmIds.length ? ` / 동일 설비 미해결 HIGH ${l.highAlarmIds.join(', ')} (피해 미확정)` : ''}\n  근거: ${evidenceIds(l.evidence)}`);
  lines.push('', `관련 메모 ${result.notes.length}개 (업무 건수에 중복 합산하지 않음; 최근 ${result.recentNotes.length}, 과거 ${result.notes.filter(n => !n.isRecent).length})`);
  for (const n of result.notes) lines.push(`- ${n.noteId} / ${n.isRecent ? '최근' : '과거 관련 근거'} / ${n.classification} / ${n.text} / 확인: ${n.nextAction} / 근거: ${n.approval} / 완료 미확정 / ${n.relationship}${n.lotId ? ` / 연결 LOT ${n.lotId}` : ''} / 원본: ${evidenceIds(n.evidence) || 'ID 미확인'}`);
  lines.push('', `3. 상태·데이터 확인 ${result.quality.length}개 (고유 업무 건수와 별개)`);
  for (const q of result.quality) lines.push(`- ${q.target}: ${q.reasons.join('; ')} / 근거: ${evidenceIds(q.evidence)}`);
  if (result.inputIssues.length) lines.push('', '입력 오류', ...result.inputIssues.map(i => `- ${i.file}:${i.line ?? '?'} ${i.message}`));
  lines.push('', ...result.limitations);
  return lines.join('\n');
}

function buildCompactSummary(result) {
  const oneLine = text => String(text).replace(/\s+/g, ' ').trim();
  const lines = [`교대 인수인계 간결 요약 · ${result.cutoff} KST`, '선택 교대 전체 기준 · 영역별 최대5건 · 표시 순서는 위험 등급이 아닙니다.', result.partial ? '불완전 결과: 일부 입력 미확인. 읽지 못한 범위는 0건/정상으로 판단하지 않습니다.' : '제공 기록에서 확인된 상태'];
  const sections = [
    ['우선 확인 알람', result.alarms.map(a => ({ target: `${a.equipmentId} / ${a.instanceId}`, status: `${a.severity} · 미해결 · ${duration(a.durationMs)}`, reason: a.reasons.join('; '), next: '현재 설비 상태와 해제·조치 기록 확인', evidence: a.evidence }))],
    ['생산·현장 인계', result.workItems.map(w => ({ target: w.target, status: `${w.status} · ${w.kind === 'lot' ? 'LOT 인계' : '현장 요청'} · 조치 완료 미확정`, reason: w.reasons.join('; '), next: w.nextAction, evidence: w.evidence, extra: `${w.followupWork === '있음' ? '메모 후속 업무 있음. ' : ''}${w.kind === 'note' && w.lotId ? `${w.relationship} · 참조 LOT ${w.lotId}. ` : ''}${w.highAlarmIds.length ? `동일 설비 미해결 HIGH ${w.highAlarmIds.join(', ')} (피해 미확정)` : ''}${w.kind === 'lot' && w.holdQty === null ? ' 보류 수량 미확인 · 보류 관련 확인 필요성 미확정' : ''}` }))],
    ['데이터 확인 필요', result.quality.map(q => ({ target: q.target, status: q.displayType, reason: q.reasons.join('; '), next: q.priority === 1 ? '충돌 이벤트와 발생·해제 식별/시각 대조' : q.priority === 2 ? '해당 revision의 수량·상충 원본 대조' : q.priority === 3 ? '누락 필드의 원본 값 확인' : q.priority === 4 ? '메모와 LOT의 원본 설비 관계 확인' : '미확인 기록의 원본/상태 확인', evidence: q.evidence }))]
  ];
  for (const [index, [label, items]] of sections.entries()) {
    lines.push('', `${index + 1}. ${label} — 전체 ${items.length}건 / 표시 ${Math.min(items.length, 5)}건`);
    for (const item of items.slice(0, 5)) lines.push(`- ${item.target} / ${item.status}\n  사유: ${oneLine(item.reason)}\n  다음 조: ${oneLine(item.next)}${item.extra ? `\n  관계/확인: ${item.extra}` : ''}\n  근거: ${evidenceIds(item.evidence) || sourceLocations(item.evidence) || '식별자 미확인'}`);
    if (items.length > 5) lines.push(`그 외 ${items.length - 5}건 — 전체 상세 화면에서 확인`);
    if (!items.length) lines.push('제공 기록에서 확인된 대상 없음 (전체 상태 보장 아님)');
  }
  if (result.partial) lines.push('', `입력 오류 ${result.inputIssues.length}건 — 누락/해석 불가 범위는 전체 상세 화면에서 확인`);
  lines.push('', '기타: 생략된 항목과 원본 파일/행은 전체 상세 화면 참조', ...result.limitations);
  return lines.join('\n');
}

