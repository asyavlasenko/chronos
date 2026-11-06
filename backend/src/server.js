import http from 'node:http';
import app from './app.js';
import env from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';

const SHUTDOWN_TIMEOUT_MS = 10000;
const server = http.createServer(app);

async function start() {
  await connectDb();
  server.listen(env.port, () => {
    console.log(`Chronos API: http://localhost:${env.port}/api (${env.nodeEnv})`);
  });
}

function shutdown(signal) {
  console.log(`${signal}: зупиняю сервер…`);
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
}

// Вимога ТЗ: «сервіс не має падати за жодних умов» — логуємо й коректно завершуємось
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  shutdown('uncaughtException');
});

start().catch((err) => {
  console.error('Не вдалося запустити сервер:', err);
  process.exit(1);
});
