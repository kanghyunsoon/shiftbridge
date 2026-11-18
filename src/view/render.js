import { duration } from '../domain/time.js';

export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const e = escapeHtml;
const badge = (text, type = '') => `<span class="badge ${type}">${e(text)}</span>`;
const button = (kind, key, text = '근거 보기 ↗') => `<button class="source-link" data-kind="${e(kind)}" data-key="${e(key)}">${e(text)}</button>`;
const severity = s => badge(s, s === 'HIGH' ? 'high' : s === 'MEDIUM' ? 'medium' : 'low');
const empty = text => `<div class="empty"><span>◇</span><p>${e(text)}</p><small>제공 기록에서 확인 가능한 범위의 결과입니다.</small></div>`;
const tr = cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
const table = (headers, rows) => `<div class="table-scroll"><table><thead><tr>${headers.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

export function renderDashboard(result, state) {
  const equipmentOptions = Object.keys(result.equipment).sort().map(id => `<option value="${e(id)}" ${state.equipment === id ? 'selected' : ''}>${e(id)} · ${e(result.equipment[id].equipment_name)}</option>`).join('');
  const filtered = item => {
    const equipment = item.equipmentId || item.evidence?.find(r => r.equipment_id)?.equipment_id;
    return (!state.equipment || equipment === state.equipment) && (!state.query || JSON.stringify(item).toLowerCase().includes(state.query.toLowerCase()));
  };
  const alarms = result.alarms.filter(filtered);
  const work = result.workItems.filter(filtered);
  const notes = result.recentNotes.filter(filtered);
  const quality = result.quality.filter(filtered);
  const stats = result.stats;
  const inputErrors = result.inputIssues.length ? `<details class="input-errors"><summary>불완전 결과 · 입력 확인 ${result.inputIssues.length}개</summary><p>읽을 수 있는 부분만 표시합니다. 읽지 못한 범위는 0건·정상으로 판단하지 않습니다.</p>${result.inputIssues.map(i => `<p><b>${e(i.file)}:${e(i.line ?? '?')}</b> ${e(i.message)}</p>`).join('')}</details>` : '';
  let content;
  if (state.tab === 'alarms') {
    const rows = alarms.map(a => tr([
      `<div class="equipment-cell"><b>${e(a.equipmentId)}</b><small>${e(result.equipment[a.equipmentId]?.equipment_name || '설비 정보 미확인')}</small></div>`,
      `<b>${e(a.displayName)}</b><small class="subline">${e(a.alarmCode)} · ${e(a.instanceId)}</small>`,
      severity(a.severity),
      `<strong class="mono">${e(duration(a.durationMs))}</strong><small class="subline">${e(a.raisedAt)}</small>`,
      `${a.linkedLots.length ? badge(`연결 LOT ${a.linkedLots.length}`, 'neutral') : '<span class="muted">—</span>'}${a.linkedLots.some(l => l.holdQty > 0) ? badge('보류 LOT 있음', 'medium') : ''}${a.recurrence ? `<small class="subline recurrence">최근24시간 ${a.recurrence.count}회 · ${e(a.recurrence.lastRaisedAt)}</small>` : ''}`,
      button('alarm', a.key)
    ]));
    content = `<section class="panel"><div class="panel-heading"><div><h2>우선 확인 알람 <span>${alarms.length}</span></h2><p>심각도 우선 · 같은 심각도에서는 미해결 지속시간 순</p></div><span class="legend"><i></i> HIGH 미해결 ${stats.high}건</span></div>${rows.length ? table(['설비', '미해결 알람', '심각도', '미해결 지속시간', '연결 정보', '원본 근거'], rows) : empty('확인된 미해결 알람이 없습니다. 입력 범위와 상태 확인 목록도 확인해주세요.')}</section><div class="bottom-note">ⓘ 해결 확인된 알람 ${stats.resolved}건은 이 목록에서 제외했습니다. 재발 표시는 위험 등급을 올리지 않으며, 연결 LOT는 생산 피해가 확인됐다는 뜻이 아닙니다.</div>`;
  } else if (state.tab === 'work') {
    const rows = work.map(w => tr([
      `<b>${e(w.target)}</b><small class="subline">${e(w.equipmentId)}${w.kind === 'lot' ? ' · revision ' + e(w.revision) : ' · 현장 요청'}</small>`,
      `${badge(w.status, w.status === 'IN_PROGRESS' ? 'teal' : 'neutral')}${badge(['', '1 · 보류 LOT', '2 · 진행 LOT', '3 · 메모 LOT', '4 · 현장 업무'][w.priority], 'neutral')}`,
      `${w.reasons.map(r => `<div class="reason">${e(r)}</div>`).join('')}<small class="subline">다음 조: ${e(w.nextAction)}</small>${w.kind === 'lot' && w.issues.length ? badge('데이터 확인 병행', 'medium') : ''}${w.highAlarmIds.length ? `<small class="subline warning-text">동일 설비 미해결 HIGH: ${e(w.highAlarmIds.join(', '))} · 피해 미확정</small>` : ''}`,
      w.kind === 'note' ? '<span class="muted">해당 없음</span>' : w.holdQty === null ? badge('미확인', 'medium') : `<b class="mono">${e(w.holdQty)}</b>`,
      `<small>${e(w.availableAt)}</small>${button(w.kind, w.key)}`
    ]));
    content = `<div class="work-grid"><section class="panel"><div class="panel-heading"><div><h2>생산·현장 인계 <span>${work.length}</span></h2><p>보류→진행→메모 LOT→현장 요청 · 같은 순위는 최신 확인 가능 시각이 이른 순 · 표시 순서는 위험 등급이 아닙니다. 고유 LOT ${result.lots.length}개.</p></div></div>${rows.length ? table(['대상 / 설비', '상태 / 표시 순위', '인계 사유 / 다음 조 확인', '보류 수량', '최신 확인 가능 시각 / 근거'], rows) : empty('조건에 맞는 생산·현장 인계가 없습니다.')}</section><section class="panel note-panel"><div class="panel-heading"><div><h2>최근 현장 메모 <span>${notes.length}</span></h2><p>최근24시간 · 조치 완료 여부 미확정 · 관련 메모 재표시는 새 업무로 합산하지 않습니다.</p></div></div><div class="notes">${notes.length ? notes.map(n => `<article class="note-card">${badge(n.classification, n.classification === '분류 확인 필요' ? 'medium' : n.classification === '참고 정보' ? 'neutral' : 'teal')}<small>${e(n.equipmentId)} ${n.lotId ? '· ' + e(n.lotId) : ''}</small><h3>${e(n.text)}</h3><p>확인: ${e(n.nextAction)}</p>${n.relationship !== '설비 일치' && n.lotId ? `<p class="warning-text">${e(n.relationship)}</p>` : ''}<div class="note-bottom"><time>${e(n.createdAt)}</time>${button('note', n.key)}</div></article>`).join('') : empty('최근24시간의 메모가 없습니다.')}</div></section></div>`;
  } else {
    const rows = quality.map(q => tr([`${badge(q.displayType, 'medium')}<small class="subline">${e(q.kind)}</small>`, `<b>${e(q.target)}</b>`, q.reasons.map(r => `<div class="reason">${e(r)}</div>`).join(''), `${e(q.availableAt || '가용 시각 미확인')}<br>${button('quality', q.key + ':' + q.kind)}`]));
    content = `<section class="panel"><div class="panel-heading"><div><h2>상태·데이터 확인 <span>${quality.length}</span></h2><p>실제 조치 업무와 구분한 기록 확인 항목입니다. 확인 항목 수는 고유 LOT·알람 건수와 다릅니다.</p></div></div>${rows.length ? table(['확인 유형', '대상', '확인이 필요한 이유', '원본 근거'], rows) : empty('확인된 데이터 문제가 없습니다. 전체 공장 상태의 정상 보장은 아닙니다.')}</section>`;
  }
  return `${inputErrors}<div class="context-strip"><span><b>${e(result.cutoff)}</b> KST 기준</span><span>${result.partial ? '일부 입력 미확인 · 부분 결과' : '제공 기록에서 확인된 상태'}</span></div><section class="metrics" aria-label="제공 기록 기준 요약"><article><span>미해결 알람</span><strong>${stats.open}<small>건 확인</small></strong><p>${badge('HIGH ' + stats.high, 'high')} 심각도 우선 확인</p></article><article><span>인계 생산 LOT</span><strong>${stats.handoverLots}<small>개 확인</small></strong><p>진행 ${stats.progress} · 보류 수량 존재 ${stats.held}</p></article><article><span>최근 현장 메모</span><strong>${stats.recentNotes}<small>개 확인</small></strong><p>최근24시간 · 하한 시각 제외</p></article><article class="quality-metric"><span>상태·데이터 확인</span><strong>${result.quality.length}<small>개 항목</small></strong><p>알람 상태 미확정 ${stats.uncertain}건 포함</p></article></section><div class="history-banner"><span class="info-icon">i</span><div><b>제공 이력 이전 상태는 확인 불가</b><span>표시 수치는 전체 공장의 실제 건수나 수집 완료를 보장하지 않습니다.</span></div><details><summary>기록 범위</summary>${Object.entries(result.sourceStats).map(([kind, x]) => `<p>${e(kind)}<br><b>${e(x.latest || '가용 기록 없음')}</b> KST</p>`).join('')}<p>LOT/메모 시각은 확인 가능 시각으로 간주한 업무상 가정입니다.</p></details></div><section class="list-controls"><div class="tabs" role="tablist" aria-label="인수인계 영역">${[['alarms', '우선 확인 알람', stats.open], ['work', '생산·현장 업무', stats.handoverWork], ['quality', '상태·데이터 확인', result.quality.length]].map(([key, label, count]) => `<button role="tab" aria-selected="${state.tab === key}" data-tab="${key}" class="${state.tab === key ? 'selected' : ''}">${label}<span>${count}</span></button>`).join('')}</div><div class="filters"><select id="equipment-filter" aria-label="설비 필터"><option value="">모든 설비</option>${equipmentOptions}</select><input id="record-search" type="search" placeholder="설비, LOT, 메모 검색" aria-label="기록 검색" value="${e(state.query)}"></div></section>${content}`;
}

function rawEvidence(records) {
  const seen = new Set();
  return records.filter(row => { const key = JSON.stringify(row); if (seen.has(key)) return false; seen.add(key); return true; }).map(row => `<details class="evidence-record" open><summary>${e(row.event_id || row.note_id || (row.lot_id ? row.lot_id + ' / revision ' + row.revision : row.equipment_id || row.alarm_code || '원본 기록'))}<small>${(row._sources || []).map(s => `${e(s.file)}:${e(s.line)}`).join(' · ')}</small></summary><dl>${Object.entries(row).filter(([key]) => key !== '_sources').map(([key, value]) => `<div><dt>${e(key)}</dt><dd>${value === '' ? '<span class="muted">공란 (0으로 대체하지 않음)</span>' : e(value)}</dd></div>`).join('')}</dl></details>`).join('');
}

export function renderDetail(result, kind, key) {
  const collections = { alarm: [...result.alarms, ...result.uncertainAlarms, ...result.resolvedAlarms], lot: result.allLots, note: result.allNotes, quality: result.quality };
  const item = collections[kind]?.find(x => kind === 'quality' ? x.key + ':' + x.kind === key : x.key === key);
  if (!item) return empty('선택한 교대에서 이 항목을 찾을 수 없습니다.');
  const title = item.instanceId || item.lotId || item.noteId || item.target;
  let info, related = '';
  if (kind === 'alarm') {
    info = `<h3>${e(item.equipmentId)} · ${e(item.displayName)}</h3>${severity(item.severity)} ${badge(item.status === 'OPEN' ? '미해결' : item.status === 'RESOLVED' ? '해결 확인' : '상태 미확정', 'neutral')}<p>${e(item.reasons.join(' '))}</p><p>확인할 내용: ${item.status === 'OPEN' ? '현재 설비 상태와 해제·조치 기록을 확인해주세요.' : '발생·해제 원본과 사건의 식별 관계를 확인해주세요.'}</p>${item.raisedAt ? `<p>발생 ${e(item.raisedAt)} · 지속 ${e(duration(item.durationMs))}</p>` : ''}${item.recurrence ? `<p>최근24시간 별개 발생 ${item.recurrence.count}회 · 마지막 ${e(item.recurrence.lastRaisedAt)}</p>` : ''}`;
    related = `<h3>동일 설비의 인계 LOT (피해 확정 아님)</h3><div class="related-list">${item.linkedLots.map(l => button('lot', l.key, `${l.lotId} · ${l.status}`)).join('') || '<p class="muted">연결된 인계 LOT 없음</p>'}</div>`;
    const notes = result.notes.filter(n => n.equipmentId === item.equipmentId);
    related += `<h3>동일 설비 관련 메모 (특정 알람과 인과관계 미확정)</h3>${notes.map(n => `<div class="related-note">${button('note', n.key, n.noteId)} ${e(n.text)} <small>${e(n.createdAt)} · ${e(n.classification)}</small></div>`).join('') || '<p class="muted">관련 메모 없음</p>'}`;
  } else if (kind === 'lot') {
    info = `${badge(item.status, 'neutral')} ${badge(item.handoverReasons.length ? '인계 대상 확정' : '데이터/후속 확인', 'teal')}<h3>${e(item.equipmentId)} · revision ${e(item.revision)}</h3><p>${e(item.handoverReasons.join(' / ') || '확정된 업무 사유 없음. 원본 상태를 확인해주세요.')}</p><dl class="state-grid"><div><dt>메모 후속 업무 존재</dt><dd>${e(item.followupWork)}</dd></div><div><dt>보류 수량</dt><dd>${e(item.holdQty ?? '미확인')}</dd></div><div><dt>보류 관련 확인 필요성</dt><dd>${e(item.holdFollowup)}</dd></div><div><dt>조치 완료 여부</dt><dd>미확정</dd></div><div><dt>긴급도</dt><dd>메모 연결만으로 긴급 확정 안 함</dd></div></dl>${item.issues.map(i => `<p class="warning-text">${e(i)}</p>`).join('')}`;
    related = `<h3>직접 연결된 메모 · 오래된 메모 포함</h3>${item.linkedNotes.map(n => `<div class="related-note">${button('note', n.key, n.noteId)} ${e(n.text)}<small>${e(n.classification)} · ${e(n.relationship)} · ${e(n.createdAt)}</small><p>다음 조 확인: ${e(n.nextAction)} · 조치 완료 미확정</p></div>`).join('') || '<p class="muted">직접 연결된 메모 없음</p>'}`;
  } else if (kind === 'note') {
    info = `${badge(item.classification, 'teal')}<h3>${e(item.text)}</h3><p>다음 조 확인 사항: ${e(item.nextAction)}</p><p>분류 근거: ${e(item.approval)}</p><p>조치 완료 여부: 미확정</p><p>메모 설비 ${e(item.equipmentId)} · 연결 LOT ${e(item.lotId || '없음')}</p><p class="warning-text">${e(item.relationship)}</p>`;
    const lot = result.allLots.find(l => l.lotId === item.lotId);
    if (lot) related = `<h3>당시 확인 가능한 LOT 정보</h3><p>LOT 설비 ${e(lot.equipmentId)} · ${e(lot.status)}</p>${button('lot', lot.key, 'LOT 상태와 원본 확인 ↗')}`;
  } else {
    info = `${badge(item.kind, 'medium')}<h3>확인 사유</h3>${item.reasons.map(r => `<p>${e(r)}</p>`).join('')}<p>확인할 내용: 아래 원본의 식별자·시각·수량·연결 관계를 대조해주세요. 데이터 확인은 긴급 생산 문제 판정이 아닙니다.</p>`;
    const lot = result.allLots.find(l => l.key === item.key);
    if (lot) related = button('lot', lot.key, '동일 LOT의 인계 여부와 독립 상태 확인 ↗');
  }
  return `<div class="detail-body"><div class="eyebrow">${e(result.cutoff)} KST · 당시 가용 근거</div><h2>${e(title)}</h2>${info}${related}<h3 class="source-heading">판단에 사용한 원본 기록 <span>${item.evidence.length}</span></h3>${rawEvidence(item.evidence)}<p class="detail-limit">제공 이력 이전 상태는 확인 불가 · ${result.partial ? '불완전 입력 결과' : '제공 기록 기준'}</p></div>`;
}
