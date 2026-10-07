import { useState, useEffect } from 'react';
import type { ConversationDetails } from '@truelinks/shared';
import { parseHash, toHash, type Route, navigate } from './utils/router.ts';
import { HomePage } from './pages/HomePage.tsx';
import { UnitPage } from './pages/UnitPage.tsx';
import { UnassignedPage } from './pages/UnassignedPage.tsx';
import { ReportPage } from './pages/ReportPage.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { useWorkspace } from './hooks/useWorkspace.ts';
import { LeaseThreadPage } from './pages/LeaseThreadPage.tsx';
import { IssueThreadPage } from './pages/IssueThreadPage.tsx';
import { getConversation } from './utils/api.ts';

function ThreadRouter({ conversationId }: { conversationId: string }) {
  const [details, setDetails] = useState<ConversationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getConversation(conversationId)
      .then((loaded) => {
        if (active) {
          setDetails(loaded);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      active = false;
    };
  }, [conversationId]);

  if (error) {
    return (
      <div className="app-container">
        <div className="thread-error-container">
          <h2>Conversation not found</h2>
          <p className="thread-error-text">{error}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate({ name: 'home' })}
          >
            ← Home
          </button>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="app-container">
        <div className="thread-loading">Loading conversation…</div>
      </div>
    );
  }

  if (details.conversation.kind === 'issue') {
    return <IssueThreadPage conversationId={conversationId} initialData={details} />;
  }

  return <LeaseThreadPage conversationId={conversationId} initialData={details} />;
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    function handleHashChange() {
      setRoute(parseHash(window.location.hash));
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // A filter change on the unit page only narrows what is already loaded, so it doesn't reload
  const routeKey = toHash(route.name === 'unit' ? { name: 'unit', unitId: route.unitId, tab: route.tab } : route);
  const { units, reviews, error, reload } = useWorkspace(routeKey);

  const currentUnitId =
    route.name === 'unit' || route.name === 'report'
      ? route.unitId
      : route.name === 'thread'
        ? (reviews.find((r) => r.id === route.conversationId)?.unitId ?? null)
        : null;

  return (
    <div className="app-shell">
      <Sidebar route={route} currentUnitId={currentUnitId} units={units} reviews={reviews} onUnitsChanged={reload} />
      <main className="app-main">
        {error && (
          <div className="form-error-alert" role="alert">
            Couldn't load units: {error}
          </div>
        )}
        {route.name === 'thread' && (
          <ThreadRouter key={route.conversationId} conversationId={route.conversationId} />
        )}
        {route.name === 'unit' && (
          <UnitPage
            unitId={route.unitId}
            tab={route.tab}
            status={route.status}
            urgent={route.urgent ?? false}
            unit={units.find((u) => u.unitId === route.unitId)}
            reviews={reviews}
            onChanged={reload}
          />
        )}
        {route.name === 'unassigned' && <UnassignedPage reviews={reviews} onChanged={reload} />}
        {route.name === 'report' && (
          <ReportPage key={route.unitId ?? ''} units={units} initialUnitId={route.unitId} />
        )}
        {route.name === 'home' && <HomePage />}
      </main>
    </div>
  );
}
