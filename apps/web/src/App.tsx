import { useState, useEffect } from 'react';
import { parseHash, type Route } from './utils/router.ts';
import { StartPage } from './pages/StartPage.tsx';
import { LeaseThreadPage } from './pages/LeaseThreadPage.tsx';

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

  if (route.name === 'thread') {
    return <LeaseThreadPage conversationId={route.conversationId} />;
  }

  return <StartPage />;
}
