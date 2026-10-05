import { useEffect, useState } from 'react';
import type { ConversationSummary, Unit } from '@truelinks/shared';
import { getUnits, listConversations } from '../utils/api.ts';

export interface Workspace {
  units: Unit[];
  reviews: ConversationSummary[];
  error: string | null;
}

// Units and every lease review / issue report, shared by the sidebar and the unit pages.
// Reloaded whenever the route changes, so a thread's latest status shows once you leave it.
export function useWorkspace(routeKey: string): Workspace {
  const [workspace, setWorkspace] = useState<Workspace>({ units: [], reviews: [], error: null });

  useEffect(() => {
    let active = true;
    Promise.all([getUnits(), listConversations()])
      .then(([units, reviews]) => {
        if (active) setWorkspace({ units, reviews, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setWorkspace((prev) => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
        }
      });
    return () => {
      active = false;
    };
  }, [routeKey]);

  return workspace;
}
