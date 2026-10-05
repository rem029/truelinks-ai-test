import type { WorkOrderCard } from '@truelinks/shared';

export interface WorkOrderCardViewProps {
  card: WorkOrderCard;
}

export function WorkOrderCardView({ card }: WorkOrderCardViewProps) {
  const wo = card.workOrder;
  return (
    <div className="card-item work-order-card">
      <div className="card-header">
        <h4 className="card-title">Work Order: {wo.title}</h4>
        <span className="badge badge-subtle">{wo.severity}</span>
      </div>
      <p style={{ fontSize: '0.875rem' }}>{wo.description}</p>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        Category: {wo.category} · Responsibility: {wo.responsibility}
      </div>
    </div>
  );
}
