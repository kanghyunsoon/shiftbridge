# ShiftBridge — 생산운영팀 교대 인수인계 MVP

제공된 CSV를 기준 교대 시각별로 판정해 미해결 알람, 이어받을 생산·현장 업무, 상태/데이터 확인 항목을 분리해 보여주는 로컬 브라우저 도구다. 각 항목은 원본 ID와 파일/행 근거로 확인할 수 있고, 동일 기준 시각의 요약을 복사할 수 있다.

## 실행과 검증

최신 예외 보강/정적검사 결과는 [`HARDENING_REPORT.md`](deliverables/HARDENING_REPORT.md)다. 개발 검사 도구는 `npm ci --ignore-scripts`로 설치하고 `npm run check`로 정적검사와 전체65개 테스트를 실행한다. 앱 런타임에는 외부 패키지가 필요하지 않다.

- 실행: [`deliverables/RUN.md`](deliverables/RUN.md)
- 최신 QA 및 브라우저5단계 결과: [`deliverables/D07_QA_REPORT.md`](deliverables/D07_QA_REPORT.md)
- 업무 판정과 한계: [`deliverables/DECISIONS.md`](deliverables/DECISIONS.md)
- 테스트: 프로젝트 폴더에서 `npm test`

`npm start` 실행 후 <http://127.0.0.1:4173>을 연다. Node.js 22.13 이상이 필요하다.

## 제출 자료

- [본문 5쪽 과제 PDF](submission/ShiftBridge_교대인수인계_MVP_과제.pdf)
- [핵심 화면 캡처 5장](submission/screenshots/)
- [MVP 기획서](MVP_PLAN.md) · [상세 명세](specs/001-shift-handover/spec.md)

제출 PDF와 화면은 2026-10-28에 작성했다. 기술 검증과 현장 담당자의 최종 사용성 승인은 구분한다. 전체 대화 원문과 로컬 임시 파일은 저장소에 포함하지 않는다.

## 입력 데이터

`input_data/`에는 `equipment.csv`, `alarm_catalog.csv`, `alarm_events.csv`, `lot_snapshots.csv`, `operator_notes.csv`가 있다. `DATA_GUIDE.md`에는 원본 열 정의가 있다. 제공 자료는 합성 연습 데이터이며 현장 전체 이력의 완전성을 보장하지 않는다. 앱은 원본 파일을 수정하지 않는다.

## 업무 확정사항과 이력 제한

세부 시점·알람·LOT·메모 분류 및 D06 기준은 `specs/001-shift-handover/`에 기록돼 있다. 이력 이전 상태는 확인 불가하다. LOT `updated_at`과 메모 `created_at`을 가용 시각으로 사용하는 것은 실제 수신 시각 보장이 아닌 승인된 업무상 가정이다. 확인되지 않은 정보는 정상/해결로 추정하지 않는다.

관리자가 승인한 간결 요약(영역별5건/총15건)이 기본이며 전체 상세를 별도로 조회·복사한다. 업무/품질 표시 순서도 D07을 따른다. 구현자는 실제 브라우저5단계 기능을 확인했으며, 1~2분 읽기와 현장 담당자의 최종5분 사용성 승인은 관리자 확인 대기다.
