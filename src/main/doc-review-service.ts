import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { DocReview } from '@shared/types';

const DEFAULT_REVIEWS_DIR = join(homedir(), '.zm-agent-manager', 'doc-reviews');

export interface DocReviewOptions {
  reviewsDir?: string;
}

function resolveFile(docPath: string, options: DocReviewOptions): string {
  const dir = options.reviewsDir ?? DEFAULT_REVIEWS_DIR;
  // 경로의 / → _ 치환으로 파일명 안전
  const safeId = docPath.replace(/[/\\:]/g, '_');
  return join(dir, `${safeId}.json`);
}

/** 문서 리뷰 상태 읽기. 없으면 pending 기본값. */
export async function getDocReview(
  docPath: string,
  options: DocReviewOptions = {}
): Promise<DocReview> {
  const file = resolveFile(docPath, options);
  try {
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DocReview>;
    return {
      docPath,
      status: parsed.status ?? 'pending',
      comment: parsed.comment,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { docPath, status: 'pending', updatedAt: 0 };
  }
}

/** 문서 리뷰 상태 저장. */
export async function setDocReview(
  review: DocReview,
  options: DocReviewOptions = {}
): Promise<DocReview> {
  const file = resolveFile(review.docPath, options);
  const toSave: DocReview = { ...review, updatedAt: Date.now() };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(toSave, null, 2), 'utf-8');
  return toSave;
}
