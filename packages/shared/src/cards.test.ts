import { describe, it, expect } from 'vitest';
import { Card, ALLOWED_ACTIONS } from './cards.ts';

describe('Card union and ALLOWED_ACTIONS', () => {
  it('exposes expected ALLOWED_ACTIONS for every card type', () => {
    expect(ALLOWED_ACTIONS.field).toEqual(['accept', 'reject', 'edit']);
    expect(ALLOWED_ACTIONS.rule).toEqual([]);
    expect(ALLOWED_ACTIONS.flag).toEqual(['accept', 'reject']);
    expect(ALLOWED_ACTIONS.unitMatch).toEqual(['choose']);
    expect(ALLOWED_ACTIONS.workOrder).toEqual(['accept', 'reject', 'edit']);
    expect(ALLOWED_ACTIONS.summary).toEqual(['confirm', 'acceptAll']);
    expect(ALLOWED_ACTIONS.condition).toEqual([]);
  });

  it('parses a valid condition card', () => {
    const card = {
      id: 'condition',
      type: 'condition',
      photos: [
        {
          id: 'photo-1',
          filename: 'issue-01-ac-leak-1.jpg',
          mimeType: 'image/jpeg',
          condition: 'damaged',
          damages: ['water stain'],
          equipment: ['split AC'],
          note: '',
        },
      ],
    };

    const parsed = Card.parse(card);
    expect(parsed.type).toBe('condition');
    if (parsed.type === 'condition') {
      expect(parsed.photos).toHaveLength(1);
      expect(parsed.photos[0]?.condition).toBe('damaged');
      expect(ALLOWED_ACTIONS[parsed.type]).toEqual([]);
    }
  });

  it('parses a valid field card', () => {
    const card = {
      id: 'card-1',
      type: 'field',
      fieldPath: 'rent.amount',
      field: {
        value: 8500,
        source: {
          type: 'document',
          clauseId: 'C-02',
          quote: 'Rent is 8,500 QAR',
          verified: true,
        },
        confidence: 0.98,
        review: { status: 'pending' },
      },
    };

    const parsed = Card.parse(card);
    expect(parsed.type).toBe('field');
    if (parsed.type === 'field') {
      expect(parsed.fieldPath).toBe('rent.amount');
      expect(parsed.field.value).toBe(8500);
      expect(ALLOWED_ACTIONS[parsed.type]).toEqual(['accept', 'reject', 'edit']);
    }
  });

  it('parses a valid unitMatch card', () => {
    const card = {
      id: 'card-2',
      type: 'unitMatch',
      candidates: [
        {
          unitId: 'MC-B-1204',
          label: 'Apartment 1204',
          type: '2BR',
          areaSqm: 118,
          parkingBay: 'B-77',
          status: 'available',
          buildingId: 'MC-B',
          buildingName: 'Tower B',
          propertyId: 'PROP-MC',
          propertyName: 'Marina Crest Residences',
        },
      ],
      chosenUnitId: 'MC-B-1204',
      reason: 'Matched by unit label',
    };

    const parsed = Card.parse(card);
    expect(parsed.type).toBe('unitMatch');
  });

  it('parses a valid workOrder card', () => {
    const card = {
      id: 'card-3',
      type: 'workOrder',
      workOrder: {
        id: 'wo-1',
        issueId: 'iss-1',
        unitId: 'MC-B-1204',
        title: 'AC leak in bedroom',
        description: 'Split AC leaking water down wall',
        category: 'HVAC',
        severity: 'medium',
        urgent: false,
        responsibility: 'landlord',
        responsibilityReason: 'Lease clause 7 makes the landlord maintain AC units',
        responsibilityClause: { clauseId: 'c7', heading: '7. Maintenance', quote: 'air-conditioning units' },
        leaseId: 'lease-1',
        status: 'draft',
        createdAt: '2026-10-04T10:00:00.000Z',
        updatedAt: '2026-10-04T10:00:00.000Z',
      },
    };

    const parsed = Card.parse(card);
    expect(parsed.type).toBe('workOrder');
  });

  it('parses a valid summary card with acceptAllCount', () => {
    const card = {
      id: 'card-summary',
      type: 'summary',
      title: 'Lease review',
      lines: ['18/20 fields found'],
      acceptAllCount: 17,
    };

    const parsed = Card.parse(card);
    expect(parsed.type).toBe('summary');
    if (parsed.type === 'summary') {
      expect(parsed.acceptAllCount).toBe(17);
    }
  });

  it('parses an older summary card without acceptAllCount', () => {
    const card = {
      id: 'card-summary-old',
      type: 'summary',
      title: 'Lease review',
      lines: ['18/20 fields found'],
    };

    const parsed = Card.parse(card);
    expect(parsed.type).toBe('summary');
    if (parsed.type === 'summary') {
      expect(parsed.acceptAllCount).toBeUndefined();
    }
  });

  it('rejects summary card with negative or non-integer acceptAllCount', () => {
    expect(() =>
      Card.parse({
        id: 'card-summary-neg',
        type: 'summary',
        title: 'Lease review',
        lines: [],
        acceptAllCount: -1,
      })
    ).toThrow();

    expect(() =>
      Card.parse({
        id: 'card-summary-float',
        type: 'summary',
        title: 'Lease review',
        lines: [],
        acceptAllCount: 1.5,
      })
    ).toThrow();
  });

  it('rejects card with invalid discriminator type', () => {
    const invalid = {
      id: 'card-4',
      type: 'unknownCard',
    };

    expect(() => Card.parse(invalid)).toThrow();
  });
});
