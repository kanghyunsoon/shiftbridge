export const DAY = 86_400_000;
const KST = 9 * 3_600_000;

export function parseKst(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return NaN;
  const [, y, m, d, h, min, sec] = match.map(Number);
  if (m < 1 || m > 12 || h > 23 || min > 59 || sec > 59 || d < 1) return NaN;
  const utc = Date.UTC(y, m - 1, d, h, min, sec);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return NaN;
  return utc - KST;
}

export function formatKst(ms) {
  return Number.isFinite(ms) ? new Date(ms + KST).toISOString().slice(0, 19).replace('T', ' ') : '확인 불가';
}

export function latestShift(nowMs) {
  const local = formatKst(nowMs);
  const morning = parseKst(local.slice(0, 10) + ' 08:00:00');
  const evening = morning + DAY / 2;
  return formatKst(nowMs >= evening ? evening : nowMs >= morning ? morning : evening - DAY);
}

export function recent(ms, cutoff) { return ms > cutoff - DAY && ms <= cutoff; }
export function duration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '시간 미확인';
  const minutes = Math.floor(ms / 60_000);
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}
