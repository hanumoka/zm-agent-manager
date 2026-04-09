import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { stat } from 'fs/promises';
import type { JsonlRecord, ParsedSession, ContentBlock } from '@shared/types';

/**
 * JSONL 라인을 파싱하여 타입이 지정된 레코드로 변환.
 * 잘못된 JSON 라인은 null을 반환하여 스킵.
 */
function parseLine(line: string): JsonlRecord | null {
  if (!line.trim()) return null;

  try {
    const raw = JSON.parse(line) as Record<string, unknown>;
    const type = raw.type as string;

    if (!type) return null;

    // 알려진 레코드 타입만 반환
    switch (type) {
      case 'user':
      case 'assistant':
      case 'system':
      case 'file-history-snapshot':
      case 'permission-mode':
        return raw as unknown as JsonlRecord;
      default:
        // attachment, queue-operation 등은 일단 스킵
        return null;
    }
  } catch {
    // 잘못된 JSON 라인 스킵
    return null;
  }
}

/**
 * assistant 메시지에서 tool_use 블록 수를 카운트
 */
function countToolCalls(content: ContentBlock[]): number {
  return content.filter((block) => block.type === 'tool_use').length;
}

/**
 * 타임스탬프를 밀리초 숫자로 변환
 */
function toTimestampMs(ts: string | number | undefined): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  return new Date(ts).getTime();
}

/**
 * JSONL 파일을 스트리밍 파싱하여 ParsedSession으로 반환.
 * 대용량 파일(100MB+)도 메모리 효율적으로 처리.
 */
export async function parseJsonlFile(filePath: string): Promise<ParsedSession> {
  // 파일 존재 및 크기 확인
  const fileStat = await stat(filePath);
  const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') ?? '';

  const records: JsonlRecord[] = [];
  let messageCount = 0;
  let toolCallCount = 0;
  let lastActivity = 0;

  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  // 대용량 파일 경고 (100MB 이상)
  if (fileStat.size > 100 * 1024 * 1024) {
    console.warn(
      `[jsonl-parser] 대용량 파일 감지: ${filePath} (${Math.round(fileStat.size / 1024 / 1024)}MB)`
    );
  }

  for await (const line of rl) {
    const record = parseLine(line);
    if (!record) continue;

    records.push(record);

    // 통계 수집
    if (record.type === 'user' || record.type === 'assistant') {
      messageCount++;

      const ts = toTimestampMs(record.timestamp);
      if (ts > lastActivity) lastActivity = ts;
    }

    if (record.type === 'assistant' && record.message?.content) {
      toolCallCount += countToolCalls(record.message.content);
    }
  }

  return {
    sessionId,
    records,
    messageCount,
    toolCallCount,
    lastActivity,
  };
}

/**
 * JSONL 파일의 마지막 N줄만 파싱 (대용량 파일 빠른 미리보기용).
 * 전체 파일을 읽되 마지막 N개 레코드만 유지.
 */
export async function parseJsonlTail(
  filePath: string,
  maxRecords: number = 100
): Promise<JsonlRecord[]> {
  const records: JsonlRecord[] = [];

  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const record = parseLine(line);
    if (!record) continue;
    records.push(record);
  }

  // 마지막 N개만 반환
  return records.slice(-maxRecords);
}
