import { defineConfig } from '@playwright/test';

const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ipadUA = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const gl = { launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] } };

export default defineConfig({
  testDir: './tests',
  timeout: 240000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:8765', ...gl },
  webServer: {
    command: 'python3 -m http.server 8765',
    cwd: 'robo-dino-island',
    port: 8765,
    reuseExistingServer: true,
    timeout: 20000,
  },
  projects: [
    { name: 'iphone', testIgnore: /shots\.spec/, use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, userAgent: iphoneUA } },
    { name: 'iphone-landscape', testIgnore: /shots\.spec/, use: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, userAgent: iphoneUA } },
    { name: 'ipad', testIgnore: /shots\.spec/, use: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, userAgent: ipadUA } },
    { name: 'ipad-portrait', testIgnore: /shots\.spec/, use: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, userAgent: ipadUA } },
    { name: 'closeup', testMatch: /shots\.spec\.js/, use: { viewport: { width: 932, height: 430 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: iphoneUA } },
  ],
});
