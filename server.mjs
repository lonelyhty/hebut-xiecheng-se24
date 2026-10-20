import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createApplication } from './server/app.mjs';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5180);
const host = process.env.HOST || '127.0.0.1';

const app = await createApplication({
  rootDir,
  logger: ({ method, path: requestPath, status, durationMs }) => {
    console.log(`${method} ${requestPath} ${status} ${durationMs}ms`);
  }
});

app.server.listen(port, host, () => {
  const address = app.server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  console.log('');
  console.log('橙程航空旅行一站式服务平台');
  console.log(`  本地地址: http://${host}:${actualPort}/`);
  console.log(`  健康检查: http://${host}:${actualPort}/api/health`);
  console.log('  按 Ctrl+C 停止服务');
  console.log('');
});

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`\n收到 ${signal}，正在停止服务...`);
  try {
    await app.close();
  } catch (error) {
    console.error('停止服务失败:', error.message);
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
