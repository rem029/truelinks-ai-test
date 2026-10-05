import { useState } from 'react';
import type { Responsibility, Severity, WorkOrder } from '@truelinks/shared';

export interface WorkOrderEditValue {
  title: string;
  description: string;
  category: string;
  severity: Severity;
  urgent: boolean;
  responsibility: Responsibility;
}

export interface WorkOrderEditFormProps {
  workOrder: WorkOrder;
  onSave: (value: Partial<WorkOrderEditValue>) => Promise<void>;
  onCancel: () => void;
}

const SEVERITIES: Severity[] = ['low', 'medium', 'high'];
const RESPONSIBILITIES: Responsibility[] = ['landlord', 'tenant', 'split', 'unknown'];

export function WorkOrderEditForm({ workOrder, onSave, onCancel }: WorkOrderEditFormProps) {
  const [value, setValue] = useState<WorkOrderEditValue>({
    title: workOrder.title,
    description: workOrder.description,
    category: workOrder.category,
    severity: workOrder.severity,
    urgent: workOrder.urgent,
    responsibility: workOrder.responsibility,
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof WorkOrderEditValue>(key: K, next: WorkOrderEditValue[K]) {
    setValue((prev) => ({ ...prev, [key]: next }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Send only what changed, so the server keeps the quoted clause unless the party changed
    const changed = Object.fromEntries(
      Object.entries(value).filter(([key, v]) => workOrder[key as keyof WorkOrderEditValue] !== v)
    ) as Partial<WorkOrderEditValue>;
    if (Object.keys(changed).length === 0) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(changed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="work-order-edit" onSubmit={handleSubmit}>
      <label className="form-group">
        <span className="form-label">Title</span>
        <input type="text" value={value.title} maxLength={120} required onChange={(e) => update('title', e.target.value)} />
      </label>
      <label className="form-group">
        <span className="form-label">What's wrong</span>
        <textarea rows={3} value={value.description} maxLength={1000} required onChange={(e) => update('description', e.target.value)} />
      </label>
      <div className="work-order-edit-row">
        <label className="form-group">
          <span className="form-label">Category</span>
          <input type="text" value={value.category} required onChange={(e) => update('category', e.target.value)} />
        </label>
        <label className="form-group">
          <span className="form-label">Severity</span>
          <select value={value.severity} onChange={(e) => update('severity', e.target.value as Severity)}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="form-group">
          <span className="form-label">Responsible</span>
          <select value={value.responsibility} onChange={(e) => update('responsibility', e.target.value as Responsibility)}>
            {RESPONSIBILITIES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="work-order-edit-check">
        <input type="checkbox" checked={value.urgent} onChange={(e) => update('urgent', e.target.checked)} />
        Urgent
      </label>
      <div className="card-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-subtle btn-sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
