<!-- Sync Impact Report
Version: 0.1.0 -> 0.1.1 (draft; obsolete request-scope wording corrected to latest authorization)
Principles: temporal accuracy, uncertainty, provenance, human decisions, bounded MVP.
Added: scope constraints; specification quality gates; governance.
Removed: unused example placeholders. Runtime templates are unchanged.
TODO(RATIFICATION_DATE): formal constitution ratification is not recorded.
-->
# ShiftBridge Constitution

## Core Principles

### I. 교대 시점 정확성
모든 결과는 선택한 KST 교대 시각 T까지 확인 가능했던 원본만으로 계산해야 한다(MUST).
알람 received_at, LOT updated_at, 메모 created_at으로 먼저 가용성을 제한해야 한다.
미래 상세·충돌·정정 버전으로 과거 결과를 바꾸면 안 된다(MUST NOT).
최근 24시간은 재발·메모 표시 범위이며 전체 상태 복원 기간이 아니다.

### II. 불확실성 보존
부족하거나 충돌하는 기록을 정상·해결·긴급·실제 피해로 임의 확정하면 안 된다.
NULL을 0으로, 최신 수량 오류를 과거 정상 버전으로 바꾸면 안 된다.
업무 인계와 상태/데이터 확인을 구분하고 서로 함께 존재할 수 있음을 보존해야 한다.
양품+불량+보류=투입량이라는 미확정 정의로 오류를 만들면 안 된다.

### III. 원본과 판단의 추적성
모든 표시 항목은 인계 사유, 현재 확인할 사항, 사용한 원본을 제공해야 한다.
파일·원본 위치·식별자·revision과 메모/LOT 각각의 설비를 보존해야 한다.
원본 CSV를 수정하거나 없는 이력을 생성하면 안 된다.
화면과 복사 요약에 제공 이력 이전 상태를 확인할 수 없음을 명시해야 한다.

### IV. 사람의 결정과 명세의 구분
확정 요구, 구현 제안, 가정, 미확정 결정을 구분해야 한다.
사용자가 판단을 요청한 모호한 업무 규칙을 작성자가 대신 확정하면 안 된다.
미답변은 승인으로 간주하지 않는다. 관련 요구와 수용 기준을 대기 상태로 남긴다.
업무 결정은 사용자 답변을 근거로 명세·기획·지침·검증에 함께 반영해야 한다.

### V. 범위와 검증
제공 CSV를 사용하는 로컬 브라우저 MVP와 텍스트 요약 복사로 범위를 제한해야 한다.
시점·중복·충돌·정정·누락·관계·원본 조회를 검증해야 한다.
구현 완료와 명세 검토 완료를 구분해야 한다. 실제 동작 검증 전 구현 완료로 표시하면 안 된다.
2시간은 구현 목표이며 정확성 검증을 생략할 근거가 아니다.

## Scope Constraints
설비 제어, 예측, 위험 점수, DB, 로그인, 다중 사용자, 실시간 연동, 외부 AI 의미 판정,
업무 완료 이력, 원본 자동 보정, 복잡한 통계, 문서 다운로드는 이번 MVP에서 제외한다.
작업 범위는 최신 사용자 승인에 따른다. 현재 브라우저 MVP 구현·QA와 승인된 D07 개선을 진행한다.
최신 사용자 요청이 문서·도구·기본 템플릿의 관행보다 우선한다.

## Specification Workflow and Quality Gates
AGENTS.md와 MVP_PLAN.md를 읽고 현재 feature의 spec.md와 관련 상세 명세를 확인한다.
Spec Kit의 specify 산출물에 요구 ID·Given/When/Then·성공 기준을 남긴다.
clarification에 답변이 없는 동안 관련 규칙을 확정하거나 plan/tasks/implement 완료를 선언하지 않는다.
명세 체크리스트는 문서 품질을 확인하며 구현 테스트 성공을 의미하지 않는다.
기술 스택과 실행 명령은 plan 단계에서 검토하며 이번 명세에 임의 고정하지 않는다.

## Governance
이 문서는 승인된 업무 원칙의 Spec Kit 초안 표현이다. 신규 업무 정책을 승인한 문서가 아니다.
변경은 근거와 영향 요구 ID를 기록하고 최신 사용자 결정에 맞춰 동기화해야 한다.
버전은 의미 변경 시 MAJOR, 원칙 추가 시 MINOR, 의미 불변 문구 정정 시 PATCH로 관리한다.
첫 초안은 0.1.0이다. 정식 비준일은 미확정이며 문서 작성일과 혼동하지 않는다.
원칙 준수 여부를 명세 작성·계획·작업 분해·구현·검증 단계에서 재확인해야 한다.
개별 미확정 결정은 feature의 clarifications.md에서 추적한다.

**Version**: 0.1.1 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2026-10-26
