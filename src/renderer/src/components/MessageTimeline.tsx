import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import ReactMarkdown from 'react-markdown';
import { User, Bot, Wrench, Brain } from 'lucide-react';
import type { JsonlRecord, ContentBlock, ToolUseBlock } from '@shared/types';

function formatTimestamp(ts: string | number): string {
  const date = typeof ts === 'string' ? new Date(ts) : new Date(ts);
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ToolCallBadge({ block }: { block: ToolUseBlock }): React.JSX.Element {
  return (
    <div className="my-1 flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-xs">
      <Wrench className="h-3 w-3 text-accent-orange" />
      <span className="font-mono font-medium text-accent-orange">{block.name}</span>
      {block.input && 'file_path' in block.input && (
        <span className="text-muted-foreground truncate max-w-[300px]">
          {String(block.input.file_path)}
        </span>
      )}
      {block.input && 'command' in block.input && (
        <span className="text-muted-foreground truncate max-w-[300px] font-mono">
          {String(block.input.command).slice(0, 80)}
        </span>
      )}
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }): React.JSX.Element {
  return (
    <details className="my-1">
      <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Brain className="h-3 w-3" />
        thinking ({text.length}자)
      </summary>
      <div className="mt-1 rounded-md bg-secondary p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
        {text.slice(0, 500)}
        {text.length > 500 && '...'}
      </div>
    </details>
  );
}

function ContentBlocks({ blocks }: { blocks: ContentBlock[] }): React.JSX.Element {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'text':
            return (
              <div key={i} className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{block.text}</ReactMarkdown>
              </div>
            );
          case 'thinking':
            return <ThinkingBlock key={i} text={block.thinking} />;
          case 'tool_use':
            return <ToolCallBadge key={i} block={block} />;
          case 'tool_result':
            return null; // tool_result는 user 메시지로 표시되므로 스킵
          default:
            return null;
        }
      })}
    </>
  );
}

function MessageRow({ record }: { record: JsonlRecord }): React.JSX.Element | null {
  if (record.type === 'user') {
    const content = record.message.content;
    // tool_result 메시지는 스킵 (도구 응답)
    if (typeof content !== 'string' && Array.isArray(content)) {
      if (content.length > 0 && content[0].type === 'tool_result') return null;
    }

    const text = typeof content === 'string' ? content : '';

    return (
      <div className="flex gap-3 px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-primary">User</span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(record.timestamp)}
            </span>
          </div>
          {text ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          ) : (
            Array.isArray(content) && <ContentBlocks blocks={content as ContentBlock[]} />
          )}
        </div>
      </div>
    );
  }

  if (record.type === 'assistant') {
    return (
      <div className="flex gap-3 bg-card/50 px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-green/20">
          <Bot className="h-4 w-4 text-accent-green" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-accent-green">Assistant</span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(record.timestamp)}
            </span>
            {record.slug && (
              <span className="text-xs text-muted-foreground font-mono">{record.slug}</span>
            )}
          </div>
          <ContentBlocks blocks={record.message.content} />
        </div>
      </div>
    );
  }

  return null;
}

interface MessageTimelineProps {
  records: JsonlRecord[];
}

export function MessageTimeline({ records }: MessageTimelineProps): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);

  // user/assistant 레코드만 필터링
  const messages = records.filter((r) => r.type === 'user' || r.type === 'assistant');

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  // 새 메시지 추가 시 하단 스크롤
  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    }
  }, [messages.length, virtualizer]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        메시지가 없습니다
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full border-b border-border/50"
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            <MessageRow record={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
