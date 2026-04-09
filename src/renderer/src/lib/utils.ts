import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 타임스탬프를 상대 시간 문자열로 변환 (예: "3분 전", "2시간 전")
 * string/number 타임스탬프 모두 지원
 */
export function formatTimeAgo(timestamp: string | number): string {
  if (!timestamp) return '';
  const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}
