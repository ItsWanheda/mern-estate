import { loadConfig } from '../config/env.js';
import { createApp } from '../app.js';

export async function startTestApp(envOverrides = {}, appOptions = {}) {
  const config = loadConfig({ NODE_ENV: 'test', ...envOverrides });
  const { app, close } = createApp({ config, ...appOptions });
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    config,
    stop: () => new Promise((resolve) => { close(); server.close(resolve); server.closeAllConnections(); }),
  };
}
