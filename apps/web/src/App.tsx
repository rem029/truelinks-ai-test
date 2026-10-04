import { useEffect, useState } from 'react';
import { getHealth } from './utils/api.js';

type HealthStatus =
  | { state: 'loading' }
  | { state: 'ok' }
  | { state: 'error'; message: string };

export function App() {
  const [status, setStatus] = useState<HealthStatus>({ state: 'loading' });

  useEffect(() => {
    let active = true;

    getHealth()
      .then(() => {
        if (active) {
          setStatus({ state: 'ok' });
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const message = err instanceof Error ? err.message : String(err);
          setStatus({ state: 'error', message });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>TrueLinks Lease &amp; Issue Agents</h1>
      <p>
        API:{' '}
        {status.state === 'loading' && 'loading...'}
        {status.state === 'ok' && 'ok'}
        {status.state === 'error' && `unreachable \u2014 ${status.message}`}
      </p>
    </main>
  );
}
