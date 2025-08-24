module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/unit/**/*.test.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {
    // Handle module aliases (if you have them)
  },
  // This is needed to support ES modules in node_modules.
  transformIgnorePatterns: ['/node_modules/(?!some-es-module).+\\.js$'],
};
