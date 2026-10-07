import { useState, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useMatch, useNavigate, useParams } from 'react-router';
import type { ConversationDetails, Unit } from '@truelinks/shared';
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
  const navigate = useNavigate();
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
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
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

// Keyed by the URL's ID so moving between threads, or between units on the report form, starts fresh
function ThreadRoute() {
  const { conversationId = '' } = useParams();
  return <ThreadRouter key={conversationId} conversationId={conversationId} />;
}

function ReportRoute({ units }: { units: Unit[] }) {
  const { unitId } = useParams();
  return <ReportPage key={unitId ?? ''} units={units} initialUnitId={unitId ?? null} />;
}

export function App() {
  // Reloaded on every path change, so a thread's latest status shows once you leave it.
  // A filter change (the ?query) only narrows what is already loaded, so it doesn't reload.
  const { pathname } = useLocation();
  const { units, reviews, error, reload } = useWorkspace(pathname);

  const unitMatch = useMatch('/u/:unitId/*');
  const reportMatch = useMatch('/report/:unitId');
  const threadMatch = useMatch('/c/:conversationId');
  const currentUnitId =
    unitMatch?.params.unitId ??
    reportMatch?.params.unitId ??
    reviews.find((r) => r.id === threadMatch?.params.conversationId)?.unitId ??
    null;

  return (
    <div className="app-shell">
      <Sidebar currentUnitId={currentUnitId} units={units} reviews={reviews} onUnitsChanged={reload} />
      <main className="app-main">
        {error && (
          <div className="form-error-alert" role="alert">
            Couldn't load units: {error}
          </div>
        )}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/c/:conversationId" element={<ThreadRoute />} />
          <Route path="/u/:unitId" element={<Navigate to="issues" replace />} />
          <Route path="/u/:unitId/:tab" element={<UnitPage units={units} reviews={reviews} onChanged={reload} />} />
          <Route path="/unassigned" element={<UnassignedPage reviews={reviews} onChanged={reload} />} />
          <Route path="/report/:unitId?" element={<ReportRoute units={units} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
