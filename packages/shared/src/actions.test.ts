import { describe, it, expect } from 'vitest';
import { Action } from './actions.ts';

describe('Action union', () => {
  it('parses accept action', () => {
    const action = { type: 'accept', cardId: 'c-1' };
    const parsed = Action.parse(action);
    expect(parsed.type).toBe('accept');
  });

  it('parses reject action with optional reason', () => {
    const withReason = { type: 'reject', cardId: 'c-1', reason: 'Incorrect figure' };
    const parsed = Action.parse(withReason);
    expect(parsed.type).toBe('reject');
    if (parsed.type === 'reject') {
      expect(parsed.reason).toBe('Incorrect figure');
    }

    const withoutReason = { type: 'reject', cardId: 'c-1' };
    expect(Action.parse(withoutReason).type).toBe('reject');
  });

  it('parses edit action with unknown typed value', () => {
    const action = { type: 'edit', cardId: 'c-1', value: 9200 };
    const parsed = Action.parse(action);
    expect(parsed.type).toBe('edit');
    if (parsed.type === 'edit') {
      expect(parsed.value).toBe(9200);
    }
  });

  it('parses choose action', () => {
    const action = { type: 'choose', cardId: 'c-1', option: 'MC-B-1204' };
    const parsed = Action.parse(action);
    expect(parsed.type).toBe('choose');
    if (parsed.type === 'choose') {
      expect(parsed.option).toBe('MC-B-1204');
    }
  });

  it('parses confirm action with optional overrideReason', () => {
    const action = { type: 'confirm', conversationId: 'conv-1', overrideReason: 'Approved by owner' };
    const parsed = Action.parse(action);
    expect(parsed.type).toBe('confirm');
    if (parsed.type === 'confirm') {
      expect(parsed.overrideReason).toBe('Approved by owner');
    }
  });

  it('rejects action with invalid action type', () => {
    const invalid = { type: 'delete', cardId: 'c-1' };
    expect(() => Action.parse(invalid)).toThrow();
  });
});
