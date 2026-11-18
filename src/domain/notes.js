const definitions = [
  ['출하 일정 영향 여부 확인', '후속 확인', '실제 출하 영향 발생 여부'],
  ['현장 확인 요청 접수', '후속 확인', '요청 처리 상태'],
  ['상태 변화가 반복되어 추적 필요', '지속 관찰', '상태 변화와 재발 여부'],
  ['이전 보고 내용과 수치 비교 요청', '후속 확인', '이전 보고서와 현재 수치 차이'],
  ['장비 상태 추이 확인 요청', '지속 관찰', '장비 상태 변화 추이'],
  ['추가 관찰 중, 확정 전', '지속 관찰', '관찰 결과와 최종 판단 여부'],
  ['작업자 교대 시 특이사항 인계', '참고 정보', '관련 미해결 알람·인계 LOT의 참고 내용'],
  ['정비 결과 기록 확인', '분류 확인 필요', '후속 요청인지 과거 확인 기록인지 확인'],
  ['지표 변동 원인 추가 확인 필요', '후속 확인', '지표 변동 원인'],
  ['담당자 부재로 확인 대기', '후속 확인', '대기 중인 확인 업무의 처리 상태'],
  ['자료 입력 누락 의심', '후속 확인', '자료 누락 여부 확인 필요'],
  ['정기 보전 일정 확인', '분류 확인 필요', '일정 확인 요청인지 과거 기록인지 확인'],
  ['정비 결과 확인 요청', '후속 확인', '정비 결과 확인']
];
const catalog = new Map(definitions.map(([text, classification, nextAction]) => [text, { classification, nextAction }]));

export function classifyNote(text) {
  const entry = catalog.get(text);
  return entry ? { ...entry, approval: '생산운영팀 승인 문구', actionable: ['후속 확인', '지속 관찰'].includes(entry.classification), completion: '미확정' }
    : { classification: '분류 확인 필요', nextAction: '후속 요청 여부 확인 필요', approval: '미등록 문구: 원문 의미 확인 필요', actionable: false, completion: '미확정' };
}
