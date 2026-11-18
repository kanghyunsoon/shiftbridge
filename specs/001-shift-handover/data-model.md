# 논리 데이터 모델과 제약

## Dataset

파일별 rows와 inputIssues. 각 행은 원본 문자열 필드와 `_sources: [{file,line}]`를 가진다. 공란은 원본에서 유지하고 수량 해석 때 null과0을 구분한다. 출처 위치는 원본 CSV의 물리 시작행이다. 파일/필수열 누락은 해당 파일 판정 불가 경고이며 나머지는 계속 읽는다.

## 교대 조회

`cutoff`는 KST시각 문자열, `cutoffMs`는 해석값이다. 엔진은 가용 필터 후 중복/충돌을 판정한다. 입력 검증 문제와 T에서 확인된 업무의 문제는 구분한다. 가용 시각이 파싱 안 된 기록은 T의 사실로 편입하지 않는다.

## 알람

`key, instanceId, equipmentId, alarmCode, severity, status, raisedAt, durationMs, recurrence, evidence, reasons`. 상태는 OPEN/RESOLVED/UNCERTAIN이다. HEARTBEAT만으로 사건을 만들지 않는다. 사건 내 충돌은 해제 확정 대신 불확실로 보존한다.

## LOT

`lotId, revision, status, equipmentId, holdQty, handoverReasons, followupWork, holdFollowup, completion, issues, evidence`. 최고 가용 revision을 사용하며 충돌이면 후보를 보존한다. D06은 메모 기반 인계와 업무있음을 확정하고 보류NULL/보류관련필요성미확정/완료미확정을 독립 표시한다. 보류0만으로 유효메모 사유를 지우지 않는다.

## 메모

`noteId, createdAt, classification, nextAction, approval, relationship, evidence`. 분류4개, 조치완료미확정, 관계불일치 독립. 승인된 입력12종과 명시예시E01을 사용하고 나머지는 분류확인필요로 둔다.

## 결과

`alarms, resolvedAlarms, uncertainAlarms, lots, notes, quality, equipment, sourceStats, limitations, partial`. 품질항목은 kind/key/reasons/evidence이며 업무와 중복노출돼도 고유ID를 공유한다. 요약은 같은 결과만 사용하고 원본ID·이력한계·부분결과를 포함한다.

## D07 표시 모델

`workItems`는 LOT업무 및 독립 최근 현장요청의 통합 목록이다. `kind,target,priority,availableAt,reasons,nextAction,evidence,highAlarmIds`를 사용한다. `priority`는 위험 등급이 아닌 승인된 표시 순위1~4다. `stats.handoverWork`는 통합 업무 수, `stats.handoverLots`는 고유LOT 수다. 관련 메모 원문 재표시는 새로운 업무 수가 아니다.

품질에는 `priority(1~5), displayType, availableAt`을 더하며 같은 유형의 최신 시각은 내림차순이다. 두 요약 모드는 같은 정렬된 결과를 공유하고 간결만 각5건으로 제한한다. 전체 상세는 원본파일/행도 포함한다.
