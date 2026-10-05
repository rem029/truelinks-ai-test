import { useState, useEffect } from 'react';
import type { ConversationSummary } from '@truelinks/shared';
import { createConversation, listConversations } from '../utils/api.ts';
import { navigate } from '../utils/router.ts';
import { formatShortDate } from '../utils/formatters.ts';

export function StartPage() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<ConversationSummary[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    let active = true;
    listConversations('lease')
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

  return (
    <div className="app-container">
      <main className="start-page">
        <header className="start-header">
          <h1>Lease Review Agent</h1>
          <p>
            Turn lease agreements into verified structured records. The AI assistant extracts
            key terms with verbatim clause quotes, highlights compliance rules, flags issues,
            and keeps you in control of final confirmation.
          </p>
        </header>

        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStart}
            disabled={creating}
            style={{ fontSize: '1rem', padding: '0.625rem 1.25rem' }}
          >
            {creating ? 'Starting review…' : 'New lease review'}
          </button>
        </div>

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
                const filenameText = rev.filename ?? 'No document yet';

                let statusBadge: React.ReactNode;
                if (rev.status === 'confirmed' || rev.leaseStatus === 'confirmed') {
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
                        <span className="reviews-filename">{filenameText}</span>
                        {rev.unitId && (
                          <span className="badge badge-accent">Unit {rev.unitId}</span>
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
