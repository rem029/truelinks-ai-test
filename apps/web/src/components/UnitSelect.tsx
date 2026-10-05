import { useEffect, useState } from 'react';
import type { Unit } from '@truelinks/shared';
import { getUnits } from '../utils/api.ts';

export interface UnitSelectProps {
  value: string;
  onChange: (unitId: string) => void;
  disabled?: boolean;
}

// Units are fixed by the owner's records, so a unit is picked from the list, never typed
export function UnitSelect({ value, onChange, disabled }: UnitSelectProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getUnits()
      .then((list) => {
        if (active) setUnits(list);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return <span className="form-error-alert">Couldn't load units: {error}</span>;
  }

  const isKnown = units.some((u) => u.unitId === value);

  return (
    <select value={isKnown ? value : ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label="Unit">
      <option value="" disabled>
        {units.length === 0 ? 'Loading units…' : value ? `${value} is not one of your units — pick one` : 'Select a unit…'}
      </option>
      {units.map((u) => (
        <option key={u.unitId} value={u.unitId}>
          {u.unitId} — {u.label} ({u.status})
        </option>
      ))}
    </select>
  );
}
