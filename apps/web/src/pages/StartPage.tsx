import { useState, useEffect } from 'react';
import type { ConversationSummary, Unit } from '@truelinks/shared';
import { createConversation, listConversations, getUnits } from '../utils/api.ts';
import { navigate } from '../utils/router.ts';
import { formatShortDate } from '../utils/formatters.ts';

export function StartPage() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<ConversationSummary[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Issue reporting inline state
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listConversations()
      .then((list) => {
        if (active) {
          setReviews(list);
          setLoadingReviews(false);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load past reviews', err);
        if (active) {
          setLoadingReviews(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleStart() {
    setCreating(true);
    setError(null);
    try {
      const conv = await createConversation('lease');
      navigate({ name: 'thread', conversationId: conv.id });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }

  async function handleOpenIssueForm() {
    setShowIssueForm(true);
    setIssueError(null);
    if (units.length === 0) {
      setLoadingUnits(true);
      try {
        const list = await getUnits();
        setUnits(list);
      } catch (err: unknown) {
        setIssueError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingUnits(false);
      }
    }
  }

  async function handleCreateIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUnitId) {
      setIssueError('Please select a unit');
      return;
    }

    setCreatingIssue(true);
    setIssueError(null);
    try {
      const conv = await createConversation('issue', selectedUnitId);
      navigate({ name: 'thread', conversationId: conv.id });
    } catch (err: unknown) {
      setIssueError(err instanceof Error ? err.message : String(err));
      setCreatingIssue(false);
    }
  }

  return (
    <div className="app-container">
      <main className="start-page">
        <header className="start-header">
          <h1>Lease & Issue Agents</h1>
          <p>
            Turn lease agreements into verified structured records, or submit unit photos
            for automatic damage analysis and equipment inspection.
          </p>
        </header>

        <div className="start-actions-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStart}
            disabled={creating || creatingIssue}
            style={{ fontSize: '1rem', padding: '0.625rem 1.25rem' }}
          >
            {creating ? 'Starting review…' : 'New lease review'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenIssueForm}
            disabled={creating || creatingIssue || showIssueForm}
            style={{ fontSize: '1rem', padding: '0.625rem 1.25rem' }}
          >
            Report an issue
          </button>
        </div>

        {/* Inline unit selector form for issue report */}
        {showIssueForm && (
          <form onSubmit={handleCreateIssue} className="inline-issue-form">
            <h3 className="inline-issue-title">Report an issue for unit</h3>
            {loadingUnits ? (
              <p className="inline-issue-loading">Loading units…</p>
            ) : (
              <div className="inline-issue-controls">
                <select
                  value={selectedUnitId}
                  onChange={(e) => {
                    setSelectedUnitId(e.target.value);
                    setIssueError(null);
                  }}
                  required
                  className="inline-issue-select"
                  disabled={creatingIssue}
                >
                  <option value="">Select a unit…</option>
                  {units.map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      {u.unitId} — {u.label} ({u.status})
                    </option>
                  ))}
                </select>

                <div className="inline-issue-buttons">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={creatingIssue || !selectedUnitId}
                  >
                    {creatingIssue ? 'Starting…' : 'Start report'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-subtle btn-sm"
                    onClick={() => {
                      setShowIssueForm(false);
                      setIssueError(null);
                    }}
                    disabled={creatingIssue}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {issueError && (
              <div className="form-error-alert" role="alert">
                <span>{issueError}</span>
              </div>
            )}
          </form>
        )}

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--fail-bg)',
              color: 'var(--fail-text)',
              border: '1px solid var(--fail-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        <section className="reviews-section" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="reviews-heading">
            Reviews
          </h2>
          {loadingReviews ? (
            <p className="reviews-empty">Loading reviews…</p>
          ) : reviews.length === 0 ? (
            <p className="reviews-empty">No reviews yet</p>
          ) : (
            <ul className="reviews-list" role="list">
              {reviews.map((rev) => {
                const isIssue = rev.kind === 'issue';
                const titleText = isIssue ? 'Issue report' : (rev.filename ?? 'No document yet');
                const photoCountText =
                  isIssue && rev.photoCount !== null
                    ? `${rev.photoCount} ${rev.photoCount === 1 ? 'photo' : 'photos'}`
                    : null;

                let statusBadge: React.ReactNode;
                if (isIssue) {
                  statusBadge = <span className="badge badge-subtle">{rev.status}</span>;
                } else if (rev.status === 'confirmed' || rev.leaseStatus === 'confirmed') {
                  statusBadge = <span className="badge badge-pass">Confirmed</span>;
                } else if (rev.analysisStatus === 'pending') {
                  statusBadge = <span className="badge badge-warn">Analysing…</span>;
                } else if (rev.leaseStatus === 'draft') {
                  const openCount = rev.openItems ?? 0;
                  statusBadge = (
                    <span className="badge badge-subtle">
                      Draft · {openCount} {openCount === 1 ? 'open item' : 'open items'}
                    </span>
                  );
                } else {
                  statusBadge = <span className="badge badge-subtle">{rev.status}</span>;
                }

                return (
                  <li key={rev.id} className="reviews-item">
                    <a href={`#/c/${encodeURIComponent(rev.id)}`} className="reviews-link">
                      <div className="reviews-item-main">
                        <span className="reviews-filename">{titleText}</span>
                        {rev.unitId && (
                          <span className="badge badge-accent">Unit {rev.unitId}</span>
                        )}
                        {photoCountText && (
                          <span className="badge badge-subtle">{photoCountText}</span>
                        )}
                        {statusBadge}
                      </div>
                      <time className="reviews-date" dateTime={rev.updatedAt}>
                        {formatShortDate(rev.updatedAt)}
                      </time>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
