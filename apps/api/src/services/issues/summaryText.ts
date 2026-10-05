import type { IssueCondition } from '@truelinks/shared';

export interface PhotoConditionSummaryInput {
  condition: IssueCondition;
  damages?: string[];
}

// The reply is a one-line overview; the condition card lists every damage in full
const MAX_DAMAGES = 3;
const MAX_DAMAGE_LENGTH = 60;

export function shortenDamage(damage: string): string {
  if (damage.length <= MAX_DAMAGE_LENGTH) return damage;
  const cut = damage.slice(0, MAX_DAMAGE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, '')}…`;
}

const CONDITION_ORDER: readonly IssueCondition[] = ['damaged', 'worn', 'good', 'new', 'undeterminable'];

export function countConditions(photos: PhotoConditionSummaryInput[]): Record<IssueCondition, number> {
  const counts: Record<IssueCondition, number> = {
    new: 0,
    good: 0,
    worn: 0,
    damaged: 0,
    undeterminable: 0,
  };

  for (const photo of photos) {
    counts[photo.condition] = (counts[photo.condition] ?? 0) + 1;
  }

  return counts;
}

export function dedupeDamages(photos: PhotoConditionSummaryInput[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const photo of photos) {
    if (!photo.damages) continue;
    for (const damage of photo.damages) {
      const trimmed = damage.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        deduped.push(trimmed);
      }
    }
  }

  return deduped;
}

export function buildIssueSummaryText(photos: PhotoConditionSummaryInput[]): string {
  if (photos.length === 0) {
    return 'No photos provided.';
  }

  if (photos.every((p) => p.condition === 'undeterminable')) {
    return "I can't judge the condition from these photos; please send a clearer one.";
  }

  const counts = countConditions(photos);
  const parts: string[] = [];
  for (const condition of CONDITION_ORDER) {
    const count = counts[condition];
    if (count > 0) {
      parts.push(`${count} ${condition}`);
    }
  }

  const photoWord = photos.length === 1 ? '1 photo' : `${photos.length} photos`;
  const overview = `Looked at ${photoWord}: ${parts.join(', ')}.`;

  const damages = dedupeDamages(photos);

  if (damages.length > 0) {
    const shown = damages.slice(0, MAX_DAMAGES).map(shortenDamage);
    const more = damages.length - shown.length;
    const sample = more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(', ');
    return `${overview} Seen: ${sample}. Drafting a work order comes next.`;
  }

  const allNewOrGood = photos.every((p) => p.condition === 'new' || p.condition === 'good');
  if (allNewOrGood) {
    return `${overview} No damage seen.`;
  }

  return overview;
}
