import mongoose from 'mongoose';
import env from '../../src/config/env.js';

export async function connectTestDb(name) {
  await mongoose.connect(env.mongoUriTest, {
    dbName: `chronos_test_${name}`,
    serverSelectionTimeoutMS: 5000,
  });
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

export async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
