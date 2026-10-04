import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { sourcedField, Source } from './sourcedField.ts';

describe('sourcedField', () => {
  const StringField = sourcedField(z.string());

  it('parses a field with document source', () => {
    const valid = {
      value: 'Marina Crest',
      source: {
        type: 'document',
        clauseId: 'C-01',
        quote: 'Marina Crest Holdings',
        verified: true,
      },
      confidence: 0.95,
      review: {
        status: 'pending',
      },
    };

    const parsed = StringField.parse(valid);
    expect(parsed.value).toBe('Marina Crest');
    expect(parsed.source?.type).toBe('document');
  });

  it('parses a field with user source and review history', () => {
    const valid = {
      value: 'Apartment 1204',
      source: {
        type: 'user',
        messageId: 'msg-42',
      },
      confidence: 1.0,
      review: {
        status: 'edited',
        original: 'Apt 1204',
        reviewedAt: '2026-10-04T12:00:00.000Z',
      },
    };

    const parsed = StringField.parse(valid);
    expect(parsed.source?.type).toBe('user');
    expect(parsed.review.status).toBe('edited');
    expect(parsed.review.original).toBe('Apt 1204');
  });

  it('allows null value when absent in lease', () => {
    const valid = {
      value: null,
      source: null,
      confidence: 0,
      review: {
        status: 'pending',
      },
    };

    const parsed = StringField.parse(valid);
    expect(parsed.value).toBeNull();
    expect(parsed.source).toBeNull();
  });

  it('rejects confidence out of range [0, 1]', () => {
    const invalid = {
      value: 'test',
      source: null,
      confidence: 1.5,
      review: { status: 'pending' },
    };

    expect(() => StringField.parse(invalid)).toThrow();
  });

  it('rejects invalid source type', () => {
    const invalid = {
      value: 'test',
      source: { type: 'unknown' },
      confidence: 0.5,
      review: { status: 'pending' },
    };

    expect(() => StringField.parse(invalid)).toThrow();
  });

  it('rejects invalid review status', () => {
    const invalid = {
      value: 'test',
      source: null,
      confidence: 0.5,
      review: { status: 'in-progress' },
    };

    expect(() => StringField.parse(invalid)).toThrow();
  });

  it('rejects review original that violates valueSchema', () => {
    const invalid = {
      value: 'test',
      source: null,
      confidence: 0.5,
      review: {
        status: 'edited',
        original: 12345, // string expected
      },
    };

    expect(() => StringField.parse(invalid)).toThrow();
  });
});
