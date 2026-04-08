---
paths:
  - "src/shared/**/*.ts"
---
- 메인/렌더러 양쪽에서 사용하는 타입과 유틸만 배치
- IPC 채널명은 상수로 정의하여 타입 안전성 확보
- Node.js/Electron 특정 API에 의존하지 않는 순수 타입/유틸만 포함
- JSONL 레코드 타입 정의: file-history-snapshot, user, assistant
