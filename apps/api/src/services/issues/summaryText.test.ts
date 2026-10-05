import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from '../../env.ts';
import {
  buildIssueSummaryText,
  countConditions,
  dedupeDamages,
} from './summaryText.ts';

interface ExpectedPhoto {
  condition: 'new' | 'good' | 'worn' | 'damaged' | 'undeterminable';
  damages: string[];
  equipment: string[];
}

interface ExpectedGroup {
  photos?: Record<string, ExpectedPhoto>;
}

describe('summaryText helper using expected.json fixtures', () => {
  const expectedPath = resolve(REPO_ROOT, 'data/sample-photos/expected.json');
  const expectedData = JSON.parse(readFileSync(expectedPath, 'utf-8')) as Record<string, ExpectedGroup>;

  it('builds summary for issue-01-ac-leak (1 damaged, 1 worn, damages present)', () => {
    const group = expectedData['issue-01-ac-leak'];
    expect(group).toBeDefined();
    const photos = Object.values(group?.photos ?? {});

    const counts = countConditions(photos);
    expect(counts.damaged).toBe(1);
    expect(counts.worn).toBe(1);

    const damages = dedupeDamages(photos);
    expect(damages.length).toBe(5);

    const summary = buildIssueSummaryText(photos);
    expect(summary).toBe(
      'Looked at 2 photos: 1 damaged, 1 worn. Seen: brown water stain down wall below AC, water puddle on floor tiles, water dripping from AC vent/louvres, brown discoloration on AC casing, stain on wall below unit. Drafting a work order comes next.'
    );
  });

  it('builds summary for issue-04-move-in-ok (no damages, all new)', () => {
    const group = expectedData['issue-04-move-in-ok'];
    expect(group).toBeDefined();
    const photos = Object.values(group?.photos ?? {});

    const counts = countConditions(photos);
    expect(counts.new).toBe(2);

    const summary = buildIssueSummaryText(photos);
    expect(summary).toBe('Looked at 2 photos: 2 new. No damage seen.');
  });

  it('builds summary for issue-05-unclear (all undeterminable)', () => {
    const group = expectedData['issue-05-unclear'];
    expect(group).toBeDefined();
    const photos = Object.values(group?.photos ?? {});

    const summary = buildIssueSummaryText(photos);
    expect(summary).toBe("I can't judge the condition from these photos; please send a clearer one.");
  });

  it('correctly pluralises for a single photo', () => {
    const singleDamaged = [
      {
        condition: 'damaged' as const,
        damages: ['broken glass'],
      },
    ];

    const summary = buildIssueSummaryText(singleDamaged);
    expect(summary).toBe('Looked at 1 photo: 1 damaged. Seen: broken glass. Drafting a work order comes next.');
  });

  it('handles clean photos with good condition', () => {
    const goodPhotos = [
      { condition: 'good' as const, damages: [] },
      { condition: 'good' as const, damages: [] },
    ];
    const summary = buildIssueSummaryText(goodPhotos);
    expect(summary).toBe('Looked at 2 photos: 2 good. No damage seen.');
  });

  it('deduplicates identical damage strings across photos', () => {
    const photos = [
      { condition: 'damaged' as const, damages: ['tap dripping', 'water puddle'] },
      { condition: 'damaged' as const, damages: ['tap dripping', 'mold in corner'] },
    ];
    const deduped = dedupeDamages(photos);
    expect(deduped).toEqual(['tap dripping', 'water puddle', 'mold in corner']);
  });
});
