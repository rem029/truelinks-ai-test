import type { ConversationSummary } from '@truelinks/shared';
import { ARCHIVED_FILTER, isUrgent, matchesStatus, type StatusFilter } from '../../utils/unitFilters.ts';

export interface StatusFilterBarProps {
  // Every item on the tab, archived ones included
  items: ConversationSummary[];
  filters: StatusFilter[];
  status: string | undefined;
  // Only the Issues tab has the Urgent toggle
  urgent: boolean | null;
  label: string;
  onChange: (status: string | undefined, urgent: boolean) => void;
}

// Toggle chips above a unit's list; each shows how many items it would show, and an empty one is hidden
export function StatusFilterBar({ items, filters, status, urgent, label, onChange }: StatusFilterBarProps) {
  const pool = urgent ? items.filter(isUrgent) : items;
  const chips = [
    { id: undefined, label: 'All' },
    ...filters,
    { id: ARCHIVED_FILTER, label: 'Archived' },
  ].map((chip) => ({ ...chip, count: pool.filter((r) => matchesStatus(r, chip.id, filters)).length }));
  const urgentCount = items.filter((r) => isUrgent(r) && matchesStatus(r, status, filters)).length;

  return (
    <div className="filter-bar" role="group" aria-label={label}>
      {chips.map((chip) => {
        const pressed = chip.id === status;
        if (chip.id && chip.count === 0 && !pressed) return null;
        return (
          <button
            key={chip.id ?? 'all'}
            type="button"
            className="filter-chip"
            aria-pressed={pressed}
            // Pressing the selected chip again clears it
            onClick={() => onChange(pressed ? undefined : chip.id, urgent ?? false)}
          >
            {chip.label} <span className="filter-chip-count">{chip.count}</span>
          </button>
        );
      })}
      {urgent !== null && (urgentCount > 0 || urgent) && (
        <button
          type="button"
          className="filter-chip filter-chip-urgent"
          aria-pressed={urgent}
          onClick={() => onChange(status, !urgent)}
        >
          Urgent <span className="filter-chip-count">{urgentCount}</span>
        </button>
      )}
    </div>
  );
}
