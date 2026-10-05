import { useState, useEffect } from 'react';
import type { UnitMatchCard, Action, Unit } from '@truelinks/shared';
import { getUnits } from '../../utils/api.ts';

export interface UnitMatchCardViewProps {
  card: UnitMatchCard;
  isInteractive: boolean;
  currentUnitId: string | null;
  onAction: (action: Action) => Promise<void>;
}

export function UnitMatchCardView({
  card,
  isInteractive,
  currentUnitId,
  onAction,
}: UnitMatchCardViewProps) {
  const [choosingUnitId, setChoosingUnitId] = useState<string | null>(null);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [selectedManualId, setSelectedManualId] = useState<string>('');

  const activeUnitId = currentUnitId ?? card.chosenUnitId;

  useEffect(() => {
    let active = true;
    getUnits()
      .then((units) => {
        if (active) {
          setAllUnits(units);
          if (units.length > 0) {
            setSelectedManualId(activeUnitId ?? units[0]?.unitId ?? '');
          }
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load units in UnitMatchCardView', err);
      });

    return () => {
      active = false;
    };
  }, [activeUnitId]);

  async function handleChoose(unitId: string) {
    setChoosingUnitId(unitId);
    try {
      await onAction({
        type: 'choose',
        cardId: 'unitMatch',
        option: unitId,
      });
    } finally {
      setChoosingUnitId(null);
    }
  }

  return (
    <div className="card-item unit-match-card">
      <div className="card-header">
        <h4 className="card-title">Unit Match</h4>
        <span className="badge badge-subtle">Unit</span>
      </div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{card.reason}</p>

      {/* Suggested candidates */}
      {card.candidates.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {card.candidates.map((unit) => {
            const isSelected = activeUnitId === unit.unitId;
            return (
              <div
                key={unit.unitId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {unit.unitId}
                  </span>{' '}
                  · <span>{unit.label}</span> ·{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>{unit.buildingName}</span>{' '}
                  <span
                    className={`badge ${unit.status === 'available' ? 'badge-pass' : 'badge-warn'}`}
                    style={{ marginLeft: '0.25rem' }}
                  >
                    {unit.status}
                  </span>
                  {isSelected && (
                    <span className="badge badge-accent" style={{ marginLeft: '0.25rem' }}>
                      Selected
                    </span>
                  )}
                </div>
                {isInteractive && !isSelected && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleChoose(unit.unitId)}
                    disabled={choosingUnitId !== null}
                  >
                    {choosingUnitId === unit.unitId ? 'Choosing...' : 'Choose'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          No candidate suggestions found in property records. Pick a unit below:
        </div>
      )}

      {/* All units select (always available, suggestions first) */}
      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
        <label
          htmlFor="unit-select-input"
          style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '0.35rem',
          }}
        >
          All units in records:
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            id="unit-select-input"
            style={{ flex: 1, fontSize: '0.8125rem' }}
            value={selectedManualId}
            onChange={(e) => setSelectedManualId(e.target.value)}
            disabled={!isInteractive || choosingUnitId !== null || allUnits.length === 0}
          >
            {allUnits.map((u) => (
              <option key={u.unitId} value={u.unitId}>
                {u.unitId} · {u.label} · {u.buildingName} · {u.status}
              </option>
            ))}
          </select>
          {isInteractive && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => selectedManualId && handleChoose(selectedManualId)}
              disabled={choosingUnitId !== null || !selectedManualId || activeUnitId === selectedManualId}
            >
              {choosingUnitId === selectedManualId
                ? 'Choosing...'
                : activeUnitId === selectedManualId
                ? 'Selected'
                : 'Choose'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
