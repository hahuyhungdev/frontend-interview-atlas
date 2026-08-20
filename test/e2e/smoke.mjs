/**
 * End-to-end smoke test for the dashboard.
 *
 * Usage:  node test/e2e/smoke.mjs [baseUrl] [screenshotDir]
 * Assumes a built dashboard (npm run build) and a running server (npm start).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const shotDir = process.argv[3] || path.join(process.cwd(), '.playwright-mcp');
fs.mkdirSync(shotDir, { recursive: true });

const results = [];
const check = (name, passed, detail = '') => {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

try {
  // ---------------------------------------------------------------- docs list
  await page.goto(`${baseUrl}/docs`, { waitUntil: 'networkidle' });

  const navLinks = page.locator('.doc-index-link');
  const docCount = await navLinks.count();
  check('document index lists study docs', docCount >= 10, `${docCount} documents`);

  // Redirects to the first document rather than showing an empty pane.
  check('lands on a document', /\/docs\/.+/.test(page.url()), page.url());

  const article = page.locator('.doc-article');
  await article.waitFor({ state: 'visible', timeout: 5000 });

  // ------------------------------------------------------- markdown rendering
  const h1 = await page.locator('.doc-title').first().textContent();
  check('renders a heading element (not raw "#")', Boolean(h1) && !h1.includes('#'), h1?.slice(0, 48));

  const rawMarkup = await page.locator('.doc-article').innerText();
  check('no raw markdown fences leaked', !rawMarkup.includes('```'));
  check('no raw bold markers leaked', !/\*\*[A-Za-z]/.test(rawMarkup));

  // ------------------------------------------------------------- typography
  // Which family in the reading stack this machine can actually render.
  const fontReport = await page.evaluate(() => {
    const stack = getComputedStyle(document.querySelector('.prose')).fontFamily;
    const families = stack.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''));
    const available = families.filter(
      (f) => !['serif', 'sans-serif', 'monospace'].includes(f) && document.fonts.check(`21px "${f}"`)
    );
    return { stack, available, resolved: available[0] ?? `generic ${families[families.length - 1]}` };
  });
  check('reading font resolves to a named family, not a generic fallback',
    !fontReport.resolved.startsWith('generic'), fontReport.resolved);

  const fontSize = await page.locator('.prose').first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check('prose font size is large (>= 18px)', fontSize >= 18, `${fontSize}px`);

  const lineHeight = await page.locator('.prose .md-p').first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return parseFloat(s.lineHeight) / parseFloat(s.fontSize);
    });
  check('line height is comfortable (>= 1.6)', lineHeight >= 1.6, lineHeight.toFixed(2));

  const measure = await page.locator('.prose').first().evaluate((el) => el.getBoundingClientRect().width);
  check('measure is capped for readability (<= 1000px)', measure <= 1000, `${Math.round(measure)}px`);
  check('measure is wide enough to read (>= 560px)', measure >= 560, `${Math.round(measure)}px`);

  // Characters per line is the metric that actually matters for reading comfort.
  const cpl = await page.locator('.doc-article .prose .md-p').first().evaluate((el) => {
    const probe = document.createElement('span');
    probe.textContent = '0';
    probe.style.font = getComputedStyle(el).font;
    document.body.appendChild(probe);
    const chWidth = probe.getBoundingClientRect().width;
    probe.remove();
    return el.getBoundingClientRect().width / chWidth;
  });
  check('line length is in the readable range (55-95 chars)', cpl >= 55 && cpl <= 95,
    `${Math.round(cpl)} chars/line`);

  // Page-level overflow does not catch clipping inside the scroller, which has
  // its own overflow context. Measure that box directly.
  const clipping = await page.evaluate(() => {
    const chain = ['main', '.doc-layout', '.doc-reader', '.doc-scroller', '.doc-columns', '.doc-article', '.doc-article .prose'];
    const boxes = chain.map((sel) => {
      const el = document.querySelector(sel);
      return el ? { sel, client: el.clientWidth, scroll: el.scrollWidth } : { sel, client: -1, scroll: -1 };
    });
    const scroller = document.querySelector('.doc-scroller');
    return { boxes, overflow: scroller ? scroller.scrollWidth - scroller.clientWidth : -1 };
  });
  if (process.env.DEBUG_BOX) console.table(clipping.boxes);
  check('article does not overflow its scroll container horizontally',
    clipping.overflow <= 0, `${clipping.overflow}px overflow`);

  // The reading column should sit in the middle of the space left by the rails.
  const centering = await page.evaluate(() => {
    const scroller = document.querySelector('.doc-scroller');
    const header = document.querySelector('.doc-header');
    if (!scroller || !header) return null;
    const s = scroller.getBoundingClientRect();
    const h = header.getBoundingClientRect();
    return { left: h.left - s.left, right: s.right - h.right };
  });
  check('reading column is horizontally centred',
    centering !== null && Math.abs(centering.left - centering.right) <= 24,
    centering ? `left=${Math.round(centering.left)} right=${Math.round(centering.right)}` : 'not found');

  await page.screenshot({ path: path.join(shotDir, 'docs-desktop.png'), fullPage: false });

  // -------------------------------------------------- navigation to a doc with code
  // Target by href: "Answer Bank 1" also matches Answer Bank 10, 11 and 12.
  await page.locator('a[href="/docs/answers/01-javascript"]').click();
  await page.waitForURL(/answers\/01-javascript/);
  // The URL changes before React commits; wait for the rendered document to catch up.
  await page.locator('.doc-title', { hasText: 'Core & Async' }).waitFor({ timeout: 8000 });
  await page.locator('.prose .md-pre').first().waitFor({ state: 'visible', timeout: 5000 });

  const preCount = await page.locator('.prose .md-pre').count();
  check('renders fenced code blocks', preCount > 5, `${preCount} blocks`);

  if (process.env.DEBUG_NAV) {
    console.log('URL at nav check:', page.url());
    console.log('doc title:', await page.locator('.doc-title').textContent());
    console.log(await page.locator('.doc-index-link').evaluateAll((els) =>
      els.map((e) => `${e.getAttribute('href')} :: ${e.className} :: aria-current=${e.getAttribute('aria-current')}`)));
  }
  const activeNav = await page.locator('.doc-index-link.is-active').allTextContents();
  check('exactly one nav item is active', activeNav.length === 1, JSON.stringify(activeNav));
  check('active nav matches the open document',
    activeNav[0]?.includes('Core & Async'), activeNav[0]);

  // The reader must show the document, not an outline that fills the viewport.
  const titleBox = await page.locator('.doc-title').boundingBox();
  check('document title is visible on landing', titleBox !== null && titleBox.y < 900,
    titleBox ? `y=${Math.round(titleBox.y)}` : 'not found');

  const firstBody = await page.locator('.doc-article .prose .md-h2, .doc-article .prose .md-p')
    .first().boundingBox();
  check('body content starts within the first screen',
    firstBody !== null && firstBody.y < 900, firstBody ? `y=${Math.round(firstBody.y)}` : 'not found');

  const titleText = await page.locator('.doc-title').textContent();
  const h1Count = await page.locator('.doc-article .prose .md-h1').count();
  check('document title is not duplicated', h1Count === 0, `${h1Count} in-body H1s, header="${titleText?.slice(0, 30)}"`);

  const tableCount = await page.locator('.prose .md-table').count();
  check('renders markdown tables', tableCount >= 1, `${tableCount} tables`);

  const overflowX = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal page overflow', overflowX <= 1, `${overflowX}px`);

  await page.screenshot({ path: path.join(shotDir, 'docs-code.png'), fullPage: false });

  const firstPre = page.locator('.prose .md-pre').first();
  await firstPre.scrollIntoViewIfNeeded();
  const tokenCount = await page.locator('.prose .md-pre .hljs-keyword, .prose .md-pre .hljs-string').count();
  check('code blocks are syntax highlighted', tokenCount > 0, `${tokenCount} tokens`);
  await page.screenshot({ path: path.join(shotDir, 'docs-codeblock.png'), fullPage: false });

  // ------------------------------------------------------------------ the TOC
  const tocLinks = await page.locator('.doc-toc a').count();
  check('table of contents generated', tocLinks > 3, `${tocLinks} entries`);

  // The outline is a pre-reading aid, so it must sit above the body text.
  const tocBox = await page.locator('.doc-toc').boundingBox();
  const bodyBox = await page.locator('.doc-article .prose').boundingBox();
  check('outline sits above the article body',
    tocBox !== null && bodyBox !== null && tocBox.y < bodyBox.y,
    `toc y=${Math.round(tocBox?.y ?? -1)}, body y=${Math.round(bodyBox?.y ?? -1)}`);

  // Cross-document links navigate in-app rather than reloading or 404ing.
  const crossLink = page.locator('.doc-article a[data-doc-link]').first();
  check('cross-document links are rewritten to app routes',
    (await crossLink.count()) > 0,
    (await crossLink.getAttribute('href')) ?? 'none');

  const backtickLeak = await page.locator('.doc-article a').first().textContent();
  check('link labels render inline formatting', !backtickLeak?.includes('`'), backtickLeak?.slice(0, 40));

  await crossLink.click();
  await page.waitForURL(/\/docs\/frontend-knowledge-map/, { timeout: 5000 })
    .then(() => check('cross-document link navigates in-app', true, page.url()))
    .catch(() => check('cross-document link navigates in-app', false, page.url()));
  await page.goBack();
  await page.locator('.doc-title', { hasText: 'Core & Async' }).waitFor({ timeout: 8000 });

  // ---------------------------------------------------- article modal markdown
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.getByText('BrowserStack Frontend Developer Interview Experience').first().click();
  const modalProse = page.locator('.prose').first();
  await modalProse.waitFor({ state: 'visible', timeout: 8000 });
  const modalText = await modalProse.innerText();
  check('article modal renders markdown', !modalText.includes('```') && modalText.length > 200,
    `${modalText.length} chars`);
  await page.screenshot({ path: path.join(shotDir, 'article-modal.png') });
  await page.keyboard.press('Escape');

  // -------------------------------------------- wide screen: the TOC rail
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${baseUrl}/docs/frontend-react-insights`, { waitUntil: 'networkidle' });
  await page.locator('.doc-article').waitFor({ state: 'visible', timeout: 8000 });

  const wide = await page.evaluate(() => {
    const scroller = document.querySelector('.doc-scroller');
    const columns = document.querySelector('.doc-columns');
    const prose = document.querySelector('.doc-article .prose');
    const toc = document.querySelector('.doc-toc');
    if (!scroller || !columns || !prose) return null;
    const s = scroller.getBoundingClientRect();
    const c = columns.getBoundingClientRect();
    const p = prose.getBoundingClientRect();
    return {
      left: c.left - s.left,
      right: s.right - c.right,
      proseWidth: p.width,
      railBeside: toc ? toc.getBoundingClientRect().left > p.right - 1 : false,
    };
  });
  check('wide screen keeps the reading block centred',
    wide !== null && Math.abs(wide.left - wide.right) <= 24,
    wide ? `left=${Math.round(wide.left)} right=${Math.round(wide.right)}` : 'not found');
  check('wide screen moves the outline beside the text', wide?.railBeside === true);
  check('wide screen does not stretch the measure',
    wide !== null && wide.proseWidth <= 1000, `${Math.round(wide?.proseWidth ?? 0)}px`);
  await page.screenshot({ path: path.join(shotDir, 'docs-wide.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // ------------------------------------------------------- removed routes
  const navItems = await page.locator('nav[aria-label="Primary"] a').allTextContents();
  check('primary navigation has exactly two entries', navItems.length === 2, JSON.stringify(navItems));

  // The document index is portalled into the shell sidebar, so the page has one rail.
  const railCount = await page.locator('aside .doc-index').count();
  const strayIndex = await page.locator('main .doc-index').count();
  check('document index lives in the single sidebar', railCount === 1 && strayIndex === 0,
    `sidebar=${railCount} main=${strayIndex}`);

  for (const gone of ['/synthesis', '/knowledge', '/settings']) {
    await page.goto(`${baseUrl}${gone}`, { waitUntil: 'networkidle' });
    check(`${gone} redirects to the posts grid`,
      new URL(page.url()).pathname === '/', page.url());
  }

  // Category chips are only meaningful on the posts grid.
  await page.goto(`${baseUrl}/docs/core-insights`, { waitUntil: 'networkidle' });
  check('category filter hidden outside the posts grid',
    (await page.getByText('Categories').count()) === 0);

  // ------------------------------------------------------------------ mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/docs/core-insights`, { waitUntil: 'networkidle' });
  await page.locator('.doc-article').waitFor({ state: 'visible', timeout: 5000 });
  const mobileOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal overflow on mobile', mobileOverflow <= 1, `${mobileOverflow}px`);
  await page.screenshot({ path: path.join(shotDir, 'docs-mobile.png'), fullPage: false });

  // -------------------------------------------------------------- theming
  await page.setViewportSize({ width: 1440, height: 900 });
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const freshPage = await fresh.newPage();
  await freshPage.goto(`${baseUrl}/docs/core-insights`, { waitUntil: 'networkidle' });
  const defaultsLight = await freshPage.evaluate(() =>
    document.documentElement.classList.contains('light-theme'));
  check('defaults to the light theme', defaultsLight);
  await freshPage.locator('.doc-article').waitFor({ state: 'visible', timeout: 8000 });
  await freshPage.screenshot({ path: path.join(shotDir, 'docs-light.png'), fullPage: false });

  await freshPage.getByLabel('Toggle theme').click();
  await freshPage.waitForTimeout(300);
  const isDark = await freshPage.evaluate(() =>
    !document.documentElement.classList.contains('light-theme'));
  check('theme toggles to dark', isDark);
  await freshPage.screenshot({ path: path.join(shotDir, 'docs-dark.png'), fullPage: false });
  await fresh.close();

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (error) {
  check('run completed without exception', false, error.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`screenshots: ${shotDir}`);
process.exit(failed.length === 0 ? 0 : 1);
