# Implementation Plan: ShiftBridge 브라우저 MVP

**Branch**: Git 브랜치 생성 없음 | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)
**Input**: 승인된 FR-001~042, AC-001~047, D07 요약/정렬 및 사용자 JavaScript/ArchUnit 미도입 결정.

## Summary

네이티브 JavaScript ES 모듈과 정적 HTML/CSS를 사용한다. CSV 입력·업무 판정·화면을 분리하고 모든 판정은 브라우저 메모리에서 수행한다. Node는 localhost 정적 파일 제공과 내장 테스트 실행에만 사용한다.

## Technical Context

**Language/Version**: 브라우저 JavaScript ES modules, Node.js24.18.0(설치 환경), 개발 검사 포함 Node22.13 이상.
**Primary Dependencies**: 앱 외부 런타임 의존성 없음. 정적검사 개발 의존성 ESLint10.13.0/@eslint/js10.0.1/globals17.13.0을 lockfile로 고정. ArchUnit은 Java 대상이라 도입하지 않는다.
**Storage**: 제공 CSV 읽기와 메모리 결과만 사용. DB/영구 업무 상태 없음.
**Testing**: `npm run check`: ESLint/프로젝트 AST·모듈 순환·HTML ID 정적검사와 node:test65개. 실제 CSV 회귀, 입력 경합/오류/복사 거부 모의실험, 실제 HTTP, D07 브라우저 증거를 구분한다.
**Target Platform**: Windows의 현대 Chromium 브라우저와 로컬 Node.
**Project Type**: 정적 로컬 웹 도구.
**Performance Goals**: 제공된 데이터 규모에서 첫5분 판단을 지원. 임의 응답시간 SLA를 추가하지 않음.
**Constraints**: 원본 불변, KST, 시점 필터 우선, 부분 입력 경고, 외부 전송 없음.
**Scale/Scope**: CSV5개, 설비10개, 이벤트1480행, LOT533행, 메모90행.

## Constitution Check

초기/설계 후 점검: T가 명시적 입력인 순수 판정, 원본 위치 보존, 상태 축 독립, 합성 예외 검증, 데이터 미전송/미수정으로 충족한다. 신규 업무 기준이나 미결 판정은 없다. 정식 비준일 메타데이터는 구현 규칙에 영향을 주지 않는다.

## Project Structure

```text
index.html
src/app.js
src/style.css
src/data/csv.js
src/domain/time.js
src/domain/notes.js
src/domain/handover.js
src/view/render.js
scripts/serve.mjs
tests/domain.test.mjs
tests/csv.test.mjs
package.json
RUN.md
DECISIONS.md
specs/001-shift-handover/{research,data-model,quickstart,tasks}.md
specs/001-shift-handover/contracts/browser.md
```

도메인은 DOM/fetch/Node API와 현재 시각 직접 조회에 의존하지 않는다. 데이터 계층은 CSV구조를 읽으며 업무 상태를 확정하지 않는다. 화면은 판정 결과를 표시하며 원본을 수정하지 않는다. Node 서버는 localhost에 바인딩하고 프로젝트의 허용 정적 경로만 읽는다.

2026-10-27 보강: 입력 데이터 계층의 input-loader는 주입된 읽기 함수와 세대 번호로 가장 최근 요청만 원자적으로 반영한다. DOM/network API를 직접 쓰지 않는다. 계산 실패는 이전 결과/요약을 제거하고 복사 완료 안내도 요청 세대가 같은 경우에만 반영한다. 정적 서버는 정규화 경로와 realpath의 허용 범위를 확인한다. 업무 기준/요약 내용은 변경하지 않는다.

## Implementation Phases

D07 변경: 도메인에 동일T 통합 업무와 품질 정렬 메타데이터를 추가한다. 기본 간결(5+5+5)/전체 상세 요약의 입력 결과를 공유하고 UI에 모드 선택·각 모드 복사를 제공한다. 원본 위치·독립 상태·기존 고유LOT 수를 보존하고 새 통합 업무 수와 구분한다. 구현자 브라우저5단계 증거를 남기되 최종 현장 승인은 관리자에게 남긴다.

입력/시간 → 알람/LOT/메모 판정 → UI/근거/복사 → 도메인/실제데이터 검증 → 실제 화면 확인 및 문서화.
원본 오류·모호성 처리는 정상/위험 추론 없이 확인 항목으로 남긴다. 외부 서비스나 추가 서버 업무 API를 도입하지 않는다.

## Complexity Tracking

원칙 위반이나 추가 프로젝트 없음. 구현 승인은 이번 사용자 요청이며 이전 문서 전용 상태를 대체한다.
