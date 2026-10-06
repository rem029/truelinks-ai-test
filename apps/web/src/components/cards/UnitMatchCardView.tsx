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
      <p className="unit-match-reason">{card.reason}</p>

      {/* Suggested candidates */}
      {card.candidates.length > 0 ? (
        <div className="unit-match-candidates">
          {card.candidates.map((unit) => {
            const isSelected = activeUnitId === unit.unitId;
            return (
              <div
                key={unit.unitId}
                className={`unit-match-option${isSelected ? ' selected' : ''}`}
              >
                <div>
                  <span className="unit-match-id">
                    {unit.unitId}
                  </span>{' '}
                  · <span>{unit.label}</span> ·{' '}
                  <span className="unit-match-building">{unit.buildingName}</span>{' '}
                  <span
                    className={`badge ${unit.status === 'available' ? 'badge-pass' : 'badge-warn'} unit-match-badge`}
                  >
                    {unit.status}
                  </span>
                  {isSelected && (
                    <span className="badge badge-accent unit-match-badge">
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
        <div className="unit-match-empty">
          No candidate suggestions found in property records. Pick a unit below:
        </div>
      )}

      {/* All units select (always available, suggestions first) */}
      <div className="unit-match-manual">
        <label
          htmlFor="unit-select-input"
          className="unit-match-label"
        >
          All units in records:
        </label>
        <div className="unit-match-select-row">
          <select
            id="unit-select-input"
            className="unit-match-select"
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
