import { describe, it, expect } from 'vitest';
import { parseHash, threadParent, toHash } from './router.ts';

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

  it('parses unit, unassigned and report routes, and round-trips them', () => {
    expect(parseHash('#/u/MC-B-1204')).toEqual({ name: 'unit', unitId: 'MC-B-1204', tab: 'issues' });
    expect(parseHash('#/u/MC-B-1204/leases')).toEqual({ name: 'unit', unitId: 'MC-B-1204', tab: 'leases' });
    expect(parseHash('#/unassigned')).toEqual({ name: 'unassigned' });
    expect(parseHash('#/report')).toEqual({ name: 'report', unitId: null });
    expect(parseHash('#/report/MC-A-0301')).toEqual({ name: 'report', unitId: 'MC-A-0301' });
    for (const hash of ['#/u/MC-B-1204/leases', '#/unassigned', '#/report/MC-A-0301', '#/report']) {
      expect(toHash(parseHash(hash))).toBe(hash);
    }
  });

  it('sends a thread back to its unit tab, or to unassigned', () => {
    expect(threadParent('issue', 'MC-B-1204')).toEqual({ name: 'unit', unitId: 'MC-B-1204', tab: 'issues' });
    expect(threadParent('lease', 'MC-B-1204')).toEqual({ name: 'unit', unitId: 'MC-B-1204', tab: 'leases' });
    expect(threadParent('lease', null)).toEqual({ name: 'unassigned' });
  });
});
