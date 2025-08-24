const { defineConfig } = require('@playwright/test');
const path = require('path');

const pathToExtension = path.join(__dirname, 'public');

module.exports = defineConfig({
  use: {
    headless: false, // Extensions only run in headed mode
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    },
  },
  testDir: 'tests/e2e',
});
