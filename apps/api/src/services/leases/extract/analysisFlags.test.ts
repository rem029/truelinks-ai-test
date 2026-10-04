import { describe, it, expect } from 'vitest';
import type { Clause } from '@truelinks/shared';
import { buildAnalysisFlags } from './analysisFlags.ts';

const clauses: Clause[] = [
  {
    id: '2',
    heading: 'Rent',
    text: 'The Tenant shall pay rent of QAR 8,500 (Eight Thousand Five Hundred Qatari Riyals) per month, payable monthly in advance.',
    pages: null,
  },
  {
    id: '5',
    heading: 'Payment Schedule',
    text: 'Rent of QAR 8,000 per month shall be paid by post-dated cheques delivered on signing.',
    pages: null,
  },
  { id: '6', heading: 'Renewal', text: 'Renewal is subject to a new lease agreement.', pages: null },
];

const rentConflict = {
  fieldPath: 'rent.monthly',
  candidates: [
    { value: '8500', clauseId: '2', quote: 'QAR 8,500 (Eight Thousand Five Hundred Qatari Riyals) per month' },
    { value: '8000', clauseId: '5', quote: 'Rent of QAR 8,000 per month' },
  ],
};

describe('buildAnalysisFlags', () => {
  it('flags a conflict with every candidate, in the expected.json wording', () => {
    const flags = buildAnalysisFlags({ conflicts: [rentConflict], concerns: [] }, clauses);
    expect(flags).toEqual([
      {
        id: 'VALUE_CONFLICT:rent.monthly',
        code: 'VALUE_CONFLICT',
        severity: 'high',
        message: 'Monthly rent conflict: clause 2 says 8,500, clause 5 says 8,000',
        fieldPaths: ['rent.monthly'],
        clauseIds: ['2', '5'],
        reviewStatus: 'open',
      },
    ]);
  });

  it('drops a conflict whose values are the same once formatted', () => {
    const sameValue = {
      fieldPath: 'rent.monthly',
      candidates: [
        { value: '8500', clauseId: '2', quote: 'QAR 8,500' },
        { value: '8,500', clauseId: '2', quote: 'QAR 8,500' },
      ],
    };
    expect(buildAnalysisFlags({ conflicts: [sameValue], concerns: [] }, clauses)).toEqual([]);
  });

  it('drops a conflict when a candidate quote is not in its clause', () => {
    const fabricated = {
      fieldPath: 'rent.monthly',
      candidates: [rentConflict.candidates[0]!, { value: '7000', clauseId: '5', quote: 'Rent of QAR 7,000 per month' }],
    };
    expect(buildAnalysisFlags({ conflicts: [fabricated], concerns: [] }, clauses)).toEqual([]);
  });

  it('reports the same disagreement once when it is listed under two fields', () => {
    const flags = buildAnalysisFlags(
      { conflicts: [rentConflict, { ...rentConflict, fieldPath: 'rent.amount' }], concerns: [] },
      clauses
    );
    expect(flags.map((f) => f.id)).toEqual(['VALUE_CONFLICT:rent.monthly']);
  });

  it('turns concerns into medium flags with unique ids per field', () => {
    const concern = { fieldPath: 'renewal', clauseId: '6', message: 'Renewal terms vague' };
    const flags = buildAnalysisFlags(
      { conflicts: [], concerns: [concern, { ...concern, message: 'No notice period' }] },
      clauses
    );
    expect(flags.map((f) => [f.id, f.severity, f.message])).toEqual([
      ['MODEL_CONCERN:renewal', 'medium', 'Renewal terms vague'],
      ['MODEL_CONCERN:renewal:2', 'medium', 'No notice period'],
    ]);
    expect(flags[0]?.clauseIds).toEqual(['6']);
  });
});
