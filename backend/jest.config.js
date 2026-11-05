module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { diagnostics: false }] },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!main.ts'],
};
