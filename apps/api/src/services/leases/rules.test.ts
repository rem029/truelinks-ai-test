import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Ruleset } from '@truelinks/shared';
import { loadRuleset, loadUnits } from '../db/seed.js';
import { matchUnit } from './unitMatch.js';
import { evaluateRules } from './rules.js';
import { sampleLeaseRecords } from './sampleLeaseRecords.js';

const ruleset = loadRuleset();
const allUnits = loadUnits();

const expectedGroundTruth = JSON.parse(
  readFileSync(resolve(process.cwd(), 'data/sample-leases/expected.json'), 'utf-8')
) as Record<string, { unitId: string | null; rules: Record<string, string>; flags: string[] }>;

describe('evaluateRules against ground truth expected.json', () => {
  for (const [filename, expected] of Object.entries(expectedGroundTruth)) {
    it(`evaluates rules R1-R7 correctly for ${filename}`, () => {
      const record = sampleLeaseRecords[filename];
      expect(record).toBeDefined();

      const unitMatch = matchUnit(record!, allUnits);

      if (unitMatch.status === 'matched') {
        expect(unitMatch.unit.unitId).toBe(expected.unitId);
      } else if (filename === 'lease-02-problems-MC-B-0902.pdf') {
        expect(unitMatch.suggestions.some((u) => u.unitId === expected.unitId)).toBe(true);
      }

      const results = evaluateRules({ record: record!, unitMatch, ruleset });
      expect(results).toHaveLength(ruleset.rules.length);

      for (const result of results) {
        expect(result.rulesetVersion).toBe('1.0');
        const expectedStatus = expected.rules[result.ruleId];
        expect(expectedStatus).toBeDefined();
        expect(
          result.status,
          `Rule ${result.ruleId} on ${filename} expected ${expectedStatus} but got ${result.status} (reason: ${result.reason})`
        ).toBe(expectedStatus);
      }
    });
  }

  it('evaluates R7 as PASS after the owner confirms the unit for lease 02', () => {
    const originalRecord = sampleLeaseRecords['lease-02-problems-MC-B-0902.pdf']!;
    const confirmedRecord = {
      ...originalRecord,
      unit: {
        ...originalRecord.unit,
        unitId: {
          value: 'MC-B-0902',
          source: { type: 'user' as const, messageId: 'm1' },
          confidence: 1,
          review: { status: 'pending' as const },
        },
      },
    };

    const unitMatch = matchUnit(confirmedRecord, allUnits);
    expect(unitMatch.status).toBe('matched');
    if (unitMatch.status === 'matched') {
      expect(unitMatch.unit.unitId).toBe('MC-B-0902');
    }

    const results = evaluateRules({ record: confirmedRecord, unitMatch, ruleset });
    const r7 = results.find((r) => r.ruleId === 'R7');
    expect(r7?.status).toBe('PASS');
    expect(r7?.reason).toBe('Unit MC-B-0902 is available');
  });

  it('returns NOT_DETERMINABLE when ruleset contains a rule with no check implemented', () => {
    const record = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;
    const unitMatch = matchUnit(record, allUnits);
    const customRuleset: Ruleset = {
      name: 'Custom',
      version: '1.0',
      rules: [
        {
          id: 'R99',
          description: 'Non-existent rule check',
          check: 'foo == bar',
          severity: 'low',
        },
      ],
    };

    const results = evaluateRules({ record, unitMatch, ruleset: customRuleset });
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      ruleId: 'R99',
      status: 'NOT_DETERMINABLE',
      reason: 'No check implemented for rule R99',
      clauseIds: [],
      severity: 'low',
      rulesetVersion: '1.0',
    });
  });
});
