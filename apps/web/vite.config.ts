import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const repoRoot = resolve(import.meta.dirname, '../..');
  const env = loadEnv(mode, repoRoot, '');

  const apiPort = env.API_PORT || '8083';
  const webPort = Number(env.WEB_PORT || 3000);
  const allowedHostsRaw = env.WEB_ALLOWED_HOSTS?.trim();
  const allowedHosts = allowedHostsRaw
    ? allowedHostsRaw.split(',').map((h) => h.trim()).filter(Boolean)
    : undefined;

  // The browser calls same-origin /api/..., so no CORS and no VITE_API_URL; works identically on localhost and behind the dev proxy.
  return {
    plugins: [react()],
    envDir: repoRoot,
    server: {
      port: webPort,
      strictPort: true,
      host: true,
      allowedHosts: allowedHosts && allowedHosts.length > 0 ? allowedHosts : undefined,
      proxy: {
        '/api': `http://localhost:${apiPort}`,
      },
    },
  };
});
