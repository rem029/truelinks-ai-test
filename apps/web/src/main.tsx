import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { NoticeProvider } from './components/Notice.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <NoticeProvider>
      <App />
    </NoticeProvider>
  </StrictMode>
);
