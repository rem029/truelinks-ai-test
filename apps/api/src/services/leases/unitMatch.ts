import type { LeaseRecord, Unit } from '@truelinks/shared';

export type UnitMatch =
  | { status: 'matched'; unit: Unit }
  | { status: 'unconfirmed'; statedUnitId: string | null; suggestions: Unit[] };

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function unitNotFoundReason(record: LeaseRecord, statedUnitId?: string | null): string {
  if (statedUnitId) {
    return `Unit ID '${statedUnitId}' not in owner records`;
  }
  const label = record.unit.label.value?.trim();
  if (label) {
    return `Unit '${label}' not in owner records`;
  }
  return 'Unit not identified in the lease';
}

export function matchUnit(
  record: LeaseRecord,
  units: Unit[],
  pageUnitId?: string | null
): UnitMatch {
  const statedId = record.unit.unitId.value?.trim() || null;
  if (statedId) {
    const matched = units.find(
      (u) => u.unitId.trim().toLowerCase() === statedId.toLowerCase()
    );
    if (matched) {
      return { status: 'matched', unit: matched };
    }
  }

  const suggestions: Unit[] = [];
  const seenIds = new Set<string>();

  const addSuggestion = (unit: Unit) => {
    if (!seenIds.has(unit.unitId)) {
      seenIds.add(unit.unitId);
      suggestions.push(unit);
    }
  };

  if (pageUnitId?.trim()) {
    const normPageUnit = pageUnitId.trim().toLowerCase();
    const pageUnit = units.find((u) => u.unitId.trim().toLowerCase() === normPageUnit);
    if (pageUnit) {
      addSuggestion(pageUnit);
    }
  }

  const rawLabel = record.unit.label.value?.trim();
  if (rawLabel) {
    const normLabel = normalise(rawLabel);
    for (const u of units) {
      const normUnitLabel = normalise(u.label);
      const escaped = normUnitLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`).test(normLabel)) {
        addSuggestion(u);
      }
    }
  }

  const rawBay = record.unit.parkingBay.value?.trim();
  if (rawBay) {
    const normBay = normalise(rawBay);
    for (const u of units) {
      if (normalise(u.parkingBay) === normBay) {
        addSuggestion(u);
      }
    }
  }

  // Owner confirmation in review loop patches record.unit.unitId with user source, making subsequent runs matched without extra state.
  return {
    status: 'unconfirmed',
    statedUnitId: statedId,
    suggestions,
  };
}
