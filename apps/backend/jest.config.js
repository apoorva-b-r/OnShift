module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@onshift/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@onshift/credential-schema$': '<rootDir>/../../packages/credential-schema/src/index.ts',
    '^@onshift/mock-data$': '<rootDir>/../../packages/mock-data/src/index.ts',
  },
};
