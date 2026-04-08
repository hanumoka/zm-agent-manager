#!/bin/bash
# PostToolUse 훅: src/ 내 TypeScript 파일 수정 후 자동 lint 체크
# Edit, Write 도구 실행 후 호출됨

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# src/ 디렉토리 내 .ts/.tsx 파일만 대상
if echo "$FILE_PATH" | grep -qE "^.*/src/.*\.(ts|tsx)$"; then
  # package.json이 있고 lint 스크립트가 있는 경우에만 실행
  if [ -f "package.json" ] && grep -q '"lint"' package.json 2>/dev/null; then
    npx eslint --fix "$FILE_PATH" 2>/dev/null || true
  fi
fi

exit 0
