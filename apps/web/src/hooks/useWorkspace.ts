import { useEffect, useState } from 'react';
import type { ConversationSummary, Unit } from '@truelinks/shared';
import { getUnits, listConversations } from '../utils/api.ts';

interface WorkspaceData {
  units: Unit[];
  reviews: ConversationSummary[];
  error: string | null;
}

export interface Workspace extends WorkspaceData {
  // For changes made outside a route change, e.g. a unit added in Settings
  reload: () => void;
}

// Units and every lease review / issue report, shared by the sidebar and the unit pages.
// Reloaded whenever the route changes, so a thread's latest status shows once you leave it.
export function useWorkspace(routeKey: string): Workspace {
  const [workspace, setWorkspace] = useState<WorkspaceData>({ units: [], reviews: [], error: null });
  const [reloadCount, setReloadCount] = useState(0);

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
  }, [routeKey, reloadCount]);

  return { ...workspace, reload: () => setReloadCount((n) => n + 1) };
}
