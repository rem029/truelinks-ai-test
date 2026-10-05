import { describe, it, expect } from 'vitest';
import type { Flag } from '@truelinks/shared';
import { sampleLeaseRecords, blankLeaseRecord } from '../sampleLeaseRecords.ts';
import { getField } from '../leaseFields.ts';
import {
  acceptField,
  rejectField,
  editField,
  acceptAllFields,
  isLocked,
  parseFieldValue,
} from './patchRecord.ts';

const NOW = '2026-10-05T12:00:00.000Z';
const SAMPLE = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;

describe('patchRecord', () => {
  it('isLocked returns true only for accepted or edited fields', () => {
    const fieldPending = getField(SAMPLE, 'rent.amount');
    expect(isLocked(fieldPending)).toBe(false);

    const fieldAccepted = { ...fieldPending, review: { status: 'accepted' as const } };
    expect(isLocked(fieldAccepted)).toBe(true);

    const fieldEdited = { ...fieldPending, review: { status: 'edited' as const } };
    expect(isLocked(fieldEdited)).toBe(true);

    const fieldRejected = { ...fieldPending, review: { status: 'rejected' as const } };
    expect(isLocked(fieldRejected)).toBe(false);
  });

  it('acceptField marks status accepted with timestamp', () => {
    const patched = acceptField(SAMPLE, 'rent.amount', NOW);
    const field = getField(patched, 'rent.amount');

    expect(field.value).toBe(9500);
    expect(field.review.status).toBe('accepted');
    expect(field.review.reviewedAt).toBe(NOW);
  });

  it('acceptField throws when accepting a null field', () => {
    expect(() => acceptField(blankLeaseRecord, 'rent.amount', NOW)).toThrow(
      'Cannot accept field rent.amount: value is null'
    );
  });

  it('rejectField sets value and source to null, confidence 0, and keeps original', () => {
    const patched = rejectField(SAMPLE, 'rent.amount', NOW);
    const field = getField(patched, 'rent.amount');

    expect(field.value).toBeNull();
    expect(field.source).toBeNull();
    expect(field.confidence).toBe(0);
    expect(field.review.status).toBe('rejected');
    expect(field.review.original).toBe(9500);
    expect(field.review.reviewedAt).toBe(NOW);
  });

  it('editField coerces "QAR 8,500" to 8500 and sets user source', () => {
    const patched = editField(SAMPLE, 'rent.amount', 'QAR 8,500', 'msg-123', NOW);
    const field = getField(patched, 'rent.amount');

    expect(field.value).toBe(8500);
    expect(field.confidence).toBe(1);
    expect(field.source).toEqual({
      type: 'user',
      messageId: 'msg-123',
    });
    expect(field.review.status).toBe('edited');
    expect(field.review.original).toBe(9500);
    expect(field.review.reviewedAt).toBe(NOW);
  });

  it('editField normalises currency and rent.frequency', () => {
    const patchedCur = editField(SAMPLE, 'currency', 'qar', 'msg-1', NOW);
    expect(getField(patchedCur, 'currency').value).toBe('QAR');

    const patchedFreq = editField(SAMPLE, 'rent.frequency', 'ANNUAL', 'msg-2', NOW);
    expect(getField(patchedFreq, 'rent.frequency').value).toBe('annual');
  });

  it('editField throws on invalid date', () => {
    expect(() => editField(SAMPLE, 'expiryDate', 'not-a-date', 'msg-1', NOW)).toThrow(
      /Invalid value for expiryDate/
    );
  });

  it('editField preserves first original value when edited multiple times', () => {
    const firstEdit = editField(SAMPLE, 'rent.amount', '9,000', 'msg-1', NOW);
    expect(getField(firstEdit, 'rent.amount').value).toBe(9000);
    expect(getField(firstEdit, 'rent.amount').review.original).toBe(9500);

    const secondEdit = editField(firstEdit, 'rent.amount', '9,200', 'msg-2', NOW);
    expect(getField(secondEdit, 'rent.amount').value).toBe(9200);
    expect(getField(secondEdit, 'rent.amount').review.original).toBe(9500);
  });

  it('parseFieldValue returns ok for valid values and error for invalid values', () => {
    expect(parseFieldValue('rent.amount', '8,500')).toEqual({ ok: true, value: 8500 });
    expect(parseFieldValue('rent.amount', 'invalid')).toEqual({
      ok: false,
      error: 'Invalid value for rent.amount: expected number',
    });
    expect(parseFieldValue('landlord.signed', 'true')).toEqual({ ok: true, value: true });
    expect(parseFieldValue('expiryDate', '2028-10-31')).toEqual({ ok: true, value: '2028-10-31' });
  });

  it('acceptAllFields skips flagged and null fields', () => {
    const baseRecord = editField(SAMPLE, 'renewal', 'Renewal subject to notice', 'msg-0', NOW);
    // blankLeaseRecord has nulls; SAMPLE has 20 fields with non-null values
    const openFlags: Flag[] = [
      {
        id: 'flag-1',
        code: 'VALUE_CONFLICT',
        severity: 'high',
        message: 'Conflict on rent.amount',
        fieldPaths: ['rent.amount'],
        clauseIds: ['2', '5'],
        reviewStatus: 'open',
      },
    ];

    const { record, acceptedPaths } = acceptAllFields(baseRecord, openFlags, NOW);

    // rent.amount is flagged -> skipped
    expect(acceptedPaths).not.toContain('rent.amount');
    expect(getField(record, 'rent.amount').review.status).toBe('pending');

    // renewal was already edited -> not pending -> skipped
    expect(acceptedPaths).not.toContain('renewal');
    expect(getField(record, 'renewal').review.status).toBe('edited');

    // unflagged pending fields are accepted
    expect(acceptedPaths).toContain('landlord.name');
    expect(getField(record, 'landlord.name').review.status).toBe('accepted');
    expect(getField(record, 'landlord.name').review.reviewedAt).toBe(NOW);

    // Null fields in blank record are skipped
    const blankResult = acceptAllFields(blankLeaseRecord, [], NOW);
    expect(blankResult.acceptedPaths).toEqual([]);
  });
});
