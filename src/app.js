import { parseDataset } from './data/csv.js';
import { createInputLoader } from './data/input-loader.js';
import { buildHandover, buildSummary } from './domain/handover.js';
import { latestShift } from './domain/time.js';
import { renderDashboard, renderDetail } from './view/render.js';

const $ = id => document.getElementById(id);
const state = { tab: 'alarms', equipment: '', query: '' };
let files = {}, result = null, busy = false, summaryMode = 'compact', copyGeneration = 0;
function setShift(value) { $('shift-date').value = value.slice(0, 10); $('shift-hour').value = value.slice(11, 13); }
function render() { if (result) $('result').innerHTML = renderDashboard(result, state); }
function closeOverlays() { copyGeneration++; $('detail-dialog').close(); $('summary-dialog').close(); }
function clearResult() { closeOverlays(); result = null; $('result').innerHTML = ''; $('open-summary').disabled = true; }
function reportFailure(error) {
  busy = false; clearResult();
  $('status').textContent = error instanceof Error ? error.message : String(error);
  $('status').className = 'status-warning';
}
function calculate() {
  if (busy) return;
  closeOverlays();
  try {
    result = buildHandover(parseDataset(files), `${$('shift-date').value} ${$('shift-hour').value}:00:00`);
    render();
    $('status').textContent = result.partial ? '일부 자료 미확인 · 아래 입력 오류와 확인 불가 범위를 확인해주세요.' : '';
    $('status').className = result.partial ? 'status-warning' : '';
    $('open-summary').disabled = false;
  } catch (error) { reportFailure(error); }
}
const inputLoader = createInputLoader(async name => {
  const response = await fetch('/input_data/' + name);
  return response.ok ? await response.text() : null;
}, {
  onStart() { busy = true; clearResult(); $('status').className = ''; $('status').textContent = 'CSV 자료를 읽고 있습니다…'; },
  onCommit(next, metadata) {
    files = next;
    $('input-hint').textContent = metadata.mode === 'default' ? '기본 input_data 자료 · 선택한 CSV는 파일별로 대체하며 서버에 업로드하지 않습니다.' : `로컬 대체: ${metadata.selected.join(', ') || '없음'}${metadata.ignored.length ? ' · 지정된 CSV 5종 외 파일은 제외했습니다.' : ''} · 업로드/저장하지 않습니다.`;
  },
  onError: reportFailure,
  onFinish(committed) { busy = false; if (committed) calculate(); }
});
$('apply-shift').addEventListener('click', calculate);
$('latest-shift').addEventListener('click', () => { setShift(latestShift(Date.now())); calculate(); });
$('reload-default').addEventListener('click', () => { inputLoader.loadDefaults().catch(reportFailure); });
$('csv-files').addEventListener('change', event => {
  const selected = Array.from(event.target.files || []);
  event.target.value = '';
  inputLoader.replaceFiles(selected).catch(reportFailure);
});
$('result').addEventListener('click', event => {
  const tab = event.target.closest('[data-tab]');
  if (tab) { state.tab = tab.dataset.tab; render(); return; }
  const detail = event.target.closest('[data-kind]');
  if (detail && result) openDetail(detail.dataset.kind, detail.dataset.key);
});
$('result').addEventListener('change', event => { if (event.target.id === 'equipment-filter') { state.equipment = event.target.value; render(); } });
$('result').addEventListener('input', event => {
  if (event.target.id !== 'record-search') return;
  const caret = event.target.selectionStart;
  state.query = event.target.value; render();
  const input = $('record-search'); input.focus(); input.setSelectionRange(caret, caret);
});
function openDetail(kind, key) { if (!result || busy) return; $('detail-content').innerHTML = renderDetail(result, kind, key); if (!$('detail-dialog').open) $('detail-dialog').showModal(); }
$('detail-content').addEventListener('click', event => { const button = event.target.closest('[data-kind]'); if (button) openDetail(button.dataset.kind, button.dataset.key); });
document.addEventListener('click', event => { const button = event.target.closest('[data-close]'); if (button) { copyGeneration++; $(button.dataset.close).close(); } });
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { copyGeneration++; dialog.close(); } } });
function showSummary(mode) {
  if (!result || busy) return;
  copyGeneration++; summaryMode = mode;
  $('summary-text').value = buildSummary(result, mode);
  $('copy-status').textContent = '';
  $('compact-summary').setAttribute('aria-pressed', String(mode === 'compact'));
  $('full-summary').setAttribute('aria-pressed', String(mode === 'full'));
  $('copy-summary').textContent = mode === 'full' ? '전체 상세 복사' : '간결 요약 복사';
  $('summary-hint').textContent = mode === 'full' ? '선택 교대 전체 상세 · 모든 인계/확인 항목과 관련 메모, 원본 파일/행을 포함합니다. 검색·설비 필터와 무관합니다.' : '선택 교대 전체 기준 · 영역별 상위5건, 총 최대15건. 나머지는 전체 상세에서 확인하세요. 검색·설비 필터와 무관합니다.';
}
$('open-summary').addEventListener('click', () => { if (!result || busy) return; showSummary('compact'); $('summary-dialog').showModal(); });
$('compact-summary').addEventListener('click', () => showSummary('compact'));
$('full-summary').addEventListener('click', () => showSummary('full'));
async function copySummary() {
  if (!result || busy || !$('summary-dialog').open) return;
  const request = ++copyGeneration, mode = summaryMode, text = $('summary-text').value;
  try {
    await navigator.clipboard.writeText(text);
    if (request === copyGeneration && $('summary-dialog').open) $('copy-status').textContent = `${mode === 'full' ? '전체 상세' : '간결 요약'} 텍스트를 복사했습니다.`;
  } catch {
    if (request !== copyGeneration || !$('summary-dialog').open) return;
    $('summary-text').focus(); $('summary-text').select();
    $('copy-status').textContent = '자동 복사에 실패했습니다. 선택된 원문을 Ctrl+C로 복사해주세요.';
  }
}
$('copy-summary').addEventListener('click', () => { copySummary().catch(reportFailure); });
setShift(latestShift(Date.now()));
inputLoader.loadDefaults().catch(reportFailure);
