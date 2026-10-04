import { createApp } from './app.js';
import { env } from './env.js';

const app = createApp();

app.listen(env.API_PORT, '0.0.0.0', () => {
  console.log(`API listening on http://0.0.0.0:${env.API_PORT}`);
});
