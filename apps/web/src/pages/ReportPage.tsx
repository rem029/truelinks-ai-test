import { useState } from 'react';
import type { Unit } from '@truelinks/shared';
import { createConversation } from '../utils/api.ts';
import { navigate } from '../utils/router.ts';

export interface ReportPageProps {
  units: Unit[];
  initialUnitId: string | null;
}

export function ReportPage({ units, initialUnitId }: ReportPageProps) {
  const [unitId, setUnitId] = useState(initialUnitId ?? '');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStarting(true);
    setError(null);
    try {
      const conversation = await createConversation('issue', unitId);
      navigate({ name: 'thread', conversationId: conversation.id });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStarting(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Report an issue</h1>
          <p className="page-subtitle">Pick the unit, then add photos and a note on the next screen.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="inline-issue-form">
        <label htmlFor="report-unit" className="form-label">
          Unit
        </label>
        <div className="inline-issue-controls">
          <select
            id="report-unit"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
            className="inline-issue-select"
            disabled={starting}
          >
            <option value="">Select a unit…</option>
            {units.map((u) => (
              <option key={u.unitId} value={u.unitId}>
                {u.unitId} — {u.label} ({u.status})
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary" disabled={starting || !unitId}>
            {starting ? 'Starting…' : 'Start report'}
          </button>
        </div>
        {error && (
          <div className="form-error-alert" role="alert">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
