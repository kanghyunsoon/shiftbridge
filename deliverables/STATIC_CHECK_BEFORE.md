# 정적검사 실행 결과

생성(UTC): 2026-10-26T23:39:38.057Z
검사 JavaScript 파일 13개 · 오류 6 · 경고 0

| 파일:행 | 규칙 | 결과 |
|---|---|---|
| src/app.js:37 | shiftbridge/event-error-boundary | 브라우저 이벤트는 Promise를 기다리지 않습니다. 동기 리스너에서 비동기 작업을 호출하고 catch로 실패를 처리하세요. |
| src/app.js:38 | shiftbridge/event-error-boundary | 브라우저 이벤트는 Promise를 기다리지 않습니다. 동기 리스너에서 비동기 작업을 호출하고 catch로 실패를 처리하세요. |
| src/app.js:79 | shiftbridge/event-error-boundary | 브라우저 이벤트는 Promise를 기다리지 않습니다. 동기 리스너에서 비동기 작업을 호출하고 catch로 실패를 처리하세요. |
| src/domain/handover.js:135 | shiftbridge/bounded-call-arguments | 큰 CSV 배열을 Math.max/min 인자로 펼치면 호출 스택 제한에 걸릴 수 있습니다. reduce/반복문을 사용하세요. |
| src/view/render.js:24 | no-useless-assignment | The value assigned to 'content' is not used in subsequent statements. |
| src/view/render.js:61 | no-useless-assignment | The value assigned to 'info' is not used in subsequent statements. |

## 범위와 한계

- AST 정적 규칙이며 런타임 예외나 업무 판정의 정확성을 완전히 증명하지 않습니다.
- HTML 검사는 ID 연결과 허용된 renderer 대입을 확인하며 템플릿 전체의 데이터 흐름을 증명하지 않습니다.
- 실제 CSV 시점/수치/요약 정확성은 npm test 및 별도 QA로 검증합니다.