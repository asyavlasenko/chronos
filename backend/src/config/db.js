import mongoose from 'mongoose';
import env from './env.js';

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 3000;

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Підключення до MongoDB з повторними спробами
 * (контейнер mongo може стартувати довше за backend).
 */
export async function connectDb(attempt = 1) {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB підключено (${mongoose.connection.name})`);
    return mongoose.connection;
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) {
      console.error(`MongoDB: не вдалося підключитися після ${attempt} спроб`);
      throw err;
    }
    console.warn(
      `MongoDB: спроба ${attempt}/${MAX_ATTEMPTS} невдала (${err.message}), повтор через ${RETRY_DELAY_MS} мс`,
    );
    await sleep(RETRY_DELAY_MS);
    return connectDb(attempt + 1);
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
