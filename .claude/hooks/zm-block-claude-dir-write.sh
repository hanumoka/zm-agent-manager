#!/bin/bash
# ~/.claude/ 내 사용자 세션 데이터 쓰기 차단
# PreToolUse 훅: Edit, Write 도구가 세션 데이터 경로를 대상으로 하면 차단
#
# 차단 대상: ~/.claude/projects/, ~/.claude/history.jsonl, ~/.claude/stats-cache.json
# 허용 대상: ~/.claude/plans/, ~/.claude/settings.json, ~/.claude/skills/, ~/.claude/agents/ 등 Claude Code 설정

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -n "$FILE_PATH" ]; then
  EXPANDED_HOME=$(eval echo "~")
  CLAUDE_HOME="${EXPANDED_HOME}/.claude"

  # ~/.claude/ 경로인 경우에만 검사
  if echo "$FILE_PATH" | grep -q "^${CLAUDE_HOME}/"; then
    # 자동 메모리 디렉토리는 허용 (~/.claude/projects/*/memory/)
    if echo "$FILE_PATH" | grep -qE "^${CLAUDE_HOME}/projects/[^/]+/memory/"; then
      exit 0
    fi
    # 사용자 세션 데이터 경로 차단
    if echo "$FILE_PATH" | grep -qE "^${CLAUDE_HOME}/(projects/|history\.jsonl|stats-cache\.json)"; then
      echo "차단: 사용자의 Claude 세션 데이터는 읽기 전용입니다. (${FILE_PATH})" >&2
      exit 2
    fi
    # 그 외 ~/.claude/ 경로 (plans, settings, skills 등)는 허용
  fi
fi

exit 0
