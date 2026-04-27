/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  clearMocks: true,
  // Firebase Auth나 Firestore 등 무거운 모듈 로딩 시 timeout 증가
  testTimeout: 10000,
};
