import { useState } from 'react';
import { NewUnit, type Unit } from '@truelinks/shared';
import { addUnit } from '../../utils/api.ts';

export interface AddUnitFormProps {
  units: Unit[];
  onSaved: (unit: Unit) => void;
  onCancel: () => void;
}

export function AddUnitForm({ units, onSaved, onCancel }: AddUnitFormProps) {
  const buildings = [...new Map(units.map((u) => [u.buildingId, `${u.buildingName} · ${u.propertyName}`])).entries()];
  const types = [...new Set(units.map((u) => u.type))];

  const [unitId, setUnitId] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState(types[0] ?? '');
  const [areaSqm, setAreaSqm] = useState('');
  const [parkingBay, setParkingBay] = useState('');
  const [buildingId, setBuildingId] = useState(buildings[0]?.[0] ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = NewUnit.safeParse({
      unitId: unitId.trim().toUpperCase(),
      label,
      type,
      areaSqm: Number(areaSqm),
      parkingBay,
      buildingId,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue ? `${issue.path.join('.') || 'Unit'}: ${issue.message}` : 'Invalid unit');
      return;
    }
    setSaving(true);
    try {
      onSaved(await addUnit(parsed.data));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit} aria-label="Add unit">
      <div className="settings-form-row">
        <label className="settings-field">
          <span className="settings-label">Unit ID</span>
          <input type="text" value={unitId} onChange={(e) => setUnitId(e.target.value)} placeholder="MC-B-1301" required />
        </label>
        <label className="settings-field">
          <span className="settings-label">Label</span>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Apartment 1301" required />
        </label>
        <label className="settings-field">
          <span className="settings-label">Building</span>
          <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            {buildings.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="settings-form-row">
        <label className="settings-field">
          <span className="settings-label">Type</span>
          <input type="text" list="unit-types" value={type} onChange={(e) => setType(e.target.value)} required />
          <datalist id="unit-types">
            {types.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="settings-field settings-field-narrow">
          <span className="settings-label">Area (m²)</span>
          <input type="number" min="1" step="0.1" value={areaSqm} onChange={(e) => setAreaSqm(e.target.value)} required />
        </label>
        <label className="settings-field settings-field-narrow">
          <span className="settings-label">Parking bay</span>
          <input type="text" value={parkingBay} onChange={(e) => setParkingBay(e.target.value)} placeholder="B-90" />
        </label>
      </div>

      {error && <p className="form-error-alert" role="alert">{error}</p>}

      <div className="settings-form-actions">
        <button type="button" className="btn btn-subtle" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save unit'}
        </button>
      </div>
    </form>
  );
}
