// @ts-check
/* Cross-browser, cross-device checks for the site. `npm test` runs every project;
   `npx playwright test --project=webkit-iphone` runs one. Browsers come from
   `npx playwright install --with-deps chromium firefox webkit`. */
const { defineConfig, devices } = require('@playwright/test');

/* software GL so the WebGL scenes render on a machine without a GPU */
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const chromium = function (device, extra) {
  var d = device ? devices[device] : {};
  return Object.assign({}, d, { browserName: 'chromium', launchOptions: { args: GL.concat(extra || []) } });
};

module.exports = defineConfig({
  testDir: './tests',
  /* the stage-by-stage check scrolls through ~85 cards, which is slow on a shared runner */
  timeout: 600000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL: 'http://127.0.0.1:8765', trace: process.env.CI ? 'off' : 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'python3 -m http.server 8765 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8765/index.html',
    reuseExistingServer: true,
    timeout: 20000
  },
  projects: [
    /* Chromium: desktop, laptop, tablet, phones */
    { name: 'chromium-desktop',   use: chromium('Desktop Chrome', []) },
    { name: 'chromium-laptop',    use: Object.assign(chromium('Desktop Chrome'), { viewport: { width: 1366, height: 768 } }) },
    { name: 'chromium-ipad',      use: chromium('iPad Mini') },
    { name: 'chromium-iphone',    use: chromium('iPhone 14 Pro') },
    { name: 'chromium-iphone-se', use: chromium('iPhone SE') },
    { name: 'chromium-pixel',     use: chromium('Pixel 7') },
    { name: 'chromium-landscape', use: chromium('iPhone 14 Pro landscape') },
    /* the 2D fallback, and a browser that keeps only a few WebGL contexts alive (as iOS does) */
    { name: 'chromium-no-webgl',  use: chromium('Desktop Chrome', ['--disable-3d-apis']) },
    { name: 'chromium-few-gl',    use: chromium('iPhone 14 Pro', ['--max-active-webgl-contexts=4']) },
    /* Firefox and WebKit */
    { name: 'firefox-desktop',    use: Object.assign({}, devices['Desktop Firefox']) },
    { name: 'firefox-phone',      use: { browserName: 'firefox', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true } },
    { name: 'webkit-desktop',     use: Object.assign({}, devices['Desktop Safari']) },
    { name: 'webkit-ipad',        use: Object.assign({}, devices['iPad Mini']) },
    { name: 'webkit-iphone',      use: Object.assign({}, devices['iPhone 14 Pro']) }
  ]
});
