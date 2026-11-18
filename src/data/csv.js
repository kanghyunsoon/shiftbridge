export const FIELDS = Object.freeze({
  equipment: ['equipment_id', 'area', 'equipment_name', 'location'],
  alarm_catalog: ['alarm_code', 'display_name', 'severity'],
  alarm_events: ['event_id', 'equipment_id', 'alarm_instance_id', 'alarm_code', 'event_type', 'occurred_at', 'received_at', 'detail'],
  lot_snapshots: ['lot_id', 'revision', 'equipment_id', 'started_at', 'ended_at', 'status', 'input_qty', 'good_qty', 'reject_qty', 'hold_qty', 'updated_at'],
  operator_notes: ['note_id', 'created_at', 'equipment_id', 'lot_id', 'author', 'note']
});

// CSV quoting is handled before row-width validation; physical source lines survive multiline fields.
export function parseCsv(input) {
  const text = String(input).replace(/^\uFEFF/, '');
  const rows = [], errors = [];
  let fields = [], field = '', quoted = false, afterQuote = false, bad = false, line = 1, rowLine = 1;
  function finish() {
    fields.push(field);
    if (fields.some(v => v !== '')) {
      if (bad) errors.push({ line: rowLine, message: '따옴표 형식을 읽을 수 없어 행을 제외했습니다.' });
      else rows.push({ values: fields, line: rowLine });
    }
    fields = []; field = ''; bad = false; afterQuote = false;
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else { field += ch; if (ch === '\n') line++; }
    } else if (ch === '"') {
      if (field === '' && !afterQuote) quoted = true;
      else { bad = true; field += ch; }
    } else if (ch === ',') { fields.push(field); field = ''; afterQuote = false; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      finish(); line++; rowLine = line;
    } else { if (afterQuote) bad = true; field += ch; }
  }
  if (quoted) errors.push({ line: rowLine, message: '닫히지 않은 따옴표 뒤의 기록은 읽을 수 없습니다.' });
  else finish();
  return { rows, errors };
}

export function parseDataset(files) {
  const data = { inputIssues: [] };
  for (const [kind, required] of Object.entries(FIELDS)) {
    const file = `${kind}.csv`;
    data[kind] = [];
    const input = files[file];
    if (typeof input !== 'string') {
      data.inputIssues.push({ file, line: null, message: '파일을 읽지 못했습니다. 이 범위의 상태와 건수는 확인 불가입니다.' });
      continue;
    }
    const { rows, errors } = parseCsv(input);
    data.inputIssues.push(...errors.map(e => ({ file, ...e })));
    const header = rows.shift()?.values || [];
    const missing = required.filter(k => !header.includes(k));
    if (missing.length || new Set(header).size !== header.length || header.includes('_sources')) {
      data.inputIssues.push({ file, line: 1, message: missing.length ? `필수 열 누락: ${missing.join(', ')}` : header.includes('_sources') ? '예약 열 _sources가 원본 출처 정보와 충돌하여 이 파일을 읽지 않았습니다.' : '중복된 열 이름으로 해석 불가' });
      continue;
    }
    for (const row of rows) {
      if (row.values.length !== header.length) {
        data.inputIssues.push({ file, line: row.line, message: `열 개수 불일치: ${header.length}개 필요, ${row.values.length}개 확인` });
        continue;
      }
      const record = Object.fromEntries(header.map((key, i) => [key, row.values[i]]));
      record._sources = [{ file, line: row.line }];
      data[kind].push(record);
    }
  }
  return data;
}
