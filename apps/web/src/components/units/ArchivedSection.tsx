import { useState, type ReactNode } from 'react';

export interface ArchivedSectionProps {
  count: number;
  children: ReactNode;
}

// Archived lease reviews and issue reports stay out of the way until asked for
export function ArchivedSection({ count, children }: ArchivedSectionProps) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <section className="archived-reviews" aria-label="Archived">
      <button type="button" className="btn btn-subtle btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide archived' : 'Show archived'} <span className="tab-count">{count}</span>
      </button>
      {open && children}
    </section>
  );
}
