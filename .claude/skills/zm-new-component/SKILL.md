---
name: zm-new-component
description: Electron 앱의 새 컴포넌트/서비스/타입 파일을 코딩 컨벤션에 맞게 생성
argument-hint: [layer] [name] (예: renderer SessionList, main session-watcher, shared types)
allowed-tools: Read Write Glob
---

# 새 컴포넌트/서비스 생성

프로젝트 코딩 컨벤션(`docs/policies/coding-conventions.md`)에 맞게 새 파일을 생성한다.

## 인자

- `$0`: 레이어 — `main`, `renderer`, `shared`, `preload` 중 하나
- `$1`: 이름 — 생성할 컴포넌트/서비스 이름

## 레이어별 규칙

### renderer (React 컴포넌트)
- 경로: `src/renderer/src/components/$1.tsx` (PascalCase 파일명)
- 함수형 컴포넌트 + Props interface
- Tailwind CSS 스타일링
- window.api를 통한 IPC 통신

### main (서비스)
- 경로: `src/main/$1.ts` (kebab-case 파일명)
- IPC 핸들러 등록 시 shared/types에서 채널명 import
- 파일 I/O 로직 포함 가능

### shared (타입/유틸)
- 경로: `src/shared/$1.ts` (kebab-case 파일명)
- Node.js/Electron API 의존 금지
- 순수 타입 정의 또는 유틸리티 함수

### preload
- 경로: `src/preload/$1.ts` (kebab-case 파일명)
- contextBridge를 통한 API 노출

## 공통 규칙
- TypeScript strict mode
- `any` 금지
- 세미콜론, 싱글 쿼트, 2 spaces
- import 순서: Node 내장 → 외부 패키지 → 내부 모듈 → 상대 경로
