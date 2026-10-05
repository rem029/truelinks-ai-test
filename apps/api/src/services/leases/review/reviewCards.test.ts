import { describe, it, expect } from 'vitest';
import { Card, type Lease } from '@truelinks/shared';
import { sampleLeaseRecords } from '../sampleLeaseRecords.ts';
import type { UnitMatch } from '../unitMatch.ts';
import { editField } from './patchRecord.ts';
import { buildReviewCards, describeChanges, parseCardId } from './reviewCards.ts';

const LEASE_02_RECORD = sampleLeaseRecords['lease-02-problems-MC-B-0902.pdf']!;
const LEASE_05_RECORD = sampleLeaseRecords['lease-05-unknown-unit-rent-conflict.pdf']!;
const NOW = '2026-10-05T12:00:00.000Z';

function createLease(overrides: Partial<Lease> = {}): Lease {
  return {
    id: 'lease-test',
    conversationId: 'conv-test',
    unitId: null,
    record: LEASE_05_RECORD,
    flags: [],
    ruleResults: [],
    rulesetVersion: '1.0',
    status: 'draft',
    analysisStatus: 'done',
    overrideReason: null,
    confirmedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('reviewCards', () => {
  describe('parseCardId', () => {
    it('round-trips and parses all valid card IDs', () => {
      expect(parseCardId('summary')).toEqual({ kind: 'summary' });
      expect(parseCardId('unitMatch')).toEqual({ kind: 'unitMatch' });
      expect(parseCardId('field:rent.amount')).toEqual({ kind: 'field', fieldPath: 'rent.amount' });
      expect(parseCardId('flag:VALUE_CONFLICT:rent.amount')).toEqual({
        kind: 'flag',
        flagId: 'VALUE_CONFLICT:rent.amount',
      });
      expect(parseCardId('rule:R1')).toEqual({ kind: 'rule', ruleId: 'R1' });
    });

    it('returns null for unknown prefixes or invalid field paths', () => {
      expect(parseCardId('unknown:123')).toBeNull();
      expect(parseCardId('field:nonexistent.field')).toBeNull();
      expect(parseCardId('')).toBeNull();
      expect(parseCardId('flag:')).toBeNull();
      expect(parseCardId('rule:')).toBeNull();
    });
  });

  describe('buildReviewCards', () => {
    it('builds summary card first, unitMatch card when unconfirmed, and no field cards for unflagged fields', () => {
      const lease = createLease({
        record: LEASE_05_RECORD,
        analysisStatus: 'pending',
        flags: [
          {
            id: 'VALUE_CONFLICT:rent.amount',
            code: 'VALUE_CONFLICT',
            severity: 'high',
            message: 'Rent conflict: clause 2 says 8,500, clause 5 says 8,000',
            fieldPaths: ['rent.amount'],
            clauseIds: ['2', '5'],
            reviewStatus: 'open',
          },
        ],
        ruleResults: [
          {
            ruleId: 'R1',
            status: 'FAIL',
            severity: 'high',
            reason: 'Rent mismatch',
            clauseIds: ['2'],
            rulesetVersion: '1.0',
          },
          {
            ruleId: 'R2',
            status: 'PASS',
            severity: 'medium',
            reason: 'Landlord signature present',
            clauseIds: ['signatures'],
            rulesetVersion: '1.0',
          },
          {
            ruleId: 'R7',
            status: 'NOT_DETERMINABLE',
            severity: 'high',
            reason: 'Unit not confirmed',
            clauseIds: [],
            rulesetVersion: '1.0',
          },
        ],
      });

      const unconfirmedUnitMatch: UnitMatch = {
        status: 'unconfirmed',
        statedUnitId: 'MC-X-9999',
        suggestions: [
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
      };

      const cards = buildReviewCards(lease, unconfirmedUnitMatch);

      // Validate every card parses against Card schema
      for (const card of cards) {
        expect(() => Card.parse(card)).not.toThrow();
      }

      // First card must be summary
      expect(cards[0]?.id).toBe('summary');
      expect(cards[0]?.type).toBe('summary');
      if (cards[0]?.type === 'summary') {
        expect(cards[0].lines).toContain('18/20 fields found');
        expect(cards[0].lines).toContain('Rules: 1 pass / 1 fail / 1 not determinable');
        expect(cards[0].lines).toContain('1 open flag');
        expect(cards[0].lines).toContain('Full review still running');
        expect(cards[0].lines).toContain('17 fields look fine — Accept all');
      }

      // Second card is unitMatch because unconfirmed
      expect(cards[1]?.id).toBe('unitMatch');
      expect(cards[1]?.type).toBe('unitMatch');

      // Open flag card is present
      const flagCards = cards.filter((c) => c.type === 'flag');
      expect(flagCards).toHaveLength(1);
      expect(flagCards[0]?.id).toBe('flag:VALUE_CONFLICT:rent.amount');

      // Rule cards present only for FAIL or NOT_DETERMINABLE
      const ruleCards = cards.filter((c) => c.type === 'rule');
      expect(ruleCards.map((c) => c.id)).toEqual(['rule:R1', 'rule:R7']);

      // Field cards only for pending fields referenced by open flag (rent.amount)
      const fieldCards = cards.filter((c) => c.type === 'field');
      expect(fieldCards).toHaveLength(1);
      expect(fieldCards[0]?.id).toBe('field:rent.amount');

      // Unflagged fields (e.g. tenant.name, landlord.name) must NOT have field cards
      expect(cards.some((c) => c.id === 'field:tenant.name')).toBe(false);
      expect(cards.some((c) => c.id === 'field:landlord.name')).toBe(false);
    });

    it('omits unitMatch card when unit is matched', () => {
      const lease = createLease({
        record: LEASE_02_RECORD,
        unitId: 'MC-B-0902',
      });

      const matchedUnit: UnitMatch = {
        status: 'matched',
        unit: {
          unitId: 'MC-B-0902',
          label: 'Apartment 902',
          type: '1BR',
          areaSqm: 85,
          parkingBay: 'B-30',
          status: 'available',
          buildingId: 'MC-B',
          buildingName: 'Tower B',
          propertyId: 'PROP-MC',
          propertyName: 'Marina Crest Residences',
        },
      };

      const cards = buildReviewCards(lease, matchedUnit);
      expect(cards.some((c) => c.id === 'unitMatch')).toBe(false);
    });

    it('builds cards for lease-02 with unconfirmed unitMatch and flagged renewal', () => {
      const lease = createLease({
        record: LEASE_02_RECORD,
        analysisStatus: 'done',
        flags: [
          {
            id: 'MODEL_CONCERN:renewal',
            code: 'MODEL_CONCERN',
            severity: 'medium',
            message: 'Renewal terms vague',
            fieldPaths: ['renewal'],
            clauseIds: ['7'],
            reviewStatus: 'open',
          },
        ],
        ruleResults: [
          {
            ruleId: 'R7',
            status: 'NOT_DETERMINABLE',
            severity: 'high',
            reason: 'Unit not confirmed',
            clauseIds: [],
            rulesetVersion: '1.0',
          },
        ],
      });

      const unconfirmedUnitMatch: UnitMatch = {
        status: 'unconfirmed',
        statedUnitId: null,
        suggestions: [
          {
            unitId: 'MC-B-0902',
            label: 'Apartment 902',
            type: '1BR',
            areaSqm: 85,
            parkingBay: 'B-30',
            status: 'available',
            buildingId: 'MC-B',
            buildingName: 'Tower B',
            propertyId: 'PROP-MC',
            propertyName: 'Marina Crest Residences',
          },
        ],
      };

      const cards = buildReviewCards(lease, unconfirmedUnitMatch);
      expect(cards[0]?.id).toBe('summary');
      expect(cards.some((c) => c.id === 'unitMatch')).toBe(true);
      expect(cards.some((c) => c.id === 'flag:MODEL_CONCERN:renewal')).toBe(true);
      expect(cards.some((c) => c.id === 'field:renewal')).toBe(true);
      expect(cards.some((c) => c.id === 'field:rent.amount')).toBe(false);
    });
  });

  describe('describeChanges', () => {
    it('reports field value change, rule status change, unit set, and flag changes', () => {
      const beforeLease = createLease({
        unitId: null,
        record: LEASE_05_RECORD, // rent.amount is 8500
        flags: [
          {
            id: 'flag-conflict',
            code: 'VALUE_CONFLICT',
            severity: 'high',
            message: 'Rent conflict: 8,500 vs 8,000',
            fieldPaths: ['rent.amount'],
            clauseIds: ['2', '5'],
            reviewStatus: 'open',
          },
        ],
        ruleResults: [
          {
            ruleId: 'R1',
            status: 'FAIL',
            severity: 'high',
            reason: 'Mismatch',
            clauseIds: ['2'],
            rulesetVersion: '1.0',
          },
        ],
      });

      // Edit rent.amount from 8500 to 8000
      const patchedRecord = editField(LEASE_05_RECORD, 'rent.amount', 8000, 'msg-1', NOW);

      const afterLease: Lease = {
        ...beforeLease,
        unitId: 'MC-B-1204',
        record: patchedRecord,
        flags: [], // conflict resolved
        ruleResults: [
          {
            ruleId: 'R1',
            status: 'PASS',
            severity: 'high',
            reason: 'Amounts agree',
            clauseIds: ['2'],
            rulesetVersion: '1.0',
          },
        ],
      };

      const changes = describeChanges(beforeLease, afterLease);

      expect(changes).toContain('rent.amount: 8,500 → 8,000');
      expect(changes).toContain('Unit set to MC-B-1204');
      expect(changes).toContain('R1: FAIL → PASS');
      expect(changes).toContain('Flag resolved: Rent conflict: 8,500 vs 8,000');
    });
  });
});
