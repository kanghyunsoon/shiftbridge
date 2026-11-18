# ShiftBridge 명세 탐색 안내

작성일: 2026-10-26. 상태: D06 관리자 답변 반영 및 변경 영향 범위 재검토 완료. 애플리케이션 구현 없음.

## 작성 방법과 공식 도구

- GitHub Spec Kit v1.2.3, 소스 commit `5ea8b1cf0a38699340a38e00d02770308997d8c0`을 프로젝트 내부 캐시에 받아 사용했다.
- Specify CLI로 기존 No.1에 Codex/PowerShell 통합을 초기화했다. 글로벌 설치와 Git 저장소/브랜치 생성은 하지 않았다.
- 설치된 speckit-constitution, speckit-specify 스킬을 읽고 공식 resolver로 템플릿을 해석했다.
- constitution은 0.1.0 초안이다. 기존 합의의 재서술이며 정식 비준일은 미기록이다.
- 하나의 사용자 기능을 `001-shift-handover`로 관리하고 업무 영역별 상세 문서로 분리했다. 각 파일을 독립 제품/기능 브랜치로 취급하지 않는다.
- `.specify/feature.json`의 feature_directory가 현재 명세를 가리킨다. prerequisite 스크립트로 경로를 확인했다.
- 명세는 what/why와 수용 기준을 정의한다. 기술 스택·코드 경로·계획·구현 태스크는 별도 단계다.

## 문서 구성

| 문서 | 역할 |
|---|---|
| spec.md | 공식 spec-template 구조의 대표 명세, 사용자 여정, FR/SC |
| requirements/01-data-and-time.md | 입력·가용 시각·이력·시점 일관성 |
| requirements/02-alarm-lifecycle.md | 사건 식별·중복·상태·정렬·재발 |
| requirements/03-lot-and-quality.md | revision·LOT 인계·NULL·수량 오류 |
| requirements/04-notes-and-relations.md | 메모 성격·기간·연결·순환 방지 |
| requirements/05-ui-and-evidence.md | 화면·상세·요약·복사·빈 상태 |
| acceptance.md | 요구사항과 실제 데이터/추가 예외의 수용 시나리오 |
| clarifications.md | 사용자 답변·미확정 결정·선택지·영향 |
| note-classification-proposal.md | 12종 문구의 승인된 4분류·확인 사항·근거. 기존 파일 경로 유지 |
| checklists/requirements.md | Spec Kit 명세 품질 점검, 구현 테스트 결과 아님 |
| validation-report.md | 기획/관리자 대화 대조·발견/수정·CSV 재검산 보고 |
| manager-questions.md | D06 관리자 확인 작업 MDQ-001·승인 답변 완료 기록 |
| validation-d06.md | D06 변경 범위만 재검토한 최신 결과, 기존 검증 재사용 |

## 읽는 순서와 변경

AGENTS.md → MVP_PLAN.md → constitution → spec.md → 담당 영역 상세 → acceptance/clarifications.
하위 상세 규칙은 대표 FR을 정밀화한다. 상충하면 임의 우선 적용하지 말고 질문한다.
확정 결정은 변경일·근거와 함께 기획/지침/spec/상세/수용 기준에 동기화한다.
문구 추천·제안 수치는 확정 규칙과 구분한다. 미답변을 승인으로 바꾸지 않는다.

## 현재 단계

- constitution: 초안 작성, 정식 비준일 미기록.
- specify: 대표/상세 명세 및 수용 시나리오에 관리자 승인 4분류를 반영했다.
- 사용자 답변: D01~D06 반영 완료. D06도 관리자 최종 답변을 반영했고 제품 업무 결정 대기는 없다. 독립적인 speckit-clarify 스킬 완료를 주장하지 않는다.
- plan/tasks/analyze/implement/converge: 수행하지 않음. 문서 상호 대조만으로 speckit-analyze 완료라고 표현하지 않는다.
- 공식 템플릿 원본과 설치 스킬은 수정하지 않았다. 기술 계획의 빈 껍데기를 완료 산출물로 만들지 않았다.

작성 검증: 대표 FR 35개·성공 기준 5개·수용 시나리오 39개, 명세 품질 16/16(기존12개 유지 + D06 관련4개 변경 검토). AGENTS.md는 83줄로 100줄 제한을 충족한다. 로컬 문서 링크와 Spec Kit feature 경로를 확인했다. 애플리케이션 실행/테스트는 수행하지 않았다.

## 재사용

Codex를 No.1에서 열면 `.agents/skills`의 Spec Kit 스킬을 사용할 수 있다.
문구 분류 및 D06 조건 조합의 승인 답변과 기대값을 동기화했다. 다음 요청 시 기술 계획을 작성할 수 있다. 현재는 계획·구현을 시작하지 않는다.
스킬 호출은 채팅에서 수행하며 PowerShell 명령으로 입력하는 것이 아니다.
이번 CLI는 `.specify-tool-cache/archive-v0/cbFur0YZ61GyW6QO/Scripts/specify.exe`에 있다.
캐시 경로는 재생성 시 바뀔 수 있으므로 제품 실행에 의존시키지 않는다.

공식 자료: [GitHub Spec Kit](https://github.com/github/spec-kit), [v1.2.3](https://github.com/github/spec-kit/releases/tag/v1.2.3), [공식 작업 절차](https://github.github.com/spec-kit/quickstart.html).
