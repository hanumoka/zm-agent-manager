#!/bin/bash
# ~/.claude/ 디렉토리에 대한 쓰기 작업 차단
# PreToolUse 훅: Edit, Write 도구가 ~/.claude/ 경로를 대상으로 하면 차단

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -n "$FILE_PATH" ]; then
  # ~/.claude/ 경로에 대한 쓰기 시도 감지 (프로젝트 .claude/ 제외)
  EXPANDED_HOME=$(eval echo "~")
  if echo "$FILE_PATH" | grep -q "^${EXPANDED_HOME}/\.claude/"; then
    echo "차단: ~/.claude/ 디렉토리는 읽기 전용입니다. 사용자의 Claude 데이터를 수정할 수 없습니다." >&2
    exit 2
  fi
fi

exit 0
