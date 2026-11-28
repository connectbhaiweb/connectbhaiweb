const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  // The Hindi lists are copies of the website's files (see scripts/sync-hindi.mjs); the web lint owns them.
  { ignores: ['src/i18n/generated/**', 'android/**', 'ios/**', 'dist/**', '.expo/**'] },
]);
