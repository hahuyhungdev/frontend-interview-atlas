/**
 * Captures real browser screenshots of the key surfaces for visual review.
 *
 * Usage: node test/e2e/screens.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const outDir = process.argv[3] || path.join(process.cwd(), '.playwright-mcp');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function shot(name, { width, height, url, prepare, scrollTo }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2, // retina-density, so text renders as a real display would
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'networkidle' });
  if (prepare) await prepare(page);
  await page.waitForTimeout(400); // let webfonts settle before capturing
  if (scrollTo) {
    await page.locator('.doc-scroller').evaluate((el, y) => el.scrollTo(0, y), scrollTo);
    await page.waitForTimeout(250);
  }
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`captured ${name}  (${width}x${height})`);
  await context.close();
}

const docsReady = (page) => page.locator('.doc-article').waitFor({ state: 'visible', timeout: 8000 });

await shot('view-docs-top', {
  width: 1440, height: 1000, url: '/docs/frontend-react-insights', prepare: docsReady,
});
await shot('view-docs-prose', {
  width: 1440, height: 1000, url: '/docs/frontend-react-insights',
  prepare: docsReady, scrollTo: 900,
});
await shot('view-docs-code', {
  width: 1440, height: 1000, url: '/docs/answers/01-javascript',
  prepare: docsReady, scrollTo: 1400,
});
await shot('view-docs-table', {
  width: 1440, height: 1000, url: '/docs/frontend-knowledge-map',
  prepare: docsReady, scrollTo: 700,
});
await shot('view-posts', { width: 1440, height: 1000, url: '/' });
await shot('view-mobile', {
  width: 390, height: 844, url: '/docs/core-insights', prepare: docsReady,
});

await browser.close();
console.log(`\noutput: ${outDir}`);
