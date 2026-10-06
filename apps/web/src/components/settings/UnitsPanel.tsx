import { useState } from 'react';
import type { Unit } from '@truelinks/shared';
import { BackIcon, PlusIcon } from '../icons.tsx';
import { AddUnitForm } from './AddUnitForm.tsx';

export interface UnitsPanelProps {
  units: Unit[];
  onUnitsChanged: () => void;
}

export function UnitsPanel({ units, onUnitsChanged }: UnitsPanelProps) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  if (adding) {
    return (
      <section aria-labelledby="add-unit-heading" className="settings-view">
        <button type="button" className="settings-back" onClick={() => setAdding(false)}>
          <BackIcon /> Units
        </button>
        <h3 id="add-unit-heading" className="settings-view-title">
          Add a unit
        </h3>
        <p className="settings-lede">It joins one of your buildings and starts as available.</p>
        <AddUnitForm
          units={units}
          onCancel={() => setAdding(false)}
          onSaved={(unit) => {
            setAdding(false);
            setAdded(unit.unitId);
            onUnitsChanged();
          }}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="units-heading" className="settings-view">
      <div className="settings-view-header">
        <div>
          <h3 id="units-heading" className="settings-view-title">
            Units
          </h3>
          <p className="settings-lede">
            {units.length} units in {new Set(units.map((u) => u.buildingId)).size} buildings.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setAdding(true); setAdded(null); }}>
          <PlusIcon /> Add unit
        </button>
      </div>

      {added && (
        <p className="settings-success" role="status">
          Added {added}.
        </p>
      )}

      <div className="settings-table-wrap">
        <table className="settings-table">
          <thead>
            <tr>
              <th scope="col">Unit</th>
              <th scope="col">Details</th>
              <th scope="col">Building</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.unitId}>
                <td>
                  <span className="settings-unit-id">{u.unitId}</span>
                  <span className="settings-cell-sub">{u.label}</span>
                </td>
                <td className="settings-cell-muted">
                  {u.type} · {u.areaSqm} m²{u.parkingBay ? ` · parking ${u.parkingBay}` : ''}
                </td>
                <td className="settings-cell-muted">{u.buildingName}</td>
                <td>
                  <span className={`badge ${u.status === 'available' ? 'badge-pass' : 'badge-subtle'}`}>{u.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
