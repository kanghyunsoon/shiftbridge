# DATA GUIDE (초기 제공 데이터 사전)

- 모든 시각은 `YYYY-MM-DD HH:MM:SS` 형식의 한국 표준시(KST)입니다.
- 파일명·필드명은 연습 환경의 가상 정의입니다.
- 행 순서가 현장에서의 발생 순서를 보장하지 않습니다.

## equipment.csv
- `equipment_id`: 설비 고유 ID
- `area`, `equipment_name`, `location`: 설비 기본 정보

## alarm_catalog.csv
- `alarm_code`: 알람 유형 코드
- `display_name`: 알람의 간략한 명칭
- `severity`: 코드에 부여된 HIGH / MEDIUM / LOW 등급

## alarm_events.csv
- `event_id`: 기록 시스템의 이벤트 식별자
- `equipment_id`: 이벤트 관련 설비
- `alarm_instance_id`: 동일 알람 발생 건을 추적하기 위한 식별자; 일부 이벤트는 비어 있음
- `alarm_code`: 유형 코드; 일부 이벤트는 비어 있음
- `event_type`: RAISED / CLEARED / HEARTBEAT
- `occurred_at`: 현장 이벤트 발생 시각
- `received_at`: 서버 수신 시각
- `detail`: 간단한 설명

## lot_snapshots.csv
- `lot_id`: 생산 묶음 식별자
- `revision`: 데이터 정정 버전
- `equipment_id`: 생산 설비
- `started_at`, `ended_at`: 생산 시작 및 종료 시각; 일부는 종료 시각 없음
- `status`: COMPLETE / IN_PROGRESS / CANCELLED
- `input_qty`, `good_qty`, `reject_qty`, `hold_qty`: 투입·양품·불량·보류 수량; 일부 값은 누락 가능
- `updated_at`: 해당 버전 데이터의 갱신 시각

## operator_notes.csv
- `note_id`: 메모 고유 ID
- `created_at`: 메모 작성 시각
- `equipment_id`: 관련 설비
- `lot_id`: 관련 LOT; 연결 대상이 없으면 비어 있음
- `author`: 작성자 ID
- `note`: 현장 텍스트 메모

**참고:** 이 문서는 데이터 타입과 의미만 설명하며, 어떤 지표를 어떻게 판정하고 무엇을 가장 먼저 보여줘야 하는지는 업무 요구사항을 확인해야 합니다.
