import { describe, it, expect } from 'vitest';
import { formatCost, shortModelName } from '@shared/format';

describe('formatCost', () => {
  it('>= 1 USD는 소수 2자리', () => {
    expect(formatCost(1)).toBe('$1.00');
    expect(formatCost(12.345)).toBe('$12.35');
    expect(formatCost(198.19261574999987)).toBe('$198.19');
  });

  it('>= 0.01 USD는 소수 3자리', () => {
    expect(formatCost(0.01)).toBe('$0.010');
    expect(formatCost(0.1234)).toBe('$0.123');
    expect(formatCost(0.999)).toBe('$0.999');
  });

  it('< 0.01 USD는 소수 4자리', () => {
    expect(formatCost(0)).toBe('$0.0000');
    expect(formatCost(0.00012)).toBe('$0.0001');
    expect(formatCost(0.009)).toBe('$0.0090');
  });
});

describe('shortModelName', () => {
  it('Opus 계열', () => {
    expect(shortModelName('claude-opus-4-6')).toBe('Opus');
    expect(shortModelName('claude-opus-4-20250514')).toBe('Opus');
  });

  it('Sonnet 계열', () => {
    expect(shortModelName('claude-sonnet-4-6')).toBe('Sonnet');
    expect(shortModelName('claude-sonnet-4-20250514')).toBe('Sonnet');
  });

  it('Haiku 계열', () => {
    expect(shortModelName('claude-haiku-4-5-20251001')).toBe('Haiku');
  });

  it('매칭되지 않으면 원본 반환', () => {
    expect(shortModelName('gpt-4')).toBe('gpt-4');
    expect(shortModelName('')).toBe('');
  });
});
