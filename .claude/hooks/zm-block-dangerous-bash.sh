#!/bin/bash
# 위험한 Bash 명령 차단
# PreToolUse 훅: rm -rf, 프로덕션 배포 등 위험 명령 차단

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# ~/.claude/ 디렉토리에 대한 쓰기/삭제 명령 차단
EXPANDED_HOME=$(eval echo "~")
if echo "$COMMAND" | grep -qE "(rm|mv|cp|>|>>|tee)\s.*${EXPANDED_HOME}/\.claude/"; then
  echo "차단: ~/.claude/ 디렉토리에 대한 쓰기/삭제 명령은 허용되지 않습니다." >&2
  exit 2
fi

# 위험한 패턴 차단
if echo "$COMMAND" | grep -qE "rm\s+-rf\s+/|rm\s+-rf\s+~|mkfs|dd\s+if=.*of=/dev"; then
  echo "차단: 시스템에 치명적인 명령은 허용되지 않습니다." >&2
  exit 2
fi

exit 0
