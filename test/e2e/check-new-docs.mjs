import { chromium } from 'playwright';
import path from 'node:path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const shotDir = process.argv[3] || '.playwright-mcp';

const results = [];
const check = (name, passed, detail = '') => {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

for (const slug of ['answers/15-typescript', 'answers/16-build-tooling', 'answers/17-web-platform', 'answers/18-performance-tooling', 'answers/19-state-machines']) {
  await page.goto(`${baseUrl}/docs/${slug}`, { waitUntil: 'networkidle' });
  await page.locator('.doc-article').waitFor({ state: 'visible', timeout: 8000 });
  const text = await page.locator('.doc-article').innerText();
  check(`${slug} renders without raw markdown leaking`, !text.includes('```') && !text.includes('##'), `${text.length} chars`);
  const codeBlocks = await page.locator('.prose .md-pre').count();
  check(`${slug} has code blocks`, codeBlocks > 0, `${codeBlocks} blocks`);
}

// The bug found during QA: a double-hyphen anchor that would not resolve.
await page.goto(`${baseUrl}/docs/answers/19-state-machines`, { waitUntil: 'networkidle' });
await page.locator('.doc-article').waitFor({ state: 'visible', timeout: 8000 });
const brokenAnchorLink = page.locator('a[href*="usememo-vs-usecallback"]').first();
const href = await brokenAnchorLink.getAttribute('href');
check('the fixed cross-doc anchor has no double hyphen', href && !href.includes('--'), href);

await brokenAnchorLink.click();
await page.waitForURL(/02-react-core/, { timeout: 5000 });
await page.waitForTimeout(600); // allow scroll-to-anchor to settle
const targetId = href.split('#')[1];
const targetExists = await page.locator(`#${targetId}`).count();
check('the anchor target heading actually exists on the page', targetExists === 1, `#${targetId}`);

// Existing is not enough — cross-document navigate() does not natively scroll a
// custom container, which is the bug this whole check exists to catch.
const targetTop = await page.locator(`#${targetId}`).evaluate((el) => el.getBoundingClientRect().top);
check('clicking the cross-doc anchor actually scrolls the target into view',
  targetTop >= 0 && targetTop < 300, `target top=${Math.round(targetTop)}px from viewport top`);

await page.screenshot({ path: path.join(shotDir, 'new-doc-state-machines.png'), fullPage: false });

await page.goto(`${baseUrl}/docs/answers/15-typescript`, { waitUntil: 'networkidle' });
await page.locator('.doc-article').waitFor({ state: 'visible', timeout: 8000 });
await page.screenshot({ path: path.join(shotDir, 'new-doc-typescript.png'), fullPage: false });

check('no console errors across new docs', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
