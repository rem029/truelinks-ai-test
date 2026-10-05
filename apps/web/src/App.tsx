import { useState, useEffect } from 'react';
import type { ConversationDetails } from '@truelinks/shared';
import { parseHash, type Route, navigate } from './utils/router.ts';
import { StartPage } from './pages/StartPage.tsx';
import { LeaseThreadPage } from './pages/LeaseThreadPage.tsx';
import { IssueThreadPage } from './pages/IssueThreadPage.tsx';
import { ThemeToggle } from './components/ThemeToggle.tsx';
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
            ← Back to Start
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

  return (
    <>
      <ThemeToggle />
      {route.name === 'thread' ? (
        <ThreadRouter key={route.conversationId} conversationId={route.conversationId} />
      ) : (
        <StartPage />
      )}
    </>
  );
}
