---
paths:
  - "src/main/**/*.ts"
---
- 파일 I/O는 메인 프로세스에서만 수행
- chokidar를 사용한 파일 감시
- IPC 핸들러 등록 시 shared/types에서 채널명 import
- ~/.claude/ 데이터 읽기 전용 (절대 수정 금지)
- JSONL 파싱은 스트리밍 방식으로 처리 (대용량 파일 대비)
- 에러 핸들링: 파일 접근 실패 시 graceful fallback
