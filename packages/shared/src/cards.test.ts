import { describe, it, expect } from 'vitest';
import { Card, ALLOWED_ACTIONS } from './cards.ts';

describe('Card union and ALLOWED_ACTIONS', () => {
  it('exposes expected ALLOWED_ACTIONS for every card type', () => {
    expect(ALLOWED_ACTIONS.field).toEqual(['accept', 'reject', 'edit']);
    expect(ALLOWED_ACTIONS.rule).toEqual(['accept']);
    expect(ALLOWED_ACTIONS.flag).toEqual(['accept', 'reject']);
    expect(ALLOWED_ACTIONS.unitMatch).toEqual(['choose']);
    expect(ALLOWED_ACTIONS.workOrder).toEqual(['accept', 'reject', 'edit']);
    expect(ALLOWED_ACTIONS.summary).toEqual(['confirm']);
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
        responsibility: 'landlord (clause 7)',
        status: 'draft',
        createdAt: '2026-10-04T10:00:00.000Z',
      },
    };

    const parsed = Card.parse(card);
    expect(parsed.type).toBe('workOrder');
  });

  it('rejects card with invalid discriminator type', () => {
    const invalid = {
      id: 'card-4',
      type: 'unknownCard',
    };

    expect(() => Card.parse(invalid)).toThrow();
  });
});
