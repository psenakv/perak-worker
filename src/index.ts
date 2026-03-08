import { WorkerConnection } from './connection';

const ADMIN_WS_URL = process.env.ADMIN_WS_URL;
const WORKER_TOKEN = process.env.WORKER_TOKEN;

if (!ADMIN_WS_URL) {
  console.error('[worker] ADMIN_WS_URL environment variable is required');
  process.exit(1);
}

if (!WORKER_TOKEN) {
  console.error('[worker] WORKER_TOKEN environment variable is required');
  process.exit(1);
}

console.log(`[worker] Starting Perak Worker`);
console.log(`[worker] Admin URL: ${ADMIN_WS_URL}`);

const connection = new WorkerConnection(ADMIN_WS_URL, WORKER_TOKEN);
connection.start();

const shutdown = (signal: string) => {
  console.log(`[worker] Received ${signal}, shutting down...`);
  connection.stop();
  setTimeout(() => process.exit(0), 1000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[worker] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[worker] Unhandled rejection:', reason);
});
