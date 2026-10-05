import { useState } from 'react';
import type { Action, IssuePhoto, WorkOrder, WorkOrderCard } from '@truelinks/shared';
import { getIssuePhotoUrl } from '../../utils/api.ts';
import { WorkOrderEditForm } from './WorkOrderEditForm.tsx';

export interface WorkOrderCardViewProps {
  card: WorkOrderCard;
  isInteractive: boolean;
  // The saved work order; the card holds the draft as it was when this message was written
  currentWorkOrder: WorkOrder | null;
  photos: IssuePhoto[];
  conversationId: string;
  onAction: (action: Action) => Promise<void>;
}

const STATUS_BADGE: Record<WorkOrder['status'], string> = {
  draft: 'badge-subtle',
  accepted: 'badge-pass',
  rejected: 'badge-fail',
};

const RESPONSIBILITY_LABEL: Record<WorkOrder['responsibility'], string> = {
  landlord: 'Landlord',
  tenant: 'Tenant',
  split: 'Split',
  unknown: 'Unknown',
};

export function WorkOrderCardView({
  card,
  isInteractive,
  currentWorkOrder,
  photos,
  conversationId,
  onAction,
}: WorkOrderCardViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState<'accept' | 'reject' | null>(null);

  const wo = isInteractive && currentWorkOrder ? currentWorkOrder : card.workOrder;
  const canAct = isInteractive && wo.status === 'draft';

  async function run(type: 'accept' | 'reject') {
    setSubmitting(type);
    try {
      await onAction({ type, cardId: card.id });
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="card-item work-order-card">
      <div className="card-header">
        <h4 className="card-title">{wo.title}</h4>
        <span className={`badge ${STATUS_BADGE[wo.status]}`}>{wo.status}</span>
      </div>

      <div className="work-order-meta">
        <span className="badge badge-accent">Unit {wo.unitId}</span>
        <span className={`badge ${wo.severity === 'high' ? 'badge-fail' : wo.severity === 'medium' ? 'badge-warn' : 'badge-subtle'}`}>
          {wo.severity} severity
        </span>
        {wo.urgent && <span className="badge badge-fail">urgent</span>}
        <span className="badge badge-subtle">{wo.category}</span>
      </div>

      {isEditing ? (
        <WorkOrderEditForm
          workOrder={wo}
          onCancel={() => setIsEditing(false)}
          onSave={async (value) => {
            await onAction({ type: 'edit', cardId: card.id, value });
            setIsEditing(false);
          }}
        />
      ) : (
        <>
          <p className="work-order-description">{wo.description}</p>

          <div className="work-order-responsibility">
            <span className="work-order-label">Responsible: {RESPONSIBILITY_LABEL[wo.responsibility]}</span>
            <span>{wo.responsibilityReason}</span>
            {wo.responsibilityClause && (
              <div className="card-quote-box">
                &ldquo;{wo.responsibilityClause.quote}&rdquo; — {wo.responsibilityClause.heading}
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <div className="work-order-photos">
              {photos.map((p) => (
                <img key={p.id} src={getIssuePhotoUrl(conversationId, p.id)} alt={p.filename} className="work-order-photo" />
              ))}
            </div>
          )}

          {canAct && (
            <div className="card-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => run('accept')} disabled={submitting !== null}>
                {submitting === 'accept' ? 'Saving…' : 'Accept work order'}
              </button>
              <button type="button" className="btn btn-subtle btn-sm" onClick={() => run('reject')} disabled={submitting !== null}>
                {submitting === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
              <button type="button" className="btn btn-subtle btn-sm" onClick={() => setIsEditing(true)} disabled={submitting !== null}>
                Edit
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
