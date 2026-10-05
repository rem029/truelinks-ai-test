import { describe, it, expect } from 'vitest';
import { parseHash, toHash } from './router.ts';

describe('router', () => {
  it('parses empty or root hash as home', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#')).toEqual({ name: 'home' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
    expect(parseHash('#/other')).toEqual({ name: 'home' });
  });

  it('parses conversation thread hash', () => {
    expect(parseHash('#/c/conv-123')).toEqual({ name: 'thread', conversationId: 'conv-123' });
    expect(parseHash('#/c/conv%20abc')).toEqual({ name: 'thread', conversationId: 'conv abc' });
  });

  it('converts routes to hash strings', () => {
    expect(toHash({ name: 'home' })).toBe('#/');
    expect(toHash({ name: 'thread', conversationId: 'conv-123' })).toBe('#/c/conv-123');
    expect(toHash({ name: 'thread', conversationId: 'conv abc' })).toBe('#/c/conv%20abc');
  });
});
