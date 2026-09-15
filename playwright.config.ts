import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5187',
    viewport: {width: 1440, height: 1000},
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform==='win32'?'msedge':undefined),
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
  },
})
