import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Notify = (message: string) => void;

const NoticeContext = createContext<Notify>(() => {});

// A short confirmation after an action whose result leaves the screen (a row archived, a thread deleted).
// It lives above the routes, so it survives the navigation that follows a delete.
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; key: number } | null>(null);
  const notify = useCallback<Notify>((message) => setNotice({ message, key: Date.now() }), []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <div className="notice-region" role="status" aria-live="polite">
        {notice && (
          <p key={notice.key} className="notice">
            {notice.message}
          </p>
        )}
      </div>
    </NoticeContext.Provider>
  );
}

export function useNotice(): Notify {
  return useContext(NoticeContext);
}
