// Jest у ESM-режимі: скрипт `npm test` вмикає --experimental-vm-modules, тому transform не потрібен.
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
};
