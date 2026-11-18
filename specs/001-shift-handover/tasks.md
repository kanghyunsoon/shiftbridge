# Tasks: ShiftBridge

전제: AGENTS/기획/명세/plan 및 담당 상세를 읽는다. 사용자 개발 승인, JavaScript/ArchUnit 미도입 결정 반영. 실행 결과는 [`deliverables/QA_REPORT.md`](../../deliverables/QA_REPORT.md).

## Phase 1: Setup
- [x] T001 package.json·scripts/serve.mjs에 외부의존성없는 실행/테스트/localhost정적서버 구성.

## Phase 2: Foundational
- [x] T002 src/data/csv.js에 BOM/따옴표/멀티라인/행출처/필수열/부분오류 처리와 tests/csv.test.mjs 검증 (FR-001/002/033).
- [x] T003 src/domain/time.js에 KST파싱·교대기본값·가용시점·24시간하한제외 구현 (FR-003~006/034).

## Phase 3: US1 우선 알람
- [x] T004 [US1] src/domain/handover.js에 중복/사건/충돌/HEARTBEAT/지속시간/재발/심각도순 구현 (FR-007~015).
- [x] T005 [US1] tests/domain.test.mjs에 지연해제·행순서·이벤트충돌·고아해제·동시전환·재발·실제CSV 대조 추가.

## Phase 4: US2 생산·현장
- [x] T006 [US2] src/domain/notes.js에 입력12종+승인예시E01·4분류·확인사항·미등록처리 구현 (FR-023~027).
- [x] T007 [US2] src/domain/handover.js에 가용최고revision·NULL·인계사유·관계·오래된근거·D06독립상태 구현 (FR-016~027).
- [x] T008 [US2] tests/domain.test.mjs에 정정/충돌/NULL/수량오류/분류/관계/D06/보류0유지·실제CSV 대조 추가.

## Phase 5: US3 품질·근거
- [x] T009 [US3] index.html·src/style.css·src/view/render.js에 업무/품질구분·원본상세·부분결과·상태축독립표시 구현 (FR-022/028~029/031~034).
- [x] T010 [US3] src/app.js에 CSV읽기·과거교대·필터/검색·안전문자표시·재조회일관성 구현.

## Phase 6: US4 요약
- [x] T011 [US4] src/domain/handover.js·src/app.js·src/view/render.js에 동일T 요약·근거ID·한계·복사성공/실패 처리 (FR-030~031/033). 과거 관련 메모 필드는 QA 누락 발견 후 보완했다.

## Final: Integration
- [x] T012 tests/domain.test.mjs·tests/csv.test.mjs를 npm test로 실행하고 실패 수정 (FR-035): 43 통과.
- [x] T013 실제 브라우저에서 화면/과거교대/원본상세/복사 확인, 증거와 미확인범위를 문서에 기록. 실제 사용자 첫 5분 평가는 별도 미완료.
- [x] T014 실행/판정/QA 문서를 `deliverables/`에 작성하고 README/spec 상태를 동기화.

## Dependencies and parallel opportunities

T001→T002/T003→T004/T006/T007→T009/T010/T011→T012~T014. 사용자스토리1/2는 공유기반 이후 각각 판정 검증 가능하며 통합화면은 공유 결과를 사용한다. 모든 사용자스토리가 승인된 MVP필수범위다.

## D07 승인 후 변경 작업 (명세 선반영)

- [x] T015 FR-036~042·상세06·AC-040~047·기획/지침/결정기록을 구현 전에 동기화.
- [x] T016 순수 도메인의 통합 업무/품질 유형·가용시각 정렬·HIGH 연결을 구현.
- [x] T017 기본 간결5+5+5/잔여 안내와 전체 상세 파일위치 보존·모드별 복사 구현.
- [x] T018 새 순서/15건 제한/생략·전체 보존/부분 입력/수치 회귀 검증: 총47건 통과, 원본 독립 순서 대조3시점 일치.
- [x] T019 실제 브라우저 5단계 수행 및 화면/복사 증거를 D07_QA_REPORT.md에 기록.
- [x] T020 QA/실행/결정 문서와 최종 상태 갱신. 관리자 최종 사용성 승인은 대기 유지.

## 2026-10-27 정적검사/예외 보강

- [x] T021 ESLint/프로젝트 AST 및 모듈·ID 검사 스크립트와 CI 실패 종료코드 구성. 최초6건/최종0건 기록.
- [x] T022 입력 경합/계산실패/지연·거부 복사/큰 revision/출처 예약열/서버경로 보강 및65개 테스트 통과.
- [x] T023 세 시점 수치·두 요약 텍스트·원본5개 해시 불변 검증, HARDENING_REPORT/실행법/검사 증거 제공.
